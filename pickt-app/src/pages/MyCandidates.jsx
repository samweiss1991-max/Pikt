import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCandidates } from '../lib/seedData'
import { CANDIDATES as MOCK_CANDIDATES } from '../data/discoveryOptions'
import { getIconForRole, getGradientClass } from '../lib/candidateUtils'
import EmptyState from '../components/shared/EmptyState'
import { useScrollReveal, useStaggerReveal } from '../hooks/useScrollReveal'
import './MyCandidates.css'

const STATUS_LABELS = {
  available: 'Active',
  unlocked: 'Unlocked',
  placed: 'Placed',
  withdrawn: 'Withdrawn',
}

const STATUS_FILTERS = ['all', 'available', 'unlocked', 'placed', 'withdrawn']

function mapCandidate(c) {
  return {
    id: c.id,
    role: c.role_applied_for || c.role,
    seniority: c.seniority_level || c.seniority,
    city: c.location_city || c.city,
    country: c.location_country || 'Australia',
    company: c.current_employer || c.company || 'Unknown',
    referringCompany: c.referring_company || c.referringCompany || c.company || 'Unknown',
    skills: c.skills || [],
    interviews: c.interviews_completed ?? c.interviews ?? 0,
    interview_stage_reached: c.interview_stage_reached || 'Technical screen',
    fee: c.fee_percentage ?? c.fee ?? 8,
    salaryLow: c.salary_expectation_min ?? c.salaryLow ?? 0,
    salaryHigh: c.salary_expectation_max ?? c.salaryHigh ?? 0,
    years: c.years_experience ?? c.years ?? 0,
    strengths: c.strengths,
    recommendation: c.recommendation,
    industry: c.industry,
    status: c.status || 'available',
    daysLive: c.referred_at
      ? Math.floor((Date.now() - new Date(c.referred_at).getTime()) / 86400000)
      : c.daysAgo ?? 5,
    unlockCount: c.status === 'unlocked' ? 1 : c.status === 'placed' ? 2 : 0,
  }
}

