import { useCallback, useEffect, useState } from 'react'
import { useAccount } from '../../context/AccountContext'
import { accountApi, requestsApi } from '../../lib/account'

const ROLE_LABELS = { owner: 'Owner', admin: 'Admin', member: 'Member' }
const money = n => `$${Number(n || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const day = d => (d ? new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

function RequestRow({ request: r, canApprove, onChanged }) {
  const [salary, setSalary] = useState(r.salary ?? '')
  const [startDate, setStartDate] = useState(r.startDate ?? '')
  const [reason, setReason] = useState('')
  const [declining, setDeclining] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function run(action, params) {
    setBusy(true)
    setError(null)
    try {
      await requestsApi(action, { requestId: r.id, ...params })
      await onChanged()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  const isHire = r.type === 'hire'
  const pending = r.status === 'pending'
  const amount = Number(String(salary).replace(/[$,\s]/g, ''))
  const feeNow = r.feePercentage != null && Number.isFinite(amount) ? (amount * Number(r.feePercentage)) / 100 : null

  return (
    <li className="ac2-request">
      <div className="ac2-request-head">
        <strong>{isHire ? 'Hire' : 'Unlock'}: {r.role || 'Candidate'}</strong>
        <span className={`ac2-pill ac2-pill--${r.status}`}>{r.status[0].toUpperCase() + r.status.slice(1)}</span>
      </div>
      <p className="ac2-note">
        {r.requestedBy ? `Requested by ${r.requestedBy} on ${day(r.createdAt)}` : `Requested on ${day(r.createdAt)}`}
        {r.decidedBy && ` · ${r.status === 'approved' ? 'Approved' : 'Declined'} by ${r.decidedBy} on ${day(r.decidedAt)}`}
      </p>
      {r.note && <p className="ac2-quote">{r.note}</p>}
      {r.declineReason && <p className="ac2-quote">Reason: {r.declineReason}</p>}
      {isHire && !pending && r.salary != null && <p className="ac2-note">First-year salary: {money(r.salary)} · Start date: {day(r.startDate)}</p>}
      {isHire && !pending && r.salary == null && r.startDate && <p className="ac2-note">Start date: {day(r.startDate)}</p>}
      {isHire && pending && !canApprove && (
        <p className="ac2-note">
          Start date: {day(r.startDate)}{r.salary != null ? ` · First-year salary: ${money(r.salary)}` : ''}
        </p>
      )}

      {pending && canApprove && (
        <div className="ac2-decide">
          {isHire && (
            <div className="ac2-row">
              <div>
                <label className="ac2-label" htmlFor={`sal-${r.id}`}>First-year salary (base + super)</label>
                <input id={`sal-${r.id}`} className="ac2-input" inputMode="decimal" value={salary} onChange={e => setSalary(e.target.value)} />
              </div>
              <div>
                <label className="ac2-label" htmlFor={`start-${r.id}`}>Start date</label>
                <input id={`start-${r.id}`} className="ac2-input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
            </div>
          )}
          {isHire && feeNow != null && (
            <p className="ac2-fee">Placement fee: {Number(r.feePercentage)}% = {money(feeNow)}</p>
          )}
          {declining ? (
            <>
              <label className="ac2-label" htmlFor={`why-${r.id}`}>Reason for declining</label>
              <input id={`why-${r.id}`} className="ac2-input" autoFocus value={reason} onChange={e => setReason(e.target.value)} />
              <div className="ac2-actions">
                <button type="button" className="ac2-btn ac2-btn--danger" disabled={busy} onClick={() => run('decline', { reason })}>Confirm decline</button>
                <button type="button" className="ac2-btn" disabled={busy} onClick={() => setDeclining(false)}>Cancel</button>
              </div>
            </>
          ) : (
            <div className="ac2-actions">
              <button type="button" className="ac2-btn ac2-btn--primary" disabled={busy} onClick={() => run('approve', isHire ? { salary: amount, startDate } : {})}>Approve</button>
              <button type="button" className="ac2-btn" disabled={busy} onClick={() => setDeclining(true)}>Decline</button>
            </div>
          )}
        </div>
      )}
      {error && <p className="ac2-error" role="alert">{error}</p>}
    </li>
  )
}

export default function TeamTab() {
  const { account, canApprove, canManageUsers, refresh } = useAccount()
  const [team, setTeam] = useState(null)
  const [requests, setRequests] = useState([])
  const [error, setError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviteMessage, setInviteMessage] = useState(null)

  const load = useCallback(async () => {
    try {
      const [t, r] = await Promise.all([accountApi('team'), requestsApi('list')])
      setTeam(t)
      setRequests(r.requests)
      setError(null)
    } catch (err) {
      setError(err.message)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([accountApi('team'), requestsApi('list')])
      .then(([t, r]) => { if (!cancelled) { setTeam(t); setRequests(r.requests) } })
      .catch(err => { if (!cancelled) setError(err.message) })
    return () => { cancelled = true }
  }, [])

  const changed = useCallback(async () => { await load(); await refresh() }, [load, refresh])

  async function act(action, params) {
    setActionError(null)
    try {
      await accountApi(action, params)
      await changed()
    } catch (err) {
      setActionError(err.message)
    }
  }

  async function invite(e) {
    e.preventDefault()
    setInviteMessage(null)
    setActionError(null)
    try {
      const res = await accountApi('invite', { email: inviteEmail, role: inviteRole })
      setInviteMessage(res.emailSent
        ? `Invitation sent to ${inviteEmail}.`
        : `${inviteEmail} is invited, but the email couldn't be sent. They'll join automatically the first time they log in with that address.`)
      setInviteEmail('')
      await load()
    } catch (err) {
      setActionError(err.message)
    }
  }

  if (!account.company) return <div className="ac2-card"><p className="ac2-note">This login isn't part of a company.</p></div>
  if (error) return <p className="ac2-error" role="alert">{error}</p>
  if (!team) return <p role="status">Loading…</p>

  const isOwner = account.role === 'owner'
  const n = team.members.length
  const pending = requests.filter(r => r.status === 'pending')
  const decided = requests.filter(r => r.status !== 'pending')
  const canManage = m => canManageUsers && (isOwner || m.role !== 'owner')

  return (
    <div className="ac2-stack">
      <section className="ac2-card">
        <div className="ac2-company">
          {account.company.logoUrl && <img src={account.company.logoUrl} alt="" className="ac2-logo" />}
          <div>
            <h2 className="ac2-h2">{account.company.name}</h2>
            <p className="ac2-note">{n} {n === 1 ? 'user' : 'users'} set up under {account.company.name}</p>
          </div>
        </div>
        {actionError && <p className="ac2-error" role="alert">{actionError}</p>}
        <div className="ac2-table-wrap" tabIndex={0} role="region" aria-label="Team members">
          <table className="ac2-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th>{canManageUsers && <th><span className="fc-sr-only">Actions</span></th>}</tr></thead>
            <tbody>
              {team.members.map(m => (
                <tr key={m.id}>
                  <td>{m.full_name || '—'}{m.id === account.user.id && ' (you)'}</td>
                  <td>{m.email}</td>
                  <td>
                    {canManage(m) ? (
                      <select className="ac2-input ac2-input--small" aria-label={`Role for ${m.email}`} value={m.role} onChange={e => act('change_role', { userId: m.id, role: e.target.value })}>
                        {isOwner && <option value="owner">Owner</option>}
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                      </select>
                    ) : ROLE_LABELS[m.role]}
                  </td>
                  <td>{day(m.created_at)}</td>
                  {canManageUsers && (
                    <td>
                      {canManage(m) && (
                        <button type="button" className="ac2-btn ac2-btn--small" onClick={() => { if (window.confirm(`Remove ${m.email} from ${account.company.name}?`)) act('remove_member', { userId: m.id }) }}>Remove</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {canManageUsers && (
        <form className="ac2-card" onSubmit={invite}>
          <h2 className="ac2-h2">Invite someone</h2>
          <div className="ac2-row">
            <div>
              <label className="ac2-label" htmlFor="ac2-invite-email">Email</label>
              <input id="ac2-invite-email" className="ac2-input" type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
            </div>
            <div>
              <label className="ac2-label" htmlFor="ac2-invite-role">Role</label>
              <select id="ac2-invite-role" className="ac2-input" value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          {inviteMessage && <p className="ac2-ok" role="status">{inviteMessage}</p>}
          <button type="submit" className="ac2-btn ac2-btn--primary" disabled={!inviteEmail.trim()}>Send invite</button>
          {team.invites.length > 0 && (
            <>
              <h3 className="ac2-h3">Waiting to join</h3>
              <ul className="ac2-list">
                {team.invites.map(i => (
                  <li key={i.id} className="ac2-list-row">
                    <span>{i.email} · {ROLE_LABELS[i.role]}</span>
                    <button type="button" className="ac2-btn ac2-btn--small" onClick={() => act('cancel_invite', { inviteId: i.id })}>Cancel</button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </form>
      )}

      <section className="ac2-card" aria-labelledby="ac2-requests">
        <h2 className="ac2-h2" id="ac2-requests">{canApprove ? 'Requests' : 'Your requests'}</h2>
        {pending.length === 0 && decided.length === 0 && <p className="ac2-note">No requests yet.</p>}
        {pending.length > 0 && (
          <ul className="ac2-list">
            {pending.map(r => <RequestRow key={r.id} request={r} canApprove={canApprove} onChanged={changed} />)}
          </ul>
        )}
        {decided.length > 0 && (
          <>
            <h3 className="ac2-h3">Decided</h3>
            <ul className="ac2-list">
              {decided.map(r => <RequestRow key={r.id} request={r} canApprove={canApprove} onChanged={changed} />)}
            </ul>
          </>
        )}
      </section>
    </div>
  )
}
