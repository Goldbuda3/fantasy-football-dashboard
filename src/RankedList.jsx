import { useMemo } from 'react'
import { TEAM_NAMES, barColor, columnScale, formatMetric, outlierDirection } from './stats'

const signed = (v) => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(1)

function volume(s, pos) {
  if (pos === 'QB') return `${s.carries.toFixed(1)} car`
  if (pos === 'RB') return `${s.carries.toFixed(1)} car · ${s.targets.toFixed(1)} tgt`
  return `${s.targets.toFixed(1)} tgt`
}

// Phone view: one position at a time, all 32 defenses ranked. The bar is always points per
// game (tick = median); the number on the right is whatever the list is sorted by.
export default function RankedList({ summary, pos, metric, nextOpp, onSelect }) {
  const scale = useMemo(() => columnScale(summary, pos, 'avg'), [summary, pos])
  const max = useMemo(
    () => Math.max(...summary.map((d) => Math.max(d.byPos[pos].avg, d.byPos[pos].median))) * 1.04 || 1,
    [summary, pos],
  )
  const sorted = useMemo(
    () => [...summary].sort((a, b) => b.byPos[pos][metric] - a.byPos[pos][metric]),
    [summary, pos, metric],
  )

  return (
    <ol className="ranked">
      {sorted.map((d, i) => {
        const s = d.byPos[pos]
        const flag = outlierDirection(s)
        return (
          <li key={d.team}>
            <button type="button" onClick={() => onSelect(d.team)}>
              <span className="ranked-rank">{i + 1}</span>
              <span className="ranked-main">
                <span className="ranked-team">
                  <span className="abbr">{d.team}</span>
                  <span className="name">{TEAM_NAMES[d.team] ?? d.team}</span>
                  {nextOpp && <span className="ranked-next">Next {nextOpp[d.team]}</span>}
                </span>
                <span className="bar" aria-hidden="true">
                  <span className="bar-fill" style={{ width: `${(s.avg / max) * 100}%`, background: barColor(s.avg, scale) }} />
                  <span className="bar-median" style={{ left: `${(s.median / max) * 100}%` }} />
                </span>
                <span className="ranked-detail">
                  med {s.median.toFixed(1)} · {signed(s.vsExp)} vs exp · {volume(s, pos)}
                </span>
              </span>
              <span className="ranked-value">
                <span className="value">{formatMetric(s[metric], metric)}</span>
                {flag !== 0 && <span className="flag">{flag > 0 ? '▲ 1 big game' : '▼ 1 quiet game'}</span>}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
