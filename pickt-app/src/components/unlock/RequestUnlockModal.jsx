import { useState } from 'react'
import { requestsApi } from '../../lib/account'
import { isDemoCandidateId } from '../../lib/candidateProfile'
import './UnlockModal.css'
import '../hire/RecordHireModal.css'

/** For Members: asks the company's Owners and Admins to unlock this profile. */
export default function RequestUnlockModal({ candidateId, onSuccess, onCancel }) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (isDemoCandidateId(candidateId)) throw new Error("This is a demo candidate, so a request can't be sent.")
      await requestsApi('request_unlock', { candidateId, note })
      setDone(true)
      onSuccess?.()
    } catch (err) {
      setError(err.message || 'Could not send your request. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="um-backdrop" onClick={saving ? undefined : onCancel}>
      <form className="um-modal" role="dialog" aria-modal="true" aria-labelledby="ru-title" onClick={e => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2 className="um-title" id="ru-title">Request unlock</h2>
        {done ? (
          <>
            <p className="um-subtitle" role="status">Your request has been sent to your company's Owners and Admins. You'll be told the outcome.</p>
            <div className="um-btn-row"><button type="button" className="um-btn-primary" onClick={onCancel}>Done</button></div>
          </>
        ) : (
          <>
            <p className="um-subtitle">Your company's Owners and Admins decide on unlocks. If approved, the profile unlocks for your whole company.</p>
            <div className="rh-field">
              <label className="rh-label" htmlFor="ru-note">Note (optional)</label>
              <textarea id="ru-note" className="rh-input" rows={3} autoFocus maxLength={1000} value={note} onChange={e => setNote(e.target.value)} />
            </div>
            {error && <div className="um-error" role="alert">{error}</div>}
            <div className="um-btn-row">
              <button type="button" className="um-btn-ghost" onClick={onCancel} disabled={saving}>Cancel</button>
              <button type="submit" className="um-btn-primary" disabled={saving}>{saving ? 'Sending…' : 'Send request'}</button>
            </div>
          </>
        )}
      </form>
    </div>
  )
}
