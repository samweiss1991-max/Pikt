import LiquidBackground from '../layout/LiquidBackground'
import Sidebar from '../layout/Sidebar'
import Topbar from '../layout/Topbar'

export default function PageShell({ children, activeRoute }) {
  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <LiquidBackground />
      <Sidebar activeRoute={activeRoute} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
