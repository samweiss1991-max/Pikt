import { useState } from 'react'
import { requestsApi } from '../../lib/account'
import '../unlock/UnlockModal.css'
import './RecordHireModal.css'

/** For Members: proposes a hire for an Owner or Admin to approve. */
export default function RequestHireModal({ candidateId, onSuccess, onCancel }) {
  const [salary, setSalary] = useState('')
  const [startDate, setStartDate] = useState('')
  const [note, setNote] = useState('')
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
      await requestsApi('request_hire', { candidateId, salary: amount, startDate, note })
      onSuccess()
    } catch (err) {
      setError(err.message || 'Could not send your request. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="um-backdrop" onClick={saving ? undefined : onCancel}>
      <form className="um-modal" role="dialog" aria-modal="true" aria-labelledby="rq-title" onClick={e => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2 className="um-title" id="rq-title">Request hire approval</h2>
        <p className="um-subtitle">An Owner or Admin will review this before the hire is recorded.</p>
        <div className="rh-field">
          <label className="rh-label" htmlFor="rq-salary">Proposed first-year salary (base + super, all inclusive)</label>
          <input id="rq-salary" className="rh-input" inputMode="decimal" placeholder="120000" autoFocus value={salary} onChange={e => setSalary(e.target.value)} />
        </div>
        <div className="rh-field">
          <label className="rh-label" htmlFor="rq-start">Proposed start date</label>
          <input id="rq-start" className="rh-input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div className="rh-field">
          <label className="rh-label" htmlFor="rq-note">Note (optional)</label>
          <textarea id="rq-note" className="rh-input" rows={2} maxLength={1000} value={note} onChange={e => setNote(e.target.value)} />
        </div>
        {error && <div className="um-error" role="alert">{error}</div>}
        <div className="um-btn-row">
          <button type="button" className="um-btn-ghost" onClick={onCancel} disabled={saving}>Cancel</button>
          <button type="submit" className="um-btn-primary" disabled={saving}>{saving ? 'Sending…' : 'Send request'}</button>
        </div>
      </form>
    </div>
  )
}
