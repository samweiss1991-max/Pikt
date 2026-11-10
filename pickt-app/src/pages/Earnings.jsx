import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccount } from '../context/AccountContext'
import { accountApi } from '../lib/account'
import './Placements.css'
import './Earnings.css'

const LOCKED = "Earnings & savings are only visible to your company's Owner. Ask them if you need access."
const money = n => (n == null ? '—' : `$${Number(n).toLocaleString('en-AU', { maximumFractionDigits: 0 })}`)
const pct = n => `${Number(n).toLocaleString('en-AU', { maximumFractionDigits: 2 })}%`
// Same scale for every bar, leaving room after the longest one for its dollar label
const barWidth = ratio => `max(4px, calc(${(ratio * 100).toFixed(2)}% - ${(ratio * 5).toFixed(2)}rem))`
const day = iso => new Date(String(iso).length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })

function Banner({ visibleTo }) {
  return (
    <header className="pl-banner">
      <div className="er-banner-top">
        <p className="pl-eyebrow">EARNINGS &amp; SAVINGS</p>
        {visibleTo && <span className="er-visible">Visible to: {visibleTo.join(', ')}</span>}
      </div>
      <h1 className="pl-slogan">Hire smarter. <span className="pl-proven">Keep more.</span></h1>
      <p className="pl-desc">What your company has saved by hiring through Pickt instead of an agency, and what you've earned from referrals.</p>
    </header>
  )
}

