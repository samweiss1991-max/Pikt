import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCandidates } from '../lib/seedData'
import { CANDIDATES as MOCK, WORK_HISTORY } from '../data/discoveryOptions'
import { COPY } from '../lib/copy'
import { getAvatarGradient } from '../lib/avatarGradients'
import { isUnlocked as checkUnlocked } from '../lib/sanitizeCandidate'
import { getShortlist, removeFromShortlist, getStageOverrides, setStageOverride } from '../lib/shortlist'
import EmptyState from '../components/shared/EmptyState'
import { useScrollReveal, useStaggerReveal } from '../hooks/useScrollReveal'
import './Shortlist.css'

function mapC(c) {
  if (c.role && c.salaryLow !== undefined) return c
  return {
    id: c.id, role: c.role_applied_for || c.role,
    seniority: c.seniority_level || c.seniority,
    city: c.location_city || c.city,
    company: c.current_employer || c.referring_company || c.company || 'Unknown',
    referringCompany: c.referring_company || c.referringCompany || c.company || 'Unknown',
    skills: c.skills || [], interviews: c.interviews_completed ?? c.interviews ?? 0,
    fee: c.fee_percentage ?? c.fee ?? 8,
    salaryLow: c.salary_expectation_min ?? c.salaryLow ?? 0,
    salaryHigh: c.salary_expectation_max ?? c.salaryHigh ?? 0,
    years: c.years_experience ?? c.years ?? 0,
    recommendation: c.recommendation,
    status: c.status || 'available',
  }
}

function getDefaultStage(c) {
  if (c.interviews >= 4) return 'Offer'
  if (c.interviews >= 2) return 'Interview'
  if (c.interviews >= 1) return 'Screening'
  return 'New'
}

function getTier(c) {
  const score = (c.interviews || 0) * 2 + (c.years || 0)
  if (score >= 14) return 'A'
  if (score >= 8) return 'B'
  return 'C'
}

const STAGES = ['New', 'Screening', 'Interview', 'Offer']
const TIERS = ['A', 'B', 'C']
const VIEWS = [
  { key: 'kanban', icon: 'view_kanban', label: 'Kanban' },
  { key: 'compare', icon: 'compare_arrows', label: 'Compare' },
  { key: 'tier', icon: 'leaderboard', label: 'Tier' },
]

