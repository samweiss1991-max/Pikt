import { useSearchParams } from 'react-router-dom'
import { useAccount } from '../context/AccountContext'
import ProfileTab from '../components/account/ProfileTab'
import TeamTab from '../components/account/TeamTab'
import PreferencesTab from '../components/account/PreferencesTab'
import BillingTab from '../components/account/BillingTab'
import './Account.css'

export default function Account() {
  const { account, loading, canApprove, demo } = useAccount()
  const [params, setParams] = useSearchParams()

  if (demo) return <div className="ac2-page"><h1 className="ac2-title">Account settings</h1><p className="ac2-note">Log in to see your account.</p></div>
  if (loading) return <div className="ac2-page"><p role="status">Loading…</p></div>
  if (!account) {
    return <div className="ac2-page"><h1 className="ac2-title">Account settings</h1><p className="ac2-error" role="alert">We couldn't load your account. Please refresh the page.</p></div>
  }

  const tabs = [
    { key: 'profile', label: 'Profile' },
    { key: 'team', label: 'Company & team' },
    { key: 'preferences', label: 'Preferences' },
    ...(canApprove ? [{ key: 'billing', label: 'Billing & unlocks' }] : []),
  ]
  const active = tabs.some(t => t.key === params.get('tab')) ? params.get('tab') : 'profile'

  function select(key) {
    setParams(prev => { const next = new URLSearchParams(prev); next.set('tab', key); return next }, { replace: true })
  }

  function onKeyDown(e) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
    e.preventDefault()
    const i = tabs.findIndex(t => t.key === active)
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1
      : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
    select(tabs[next].key)
    requestAnimationFrame(() => document.getElementById(`ac2-tab-${tabs[next].key}`)?.focus())
  }

  return (
    <div className="ac2-page">
      <h1 className="ac2-title">Account settings</h1>
      <div className="ac2-tabs" role="tablist" aria-label="Account settings" onKeyDown={onKeyDown}>
        {tabs.map(t => (
          <button
            key={t.key}
            id={`ac2-tab-${t.key}`}
            type="button"
            role="tab"
            aria-selected={active === t.key}
            aria-controls="ac2-panel"
            tabIndex={active === t.key ? 0 : -1}
            className={`ac2-tab ${active === t.key ? 'ac2-tab--active' : ''}`}
            onClick={() => select(t.key)}
          >
            {t.label}
            {t.key === 'team' && account.pendingCount > 0 && <span className="ac2-count">{account.pendingCount}</span>}
          </button>
        ))}
      </div>
      <div id="ac2-panel" role="tabpanel" aria-labelledby={`ac2-tab-${active}`}>
        {active === 'profile' && <ProfileTab />}
        {active === 'team' && <TeamTab />}
        {active === 'preferences' && <PreferencesTab />}
        {active === 'billing' && <BillingTab />}
      </div>
    </div>
  )
}
