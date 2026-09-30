import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import UnlockModal from './unlock/UnlockModal'
import { isUnlocked as checkUnlocked } from '../lib/sanitizeCandidate'
import { isInShortlist, addToShortlist, removeFromShortlist } from '../lib/shortlist'
import { COPY } from '../lib/copy'
import { getIconForRole, getGradientClass } from '../lib/candidateUtils'
import { careerSteps } from '../lib/careerSteps'
import './CandidateCard.css'

// Referrer badge variant based on index
function getReferrerBadge(index, company) {
  const variant = index % 2 === 0 ? 'amber' : 'green'
  return { label: `${COPY.marketplace.referredBy} ${company}`, variant }
}

const STAGE_COLORS = {
  'Final round': { bg: 'var(--color-success-tint)', color: 'var(--color-success)', border: 'var(--color-success)' },
  '3rd round': { bg: 'var(--color-primary-tint)', color: 'var(--color-primary)', border: 'var(--color-primary)' },
  '2nd round': { bg: 'var(--color-primary-tint)', color: 'var(--color-primary)', border: 'var(--color-border-subtle)' },
  'Technical screen': { bg: 'var(--color-primary-tint)', color: 'var(--color-primary)', border: 'var(--color-border-subtle)' },
  '1st phone screen': { bg: 'var(--gray-100)', color: 'var(--color-text)', border: 'var(--color-border-subtle)' },
}

function StageBadge({ stage }) {
  const s = STAGE_COLORS[stage] || STAGE_COLORS['1st phone screen']
  return (
    <span className="cc-stage" style={{ background: s.bg, color: s.color, borderColor: s.border }}>
      {stage}
    </span>
  )
}

function WorkHistory({ history }) {
  if (!history || history.length === 0) return null
  return (
    <div className="cc-work-history">
      {history.slice(0, 3).map((w, i) => (
        <div key={i} className="cc-wh-entry">
          {i > 0 && <div className="cc-wh-divider" />}
          <div className="cc-wh-top">
            <div className="cc-wh-dot" />
            <span className="cc-wh-company">{w.company}</span>
            <span className="cc-wh-title">{w.title}</span>
          </div>
          <div className="cc-wh-dates">{w.dates}</div>
        </div>
      ))}
    </div>
  )
}

// ── Career climb (Stack view) ──
// Work history drawn as rising steps: oldest (left, shortest, lightest) → newest (right, tallest, navy).

// Lightest → navy; the two darkest steps use white text
const STEP_COLORS = {
  1: ['#002366'],
  2: ['#DCE4F4', '#002366'],
  3: ['#DCE4F4', '#4A64A0', '#002366'],
  4: ['#DCE4F4', '#93A4CA', '#4A64A0', '#002366'],
}
const DARK_STEPS = ['#4A64A0', '#002366']

