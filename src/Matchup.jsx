import { TEAM_NAMES, heat, vsLabel } from './stats'

// A defense's rank against one position, colored the same way as the grid. #1 = allows the most.
export function RankBadge({ defense, scale, children }) {
  if (!defense) return <span className="badge badge-empty">—</span>
  return (
    <span className="badge" style={heat(defense.avg, scale)} title={`Allows ${defense.avg.toFixed(1)} pts/game`}>
      {children ?? `#${defense.rank}`}
    </span>
  )
}

// One cell per remaining week: the opponent, colored by how its defense treats this position.
// Compact mode drops the labels so 15 weeks fit across a phone.
export function ScheduleStrip({ weeks, scale, compact = false }) {
  return (
    <ol className={`strip ${compact ? 'strip-compact' : ''}`}>
      {weeks.map(({ week, match, defense }) => {
        const label = vsLabel(match)
        const title = defense
          ? `Wk ${week}: ${label} (${TEAM_NAMES[match.opp]} allow ${defense.avg.toFixed(1)}/game, #${defense.rank})`
          : `Wk ${week}: bye`
        return (
          <li
            key={week}
            className={defense ? 'strip-cell' : 'strip-cell strip-bye'}
            style={defense ? heat(defense.avg, scale) : undefined}
            title={title}
          >
            {compact ? <span className="visually-hidden">{title}</span> : (
              <>
                <span className="strip-week">{week}</span>
                <span className="strip-opp">{match ? `${match.home ? '' : '@'}${match.opp}` : 'BYE'}</span>
              </>
            )}
          </li>
        )
      })}
    </ol>
  )
}
