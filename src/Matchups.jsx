import { useMemo } from 'react'
import { RankBadge } from './Matchup'
import { POSITIONS, TEAM_NAMES, columnScale, kickoff } from './stats'

// Every game in the upcoming week. Each offense gets the opposing defense's rank at each
// position, so the soft spots jump out: #1 means that defense allows the most to that position.
export default function Matchups({ summary, schedule, week }) {
  const byTeam = useMemo(() => new Map(summary.map((d) => [d.team, d])), [summary])
  const scales = useMemo(
    () => Object.fromEntries(POSITIONS.map((p) => [p, columnScale(summary, p, 'avg')])),
    [summary],
  )
  const games = schedule.filter((g) => g.week === week)
  const playing = new Set(games.flatMap((g) => [g.home, g.away]))
  const byes = Object.keys(TEAM_NAMES).filter((t) => !playing.has(t))

  const side = (offense, defense) => (
    <div className="mu-side">
      <span className="mu-team">
        <span className="abbr">{offense}</span>
        <span className="mu-vs">vs {defense} D</span>
      </span>
      {POSITIONS.map((p) => (
        <RankBadge key={p} defense={byTeam.get(defense)?.byPos[p]} scale={scales[p]} />
      ))}
    </div>
  )

  return (
    <section aria-labelledby="week-title">
      <div className="view-head">
        <h2 id="week-title">Week {week} matchups</h2>
        <p className="muted">
          Rank of the defense each offense faces. #1 = allows the most points to that position. Green = soft, orange
          = tough.
        </p>
      </div>

      <div className="mu-grid">
        {games.map((g) => (
          <article key={`${g.away}-${g.home}`} className="mu-card">
            <header className="mu-head">
              <span>
                {TEAM_NAMES[g.away]} @ {TEAM_NAMES[g.home]}
              </span>
              <span className="muted">
                {g.played ? `Final ${g.away_score}–${g.home_score}` : kickoff(g)}
              </span>
            </header>
            <div className="mu-cols" aria-hidden="true">
              <span />
              {POSITIONS.map((p) => (
                <span key={p}>{p}</span>
              ))}
            </div>
            {side(g.away, g.home)}
            {side(g.home, g.away)}
          </article>
        ))}
      </div>

      {byes.length > 0 && <p className="muted byes">On bye: {byes.map((t) => TEAM_NAMES[t]).join(', ')}</p>}
    </section>
  )
}
