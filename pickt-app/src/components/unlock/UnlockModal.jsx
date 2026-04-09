import { useState } from 'react'
import { persistUnlock } from '../../lib/sanitizeCandidate'
import './UnlockModal.css'

export default function UnlockModal({ candidateId, candidate: c, onSuccess, onCancel }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const saving = c.salaryLow && c.salaryHigh
    ? Math.round(((0.22 - c.fee / 100) * (c.salaryLow + c.salaryHigh) / 2) / 1000)
    : null

  async function handleConfirm() {
    setLoading(true)
    setError(null)
    try {
      // POST /api/unlocks
      const res1 = await fetch('/api/unlocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: candidateId || c.id }),
      })
      if (!res1.ok) throw new Error('Unlock failed')

      // POST /api/ats/push-candidate
      await fetch('/api/ats/push-candidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: candidateId || c.id }),
      }).catch(() => {}) // non-blocking

      persistUnlock(candidateId || c.id)
      onSuccess()
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const rows = [
    ['Placement fee', `${c.fee}% of first-year salary`, true],
    ['When charged', 'On successful hire only', false],
    ['Referred by', `${c.referringCompany || c.company || 'Unknown'} \u00B7 \u2605 4.6`, false],
    ['Interviews completed', `${c.interviews} interviews`, false],
  ]

  return (
    <div className="um-backdrop" onClick={onCancel}>
      <div className="um-modal" onClick={e => e.stopPropagation()}>
        {/* Lock icon */}
        <div className="um-lock-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>

        {/* Title */}
        <h2 className="um-title">Unlock <span className="um-title-accent">profile</span></h2>
        <p className="um-subtitle">You're about to unlock full access to this candidate {'\u2014'} including name, email, LinkedIn, and employer history.</p>

        {/* Fee box */}
        <div className="um-fee-box">
          {rows.map(([label, value, isAccent], i) => (
            <div key={label} className={`um-fee-row ${i > 0 ? 'um-fee-row--border' : ''}`}>
              <span className="um-fee-label">{label}</span>
              <span className={`um-fee-value ${isAccent ? 'um-fee-value--accent' : ''}`}>{value}</span>
            </div>
          ))}
        </div>

        {/* Savings */}
        {saving > 0 && (
          <div className="um-savings-bar">
            <span className="um-savings-left">vs. typical agency (20{'\u2013'}25%)</span>
            <span className="um-savings-right">Save ${saving}k{'\u2013'}${saving + 6}k</span>
          </div>
        )}

        {/* Terms */}
        <p className="um-terms">
          By unlocking you agree to the <span className="um-terms-link">placement terms</span>. The fee is only triggered when you confirm a hire through pick<span className="um-terms-accent">t</span>.
        </p>

        {/* Error */}
        {error && <div className="um-error">{error}</div>}

        {/* Buttons */}
        <div className="um-btn-row">
          <button className="um-btn-ghost" onClick={onCancel} disabled={loading}>Cancel</button>
          <button className="um-btn-primary" onClick={handleConfirm} disabled={loading}>
            {loading ? 'Unlocking\u2026' : 'Confirm & unlock'}
          </button>
        </div>
      </div>
    </div>
  )
}
