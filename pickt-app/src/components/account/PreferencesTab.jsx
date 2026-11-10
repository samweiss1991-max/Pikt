import { useState } from 'react'
import { useAccount } from '../../context/AccountContext'
import { useViewMode } from '../../context/ViewModeContext'
import { accountApi, HOMEPAGES } from '../../lib/account'

const VIEWS = [
  { value: 'stack', label: 'Stack' },
  { value: 'carousel', label: 'Carousel' },
  { value: 'matrix', label: 'Matrix' },
  { value: 'tinder', label: 'Flickt' },
  { value: 'focus', label: 'Focus' },
]

const EMAILS = [
  { key: 'saved_search_matches', label: 'New candidates matching my saved searches' },
  { key: 'referral_status', label: 'Referral status updates' },
  { key: 'request_outcomes', label: 'Request outcomes' },
  { key: 'hire_commission', label: 'Hire and commission updates', approversOnly: true },
  { key: 'new_requests', label: 'New unlock and hire requests', approversOnly: true },
]

export default function PreferencesTab() {
  const { account, canApprove, refresh } = useAccount()
  const { setViewMode } = useViewMode()
  const [homepage, setHomepage] = useState(account.preferences.homepage)
  const [defaultView, setDefaultView] = useState(account.preferences.defaultView)
  const [email, setEmail] = useState(account.preferences.email || {})
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  async function save(e) {
    e.preventDefault()
    setSaved(false)
    setError(null)
    try {
      await accountApi('update_preferences', { homepage, defaultView, email })
      setViewMode(defaultView)
      await refresh()
      setSaved(true)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form className="ac2-card" onSubmit={save}>
      <h2 className="ac2-h2">Preferences</h2>
      <p className="ac2-note">Saved to your account, so they apply on any device.</p>

      <label className="ac2-label" htmlFor="ac2-home">Homepage after login</label>
      <select id="ac2-home" className="ac2-input" value={homepage} onChange={e => setHomepage(e.target.value)}>
        {HOMEPAGES.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
      </select>

      <label className="ac2-label" htmlFor="ac2-view">Default results view</label>
      <select id="ac2-view" className="ac2-input" value={defaultView} onChange={e => setDefaultView(e.target.value)}>
        {VIEWS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
      </select>

      <fieldset className="ac2-fieldset">
        <legend className="ac2-label">Email notifications</legend>
        {EMAILS.filter(o => canApprove || !o.approversOnly).map(o => (
          <label key={o.key} className="ac2-check">
            {/* On until someone turns it off */}
            <input type="checkbox" checked={email[o.key] !== false} onChange={e => setEmail(prev => ({ ...prev, [o.key]: e.target.checked }))} />
            {o.label}
          </label>
        ))}
      </fieldset>

      {error && <p className="ac2-error" role="alert">{error}</p>}
      {saved && <p className="ac2-ok" role="status">Preferences saved.</p>}
      <button type="submit" className="ac2-btn ac2-btn--primary">Save preferences</button>
    </form>
  )
}
