import { useState } from 'react'
import { recordHire } from '../../lib/supabaseQueries'
import '../unlock/UnlockModal.css'
import './RecordHireModal.css'

export default function RecordHireModal({ candidateId, onSuccess, onCancel }) {
  const [salary, setSalary] = useState('')
  const [startDate, setStartDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    const amount = Number(String(salary).replace(/[$,\s]/g, ''))
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter the first-year salary as a number, for example 120000.')
      return
    }
    if (!startDate) {
      setError('Enter the start date.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await recordHire({ candidateId, salary: amount, startDate })
      onSuccess()
    } catch (err) {
      setError(err.message || 'Could not record this hire. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="um-backdrop" onClick={saving ? undefined : onCancel}>
      <form
        className="um-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rh-title"
        onClick={e => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2 className="um-title" id="rh-title">Record this hire</h2>
        <p className="um-subtitle">The placement fee is based on these details, so please check them carefully.</p>

        <div className="rh-field">
          <label className="rh-label" htmlFor="rh-salary">First-year salary (base + super, all inclusive)</label>
          <input
            id="rh-salary"
            className="rh-input"
            inputMode="decimal"
            placeholder="120000"
            autoFocus
            value={salary}
            onChange={e => setSalary(e.target.value)}
          />
        </div>

        <div className="rh-field">
          <label className="rh-label" htmlFor="rh-start">Start date</label>
          <input
            id="rh-start"
            className="rh-input"
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
          />
        </div>

        {error && <div className="um-error" role="alert">{error}</div>}

        <div className="um-btn-row">
          <button type="button" className="um-btn-ghost" onClick={onCancel} disabled={saving}>Cancel</button>
          <button type="submit" className="um-btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Confirm hire'}
          </button>
        </div>
      </form>
    </div>
  )
}
