import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import './App.css'
import { ChipSelect, Segmented } from './Controls'
import DefenseGrid from './DefenseGrid'
import DefenseSheet from './DefenseSheet'
import Drilldown from './Drilldown'
import Matchups from './Matchups'
import PlayerLookup from './PlayerLookup'
import RankedList from './RankedList'
import ScheduleStrength from './ScheduleStrength'
import {
  METRICS,
  POSITIONS,
  SCORING,
  WINDOWS,
  defenseSummary,
  nextMatch,
  opponentsByTeam,
  parseRows,
  parseSchedule,
  playerIndex,
  upcomingWeek,
  vsLabel,
  withBaselines,
} from './stats'

const PHONE = window.matchMedia('(max-width: 640px)')
const subscribe = (cb) => {
  PHONE.addEventListener('change', cb)
  return () => PHONE.removeEventListener('change', cb)
}
const useIsPhone = () => useSyncExternalStore(subscribe, () => PHONE.matches)

const SCORING_OPTIONS = Object.fromEntries(Object.entries(SCORING).map(([k, v]) => [k, v.label]))
const METRIC_OPTIONS = Object.fromEntries(Object.entries(METRICS).map(([k, v]) => [k, v.label]))
const PLURAL = { QB: 'QBs', RB: 'RBs', WR: 'WRs', TE: 'TEs' }

function CloseButton({ onClick }) {
  return (
    <button type="button" className="icon-button" aria-label="Close" onClick={onClick}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
      </svg>
    </button>
  )
}

