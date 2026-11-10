import { useState } from 'react'
import { useAccount } from '../../context/AccountContext'
import { accountApi } from '../../lib/account'
import { supabase } from '../../lib/supabase'

export default function ProfileTab() {
  const { account, refresh } = useAccount()
  const [fullName, setFullName] = useState(account.user.fullName || '')
  const [jobTitle, setJobTitle] = useState(account.user.jobTitle || '')
  const [saved, setSaved] = useState(null)
  const [error, setError] = useState(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [passwordMessage, setPasswordMessage] = useState(null)
  const [passwordError, setPasswordError] = useState(null)

  async function saveProfile(e) {
    e.preventDefault()
    setSaved(null)
    setError(null)
    try {
      await accountApi('update_profile', { fullName, jobTitle })
      await refresh()
      setSaved('Profile saved.')
    } catch (err) {
      setError(err.message)
    }
  }

  async function changePassword(e) {
    e.preventDefault()
    setPasswordMessage(null)
    setPasswordError(null)
    if (password.length < 8) return setPasswordError('Use at least 8 characters.')
    if (password !== confirm) return setPasswordError("Those passwords don't match.")
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) return setPasswordError(err.message)
    setPassword('')
    setConfirm('')
    setPasswordMessage('Password changed.')
  }

  return (
    <div className="ac2-stack">
      <form className="ac2-card" onSubmit={saveProfile}>
        <h2 className="ac2-h2">Your profile</h2>
        {account.company ? (
          <>
            <label className="ac2-label" htmlFor="ac2-name">Name</label>
            <input id="ac2-name" className="ac2-input" value={fullName} onChange={e => setFullName(e.target.value)} />
            <label className="ac2-label" htmlFor="ac2-title">Job title</label>
            <input id="ac2-title" className="ac2-input" value={jobTitle} onChange={e => setJobTitle(e.target.value)} />
          </>
        ) : <p className="ac2-note">This login isn't part of a company.</p>}
        <label className="ac2-label" htmlFor="ac2-email">Email</label>
        <input id="ac2-email" className="ac2-input" value={account.user.email || ''} readOnly aria-describedby="ac2-email-note" />
        <p className="ac2-note" id="ac2-email-note">Your email is your login, so it can't be changed here. To change it, contact Pickt.</p>
        {error && <p className="ac2-error" role="alert">{error}</p>}
        {saved && <p className="ac2-ok" role="status">{saved}</p>}
        {account.company && <button type="submit" className="ac2-btn ac2-btn--primary">Save profile</button>}
      </form>

      <form className="ac2-card" onSubmit={changePassword}>
        <h2 className="ac2-h2">Change password</h2>
        <label className="ac2-label" htmlFor="ac2-password">New password</label>
        <input id="ac2-password" className="ac2-input" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} />
        <label className="ac2-label" htmlFor="ac2-confirm">Confirm new password</label>
        <input id="ac2-confirm" className="ac2-input" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} />
        {passwordError && <p className="ac2-error" role="alert">{passwordError}</p>}
        {passwordMessage && <p className="ac2-ok" role="status">{passwordMessage}</p>}
        <button type="submit" className="ac2-btn ac2-btn--primary">Change password</button>
      </form>
    </div>
  )
}
