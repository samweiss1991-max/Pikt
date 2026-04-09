import { COPY } from '../../lib/copy'

const REFERRERS = [
  { initials: 'JD', name: 'Jane Doe', picks: 24, avatarBg: 'rgba(45,114,53,0.2)', avatarColor: 'var(--primary)' },
  { initials: 'MK', name: 'Mike K.', picks: 18, avatarBg: 'rgba(134,92,0,0.15)', avatarColor: 'var(--secondary)' },
  { initials: 'SL', name: 'Sam L.', picks: 15, avatarBg: 'rgba(75,108,76,0.15)', avatarColor: 'var(--tertiary)' },
]

export default function TopReferrersCard() {
  return (
    <div className="tr-card">
      <div className="tr-title">{COPY.insights.topReferrersTitle}</div>
      <div className="tr-list">
        {REFERRERS.map(r => (
          <div key={r.initials} className="tr-row">
            <div className="tr-left">
              <div className="tr-avatar" style={{ background: r.avatarBg, color: r.avatarColor }}>{r.initials}</div>
              <span className="tr-name">{r.name}</span>
            </div>
            <span className="tr-picks">{r.picks} Picks</span>
          </div>
        ))}
      </div>
      <button className="tr-leaderboard-btn">{COPY.insights.viewLeaderboard}</button>
    </div>
  )
}
