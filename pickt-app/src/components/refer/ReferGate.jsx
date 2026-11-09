import { useState } from 'react'
import { checkReferralStatus } from '../../lib/supabaseQueries'
import ReferralPanel from './ReferralPanel'
import './ReferralPanel.css'

/**
 * First screen of a referral: enter the candidate's email and mobile, see whether
 * a referral spot is open and what it would earn, before filling in the long form.
 * A separate component so the fields keep focus while typing.
 */
export default function ReferGate({ candidateId, initialEmail = '', initialMobile = '', onContinue }) {
  const [email, setEmail] = useState(initialEmail)
  const [mobile, setMobile] = useState(initialMobile)
  const [checking, setChecking] = useState(false)
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)

  async function handleCheck(e) {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid candidate email.')
      return
    }
    if (mobile.replace(/\D/g, '').length < 8) {
      setError('Enter the candidate\'s mobile number.')
      return
    }
    setChecking(true)
    setError(null)
    setStatus(null)
    try {
      setStatus(await checkReferralStatus({ email: email.trim(), mobile: mobile.trim(), candidateId }))
    } catch (err) {
      setError(err.message || 'Could not check this candidate. Please try again.')
    } finally {
      setChecking(false)
    }
  }

  // Details changed: the old answer may no longer apply
  function edit(setter) {
    return e => { setter(e.target.value); setStatus(null) }
  }

  return (
    <div className="rg">
      <div>
        <h1 className="rg-heading">Refer this candidate</h1>
        <p className="rg-lead">Enter their email and mobile, and we'll check if a referral spot is open before you fill in the details.</p>
      </div>

      <form className="rf-fields" onSubmit={handleCheck}>
        <div>
          <label className="rf-label" htmlFor="rg-email">Candidate email</label>
          <input id="rg-email" type="email" className="rf-input" placeholder="name@example.com" autoComplete="off" value={email} onChange={edit(setEmail)} />
        </div>
        <div>
          <label className="rf-label" htmlFor="rg-mobile">Mobile number</label>
          <input id="rg-mobile" className="rf-input" placeholder="+61 4XX XXX XXX" autoComplete="off" value={mobile} onChange={edit(setMobile)} />
        </div>
        {error && <div className="rf-errors" role="alert"><ul><li>{error}</li></ul></div>}
        {!status && (
          <button type="submit" className="rf-btn-next press-scale" disabled={checking}>
            {checking ? 'Checking…' : 'Check candidate'}
          </button>
        )}
      </form>

      {status && status.matchesCandidate === false && (
        <p className="rg-warning" role="status">These details don't match the candidate you were viewing. Please check them before continuing.</p>
      )}

      <ReferralPanel
        status={status}
        action={
          <button type="button" className="rp-btn press-scale" onClick={() => onContinue({ email: email.trim(), mobile: mobile.trim() })}>
            Refer this candidate
          </button>
        }
      />

      {status?.state === 'review' && (
        <button type="button" className="rp-btn rp-btn--secondary press-scale" onClick={() => onContinue({ email: email.trim(), mobile: mobile.trim() })}>
          Continue anyway
        </button>
      )}
    </div>
  )
}
