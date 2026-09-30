import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import LiquidBackground from './LiquidBackground'
import SearchActionsBar from '../search/SearchActionsBar'
import { useLayeredParallax } from '../../hooks/useParallax'

export default function Shell() {
  const location = useLocation()
  const mainRef = useLayeredParallax()
  // Mobile (≤768px) navigation drawer
  const [navOpen, setNavOpen] = useState(false)
  const menuButtonRef = useRef(null)

  function closeNav({ restoreFocus = true } = {}) {
    setNavOpen(false)
    if (restoreFocus) menuButtonRef.current?.focus()
  }

  // Esc closes the drawer
  useEffect(() => {
    if (!navOpen) return
    const onKey = e => { if (e.key === 'Escape') closeNav() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navOpen])

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      <LiquidBackground />
      <Sidebar open={navOpen} onNavigate={() => closeNav({ restoreFocus: false })} />
      {navOpen && <div className="sidebar-backdrop" onClick={() => closeNav()} aria-hidden="true" />}
      {/* Left margin follows the sidebar width (full / icons-only / hidden) — see Sidebar.css */}
      <div className="shell-content">
        <Topbar menuButtonRef={menuButtonRef} navOpen={navOpen} onMenuClick={() => setNavOpen(o => !o)} />
        <main ref={mainRef} style={{
          flex: 1,
          padding: '2rem',
        }}>
          {/* "New search" (+ Save search on the marketplace), same spot on every search/candidate page */}
          <SearchActionsBar />
          <div key={location.key} className="page-enter">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Abstract corner decoration */}
      <div style={{
        position: 'fixed', bottom: 40, right: 40,
        display: 'flex', gap: 16,
        pointerEvents: 'none', opacity: 0.5,
        zIndex: -1,
      }}>
        <div style={{ width: 48, height: 48, background: 'var(--primary-container)', borderRadius: '50%', filter: 'blur(20px)' }} />
        <div style={{ width: 32, height: 32, background: 'var(--secondary-container)', borderRadius: '50%', filter: 'blur(16px)', marginTop: 16 }} />
      </div>
    </div>
  )
}
