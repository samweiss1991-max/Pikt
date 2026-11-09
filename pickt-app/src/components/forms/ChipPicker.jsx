import { useId, useRef, useState } from 'react'
import { MAX_FEEDBACK_CHIPS, MAX_FEEDBACK_CHIP_LENGTH } from '../../../supabase/functions/_shared/candidateFields.js'
import './FormControls.css'

/**
 * A searchable, grouped multi-select with removable chips and "add your own".
 * Keyboard: type to search, arrow keys move, Enter adds, Escape closes, Backspace
 * in an empty box removes the last chip. Additions and removals are announced.
 */
export default function ChipPicker({ label, required = false, groups, value = [], onChange, placeholder }) {
  const baseId = useId()
  const inputId = `${baseId}-input`
  const listId = `${baseId}-list`
  const hintId = `${baseId}-hint`
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [announcement, setAnnouncement] = useState('')
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const full = value.length >= MAX_FEEDBACK_CHIPS
  const chosen = value.map(v => v.toLowerCase())
  const q = query.trim().toLowerCase()

  // Groups with what's already chosen or doesn't match taken out, numbered in display order
  const flat = []
  const visibleGroups = groups
    .map(g => ({
      label: g.label,
      options: g.options
        .filter(o => !chosen.includes(o.toLowerCase()) && (!q || o.toLowerCase().includes(q)))
        .map(o => {
          const row = { value: o, index: flat.length }
          flat.push(row)
          return row
        }),
    }))
    .filter(g => g.options.length > 0)

  const typed = query.trim().slice(0, MAX_FEEDBACK_CHIP_LENGTH)
  const inList = groups.some(g => g.options.some(o => o.toLowerCase() === q))
  const canAddOwn = Boolean(q) && !inList && !chosen.includes(q)
  const ownRow = canAddOwn ? { value: typed, index: flat.length, custom: true } : null
  const rows = ownRow ? [...flat, ownRow] : flat

  function add(text) {
    if (full || chosen.includes(text.toLowerCase())) return
    const next = [...value, text]
    onChange(next)
    setAnnouncement(`${text} added. ${next.length} of ${MAX_FEEDBACK_CHIPS} chosen.`)
    setQuery('')
    setActive(-1)
    if (next.length >= MAX_FEEDBACK_CHIPS) setOpen(false)
  }

  function remove(text) {
    const next = value.filter(v => v !== text)
    onChange(next)
    setAnnouncement(`${text} removed. ${next.length} of ${MAX_FEEDBACK_CHIPS} chosen.`)
    // After the update: at the maximum the box is disabled until then
    setTimeout(() => inputRef.current?.focus())
  }

  function move(next) {
    setActive(next)
    listRef.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView?.({ block: 'nearest' })
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      else if (rows.length) move((active + 1) % rows.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (open && rows.length) move((Math.max(active, 0) - 1 + rows.length) % rows.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (open && rows[active]) add(rows[active].value)
      // Enter with no highlight: an exact list match, otherwise their own wording
      else if (q) {
        const exact = flat.find(r => r.value.toLowerCase() === q)
        if (exact) add(exact.value)
        else if (ownRow) add(ownRow.value)
      }
    } else if (e.key === 'Escape' && open) {
      e.preventDefault()
      setOpen(false)
      setActive(-1)
    } else if (e.key === 'Backspace' && !query && value.length > 0) {
      remove(value[value.length - 1])
    }
  }

  const optionProps = row => ({
    id: `${baseId}-opt-${row.index}`,
    'data-index': row.index,
    role: 'option',
    'aria-selected': row.index === active,
    className: `fc-option ${row.index === active ? 'fc-option--active' : ''}`,
    onMouseDown: e => { e.preventDefault(); add(row.value) },
    onMouseEnter: () => setActive(row.index),
  })

  return (
    <div className="fc-field">
      <label className="fc-label" htmlFor={inputId}>{label}{required && ' *'}</label>

      {value.length > 0 && (
        <ul className="fc-chips" aria-label={`${label} chosen`}>
          {value.map(v => (
            <li key={v} className="fc-chip">
              {v}
              <button type="button" className="fc-chip-remove" aria-label={`Remove ${v}`} onClick={() => remove(v)}>
                <span className="material-symbols-outlined" aria-hidden="true">close</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="fc-combo">
        <input
          ref={inputRef}
          id={inputId}
          className="fc-input"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 ? `${baseId}-opt-${active}` : undefined}
          aria-required={required || undefined}
          aria-describedby={hintId}
          autoComplete="off"
          maxLength={MAX_FEEDBACK_CHIP_LENGTH}
          disabled={full}
          placeholder={full ? `Maximum of ${MAX_FEEDBACK_CHIPS} chosen` : placeholder}
          value={query}
          onChange={e => { setQuery(e.target.value); setActive(-1); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={() => { setOpen(false); setActive(-1) }}
          onKeyDown={onKeyDown}
        />
        <span className="material-symbols-outlined fc-combo-icon" aria-hidden="true">expand_more</span>
        <div id={listId} ref={listRef} role="listbox" aria-label={label} aria-multiselectable="true" className="fc-list" hidden={!open || full}>
          {visibleGroups.map(g => (
            <div key={g.label} role="group" aria-label={g.label}>
              <div className="fc-group-heading" aria-hidden="true">{g.label}</div>
              {g.options.map(row => <div key={row.value} {...optionProps(row)}>{row.value}</div>)}
            </div>
          ))}
          {ownRow && <div {...optionProps(ownRow)}>Add your own: “{ownRow.value}”</div>}
          {rows.length === 0 && <div className="fc-option fc-option--empty" role="presentation">No more options. Type to add your own.</div>}
        </div>
      </div>

      <p className="fc-hint" id={hintId}>
        Choose up to {MAX_FEEDBACK_CHIPS}, or type your own and press Enter. {value.length} of {MAX_FEEDBACK_CHIPS} chosen.
      </p>
      <span className="fc-sr-only" role="status" aria-live="polite">{announcement}</span>
    </div>
  )
}
