import { useId, useMemo, useRef, useState } from 'react'
import './FormControls.css'

const MAX_SHOWN = 200

/**
 * A dropdown you can type in to search. Keyboard: arrow keys move, Enter picks,
 * Escape closes, Tab moves on. Follows the standard combobox pattern so screen
 * readers announce it properly.
 *
 * allowCustom lets someone type a value that isn't in the list.
 * Clicking in keeps the current value, selected so typing replaces it. Emptying
 * the box and leaving clears the value.
 */
export default function SearchableSelect({
  label, required = false, options = [], value = '', onSelect, disabled = false,
  placeholder = 'Type to search', allowCustom = false, loading = false, hint,
}) {
  const baseId = useId()
  const inputId = `${baseId}-input`
  const listId = `${baseId}-list`
  const hintId = `${baseId}-hint`
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [edited, setEdited] = useState(false)
  const [active, setActive] = useState(-1)
  const listRef = useRef(null)

  const { shown, more, customRow } = useMemo(() => {
    // Until something is typed, show the whole list
    const q = edited ? query.trim().toLowerCase() : ''
    const matches = !q ? options : options
      .filter(o => o.label.toLowerCase().includes(q))
      // Names starting with what's typed come first
      .sort((a, b) => Number(b.label.toLowerCase().startsWith(q)) - Number(a.label.toLowerCase().startsWith(q)))
    const exact = options.some(o => o.label.toLowerCase() === q)
    return {
      shown: matches.slice(0, MAX_SHOWN),
      more: Math.max(0, matches.length - MAX_SHOWN),
      customRow: allowCustom && q && !exact ? { value: query.trim(), label: query.trim(), custom: true } : null,
    }
  }, [options, query, edited, allowCustom])

  const rows = customRow ? [...shown, customRow] : shown

  function openList(e) {
    if (open) return
    setQuery(value)
    setEdited(false)
    // Start on the current choice, so Enter without moving doesn't change it
    setActive(options.slice(0, MAX_SHOWN).findIndex(o => o.label === value))
    setOpen(true)
    e?.target?.select?.()
  }

  function moveActive(next) {
    setActive(next)
    listRef.current?.children[next]?.scrollIntoView?.({ block: 'nearest' })
  }

  function close() {
    setOpen(false)
    setQuery('')
    setEdited(false)
    setActive(-1)
  }

  function pick(row) {
    onSelect(row)
    close()
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) openList()
      else if (rows.length) moveActive((active + 1) % rows.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (open && rows.length) moveActive((Math.max(active, 0) - 1 + rows.length) % rows.length)
    } else if (e.key === 'Enter') {
      if (open) {
        e.preventDefault() // don't submit a surrounding form
        if (rows[active]) pick(rows[active])
        else close()
      }
    } else if (e.key === 'Escape' && open) {
      e.preventDefault()
      close()
    }
  }

  // Leaving the box: keep what was typed if that's allowed, or clear if emptied
  function onBlur() {
    if (edited) {
      const q = query.trim()
      const exact = options.find(o => o.label.toLowerCase() === q.toLowerCase())
      if (!q) onSelect(null)
      else if (exact) onSelect(exact)
      else if (allowCustom) onSelect({ value: q, label: q, custom: true })
    }
    close()
  }

  const activeId = open && rows[active] ? `${baseId}-opt-${active}` : undefined
  const describedBy = hint ? hintId : undefined

  return (
    <div className="fc-field">
      <label className="fc-label" htmlFor={inputId}>{label}{required && ' *'}</label>
      <div className="fc-combo">
        <input
          id={inputId}
          className="fc-input"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-required={required || undefined}
          aria-describedby={describedBy}
          aria-busy={loading || undefined}
          autoComplete="off"
          disabled={disabled}
          placeholder={loading && !disabled ? 'Loading…' : placeholder}
          value={open ? query : value}
          onChange={e => { setQuery(e.target.value); setEdited(true); setActive(0); setOpen(true) }}
          onFocus={openList}
          onClick={openList}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
        />
        <span className="material-symbols-outlined fc-combo-icon" aria-hidden="true">expand_more</span>
        <ul id={listId} ref={listRef} role="listbox" aria-label={label} className="fc-list" hidden={!open || disabled}>
          {rows.map((row, i) => (
            <li
              key={`${row.custom ? 'custom' : row.value}`}
              id={`${baseId}-opt-${i}`}
              role="option"
              aria-selected={row.label === value}
              className={`fc-option ${i === active ? 'fc-option--active' : ''}`}
              // mousedown, so the pick happens before the box loses focus
              onMouseDown={e => { e.preventDefault(); pick(row) }}
              onMouseEnter={() => setActive(i)}
            >
              {row.custom ? `Use “${row.label}”` : row.label}
            </li>
          ))}
          {rows.length === 0 && <li className="fc-option fc-option--empty" role="presentation">{loading ? 'Loading…' : 'No matches'}</li>}
          {more > 0 && <li className="fc-option fc-option--empty" role="presentation">{more} more. Keep typing to narrow the list.</li>}
        </ul>
      </div>
      {hint && <p className="fc-hint" id={hintId}>{hint}</p>}
    </div>
  )
}
