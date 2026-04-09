import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  // Allow bypass with localStorage flag for testing
  const devBypass = localStorage.getItem('pickt_dev_auth') === 'true'

  if (loading && !devBypass) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--bg)', color: 'var(--on-surface-variant)',
        fontSize: 14,
      }}>
        Loading...
      </div>
    )
  }

  if (!user && !devBypass) {
    return <Navigate to="/login" replace />
  }

  return children
}
