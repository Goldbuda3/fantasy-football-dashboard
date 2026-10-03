import { useMemo, useState } from 'react'
import { POSITIONS, TEAM_NAMES, columnScale, defenseDrilldown, heat, statLine } from './stats'

const signed = (v) => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(1)
const PLURAL = { all: 'Players', QB: 'QBs', RB: 'RBs', WR: 'WRs', TE: 'TEs' }

// One defense: per-position tiles (tap to filter), then every player who scored against it, by week.
// Shared by the phone bottom sheet and the desktop side panel.
export default function Drilldown({ rows, summary, team, span, initialPos = 'all', actions }) {
  const [pos, setPos] = useState(initialPos)
  const weeks = useMemo(() => defenseDrilldown(rows, team, span), [rows, team, span])
  const totals = summary.find((d) => d.team === team)

  return (
    <div className="drilldown">
      <div className="drill-head">
        <div>
          <h2 id="drilldown-title">{TEAM_NAMES[team] ?? team}</h2>
          <p className="muted">
            Defense · {totals?.games ?? 0} games
          </p>
        </div>
        {actions}
      </div>

      {totals && (
        <div className="tiles" role="group" aria-label="Filter by position">
          {POSITIONS.map((p) => {
            const s = totals.byPos[p]
            const colors = heat(s.avg, columnScale(summary, p, 'avg'))
            return (
              <button
                key={p}
                type="button"
                className="tile"
                aria-pressed={pos === p}
                style={colors}
                onClick={() => setPos(pos === p ? 'all' : p)}
              >
                <span className="tile-top">
                  <span>{p}</span>
                  <span>
                    #{s.rank} of {summary.length}
                  </span>
                </span>
                <span className="tile-main">{s.avg.toFixed(1)}</span>
                <span className="tile-sub">
                  med {s.median.toFixed(1)} · {signed(s.vsExp)} vs exp
                </span>
                <span className="tile-sub">
                  {s.targets.toFixed(1)} tgt · {s.carries.toFixed(1)} car
                </span>
              </button>
            )
          })}
        </div>
      )}

      <div className="drill-list-head">
        <h3>{PLURAL[pos]} who faced them</h3>
        {pos !== 'all' ? (
          <button type="button" className="link-button" onClick={() => setPos('all')}>
            Show all positions
          </button>
        ) : (
          <span className="muted">pts · vs their usual</span>
        )}
      </div>

      {weeks.map((wk) => {
        const players = wk.players.filter((r) => pos === 'all' || r.position === pos)
        const total = players.reduce((a, r) => a + r.pts, 0)
        return (
          <section key={wk.week} className="week" aria-label={`Week ${wk.week}`}>
            <h4>
              <span>
                Wk {wk.week} · vs {TEAM_NAMES[wk.offense] ?? wk.offense}
              </span>
              <span>{total.toFixed(1)} pts</span>
            </h4>
            <ul>
              {players.map((r) => (
                <li key={r.player_id} className="player">
                  <span className="player-main">
                    <span className="player-name">
                      {r.player}
                      {pos === 'all' && <span className="pos-tag">{r.position}</span>}
                    </span>
                    <span className="player-line">{statLine(r)}</span>
                  </span>
                  <span className="player-pts">
                    <span className="pts">{r.pts.toFixed(1)}</span>
                    <span
                      className={r.diff > 0 ? 'diff soft' : r.diff < 0 ? 'diff tough' : 'diff'}
                      title="Compared with his average in his other games this season"
                    >
                      {r.diff === null ? 'no other games' : `${signed(r.diff)} vs usual`}
                    </span>
                  </span>
                </li>
              ))}
              {players.length === 0 && <li className="player muted">No {PLURAL[pos]} scored against them.</li>}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
