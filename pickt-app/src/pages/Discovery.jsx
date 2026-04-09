import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ALL_ROLES, INDUSTRIES, SENIORITY, LOCATIONS, SALARY_BANDS } from '../data/discoveryOptions'
import './Discovery.css'

function StepDots({ current, total }) {
  return (
    <div className="step-dots">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`step-dot ${i + 1 === current ? 'step-dot--active' : i + 1 < current ? 'step-dot--done' : ''}`}
        />
      ))}
    </div>
  )
}

export default function Discovery() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [role, setRole] = useState('')
  const [customRole, setCustomRole] = useState('')
  const [industry, setIndustry] = useState('')
  const [seniority, setSeniority] = useState('')
  const [location, setLocation] = useState('')
  const [animKey, setAnimKey] = useState(0)

  function advance(n) { setAnimKey(k => k + 1); setStep(n) }

  const crumbs = []
  if (role) crumbs.push(role)
  if (industry) crumbs.push(industry)
  if (seniority) crumbs.push(seniority)
  if (location) crumbs.push(location)
  const labels = ['Role', 'Industry', 'Seniority', 'Location', 'Salary']

  function handleComplete(salary) {
    navigate('/marketplace/results', {
      state: { role, industry, seniority, location, salary }
    })
  }

  function handleSkip() {
    navigate('/marketplace/results', {
      state: { role, industry, seniority, location }
    })
  }

  return (
    <div className="discovery-page">
      <div key={animKey} className="discovery-content fade-up" data-parallax-speed="0.07">
        <StepDots current={step} total={5} />

        {crumbs.length > 0 && (
          <div className="discovery-breadcrumbs">
            {crumbs.map((b, i) => (
              <span key={i} className="discovery-crumb-group">
                <span className="discovery-crumb">{b}</span>
                {i < crumbs.length - 1 && <span className="discovery-crumb-sep">{'\u203A'}</span>}
              </span>
            ))}
            <span className="discovery-crumb-sep">{'\u203A'}</span>
            <span className="discovery-crumb-label">{labels[step - 1]}</span>
          </div>
        )}

        <p className="discovery-step-label">Step {step} of 5</p>

        {step === 1 && (
          <>
            <h2 className="discovery-heading">
              What <span className="discovery-accent">role</span> are you filling?
            </h2>
            <p className="discovery-sub">Pick a role or type your own below.</p>
            <div className="discovery-chips">
              {ALL_ROLES.slice(0, 16).map(r => (
                <button key={r} className="discovery-chip" onClick={() => { setRole(r); setCustomRole(''); advance(2) }}>
                  {r}
                </button>
              ))}
            </div>
            <div className="discovery-custom">
              <div className="discovery-custom-label">Don't see your role? Type it here:</div>
              <input
                type="text"
                className="discovery-input"
                placeholder="e.g. Solutions Consultant, Revenue Analyst..."
                value={customRole}
                onChange={e => setCustomRole(e.target.value)}
              />
              {customRole.trim().length >= 2 && (
                <button className="discovery-continue-btn" onClick={() => { setRole(customRole.trim()); advance(2) }}>
                  Continue with &ldquo;{customRole.trim()}&rdquo;
                </button>
              )}
            </div>
            <button className="discovery-skip" onClick={() => navigate('/marketplace/results', { state: {} })}>
              Skip and browse all candidates {'\u2192'}
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="discovery-heading">
              What <span className="discovery-accent">industry</span> are you hiring for?
            </h2>
            <p className="discovery-sub">Choose the sector that best matches your open role.</p>
            <div className="discovery-chips">
              {INDUSTRIES.map(ind => (
                <button key={ind} className="discovery-chip" onClick={() => { setIndustry(ind); advance(3) }}>
                  {ind}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="discovery-heading">
              What <span className="discovery-accent">seniority</span> level?
            </h2>
            <p className="discovery-sub">We match this to candidate experience bands.</p>
            <div className="discovery-chips">
              {SENIORITY.map(s => (
                <button key={s} className="discovery-chip" onClick={() => { setSeniority(s); advance(4) }}>
                  {s}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h2 className="discovery-heading">
              Where are they <span className="discovery-accent">based</span>?
            </h2>
            <p className="discovery-sub">Select a city or choose any location.</p>
            <div className="discovery-chips">
              {LOCATIONS.map(loc => (
                <button key={loc} className="discovery-chip" onClick={() => { setLocation(loc); advance(5) }}>
                  {loc}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <h2 className="discovery-heading">
              What's the <span className="discovery-accent">salary</span> range?
            </h2>
            <p className="discovery-sub">This helps us match candidates to your budget.</p>
            <div className="discovery-chips">
              {SALARY_BANDS.map(band => (
                <button key={band} className="discovery-chip" onClick={() => handleComplete(band)}>
                  {band}
                </button>
              ))}
            </div>
          </>
        )}

        {step > 1 && (
          <div className="discovery-bottom-row">
            <button className="discovery-back" onClick={() => advance(step - 1)}>{'\u2190'} Back</button>
            <button className="discovery-skip" onClick={handleSkip}>Skip remaining {'\u2192'}</button>
          </div>
        )}
      </div>
    </div>
  )
}
