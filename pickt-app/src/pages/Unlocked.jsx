import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAccount } from '../context/AccountContext'
import { setCandidateStage, unlockedCandidates } from '../lib/dashboard'
import './Dashboard.css'
import './Unlocked.css'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'this_month', label: 'This month' },
  { key: 'not_contacted', label: 'Not contacted' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'interviewing', label: 'Interviewing' },
  { key: 'hired', label: 'Hired' },
]
const STAGE_LABEL = { not_contacted: 'Not contacted', contacted: 'Contacted', interviewing: 'Interviewing', hired: 'Hired', hired_elsewhere: 'Hired elsewhere' }
const day = iso => new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })

/** The company's unlocked candidates, with contact tracking. Linked from the Dashboard. */
export default function Unlocked() {
  const { demo } = useAccount()
  const [params] = useSearchParams()
  // Kept here as well as in the address: the app rebuilds the page on address changes
  const [stage, setStage] = useState(() => (FILTERS.some(f => f.key === params.get('stage')) ? params.get('stage') : 'all'))
  const roleId = params.get('role') || undefined
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(null)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    if (demo) return undefined
    let cancelled = false
    unlockedCandidates({ roleId, stage: 'all' })
      .then(d => { if (!cancelled) setData(d) })
      .catch(err => { if (!cancelled) setError(err.message || "We couldn't load your unlocked candidates.") })
    return () => { cancelled = true }
  }, [demo, roleId])

  function choose(key) {
    setStage(key)
    const url = new URL(window.location.href)
    url.searchParams.set('stage', key)
    window.history.replaceState(window.history.state, '', url)
  }

  async function mark(c, next) {
    setSaving(c.candidateId)
    setMessage(null)
    try {
      await setCandidateStage(c.candidateId, next)
      const label = next === 'unlocked' ? 'not contacted' : next
      setData(d => ({ ...d, candidates: d.candidates.map(x => (x.candidateId === c.candidateId ? { ...x, stage: next === 'unlocked' ? 'not_contacted' : next } : x)) }))
      setMessage({ ok: true, text: `${c.role} marked as ${label}.` })
    } catch (err) {
      setMessage({ ok: false, text: err.message })
    } finally {
      setSaving(null)
    }
  }

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
  const rows = (data?.candidates || []).filter(c => stage === 'all' || c.stage === stage || (stage === 'this_month' && new Date(c.unlockedAt).getTime() >= monthStart))

  return (
    <div className="db2-page">
      <h1 className="db2-title">Unlocked candidates</h1>
      <p className="db2-muted">
        {data?.roleName ? <>Matching your role <strong>{data.roleName}</strong> · <Link to="/unlocked" className="db2-link">Show all</Link></> : 'Everyone your company has unlocked.'}
      </p>
      {demo && <p className="db2-note">Log in to see your company's unlocked candidates.</p>}
      {error && <div className="db2-error" role="alert"><p>{error}</p></div>}

      {!demo && (
        <div className="ul-filters" role="group" aria-label="Show">
          {FILTERS.map(f => (
            <button key={f.key} type="button" className={`ul-filter ${stage === f.key ? 'ul-filter--on' : ''}`} aria-pressed={stage === f.key} onClick={() => choose(f.key)}>{f.label}</button>
          ))}
        </div>
      )}
      <div role="status" aria-live="polite" className="ul-status">{message && <p className={message.ok ? 'ac2-ok' : 'ac2-error'}>{message.text}</p>}</div>
      {!demo && !data && !error && <div className="db2-card"><div className="db2-loading" role="status" aria-label="Loading"><span className="db2-skel" /><span className="db2-skel" /></div></div>}

      {data && (
        <section className="db2-card">
          {rows.length === 0 ? (
            <div className="db2-empty">
              <p>No candidates here yet.</p>
              <Link to="/marketplace/discover" className="db2-btn db2-btn--navy press-scale">Browse candidates →</Link>
            </div>
          ) : (
            <ul className="ul-list">
              {rows.map(c => (
                <li key={c.candidateId} className="ul-row">
                  <div className="ul-main">
                    <Link to={`/candidates/${c.candidateId}`} className="ul-role">{c.role}</Link>
                    <p className="db2-muted">Unlocked {day(c.unlockedAt)}</p>
                  </div>
                  <span className={`ul-stage ul-stage--${c.stage}`}>{STAGE_LABEL[c.stage]}</span>
                  {!c.stage.startsWith('hired') && (
                    <div className="ul-actions">
                      {c.stage === 'not_contacted' && <button type="button" className="db2-btn db2-btn--outline db2-btn--small press-scale" disabled={saving === c.candidateId} onClick={() => mark(c, 'contacted')}>Mark as contacted</button>}
                      {c.stage !== 'interviewing' && <button type="button" className="db2-btn db2-btn--outline db2-btn--small press-scale" disabled={saving === c.candidateId} onClick={() => mark(c, 'interviewing')}>Interviewing</button>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
