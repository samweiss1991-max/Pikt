import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import '../auth/Auth.css'
import './CandidateConfirm.css'

// Opened from the email a referred candidate receives. No login: the link's
// secret is the proof. Nothing changes until they press a button here, so email
// apps that open links to check them can't answer for them.

async function consentApi(body) {
  const { data, error } = await supabase.functions.invoke('candidate-consent', { body })
  if (error) {
    let message = 'Something went wrong. Please try again.'
    try { const b = await error.context?.json?.(); if (b?.error) message = b.error } catch { /* keep generic */ }
    throw new Error(message)
  }
  return data
}

const joinNames = names => (names.length <= 1 ? names[0] || 'A company' : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`)

export default function CandidateConfirm() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const suggested = params.get('choice') === 'no' ? 'no' : params.get('choice') === 'yes' ? 'yes' : null
  const [info, setInfo] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [confirmNo, setConfirmNo] = useState(suggested === 'no')

  useEffect(() => {
    let cancelled = false
    consentApi({ action: 'view', token })
      .then(d => { if (!cancelled) setInfo(d) })
      .catch(err => { if (!cancelled) setError(err.message) })
    return () => { cancelled = true }
  }, [token])

  async function respond(choice) {
    setBusy(true)
    setError(null)
    try {
      setInfo(await consentApi({ action: 'respond', token, choice }))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  let content
  if (error && !info) content = <p className="cc2-error" role="alert">{error}</p>
  else if (!info) content = <p role="status">Loading…</p>
  else if (info.state === 'invalid') {
    content = (
      <>
        <h1 className="auth-title">This link doesn't work</h1>
        <p className="auth-sub">It may be incomplete or out of date. Please use the button in the latest email from Pickt.</p>
      </>
    )
  } else if (info.state === 'live') {
    content = (
      <>
        <h1 className="auth-title">Your profile is live</h1>
        <p className="auth-sub">Thank you. Employers can now find you on Pickt. Your name and contact details stay private until an employer unlocks your profile.</p>
        <p className="cc2-note">We'll email you soon so you can set up your account, see who's interested, and pause or remove your profile at any time.</p>
      </>
    )
  } else if (info.state === 'declined') {
    content = (
      <>
        <h1 className="auth-title">No problem</h1>
        <p className="auth-sub">We've deleted your details, and we won't contact you again about this referral. The company that referred you has been told you declined, with no other detail.</p>
      </>
    )
  } else if (info.state === 'expired') {
    content = (
      <>
        <h1 className="auth-title">This referral has expired</h1>
        <p className="auth-sub">We didn't hear back within 30 days, so we deleted your details. If you'd like a Pickt profile, ask the company to refer you again.</p>
      </>
    )
  } else {
    const who = joinNames(info.companies || [])
    content = (
      <>
        <h1 className="auth-title">{info.firstName ? `Hi ${info.firstName}, ` : ''}{who} referred you to Pickt</h1>
        <p className="auth-sub">
          {who} interviewed you{info.role ? ` for a ${info.role} role` : ''} and thought you were a strong candidate. Pickt helps companies that are hiring find people like you. It's free for you.
        </p>
        <div className="cc2-columns">
          <section className="cc2-box">
            <h2 className="cc2-h2">Employers see</h2>
            <ul>
              <li>Your role, experience, skills and location</li>
              <li>Salary expectation, availability and work preferences</li>
              <li>How far you got in interviews, and a short feedback summary</li>
            </ul>
          </section>
          <section className="cc2-box">
            <h2 className="cc2-h2">Private until an employer unlocks you</h2>
            <ul>
              <li>Your name, email and mobile</li>
              <li>Your CV, LinkedIn and other documents</li>
            </ul>
          </section>
        </div>
        {error && <p className="cc2-error" role="alert">{error}</p>}
        {confirmNo ? (
          <div className="cc2-confirm" role="group" aria-labelledby="cc2-no-title">
            <p id="cc2-no-title"><strong>Decline and delete your details?</strong> {who} will be told you declined, with no other detail.</p>
            <div className="cc2-actions">
              <button type="button" className="cc2-btn cc2-btn--danger" disabled={busy} onClick={() => respond('no')}>Yes, delete my details</button>
              <button type="button" className="cc2-btn cc2-btn--outline" disabled={busy} onClick={() => setConfirmNo(false)}>Go back</button>
            </div>
          </div>
        ) : (
          <div className="cc2-actions">
            <button type="button" className={`cc2-btn cc2-btn--green ${suggested === 'yes' ? 'cc2-btn--suggested' : ''}`} disabled={busy} onClick={() => respond('yes')}>Yes, create my profile</button>
            <button type="button" className="cc2-btn cc2-btn--outline" disabled={busy} onClick={() => setConfirmNo(true)}>No thanks</button>
          </div>
        )}
        <p className="cc2-note">You can pause or remove your profile at any time.</p>
      </>
    )
  }

  return (
    <main className="auth-page">
      <div className="auth-card cc2-card">
        <p className="cc2-brand">Pickt</p>
        <div aria-live="polite">{content}</div>
      </div>
    </main>
  )
}
