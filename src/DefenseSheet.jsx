import { useEffect, useRef } from 'react'

// Phone drill-down: a modal bottom sheet over the list, so closing it returns you to the same spot.
// The native <dialog> handles focus, Escape and the back gesture's close event.
export default function DefenseSheet({ onClose, children }) {
  const ref = useRef(null)

  useEffect(() => {
    const dialog = ref.current
    dialog.showModal()
    return () => dialog.close()
  }, [])

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby="drilldown-title"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className="sheet-body">
        <div className="sheet-handle" aria-hidden="true" />
        {children}
      </div>
    </dialog>
  )
}
