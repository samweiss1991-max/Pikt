import { useCallback, useEffect, useState } from 'react'
import { adminCommissions } from '../lib/supabaseQueries'
import './AdminCommissions.css'

const money = n => `$${Number(n || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const ordinal = n => (n === 1 ? '1st' : n === 2 ? '2nd' : `${n}th`)

// Admin-only: the data comes from a server function that refuses anyone who
// isn't a Pickt admin, so this page has nothing to show to anybody else.
export default function AdminCommissions() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(null)

  const load = useCallback(async () => {
    try {
      setData(await adminCommissions('list'))
      setError(null)
    } catch (e) {
      setError(e.message || 'Could not load commissions.')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    adminCommissions('list')
      .then(d => { if (!cancelled) setData(d) })
      .catch(e => { if (!cancelled) setError(e.message || 'Could not load commissions.') })
    return () => { cancelled = true }
  }, [])

  async function run(action, params) {
    setBusy(true)
    setActionError(null)
    try {
      await adminCommissions(action, params)
      setEditing(null)
      await load()
    } catch (e) {
      setActionError(e.message || 'That didn\'t work. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  function saveCorrection(e) {
    e.preventDefault()
    run('correct_hire', {
      hireId: editing.hireId,
      salary: Number(String(editing.salary).replace(/[$,\s]/g, '')),
      startDate: editing.startDate,
    })
  }

  if (error) return <div className="ac-page"><h1 className="ac-title">Commissions</h1><p className="ac-error" role="alert">{error}</p></div>
  if (!data) return <div className="ac-page"><p role="status">Loading…</p></div>

  const { commissions, reviews } = data
  const pending = commissions.filter(c => c.status === 'pending')
  const sum = (rows, key) => rows.reduce((n, r) => n + Number(r[key] || 0), 0)

  return (
    <div className="ac-page">
      <h1 className="ac-title">Commissions</h1>
      <p className="ac-note">Only Pickt admins can see this page. Pickt's share is never shown to referrers, candidates or employers.</p>

      <div className="ac-stats">
        <div className="ac-stat"><span className="ac-stat-label">Owed to referrers</span><strong>{money(sum(pending, 'referrer_amount'))}</strong></div>
        <div className="ac-stat"><span className="ac-stat-label">Paid to referrers</span><strong>{money(sum(commissions, 'referrer_amount') - sum(pending, 'referrer_amount'))}</strong></div>
        <div className="ac-stat"><span className="ac-stat-label">Pickt's share (all hires)</span><strong>{money(sum(commissions, 'pickt_amount'))}</strong></div>
      </div>

      {actionError && <p className="ac-error" role="alert">{actionError}</p>}

      {editing && (
        <form className="ac-edit" onSubmit={saveCorrection}>
          <strong>Correct hire: {editing.label}</strong>
          <label>First-year salary (base + super, all inclusive)
            <input value={editing.salary} inputMode="decimal" onChange={e => setEditing({ ...editing, salary: e.target.value })} />
          </label>
          <label>Start date
            <input type="date" value={editing.startDate} onChange={e => setEditing({ ...editing, startDate: e.target.value })} />
          </label>
          <div className="ac-edit-actions">
            <button type="submit" className="ac-btn ac-btn--primary" disabled={busy}>Save correction</button>
            <button type="button" className="ac-btn" disabled={busy} onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      )}

      {commissions.length === 0 ? (
        <p className="ac-empty">No commissions yet. They appear here when an employer records a hire.</p>
      ) : (
        <div className="ac-table-wrap" tabIndex={0} role="region" aria-label="Commissions table">
          <table className="ac-table">
            <thead>
              <tr>
                <th>Candidate</th><th>Hired by</th><th>Referrer</th><th>Salary</th><th>Start</th>
                <th>Referrer gets</th><th>Pickt gets</th><th>Status</th><th><span className="ac-sr">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {commissions.map(c => {
                const label = c.candidate_name || c.candidate_role
                return (
                  <tr key={c.commission_id}>
                    <td>{label}</td>
                    <td>{c.hiring_company}</td>
                    <td>{c.referrer_company} ({ordinal(c.referrer_position)})</td>
                    <td>{money(c.first_year_salary)}</td>
                    <td>{c.start_date}</td>
                    <td>{money(c.referrer_amount)} ({Number(c.referrer_rate)}%)</td>
                    <td>{money(c.pickt_amount)} ({Number(c.pickt_rate)}%)</td>
                    <td><span className={`ac-pill ac-pill--${c.status}`}>{c.status === 'paid' ? 'Paid' : 'Pending'}</span></td>
                    <td className="ac-actions">
                      {c.status === 'pending' && (
                        <>
                          <button className="ac-btn ac-btn--primary" disabled={busy} onClick={() => run('mark_paid', { commissionId: c.commission_id })}>Mark paid</button>
                          <button className="ac-btn" disabled={busy} onClick={() => setEditing({ hireId: c.hire_id, label, salary: c.first_year_salary, startDate: c.start_date })}>Correct</button>
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="ac-subtitle">Referrals waiting for review</h2>
      <p className="ac-note">The email matched one candidate and the mobile matched another, so the referral wasn't added. Check the records, then ask the company to resubmit.</p>
      {reviews.length === 0 ? (
        <p className="ac-empty">Nothing to review.</p>
      ) : (
        <ul className="ac-reviews">
          {reviews.map(r => (
            <li key={r.id} className="ac-review">
              <div>
                <strong>{r.company_name || 'Unknown company'}</strong>
                <div className="ac-mono">Email matched: {r.email_match_candidate_id}</div>
                <div className="ac-mono">Mobile matched: {r.mobile_match_candidate_id}</div>
              </div>
              <button className="ac-btn" disabled={busy} onClick={() => run('resolve_review', { reviewId: r.id })}>Mark resolved</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
