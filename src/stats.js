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

// What a number in the grid or list can show. "avg" is the default everywhere.
export const METRICS = {
  avg: { label: 'Pts/G', long: 'Fantasy points allowed per game.' },
  median: { label: 'Median', long: 'Median fantasy points allowed per game. Less swayed by one huge game.' },
  vsExp: {
    label: 'vs. expected',
    signed: true,
    long: 'Points per game allowed above (+) or below (−) what those same players score in their other games.',
  },
  targets: { label: 'Targets', long: 'Targets allowed per game.' },
  carries: { label: 'Carries', long: 'Carries allowed per game.' },
}

export const formatMetric = (v, metric) => (METRICS[metric].signed && v > 0 ? '+' : '') + v.toFixed(1)

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

  const summary = [...byDefense].map(([team, weeks]) => {
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

  // Rank 1 = gives up the most points per game at that position (softest matchup).
  for (const pos of POSITIONS) {
    const ranked = [...summary].sort((a, b) => b.byPos[pos].avg - a.byPos[pos].avg)
    ranked.forEach((d, i) => (d.byPos[pos].rank = i + 1))
  }
  return summary
}

// Mean and spread of one metric across all 32 defenses, for coloring a column.
export function columnScale(summary, pos, metric) {
  const xs = summary.map((d) => d.byPos[pos][metric])
  const m = mean(xs)
  return { mean: m, sd: Math.sqrt(mean(xs.map((x) => (x - m) ** 2))) }
}

// Soft matchups are green, tough ones burnt orange. The pair stays distinct under all three common
// kinds of color blindness, and the orange is darker, so lightness separates them too.
// Keep these in sync with --soft, --tough and --surface in index.css.
const SOFT = [98, 201, 149]
const TOUGH = [217, 130, 43]
const SURFACE = [32, 36, 43]
const TEXT = '#e7e9ee'
const TEXT_ON_LIGHT = '#12151a'

const luminance = (rgb) => {
  const [r, g, b] = rgb.map((c) => {
    c /= 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// Background tinted by how far a value sits from the league average, plus whichever text color
// reads better on it (strong greens need dark text).
export function heat(value, { mean: m, sd }, strength = 0.75) {
  const z = sd ? Math.max(-2, Math.min(2, (value - m) / sd)) : 0
  const a = (Math.abs(z) / 2) * strength
  const rgb = (z >= 0 ? SOFT : TOUGH).map((c, i) => Math.round(c * a + SURFACE[i] * (1 - a)))
  const lum = luminance(rgb)
  const darkText = (lum + 0.05) / (luminance([18, 21, 26]) + 0.05) > (luminance([231, 233, 238]) + 0.05) / (lum + 0.05)
  return { background: `rgb(${rgb.join(',')})`, color: darkText ? TEXT_ON_LIGHT : TEXT }
}

// Solid bar color for the mobile list: never fully faded, so even average defenses show a bar.
export function barColor(value, scale) {
  const { mean: m, sd } = scale
  const z = sd ? Math.max(-2, Math.min(2, (value - m) / sd)) : 0
  const alpha = 0.35 + (Math.abs(z) / 2) * 0.65
  return `rgb(${(z >= 0 ? SOFT : TOUGH).join(' ')} / ${alpha.toFixed(2)})`
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
  if (r.carries || r.rush_yds || r.rush_td) parts.push(`${r.carries} car, ${r.rush_yds} yds${r.rush_td ? `, ${r.rush_td} TD` : ''}`)
  if (r.targets || r.rec) parts.push(`${r.rec}/${r.targets} rec, ${r.rec_yds} yds${r.rec_td ? `, ${r.rec_td} TD` : ''}`)
  if (r.fumbles_lost) parts.push(`${r.fumbles_lost} FL`)
  return parts.join(' · ') || '—'
}

// ---------- Schedule ----------

export function parseSchedule({ schedule_columns: columns, schedule }) {
  if (!schedule) return []
  return schedule.map((values) => {
    const g = Object.fromEntries(columns.map((c, i) => [c, values[i]]))
    return { ...g, played: g.home_score !== null && g.away_score !== null }
  })
}

// The week with the next unplayed game, or null once the regular season is over.
export function upcomingWeek(schedule) {
  const next = schedule.find((g) => !g.played)
  return next ? next.week : null
}

// team -> week -> { opp, home, game }. A team with no entry for a week is on bye.
export function opponentsByTeam(schedule) {
  const out = new Map()
  for (const g of schedule) {
    for (const [team, opp, home] of [
      [g.home, g.away, true],
      [g.away, g.home, false],
    ]) {
      if (!out.has(team)) out.set(team, new Map())
      out.get(team).set(g.week, { opp, home, game: g })
    }
  }
  return out
}

export const vsLabel = (m) => (m ? `${m.home ? 'vs' : '@'} ${m.opp}` : 'BYE')

export function kickoff(game) {
  const day = new Date(`${game.gameday}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })
  if (!game.gametime) return day
  const [h, m] = game.gametime.split(':').map(Number)
  return `${day} ${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'} ET`
}

// How kind a team's remaining schedule is for one position: the average points per game its
// opponents' defenses allow to that position, minus the league average. Positive = easier.
// Only unplayed games in [fromWeek, toWeek] count.
export function scheduleStrength(summary, opponents, pos, fromWeek, toWeek) {
  const byTeam = new Map(summary.map((d) => [d.team, d]))
  const league = mean(summary.map((d) => d.byPos[pos].avg))
  return summary.map(({ team }) => {
    const weeks = []
    for (let w = fromWeek; w <= toWeek; w++) {
      const m = opponents.get(team)?.get(w)
      if (m?.game.played) continue
      const def = m ? byTeam.get(m.opp) : null
      weeks.push({ week: w, match: m ?? null, defense: def ? def.byPos[pos] : null })
    }
    const games = weeks.filter((w) => w.defense)
    return {
      team,
      weeks,
      games: games.length,
      score: games.length ? mean(games.map((w) => w.defense.avg)) - league : 0,
      avgRank: games.length ? mean(games.map((w) => w.defense.rank)) : null,
    }
  })
}

// One entry per player: latest team, position and per-game numbers under the current scoring.
export function playerIndex(scoredRows) {
  const players = new Map()
  for (const r of scoredRows) {
    const p = players.get(r.player_id) ?? { id: r.player_id, name: r.player, position: r.position, games: [] }
    p.games.push(r)
    players.set(r.player_id, p)
  }
  return [...players.values()].map((p) => {
    const games = p.games.sort((a, b) => a.week - b.week)
    const pts = games.map((g) => g.pts)
    return { ...p, games, team: games.at(-1).team, avg: mean(pts), median: median(pts) }
  })
}

// A team's next unplayed week from `week` on: its opponent, or match = null for a bye.
export function nextMatch(opponents, team, week) {
  for (let w = week; w <= 18; w++) {
    const m = opponents.get(team)?.get(w)
    if (!m) return { week: w, match: null }
    if (!m.game.played) return { week: w, match: m }
  }
  return null
}
