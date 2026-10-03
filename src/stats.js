// All dashboard math lives here. Rows come from public/data/player_games.json,
// which scripts/update_data.py exports from the SQLite database.

export const POSITIONS = ['QB', 'RB', 'WR', 'TE']

export const SCORING = {
  std: { label: 'Standard', key: 'pts_std' },
  half: { label: 'Half PPR', key: 'pts_half' },
  ppr: { label: 'PPR', key: 'pts_ppr' },
}

export const WINDOWS = {
  3: 'Last 3',
  5: 'Last 5',
  all: 'Season',
}

export const VIEWS = {
  points: { label: 'Points allowed', field: 'avg', note: 'Fantasy points allowed per game. Small number = median.' },
  vsExp: {
    label: 'vs. expected',
    field: 'vsExp',
    signed: true,
    note: 'Points per game allowed above (+) or below (−) what those same players score in their other games.',
  },
  targets: { label: 'Targets', field: 'targets', note: 'Targets allowed per game.' },
  carries: { label: 'Carries', field: 'carries', note: 'Carries allowed per game.' },
}

export const TEAM_NAMES = {
  ARI: 'Arizona Cardinals', ATL: 'Atlanta Falcons', BAL: 'Baltimore Ravens', BUF: 'Buffalo Bills',
  CAR: 'Carolina Panthers', CHI: 'Chicago Bears', CIN: 'Cincinnati Bengals', CLE: 'Cleveland Browns',
  DAL: 'Dallas Cowboys', DEN: 'Denver Broncos', DET: 'Detroit Lions', GB: 'Green Bay Packers',
  HOU: 'Houston Texans', IND: 'Indianapolis Colts', JAX: 'Jacksonville Jaguars', KC: 'Kansas City Chiefs',
  LA: 'Los Angeles Rams', LAC: 'Los Angeles Chargers', LV: 'Las Vegas Raiders', MIA: 'Miami Dolphins',
  MIN: 'Minnesota Vikings', NE: 'New England Patriots', NO: 'New Orleans Saints', NYG: 'New York Giants',
  NYJ: 'New York Jets', PHI: 'Philadelphia Eagles', PIT: 'Pittsburgh Steelers', SEA: 'Seattle Seahawks',
  SF: 'San Francisco 49ers', TB: 'Tampa Bay Buccaneers', TEN: 'Tennessee Titans', WAS: 'Washington Commanders',
}

export function parseRows({ columns, rows }) {
  return rows.map((values) => Object.fromEntries(columns.map((c, i) => [c, values[i]])))
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length

function median(xs) {
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

// The weeks each defense actually played, oldest first. Windows count a defense's own games,
// so "last 3" skips its bye instead of leaving a hole.
function gamesByDefense(rows) {
  const weeks = new Map()
  for (const r of rows) {
    if (!weeks.has(r.opponent)) weeks.set(r.opponent, new Set())
    weeks.get(r.opponent).add(r.week)
  }
  return new Map([...weeks].map(([team, set]) => [team, [...set].sort((a, b) => a - b)]))
}

function windowWeeks(allWeeks, span) {
  return new Set(span === 'all' ? allWeeks : allWeeks.slice(-Number(span)))
}

// Strength-of-schedule baseline: the player's average in his *other* games this season.
// Leaving the current game out keeps one big game from inflating its own expectation.
// Players with no other games have no baseline and are left out of the adjustment.
export function withBaselines(rows, ptsKey) {
  const totals = new Map()
  for (const r of rows) {
    const t = totals.get(r.player_id) ?? { sum: 0, n: 0 }
    t.sum += r[ptsKey]
    t.n += 1
    totals.set(r.player_id, t)
  }
  return rows.map((r) => {
    const t = totals.get(r.player_id)
    const pts = r[ptsKey]
    const baseline = t.n > 1 ? (t.sum - pts) / (t.n - 1) : null
    return { ...r, pts, baseline, diff: baseline === null ? null : pts - baseline }
  })
}

// Flags a defense whose average sits well away from its median: one game is skewing it.
export function outlierDirection({ avg, median: med, games }) {
  if (games < 3) return 0
  const gap = avg - med
  if (Math.abs(gap) < 2 || Math.abs(gap) < 0.25 * Math.max(med, 1)) return 0
  return Math.sign(gap)
}

export function defenseSummary(scoredRows, span) {
  const games = gamesByDefense(scoredRows)
  const byDefense = new Map()
  for (const [team, weeks] of games) byDefense.set(team, windowWeeks(weeks, span))

  // defense -> week -> position -> per-game totals
  const totals = new Map()
  for (const r of scoredRows) {
    if (!byDefense.get(r.opponent).has(r.week)) continue
    if (!totals.has(r.opponent)) totals.set(r.opponent, new Map())
    const weekMap = totals.get(r.opponent)
    if (!weekMap.has(r.week)) weekMap.set(r.week, {})
    const g = (weekMap.get(r.week)[r.position] ??= { pts: 0, diff: 0, targets: 0, carries: 0 })
    g.pts += r.pts
    g.diff += r.diff ?? 0
    g.targets += r.targets
    g.carries += r.carries
  }

  return [...byDefense].map(([team, weeks]) => {
    const perGame = [...weeks].map((w) => totals.get(team)?.get(w) ?? {})
    const byPos = {}
    for (const pos of POSITIONS) {
      // A game where nobody at this position scored still counts, as a zero.
      const g = perGame.map((wk) => wk[pos] ?? { pts: 0, diff: 0, targets: 0, carries: 0 })
      byPos[pos] = {
        games: g.length,
        avg: mean(g.map((x) => x.pts)),
        median: median(g.map((x) => x.pts)),
        vsExp: mean(g.map((x) => x.diff)),
        targets: mean(g.map((x) => x.targets)),
        carries: mean(g.map((x) => x.carries)),
      }
    }
    return { team, games: weeks.size, byPos }
  })
}

// Every player who scored against one defense in the span, grouped by week (newest first).
export function defenseDrilldown(scoredRows, team, span) {
  const weeks = windowWeeks(gamesByDefense(scoredRows).get(team) ?? [], span)
  const byWeek = new Map()
  for (const r of scoredRows) {
    if (r.opponent !== team || !weeks.has(r.week)) continue
    if (!byWeek.has(r.week)) byWeek.set(r.week, { week: r.week, offense: r.team, players: [] })
    byWeek.get(r.week).players.push(r)
  }
  return [...byWeek.values()]
    .sort((a, b) => b.week - a.week)
    .map((wk) => ({ ...wk, players: wk.players.sort((a, b) => b.pts - a.pts) }))
}

export function statLine(r) {
  const parts = []
  if (r.pass_yds || r.pass_td || r.ints) parts.push(`${r.pass_yds} pass yds, ${r.pass_td} TD, ${r.ints} INT`)
  if (r.carries || r.rush_yds || r.rush_td) parts.push(`${r.carries}-${r.rush_yds} rush${r.rush_td ? `, ${r.rush_td} TD` : ''}`)
  if (r.targets || r.rec) parts.push(`${r.rec}/${r.targets}-${r.rec_yds} rec${r.rec_td ? `, ${r.rec_td} TD` : ''}`)
  if (r.fumbles_lost) parts.push(`${r.fumbles_lost} FL`)
  return parts.join(' · ') || '—'
}
