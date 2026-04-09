import { COPY } from '../lib/copy'
import EmptyState from '../components/shared/EmptyState'
import './Placeholder.css'

export default function Placements() {
  return (
    <div className="placeholder-page">
      <h2 className="placeholder-title">{COPY.nav.placements}</h2>
      <EmptyState
        icon="handshake"
        message={COPY.emptyStates.placements}
        ctaLabel={COPY.emptyStates.placementsCta}
      />

      <div className="placeholder-card-grid">
        <div className="placeholder-card pikt-card">
          <div className="placeholder-card-icon">
            <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--primary)' }}>check_circle</span>
          </div>
          <div className="placeholder-card-title">Active Placements</div>
          <div className="placeholder-card-desc">View all confirmed hires, start dates, and current status.</div>
        </div>
        <div className="placeholder-card pikt-card">
          <div className="placeholder-card-icon">
            <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--secondary)' }}>receipt_long</span>
          </div>
          <div className="placeholder-card-title">Fee Breakdown</div>
          <div className="placeholder-card-desc">See detailed placement fee calculations and payment schedules.</div>
        </div>
        <div className="placeholder-card pikt-card">
          <div className="placeholder-card-icon">
            <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--tertiary)' }}>history</span>
          </div>
          <div className="placeholder-card-title">Placement History</div>
          <div className="placeholder-card-desc">Review past placements, retention rates, and overall outcomes.</div>
        </div>
      </div>
    </div>
  )
}
