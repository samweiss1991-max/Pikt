import { useLocation, useNavigate } from 'react-router-dom'
import { COPY } from '../../lib/copy'
import NavBadge from '../shared/NavBadge'
import './Sidebar.css'

const NAV_ITEMS = [
  { label: COPY.nav.dashboard,     icon: 'dashboard',       path: '/' },
  { label: COPY.nav.picktList,     icon: 'list_alt',        path: '/shortlist' },
  { label: COPY.nav.marketplace,   icon: 'storefront',      path: '/marketplace', fillOnActive: true },
  { label: COPY.nav.saved,         icon: 'bookmark',        path: '/saved' },
  { label: COPY.nav.candidates,    icon: 'group',           path: '/my-candidates' },
  { label: COPY.nav.placements,    icon: 'work_history',    path: '/placements' },
  { label: COPY.nav.earnings,      icon: 'payments',        path: '/earnings' },
  { label: COPY.nav.integrations,  icon: 'extension',       path: '/integrations' },
]

export default function Sidebar({ badges = {} }) {
  const location = useLocation()
  const navigate = useNavigate()

  function isActive(item) {
    if (item.path === '/') return location.pathname === '/'
    return location.pathname.startsWith(item.path)
  }

  return (
    <aside className="sidebar">
      {/* Wordmark */}
      <div className="sidebar-logo">
        <h1 className="sidebar-wordmark">
          <span className="logo-pick">Pick</span>
          <span className="logo-t">t</span>
        </h1>
        <p className="sidebar-subtitle">{COPY.brand.subtitle}</p>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(item => {
          const active = isActive(item)
          return (
            <a
              key={item.path}
              className={`nav-item ${active ? 'nav-item--active' : ''}`}
              onClick={e => { e.preventDefault(); navigate(item.path) }}
              href={item.path}
            >
              <span
                className="material-symbols-outlined nav-icon"
                style={active && item.fillOnActive ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" } : undefined}
              >
                {item.icon}
              </span>
              <span className="nav-label">{item.label}</span>
              <NavBadge count={badges[item.path] || 0} />
            </a>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <button className="sidebar-post-btn" onClick={() => navigate('/marketplace')}>
          <span className="material-symbols-outlined">add_circle</span>
          <span className="nav-label">{COPY.actions.postRole}</span>
        </button>

        <div className="sidebar-user-pill">
          <div className="sidebar-user-avatar">
            <span className="material-symbols-outlined">account_circle</span>
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{COPY.user.name}</div>
            <div className="sidebar-user-plan">{COPY.user.plan}</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
