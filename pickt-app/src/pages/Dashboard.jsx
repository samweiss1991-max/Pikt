import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCandidates, seedCandidates } from '../lib/seedData'
import { CANDIDATES as MOCK_CANDIDATES } from '../data/discoveryOptions'
import CandidateCard from '../components/CandidateCard'
import SkeletonCard from '../components/shared/SkeletonCard'
import EmptyState from '../components/shared/EmptyState'
import ErrorBanner from '../components/shared/ErrorBanner'
import { useScrollReveal, useStaggerReveal } from '../hooks/useScrollReveal'
import './Dashboard.css'

function mapDbCandidate(c) {
  return {
    id: c.id,
    role: c.role_applied_for || c.role,
    seniority: c.seniority_level || c.seniority,
    city: c.location_city || c.city,
    company: c.current_employer || c.referring_company || c.company || 'Unknown',
    referringCompany: c.referring_company || c.referringCompany || c.company || 'Unknown',
    skills: c.skills || [],
    interviews: c.interviews_completed ?? c.interviews ?? 0,
    interview_stage_reached: c.interview_stage_reached || 'Technical screen',
    fee: c.fee_percentage ?? c.fee ?? 8,
    salaryLow: c.salary_expectation_min ?? c.salaryLow ?? 0,
    salaryHigh: c.salary_expectation_max ?? c.salaryHigh ?? 0,
    years: c.years_experience ?? c.years ?? 0,
    daysAgo: c.referred_at ? Math.floor((Date.now() - new Date(c.referred_at).getTime()) / 86400000) : (c.daysAgo ?? 5),
    strengths: c.strengths,
    gaps: c.gaps,
    feedback_summary: c.feedback_summary,
    recommendation: c.recommendation,
    industry: c.industry,
    status: c.status || 'available',
    preferred_work_type: c.preferred_work_type || 'Hybrid',
    workHistory: c.workHistory || c.work_history || [],
  }
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [seeding, setSeeding] = useState(false)
  const [seeded, setSeeded] = useState(false)

  function loadCandidates() {
    setLoading(true); setError(null)
    try {
      const stored = getCandidates()
      const mapped = (stored && stored.length > 0) ? stored.map(mapDbCandidate) : MOCK_CANDIDATES.map(mapDbCandidate)
      setCandidates(mapped)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadCandidates() }, [])

  async function handleSeed() {
    setSeeding(true)
    try { await seedCandidates(); setSeeded(true); loadCandidates() }
    catch (err) { console.error('Seed failed:', err) }
    setSeeding(false)
  }

  const displayCandidates = candidates.slice(0, 6)

  const statsRef = useStaggerReveal({ staggerMs: 80 })
  const filterRef = useScrollReveal()
  const cardsRef = useStaggerReveal({ staggerMs: 100 })
  const promoRef = useScrollReveal()

  const headingWords = 'Dashboard'.split(' ')

  return (
    <div className="db-page">
      {/* Page header */}
      <div className="db-header" data-parallax-speed="0.08">
        <h1 className="db-heading text-reveal">
          {headingWords.map((word, i) => (
            <span key={i} className="text-reveal-word" style={{ animationDelay: `${i * 120 + 100}ms` }}>
              {word}{i < headingWords.length - 1 ? '\u00A0' : ''}
            </span>
          ))}
        </h1>
        <p className="db-subheading text-reveal-word" style={{ animationDelay: '350ms' }}>
          Discover pre-vetted candidates with verified efficiency scores
        </p>
      </div>

      {/* Bento stat grid */}
      <div className="db-section db-section--alt" data-parallax-speed="0.04">
        <div className="db-bento-grid" ref={statsRef}>
          <div className="db-stat-card db-stat-card--gold hover-lift" data-reveal style={{ gridColumn: 'span 2' }}>
            <div className="db-stat-heading">Network Efficiency</div>
            <div className="db-stat-value">+$1.2M <span className="db-stat-value-sub">Saved</span></div>
            <p className="db-stat-body">Aggregate savings across all placements vs traditional agency fees this quarter.</p>
            <div className="db-stat-blur-circle" />
          </div>
          <div className="db-stat-card db-stat-card--green hover-lift" data-reveal>
            <span className="material-symbols-outlined db-stat-icon">trending_up</span>
            <div className="db-stat-label">Active Roles</div>
            <div className="db-stat-number db-stat-number--green">42</div>
          </div>
          <div className="db-stat-card db-stat-card--stone hover-lift" data-reveal>
            <span className="material-symbols-outlined db-stat-icon db-stat-icon--stone">verified_user</span>
            <div className="db-stat-label db-stat-label--stone">Verified Referrals</div>
            <div className="db-stat-number">856</div>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="db-filter-bar reveal-fade-up" ref={filterRef}>
        <div className="db-filter-chips">
          <span className="db-chip db-chip--active chip-hover">
            All Tech Stacks
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>expand_more</span>
          </span>
          <span className="db-chip chip-hover">Remote Only</span>
          <span className="db-chip chip-hover">High Efficiency</span>
        </div>
        <div className="db-sort">
          <span className="db-sort-label">Sort by:</span>
          <span className="db-sort-value">Highest Savings</span>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--primary)' }}>swap_vert</span>
        </div>
      </div>

      {/* Candidate cards */}
      <div className="db-card-section db-section--warm" data-parallax-speed="0.06">
        {loading && <div className="db-card-grid"><SkeletonCard count={3} /></div>}

        {!loading && error && <ErrorBanner message={error} onRetry={loadCandidates} />}

        {!loading && !error && candidates.length === 0 && (
          <EmptyState icon="group" message="No candidates yet" ctaLabel="Go to Marketplace" onCta={() => navigate('/marketplace')} />
        )}

        {!loading && !error && displayCandidates.length > 0 && (
          <div className="db-card-grid" ref={cardsRef}>
            {displayCandidates.map((c, i) => (
              <div key={c.id} data-reveal>
                <CandidateCard candidate={c} viewMode="stack" index={i} />
              </div>
            ))}

            {/* Promo card */}
            <div className="db-promo-card pikt-card reveal-fade-up" ref={promoRef}>
              <h2 className="db-promo-heading">Unlock the full<br />talent network</h2>
              <p className="db-promo-body">Access 800+ pre-vetted candidates with verified efficiency scores and referral histories.</p>
              <button className="db-promo-btn press-scale" onClick={() => navigate('/marketplace')}>Get Started</button>
              <div className="db-promo-corner" />
            </div>
          </div>
        )}
      </div>

      {/* Load more */}
      {!loading && candidates.length > 6 && (
        <div className="db-load-more">
          <button className="db-load-btn press-scale" onClick={() => navigate('/marketplace')}>View All Candidates</button>
          <span className="db-load-caption">Showing {displayCandidates.length} of {candidates.length} candidates</span>
        </div>
      )}

      {/* FABs */}
      <div className="db-fabs">
        <div className="db-fab-wrap">
          <button className="db-fab db-fab--gold press-scale" title="Auto Match">
            <span className="material-symbols-outlined">bolt</span>
          </button>
        </div>
        <div className="db-fab-wrap">
          <button className="db-fab db-fab--green press-scale" title="Advanced Filters" onClick={() => navigate('/marketplace')}>
            <span className="material-symbols-outlined">filter_list</span>
          </button>
        </div>
      </div>

      {/* Dev seed tool */}
      <div className="db-dev-tools">
        <div className="db-dev-label">Developer tools</div>
        <button
          onClick={handleSeed}
          disabled={seeding || seeded}
          className="db-seed-btn"
          style={{
            background: seeded ? 'var(--tertiary-container)' : 'var(--primary)',
            color: seeded ? 'var(--on-tertiary-container)' : 'white',
            opacity: seeding ? 0.5 : 1,
            cursor: seeding || seeded ? 'default' : 'pointer',
          }}
        >
          {seeded ? '\u2713 40 candidates seeded' : seeding ? 'Seeding...' : 'Seed 40 fake candidates'}
        </button>
      </div>
    </div>
  )
}
