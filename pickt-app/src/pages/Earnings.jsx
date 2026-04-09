import { COPY } from '../lib/copy'
import EmptyState from '../components/shared/EmptyState'
import './Placeholder.css'

export default function Earnings() {
  return (
    <div className="placeholder-page">
      <h2 className="placeholder-title">{COPY.nav.earnings}</h2>
      <EmptyState
        icon="payments"
        message={COPY.emptyStates.earnings}
        ctaLabel={COPY.emptyStates.earningsCta}
      />

      <div className="placeholder-card-grid">
        <div className="placeholder-card pikt-card">
          <div className="placeholder-card-icon">
            <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--primary)' }}>account_balance</span>
          </div>
          <div className="placeholder-card-title">Revenue Overview</div>
          <div className="placeholder-card-desc">Track your total earnings, pending payments, and payout history.</div>
        </div>
        <div className="placeholder-card pikt-card">
          <div className="placeholder-card-icon">
            <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--secondary)' }}>bar_chart</span>
          </div>
          <div className="placeholder-card-title">Monthly Breakdown</div>
          <div className="placeholder-card-desc">See earnings by month, quarter, and year with trend analysis.</div>
        </div>
        <div className="placeholder-card pikt-card">
          <div className="placeholder-card-icon">
            <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--tertiary)' }}>savings</span>
          </div>
          <div className="placeholder-card-title">Savings Impact</div>
          <div className="placeholder-card-desc">Compare your fees vs traditional agency rates and total client savings.</div>
        </div>
      </div>
    </div>
  )
}
