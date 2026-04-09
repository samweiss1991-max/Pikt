import './Topbar.css'

export default function Topbar() {
  return (
    <header className="topbar">
      {/* Search */}
      <div className="topbar-search-container">
        <span className="material-symbols-outlined topbar-search-icon">search</span>
        <input
          className="topbar-search-input"
          type="text"
          placeholder="Search talent, roles, or stacks..."
        />
      </div>

      {/* Actions */}
      <div className="topbar-actions">
        <button className="topbar-icon-btn" title="Notifications">
          <span className="material-symbols-outlined">notifications</span>
        </button>
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
