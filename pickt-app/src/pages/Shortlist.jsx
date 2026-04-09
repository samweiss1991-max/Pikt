import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCandidates } from '../lib/seedData'
import { CANDIDATES as MOCK, WORK_HISTORY } from '../data/discoveryOptions'
import { getAvatarGradient } from '../lib/avatarGradients'
import { useStaggerReveal } from '../hooks/useScrollReveal'
import './Shortlist.css'

function mapC(c) {
  if (c.role && c.salaryLow !== undefined) return c
  return {
    id: c.id, role: c.role_applied_for, seniority: c.seniority_level,
    city: c.location_city, company: c.current_employer || c.referring_company || 'Unknown',
    referringCompany: c.referring_company || 'Unknown',
    skills: c.skills || [], interviews: c.interviews_completed || 0,
    fee: c.fee_percentage || 8, salaryLow: c.salary_expectation_min || 0,
    salaryHigh: c.salary_expectation_max || 0, years: c.years_experience || 0,
    recommendation: c.recommendation,
  }
}

/* Assign a mock stage for Kanban based on interviews */
function getStage(c) {
  if (c.interviews >= 4) return 'Offer'
  if (c.interviews >= 2) return 'Interview'
  if (c.interviews >= 1) return 'Screening'
  return 'New'
}

/* Assign a mock tier based on interviews + years */
function getTier(c) {
  const score = (c.interviews || 0) * 2 + (c.years || 0)
  if (score >= 14) return 'A'
  if (score >= 8) return 'B'
  return 'C'
}

const STAGES = ['New', 'Screening', 'Interview', 'Offer']
const TIERS = ['A', 'B', 'C']
const VIEWS = ['kanban', 'compare', 'tier']

function WorkHistoryCompact({ history }) {
  return (
    <div className="sl-work-history">
      {history.slice(0, 3).map((w, i) => (
        <div key={i} className="sl-wh-item">
          {i > 0 && <div className="sl-wh-divider" />}
          <div className="sl-wh-top">
            <div className="sl-wh-dot" />
            <span className="sl-wh-company">{w.company}</span>
            <span className="sl-wh-tenure">{w.tenure}</span>
          </div>
          <div className="sl-wh-dates">{w.dates}</div>
        </div>
      ))}
    </div>
  )
}

function CandidateCardInline({ c, i, isLocked, navigate }) {
  return (
    <div
      className="sl-card pikt-card hover-lift"
      onClick={() => navigate(`/candidates/${c.id}`, { state: { candidate: c } })}
    >
      <div className="sl-card-top">
        <div
          className="sl-card-avatar"
          style={{
            background: isLocked ? 'var(--surface-container-high)' : getAvatarGradient(i),
          }}
        >
          {isLocked
            ? <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--on-surface-variant)' }}>lock</span>
            : <span style={{ color: 'white', fontWeight: 900 }}>{c.role[0]}</span>
          }
        </div>
        <div className="sl-card-info">
          <div className="sl-card-role">{c.role}</div>
          <div className="sl-card-meta">{c.seniority} &bull; {c.city} &bull; {c.years} yrs</div>
        </div>
      </div>

      <div className="sl-card-skills">
        {(c.skills || []).slice(0, 4).map(s => (
          <span key={s} className="sl-skill">{s}</span>
        ))}
      </div>

      <WorkHistoryCompact history={WORK_HISTORY} />

      <div className="sl-card-actions">
        {isLocked ? (
          <button className="sl-btn sl-btn--unlock" onClick={e => { e.stopPropagation() }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>lock_open</span>
            Unlock
          </button>
        ) : (
          <>
            <button className="sl-btn sl-btn--keep" onClick={e => { e.stopPropagation() }}>Keep</button>
            <button className="sl-btn sl-btn--remove" onClick={e => { e.stopPropagation() }}>Remove</button>
          </>
        )}
      </div>
    </div>
  )
}

