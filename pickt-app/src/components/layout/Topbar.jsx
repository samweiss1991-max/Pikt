import { useState } from 'react'
import { useSearch } from '../../context/SearchContext'
import NotificationPanel from '../shared/NotificationPanel'
import './Topbar.css'

export default function Topbar({ menuButtonRef, navOpen = false, onMenuClick }) {
  const { query, setQuery } = useSearch()
  const [showNotifications, setShowNotifications] = useState(false)

  return (
    <header className="topbar">
      {/* Menu button: only shown on mobile, where the sidebar becomes a drawer */}
      <button
        ref={menuButtonRef}
        type="button"
        className="topbar-menu-btn"
        aria-label={navOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={navOpen}
        aria-controls="app-sidebar"
        onClick={onMenuClick}
      >
        <span className="material-symbols-outlined" aria-hidden="true">{navOpen ? 'close' : 'menu'}</span>
      </button>

      {/* Search */}
      <div className="topbar-search-container">
        <span className="material-symbols-outlined topbar-search-icon">search</span>
        <input
          className="topbar-search-input"
          type="text"
          placeholder="Search talent, roles, or stacks..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {query && (
          <button className="topbar-search-clear" onClick={() => setQuery('')}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="topbar-actions">
        <div className="topbar-notif-wrap">
          <button className="topbar-icon-btn" title="Notifications" onClick={() => setShowNotifications(!showNotifications)}>
            <span className="material-symbols-outlined">notifications</span>
            <div className="topbar-notif-dot" />
          </button>
          {showNotifications && <NotificationPanel onClose={() => setShowNotifications(false)} />}
        </div>
        <button className="topbar-icon-btn" title="Help">
          <span className="material-symbols-outlined">help_outline</span>
        </button>
        <div className="topbar-divider" />
        <span className="topbar-profile-label">Profile</span>
        <div className="topbar-avatar">
          <span className="material-symbols-outlined">person</span>
        </div>
      </div>
    </header>
  )
}
