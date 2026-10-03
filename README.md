# Fantasy Football Dashboard

Live at **[joaquinvargas.me/fantasy-football-dashboard](https://joaquinvargas.me/fantasy-football-dashboard/)**.

Shows how every NFL defense holds up against QBs, RBs, WRs and TEs this season, with a drill-down to every player who scored against a given defense.

- **Defense vs. position grid:** fantasy points allowed per game, with the median under each average. ▲/▼ flags a defense whose average is being skewed by one outlier game. Sortable and color-coded (green = soft matchup, orange = tough).
- **Scoring toggle:** Standard, Half PPR and PPR.
- **Games filter:** each defense's last 3 or last 5 games, or the full season.
- **vs. expected:** strength-of-schedule adjustment. Each player's points against a defense are compared with his average in his *other* games this season. Positive means the defense allows more than those players usually score.
- **Targets and carries** allowed per game by position.
- **Drill-down:** click a defense to see every player who scored against it, week by week.

## How it works

```
nflverse ──► scripts/update_data.py ──► data/fantasy.db (SQLite) ──► public/data/player_games.json ──► React app
```

1. [`scripts/update_data.py`](scripts/update_data.py) downloads nflverse weekly player stats with [nflreadpy](https://github.com/nflverse/nflreadpy). Each player-game row includes the opponent, which is how points get credited to a defense.
2. It stores raw stats (pass/rush/rec yards, TDs, receptions, targets, carries, INTs, fumbles lost) plus all three scoring formats in one SQLite table, `player_games`. It re-pulls the whole season each run and replaces that season's rows, so nflverse's after-the-fact stat corrections get picked up too.
3. It exports the table to JSON. The React app loads that JSON and does all the filtering and aggregation in the browser ([`src/stats.js`](src/stats.js)).

GitHub Pages only serves static files, which is why the database is exported to JSON instead of being queried live.

### Scoring

| | Rules |
|---|---|
| Standard | 0.1 per rush/rec yard, 6 per rush/rec TD, 0.04 per pass yard, 4 per pass TD, −2 per INT or fumble lost |
| Half PPR | Standard + 0.5 per reception |
| PPR | Standard + 1 per reception |

Fumbles lost includes rushing, receiving and sack fumbles.

### Rules

- **Per game, not totals.** All rankings divide by games played, so bye weeks don't skew them. A game where no one at a position scored counts as zero.
- **Last 3 / last 5** means each defense's own last 3 or 5 games, skipping its bye.
- **Positions:** uses nflverse's roster position for each player's most recent game, so every player has one position for the whole season. Fullbacks count as RBs. Everyone else (OL, defense, special teams) is excluded.
- **Regular season only.**
- **vs. expected** leaves out players with no other games this season, because there's nothing to compare them against.

## Run it locally

You need Node 22+ and Python 3.10+.

```sh
npm install                          # first time only
npm run dev                          # dev server with live reload
```

Then open the address it prints (usually http://localhost:5173/fantasy-football-dashboard/). The repo already includes the latest data, so this works without Python.

To refresh the data yourself:

```sh
python -m venv .venv
.venv/Scripts/activate               # Windows (on macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
python scripts/update_data.py        # or: --season 2025
```

If the download fails with `CERTIFICATE_VERIFY_FAILED` (common on Windows when antivirus inspects HTTPS), run `pip install pip-system-certs` in the venv so Python uses the Windows certificate store.

To check the production build: `npm run build`, then `npm run preview`.

## Deploying

Two GitHub Actions workflows handle this:

- [`deploy.yml`](.github/workflows/deploy.yml) builds the app and publishes it to GitHub Pages on every push to `main`. One-time setup: repo **Settings → Pages → Source: GitHub Actions**.
- [`refresh-data.yml`](.github/workflows/refresh-data.yml) runs every Tuesday at 13:00 UTC, since nflverse data can lag a day after Monday Night Football. It runs the update script, commits the new database and JSON, and starts a deploy. To refresh sooner, run it by hand from the **Actions** tab (**Refresh data → Run workflow**).

`base` in [`vite.config.js`](vite.config.js) must match the repo name (`'/fantasy-football-dashboard/'`). If the repo is ever renamed, update it, or the live site loads a blank page.
