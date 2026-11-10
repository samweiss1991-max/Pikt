import { useEffect, useState } from 'react'
import { accountApi } from '../../lib/account'

const money = n => `$${Number(n || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const day = d => (d ? new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

function Table({ label, headers, rows, empty }) {
  return (
    <section className="ac2-card">
      <h2 className="ac2-h2">{label}</h2>
      {rows.length === 0 ? <p className="ac2-note">{empty}</p> : (
        <div className="ac2-table-wrap" tabIndex={0} role="region" aria-label={label}>
          <table className="ac2-table">
            <thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{rows.map(r => <tr key={r.key}>{r.cells.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default function BillingTab() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    accountApi('billing')
      .then(d => { if (!cancelled) setData(d) })
      .catch(err => { if (!cancelled) setError(err.message) })
    return () => { cancelled = true }
  }, [])

  if (error) return <p className="ac2-error" role="alert">{error}</p>
  if (!data) return <p role="status">Loading…</p>

  const who = (approved, requested) => [approved, requested && `requested by ${requested}`].filter(Boolean).join(', ') || '—'

  return (
    <div className="ac2-stack">
      <p className="ac2-note">A record of your company's activity. No payments are taken here yet.</p>
      <Table
        label="Profiles unlocked"
        empty="Your company hasn't unlocked any profiles yet."
        headers={['Candidate', 'Unlocked', 'Approved by']}
        rows={data.unlocks.map(u => ({ key: u.candidateId, cells: [u.role || 'Candidate', day(u.date), who(u.approvedBy, u.requestedBy)] }))}
      />
      <Table
        label="Hires recorded"
        empty="Your company hasn't recorded any hires yet."
        headers={['Candidate', 'Start date', 'First-year salary', 'Placement fee', 'Approved by']}
        rows={data.hires.map(h => ({ key: h.id, cells: [h.role || 'Candidate', day(h.startDate), money(h.salary), `${Number(h.feePercentage)}% = ${money(h.feeAmount)}`, who(h.approvedBy, h.requestedBy)] }))}
      />
      <Table
        label="Commissions earned from referrals"
        empty="Your company hasn't earned commission yet."
        headers={['Candidate', 'Your position', 'Commission', 'Status', 'Date']}
        rows={data.commissions.map(c => ({ key: c.id, cells: [c.role || 'Candidate', c.position === 1 ? '1st referrer' : '2nd referrer', `${money(c.amount)} (${Number(c.rate)}%)`, c.status === 'paid' ? `Paid ${day(c.paidAt)}` : 'Pending', day(c.date)] }))}
      />
    </div>
  )
}
