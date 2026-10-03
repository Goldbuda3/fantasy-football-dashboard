import { useMemo, useState } from 'react'
import { Segmented } from './Controls'
import { ScheduleStrip } from './Matchup'
import { POSITIONS, TEAM_NAMES, columnScale, scheduleStrength } from './stats'

const RANGES = { rest: 'Rest of season', playoffs: 'Playoffs (Wk 15–17)' }
const PLURAL = { QB: 'QBs', RB: 'RBs', WR: 'WRs', TE: 'TEs' }
const LAST_WEEK = 18

const signed = (v) => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(1)

// Which offenses have the kindest remaining schedule at a position, judged by how many points
// their upcoming opponents' defenses have allowed to that position so far.
export default function ScheduleStrength({ summary, opponents, week, isPhone }) {
  const [pos, setPos] = useState('RB')
  const [range, setRange] = useState('rest')
  const from = range === 'playoffs' ? Math.max(15, week) : week
  const to = range === 'playoffs' ? 17 : LAST_WEEK

  const scale = useMemo(() => columnScale(summary, pos, 'avg'), [summary, pos])
  const rows = useMemo(
    () => scheduleStrength(summary, opponents, pos, from, to).sort((a, b) => b.score - a.score),
    [summary, opponents, pos, from, to],
  )

  return (
    <section aria-labelledby="sos-title">
      <div className="view-head">
        <h2 id="sos-title">Schedule strength</h2>
        <p className="muted">
          Points per game that each offense&apos;s upcoming opponents allow to {PLURAL[pos]}, compared with the league
          average. Higher = easier schedule.
        </p>
      </div>

      <div className="controls">
        {isPhone ? (
          <div className="pos-tabs" role="group" aria-label="Position">
            {POSITIONS.map((p) => (
              <button key={p} type="button" aria-pressed={pos === p} onClick={() => setPos(p)}>
                {p}
              </button>
            ))}
          </div>
        ) : (
          <Segmented label="Position" options={Object.fromEntries(POSITIONS.map((p) => [p, p]))} value={pos} onChange={setPos} />
        )}
        <Segmented label="Weeks" options={RANGES} value={range} onChange={setRange} />
      </div>

      {from > to ? (
        <p className="muted">The fantasy playoffs are over for this season.</p>
      ) : (
        <>
          {isPhone && (
            <p className="list-caption">
              Each block is one week, {from} to {to}. Striped = bye.
            </p>
          )}
          <ol className="sos">
            {rows.map((r, i) => (
              <li key={r.team} className="sos-row">
                <span className="sos-rank">{i + 1}</span>
                <span className="sos-team">
                  <span className="abbr">{r.team}</span>
                  {!isPhone && <span className="name">{TEAM_NAMES[r.team]}</span>}
                </span>
                <span className={`sos-score ${r.score > 0 ? 'soft' : r.score < 0 ? 'tough' : ''}`}>
                  {r.games ? signed(r.score) : '—'}
                  <span className="sos-games">
                    {r.games} {r.games === 1 ? 'game' : 'games'}
                  </span>
                </span>
                <span className="sos-strip">
                  <ScheduleStrip weeks={r.weeks} scale={scale} compact={isPhone} />
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  )
}
