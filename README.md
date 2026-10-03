# Fantasy Football Dashboard

Live at **[joaquinvargas.me/fantasy-football-dashboard](https://joaquinvargas.me/fantasy-football-dashboard/)**.

Shows how every NFL defense holds up against QBs, RBs, WRs and TEs this season, with a drill-down to every player who scored against a given defense.

Two layouts, switching at 640px wide:

- **Desktop: defense vs. position grid.** All 32 defenses against QB, RB, WR and TE, one number per cell. Sortable, and colored green for soft matchups and burnt orange for tough ones. A dot marks an average skewed by one outlier game (hover for the median). Click a defense to open its details in a side panel.
- **Phone: ranked list.** Pick a position, then see all 32 defenses ranked. Each row has a bar for points per game, a tick for the median, and a line with vs. expected and targets/carries. Tap a defense to open its details in a bottom sheet.

Both layouts share:

- **Scoring:** Standard, Half PPR and PPR.
- **Games:** each defense's last 3 or last 5 games, or the full season.
- **Metrics:** points per game, median, vs. expected, targets and carries allowed per game.
- **vs. expected:** strength-of-schedule adjustment. Each player's points against a defense are compared with his average in his *other* games this season. Positive means the defense allows more than those players usually score.
- **Defense details:** per-position tiles with league rank (tap one to filter), then every player who scored against that defense, week by week.

Three more tabs use the nflverse schedule:

- **Week N:** every game in the upcoming week. Each offense gets the rank of the defense it faces at QB, RB, WR and TE (#1 = allows the most points). The Defenses grid and phone list also show each defense's next opponent.
- **Schedule:** schedule strength for the rest of the season, or just the fantasy playoffs (weeks 15–17). For each offense and position: how many points per game its remaining opponents allow, compared with the league average, plus a week-by-week strip of opponents colored by matchup.
- **Players:** search a QB, RB, WR or TE to see his next opponent and how that defense ranks against his position, his remaining schedule, and his game log.

All matchup ranks follow the scoring and games filters, so "last 3" ranks defenses by their recent form.

Green and burnt orange were chosen because they stay distinguishable under all three common types of color blindness, and the orange is darker, so lightness separates them too.

## How it works

```
nflverse ──► scripts/update_data.py ──► data/fantasy.db (SQLite) ──► public/data/player_games.json ──► React app
```

1. [`scripts/update_data.py`](scripts/update_data.py) downloads nflverse weekly player stats with [nflreadpy](https://github.com/nflverse/nflreadpy). Each player-game row includes the opponent, which is how points get credited to a defense.
2. It stores raw stats (pass/rush/rec yards, TDs, receptions, targets, carries, INTs, fumbles lost) plus all three scoring formats in one SQLite table, `player_games`. The regular-season schedule (teams, dates, kickoff times, scores) goes in a second table, `games`. nflverse's schedule also has betting lines; the script deliberately leaves those out. It re-pulls the whole season each run and replaces that season's rows, so nflverse's after-the-fact stat corrections get picked up too.
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
- [`refresh-data.yml`](.github/workflows/refresh-data.yml) runs every Tuesday at 13:00 UTC, since nflverse data can lag a day after Monday Night Football. It runs the update script, commits the new database and JSON, and starts a deploy.

### Refreshing the data by hand

Use this to refresh between Tuesdays, or to test the workflow after changing it.

1. Open the repo's **Actions** tab on GitHub.
2. Click **Refresh data** in the left sidebar.
3. Click **Run workflow**, keep the branch as `main`, and click the green **Run workflow** button.

Then check:

- **Refresh data** finishes green (about a minute).
- A "Refresh NFL stats (…)" commit from `github-actions[bot]` appears on `main`.
- A new **Deploy to GitHub Pages** run starts right after it. When it finishes, the date in the site's header shows today.

If a run goes red, click into it to see which step failed and why.

The bot commits to `main` every week, so run `git pull` before making local changes.

`base` in [`vite.config.js`](vite.config.js) must match the repo name (`'/fantasy-football-dashboard/'`). If the repo is ever renamed, update it, or the live site loads a blank page.
