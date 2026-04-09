import { COPY } from '../../lib/copy'

const BAR_HEIGHTS = [30, 50, 45, 70, 90, 100]

export default function MarketPulseCard() {
  return (
    <div className="mp-card">
      <div className="mp-header">
        <span className="material-symbols-outlined mp-icon">trending_up</span>
        <span className="mp-label">{COPY.insights.marketPulseTitle}</span>
      </div>
      <div className="mp-stat">{COPY.insights.marketPulseStat}</div>
      <p className="mp-subtitle">{COPY.insights.marketPulseSubtitle}</p>
      <div className="mp-chart">
        {BAR_HEIGHTS.map((h, i) => (
          <div
            key={i}
            className={`mp-bar ${i === BAR_HEIGHTS.length - 1 ? 'mp-bar--last' : ''}`}
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  )
}
