import { useState } from 'react'
import { COPY } from '../lib/copy'
import { useScrollReveal, useStaggerReveal } from '../hooks/useScrollReveal'
import './Integrations.css'

const ATS_INTEGRATIONS = [
  { id: 'greenhouse', name: 'Greenhouse', icon: 'eco', desc: 'Sync candidates and track placements directly in Greenhouse.', status: 'available' },
  { id: 'lever', name: 'Lever', icon: 'swap_horiz', desc: 'Push unlocked candidates to your Lever pipeline automatically.', status: 'available' },
  { id: 'workable', name: 'Workable', icon: 'work', desc: 'Connect Workable to import job requisitions and sync hires.', status: 'available' },
  { id: 'ashby', name: 'Ashby', icon: 'hub', desc: 'Two-way sync with Ashby for real-time pipeline visibility.', status: 'coming_soon' },
]

const HOW_IT_WORKS = [
  { step: '1', icon: 'link', title: 'Connect', desc: 'Authenticate with your ATS using OAuth. No credentials stored on our side.' },
  { step: '2', icon: 'sync', title: 'Sync', desc: 'When you unlock a candidate, their profile is automatically pushed to your ATS.' },
  { step: '3', icon: 'check_circle', title: 'Track', desc: 'Placement status syncs back to Pickt so fees are triggered automatically.' },
]

export default function Integrations() {
  const [connections, setConnections] = useState({})
  const headerRef = useScrollReveal()
  const cardsRef = useStaggerReveal({ staggerMs: 100 })

  function toggleConnection(id) {
    setConnections(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="int-page">
      <div className="int-header reveal-fade-up" ref={headerRef} data-parallax-speed="0.08">
        <h1 className="int-heading">{COPY.nav.integrations}</h1>
        <p className="int-subheading">Connect your ATS to automate candidate syncing and placement tracking.</p>
      </div>

      <div className="int-grid" ref={cardsRef}>
        {ATS_INTEGRATIONS.map(ats => {
          const connected = connections[ats.id] || false
          const isSoon = ats.status === 'coming_soon'
          return (
            <div key={ats.id} className="int-card hover-lift" data-reveal style={{ opacity: isSoon ? 0.5 : 1 }}>
              <div className="int-card-top">
                <div className="int-card-icon">
                  <span className="material-symbols-outlined">{ats.icon}</span>
                </div>
                <div className="int-card-info">
                  <div className="int-card-name">{ats.name}</div>
                  <div className="int-card-status">
                    <div className={`int-dot ${connected ? 'int-dot--on' : ''}`} />
                    <span>{isSoon ? 'Coming soon' : connected ? 'Connected' : 'Not connected'}</span>
                  </div>
                </div>
              </div>
              <p className="int-card-desc">{ats.desc}</p>
              <button
                className={`int-card-btn press-scale ${connected ? 'int-card-btn--disconnect' : ''} ${isSoon ? 'int-card-btn--disabled' : ''}`}
                disabled={isSoon}
                onClick={() => toggleConnection(ats.id)}
              >
                {isSoon ? 'Coming soon' : connected ? COPY.actions.disconnect : COPY.actions.connect}
              </button>
            </div>
          )
        })}
      </div>

      <div className="int-how">
        <h2 className="int-how-title">How it works</h2>
        <div className="int-how-steps">
          {HOW_IT_WORKS.map(s => (
            <div key={s.step} className="int-how-step hover-lift">
              <div className="int-how-icon">
                <span className="material-symbols-outlined">{s.icon}</span>
              </div>
              <div className="int-how-step-title">{s.title}</div>
              <p className="int-how-step-desc">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
