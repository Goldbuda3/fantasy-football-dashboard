import { useMemo, useState } from 'react'
import { POSITIONS, TEAM_NAMES, defenseDrilldown, statLine } from './stats'

const signed = (v) => (v > 0 ? '+' : '') + v.toFixed(1)

export default function Drilldown({ rows, summary, team, span, onSelect }) {
  const [pos, setPos] = useState('all')
  const weeks = useMemo(() => defenseDrilldown(rows, team, span), [rows, team, span])
  const totals = summary.find((d) => d.team === team)

  return (
    <section className="drilldown" id="drilldown" aria-labelledby="drilldown-title">
      <div className="drill-head">
        <h2 id="drilldown-title">{TEAM_NAMES[team] ?? team} defense</h2>
        <label className="field">
          <span>Defense</span>
          <select value={team} onChange={(e) => onSelect(e.target.value)}>
            {Object.keys(TEAM_NAMES)
              .sort((a, b) => TEAM_NAMES[a].localeCompare(TEAM_NAMES[b]))
              .map((t) => (
                <option key={t} value={t}>
                  {TEAM_NAMES[t]}
                </option>
              ))}
          </select>
        </label>
      </div>

      {totals && (
        <div className="cards">
          {POSITIONS.map((p) => {
            const s = totals.byPos[p]
            return (
              <div key={p} className="card">
                <div className="card-pos">{p}</div>
                <div className="card-main">{s.avg.toFixed(1)}</div>
                <div className="card-sub">
                  median {s.median.toFixed(1)} · <span className={s.vsExp > 0 ? 'pos' : 'neg'}>{signed(s.vsExp)}</span>{' '}
                  vs exp
                </div>
                <div className="card-sub">
                  {s.targets.toFixed(1)} tgt · {s.carries.toFixed(1)} car / g
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="segmented" role="group" aria-label="Position">
        {['all', ...POSITIONS].map((p) => (
          <button key={p} type="button" aria-pressed={pos === p} onClick={() => setPos(p)}>
            {p === 'all' ? 'All' : p}
          </button>
        ))}
      </div>

      {weeks.map((wk) => {
        const players = wk.players.filter((r) => pos === 'all' || r.position === pos)
        return (
          <div key={wk.week} className="week">
            <h3>
              Week {wk.week} <span className="muted">vs. {TEAM_NAMES[wk.offense] ?? wk.offense}</span>
            </h3>
            <div className="table-wrap">
              <table className="players">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Pos</th>
                    <th className="line-col">Stat line</th>
                    <th className="num">Pts</th>
                    <th className="num" title="His average in his other games this season">
                      Usual
                    </th>
                    <th className="num">+/−</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((r) => (
                    <tr key={r.player_id}>
                      <td>{r.player}</td>
                      <td className="muted">{r.position}</td>
                      <td className="line-col muted">{statLine(r)}</td>
                      <td className="num strong">{r.pts.toFixed(1)}</td>
                      <td className="num muted">{r.baseline === null ? '—' : r.baseline.toFixed(1)}</td>
                      <td className={`num ${r.diff > 0 ? 'pos' : r.diff < 0 ? 'neg' : ''}`}>
                        {r.diff === null ? '—' : signed(r.diff)}
                      </td>
                    </tr>
                  ))}
                  {players.length === 0 && (
                    <tr>
                      <td colSpan={6} className="muted">
                        No {pos} scored against them this week.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </section>
  )
}