function WorkHistoryCompact() {
  return (
    <div className="sl-work-history">
      {WORK_HISTORY.slice(0, 3).map((w, i) => (
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

function CandidateCardInline({ c, i, navigate, onRemove, draggable, onDragStart }) {
  const unlocked = checkUnlocked(c.id) || c.status === 'unlocked'
  const isLocked = !unlocked && c.interviews === 0

  return (
    <div
      className="sl-card pikt-card hover-lift"
      onClick={() => navigate(`/candidates/${c.id}`, { state: { candidate: c } })}
      draggable={draggable}
      onDragStart={onDragStart}
    >
      <div className="sl-card-top">
        <div className="sl-card-avatar" style={{ background: isLocked ? 'var(--surface-container-high)' : getAvatarGradient(i) }}>
          {isLocked
            ? <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--on-surface-variant)' }}>lock</span>
            : <span style={{ color: 'white', fontWeight: 900 }}>{(c.role || 'X')[0]}</span>}
        </div>
        <div className="sl-card-info">
          <div className="sl-card-role">{c.role}</div>
          <div className="sl-card-meta">{c.seniority} {'\u00B7'} {c.city} {'\u00B7'} {c.years} yrs</div>
        </div>
      </div>
      <div className="sl-card-skills">
        {(c.skills || []).slice(0, 4).map(s => <span key={s} className="sl-skill">{s}</span>)}
      </div>
      <WorkHistoryCompact />
      <div className="sl-card-actions">
        {isLocked ? (
          <button className="sl-btn sl-btn--unlock press-scale" onClick={e => e.stopPropagation()}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>lock_open</span> Unlock
          </button>
        ) : (
          <>
            <button className="sl-btn sl-btn--keep press-scale" onClick={e => { e.stopPropagation(); navigate(`/candidates/${c.id}`, { state: { candidate: c } }) }}>View</button>
            <button className="sl-btn sl-btn--remove press-scale" onClick={e => { e.stopPropagation(); onRemove?.(c.id) }}>Remove</button>
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
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [dragTarget, setDragTarget] = useState(null)

  const stageOverrides = getStageOverrides()

  function getStage(c) {
    return stageOverrides[c.id] || getDefaultStage(c)
  }

  useEffect(() => {
    const shortlistIds = getShortlist()
    const all = getCandidates()
    const pool = (all?.length > 0) ? all.map(mapC) : MOCK.map(mapC)
    setCandidates(pool.filter(c => shortlistIds.includes(c.id)))
    setLoading(false)
  }, [])

  function handleRemove(id) {
    removeFromShortlist(id)
    setCandidates(prev => prev.filter(c => c.id !== id))
  }

  // Native drag-and-drop for kanban
  function handleDragStart(e, candidateId) {
    e.dataTransfer.setData('text/plain', candidateId)
  }
  function handleDragOver(e, stage) {
    e.preventDefault()
    setDragTarget(stage)
  }
  function handleDrop(e, stage) {
    e.preventDefault()
    const candidateId = e.dataTransfer.getData('text/plain')
    if (candidateId) {
      setStageOverride(candidateId, stage)
      setCandidates([...candidates]) // force re-render
    }
    setDragTarget(null)
  }
  function handleDragLeave() { setDragTarget(null) }

  const cardsRef = useStaggerReveal({ staggerMs: 80 })

  const filtered = candidates.filter(c => {
    if (tab === 'unlocked') return checkUnlocked(c.id) || c.status === 'unlocked'
    if (tab === 'locked') return !checkUnlocked(c.id) && c.status !== 'unlocked'
    return true
  }).filter(c => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return c.role.toLowerCase().includes(q) || (c.city || '').toLowerCase().includes(q) || (c.skills || []).some(s => s.toLowerCase().includes(q))
  })

  if (!loading && candidates.length === 0) {
    return (
      <div className="sl-page">
        <h1 className="sl-heading">{COPY.nav.picktList}</h1>
        <EmptyState icon="favorite" message={COPY.emptyStates.picktList} ctaLabel={COPY.emptyStates.picktListCta} onCta={() => navigate('/marketplace/results')} />
      </div>
    )
  }

  return (
    <div className="sl-page">
      <div className="sl-header" data-parallax-speed="0.08">
        <h1 className="sl-heading">{COPY.nav.picktList}</h1>
        <p className="sl-subheading">{filtered.length} candidate{filtered.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="sl-tabs">
        {['all', 'unlocked', 'locked'].map(t => (
          <button key={t} className={`sl-tab ${tab === t ? 'sl-tab--active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="sl-view-toggle">
        {VIEWS.map(v => (
          <button key={v.key} className={`sl-view-btn ${view === v.key ? 'sl-view-btn--active' : ''}`} onClick={() => setView(v.key)}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{v.icon}</span>
            {v.label}
          </button>
        ))}
      </div>

      <div className="sl-search-wrap">
        <span className="material-symbols-outlined sl-search-icon">search</span>
        <input type="text" className="sl-search" placeholder="Search candidates..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 && (
        <EmptyState icon="search_off" message="No candidates match your filters" ctaLabel="Clear filters" onCta={() => { setTab('all'); setSearch('') }} />
      )}

      {/* KANBAN with drag-and-drop */}
      {view === 'kanban' && filtered.length > 0 && (
        <div className="sl-kanban" ref={cardsRef}>
          {STAGES.map(stage => {
            const sc = filtered.filter(c => getStage(c) === stage)
            return (
              <div
                key={stage}
                className={`sl-kanban-col ${dragTarget === stage ? 'sl-kanban-col--drag-over' : ''}`}
                onDragOver={e => handleDragOver(e, stage)}
                onDrop={e => handleDrop(e, stage)}
                onDragLeave={handleDragLeave}
              >
                <div className="sl-kanban-col-header">
                  <span className="sl-kanban-col-title">{stage}</span>
                  <span className="sl-kanban-col-count">{sc.length}</span>
                </div>
                <div className="sl-kanban-col-body">
                  {sc.map((c, i) => (
                    <div key={c.id} data-reveal>
                      <CandidateCardInline c={c} i={i} navigate={navigate} onRemove={handleRemove} draggable onDragStart={e => handleDragStart(e, c.id)} />
                    </div>
                  ))}
                  {sc.length === 0 && <div className="sl-kanban-empty">No candidates</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* COMPARE */}
      {view === 'compare' && filtered.length > 0 && (
        <div className="sl-compare-grid" ref={cardsRef}>
          {filtered.slice(0, 6).map((c, i) => {
            const isLocked = !checkUnlocked(c.id) && c.status !== 'unlocked' && c.interviews === 0
            return (
              <div key={c.id} className="sl-compare-col pikt-card hover-lift" data-reveal>
                <div className="sl-compare-header">
                  <div className="sl-card-avatar" style={{ background: isLocked ? 'var(--surface-container-high)' : getAvatarGradient(i), margin: '0 auto 0.75rem' }}>
                    {isLocked ? <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--on-surface-variant)' }}>lock</span> : <span style={{ color: 'white', fontWeight: 900 }}>{(c.role || 'X')[0]}</span>}
                  </div>
                  <div className="sl-compare-title">{c.role}</div>
                  <div className="sl-compare-subtitle">{c.seniority} {'\u00B7'} {c.city}</div>
                </div>
                <div className="sl-compare-stats">
                  <div className="sl-compare-stat"><span className="sl-compare-stat-label">Experience</span><span className="sl-compare-stat-value">{c.years} yrs</span></div>
                  <div className="sl-compare-stat"><span className="sl-compare-stat-label">Interviews</span><span className="sl-compare-stat-value">{c.interviews}</span></div>
                  <div className="sl-compare-stat"><span className="sl-compare-stat-label">Fee</span><span className="sl-compare-stat-value">{c.fee}%</span></div>
                  <div className="sl-compare-stat"><span className="sl-compare-stat-label">Salary</span><span className="sl-compare-stat-value">${Math.round((c.salaryLow || 0) / 1000)}k{'\u2013'}${Math.round((c.salaryHigh || 0) / 1000)}k</span></div>
                </div>
                <div className="sl-compare-section-title">Skills</div>
                <div className="sl-card-skills">{(c.skills || []).slice(0, 6).map(s => <span key={s} className="sl-skill">{s}</span>)}</div>
                <div className="sl-card-actions" style={{ marginTop: 'auto', paddingTop: '1rem' }}>
                  <button className="sl-btn sl-btn--keep press-scale" onClick={() => navigate(`/candidates/${c.id}`, { state: { candidate: c } })}>View Profile</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* TIER */}
      {view === 'tier' && filtered.length > 0 && (
        <div className="sl-tier" ref={cardsRef}>
          {TIERS.map(tier => {
            const tc = filtered.filter(c => getTier(c) === tier)
            return (
              <div key={tier} className="sl-tier-group">
                <div className="sl-tier-header">
                  <span className={`sl-tier-badge sl-tier-badge--${tier.toLowerCase()}`}>Tier {tier}</span>
                  <span className="sl-tier-count">{tc.length} candidate{tc.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="sl-card-grid">
                  {tc.map((c, i) => <div key={c.id} data-reveal><CandidateCardInline c={c} i={i} navigate={navigate} onRemove={handleRemove} /></div>)}
                </div>
                {tc.length === 0 && <div className="sl-kanban-empty">No candidates in this tier</div>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
