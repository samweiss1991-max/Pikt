import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { getCandidateById, getCandidateWithPii } from '../lib/seedData'
import { isUnlocked as checkUnlocked, persistUnlock } from '../lib/sanitizeCandidate'
import { getIconForRole, getGradientClass } from '../lib/candidateUtils'
import { getCvUrl } from '../lib/supabaseQueries'
import { CANDIDATES } from '../data/discoveryOptions'
import UnlockModal from '../components/unlock/UnlockModal'
import './CandidateProfile.css'

const STAGE_COLORS = {
  'Final round': { bg: 'rgba(45,114,53,0.12)', color: 'var(--primary)', border: 'rgba(45,114,53,0.3)' },
  '3rd round': { bg: 'rgba(75,108,76,0.12)', color: 'var(--tertiary)', border: 'rgba(75,108,76,0.3)' },
  '2nd round': { bg: 'rgba(109,40,217,0.12)', color: '#a78bfa', border: 'rgba(109,40,217,0.3)' },
  'Technical screen': { bg: 'rgba(109,40,217,0.12)', color: '#a78bfa', border: 'rgba(109,40,217,0.3)' },
  '1st phone screen': { bg: 'rgba(180,83,9,0.12)', color: 'var(--secondary)', border: 'rgba(180,83,9,0.3)' },
}

const INTERVIEW_ROUNDS = [
  '1st phone screen',
  'Technical screen',
  '2nd round',
  '3rd round',
  'Final round',
]

function mapToCard(raw) {
  if (!raw) return null
  if (raw.role && raw.salaryLow !== undefined && raw.email !== undefined) return raw
  return {
    id: raw.id,
    role: raw.role_applied_for || raw.role,
    seniority: raw.seniority_level || raw.seniority,
    city: raw.location_city || raw.city,
    company: raw.current_employer || raw.referring_company || raw.company || 'Unknown',
    referringCompany: raw.referring_company || raw.referringCompany || raw.company || 'Unknown',
    skills: raw.skills || [],
    interviews: raw.interviews_completed ?? raw.interviews ?? 0,
    interview_stage_reached: raw.interview_stage_reached || 'Technical screen',
    fee: raw.fee_percentage ?? raw.fee ?? 8,
    salaryLow: raw.salary_expectation_min ?? raw.salaryLow ?? 0,
    salaryHigh: raw.salary_expectation_max ?? raw.salaryHigh ?? 0,
    years: raw.years_experience ?? raw.years ?? 0,
    daysAgo: raw.daysAgo ?? 5,
    strengths: raw.strengths,
    gaps: raw.gaps,
    feedback_summary: raw.feedback_summary,
    recommendation: raw.recommendation,
    why_not_hired: raw.why_not_hired,
    full_name: raw.full_name,
    email: raw.email,
    current_employer: raw.current_employer || raw.company,
    current_job_title: raw.current_job_title || raw.role,
    status: raw.status || 'available',
    preferred_work_type: raw.preferred_work_type || 'Hybrid',
    industry: raw.industry,
  }
}

function CopyIcon({ value }) {
  const [copied, setCopied] = useState(false)
  function handleCopy(e) {
    e.stopPropagation()
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button className="cp-copy-btn" onClick={handleCopy} title="Copy">
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--on-surface-variant)" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
      )}
    </button>
  )
}