export default function MyCandidates() {
  const navigate = useNavigate()
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    setLoading(true)
    try {
      const stored = getCandidates()
      const mapped = (stored && stored.length > 0)
        ? stored.map(mapCandidate)
        : MOCK_CANDIDATES.map(mapCandidate)
      setCandidates(mapped)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return candidates
    return candidates.filter(c => c.status === statusFilter)
  }, [candidates, statusFilter])

  // Stats
  const stats = useMemo(() => {
    const active = candidates.filter(c => c.status === 'available').length
    const unlocked = candidates.filter(c => c.status === 'unlocked').length
    const placed = candidates.filter(c => c.status === 'placed').length
    const totalDays = candidates.reduce((sum, c) => sum + c.daysLive, 0)
    const avgDays = candidates.length > 0 ? Math.round(totalDays / candidates.length) : 0
    return { active, unlocked, placed, avgDays }
  }, [candidates])

  const headerRef = useScrollReveal()
  const statsRef = useStaggerReveal({ staggerMs: 80 })
  const tableRef = useStaggerReveal({ staggerMs: 60 })

  function handleWithdraw(id) {
    setCandidates(prev =>
      prev.map(c => c.id === id ? { ...c, status: 'withdrawn' } : c)
    )
    setExpandedId(null)
  }

  if (loading) {
    return (
      <div className="mc-page">
        <div className="mc-loading">Loading your candidates...</div>
      </div>
    )
  }

  if (candidates.length === 0) {
    return (
      <div className="mc-page">
        <div className="mc-header reveal-fade-up" ref={headerRef}>
          <div className="mc-header-left">
            <h1 className="mc-heading">My Candidates</h1>
            <p className="mc-subheading">Candidates you've referred to the marketplace</p>
          </div>
          <button className="mc-refer-btn press-scale" onClick={() => navigate('/refer')}>
            <span className="material-symbols-outlined">person_add</span>
            Refer a candidate
          </button>
        </div>
        <EmptyState
          icon="group"
          message="You haven't referred any candidates yet"
          ctaLabel="Refer your first candidate"
          onCta={() => navigate('/refer')}
        />
      </div>
    )
  }

  return (
    <div className="mc-page">
      {/* Header */}
      <div className="mc-header reveal-fade-up" ref={headerRef} data-parallax-speed="0.08">
        <div className="mc-header-left">
          <h1 className="mc-heading text-reveal">
            <span className="text-reveal-word" style={{ animationDelay: '100ms' }}>My{'\u00A0'}</span>
            <span className="text-reveal-word" style={{ animationDelay: '220ms' }}>Candidates</span>
          </h1>
          <p className="mc-subheading text-reveal-word" style={{ animationDelay: '350ms' }}>
            Candidates you've referred to the marketplace
          </p>
        </div>
        <button className="mc-refer-btn press-scale" onClick={() => navigate('/refer')}>
          <span className="material-symbols-outlined">person_add</span>
          Refer a candidate
        </button>
      </div>

      {/* Stats */}
      <div className="mc-stats" ref={statsRef}>
        <div className="mc-stat mc-stat--green hover-lift" data-reveal>
          <span className="material-symbols-outlined mc-stat-icon">campaign</span>
          <div className="mc-stat-label">Active listings</div>
          <div className="mc-stat-value">{stats.active}</div>
        </div>
        <div className="mc-stat mc-stat--gold hover-lift" data-reveal>
          <span className="material-symbols-outlined mc-stat-icon">lock_open</span>
          <div className="mc-stat-label">Unlocked</div>
          <div className="mc-stat-value">{stats.unlocked}</div>
        </div>
        <div className="mc-stat mc-stat--accent hover-lift" data-reveal>
          <span className="material-symbols-outlined mc-stat-icon">check_circle</span>
          <div className="mc-stat-label">Placed</div>
          <div className="mc-stat-value">{stats.placed}</div>
        </div>
        <div className="mc-stat mc-stat--stone hover-lift" data-reveal>
          <span className="material-symbols-outlined mc-stat-icon">schedule</span>
          <div className="mc-stat-label">Avg. days live</div>
          <div className="mc-stat-value">{stats.avgDays}</div>
        </div>
      </div>

      {/* Status filter */}
      <div className="mc-filters">
        {STATUS_FILTERS.map(f => (
          <button
            key={f}
            className={`mc-filter-chip ${statusFilter === f ? 'mc-filter-chip--active' : ''}`}
            onClick={() => setStatusFilter(f)}
          >
            {f === 'all' ? 'All' : STATUS_LABELS[f]}
            <span className="mc-filter-count">
              {f === 'all' ? candidates.length : candidates.filter(c => c.status === f).length}
            </span>
          </button>
        ))}
      </div>

      {/* Candidate table */}
      <div className="mc-table" ref={tableRef}>
        {/* Table header */}
        <div className="mc-row mc-row--header">
          <div className="mc-col mc-col--role">Role</div>
          <div className="mc-col mc-col--location">Location</div>
          <div className="mc-col mc-col--status">Status</div>
          <div className="mc-col mc-col--unlocks">Unlocks</div>
          <div className="mc-col mc-col--days">Days live</div>
          <div className="mc-col mc-col--fee">Fee</div>
          <div className="mc-col mc-col--actions">Actions</div>
        </div>

        {filtered.length === 0 && (
          <div className="mc-empty-filter">
            No candidates with status "{STATUS_LABELS[statusFilter] || statusFilter}"
          </div>
        )}

        {filtered.map((c, i) => {
          const isExpanded = expandedId === c.id
          return (
            <div key={c.id} data-reveal>
              {/* Row */}
              <div
                className={`mc-row mc-row--data ${isExpanded ? 'mc-row--expanded' : ''}`}
                onClick={() => setExpandedId(isExpanded ? null : c.id)}
              >
                <div className="mc-col mc-col--role">
                  <div className={`mc-row-icon bg-gradient-to-br ${getGradientClass(i)}`}>
                    <span className="material-symbols-outlined">{getIconForRole(c.role)}</span>
                  </div>
                  <div>
                    <div className="mc-role-title">{c.role}</div>
                    <div className="mc-role-meta">{c.seniority} · {c.years} yrs</div>
                  </div>
                </div>
                <div className="mc-col mc-col--location">{c.city}, {c.country}</div>
                <div className="mc-col mc-col--status">
                  <span className={`mc-status-pill mc-status-pill--${c.status}`}>
                    {STATUS_LABELS[c.status] || c.status}
                  </span>
                </div>
                <div className="mc-col mc-col--unlocks">{c.unlockCount}</div>
                <div className="mc-col mc-col--days">{c.daysLive}d</div>
                <div className="mc-col mc-col--fee">{c.fee}%</div>
                <div className="mc-col mc-col--actions">
                  <button
                    className="mc-action-btn press-scale"
                    onClick={e => { e.stopPropagation(); navigate(`/candidates/${c.id}`, { state: { candidate: c } }) }}
                    title="View profile"
                  >
                    <span className="material-symbols-outlined">visibility</span>
                  </button>
                  <span className="material-symbols-outlined mc-expand-icon" style={{ transform: isExpanded ? 'rotate(180deg)' : undefined }}>
                    expand_more
                  </span>
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="mc-detail">
                  <div className="mc-detail-grid">
                    <div className="mc-detail-section">
                      <div className="mc-detail-label">Skills</div>
                      <div className="mc-detail-skills">
                        {c.skills.map(s => (
                          <span key={s} className="mc-skill-pill">{s}</span>
                        ))}
                      </div>
                    </div>
                    <div className="mc-detail-section">
                      <div className="mc-detail-label">Interview stage</div>
                      <div className="mc-detail-value">{c.interview_stage_reached} ({c.interviews} rounds)</div>
                    </div>
                    <div className="mc-detail-section">
                      <div className="mc-detail-label">Recommendation</div>
                      <div className="mc-detail-value">{c.recommendation || 'N/A'}</div>
                    </div>
                    <div className="mc-detail-section">
                      <div className="mc-detail-label">Salary range</div>
                      <div className="mc-detail-value">
                        {c.salaryLow && c.salaryHigh
                          ? `$${Math.round(c.salaryLow / 1000)}k – $${Math.round(c.salaryHigh / 1000)}k`
                          : 'Not specified'}
                      </div>
                    </div>
                    {c.strengths && (
                      <div className="mc-detail-section mc-detail-section--wide">
                        <div className="mc-detail-label">Key strengths</div>
                        <div className="mc-detail-text">{c.strengths}</div>
                      </div>
                    )}
                  </div>
                  <div className="mc-detail-actions">
                    <button className="mc-detail-btn mc-detail-btn--primary press-scale" onClick={() => navigate(`/candidates/${c.id}`, { state: { candidate: c } })}>
                      View full profile
                    </button>
                    {c.status !== 'withdrawn' && c.status !== 'placed' && (
                      <button className="mc-detail-btn mc-detail-btn--danger press-scale" onClick={() => handleWithdraw(c.id)}>
                        Withdraw from marketplace
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
