import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { mapCandidate } from '../lib/candidateUtils'
import CandidateCard from '../components/CandidateCard'
import EmptyState from '../components/shared/EmptyState'
import { useScrollReveal, useStaggerReveal } from '../hooks/useScrollReveal'
import './MarketplaceMatches.css'

function CriteriaSummary({ parsed, totalConsidered, matchCount }) {
  if (!parsed) return null

  const pills = []
  if (parsed.role_title) pills.push({ label: parsed.role_title, icon: 'work' })
  if (parsed.seniority_level) pills.push({ label: parsed.seniority_level, icon: 'badge' })
  if (parsed.location_city) pills.push({ label: parsed.location_city, icon: 'place' })
  if (parsed.preferred_work_type) pills.push({ label: parsed.preferred_work_type, icon: 'home_work' })
  if (parsed.salary_min || parsed.salary_max) {
    const fmt = (n) => n ? `$${(n / 1000).toFixed(0)}k` : '—'
    pills.push({
      label: `${fmt(parsed.salary_min)} – ${fmt(parsed.salary_max)}`,
      icon: 'payments',
    })
  }
  if (parsed.years_experience_min) {
    pills.push({ label: `${parsed.years_experience_min}+ yrs`, icon: 'history' })
  }

  return (
    <div className="mm-criteria">
      <div className="mm-criteria-header">
        <span className="material-symbols-outlined mm-ai-icon">auto_awesome</span>
        <div>
          <div className="mm-criteria-title">AI matched {matchCount} candidate{matchCount === 1 ? '' : 's'}</div>
          <div className="mm-criteria-sub">
            {totalConsidered != null
              ? `Scored ${totalConsidered} candidate${totalConsidered === 1 ? '' : 's'} against your job description.`
              : 'Ranked by relevance to your job description.'}
          </div>
        </div>
      </div>

      {parsed.summary && <p className="mm-criteria-summary">{parsed.summary}</p>}

      {pills.length > 0 && (
        <div className="mm-pills">
          {pills.map((p, i) => (
            <span key={i} className="mm-pill">
              <span className="material-symbols-outlined">{p.icon}</span>
              {p.label}
            </span>
          ))}
        </div>
      )}

      {parsed.skills && parsed.skills.length > 0 && (
        <div className="mm-skills">
          <div className="mm-skills-label">Required skills</div>
          <div className="mm-skill-pills">
            {parsed.skills.map((s) => (
              <span key={s} className="mm-skill-pill">{s}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function MarketplaceMatches() {
  const navigate = useNavigate()
  const location = useLocation()
  const headerRef = useScrollReveal()
  const cardsRef = useStaggerReveal({ staggerMs: 80 })

  const state = location.state || {}
  const parsed = state.parsed
  const rawCandidates = state.candidates || []
  const totalConsidered = state.totalConsidered

  // If user lands here directly without state, redirect to upload
  useEffect(() => {
    if (!parsed && rawCandidates.length === 0) {
      navigate('/marketplace/upload', { replace: true })
    }
  }, [parsed, rawCandidates.length, navigate])

  const matched = rawCandidates.map((c) => ({
    ...mapCandidate(c),
    _score: c._score,
    _matched: c._matched,
  }))

  const maxScore = matched.length > 0 ? matched[0]._score : 0

  return (
    <div className="mm-page">
      <div className="mm-back-row">
        <button className="mm-back-link press-scale" onClick={() => navigate('/marketplace')}>
          <span className="material-symbols-outlined">arrow_back</span>
          Back
        </button>
        <button className="mm-new-search press-scale" onClick={() => navigate('/marketplace/upload')}>
          <span className="material-symbols-outlined">refresh</span>
          New search
        </button>
      </div>

      <div ref={headerRef}>
        <CriteriaSummary parsed={parsed} totalConsidered={totalConsidered} matchCount={matched.length} />
      </div>

      {matched.length === 0 ? (
        <EmptyState
          icon="search_off"
          message="No strong matches found in the current network. Try adjusting the job description, or browse the full marketplace."
          ctaLabel="Browse marketplace"
          onCta={() => navigate('/marketplace/discover')}
        />
      ) : (
        <div className="mm-grid" ref={cardsRef}>
          {matched.map((c, i) => {
            const relevance = maxScore > 0 ? Math.round((c._score / maxScore) * 100) : 0
            return (
              <div key={c.id} data-reveal className="mm-card-wrap">
                <div className="mm-relevance">
                  <div className="mm-relevance-bar">
                    <div className="mm-relevance-fill" style={{ width: `${relevance}%` }} />
                  </div>
                  <div className="mm-relevance-meta">
                    <span className="mm-relevance-score">{relevance}% match</span>
                    {c._matched && c._matched.length > 0 && (
                      <span className="mm-relevance-reasons">
                        Matches: {c._matched.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
                <CandidateCard candidate={c} viewMode="stack" index={i} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
