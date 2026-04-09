import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import './Auth.css'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="auth-logo-pick">pick</span>
          <span className="auth-logo-t">t</span>
        </div>
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-sub">Sign in to your account</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label className="auth-label">Email</label>
          <input
            type="email"
            className="auth-input"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
          />

          <label className="auth-label">Password</label>
          <input
            type="password"
            className="auth-input"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="auth-footer">
          Don't have an account? <Link to="/signup" className="auth-link">Sign up</Link>
        </p>

        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(187,186,175,.15)', textAlign: 'center' }}>
          <button
            onClick={() => {
              localStorage.setItem('pickt_dev_auth', 'true')
              navigate('/')
            }}
            style={{
              border: '1px solid rgba(187,186,175,.15)', background: 'var(--surface-container-high)',
              color: 'var(--on-surface-variant)', padding: '10px 20px', borderRadius: '0.5rem',
              fontSize: 13, cursor: 'pointer', width: '100%', fontFamily: "'Manrope', sans-serif",
              fontWeight: 600,
            }}
          >
            Skip to demo →
          </button>
          <p style={{ fontSize: 11, color: 'var(--on-surface-variant)', marginTop: 6 }}>
            Browse with test data, no account needed
          </p>
        </div>
      </div>
    </div>
  )
}