export default function Shortlist() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('all')
  const [view, setView] = useState('kanban')
  const [search, setSearch] = useState('')
  const [savedIds] = useState(() => { try { return JSON.parse(localStorage.getItem('pickt_shortlist') || '[]') } catch { return [] } })
  const [candidates, setCandidates] = useState([])

  useEffect(() => {
    const all = getCandidates()
    const pool = (all?.length > 0) ? all.map(mapC) : MOCK
    setCandidates(pool.filter(c => savedIds.includes(c.id)))
  }, [savedIds])

  const cardsRevealRef = useStaggerReveal({ staggerMs: 80 })

  const filtered = candidates.filter(c => {
    if (tab === 'unlocked') return c.interviews >= 1
    if (tab === 'locked') return c.interviews === 0
    return true
  }).filter(c => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return c.role.toLowerCase().includes(q) || c.city?.toLowerCase().includes(q)
  })

  if (candidates.length === 0) return (
    <div className="sl-empty">
      <div className="sl-empty-icon">
        <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--primary)' }}>favorite</span>
      </div>
      <h2 className="sl-empty-title">Your shortlist is empty</h2>
      <p className="sl-empty-sub">Save candidates from the marketplace to review them here.</p>
      <button className="sl-empty-btn" onClick={() => navigate('/marketplace/results', { state: {} })}>Browse marketplace</button>
    </div>
  )

  return (
    <div className="sl-page">
      <div className="sl-header" data-parallax-speed="0.08">
        <h1 className="sl-heading">Shortlist</h1>
        <p className="sl-subheading">{candidates.length} candidate{candidates.length !== 1 ? 's' : ''} saved</p>
      </div>

      {/* Tab strip */}
      <div className="sl-tabs">
        {['all', 'unlocked', 'locked'].map(t => (
          <button
            key={t}
            className={`sl-tab ${tab === t ? 'sl-tab--active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* View toggle */}
      <div className="sl-view-toggle">
        {VIEWS.map(v => (
          <button
            key={v}
            className={`sl-view-btn ${view === v ? 'sl-view-btn--active' : ''}`}
            onClick={() => setView(v)}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              {v === 'kanban' ? 'view_kanban' : v === 'compare' ? 'compare_arrows' : 'leaderboard'}
            </span>
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div className="sl-search-wrap">
        <span className="material-symbols-outlined sl-search-icon">search</span>
        <input
          type="text"
          className="sl-search"
          placeholder="Search candidates..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* ═══ KANBAN VIEW ═══ */}
      {view === 'kanban' && (
        <div className="sl-kanban" ref={cardsRevealRef}>
          {STAGES.map(stage => {
            const stageCandidates = filtered.filter(c => getStage(c) === stage)
            return (
              <div key={stage} className="sl-kanban-col">
                <div className="sl-kanban-col-header">
                  <span className="sl-kanban-col-title">{stage}</span>
                  <span className="sl-kanban-col-count">{stageCandidates.length}</span>
                </div>
                <div className="sl-kanban-col-body">
                  {stageCandidates.map((c, i) => (
                    <div key={c.id} data-reveal>
                      <CandidateCardInline c={c} i={i} isLocked={c.interviews === 0} navigate={navigate} />
                    </div>
                  ))}
                  {stageCandidates.length === 0 && (
                    <div className="sl-kanban-empty">No candidates</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ═══ COMPARE VIEW ═══ */}
      {view === 'compare' && (
        <div className="sl-compare" ref={cardsRevealRef}>
          <div className="sl-compare-grid">
            {filtered.map((c, i) => {
              const isLocked = c.interviews === 0
              return (
                <div key={c.id} className="sl-compare-col pikt-card" data-reveal>
                  <div className="sl-compare-header">
                    <div
                      className="sl-card-avatar"
                      style={{ background: isLocked ? 'var(--surface-container-high)' : getAvatarGradient(i) }}
                    >
                      {isLocked
                        ? <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--on-surface-variant)' }}>lock</span>
                        : <span style={{ color: 'white', fontWeight: 900 }}>{c.role[0]}</span>
                      }
                    </div>
                    <div className="sl-compare-title">{c.role}</div>
                    <div className="sl-compare-subtitle">{c.seniority} &bull; {c.city}</div>
                  </div>

                  <div className="sl-compare-stats">
                    <div className="sl-compare-stat">
                      <span className="sl-compare-stat-label">Experience</span>
                      <span className="sl-compare-stat-value">{c.years} yrs</span>
                    </div>
                    <div className="sl-compare-stat">
                      <span className="sl-compare-stat-label">Interviews</span>
                      <span className="sl-compare-stat-value">{c.interviews}</span>
                    </div>
                    <div className="sl-compare-stat">
                      <span className="sl-compare-stat-label">Fee</span>
                      <span className="sl-compare-stat-value">{c.fee}%</span>
                    </div>
                    <div className="sl-compare-stat">
                      <span className="sl-compare-stat-label">Salary</span>
                      <span className="sl-compare-stat-value">${Math.round((c.salaryLow || 0) / 1000)}k–${Math.round((c.salaryHigh || 0) / 1000)}k</span>
                    </div>
                  </div>

                  <div className="sl-compare-section-title">Skills</div>
                  <div className="sl-card-skills">
                    {(c.skills || []).slice(0, 6).map(s => (
                      <span key={s} className="sl-skill">{s}</span>
                    ))}
                  </div>

                  <div className="sl-compare-section-title">Work history</div>
                  <WorkHistoryCompact history={WORK_HISTORY} />

                  <div className="sl-card-actions" style={{ marginTop: 'auto', paddingTop: '1rem' }}>
                    <button
                      className="sl-btn sl-btn--keep"
                      onClick={() => navigate(`/candidates/${c.id}`, { state: { candidate: c } })}
                    >View Dossier</button>
                  </div>
                </div>
              )
            })}
          </div>
          {filtered.length === 0 && (
            <div className="sl-kanban-empty" style={{ textAlign: 'center', padding: '3rem' }}>No candidates match your filters</div>
          )}
        </div>
      )}

      {/* ═══ TIER RANKING VIEW ═══ */}
      {view === 'tier' && (
        <div className="sl-tier" ref={cardsRevealRef}>
          {TIERS.map(tier => {
            const tierCandidates = filtered.filter(c => getTier(c) === tier)
            return (
              <div key={tier} className="sl-tier-group">
                <div className="sl-tier-header">
                  <span className={`sl-tier-badge sl-tier-badge--${tier.toLowerCase()}`}>Tier {tier}</span>
                  <span className="sl-tier-count">{tierCandidates.length} candidate{tierCandidates.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="sl-card-grid">
                  {tierCandidates.map((c, i) => (
                    <div key={c.id} data-reveal>
                      <CandidateCardInline c={c} i={i} isLocked={c.interviews === 0} navigate={navigate} />
                    </div>
                  ))}
                </div>
                {tierCandidates.length === 0 && (
                  <div className="sl-kanban-empty">No candidates in this tier</div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