export default function CandidateProfile() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { state } = useLocation()

  const initialUnlocked = checkUnlocked(id)
  const [showModal, setShowModal] = useState(false)
  const [unlocked, setUnlocked] = useState(initialUnlocked)

  // Load sanitized (marketplace) or full (unlocked) data
  const raw = unlocked
    ? (getCandidateWithPii(id) || state?.candidate || CANDIDATES[0])
    : (getCandidateById(id) || state?.candidate || CANDIDATES[0])
  const c = mapToCard(raw)

  const saving = Math.round(((0.22 - c.fee / 100) * (c.salaryLow + c.salaryHigh) / 2) / 1000)
  const savingHigh = saving + 6

  const isRecent = (c.daysAgo || 99) <= 3
  const stageStyle = STAGE_COLORS[c.interview_stage_reached] || STAGE_COLORS['1st phone screen']

  function handleUnlockSuccess() {
    persistUnlock(id)
    setUnlocked(true)
    setShowModal(false)
  }

  async function handleCvDownload() {
    try {
      const data = await getCvUrl(c.id)
      window.open(data.signedUrl, '_blank')
    } catch {
      alert('Could not download CV. Please try again.')
    }
  }

  return (
    <div className="cp-page page-enter">
      <button className="cp-back press-scale" onClick={() => navigate(-1)}>{'\u2190'} Back to marketplace</button>

      <div className="cp-layout">
        {/* ── LEFT COLUMN ── */}
        <div className="cp-left" data-parallax-speed="0.06">
          {/* Icon box matching card */}
          <div className={`cp-icon-box bg-gradient-to-br ${getGradientClass(0)}`}>
            <span className="material-symbols-outlined cp-icon-symbol">{getIconForRole(c.role)}</span>
          </div>

          {/* 1. Role + meta pills */}
          <h1 className="cp-role">{c.role}</h1>
          <div className="cp-meta-pills">
            <span className="cp-pill">{c.seniority}</span>
            <span className="cp-pill">{c.years} yrs exp</span>
            <span className="cp-pill">{c.city}</span>
            <span className="cp-pill">{c.preferred_work_type}</span>
          </div>

          {/* 2. Stage + interview + recency pills */}
          <div className="cp-status-pills">
            <span className="cp-stage" style={{ background: stageStyle.bg, color: stageStyle.color, borderColor: stageStyle.border }}>
              {c.interview_stage_reached}
            </span>
            <span className="cp-pill cp-pill--filled">{c.interviews} interviews</span>
            {isRecent && <span className="cp-pill cp-pill--hot">{'\uD83D\uDD25'} {c.daysAgo}d ago</span>}
          </div>

          {/* 3. Skills */}
          <div className="cp-skills">
            {(c.skills || []).map(s => <span key={s} className="cp-skill">{s}</span>)}
          </div>

          {/* 4. Interview timeline */}
          <div className="cp-timeline-card">
            <div className="cp-card-title">Interview stages</div>
            <div className="cp-timeline">
              {INTERVIEW_ROUNDS.map((round, i) => {
                const passed = i < c.interviews
                const isLast = round === c.interview_stage_reached && !passed
                return (
                  <div key={round} className="cp-timeline-item">
                    <div className={`cp-timeline-dot ${passed ? 'cp-timeline-dot--pass' : isLast ? 'cp-timeline-dot--fail' : ''}`}>
                      {passed && <span>{'\u2713'}</span>}
                      {isLast && c.why_not_hired && <span>{'\u2717'}</span>}
                    </div>
                    {i < INTERVIEW_ROUNDS.length - 1 && <div className={`cp-timeline-line ${passed ? 'cp-timeline-line--pass' : ''}`} />}
                    <div className="cp-timeline-label">
                      <span className="cp-timeline-round">{round}</span>
                      {passed && <span className="cp-timeline-note">Passed</span>}
                      {isLast && c.why_not_hired && <span className="cp-timeline-note cp-timeline-note--fail">{c.why_not_hired}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 5. Strengths */}
          {c.strengths && (
            <div className="cp-block cp-block--strengths">
              <div className="cp-block-title">Strengths</div>
              <p className="cp-block-text">{c.strengths}</p>
            </div>
          )}

          {/* 6. Development areas */}
          {c.gaps && (
            <div className="cp-block cp-block--gaps">
              <div className="cp-block-title">Development areas</div>
              <p className="cp-block-text">{c.gaps}</p>
            </div>
          )}

          {/* 7. Feedback summary */}
          {c.feedback_summary && (
            <div className="cp-block cp-block--feedback">
              <div className="cp-block-title">Feedback summary</div>
              <p className="cp-block-text">{c.feedback_summary}</p>
            </div>
          )}

          {/* 8. Personal details */}
          <div className="cp-details-card">
            <div className="cp-card-header">
              {unlocked ? (
                <span className="cp-card-title">Personal details</span>
              ) : (
                <span className="cp-card-title cp-card-title--locked">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--on-surface-variant)" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                  Personal details {'\u2014'} locked
                </span>
              )}
            </div>
            <div className="cp-pii-rows">
              <div className="cp-pii-row"><span className="cp-pii-label">Full name</span><span className="cp-pii-value">{unlocked && c.full_name ? c.full_name : '\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588'}</span></div>
              <div className="cp-pii-row"><span className="cp-pii-label">Email</span><span className="cp-pii-value">{unlocked && c.email ? c.email : '\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588'}</span></div>
              <div className="cp-pii-row"><span className="cp-pii-label">Mobile</span><span className="cp-pii-value">{unlocked ? '+61 4XX XXX XXX' : '\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588'}</span></div>
              <div className="cp-pii-row"><span className="cp-pii-label">LinkedIn</span><span className="cp-pii-value">{unlocked ? 'linkedin.com/in/candidate' : '\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588'}</span></div>
              <div className="cp-pii-row"><span className="cp-pii-label">Current employer</span><span className="cp-pii-value">{unlocked && c.current_employer ? c.current_employer : '\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588'}</span></div>
            </div>
          </div>

          {/* 9. CV section */}
          <div className="cp-details-card">
            <div className="cp-card-title">CV & documents</div>
            {unlocked ? (
              <div className="cp-cv-unlocked">
                <button className="cp-cv-download-btn" onClick={handleCvDownload}>Download CV</button>
                <span className="cp-cv-filename">candidate_cv.pdf</span>
              </div>
            ) : (
              <div className="cp-cv-locked">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--on-surface-variant)" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                <span className="cp-cv-locked-text">CV available after unlocking</span>
                <button className="cp-cv-locked-btn" disabled>Download CV</button>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="cp-right">
          {/* Placement fee card */}
          <div className="cp-sidebar-card hover-lift">
            <div className="cp-fee-number">{c.fee}%</div>
            <div className="cp-fee-sub">of first-year salary</div>

            {saving > 0 && (
              <div className="cp-savings-box">
                <span className="cp-savings-left">vs. typical agency (20{'\u2013'}25%)</span>
                <span className="cp-savings-right">Save ${saving}k{'\u2013'}${savingHigh}k</span>
              </div>
            )}

            <div className="cp-fee-divider" />

            {unlocked ? (
              <button className="cp-unlock-btn cp-unlock-btn--done" disabled>{'\u2713'} Profile unlocked</button>
            ) : (
              <button className="cp-unlock-btn" onClick={() => setShowModal(true)}>Unlock this candidate</button>
            )}

            <div className="cp-fee-note">Fee only due on successful hire</div>
          </div>

          {/* Recommendation card */}
          {c.recommendation && (
            <div className="cp-sidebar-card hover-lift">
              <div className="cp-rec-badge">{c.recommendation}</div>
              {c.why_not_hired && <div className="cp-rec-reason">{c.why_not_hired}</div>}
            </div>
          )}

          {/* Contact details card */}
          <div className="cp-sidebar-card hover-lift">
            <div className="cp-card-title">Contact details</div>
            {unlocked ? (
              <div className="cp-contact-rows">
                <div className="cp-contact-row">
                  <span className="cp-contact-label">Email</span>
                  <span className="cp-contact-value">{c.email || 'jane@example.com'}</span>
                  <CopyIcon value={c.email || 'jane@example.com'} />
                </div>
                <div className="cp-contact-row">
                  <span className="cp-contact-label">Mobile</span>
                  <span className="cp-contact-value">+61 4XX XXX XXX</span>
                  <CopyIcon value="+61 4XX XXX XXX" />
                </div>
                <div className="cp-contact-row">
                  <span className="cp-contact-label">LinkedIn</span>
                  <span className="cp-contact-value">linkedin.com/in/candidate</span>
                  <CopyIcon value="https://linkedin.com/in/candidate" />
                </div>
              </div>
            ) : (
              <div className="cp-contact-locked">
                <div className="cp-contact-rows">
                  <div className="cp-contact-row"><span className="cp-contact-label">Email</span><span className="cp-pii-redacted">{'\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588'}</span></div>
                  <div className="cp-contact-row"><span className="cp-contact-label">Mobile</span><span className="cp-pii-redacted">{'\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588'}</span></div>
                  <div className="cp-contact-row"><span className="cp-contact-label">LinkedIn</span><span className="cp-pii-redacted">{'\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588'}</span></div>
                </div>
                <button className="cp-contact-unlock-btn" onClick={() => setShowModal(true)}>Unlock to view</button>
              </div>
            )}
          </div>

          {/* Referred by card */}
          <div className="cp-sidebar-card hover-lift">
            <div className="cp-card-title">Referred by</div>
            <div className="cp-referrer-row">
              <div className="cp-referrer-avatar">{(c.referringCompany || 'U')[0]}</div>
              <div>
                <div className="cp-referrer-name">{c.referringCompany || c.company}</div>
                <div className="cp-referrer-score">{'\u2605'} 4.6 reputation</div>
                <div className="cp-referrer-note">6 successful placements</div>
              </div>
            </div>
          </div>

          {/* Mark as hired */}
          {unlocked && (
            <button className="cp-hired-btn">Mark as hired</button>
          )}
        </div>
      </div>

      {showModal && (
        <UnlockModal
          candidate={c}
          candidateId={c.id}
          onSuccess={handleUnlockSuccess}
          onCancel={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
