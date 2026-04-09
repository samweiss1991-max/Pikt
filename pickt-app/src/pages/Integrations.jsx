import './Placeholder.css'

export default function Integrations() {
  return (
    <div style={{ maxWidth: 600 }}>
      <h1 className="settings-heading">Settings</h1>
      <p className="settings-sub">Manage your integrations and account preferences.</p>

      <h2 className="settings-section-title">ATS Integrations</h2>
      {[
        { name: 'Greenhouse', connected: false },
        { name: 'Lever', connected: false },
        { name: 'Workday', connected: false, disabled: true },
      ].map(ats => (
        <div key={ats.name} className="integration-card" style={{ opacity: ats.disabled ? 0.5 : 1 }}>
          <div className="integration-left">
            <div className={`integration-dot ${ats.connected ? 'integration-dot--on' : ''}`} />
            <div>
              <div className="integration-name">{ats.name}</div>
              <div className="integration-desc">{ats.connected ? 'Connected' : 'Not connected'}</div>
            </div>
          </div>
          <button className={`integration-btn ${ats.disabled ? 'integration-btn--disabled' : ''}`} disabled={ats.disabled}>
            {ats.disabled ? 'Coming soon' : ats.connected ? 'Disconnect' : 'Connect'}
          </button>
        </div>
      ))}

      <h2 className="settings-section-title" style={{ marginTop: '2rem' }}>Account</h2>
      <div className="integration-card">
        <div>
          <div className="integration-name">Delete account</div>
          <div className="integration-desc">Permanently remove your account and all data</div>
        </div>
        <button className="integration-btn integration-btn--danger">Delete</button>
      </div>
    </div>
  )
}
