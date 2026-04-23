import { useEffect, useRef, useState } from 'react'
import './FilterDropdown.css'

export default function FilterDropdown({ label, options, selected, onChange, icon }) {
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const ref = useRef(null)

  function handleClose() {
    setClosing(true)
    setTimeout(() => { setOpen(false); setClosing(false) }, 120)
  }

  // Close on click outside
  useEffect(() => {
    if (!open) return
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) handleClose()
    }
    function onKey(e) {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey) }
  }, [open])

  function toggle(val) {
    if (selected.includes(val)) {
      onChange(selected.filter(v => v !== val))
    } else {
      onChange([...selected, val])
    }
  }

  const count = selected.length

  return (
    <div className="fd-wrap" ref={ref}>
      <button
        className={`fd-trigger ${count > 0 ? 'fd-trigger--active' : ''} ${open ? 'fd-trigger--open' : ''}`}
        onClick={() => open ? handleClose() : setOpen(true)}
      >
        {icon && <span className="fd-trigger-icon">{icon}</span>}
        <span className="fd-trigger-label">{label}</span>
        {count > 0 && <span className="fd-trigger-count">{count}</span>}
        <svg className={`fd-chevron ${open ? 'fd-chevron--open' : ''}`} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
      </button>

      {open && (
        <div className={`fd-panel ${closing ? 'fd-panel--closing' : ''}`}>
          {count > 0 && (
            <button className="fd-clear" onClick={() => onChange([])}>Clear</button>
          )}
          <div className="fd-options">
            {options.map(opt => {
              const isSelected = selected.includes(opt)
              return (
                <label key={opt} className={`fd-option ${isSelected ? 'fd-option--selected' : ''}`} onClick={() => toggle(opt)}>
                  <span className={`fd-checkbox ${isSelected ? 'fd-checkbox--checked' : ''}`}>
                    {isSelected && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                    )}
                  </span>
                  <span className="fd-option-text">{opt}</span>
                </label>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
