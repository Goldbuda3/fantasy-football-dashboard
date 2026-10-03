// Desktop: every option visible as a segmented button group.
export function Segmented({ label, options, value, onChange }) {
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

// Phone: a pill that opens the native picker, so three controls fit on one line.
export function ChipSelect({ label, options, value, onChange }) {
  return (
    <label className="chip">
      <span className="visually-hidden">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {Object.entries(options).map(([key, text]) => (
          <option key={key} value={key}>
            {text}
          </option>
        ))}
      </select>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
  )
}
