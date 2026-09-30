import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import UnlockModal from './unlock/UnlockModal'
import { isUnlocked as checkUnlocked } from '../lib/sanitizeCandidate'
import { isInShortlist, addToShortlist, removeFromShortlist } from '../lib/shortlist'
import { COPY } from '../lib/copy'
import { getIconForRole, getGradientClass } from '../lib/candidateUtils'
import { careerSteps } from '../lib/careerSteps'
import './CandidateCard.css'

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

function CareerClimb({ history, maxBar = 150 }) {
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
                style={{ height: `${Math.round(maxBar * height / 100)}px`, background: bg }}
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

// ── Folder card: shared "folder tab + career climb" layout used by the card views ──
// `actions` render under the skills, `below` spans the full card width at the bottom.
function FolderCard({ c, meta, skillsLimit, extraTop, actions, below, climbMax = 150, stacked = false, variant = '', cardClassName = '', cardProps = {} }) {
  // Same source as the previous referral badge; 'Unknown' is mapCandidate's "no company" placeholder
  const referrerName = c.referringCompany || c.company
  const referrer = referrerName && referrerName !== 'Unknown' ? referrerName : null
  const interviews = c.interviews || 0
  const hasTabs = Boolean(referrer)
  const metaParts = (meta || [c.seniority, c.years ? `${c.years} yrs experience` : null, c.city]).filter(Boolean)
  const hasClimb = careerSteps(c.workHistory).length > 0
  const skills = skillsLimit ? (c.skills || []).slice(0, skillsLimit) : (c.skills || [])
  const salaryStr = c.salaryLow && c.salaryHigh
    ? `$${Math.round(c.salaryLow / 1000)}k – $${Math.round(c.salaryHigh / 1000)}k`
    : null

  return (
    <article
      className={['cc-folder', hasTabs && 'cc-folder--tabbed', stacked && 'cc-folder--stacked', variant && `cc-folder--${variant}`].filter(Boolean).join(' ')}
      aria-label={c.role}
    >
      {hasTabs && (
        <div className="cc-tabs">
          {referrer && (
            <span className="cc-tab cc-tab--referral">
              <span className="material-symbols-outlined" aria-hidden="true">check_circle</span>
              {COPY.marketplace.referredBy} {referrer}
            </span>
          )}
        </div>
      )}
      <div className={`cc-card-new cc-card-new--stack ${hasClimb ? '' : 'cc-card-new--no-climb'} ${cardClassName}`} {...cardProps}>
        <div className="cc-stack-main">
          <h3 className="cc-stack-title">{c.role}</h3>
          {metaParts.length > 0 && <p className="cc-stack-meta">{metaParts.join(' \u00B7 ')}</p>}
          {extraTop}

          {salaryStr && (
            <div className="cc-stack-salary">
              <span className="cc-label">Salary · AUD</span>
              <span className="cc-stack-salary-value">{salaryStr}</span>
            </div>
          )}

          {skills.length > 0 && (
            <ul className="cc-stack-skills" aria-label="Skills">
              {skills.map(s => <li key={s} className="cc-stack-skill">{s}</li>)}
            </ul>
          )}

          {interviews > 0 && (
            <div className="cc-interviews">
              <span className="cc-interviews-num">{interviews}</span>
              <span className="cc-interviews-text">
                <span className="cc-interviews-title">{interviews === 1 ? 'interview completed' : 'interviews completed'}</span>
                <span className="cc-interviews-sub">Already vetted by other employers</span>
              </span>
              <span className="material-symbols-outlined cc-interviews-check" aria-hidden="true">check_circle</span>
            </div>
          )}

          {actions && <div className="cc-stack-actions">{actions}</div>}
        </div>

        {hasClimb && (
          <div className="cc-stack-side">
            <CareerClimb history={c.workHistory} maxBar={climbMax} />
          </div>
        )}

        {below && <div className="cc-stack-below">{below}</div>}
      </div>
    </article>
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

  return <NewCard candidate={c} viewMode={viewMode} />
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

function NewCard({ candidate: c, viewMode }) {
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
  const description = c.strengths || c.feedback_summary || `${c.seniority} with ${c.years}+ years experience in ${c.city}. ${c.interviews} interviews completed.`

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

  const saveButton = (
    <button
      className="cc-stack-bookmark"
      onClick={toggleSave}
      aria-label="Save candidate"
      aria-pressed={saved}
      title={saved ? 'Remove from Pickt List' : 'Save to Pickt List'}
    >
      <span className="material-symbols-outlined" aria-hidden="true" style={saved ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" } : undefined}>{saved ? 'bookmark' : 'bookmark_border'}</span>
    </button>
  )
  const viewProfileButton = (onClick = goToProfile) => (
    <button className="cc-stack-btn cc-stack-btn--outline press-scale" onClick={onClick}>
      View profile <span className="material-symbols-outlined cc-arrow" aria-hidden="true">arrow_forward</span>
    </button>
  )
  const unlockModal = showModal && <UnlockModal candidate={c} candidateId={c.id} onSuccess={handleUnlockSuccess} onCancel={() => setShowModal(false)} />

  // ── TINDER (FICKT) VIEW — compact folder card; tap/Enter to expand details ──
  if (viewMode === 'tinder') {
    const toggle = () => setExpanded(v => !v)
    return (
      <>
        <FolderCard
          c={c}
          stacked
          variant="tinder"
          skillsLimit={3}
          climbMax={90}
          meta={[c.seniority, c.city]}
          cardClassName={`cc-card-new--tinder ${expanded ? 'cc-card-new--expanded' : ''}`}
          cardProps={{
            onClick: toggle,
            onKeyDown: e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle() } },
            role: 'button',
            tabIndex: 0,
            'aria-expanded': expanded,
          }}
          extraTop={
            <div className="cc-pills-row cc-stack-pills">
              <StageBadge stage={c.interview_stage_reached || 'Technical screen'} />
              <span className="cc-pill-score">{matchScore}%</span>
            </div>
          }
          below={expanded && (
            <div className="cc-expanded-details">
              <MatchBar label="Role match" value={roleMatch} color="var(--primary)" />
              <MatchBar label="Interviews" value={interviewMatch} color="var(--color-primary)" />
              <MatchBar label="Recency" value={recencyMatch} color="var(--color-primary)" />
              <p className="cc-description">{description}</p>
              <div className="cc-stack-actions">
                <button className="cc-stack-btn cc-stack-btn--solid press-scale" onClick={e => { e.stopPropagation(); goToProfile() }}>{COPY.marketplace.requestInterview}</button>
                {viewProfileButton(e => { e.stopPropagation(); goToProfile() })}
              </div>
            </div>
          )}
        />
        {unlockModal}
      </>
    )
  }

  // ── FOCUS VIEW — full folder card plus the detailed breakdown underneath ──
  if (viewMode === 'focus') {
    return (
      <>
        <FolderCard
          c={c}
          variant="focus"
          meta={[c.seniority, c.years ? `${c.years} yrs experience` : null, c.city, workType]}
          actions={<>
            {unlocked ? (
              <button className="cc-stack-btn cc-stack-btn--solid press-scale" onClick={goToProfile}>{'\u2713'} View full profile</button>
            ) : (
              <button className="cc-stack-btn cc-stack-btn--solid press-scale" onClick={() => setShowModal(true)}>Unlock candidate</button>
            )}
            {viewProfileButton()}
          </>}
          below={<>
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
          </>}
        />
        {unlockModal}
      </>
    )
  }

  // ── MATRIX VIEW — compact folder card for the 2-column grid ──
  if (viewMode === 'matrix') {
    return (
      <>
        <FolderCard
          c={c}
          stacked
          variant="matrix"
          skillsLimit={3}
          climbMax={100}
          actions={unlocked ? (
            <button className="cc-stack-btn cc-stack-btn--solid cc-stack-btn--wide press-scale" onClick={goToProfile}>{'\u2713'} Unlocked</button>
          ) : (
            <button className="cc-stack-btn cc-stack-btn--solid cc-stack-btn--wide press-scale" onClick={() => setShowModal(true)}>{COPY.marketplace.requestInterview}</button>
          )}
        />
        {unlockModal}
      </>
    )
  }

  // ── STACK & CAROUSEL VIEWS — folder tabs + career climb ──
  return (
    <>
      <FolderCard
        c={c}
        actions={<>
          {unlocked ? (
            <button className="cc-stack-btn cc-stack-btn--solid press-scale" onClick={goToProfile}>{'\u2713'} View full profile</button>
          ) : (
            <button className="cc-stack-btn cc-stack-btn--solid press-scale" onClick={() => setShowModal(true)}>Unlock</button>
          )}
          {viewProfileButton()}
          {saveButton}
        </>}
      />
      {unlockModal}
    </>
  )
}
