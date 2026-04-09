import { useNavigate } from 'react-router-dom'
import { COPY } from '../lib/copy'
import EmptyState from '../components/shared/EmptyState'
import './Placeholder.css'

export default function Saved() {
  const navigate = useNavigate()

  return (
    <div className="placeholder-page">
      <h2 className="placeholder-title">{COPY.nav.saved}</h2>
      <EmptyState
        icon="bookmark"
        message={COPY.emptyStates.saved}
        ctaLabel={COPY.emptyStates.savedCta}
        onCta={() => navigate('/marketplace/results')}
      />

      <div className="placeholder-card-grid">
        <div className="placeholder-card pikt-card">
          <div className="placeholder-card-icon">
            <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--primary)' }}>person_search</span>
          </div>
          <div className="placeholder-card-title">Quick Access</div>
          <div className="placeholder-card-desc">Saved candidates appear here for fast review and comparison.</div>
        </div>
        <div className="placeholder-card pikt-card">
          <div className="placeholder-card-icon">
            <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--secondary)' }}>bookmark_added</span>
          </div>
          <div className="placeholder-card-title">Organized</div>
          <div className="placeholder-card-desc">Group and sort your saved candidates by role, location, or date saved.</div>
        </div>
        <div className="placeholder-card pikt-card">
          <div className="placeholder-card-icon">
            <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--tertiary)' }}>notifications_active</span>
          </div>
          <div className="placeholder-card-title">Alerts</div>
          <div className="placeholder-card-desc">Get notified when saved candidates update their profile or availability.</div>
        </div>
      </div>
    </div>
  )
}