function CareerClimb({ history }) {
  const steps = careerSteps(history)
  if (steps.length === 0) return null
  const colors = STEP_COLORS[steps.length]
  return (
    <div className="cc-climb">
      <h4 className="cc-label">Career climb</h4>
      <ol className="cc-climb-steps" aria-label="Work history, oldest to newest">
        {steps.map((job, i) => {
          const newest = i === steps.length - 1
          const bg = colors[i]
          // Heights rise from 40% (oldest) to 100% (newest)
          const height = steps.length === 1 ? 100 : 40 + (60 * i) / (steps.length - 1)
          return (
            <li key={i} className="cc-climb-step">
              <div className="cc-climb-text">
                <span className="cc-climb-company">{job.company}</span>
                <span className="cc-climb-title">{job.title}</span>
              </div>
              <div
                className={`cc-climb-bar ${DARK_STEPS.includes(bg) ? 'cc-climb-bar--dark' : ''}`}
                style={{ height: `calc(150px * ${height / 100})`, background: bg }}
              >
                {/* Short years for sighted users, full dates for screen readers */}
                <span className="cc-climb-years" aria-hidden="true">{job.when.short}</span>
                <span className="cc-sr-only">{job.when.raw}</span>
                {newest && <span className="material-symbols-outlined cc-climb-trend" aria-hidden="true">trending_up</span>}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function MatchBar({ label, value, color }) {
  return (
    <div className="cc-bar-row">
      <span className="cc-bar-label">{label}</span>
      <div className="cc-bar-track">
        <div className="cc-bar-fill" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="cc-bar-pct">{value}%</span>
    </div>
  )
}

export default function CandidateCard({ candidate: c, viewMode = 'stack', index = 0, ...legacyProps }) {

  // Legacy fallback for Dashboard page
  if (!c && legacyProps.role) {
    return <LegacyCard {...legacyProps} index={index} />
  }
  if (!c) return null

  return <NewCard candidate={c} viewMode={viewMode} index={index} />
}

// Legacy card (Dashboard compatibility)
function LegacyCard({ index = 0, role = '', skills = [], efficiencyMetric, ctaLabel = 'View Dossier', candidateId }) {
  const navigate = useNavigate()
  return (
    <div className="cc-card-new" style={{ cursor: candidateId ? 'pointer' : undefined }} onClick={() => candidateId && navigate(`/candidates/${candidateId}`)}>
      <div className="cc-inner">
        <div className={`cc-icon-box bg-gradient-to-br ${getGradientClass(index)}`}>
          <span className="material-symbols-outlined cc-icon-symbol">{getIconForRole(role)}</span>
        </div>
        <div className="cc-content">
          <div className="cc-title-row">
            <h3 className="cc-title">{role}</h3>
          </div>
          {skills.length > 0 && (
            <div className="cc-skills">{skills.slice(0, 4).map(s => <span key={s} className="cc-skill-pill">{s}</span>)}</div>
          )}
          {efficiencyMetric && <p className="cc-description">{efficiencyMetric}</p>}
          <div className="cc-cta-row">
            <button className="cc-btn-primary" onClick={e => { e.stopPropagation(); candidateId && navigate(`/candidates/${candidateId}`) }}>{ctaLabel}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function NewCard({ candidate: c, viewMode, index }) {
  const navigate = useNavigate()
  const [showModal, setShowModal] = useState(false)
  const [unlocked, setUnlocked] = useState(c.status === 'unlocked' || checkUnlocked(c.id))
  const [expanded, setExpanded] = useState(false)
  const [saved, setSaved] = useState(isInShortlist(c.id))

  function toggleSave(e) {
    e.stopPropagation()
    if (saved) { removeFromShortlist(c.id); setSaved(false) }
    else { addToShortlist(c.id); setSaved(true); navigate('/shortlist') }
  }

  const matchScore = Math.min(99, 70 + (c.interviews || 0) * 5 + (c.daysAgo <= 3 ? 8 : 0))
  const roleMatch = Math.min(99, 65 + (c.interviews || 0) * 6)
  const interviewMatch = Math.min(99, (c.interviews || 0) * 20)
  const recencyMatch = Math.max(10, 100 - (c.daysAgo || 5) * 8)
  const workType = c.preferred_work_type || c.workType || 'Hybrid'
  const salaryStr = c.salaryLow && c.salaryHigh
    ? `$${Math.round(c.salaryLow / 1000)}k - $${Math.round(c.salaryHigh / 1000)}k`
    : null
  const description = c.strengths || c.feedback_summary || `${c.seniority} with ${c.years}+ years experience in ${c.city}. ${c.interviews} interviews completed.`
  const iconSymbol = getIconForRole(c.role)
  const gradientClass = getGradientClass(index)
  const badge = getReferrerBadge(index, c.referringCompany || c.company)

  function handleUnlockSuccess() {
    setUnlocked(true)
    setShowModal(false)
  }

  function goToProfile() {
    navigate(`/candidates/${c.id}`, { state: { candidate: c } })
  }

  // ── COMPACT VIEW ──
  if (viewMode === 'compact') {
    return (
      <div className="cc-compact" onClick={goToProfile}>
        <span className="cc-compact-role">{c.role}</span>
        <StageBadge stage={c.interview_stage_reached || 'Technical screen'} />
        <span className="cc-compact-score">{matchScore}%</span>
        <span className="cc-compact-fee">{c.fee}%</span>
        <span className="cc-compact-interviews">{c.interviews} int.</span>
        <button className="cc-btn-ghost cc-btn-sm" onClick={e => { e.stopPropagation(); goToProfile() }}>View</button>
      </div>
    )
  }

  // ── TINDER VIEW ──
  if (viewMode === 'tinder') {
    return (
      <>
        <div className={`cc-card-new cc-card-new--tinder ${expanded ? 'cc-card-new--expanded' : ''}`} onClick={() => setExpanded(!expanded)}>
          <div className="cc-inner">
            <div className={`cc-icon-box cc-icon-box--sm bg-gradient-to-br ${gradientClass}`}>
              <span className="material-symbols-outlined cc-icon-symbol">{iconSymbol}</span>
            </div>
            <div className="cc-content">
              <h3 className="cc-title cc-title--lg">{c.role}</h3>
              <div className="cc-meta-line">{c.seniority} {'\u00B7'} {c.city}</div>
              <div className="cc-pills-row">
                <StageBadge stage={c.interview_stage_reached || 'Technical screen'} />
                <span className="cc-pill-score">{matchScore}%</span>
              </div>
              <div className="cc-skills">{(c.skills || []).slice(0, 3).map(s => <span key={s} className="cc-skill-pill">{s}</span>)}</div>
              <WorkHistory history={c.workHistory} />
            </div>
          </div>
          {expanded && (
            <div className="cc-expanded-details">
              <MatchBar label="Role match" value={roleMatch} color="var(--primary)" />
              <MatchBar label="Interviews" value={interviewMatch} color="var(--color-primary)" />
              <MatchBar label="Recency" value={recencyMatch} color="var(--color-primary)" />
              <p className="cc-description">{description}</p>
              <div className="cc-cta-row">
                <button className="cc-btn-primary" onClick={e => { e.stopPropagation(); goToProfile() }}>{COPY.marketplace.requestInterview}</button>
                <button className="cc-btn-secondary" onClick={e => { e.stopPropagation(); goToProfile() }}>View profile <span className="material-symbols-outlined cc-arrow">arrow_forward</span></button>
              </div>
            </div>
          )}
        </div>
        {showModal && <UnlockModal candidate={c} candidateId={c.id} onSuccess={handleUnlockSuccess} onCancel={() => setShowModal(false)} />}
      </>
    )
  }

  // ── FOCUS VIEW ──
  if (viewMode === 'focus') {
    return (
      <>
        <div className="cc-card-new cc-card-new--focus">
          <div className="cc-inner cc-inner--focus">
            <div className={`cc-icon-box cc-icon-box--lg bg-gradient-to-br ${gradientClass}`}>
              <span className="material-symbols-outlined cc-icon-symbol cc-icon-symbol--lg">{iconSymbol}</span>
            </div>
            <div className="cc-content">
              <h3 className="cc-title cc-title--xl">{c.role}</h3>
              {salaryStr && <span className="cc-salary">{salaryStr}</span>}
              <div className="cc-meta-line">{c.seniority} {'\u00B7'} {c.years} yrs {'\u00B7'} {c.city} {'\u00B7'} {workType}</div>
              <div className="cc-skills">{(c.skills || []).map(s => <span key={s} className="cc-skill-pill">{s}</span>)}</div>
              <WorkHistory history={c.workHistory} />
              <p className="cc-description cc-description--full">{description}</p>
              <div className="cc-bars-block">
                <MatchBar label="Role match" value={roleMatch} color="var(--primary)" />
                <MatchBar label="Interviews" value={interviewMatch} color="var(--color-primary)" />
                <MatchBar label="Recency" value={recencyMatch} color="var(--color-primary)" />
              </div>
              {c.gaps && (
                <div className="cc-gaps-block">
                  <div className="cc-gaps-title">Development areas</div>
                  <p className="cc-gaps-text">{c.gaps}</p>
                </div>
              )}
              <div className="cc-cta-row">
                {unlocked ? (
                  <button className="cc-btn-primary" onClick={goToProfile}>{'\u2713'} View full profile</button>
                ) : (
                  <button className="cc-btn-primary" onClick={() => setShowModal(true)}>Unlock candidate</button>
                )}
                <button className="cc-btn-secondary" onClick={goToProfile}>View profile <span className="material-symbols-outlined cc-arrow">arrow_forward</span></button>
              </div>
            </div>
          </div>
        </div>
        {showModal && <UnlockModal candidate={c} candidateId={c.id} onSuccess={handleUnlockSuccess} onCancel={() => setShowModal(false)} />}
      </>
    )
  }

  // ── MATRIX VIEW ──
  if (viewMode === 'matrix') {
    return (
      <>
        <div className="cc-card-new cc-card-new--matrix">
          <div className={`cc-referrer-badge cc-referrer-badge--${badge.variant}`}>{badge.label}</div>
          <div className="cc-inner cc-inner--vertical">
            <div className={`cc-icon-box cc-icon-box--sm bg-gradient-to-br ${gradientClass}`}>
              <span className="material-symbols-outlined cc-icon-symbol">{iconSymbol}</span>
            </div>
            <h3 className="cc-title">{c.role}</h3>
            {salaryStr && <span className="cc-salary cc-salary--sm">{salaryStr}</span>}
            <div className="cc-skills">{(c.skills || []).slice(0, 3).map(s => <span key={s} className="cc-skill-pill">{s}</span>)}</div>
            <WorkHistory history={c.workHistory} />
            <div className="cc-cta-row cc-cta-row--stack">
              {unlocked ? (
                <button className="cc-btn-primary cc-btn-primary--sm" onClick={goToProfile}>{'\u2713'} Unlocked</button>
              ) : (
                <button className="cc-btn-primary cc-btn-primary--sm" onClick={() => setShowModal(true)}>{COPY.marketplace.requestInterview}</button>
              )}
            </div>
          </div>
        </div>
        {showModal && <UnlockModal candidate={c} candidateId={c.id} onSuccess={handleUnlockSuccess} onCancel={() => setShowModal(false)} />}
      </>
    )
  }

  // ── STACK VIEW — folder tabs + career climb ──
  if (viewMode === 'stack') {
    // Same source as the previous referral badge; 'Unknown' is mapCandidate's "no company" placeholder
    const referrerName = c.referringCompany || c.company
    const referrer = referrerName && referrerName !== 'Unknown' ? referrerName : null
    const interviews = c.interviews || 0
    const hasTabs = Boolean(referrer) || interviews > 0
    const meta = [c.seniority, c.years ? `${c.years} yrs experience` : null, c.city].filter(Boolean)
    const hasClimb = careerSteps(c.workHistory).length > 0
    return (
      <>
        <article className={`cc-folder ${hasTabs ? 'cc-folder--tabbed' : ''}`} aria-label={c.role}>
          {hasTabs && (
            <div className="cc-tabs">
              {referrer && (
                <span className="cc-tab cc-tab--referral">
                  <span className="material-symbols-outlined" aria-hidden="true">check_circle</span>
                  {COPY.marketplace.referredBy} {referrer}
                </span>
              )}
              {interviews > 0 && (
                <span className="cc-tab cc-tab--interviews">
                  {interviews} {interviews === 1 ? 'interview' : 'interviews'} done
                </span>
              )}
            </div>
          )}
          <div className={`cc-card-new cc-card-new--stack ${hasClimb ? '' : 'cc-card-new--no-climb'}`}>
            <div className="cc-stack-main">
              <h3 className="cc-stack-title">{c.role}</h3>
              {meta.length > 0 && <p className="cc-stack-meta">{meta.join(' \u00B7 ')}</p>}

              {salaryStr && (
                <div className="cc-stack-salary">
                  <span className="cc-label">Salary · AUD</span>
                  <span className="cc-stack-salary-value">{salaryStr.replace(' - ', ' – ')}</span>
                </div>
              )}

              {(c.skills || []).length > 0 && (
                <ul className="cc-stack-skills" aria-label="Skills">
                  {c.skills.map(s => <li key={s} className="cc-stack-skill">{s}</li>)}
                </ul>
              )}

              <div className="cc-stack-actions">
                {unlocked ? (
                  <button className="cc-stack-btn cc-stack-btn--solid press-scale" onClick={goToProfile}>{'\u2713'} View full profile</button>
                ) : (
                  <button className="cc-stack-btn cc-stack-btn--solid press-scale" onClick={() => setShowModal(true)}>Unlock</button>
                )}
                <button className="cc-stack-btn cc-stack-btn--outline press-scale" onClick={goToProfile}>
                  View profile <span className="material-symbols-outlined cc-arrow" aria-hidden="true">arrow_forward</span>
                </button>
                <button
                  className="cc-stack-bookmark"
                  onClick={toggleSave}
                  aria-label="Save candidate"
                  aria-pressed={saved}
                  title={saved ? 'Remove from Pickt List' : 'Save to Pickt List'}
                >
                  <span className="material-symbols-outlined" aria-hidden="true" style={saved ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" } : undefined}>{saved ? 'bookmark' : 'bookmark_border'}</span>
                </button>
              </div>
            </div>

            {hasClimb && (
              <div className="cc-stack-side">
                <CareerClimb history={c.workHistory} />
              </div>
            )}
          </div>
        </article>
        {showModal && <UnlockModal candidate={c} candidateId={c.id} onSuccess={handleUnlockSuccess} onCancel={() => setShowModal(false)} />}
      </>
    )
  }

  // ── CAROUSEL VIEW (default) ──
  return (
    <>
      <div className="cc-card-new">
        <div className={`cc-referrer-badge cc-referrer-badge--${badge.variant}`}>{badge.label}</div>
        <div className="cc-inner">
          <div className={`cc-icon-box bg-gradient-to-br ${gradientClass}`}>
            <span className="material-symbols-outlined cc-icon-symbol">{iconSymbol}</span>
          </div>
          <div className="cc-content">
            <div className="cc-title-row">
              <h3 className="cc-title">{c.role}</h3>
              {salaryStr && <span className="cc-salary">{salaryStr}</span>}
            </div>
            <div className="cc-skills">{(c.skills || []).map(s => <span key={s} className="cc-skill-pill">{s}</span>)}</div>
            <WorkHistory history={c.workHistory} />
            <p className="cc-description">{description}</p>
            <div className="cc-cta-row">
              {unlocked ? (
                <button className="cc-btn-primary press-scale" onClick={goToProfile}>{'\u2713'} View full profile</button>
              ) : (
                <button className="cc-btn-primary press-scale" onClick={() => setShowModal(true)}>Unlock</button>
              )}
              <button className="cc-btn-secondary" onClick={goToProfile}>View profile <span className="material-symbols-outlined cc-arrow">arrow_forward</span></button>
              <button className="cc-bookmark" onClick={toggleSave} title={saved ? 'Remove from Pickt List' : 'Save to Pickt List'}>
                <span className="material-symbols-outlined" style={saved ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" } : undefined}>{saved ? 'bookmark' : 'bookmark_border'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      {showModal && <UnlockModal candidate={c} candidateId={c.id} onSuccess={handleUnlockSuccess} onCancel={() => setShowModal(false)} />}
    </>
  )
}
