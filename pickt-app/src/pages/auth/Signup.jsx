import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import './Auth.css'

export default function Signup() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signUp(email, password, fullName)
      setSuccess(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-logo">
            <span className="auth-logo-pick">pick</span>
            <span className="auth-logo-t">t</span>
          </div>
          <h1 className="auth-title">Check your email</h1>
          <p className="auth-sub">We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.</p>
          <Link to="/login" className="auth-btn" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: 16 }}>
            Back to login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="auth-logo-pick">pick</span>
          <span className="auth-logo-t">t</span>
        </div>
        <h1 className="auth-title">Create your account</h1>
        <p className="auth-sub">Start discovering pre-vetted candidates</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label className="auth-label">Full name</label>
          <input
            type="text"
            className="auth-input"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Jane Smith"
            required
          />

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
            placeholder="Min 6 characters"
            minLength={6}
            required
          />

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login" className="auth-link">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
