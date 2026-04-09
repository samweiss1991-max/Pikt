import './NotificationPanel.css'

const MOCK_NOTIFICATIONS = [
  { id: 1, icon: 'visibility', text: 'Senior Backend Engineer was viewed by 3 companies today', time: '2 min ago', unread: true },
  { id: 2, icon: 'saved_search', text: 'New candidate matching "React + TypeScript" saved search', time: '1 hr ago', unread: true },
  { id: 3, icon: 'lock_open', text: 'Candidate unlocked — placement fee terms accepted', time: '3 hrs ago', unread: false },
  { id: 4, icon: 'trending_up', text: 'Your referral success rate increased to 82%', time: '1 day ago', unread: false },
]

export default function NotificationPanel({ onClose }) {
  return (
    <>
      <div className="np-backdrop" onClick={onClose} />
      <div className="np-panel reveal-fade-up">
        <div className="np-header">
          <span className="np-title">Notifications</span>
          <button className="np-mark-read" onClick={onClose}>Mark all read</button>
        </div>
        <div className="np-list">
          {MOCK_NOTIFICATIONS.map(n => (
            <div key={n.id} className={`np-item ${n.unread ? 'np-item--unread' : ''}`}>
              <span className="material-symbols-outlined np-icon">{n.icon}</span>
              <div className="np-content">
                <p className="np-text">{n.text}</p>
                <span className="np-time">{n.time}</span>
              </div>
              {n.unread && <div className="np-unread-dot" />}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
