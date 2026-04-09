import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import UnlockModal from './unlock/UnlockModal'
import { getAvatarGradient } from '../lib/avatarGradients'
import { isUnlocked as checkUnlocked } from '../lib/sanitizeCandidate'
import { COPY } from '../lib/copy'
import './CandidateCard.css'

// Icon symbol based on role keywords
function getIconForRole(role) {
  const r = (role || '').toLowerCase()
  if (r.includes('frontend') || r.includes('react') || r.includes('design')) return 'architecture'
  if (r.includes('cloud') || r.includes('devops') || r.includes('platform')) return 'cloud'
  if (r.includes('data') || r.includes('analytics') || r.includes('ml')) return 'database'
  if (r.includes('security')) return 'shield'
  if (r.includes('mobile')) return 'smartphone'
  if (r.includes('product')) return 'category'
  if (r.includes('sales') || r.includes('account') || r.includes('revenue')) return 'trending_up'
  if (r.includes('marketing') || r.includes('growth') || r.includes('seo')) return 'campaign'
  if (r.includes('hr') || r.includes('people') || r.includes('talent')) return 'groups'
  if (r.includes('finance') || r.includes('cfo')) return 'account_balance'
  if (r.includes('legal') || r.includes('compliance') || r.includes('privacy')) return 'gavel'
  if (r.includes('operations') || r.includes('coo') || r.includes('project')) return 'settings'
  if (r.includes('customer') || r.includes('success')) return 'support_agent'
  return 'code'
}

// Gradient based on index
const GRADIENTS = [
  'from-primary-container to-secondary-container',
  'from-tertiary-fixed to-primary-fixed-dim',
  'from-secondary-container to-primary-container',
  'from-primary-fixed-dim to-tertiary-container',
  'from-tertiary-container to-secondary-container',
  'from-secondary-fixed to-primary-container',
]

function getGradientClass(index) {
  return GRADIENTS[index % GRADIENTS.length]
}

// Referrer badge variant based on index
function getReferrerBadge(index, company) {
  const variant = index % 2 === 0 ? 'amber' : 'green'
  return { label: `${COPY.marketplace.referredBy} ${company}`, variant }
}

const STAGE_COLORS = {
  'Final round': { bg: 'rgba(45,114,53,0.12)', color: 'var(--primary)', border: 'rgba(45,114,53,0.3)' },
  '3rd round': { bg: 'rgba(75,108,76,0.12)', color: 'var(--tertiary)', border: 'rgba(75,108,76,0.3)' },
  '2nd round': { bg: 'rgba(109,40,217,0.12)', color: '#a78bfa', border: 'rgba(109,40,217,0.3)' },
  'Technical screen': { bg: 'rgba(109,40,217,0.12)', color: '#a78bfa', border: 'rgba(109,40,217,0.3)' },
  '1st phone screen': { bg: 'rgba(180,83,9,0.12)', color: 'var(--secondary)', border: 'rgba(180,83,9,0.3)' },
}

function StageBadge({ stage }) {
  const s = STAGE_COLORS[stage] || STAGE_COLORS['1st phone screen']
  return (
    <span className="cc-stage" style={{ background: s.bg, color: s.color, borderColor: s.border }}>
      {stage}
    </span>
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

export default function CandidateCard({ candidate: c, viewMode = 'stack', index = 0, onSave, onSkip, ...legacyProps }) {
  const navigate = useNavigate()

  // Legacy fallback for Dashboard page
  if (!c && legacyProps.role) {
    return <LegacyCard {...legacyProps} index={index} />
  }
  if (!c) return null

  return <NewCard candidate={c} viewMode={viewMode} index={index} onSave={onSave} onSkip={onSkip} />
}

// Legacy card (Dashboard compatibility)
function LegacyCard({ index = 0, initials = 'XX', role = '', id = '', experience = '', skills = [], badge, badgeText, efficiencyMetric, efficiencyDesc, referralName, referralInitials, ctaLabel = 'View Dossier', candidateId, workHistory = [] }) {
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

function NewCard({ candidate: c, viewMode, index, onSave, onSkip }) {
  const navigate = useNavigate()
  const [showModal, setShowModal] = useState(false)
  const [unlocked, setUnlocked] = useState(c.status === 'unlocked' || checkUnlocked(c.id))
  const [expanded, setExpanded] = useState(false)

  const matchScore = Math.min(99, 70 + (c.interviews || 0) * 5 + (c.daysAgo <= 3 ? 8 : 0))
  const roleMatch = Math.min(99, 65 + (c.interviews || 0) * 6)
  const interviewMatch = Math.min(99, (c.interviews || 0) * 20)
  const recencyMatch = Math.max(10, 100 - (c.daysAgo || 5) * 8)
  const workType = c.preferred_work_type || c.workType || 'Hybrid'
  const isRecent = (c.daysAgo || 99) <= 3
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
            </div>
          </div>
          {expanded && (
            <div className="cc-expanded-details">
              <MatchBar label="Role match" value={roleMatch} color="var(--primary)" />
              <MatchBar label="Interviews" value={interviewMatch} color="var(--tertiary)" />
              <MatchBar label="Recency" value={recencyMatch} color="var(--secondary)" />
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
              <p className="cc-description cc-description--full">{description}</p>
              <div className="cc-bars-block">
                <MatchBar label="Role match" value={roleMatch} color="var(--primary)" />
                <MatchBar label="Interviews" value={interviewMatch} color="var(--tertiary)" />
                <MatchBar label="Recency" value={recencyMatch} color="var(--secondary)" />
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

  // ── STACK / CAROUSEL VIEW (default — new design) ──
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
            <p className="cc-description">{description}</p>
            <div className="cc-cta-row">
              {unlocked ? (
                <button className="cc-btn-primary" onClick={goToProfile}>{'\u2713'} View full profile</button>
              ) : (
                <button className="cc-btn-primary" onClick={() => setShowModal(true)}>{COPY.marketplace.requestInterview}</button>
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
