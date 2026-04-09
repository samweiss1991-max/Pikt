import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import LiquidBackground from './LiquidBackground'

export default function Shell() {
  const location = useLocation()

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      <LiquidBackground />
      <Sidebar />
      <div style={{
        marginLeft: '18rem',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
      }}>
        <Topbar />
        <main style={{
          flex: 1,
          padding: '2rem',
        }}>
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
