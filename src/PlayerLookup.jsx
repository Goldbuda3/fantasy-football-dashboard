import { useMemo, useState } from 'react'
import { RankBadge, ScheduleStrip } from './Matchup'
import { TEAM_NAMES, columnScale, kickoff, scheduleStrength, statLine, vsLabel } from './stats'

const PLURAL = { QB: 'QBs', RB: 'RBs', WR: 'WRs', TE: 'TEs' }
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Search a player to see his next opponent, how that defense treats his position,
// his remaining schedule and his game log.
export default function PlayerLookup({ players, summary, opponents, week, isPhone }) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(null)

  const results = useMemo(() => {
    const q = fold(query.trim())
    const pool = q ? players.filter((p) => fold(p.name).includes(q)) : players.filter((p) => p.games.length >= 2)
    return pool.sort((a, b) => b.avg - a.avg).slice(0, q ? 20 : 12)
  }, [players, query])

  const selected = players.find((p) => p.id === selectedId)
  const showList = !isPhone || !selected

  return (
    <section aria-labelledby="players-title" className="players-view">
      {showList && (
        <div className="players-search">
          <div className="view-head">
            <h2 id="players-title">Players</h2>
          </div>
          <label className="search">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-4-4" strokeLinecap="round" />
            </svg>
            <span className="visually-hidden">Search players</span>
            <input
              type="search"
              placeholder="Search a QB, RB, WR or TE"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <p className="list-caption">
            <span>{query.trim() ? `${results.length} match${results.length === 1 ? '' : 'es'}` : 'Top scorers per game'}</span>
          </p>
          <ul className="results">
            {results.map((p) => (
              <li key={p.id}>
                <button type="button" aria-pressed={p.id === selectedId} onClick={() => setSelectedId(p.id)}>
                  <span className="result-main">
                    <span className="result-name">{p.name}</span>
                    <span className="muted">
                      {p.position} · {p.team} · {p.games.length} {p.games.length === 1 ? 'game' : 'games'}
                    </span>
                  </span>
                  <span className="result-pts">{p.avg.toFixed(1)}</span>
                </button>
              </li>
            ))}
            {results.length === 0 && <li className="muted empty">No QB, RB, WR or TE matches “{query}”.</li>}
          </ul>
        </div>
      )}

      {selected ? (
        <PlayerDetail
          key={selected.id}
          player={selected}
          summary={summary}
          opponents={opponents}
          week={week}
          isPhone={isPhone}
          onBack={() => setSelectedId(null)}
        />
      ) : (
        !isPhone && <p className="panel-empty players-empty">Pick a player to see his next matchup and schedule.</p>
      )}
    </section>
  )
}

function PlayerDetail({ player, summary, opponents, week, isPhone, onBack }) {
  const { position: pos, team } = player
  const scale = useMemo(() => columnScale(summary, pos, 'avg'), [summary, pos])
  const byTeam = useMemo(() => new Map(summary.map((d) => [d.team, d])), [summary])
  const schedule = useMemo(
    () => (week ? scheduleStrength(summary, opponents, pos, week, 18).find((r) => r.team === team) : null),
    [summary, opponents, pos, week, team],
  )
  // Unplayed weeks only, so a team that already played this week shows its following game.
  const next = schedule?.weeks[0]
  const nextDefense = next?.match ? byTeam.get(next.match.opp)?.byPos[pos] : null

  return (
    <article className="player-detail" aria-labelledby="player-title">
      {isPhone && (
        <button type="button" className="back-button" onClick={onBack}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Players
        </button>
      )}
      <h2 id="player-title">{player.name}</h2>
      <p className="muted">
        {pos} · {TEAM_NAMES[team] ?? team}
      </p>

      <div className="player-stats">
        <div>
          <span className="stat-value">{player.avg.toFixed(1)}</span>
          <span className="stat-label">pts / game</span>
        </div>
        <div>
          <span className="stat-value">{player.median.toFixed(1)}</span>
          <span className="stat-label">median</span>
        </div>
        <div>
          <span className="stat-value">{player.games.length}</span>
          <span className="stat-label">games</span>
        </div>
      </div>

      {next && (
        <div className="next-game">
          <h3>Next: Week {next.week}</h3>
          {next.match ? (
            <div className="next-row">
              <RankBadge defense={nextDefense} scale={scale} />
              <p>
                <strong>
                  {vsLabel(next.match)} · {kickoff(next.match.game)}
                </strong>
                <br />
                {nextDefense && (
                  <span className="muted">
                    {TEAM_NAMES[next.match.opp]} allow {nextDefense.avg.toFixed(1)} pts/game to {PLURAL[pos]}, #
                    {nextDefense.rank} of {summary.length} (
                    {nextDefense.rank <= 8 ? 'soft matchup' : nextDefense.rank >= 25 ? 'tough matchup' : 'about average'}).
                  </span>
                )}
              </p>
            </div>
          ) : (
            <p className="muted">Bye week.</p>
          )}
        </div>
      )}

      {schedule && schedule.weeks.length > 0 && (
        <div className="player-section">
          <h3>Rest of season vs {PLURAL[pos]}</h3>
          <ScheduleStrip weeks={schedule.weeks} scale={scale} />
        </div>
      )}

      <div className="player-section">
        <h3>Game log</h3>
        <ul className="gamelog">
          {[...player.games].reverse().map((g) => (
            <li key={g.week} className="player">
              <span className="player-main">
                <span className="player-name">
                  Wk {g.week} · {g.team === team ? '' : `${g.team} `}vs {g.opponent}
                  <RankBadge defense={byTeam.get(g.opponent)?.byPos[pos]} scale={scale} />
                </span>
                <span className="player-line">{statLine(g)}</span>
              </span>
              <span className="player-pts">
                <span className="pts">{g.pts.toFixed(1)}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="muted small">
        Badges show each defense&apos;s rank against {PLURAL[pos]} this season: #1 allows the most.
      </p>
    </article>
  )
}
