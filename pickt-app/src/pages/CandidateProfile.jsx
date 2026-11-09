import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getCvUrl } from '../lib/supabaseQueries'
import { fetchCandidateProfile, isDemoCandidateId } from '../lib/candidateProfile'
import UnlockModal from '../components/unlock/UnlockModal'
import RecordHireModal from '../components/hire/RecordHireModal'
import './CandidateProfile.css'

// ── Activity wording ──
// Header uses ranges; the unlock panel uses the exact day count.

function activityRange(days) {
  if (days == null) return { label: 'Activity not recorded', recent: false }
  if (days === 0) return { label: 'Active today', recent: true }
  if (days <= 7) return { label: 'Active this week', recent: true }
  if (days <= 30) return { label: 'Active this month', recent: true }
  return { label: 'Active over a month ago', recent: false }
}

function activityExact(days) {
  if (days == null) return 'Activity not recorded'
  if (days === 0) return 'Active today'
  if (days === 1) return 'Active yesterday'
  return `Active ${days} days ago`
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

// Stage icon squares darken the further the candidate got (1–5)
const STAGE_SHADES = ['#DCE4F4', '#B9C7E4', '#93A4CA', '#4A64A0', '#002366']

function stageProgressLabel(row) {
  return row.stageRank === row.stageTotal
    ? 'Reached final round'
    : `Reached ${row.stage} (stage ${row.stageRank} of ${row.stageTotal})`
}

function Icon({ name, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`} aria-hidden="true">{name}</span>
}

function LockedBars({ widths = [100, 70] }) {
  return (
    <span className="pp-locked-bars" role="img" aria-label="Locked">
      {widths.map((w, i) => <span key={i} className="pp-locked-bar" style={{ width: `${w}%` }} />)}
    </span>
  )
}

function CopyButton({ value, label }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button type="button" className="pp-copy-btn" onClick={copy} aria-label={copied ? `${label} copied` : `Copy ${label}`}>
      <Icon name={copied ? 'check' : 'content_copy'} />
    </button>
  )
}

function SilverBadge() {
  return (
    <p className="pp-silver" title="Runner-up – reached the final stage but another candidate was chosen">
      <Icon name="workspace_premium" /> Silver medallist
      <span className="pp-silver-note">Runner-up – reached the final stage but another candidate was chosen</span>
    </p>
  )
}

// ── Interview track record row ──
function TrackRow({ row, unlocked }) {
  const shade = STAGE_SHADES[Math.min(row.stageRank, STAGE_SHADES.length) - 1]
  const dark = row.stageRank >= 4
  const isFinal = row.stageRank === row.stageTotal
  return (
    <li className="pp-track-row">
      <span className={`pp-track-icon ${dark ? 'pp-track-icon--dark' : ''}`} style={{ background: shade }}>
        <Icon name={unlocked ? 'apartment' : 'lock'} />
      </span>

      <div className="pp-track-body">
        <div className="pp-track-head">
          <div className="pp-track-employer">
            {unlocked && row.employerName ? (
              <>
                <h3 className="pp-track-name">{row.employerName}</h3>
                <p className="pp-track-desc">{row.employerDescription}</p>
              </>
            ) : (
              <h3 className="pp-track-name">{row.employerDescription}</h3>
            )}
          </div>
          <span className={`pp-stage-badge ${isFinal ? 'pp-stage-badge--final' : ''}`}>{row.stage}</span>
        </div>

        <div className="pp-progress" role="img" aria-label={stageProgressLabel(row)}>
          <span className={`pp-progress-fill ${isFinal ? 'pp-progress-fill--final' : ''}`} style={{ width: `${(row.stageRank / row.stageTotal) * 100}%` }} />
        </div>

        {unlocked ? (
          <div className="pp-track-full">
            {row.silverMedallist && <SilverBadge />}
            {row.notes?.impressed ? (
              <>
                <h4 className="pp-sub-title">What impressed them most</h4>
                <p className="pp-track-feedback">{row.notes.impressed}</p>
              </>
            ) : row.feedback && <p className="pp-track-feedback">{row.feedback}</p>}
            {row.notes?.whyNotOffer && (
              <>
                <h4 className="pp-sub-title">Why they didn't get the offer</h4>
                <p className="pp-track-feedback">{row.notes.whyNotOffer}</p>
              </>
            )}
            {row.notes?.bestFit && (
              <>
                <h4 className="pp-sub-title">What kind of role or team would suit them best</h4>
                <p className="pp-track-feedback">{row.notes.bestFit}</p>
              </>
            )}
            {row.strengths?.length > 0 && (
              <>
                <h4 className="pp-sub-title">Key strengths</h4>
                <ul className="pp-chips" aria-label="Key strengths">
                  {row.strengths.map(s => <li key={s} className="pp-chip pp-chip--strength">{s}</li>)}
                </ul>
              </>
            )}
            {row.developmentAreas?.length > 0 && (
              <>
                <h4 className="pp-sub-title">Development areas</h4>
                <ul className="pp-chips" aria-label="Development areas">
                  {row.developmentAreas.map(s => <li key={s} className="pp-chip pp-chip--growth">{s}</li>)}
                </ul>
              </>
            )}
            {row.outcomeReason && !row.notes?.whyNotOffer && (
              <p className="pp-track-reason">
                <span className="pp-track-reason-label">Why they didn't get the offer:</span> {row.outcomeReason}
              </p>
            )}
            {row.interviewsCompleted > 0 && (
              <p className="pp-track-meta">{plural(row.interviewsCompleted, 'interview', 'interviews')} with this employer</p>
            )}
          </div>
        ) : (
          <>
            {row.teaser && <p className="pp-track-teaser">“{row.teaser}”</p>}
            <div className="pp-track-locked">
              <div className="pp-track-locked-line">
                <LockedBars widths={[100, 62]} />
                <span className="pp-track-locked-label"><Icon name="lock" /> Full feedback · locked</span>
              </div>
              <div className="pp-track-locked-line">
                <LockedBars widths={[80]} />
                <span className="pp-track-locked-label"><Icon name="lock" /> Why they didn't get the offer · locked</span>
              </div>
            </div>
          </>
        )}
      </div>
    </li>
  )
}

// ── Contact details (locked bars or real values) ──
function ContactCard({ profile }) {
  const fields = [
    ['Full name', profile.contact?.fullName],
    ['Email', profile.contact?.email],
    ['Mobile', profile.contact?.mobile],
    ['LinkedIn', profile.contact?.linkedin],
  ]
  return (
    <section className="pp-contact hover-lift" aria-labelledby="pp-contact-title">
      <h2 className="pp-section-label" id="pp-contact-title">
        {!profile.unlocked && <Icon name="lock" />} Contact details
      </h2>
      <dl className="pp-contact-list">
        {fields.map(([label, value]) => (
          <div key={label} className="pp-contact-row">
            <dt className="pp-contact-label">{label}</dt>
            <dd className="pp-contact-value">
              {profile.unlocked ? (
                value ? <><span className="pp-contact-text">{value}</span><CopyButton value={value} label={label} /></> : <span className="pp-muted">Not provided</span>
              ) : (
                <LockedBars widths={[label === 'Full name' ? 70 : 100]} />
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export default function CandidateProfile() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [profile, setProfile] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [showHireModal, setShowHireModal] = useState(false)

  const load = useCallback(async () => {
    try {
      setProfile(await fetchCandidateProfile(id))
      setLoadError(null)
    } catch (e) {
      setLoadError(e.message || 'Could not load this candidate.')
    }
  }, [id])

  useEffect(() => {
    let cancelled = false
    fetchCandidateProfile(id)
      .then(p => { if (!cancelled) { setProfile(p); setLoadError(null) } })
      .catch(e => { if (!cancelled) setLoadError(e.message || 'Could not load this candidate.') })
    return () => { cancelled = true }
  }, [id])

  async function handleUnlockSuccess() {
    setShowModal(false)
    await load() // server now returns the unlocked version
  }

  async function handleHireSuccess() {
    setShowHireModal(false)
    await load()
  }

  async function handleCvDownload() {
    try {
      const data = await getCvUrl(profile.id)
      window.open(data.signedUrl, '_blank')
    } catch {
      alert('Could not download CV. Please try again.')
    }
  }

  if (loadError && !profile) {
    return (
      <div className="pp-page">
        <button className="pp-back press-scale" onClick={() => navigate(-1)}><Icon name="arrow_back" /> Back to marketplace</button>
        <p className="pp-error" role="alert">{loadError}</p>
      </div>
    )
  }
  if (!profile) {
    return <div className="pp-page"><p className="pp-muted" role="status">Loading profile…</p></div>
  }

  const { stats, activity, unlocked } = profile
  const range = activityRange(activity.daysSince)
  const meta = [
    profile.seniority,
    profile.experienceBand,
    profile.location,
    profile.workPreferences?.length ? profile.workPreferences.join(' \u00B7 ') : null,
    profile.notice,
    profile.employmentTypes?.length ? profile.employmentTypes.join(', ') : null,
    profile.residencyStatus ? (profile.visaType ? `${profile.residencyStatus} (${profile.visaType})` : profile.residencyStatus) : null,
  ].filter(Boolean)

  // What the unlock modal needs to show the fee summary
  const modalCandidate = {
    id: profile.id,
    fee: profile.fee,
    salaryLow: profile.salaryLow,
    salaryHigh: profile.salaryHigh,
    referringCompany: profile.referringCompany,
    interviews: stats.interviews,
  }

  const unlockButton = (
    <button type="button" className="pp-unlock-btn press-scale" onClick={() => setShowModal(true)}>
      Unlock profile <Icon name="arrow_forward" />
    </button>
  )

  return (
    <div className={`pp-page ${unlocked ? '' : 'pp-page--locked'}`}>
      <button className="pp-back press-scale" onClick={() => navigate(-1)}><Icon name="arrow_back" /> Back to marketplace</button>

      <div className="pp-layout">
        {/* ── MAIN COLUMN ── */}
        <div className="pp-main">
          {/* Header: folder tab + card */}
          <section className={`pp-folder ${stats.employers > 0 ? 'pp-folder--tabbed' : ''}`} aria-labelledby="pp-role">
            {stats.employers > 0 && (
              <div className="pp-tab">
                <Icon name="check_circle" /> Vetted by {plural(stats.employers, 'employer', 'employers')}
              </div>
            )}
            <div className="pp-card pp-header" data-parallax-speed="0.04">
              <h1 className="pp-role" id="pp-role">{profile.role}</h1>
              {profile.silverMedallist && <SilverBadge />}

              <p className="pp-details">
                <span className={`pp-activity-dot ${range.recent ? '' : 'pp-activity-dot--stale'}`} aria-hidden="true" />
                <span className={`pp-activity-text ${range.recent ? '' : 'pp-activity-text--stale'}`}>{range.label}</span>
                {meta.map(m => <span key={m}> · {m}</span>)}
              </p>

              {profile.skills.length > 0 && (
                <ul className="pp-skills" aria-label="Skills">
                  {profile.skills.map(s => <li key={s} className="pp-skill">{s}</li>)}
                </ul>
              )}

              <ul className="pp-stats" aria-label="Interview summary">
                <li className="pp-stat">
                  <span className="pp-stat-num">{stats.employers}</span>
                  <span className="pp-stat-label">{stats.employers === 1 ? 'employer interviewed them' : 'employers interviewed them'}</span>
                </li>
                <li className="pp-stat">
                  <span className="pp-stat-num">{stats.interviews}</span>
                  <span className="pp-stat-label">{stats.interviews === 1 ? 'interview completed' : 'interviews completed'}</span>
                </li>
                {stats.finalRounds > 0 && (
                  <li className="pp-stat pp-stat--final">
                    <span className="pp-stat-num">{stats.finalRounds}</span>
                    <span className="pp-stat-label">reached the final round</span>
                  </li>
                )}
              </ul>
            </div>
          </section>

          {/* Interview track record */}
          <section className="pp-card pp-track" aria-labelledby="pp-track-title">
            <h2 className="pp-section-label" id="pp-track-title">Interview track record</h2>
            {profile.interviews.length > 0 ? (
              <ol className="pp-track-list">
                {profile.interviews.map(row => <TrackRow key={row.id} row={row} unlocked={unlocked} />)}
              </ol>
            ) : (
              <p className="pp-muted">No interviews recorded yet.</p>
            )}
          </section>

          {/* Unlocked extras from the referrer's assessment */}
          {unlocked && (profile.recommendation || ((profile.strengths || profile.gaps) && !profile.interviews.some(r => r.strengths?.length))) && (
            <section className="pp-card pp-assessment" aria-labelledby="pp-assessment-title">
              <h2 className="pp-section-label" id="pp-assessment-title">Referrer's assessment</h2>
              {profile.recommendation && <p className="pp-recommendation">{profile.recommendation}</p>}
              {/* Older records only: newer ones show chips under each employer above */}
              {profile.strengths && !profile.interviews.some(r => r.strengths?.length) && (<><h3 className="pp-sub-title">Strengths</h3><p className="pp-body">{profile.strengths}</p></>)}
              {profile.gaps && !profile.interviews.some(r => r.developmentAreas?.length) && (<><h3 className="pp-sub-title">Development areas</h3><p className="pp-body">{profile.gaps}</p></>)}
            </section>
          )}
        </div>

        {/* ── SIDE COLUMN (sticky on desktop) ── */}
        <aside className="pp-aside">
          {profile.viewerIsReferrer && (
            <section className="pp-card pp-side-actions" aria-label="Your referral">
              <p className="pp-referred-title"><Icon name="verified" /> You referred this candidate</p>
              {profile.viewerReferrer?.rate != null && (
                <p className="pp-muted">
                  As the {profile.viewerReferrer.position === 1 ? '1st' : '2nd'} referrer, you'll earn {Number(profile.viewerReferrer.rate)}% of their first-year salary if they're hired.
                </p>
              )}
            </section>
          )}

          {!unlocked && !profile.viewerIsReferrer && (
            <section className="pp-unlock" aria-labelledby="pp-unlock-title">
              <p className="pp-unlock-big">
                <span className="pp-unlock-num">{stats.employers}</span>
                <span className="pp-unlock-big-text">
                  {stats.employers === 1 ? 'employer has' : 'employers have'} already done the vetting for you
                </span>
              </p>
              <h2 className="pp-unlock-title" id="pp-unlock-title">See what they said</h2>
              <p className="pp-unlock-lead">Skip the early rounds. Unlock to read every employer's feedback and reach out directly.</p>

              <ul className="pp-checklist">
                {['Which employers interviewed them', 'Full feedback from all interviews', "Why they didn't get each offer", 'Name, email, mobile and LinkedIn'].map(item => (
                  <li key={item}><Icon name="check_circle" className="pp-check" /> {item}</li>
                ))}
              </ul>

              <div className="pp-activity-box">
                <Icon name="schedule" className="pp-activity-icon" />
                <div>
                  <p className="pp-activity-exact">{activityExact(activity.daysSince)}</p>
                  {activity.openToOffers && <p className="pp-activity-sub">Open to offers</p>}
                </div>
              </div>

              {unlockButton}
              {profile.fee != null && <p className="pp-unlock-fee">{profile.fee}% placement fee · only charged on a successful hire</p>}
              <button type="button" className="pp-secondary-btn press-scale pp-refer-btn" onClick={() => navigate(`/refer?candidate=${profile.id}`)}>
                <Icon name="person_add" /> Refer this candidate
              </button>
            </section>
          )}

          <ContactCard profile={profile} />

          {unlocked && (
            <section className="pp-card pp-side-actions" aria-label="Candidate actions">
              {profile.hasCv && (
                <button type="button" className="pp-secondary-btn press-scale" onClick={handleCvDownload}>
                  <Icon name="download" /> Download CV
                </button>
              )}
              {profile.hire ? (
                <div className="pp-hire-summary" role="status">
                  <strong><Icon name="how_to_reg" /> Hire recorded</strong>
                  <span>Start date: {profile.hire.startDate}</span>
                  <span>First-year salary: ${Number(profile.hire.salary).toLocaleString('en-AU')}</span>
                  <span>Placement fee: {Number(profile.hire.totalFeePercentage)}% (${Number(profile.hire.totalFeeAmount).toLocaleString('en-AU')})</span>
                </div>
              ) : profile.isHired ? (
                <p className="pp-muted">This candidate has already been hired.</p>
              ) : isDemoCandidateId(profile.id) ? (
                <p className="pp-muted">This is a demo candidate, so a hire can't be recorded.</p>
              ) : (
                <button type="button" className="pp-secondary-btn press-scale" onClick={() => setShowHireModal(true)}>
                  <Icon name="how_to_reg" /> Mark as hired
                </button>
              )}
            </section>
          )}
        </aside>
      </div>

      {/* Mobile: sticky bottom bar with the unlock button */}
      {!unlocked && !profile.viewerIsReferrer && (
        <div className="pp-mobile-bar">
          <p className="pp-mobile-bar-text">
            <strong>{plural(stats.employers, 'employer', 'employers')}</strong> already vetted them
          </p>
          {unlockButton}
        </div>
      )}

      {showHireModal && (
        <RecordHireModal
          candidateId={profile.id}
          onSuccess={handleHireSuccess}
          onCancel={() => setShowHireModal(false)}
        />
      )}

      {showModal && (
        <UnlockModal
          candidate={modalCandidate}
          candidateId={profile.id}
          onSuccess={handleUnlockSuccess}
          onCancel={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
