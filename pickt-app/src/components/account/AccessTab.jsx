import { useCallback, useEffect, useState } from 'react'
import { useAccount } from '../../context/AccountContext'
import { accountApi } from '../../lib/account'
import './AccessTab.css'

// The rows of the grid. Browsing, searching, saving and referring are always allowed.
const PERMISSION_ROWS = [
  { key: 'approve', label: 'Approve unlocks & hires', detail: 'Includes seeing placement fees', action: 'approve unlocks & hires' },
  { key: 'unlock', label: 'Unlock candidate profiles', action: 'unlock candidate profiles' },
  { key: 'record_hire', label: 'Record hires', action: 'record hires' },
  { key: 'see_commission', label: 'See commission amounts & totals', action: 'see commission amounts & totals' },
  { key: 'manage_users', label: 'Invite and remove users', action: 'invite and remove users' },
  { key: 'see_billing', label: 'See billing & unlock history', action: 'see billing & unlock history' },
  { key: 'export', label: 'Export data (CSV)', action: 'export data' },
]
const LABEL = Object.fromEntries(PERMISSION_ROWS.map(r => [r.key, r.label]))
const ACTION = Object.fromEntries(PERMISSION_ROWS.map(r => [r.key, r.action]))
const ROLES = [{ key: 'admin', label: 'Admin', plural: 'Admins' }, { key: 'member', label: 'Member', plural: 'Members' }]
const PLURAL = { admin: 'Admins', member: 'Members' }

const when = iso => new Date(iso).toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })

/** What the Owner is told after a change, including anything that changed with it */
function confirmation(role, permission, allowed, changes) {
  const who = PLURAL[role]
  const main = allowed ? `${who} can now ${ACTION[permission]}.` : `${who} can no longer ${ACTION[permission]}.`
  const auto = (changes || []).filter(c => c.automatic)
  if (!auto.length) return main
  if (allowed) return `${main} "${LABEL.approve}" was turned on too, because anyone who spends money needs to see the fee first.`
  return `${main} "${auto.map(c => LABEL[c.permission]).join('" and "')}" ${auto.length === 1 ? 'was' : 'were'} turned off too, because they need approval rights.`
}

export default function AccessTab() {
  const { isOwner, refresh } = useAccount()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(null)
  const [message, setMessage] = useState(null)

  const load = useCallback(async () => {
    const res = await accountApi('permissions')
    setData(res)
    return res
  }, [])

  useEffect(() => {
    if (!isOwner) return
    load().catch(err => setError(err.message))
  }, [isOwner, load])

  async function toggle(role, permission) {
    if (saving) return
    const allowed = !data.grid[role][permission]
    setSaving(`${role}:${permission}`)
    setMessage(null)
    try {
      const res = await accountApi('set_permission', { role, permission, allowed })
      await load()
      setMessage({ ok: true, text: confirmation(role, permission, allowed, res.changes) })
      refresh()
    } catch (err) {
      setMessage({ ok: false, text: err.message || 'That change was not saved. Please try again.' })
    } finally {
      setSaving(null)
    }
  }

  if (!isOwner) {
    return <div className="ac2-card"><p className="ac2-note" role="alert">Only your company's Owner can manage access.</p></div>
  }
  if (error) return <p className="ac2-error" role="alert">{error}</p>
  if (!data) return <p role="status">Loading…</p>

  return (
    <div className="ac2-stack">
      <section className="ac2-card" aria-labelledby="ma-title">
        <h2 className="ac2-h2" id="ma-title">Manage access</h2>
        <p className="ac2-note">
          Choose what Admins and Members can do. Owners can always do everything. Everyone can browse, search, save and refer candidates.
          Changes save straight away.
        </p>

        <div className="ma-status" role="status" aria-live="polite">
          {message && <p className={message.ok ? 'ac2-ok' : 'ac2-error'}>{message.text}</p>}
        </div>

        <div className="ma-grid-wrap">
          <table className="ma-grid">
            <caption className="fc-sr-only">Permissions by role</caption>
            <thead>
              <tr>
                <th scope="col">Permission</th>
                <th scope="col">Owner</th>
                {ROLES.map(r => <th scope="col" key={r.key}>{r.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_ROWS.map(row => (
                <tr key={row.key}>
                  <th scope="row">
                    <span className="ma-perm">{row.label}</span>
                    {row.detail && <span className="ma-perm-detail">{row.detail}</span>}
                    {(row.key === 'unlock' || row.key === 'record_hire') && <span className="ma-perm-detail">Turns on approval too</span>}
                  </th>
                  <td data-role="Owner">
                    <span className="ma-always"><span className="material-symbols-outlined" aria-hidden="true">check</span>Always on</span>
                  </td>
                  {ROLES.map(r => {
                    const on = data.grid[r.key][row.key]
                    const busy = saving === `${r.key}:${row.key}`
                    return (
                      <td key={r.key} data-role={r.label}>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={on}
                          aria-label={`${row.label} for ${r.plural}`}
                          className={`ma-switch ${on ? 'ma-switch--on' : ''}`}
                          disabled={Boolean(saving)}
                          aria-busy={busy || undefined}
                          onClick={() => toggle(r.key, row.key)}
                        >
                          <span className="ma-switch-track" aria-hidden="true"><span className="ma-switch-thumb" /></span>
                          <span className="ma-switch-text">{busy ? 'Saving…' : on ? 'On' : 'Off'}</span>
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="ac2-note">
          Turning on <strong>Unlock candidate profiles</strong> or <strong>Record hires</strong> also turns on <strong>Approve unlocks &amp; hires</strong>,
          so nobody spends money without seeing the fee. Turning off approval turns both off.
          People without a permission can still ask: they'll see "Request unlock" or "Request hire approval", and the request goes to you and anyone who can approve.
        </p>
      </section>

      <section className="ac2-card" aria-labelledby="ma-log">
        <h2 className="ac2-h2" id="ma-log">Change log</h2>
        {data.log.length === 0 ? <p className="ac2-note">No changes yet. Admins and Members start with everything off.</p> : (
          <ol className="ma-log">
            {data.log.map(l => (
              <li key={l.id} className="ma-log-row">
                <span className="ma-log-what">
                  <strong>{l.by}</strong> turned {l.allowed ? 'on' : 'off'} “{LABEL[l.permission] || l.permission}” for {PLURAL[l.role] || l.role}
                  {l.automatic && <span className="ma-log-auto"> (automatically, linked)</span>}
                </span>
                <time className="ma-log-when" dateTime={l.at}>{when(l.at)}</time>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
