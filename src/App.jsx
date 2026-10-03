import { useEffect, useMemo, useState } from 'react'
import './App.css'
import DefenseGrid from './DefenseGrid'
import Drilldown from './Drilldown'
import { SCORING, VIEWS, WINDOWS, defenseSummary, parseRows, withBaselines } from './stats'

function Segmented({ label, options, value, onChange }) {
  return (
    <div className="control">
      <span className="control-label">{label}</span>
      <div className="segmented" role="group" aria-label={label}>
        {Object.entries(options).map(([key, text]) => (
          <button key={key} type="button" aria-pressed={value === key} onClick={() => onChange(key)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}

function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [scoring, setScoring] = useState('ppr')
  const [span, setSpan] = useState('all')
  const [view, setView] = useState('points')
  const [team, setTeam] = useState(null)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/player_games.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((payload) => setData({ ...payload, rows: parseRows(payload) }))
      .catch((err) => setError(err.message))
  }, [])

  const scored = useMemo(() => (data ? withBaselines(data.rows, SCORING[scoring].key) : []), [data, scoring])
  const summary = useMemo(() => defenseSummary(scored, span), [scored, span])

  const selectTeam = (t) => {
    setTeam(t)
    requestAnimationFrame(() => document.getElementById('drilldown')?.scrollIntoView({ behavior: 'smooth' }))
  }

  const latestWeek = data ? Math.max(...data.rows.map((r) => r.week)) : null

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
        <>
          <div className="controls">
            <Segmented
              label="Scoring"
              options={Object.fromEntries(Object.entries(SCORING).map(([k, v]) => [k, v.label]))}
              value={scoring}
              onChange={setScoring}
            />
            <Segmented label="Games" options={WINDOWS} value={span} onChange={setSpan} />
            <Segmented
              label="Show"
              options={Object.fromEntries(Object.entries(VIEWS).map(([k, v]) => [k, v.label]))}
              value={view}
              onChange={setView}
            />
          </div>

          <p className="note">
            {VIEWS[view].note} Green = soft matchup, orange = tough. Click a column to sort, or a defense to see every
            player who scored against it.
          </p>

          <DefenseGrid summary={summary} view={view} selected={team} onSelect={selectTeam} />

          {team && <Drilldown rows={scored} summary={summary} team={team} span={span} onSelect={setTeam} />}

          <footer className="foot">
            Data: <a href="https://github.com/nflverse">nflverse</a> weekly player stats, regular season only. Per-game
            numbers, so bye weeks don&apos;t skew rankings. &ldquo;Last 3/5&rdquo; means each defense&apos;s own last 3/5
            games. FBs count as RBs.
            <br />
            <a className="back" href="https://joaquinvargas.me/">
              ← Back to joaquinvargas.me
            </a>
          </footer>
        </>
      )}
    </main>
  )
}

export default App
