import { useNavigate } from 'react-router-dom'
import { COPY } from '../lib/copy'
import EmptyState from '../components/shared/EmptyState'
import './Placeholder.css'

export default function MyCandidates() {
  const navigate = useNavigate()

  return (
    <div className="placeholder-page">
      <h2 className="placeholder-title">{COPY.nav.candidates}</h2>
      <EmptyState
        icon="group"
        message={COPY.emptyStates.candidates}
        ctaLabel={COPY.emptyStates.candidatesCta}
        onCta={() => navigate('/marketplace/results')}
      />

      <div className="placeholder-card-grid">
        <div className="placeholder-card pikt-card">
          <div className="placeholder-card-icon">
            <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--primary)' }}>upload</span>
          </div>
          <div className="placeholder-card-title">Refer Candidates</div>
          <div className="placeholder-card-desc">Submit candidate profiles to earn placement fees when they're hired.</div>
        </div>
        <div className="placeholder-card pikt-card">
          <div className="placeholder-card-icon">
            <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--secondary)' }}>visibility</span>
          </div>
          <div className="placeholder-card-title">Track Progress</div>
          <div className="placeholder-card-desc">Monitor interview stages, unlock status, and hiring outcomes.</div>
        </div>
        <div className="placeholder-card pikt-card">
          <div className="placeholder-card-icon">
            <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--tertiary)' }}>trending_up</span>
          </div>
          <div className="placeholder-card-title">Performance</div>
          <div className="placeholder-card-desc">View your referral success rate and candidate quality metrics.</div>
        </div>
      </div>
    </div>
  )
}
