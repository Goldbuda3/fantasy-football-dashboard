import { useMemo, useState } from 'react'
import { POSITIONS, TEAM_NAMES, VIEWS, outlierDirection } from './stats'

const fmt = (v, signed) => (signed && v > 0 ? '+' : '') + v.toFixed(1)

// Green = defense gives up more than average (soft matchup), orange = gives up less.
function heat(value, { mean, sd }) {
  if (!sd) return undefined
  const z = Math.max(-2, Math.min(2, (value - mean) / sd))
  const pct = Math.round((Math.abs(z) / 2) * 55)
  return `color-mix(in srgb, var(${z > 0 ? '--green' : '--orange'}) ${pct}%, transparent)`
}

export default function DefenseGrid({ summary, view, selected, onSelect }) {
  const [sort, setSort] = useState({ col: 'QB', dir: -1 })
  const { field, signed } = VIEWS[view]

  const scales = useMemo(() => {
    const out = {}
    for (const pos of POSITIONS) {
      const xs = summary.map((d) => d.byPos[pos][field])
      const mean = xs.reduce((a, b) => a + b, 0) / xs.length
      const sd = Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / xs.length)
      out[pos] = { mean, sd }
    }
    return out
  }, [summary, field])

  const sorted = useMemo(() => {
    const value = (d) => (sort.col === 'team' ? TEAM_NAMES[d.team] ?? d.team : d.byPos[sort.col][field])
    return [...summary].sort((a, b) => {
      const va = value(a)
      const vb = value(b)
      return (typeof va === 'string' ? va.localeCompare(vb) : va - vb) * sort.dir
    })
  }, [summary, sort, field])

  const header = (col, label) => {
    const active = sort.col === col
    return (
      <th aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
        <button
          type="button"
          className={`sort ${active ? 'active' : ''}`}
          onClick={() => setSort({ col, dir: active ? -sort.dir : col === 'team' ? 1 : -1 })}
        >
          {label}
          <span aria-hidden="true">{active ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}</span>
        </button>
      </th>
    )
  }

  return (
    <div className="table-wrap">
      <table className="grid">
        <thead>
          <tr>
            <th className="rank">#</th>
            {header('team', 'Defense')}
            <th className="num">G</th>
            {POSITIONS.map((pos) => header(pos, pos))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((d, i) => (
            <tr key={d.team} className={d.team === selected ? 'selected' : undefined}>
              <td className="rank">{i + 1}</td>
              <td className="team">
                <button type="button" onClick={() => onSelect(d.team)} title="Show every player who scored against them">
                  <span className="abbr">{d.team}</span>
                  <span className="name">{TEAM_NAMES[d.team] ?? d.team}</span>
                </button>
              </td>
              <td className="num muted">{d.games}</td>
              {POSITIONS.map((pos) => {
                const s = d.byPos[pos]
                const flag = view === 'points' ? outlierDirection(s) : 0
                return (
                  <td key={pos} className="num cell" style={{ background: heat(s[field], scales[pos]) }}>
                    <span className="value">{fmt(s[field], signed)}</span>
                    {view === 'points' && (
                      <span className="sub">
                        {s.median.toFixed(1)}
                        {flag !== 0 && (
                          <span
                            className="flag"
                            title={
                              flag > 0
                                ? 'Average well above median: one big game is inflating it'
                                : 'Average well below median: one quiet game is dragging it down'
                            }
                          >
                            {flag > 0 ? ' ▲' : ' ▼'}
                          </span>
                        )}
                      </span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