function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [view, setView] = useState('defenses')
  const [scoring, setScoring] = useState('ppr')
  const [span, setSpan] = useState('all')
  const [metric, setMetric] = useState('avg')
  const [pos, setPos] = useState('QB')
  const [team, setTeam] = useState(null)
  const isPhone = useIsPhone()

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/player_games.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((payload) => setData({ ...payload, rows: parseRows(payload), schedule: parseSchedule(payload) }))
      .catch((err) => setError(err.message))
  }, [])

  const scored = useMemo(() => (data ? withBaselines(data.rows, SCORING[scoring].key) : []), [data, scoring])
  const summary = useMemo(() => defenseSummary(scored, span), [scored, span])
  const players = useMemo(() => playerIndex(scored), [scored])
  const schedule = useMemo(() => data?.schedule ?? [], [data])
  const opponents = useMemo(() => opponentsByTeam(schedule), [schedule])
  const week = upcomingWeek(schedule)
  // What each defense faces next, for the grid's "Next" column and the phone list.
  const nextOpp = useMemo(() => {
    if (!week) return null
    return Object.fromEntries(summary.map((d) => [d.team, vsLabel(nextMatch(opponents, d.team, week)?.match)]))
  }, [summary, opponents, week])
  const latestWeek = data ? Math.max(...data.rows.map((r) => r.week)) : null
  const close = () => setTeam(null)

  const views = {
    defenses: 'Defenses',
    ...(week && { week: `Week ${week}`, schedule: 'Schedule' }),
    players: 'Players',
  }

  const phoneFilters = (extra) => (
    <div className="chips">
      <ChipSelect label="Scoring" options={SCORING_OPTIONS} value={scoring} onChange={setScoring} />
      <ChipSelect label="Games" options={WINDOWS} value={span} onChange={setSpan} />
      {extra}
    </div>
  )

  const deskFilters = (extra) => (
    <div className="controls">
      <Segmented label="Scoring" options={SCORING_OPTIONS} value={scoring} onChange={setScoring} />
      <Segmented label="Games" options={WINDOWS} value={span} onChange={setSpan} />
      {extra}
    </div>
  )

  return (
    <main className="page">
      <header className="page-head">
        <p className="eyebrow">Side project · Sports</p>
        <h1>Fantasy Football Dashboard</h1>
        <p className="lede">
          How every NFL defense holds up against each offensive position.
          {data && (
            <>
              {' '}
              {data.season} season, through week {latestWeek}. Updated{' '}
              {new Date(data.updated).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}.
            </>
          )}
        </p>
      </header>

      {error && <p className="error">Couldn&apos;t load stats ({error}).</p>}
      {!data && !error && <p className="muted">Loading stats…</p>}

      {data && (
        <nav className="views" aria-label="Views">
          {Object.entries(views).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-current={view === key ? 'page' : undefined}
              onClick={() => setView(key)}
            >
              {label}
            </button>
          ))}
        </nav>
      )}

      {data && view === 'defenses' && isPhone && (
        <>
          <div className="phone-controls">
            <div className="pos-tabs" role="group" aria-label="Position">
              {POSITIONS.map((p) => (
                <button key={p} type="button" aria-pressed={pos === p} onClick={() => setPos(p)}>
                  {p}
                </button>
              ))}
            </div>
            {phoneFilters(
              <ChipSelect label="Sort by" options={METRIC_OPTIONS} value={metric} onChange={setMetric} />,
            )}
          </div>

          <p className="list-caption">
            <span>
              {PLURAL[pos]} · ranked by {METRICS[metric].label}
            </span>
            <span className="legend-median">median</span>
          </p>

          <RankedList summary={summary} pos={pos} metric={metric} nextOpp={nextOpp} onSelect={setTeam} />

          {team && (
            <DefenseSheet onClose={close}>
              <Drilldown
                key={team}
                rows={scored}
                summary={summary}
                team={team}
                span={span}
                initialPos={pos}
                actions={<CloseButton onClick={close} />}
              />
            </DefenseSheet>
          )}
        </>
      )}

      {data && view === 'defenses' && !isPhone && (
        <>
          {deskFilters(<Segmented label="Show" options={METRIC_OPTIONS} value={metric} onChange={setMetric} />)}

          <p className="note">
            {METRICS[metric].long} Green = soft matchup, orange = tough.
            {metric === 'avg' && <> A dot means one game is skewing the average (hover for the median).</>} Click a
            column to sort, or a defense to see every player who scored against it.
          </p>

          <div className="desk">
            <div className="desk-grid">
              <DefenseGrid summary={summary} metric={metric} nextOpp={nextOpp} selected={team} onSelect={setTeam} />
            </div>
            <aside className="desk-panel" aria-labelledby={team ? 'drilldown-title' : undefined}>
              {team ? (
                <Drilldown
                  key={team}
                  rows={scored}
                  summary={summary}
                  team={team}
                  span={span}
                  actions={<CloseButton onClick={close} />}
                />
              ) : (
                <p className="panel-empty">Pick a defense to see every player who scored against it, week by week.</p>
              )}
            </aside>
          </div>
        </>
      )}

      {data && view !== 'defenses' && <div className="view-filters">{isPhone ? phoneFilters() : deskFilters()}</div>}

      {data && view === 'week' && week && <Matchups summary={summary} schedule={schedule} week={week} />}

      {data && view === 'schedule' && week && (
        <ScheduleStrength summary={summary} opponents={opponents} week={week} isPhone={isPhone} />
      )}

      {data && view === 'players' && (
        <PlayerLookup players={players} summary={summary} opponents={opponents} week={week} isPhone={isPhone} />
      )}

      {data && (
        <footer className="foot">
          Data: <a href="https://github.com/nflverse">nflverse</a> weekly player stats and schedule, regular season
          only. Per-game numbers, so bye weeks don&apos;t skew rankings. &ldquo;Last 3/5&rdquo; means each
          defense&apos;s own last 3/5 games. FBs count as RBs. Matchup ranks use the scoring and games filters above.
          <br />
          <a className="back" href="https://joaquinvargas.me/">
            ← Back to joaquinvargas.me
          </a>
        </footer>
      )}
    </main>
  )
}

export default App
