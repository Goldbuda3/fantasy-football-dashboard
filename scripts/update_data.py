"""Pull nflverse weekly player stats, store them in SQLite, and export JSON for the dashboard.

Usage:  python scripts/update_data.py [--season 2026]

Re-pulls the whole season each run (one small parquet file) and replaces that season's rows,
so nflverse's after-the-fact stat corrections are picked up along with the newest week.
"""

import argparse
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import nflreadpy as nfl
import polars as pl

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "fantasy.db"
JSON_PATH = ROOT / "public" / "data" / "player_games.json"

# Position rule: trust nflverse's roster position, count fullbacks as RBs, ignore everyone else.
# A player's position comes from his most recent game, so each player has one position all season.
POSITION_MAP = {"QB": "QB", "RB": "RB", "FB": "RB", "WR": "WR", "TE": "TE"}

STAT_COLUMNS = {
    "pass_yds": "passing_yards",
    "pass_td": "passing_tds",
    "ints": "passing_interceptions",
    "carries": "carries",
    "rush_yds": "rushing_yards",
    "rush_td": "rushing_tds",
    "targets": "targets",
    "rec": "receptions",
    "rec_yds": "receiving_yards",
    "rec_td": "receiving_tds",
}

SCHEMA = """
CREATE TABLE IF NOT EXISTS player_games (
    season       INTEGER NOT NULL,
    week         INTEGER NOT NULL,
    player_id    TEXT    NOT NULL,
    player       TEXT    NOT NULL,
    position     TEXT    NOT NULL,
    team         TEXT    NOT NULL,
    opponent     TEXT    NOT NULL,
    pass_yds     INTEGER NOT NULL,
    pass_td      INTEGER NOT NULL,
    ints         INTEGER NOT NULL,
    carries      INTEGER NOT NULL,
    rush_yds     INTEGER NOT NULL,
    rush_td      INTEGER NOT NULL,
    targets      INTEGER NOT NULL,
    rec          INTEGER NOT NULL,
    rec_yds      INTEGER NOT NULL,
    rec_td       INTEGER NOT NULL,
    fumbles_lost INTEGER NOT NULL,
    pts_std      REAL    NOT NULL,
    pts_half     REAL    NOT NULL,
    pts_ppr      REAL    NOT NULL,
    PRIMARY KEY (season, week, player_id)
);
"""


def load_season(season: int) -> pl.DataFrame:
    raw = nfl.load_player_stats(seasons=[season], summary_level="week")
    raw = raw.filter(pl.col("season_type") == "REG")

    latest_position = (
        raw.sort("week")
        .group_by("player_id")
        .agg(pl.col("position").last().replace_strict(POSITION_MAP, default=None).alias("pos"))
    )

    df = (
        raw.join(latest_position, on="player_id")
        .filter(pl.col("pos").is_not_null())
        .select(
            pl.col("season"),
            pl.col("week"),
            pl.col("player_id"),
            pl.col("player_display_name").alias("player"),
            pl.col("pos").alias("position"),
            pl.col("team"),
            pl.col("opponent_team").alias("opponent"),
            *[pl.col(src).fill_null(0).alias(dst) for dst, src in STAT_COLUMNS.items()],
            (
                pl.col("rushing_fumbles_lost").fill_null(0)
                + pl.col("receiving_fumbles_lost").fill_null(0)
                + pl.col("sack_fumbles_lost").fill_null(0)
            ).alias("fumbles_lost"),
        )
    )

    standard = (
        0.1 * (pl.col("rush_yds") + pl.col("rec_yds"))
        + 6 * (pl.col("rush_td") + pl.col("rec_td"))
        + 0.04 * pl.col("pass_yds")
        + 4 * pl.col("pass_td")
        - 2 * (pl.col("ints") + pl.col("fumbles_lost"))
    )
    return df.with_columns(
        standard.round(2).alias("pts_std"),
        (standard + 0.5 * pl.col("rec")).round(2).alias("pts_half"),
        (standard + pl.col("rec")).round(2).alias("pts_ppr"),
    ).sort("week", "opponent", "position", "player")


def write_db(df: pl.DataFrame, season: int) -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.executescript(SCHEMA)
        conn.execute("DELETE FROM player_games WHERE season = ?", (season,))
        placeholders = ", ".join("?" * len(df.columns))
        conn.executemany(
            f"INSERT INTO player_games ({', '.join(df.columns)}) VALUES ({placeholders})",
            df.rows(),
        )


def write_json(season: int) -> None:
    # Export from the database so the dashboard always shows exactly what's stored.
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.execute(
            "SELECT week, player_id, player, position, team, opponent, pass_yds, pass_td, ints,"
            " carries, rush_yds, rush_td, targets, rec, rec_yds, rec_td, fumbles_lost,"
            " pts_std, pts_half, pts_ppr FROM player_games WHERE season = ?"
            " ORDER BY week, opponent, position, player",
            (season,),
        )
        columns = [d[0] for d in cur.description]
        rows = cur.fetchall()

    JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "season": season,
        "updated": datetime.now(timezone.utc).isoformat(timespec="minutes"),
        "columns": columns,
        "rows": rows,
    }
    JSON_PATH.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--season", type=int, default=nfl.get_current_season())
    season = parser.parse_args().season

    df = load_season(season)
    if df.is_empty():
        raise SystemExit(f"No regular-season stats found for {season}.")
    write_db(df, season)
    write_json(season)
    print(f"{season}: {df.height} player-games through week {df['week'].max()} -> {DB_PATH.name}, {JSON_PATH.name}")


if __name__ == "__main__":
    main()
