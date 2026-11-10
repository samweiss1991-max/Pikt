import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAccount } from '../context/AccountContext'
import { accountApi } from '../lib/account'
import './Placements.css'

const DAY = 24 * 60 * 60 * 1000
const money = n => (n == null ? '—' : `$${Number(n).toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`)
const day = iso => (iso ? new Date(String(iso).length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const ordinal = n => (n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`)
const initials = text => (text || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?'

const TABS = [
  { key: 'hired', label: 'Hired through Pickt', pill: 'View hires' },
  { key: 'referred', label: 'Referred placements', pill: 'View referrals' },
]

/**
 * Where a hire is on the way to the 90-day mark, from the start date.
 * Check-ins aren't recorded yet (see TODO.md), so this is time since starting.
 */
function checkInStage(startDate, now = new Date()) {
  const start = new Date(`${startDate}T00:00:00`)
  const days = Math.floor((now.getTime() - start.getTime()) / DAY)
  const steps = [
    { label: 'Offer', done: true },
    { label: 'Started', done: days >= 0 },
    { label: '30 days', done: days >= 30 },
    { label: '90 days', done: days >= 90 },
  ]
  if (days < 0) return { steps, days, status: 'Starting soon', note: `Starts ${day(startDate)}` }
  if (days >= 90) return { steps, days, status: 'Placed', note: '✓ Passed 90 days', passed: true }
  const next = days < 30 ? 30 : 90
  const nextDate = new Date(start.getTime() + next * DAY).toISOString().slice(0, 10)
  return { steps, days, status: 'In progress', note: `Day ${days + 1} of 90 · next check-in ${day(nextDate)} (${next} days)` }
}

function Progress({ stage }) {
  return (
    <ol className="pl-progress" aria-label="Progress">
      {stage.steps.map((s, i) => (
        <li key={s.label} className={`pl-step ${s.done ? 'pl-step--done' : ''}`}>
          {i > 0 && <span className="pl-step-arrow" aria-hidden="true">→</span>}
          <span>{s.label}</span>
          <span className="fc-sr-only">{s.done ? ' (done)' : ' (not yet)'}</span>
        </li>
      ))}
    </ol>
  )
}

/** In place of a money table for people without the permission */
function Locked({ title }) {
  return (
    <div className="pl-locked">
      <span className="material-symbols-outlined" aria-hidden="true">lock</span>
      <div>
        <h3 className="pl-money-title">{title}</h3>
        <p>Only visible to your company's Owner. Ask them if you need access.</p>
      </div>
    </div>
  )
}

function MoneyHeader({ title, visibleTo, isOwner }) {
  return (
    <div className="pl-money-head">
      <h3 className="pl-money-title">{title}</h3>
      <p className="pl-visible">
        Visible to: {visibleTo.join(', ')}
        {isOwner && <> · <Link to="/account?tab=access" className="pl-link">Manage access</Link></>}
      </p>
    </div>
  )
}

function HiredPanel({ data, isOwner }) {
  const rows = data.hired
  if (!rows.length) {
    return (
      <div className="pl-panel-empty">
        <p>No hires through Pickt yet. When you hire someone you found here, they'll appear with their progress and placement fee.</p>
        <Link to="/marketplace/discover" className="pl-btn pl-btn--navy press-scale">Browse candidates →</Link>
      </div>
    )
  }
  return (
    <>
      <ul className="pl-rows">
        {rows.map(h => {
          const stage = checkInStage(h.startDate)
          const title = h.name || h.role || 'Candidate'
          return (
            <li key={h.id} className="pl-row">
              <span className="pl-avatar pl-avatar--navy" aria-hidden="true">{initials(h.name || h.role)}</span>
              <div className="pl-row-main">
                <p className="pl-row-title">
                  {h.unlocked ? <Link to={`/candidates/${h.candidateId}`} className="pl-link">{title}</Link> : title}
                </p>
                {h.name && h.role && <p className="pl-row-sub">{h.role}</p>}
                <p className="pl-row-meta">
                  <span>Started {day(h.startDate)}</span>
                  {h.location && <span>{h.location}</span>}
                  {h.referrers?.length > 0 && <span>Referred by {h.referrers.join(', ')}</span>}
                </p>
                <Progress stage={stage} />
                <p className="pl-row-note">{stage.note}</p>
              </div>
              <span className={`pl-badge ${stage.passed ? 'pl-badge--green' : 'pl-badge--navy'}`}>{stage.status}</span>
            </li>
          )
        })}
      </ul>

      {data.canSeeFees ? (
        <section className="pl-money" aria-label="Placement fees">
          <MoneyHeader title="Placement fees" visibleTo={data.visibleTo.fees} isOwner={isOwner} />
          <table className="pl-table">
            <thead><tr><th scope="col">Candidate</th><th scope="col">Salary</th><th scope="col">Fee %</th><th scope="col">Amount</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {rows.map(h => (
                <tr key={h.id}>
                  <td data-label="Candidate">{h.name || h.role || 'Candidate'}</td>
                  <td data-label="Salary">{money(h.salary)}</td>
                  <td data-label="Fee %">{h.feePercentage}%</td>
                  <td data-label="Amount">{money(h.feeAmount)}</td>
                  <td data-label="Status">
                    {h.feePaidAt
                      ? <span className="pl-status pl-status--paid">Paid {day(h.feePaidAt)}</span>
                      : <span className="pl-status pl-status--due">Due {day(h.feeDueDate)}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><th scope="row" colSpan={3}>Total</th><td data-label="Total">{money(data.totals.fees)}</td><td aria-hidden="true" /></tr></tfoot>
          </table>
        </section>
      ) : <Locked title="Placement fees" />}
    </>
  )
}

function ReferredPanel({ data, isOwner }) {
  const rows = data.referred
  if (!rows.length) {
    return (
      <div className="pl-panel-empty">
        <p>None of your referrals have been hired yet. Refer strong candidates you couldn't place, and earn commission when another company hires them.</p>
        <Link to="/refer" className="pl-btn pl-btn--green press-scale">Refer a candidate →</Link>
      </div>
    )
  }
  return (
    <>
      <ul className="pl-rows">
        {rows.map(r => (
          <li key={r.candidateId} className="pl-row">
            <span className="pl-avatar pl-avatar--green" aria-hidden="true">{initials(r.role)}</span>
            <div className="pl-row-main">
              <p className="pl-row-title">{r.role || 'Candidate'}</p>
              <p className="pl-row-meta">
                <span>Referred {day(r.referredAt)}</span>
                <span>{ordinal(r.position)} referrer</span>
              </p>
              <div className="pl-hired-by">
                <span className="pl-hired-by-label">Hired by {r.hiringCompany || 'a Pickt company'}</span>
                <span>Started {day(r.startDate)}</span>
              </div>
            </div>
            <span className="pl-badge pl-badge--green">Placed</span>
          </li>
        ))}
      </ul>

      {data.canSeeCommission ? (
        <section className="pl-money" aria-label="Commission earned">
          <MoneyHeader title="Commission earned" visibleTo={data.visibleTo.commission} isOwner={isOwner} />
          <table className="pl-table">
            <thead><tr><th scope="col">Candidate</th><th scope="col">Salary</th><th scope="col">Rate</th><th scope="col">Commission</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.candidateId}>
                  <td data-label="Candidate">{r.role || 'Candidate'}</td>
                  <td data-label="Salary">{money(r.salary)}</td>
                  <td data-label="Rate">{r.rate == null ? '—' : `${r.rate}%`}</td>
                  <td data-label="Commission">{money(r.commission)}</td>
                  <td data-label="Status">
                    {r.commissionPaidAt
                      ? <span className="pl-status pl-status--paid">Paid {day(r.commissionPaidAt)}</span>
                      : <span className="pl-status pl-status--due">Pending</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><th scope="row" colSpan={3}>Total</th><td data-label="Total">{money(data.totals.commission)}</td><td aria-hidden="true" /></tr></tfoot>
          </table>
        </section>
      ) : <Locked title="Commission earned" />}
    </>
  )
}

const EMPTY = { hired: [], referred: [], canSeeFees: false, canSeeCommission: false, visibleTo: { fees: ['Owner'], commission: ['Owner'] }, totals: {} }

export default function Placements() {
  const { demo, isOwner, canExport } = useAccount()
  const [params] = useSearchParams()
  // Kept here, not only in the address: the app rebuilds the page on every address change
  const [chosen, setChosen] = useState(() => params.get('tab'))
  const [data, setData] = useState(demo ? EMPTY : null)
  const [error, setError] = useState(null)
  const [exportError, setExportError] = useState(null)

  useEffect(() => {
    if (demo) return undefined
    let cancelled = false
    accountApi('placements')
      .then(d => { if (!cancelled) setData(d) })
      .catch(err => { if (!cancelled) setError(err.message || "We couldn't load your placements.") })
    return () => { cancelled = true }
  }, [demo])

  const fullyEmpty = data && !data.hired.length && !data.referred.length
  const active = TABS.some(t => t.key === chosen) ? chosen : (data && !data.hired.length && data.referred.length ? 'referred' : 'hired')

  function select(key) {
    setChosen(key)
    // So a refresh or a shared link opens the same card, without rebuilding the page
    const url = new URL(window.location.href)
    url.searchParams.set('tab', key)
    window.history.replaceState(window.history.state, '', url)
  }

  function onKeyDown(e) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return
    e.preventDefault()
    const i = TABS.findIndex(t => t.key === active)
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : (i + 1) % TABS.length
    select(TABS[next].key)
    requestAnimationFrame(() => document.getElementById(`pl-tab-${TABS[next].key}`)?.focus())
  }

  async function exportCsv() {
    setExportError(null)
    try {
      const { csv, filename } = await accountApi('export')
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
      const a = document.createElement('a')
      a.href = url
      a.download = filename || 'pickt-placements.csv'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setExportError(err.message || 'The export failed. Please try again.')
    }
  }

  const cardLine = key => {
    if (key === 'hired') return data.canSeeFees ? `Placement fees: ${money(data.totals.fees)}` : 'Placement fees: Owner only'
    return data.canSeeCommission ? `Commission: ${money(data.totals.commission)}` : 'Commission: Owner only'
  }

  return (
    <div className="pl-page">
      <header className="pl-banner">
        <p className="pl-eyebrow">PLACEMENTS</p>
        <h1 className="pl-slogan">Pickt. Placed. <span className="pl-proven">Proven.</span></h1>
        <p className="pl-desc">Everyone you've hired through Pickt, and every referral of yours that another company hired.</p>
        <div className="pl-banner-actions">
          <Link to="/refer" className="pl-btn pl-btn--outline-white press-scale">Refer a candidate</Link>
          <Link to="/marketplace/discover" className="pl-btn pl-btn--white press-scale">Find your next hire →</Link>
        </div>
      </header>

      {demo && <p className="pl-note" role="note">Log in to see your company's placements.</p>}
      {error && <p className="ac2-error" role="alert">{error}</p>}
      {!data && !error && <p role="status">Loading…</p>}

      {data && fullyEmpty && (
        <div className="pl-cards pl-cards--empty">
          <section className="pl-card pl-card--navy pl-card--static" aria-labelledby="pl-empty-hired">
            <div className="pl-card-top"><h2 className="pl-card-title" id="pl-empty-hired">Hired through Pickt</h2></div>
            <p className="pl-card-count">0</p>
            <p className="pl-card-text">You haven't hired anyone through Pickt yet. Find candidates other companies have already interviewed.</p>
            <div className="pl-card-actions">
              <Link to="/marketplace/discover" className="pl-btn pl-btn--navy press-scale">Browse candidates →</Link>
              <Link to="/marketplace/upload" className="pl-btn pl-btn--navy-outline press-scale">Upload a job description</Link>
            </div>
          </section>
          <section className="pl-card pl-card--green pl-card--static" aria-labelledby="pl-empty-referred">
            <div className="pl-card-top"><h2 className="pl-card-title" id="pl-empty-referred">Referred placements</h2></div>
            <p className="pl-card-count">0</p>
            <p className="pl-card-text">None of your referrals have been hired yet. Refer candidates you couldn't place and earn commission when they're hired.</p>
            <div className="pl-card-actions">
              <Link to="/refer" className="pl-btn pl-btn--green press-scale">Refer a candidate →</Link>
            </div>
          </section>
        </div>
      )}

      {data && !fullyEmpty && (
        <>
          <div className="pl-toolbar">
            <p className="pl-hint"><span className="material-symbols-outlined" aria-hidden="true">touch_app</span>Select a card to see details</p>
            {canExport && <button type="button" className="pl-btn pl-btn--navy-outline press-scale" onClick={exportCsv}>Export CSV</button>}
          </div>
          {exportError && <p className="ac2-error" role="alert">{exportError}</p>}

          <div className="pl-cards" role="tablist" aria-label="Placements" onKeyDown={onKeyDown}>
            {TABS.map(t => {
              const selected = active === t.key
              const count = data[t.key].length
              return (
                <button
                  key={t.key}
                  id={`pl-tab-${t.key}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls="pl-panel"
                  tabIndex={selected ? 0 : -1}
                  className={`pl-card pl-card--${t.key === 'hired' ? 'navy' : 'green'} pl-card--tab ${selected ? 'pl-card--selected' : ''}`}
                  onClick={() => select(t.key)}
                >
                  <span className="pl-card-top">
                    <span className="pl-card-title">{t.label}</span>
                    <span className="pl-pill" aria-hidden="true">{selected ? '✓ Showing' : `${t.pill} →`}</span>
                  </span>
                  <span className="pl-card-count">
                    <span className="pl-count-badge">{count}</span>
                    <span className="pl-card-unit">{count === 1 ? 'placement' : 'placements'}</span>
                  </span>
                  <span className="pl-card-line">{cardLine(t.key)}</span>
                </button>
              )
            })}
          </div>

          <div id="pl-panel" role="tabpanel" aria-labelledby={`pl-tab-${active}`} className={`pl-panel pl-panel--${active === 'hired' ? 'navy' : 'green'}`}>
            {active === 'hired' ? <HiredPanel data={data} isOwner={isOwner} /> : <ReferredPanel data={data} isOwner={isOwner} />}
          </div>
        </>
      )}
    </div>
  )
}
