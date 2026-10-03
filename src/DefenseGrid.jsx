import { useMemo, useState } from 'react'
import { POSITIONS, TEAM_NAMES, columnScale, formatMetric, heat, outlierDirection } from './stats'

// Desktop view: all 32 defenses x 4 positions, one number per cell, colored by matchup.
export default function DefenseGrid({ summary, metric, nextOpp, selected, onSelect }) {
  const [sort, setSort] = useState({ col: 'QB', dir: -1 })

  const scales = useMemo(
    () => Object.fromEntries(POSITIONS.map((pos) => [pos, columnScale(summary, pos, metric)])),
    [summary, metric],
  )

  const sorted = useMemo(() => {
    const value = (d) => (sort.col === 'team' ? TEAM_NAMES[d.team] ?? d.team : d.byPos[sort.col][metric])
    return [...summary].sort((a, b) => {
      const va = value(a)
      const vb = value(b)
      return (typeof va === 'string' ? va.localeCompare(vb) : va - vb) * sort.dir
    })
  }, [summary, sort, metric])

  const header = (col, label) => {
    const active = sort.col === col
    return (
      <th aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'} className={col === 'team' ? '' : 'num'}>
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
            {nextOpp && <th className="next">Next</th>}
            <th className="num games">G</th>
            {POSITIONS.map((pos) => header(pos, pos))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((d, i) => (
            <tr key={d.team} className={d.team === selected ? 'selected' : undefined}>
              <td className="rank">{i + 1}</td>
              <td className="team">
                <button
                  type="button"
                  onClick={() => onSelect(d.team)}
                  aria-pressed={d.team === selected}
                  title="Show every player who scored against them"
                >
                  <span className="abbr">{d.team}</span>
                  <span className="name">{TEAM_NAMES[d.team] ?? d.team}</span>
                </button>
              </td>
              {nextOpp && <td className="next muted">{nextOpp[d.team]}</td>}
              <td className="num muted games">{d.games}</td>
              {POSITIONS.map((pos) => {
                const s = d.byPos[pos]
                const flag = metric === 'avg' ? outlierDirection(s) : 0
                return (
                  <td
                    key={pos}
                    className={`num cell ${sort.col === pos ? 'sorted' : ''}`}
                    style={heat(s[metric], scales[pos])}
                  >
                    {formatMetric(s[metric], metric)}
                    {flag !== 0 && (
                      <span
                        className="flag-dot"
                        title={`Median ${s.median.toFixed(1)}: one ${flag > 0 ? 'big' : 'quiet'} game is skewing the average`}
                      >
                        <span className="visually-hidden">
                          (median {s.median.toFixed(1)}, skewed by one {flag > 0 ? 'big' : 'quiet'} game)
                        </span>
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