/** Pickt fee vs agency fee for each hire, on one shared scale */
function FeeChart({ hires, benchmark }) {
  const [asTable, setAsTable] = useState(false)
  const [tip, setTip] = useState(null)
  const areaRef = useRef(null)
  const max = Math.max(1, ...hires.flatMap(h => [h.feeAmount, h.agencyFee]))

  function show(e, h, kind) {
    const area = areaRef.current?.getBoundingClientRect()
    const bar = e.currentTarget.getBoundingClientRect()
    if (!area) return
    setTip({
      x: Math.min(bar.right - area.left, area.width - 8),
      y: bar.top - area.top,
      value: money(kind === 'pickt' ? h.feeAmount : h.agencyFee),
      label: kind === 'pickt' ? `Pickt fee (${pct(h.feePercentage)})` : `Agency fee (${benchmark}%)`,
      role: h.role || 'Hire',
    })
  }
  const hide = () => setTip(null)

  return (
    <section className="er-section" aria-labelledby="er-chart-title">
      <div className="er-section-head">
        <h2 className="er-h2" id="er-chart-title">Pickt fee vs agency fee, per hire</h2>
        <button type="button" className="pl-btn pl-btn--navy-outline er-small-btn press-scale" aria-pressed={asTable} onClick={() => setAsTable(v => !v)}>
          {asTable ? 'View as chart' : 'View as table'}
        </button>
      </div>
      <ul className="er-legend" aria-label="Legend">
        <li><span className="er-swatch er-swatch--pickt" aria-hidden="true" />Pickt fee</li>
        <li><span className="er-swatch er-swatch--agency" aria-hidden="true" />Agency fee ({benchmark}%)</li>
        <li><span className="er-saved-key">Saved</span> = agency fee − Pickt fee</li>
      </ul>

      {asTable ? (
        <table className="pl-table er-table">
          <caption className="fc-sr-only">Pickt fee compared with a {benchmark}% agency fee, largest saving first</caption>
          <thead><tr><th scope="col">Role</th><th scope="col">Salary</th><th scope="col">Pickt fee</th><th scope="col">Agency fee ({benchmark}%)</th><th scope="col">Saved</th></tr></thead>
          <tbody>
            {hires.map(h => (
              <tr key={h.id}>
                <td data-label="Role">{h.role || 'Hire'}</td>
                <td data-label="Salary">{money(h.salary)}</td>
                <td data-label="Pickt fee">{money(h.feeAmount)} ({pct(h.feePercentage)})</td>
                <td data-label={`Agency fee (${benchmark}%)`}>{money(h.agencyFee)}</td>
                <td data-label="Saved">{money(h.saving)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="er-chart" ref={areaRef} onPointerLeave={hide}>
          {hires.map(h => (
            <div key={h.id} className="er-chart-row">
              <div className="er-chart-label">
                <span className="er-chart-role">{h.role || 'Hire'}</span>
                <span className="er-chart-sub">{money(h.salary)} · {pct(h.feePercentage)} fee</span>
              </div>
              <div className="er-bars">
                {[['pickt', h.feeAmount], ['agency', h.agencyFee]].map(([kind, value]) => (
                  <div key={kind} className="er-bar-line">
                    <span
                      className={`er-bar er-bar--${kind}`}
                      style={{ width: barWidth(value / max) }}
                      tabIndex={0}
                      role="img"
                      aria-label={`${h.role || 'Hire'}: ${kind === 'pickt' ? `Pickt fee ${money(value)}` : `agency fee ${money(value)}`}`}
                      onPointerEnter={e => show(e, h, kind)}
                      onFocus={e => show(e, h, kind)}
                      onBlur={hide}
                    />
                    <span className="er-bar-value" aria-hidden="true">{money(value)}</span>
                  </div>
                ))}
              </div>
              <div className="er-chart-saved">
                <span className="er-saved-amount">{money(h.saving)}</span>
                <span className="er-chart-sub">saved</span>
              </div>
            </div>
          ))}
          {tip && (
            <div className="er-tip" role="tooltip" style={{ left: tip.x, top: tip.y }}>
              <strong>{tip.value}</strong>
              <span>{tip.label}</span>
              <span className="er-tip-role">{tip.role}</span>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export default function Earnings() {
  const { demo, loading, canSeeEarnings, canExport } = useAccount()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [locked, setLocked] = useState(false)
  const [exportError, setExportError] = useState(null)

  useEffect(() => {
    if (demo || loading || !canSeeEarnings) return undefined
    let cancelled = false
    accountApi('earnings')
      .then(d => { if (!cancelled) setData(d) })
      .catch(err => {
        if (cancelled) return
        if (err.status === 403 || err.code === 'not_allowed' || err.message === LOCKED) setLocked(true)
        else setError(err.message || "We couldn't load your earnings and savings.")
      })
    return () => { cancelled = true }
  }, [demo, loading, canSeeEarnings])

  async function exportCsv() {
    setExportError(null)
    try {
      const { csv, filename } = await accountApi('export_earnings')
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
      const a = document.createElement('a')
      a.href = url
      a.download = filename || 'pickt-earnings-and-savings.csv'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setExportError(err.message || 'The export failed. Please try again.')
    }
  }

  if (!demo && loading) return <div className="pl-page"><p role="status">Loading…</p></div>

  if (!demo && (!canSeeEarnings || locked)) {
    return (
      <div className="pl-page">
        <h1 className="er-locked-title">Earnings &amp; savings</h1>
        <div className="pl-locked er-locked" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">lock</span>
          <p>{LOCKED}</p>
        </div>
      </div>
    )
  }

  const empty = demo || (data && !data.hires.length && !data.commissions.length)

  return (
    <div className="pl-page">
      <Banner visibleTo={data?.visibleTo} />
      {error && <p className="ac2-error" role="alert">{error}</p>}
      {!demo && !data && !error && <p role="status">Loading…</p>}

      {empty && (
        <section className="er-empty">
          {demo && <p className="pl-note">Log in to see your company's earnings and savings.</p>}
          <p>Your savings and earnings will appear here once you hire through Pickt or a candidate you referred is placed.</p>
          <div className="pl-card-actions">
            <Link to="/marketplace/discover" className="pl-btn pl-btn--navy press-scale">Browse candidates →</Link>
            <Link to="/refer" className="pl-btn pl-btn--navy-outline press-scale">Refer a candidate</Link>
          </div>
        </section>
      )}

      {data && !empty && (
        <>
          <p className="er-strip">
            <span>Savings are compared with a typical Australian agency fee of {data.benchmark}% of first-year salary.</span>
            <span className="er-strip-badge">Benchmark: {data.benchmark}%</span>
          </p>

          <div className="er-cards">
            <section className="er-card er-card--saved" aria-labelledby="er-saved">
              <h2 className="er-card-title" id="er-saved">Saved vs an agency</h2>
              <p className="er-card-value">{money(data.totals.savings)}</p>
              <p className="er-card-sub">across {data.totals.hires} {data.totals.hires === 1 ? 'hire' : 'hires'}, compared with a {data.benchmark}% agency fee</p>
            </section>
            <section className="er-card" aria-labelledby="er-commission">
              <h2 className="er-card-title" id="er-commission">Commission earned</h2>
              <p className="er-card-value">{money(data.totals.commissionTotal)}</p>
              <p className="er-card-sub">
                <span className="pl-status pl-status--paid">{money(data.totals.commissionPaid)} paid</span>
                {' · '}
                <span className="pl-status pl-status--due">{money(data.totals.commissionPending)} pending</span>
              </p>
            </section>
            <section className="er-card" aria-labelledby="er-value">
              <h2 className="er-card-title" id="er-value">Total value from Pickt</h2>
              <p className="er-card-value">{money(data.totals.value)}</p>
              <p className="er-card-sub">Savings plus commission earned</p>
            </section>
          </div>

          {data.hires.length > 0 && <FeeChart hires={data.hires} benchmark={data.benchmark} />}

          <div className="er-tables">
            <section className="er-section" aria-labelledby="er-fees">
              <h2 className="er-h2" id="er-fees">Placement fees paid</h2>
              {data.hires.length === 0 ? <p className="pl-note">No hires through Pickt yet.</p> : (
                <table className="pl-table">
                  <thead><tr><th scope="col">Role</th><th scope="col">Fee %</th><th scope="col">Amount</th><th scope="col">Status</th></tr></thead>
                  <tbody>
                    {data.hires.map(h => (
                      <tr key={h.id}>
                        <td data-label="Role">{h.role || 'Hire'}</td>
                        <td data-label="Fee %">{pct(h.feePercentage)}</td>
                        <td data-label="Amount">{money(h.feeAmount)}</td>
                        <td data-label="Status">
                          {h.feePaidAt
                            ? <span className="pl-status pl-status--paid">Paid {day(h.feePaidAt)}</span>
                            : <span className="pl-status pl-status--due">Due {day(h.feeDueDate)}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr><th scope="row" colSpan={2}>Total</th><td>{money(data.totals.fees)}</td><td aria-hidden="true" /></tr></tfoot>
                </table>
              )}
            </section>

            <section className="er-section" aria-labelledby="er-comm">
              <h2 className="er-h2" id="er-comm">Commission from referrals</h2>
              {data.commissions.length === 0 ? <p className="pl-note">No referral commission yet.</p> : (
                <table className="pl-table">
                  <thead><tr><th scope="col">Role</th><th scope="col">Rate</th><th scope="col">Amount</th><th scope="col">Status</th></tr></thead>
                  <tbody>
                    {data.commissions.map(c => (
                      <tr key={c.id}>
                        <td data-label="Role">{c.role || 'Candidate'}</td>
                        <td data-label="Rate">{pct(c.rate)}</td>
                        <td data-label="Amount">{money(c.amount)}</td>
                        <td data-label="Status">
                          {c.status === 'paid'
                            ? <span className="pl-status pl-status--paid">Paid{c.paidAt ? ` ${day(c.paidAt)}` : ''}</span>
                            : <span className="pl-status pl-status--due">Pending</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr><th scope="row" colSpan={2}>Total</th><td>{money(data.totals.commissionTotal)}</td><td aria-hidden="true" /></tr></tfoot>
                </table>
              )}
              <Link to="/placements?tab=referred" className="pl-link er-more">View referred placements →</Link>
            </section>
          </div>

          <footer className="er-footnote">
            <p>
              Savings are estimates: {data.benchmark}% of each hire's first-year salary (a typical Australian agency fee), minus the Pickt placement fee.
              Australian agency fees for permanent roles commonly range from 15% to 25% of first-year salary, and are often higher for senior roles.
            </p>
            {canExport && <button type="button" className="er-link-btn" onClick={exportCsv}>Export CSV</button>}
            {exportError && <p className="ac2-error" role="alert">{exportError}</p>}
          </footer>
        </>
      )}
    </div>
  )
}
