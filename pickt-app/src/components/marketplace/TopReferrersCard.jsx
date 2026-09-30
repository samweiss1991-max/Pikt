import { COPY } from '../../lib/copy'

const REFERRERS = [
  { initials: 'JD', name: 'Jane Doe', picks: 24, avatarBg: 'var(--color-primary-tint)', avatarColor: 'var(--color-primary)' },
  { initials: 'MK', name: 'Mike K.', picks: 18, avatarBg: 'var(--color-primary-tint)', avatarColor: 'var(--color-primary)' },
  { initials: 'SL', name: 'Sam L.', picks: 15, avatarBg: 'var(--color-primary-tint)', avatarColor: 'var(--color-primary)' },
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
