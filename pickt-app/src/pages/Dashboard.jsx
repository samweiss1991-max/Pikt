import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccount } from '../context/AccountContext'
import { dashboardSection, referralDraft } from '../lib/dashboard'
import { useStaggerReveal } from '../hooks/useScrollReveal'
import './Dashboard.css'

const money = n => `$${Number(n || 0).toLocaleString('en-AU', { maximumFractionDigits: 0 })}`
const salaryK = n => (n >= 1000 ? `$${Math.round(n / 1000)}k` : money(n))
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const shortDate = iso => new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })

function timeAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} ${days === 1 ? 'day' : 'days'} ago`
  return shortDate(iso)
}

function greeting(date = new Date()) {
  const h = date.getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

/** Loads one section on its own, so a slow or failing one doesn't hold up the rest */
function useSection(name, enabled = true) {
  const [state, setState] = useState({ data: null, error: null })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!enabled) return undefined
    let cancelled = false
    dashboardSection(name)
      .then(data => { if (!cancelled) setState({ data, error: null }) })
      .catch(err => { if (!cancelled) setState({ data: null, error: err.message || 'This section couldn’t load.' }) })
    return () => { cancelled = true }
  }, [name, enabled, attempt])
  const reload = useCallback(() => { setState({ data: null, error: null }); setAttempt(a => a + 1) }, [])
  return { ...state, loading: enabled && !state.data && !state.error, reload }
}

function SectionState({ section, label, lines = 3 }) {
  if (section.loading) {
    return (
      <div className="db2-loading" role="status" aria-label={`Loading ${label}`}>
        {Array.from({ length: lines }, (_, i) => <span key={i} className="db2-skel" />)}
      </div>
    )
  }
  if (section.error) {
    return (
      <div className="db2-error" role="alert">
        <p>We couldn’t load {label} just now.</p>
        <button type="button" className="db2-btn db2-btn--outline db2-btn--small press-scale" onClick={section.reload}>Try again</button>
      </div>
    )
  }
  return null
}

function Card({ title, id, accent, count, action, children, className = '' }) {
  return (
    <section className={`db2-card ${accent ? `db2-card--${accent}` : ''} ${className}`} aria-labelledby={id}>
      <div className="db2-card-head">
        <h2 className="db2-h2" id={id}>
          {title}
          {count != null && <span className="db2-count" aria-label={`${count} items`}>{count}</span>}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

// ---------- 2. Key numbers ----------
function Tiles({ summary }) {
  const containerRef = useStaggerReveal({ deps: [summary.data] })
  if (summary.loading || summary.error) return <div className="db2-tiles"><div className="db2-card db2-tiles-state"><SectionState section={summary} label="your key numbers" lines={2} /></div></div>
  const s = summary.data
  return (
    <div className="db2-tiles" ref={containerRef}>
      <Link to="/marketplace/discover?searches=open" className="db2-tile hover-lift" data-reveal>
        <span className="db2-tile-label">Active roles</span>
        <span className="db2-tile-value">{s.activeRoles.count}</span>
        <span className="db2-tile-sub">{plural(s.activeRoles.matched, 'matched candidate')}</span>
      </Link>
      <Link to="/unlocked?stage=this_month" className="db2-tile hover-lift" data-reveal>
        <span className="db2-tile-label">Unlocked this month</span>
        <span className="db2-tile-value">{s.unlocked.thisMonth}</span>
        <span className="db2-tile-sub">{s.unlocked.notContacted} not contacted yet</span>
      </Link>
      <Link to="/placements" className="db2-tile hover-lift" data-reveal>
        <span className="db2-tile-label">Placements</span>
        <span className="db2-tile-value">{s.placements.total}</span>
        <span className="db2-tile-sub">{s.placements.hired} hired · {s.placements.referred} referred placed</span>
      </Link>
      {s.savings ? (
        <Link to="/earnings" className="db2-tile db2-tile--green hover-lift" data-reveal>
          <span className="db2-tile-label">Saved vs an agency</span>
          <span className="db2-tile-value">{money(s.savings.total)}</span>
          <span className="db2-tile-sub">View earnings &amp; savings →</span>
        </Link>
      ) : (
        <Link to="/shortlist" className="db2-tile hover-lift" data-reveal>
          <span className="db2-tile-label">Saved searches</span>
          <span className="db2-tile-value">{s.savedSearches?.count ?? 0}</span>
          <span className="db2-tile-sub">{plural(s.savedSearches?.newMatches ?? 0, 'new match', 'new matches')}</span>
        </Link>
      )}
    </div>
  )
}

// ---------- 3. Needs your attention ----------
function Attention({ section }) {
  const draft = referralDraft()
  const items = section.data ? [...section.data.items] : []
  if (draft) {
    items.push({
      id: 'draft', icon: 'edit_note', title: `Unfinished referral: ${draft.role}`, detail: 'Saved in this browser',
      action: { label: 'Continue', to: '/refer' },
    })
  }
  return (
    <Card title="Needs your attention" id="db2-attention" accent="coral" count={section.data ? items.length : null}>
      <SectionState section={section} label="your to-do list" />
      {section.data && (items.length === 0 ? (
        <p className="db2-caught-up"><span className="material-symbols-outlined" aria-hidden="true">task_alt</span>You’re all caught up. Nothing needs your attention right now.</p>
      ) : (
        <ul className="db2-todo">
          {items.map(item => (
            <li key={item.id} className="db2-todo-row">
              <span className="db2-todo-icon material-symbols-outlined" aria-hidden="true">{item.icon}</span>
              <div className="db2-todo-main">
                <p className="db2-todo-title">{item.title}</p>
                <p className="db2-todo-detail">{item.detail}</p>
              </div>
              <Link to={item.action.to} className="db2-btn db2-btn--outline db2-btn--small press-scale" aria-label={`${item.action.label}: ${item.title}`}>{item.action.label}</Link>
            </li>
          ))}
        </ul>
      ))}
    </Card>
  )
}

// ---------- 4. Hiring pipeline ----------
const STAGES = [
  { key: 'matched', label: 'Matched', to: r => `/marketplace/discover?search=${r.id}` },
  { key: 'unlocked', label: 'Unlocked', to: r => `/unlocked?role=${r.id}` },
  { key: 'interviewing', label: 'Interviewing', to: r => `/unlocked?role=${r.id}&stage=interviewing` },
  { key: 'hired', label: 'Hired', to: r => `/unlocked?role=${r.id}&stage=hired` },
]
function Pipeline({ section }) {
  const [now] = useState(() => Date.now())
  const days = iso => Math.max(0, Math.floor((now - new Date(iso).getTime()) / 86400000))
  return (
    <Card title="Hiring pipeline" id="db2-pipeline" action={<Link to="/marketplace/discover?searches=open" className="db2-link">Manage roles →</Link>}>
      <SectionState section={section} label="your hiring pipeline" />
      {section.data && (section.data.roles.length === 0 ? (
        <div className="db2-empty">
          <p>Post a role to see your pipeline. In Pickt, a role is a saved Marketplace search.</p>
          <Link to="/marketplace/discover" className="db2-btn db2-btn--navy press-scale">Post new role</Link>
        </div>
      ) : (
        <ul className="db2-pipe">
          {section.data.roles.map(r => (
            <li key={r.id} className="db2-pipe-row">
              <div className="db2-pipe-role">
                <p className="db2-pipe-name">{r.name}</p>
                <p className="db2-muted">Posted {days(r.postedAt) === 0 ? 'today' : `${plural(days(r.postedAt), 'day')} ago`}</p>
              </div>
              <ol className="db2-stages" aria-label={`Pipeline for ${r.name}`}>
                {STAGES.map((s, i) => (
                  <li key={s.key} className="db2-stage-wrap">
                    {i > 0 && <span className="db2-stage-arrow" aria-hidden="true">→</span>}
                    <Link
                      to={s.to(r)}
                      className={`db2-stage db2-stage--${s.key} ${s.key === 'hired' && r.hired === 0 ? 'db2-stage--empty' : ''}`}
                      aria-label={`${s.label}: ${r[s.key]}`}
                    >
                      <span className="db2-stage-num">{r[s.key]}</span>
                      <span className="db2-stage-label">{s.label}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
      ))}
    </Card>
  )
}

// ---------- 5. New matches ----------
function Matches({ section }) {
  const list = section.data?.candidates || []
  return (
    <Card title="New matches for your roles" id="db2-matches" action={<Link to="/marketplace/discover" className="db2-link">View all in Marketplace →</Link>}>
      <SectionState section={section} label="new matches" />
      {section.data && (list.length === 0 ? (
        <p className="db2-muted">No new matches right now. Save a search in the Marketplace and new candidates who fit will show here.</p>
      ) : (
        <ul className="db2-matches">
          {list.map(c => (
            <li key={c.id} className="db2-match hover-lift">
              <div className="db2-match-badges">
                <span className="db2-badge db2-badge--navy">{c.matchPercent}% match</span>
                {c.category && <span className="db2-badge">{c.category}</span>}
              </div>
              <p className="db2-match-role">{c.role}</p>
              <p className="db2-muted">
                {[c.experience, c.location, c.salaryMin ? `${salaryK(c.salaryMin)}${c.salaryMax ? `–${salaryK(c.salaryMax)}` : '+'}` : null].filter(Boolean).join(' · ')}
              </p>
              <p className="db2-match-highlight">{c.highlight}</p>
              <Link to={`/candidates/${c.id}`} className="db2-btn db2-btn--outline db2-btn--small press-scale" aria-label={`View profile: ${c.role}`}>View profile</Link>
            </li>
          ))}
        </ul>
      ))}
    </Card>
  )
}

// ---------- 6. Referrals ----------
const REF_STEPS = ['Referred', 'Unlocked', 'Interviewing', 'Placed']
function Referrals({ section }) {
  const d = section.data
  return (
    <Card
      title="Your company’s referrals"
      id="db2-referrals"
      action={d && d.pendingTotal != null ? <span className="db2-pending">{money(d.pendingTotal)} commission pending</span> : null}
    >
      <SectionState section={section} label="your referrals" />
      {d && (d.referrals.length === 0 ? (
        <div className="db2-empty">
          <p>No referrals yet. Refer a strong candidate you couldn’t place, and earn commission when they’re hired.</p>
          <Link to="/refer" className="db2-btn db2-btn--green-outline press-scale">Refer a candidate</Link>
        </div>
      ) : (
        <ul className="db2-refs">
          {d.referrals.map(r => (
            <li key={r.candidateId} className="db2-ref-row">
              <div className="db2-ref-main">
                <p className="db2-ref-role">{r.role}</p>
                <p className="db2-muted">Referred {shortDate(r.referredAt)}</p>
                <ol className="db2-steps" aria-label={`Progress: ${REF_STEPS[r.step - 1]}`}>
                  {REF_STEPS.map((label, i) => {
                    const state = i + 1 < r.step || (r.placed && i + 1 === r.step) ? 'done' : i + 1 === r.step ? 'current' : 'future'
                    return (
                      <li key={label} className={`db2-step db2-step--${state}`}>
                        <span className="db2-step-bar" aria-hidden="true" />
                        <span className="db2-step-label">{label}</span>
                      </li>
                    )
                  })}
                </ol>
              </div>
              <div className="db2-ref-side">
                {r.placed ? <span className="db2-badge db2-badge--green">Placed</span> : <span className="db2-muted">Unlocked by {plural(r.unlockedBy, 'employer')}</span>}
                {r.commission && <span className={`db2-ref-commission db2-ref-commission--${r.commission.status}`}>{money(r.commission.amount)} {r.commission.status}</span>}
              </div>
            </li>
          ))}
        </ul>
      ))}
    </Card>
  )
}

// ---------- 7. Right-hand column ----------
function Activity({ section }) {
  const own = section.data?.scope === 'own'
  return (
    <Card title={own ? 'Your recent activity' : 'Team activity'} id="db2-activity">
      <SectionState section={section} label="recent activity" />
      {section.data && (section.data.events.length === 0 ? <p className="db2-muted">Nothing yet.</p> : (
        <ul className="db2-activity">
          {section.data.events.map(e => (
            <li key={e.id} className="db2-activity-row">
              <span className="db2-initials" aria-hidden="true">{e.initials}</span>
              <div>
                <p className="db2-activity-text">{e.text}</p>
                <p className="db2-muted"><time dateTime={e.at}>{timeAgo(e.at)}</time></p>
              </div>
            </li>
          ))}
        </ul>
      ))}
    </Card>
  )
}

function Saved({ section }) {
  return (
    <Card title="Recently saved" id="db2-saved" action={<Link to="/shortlist" className="db2-link">Pickt List →</Link>}>
      <SectionState section={section} label="recently saved" lines={2} />
      {section.data && (section.data.items.length === 0 ? <p className="db2-muted">Candidates and searches you save will appear here.</p> : (
        <ul className="db2-saved">
          {section.data.items.map(i => (
            <li key={`${i.kind}-${i.id}`}>
              <Link to={i.to} className="db2-saved-row">
                <span className="material-symbols-outlined" aria-hidden="true">{i.kind === 'search' ? 'manage_search' : 'person'}</span>
                <span className="db2-saved-title">{i.title}</span>
                <span className="db2-muted">{i.kind === 'search' ? 'Search' : 'Candidate'}</span>
              </Link>
            </li>
          ))}
        </ul>
      ))}
    </Card>
  )
}

// ---------- 8. New company ----------
function GetStarted() {
  const steps = [
    { title: 'Post a role', detail: 'Save a Marketplace search for a role you’re hiring for.', label: 'Post a role', to: '/marketplace/discover', style: 'navy' },
    { title: 'Upload a job description', detail: 'We’ll find candidates who fit it.', label: 'Upload', to: '/marketplace/upload', style: 'outline' },
    { title: 'Unlock your first candidate', detail: 'See full profiles of people other companies have interviewed.', label: 'Browse candidates', to: '/marketplace/discover', style: 'outline' },
    { title: 'Refer a candidate', detail: 'Earn commission when someone you couldn’t place is hired.', label: 'Refer', to: '/refer', style: 'green-outline' },
  ]
  return (
    <Card title="Get started" id="db2-start">
      <ol className="db2-start">
        {steps.map((s, i) => (
          <li key={s.title} className="db2-start-row">
            <span className="db2-start-num" aria-hidden="true">{i + 1}</span>
            <div className="db2-todo-main">
              <p className="db2-todo-title">{s.title}</p>
              <p className="db2-todo-detail">{s.detail}</p>
            </div>
            <Link to={s.to} className={`db2-btn db2-btn--${s.style} db2-btn--small press-scale`}>{s.label}</Link>
          </li>
        ))}
      </ol>
    </Card>
  )
}

export default function Dashboard() {
  const { account, demo, loading: accountLoading } = useAccount()
  const ready = !demo && !accountLoading && Boolean(account?.company)
  const summary = useSection('summary', ready)
  const isNew = summary.data?.isNewCompany === true
  // The other sections don't wait for the key numbers, unless this is a brand-new company
  const showSections = ready && !summary.loading && !isNew
  const attention = useSection('attention', ready)
  const pipeline = useSection('pipeline', Boolean(showSections))
  const matches = useSection('matches', Boolean(showSections))
  const referrals = useSection('referrals', Boolean(showSections))
  const activity = useSection('activity', ready)
  const saved = useSection('saved', ready)

  const firstName = (account?.user?.fullName || account?.user?.email || '').split(/[\s@]/)[0]

  return (
    <div className="db2-page">
      <header className="db2-welcome">
        <div>
          <h1 className="db2-title">{greeting()}{firstName ? `, ${firstName}` : ''}</h1>
          <p className="db2-muted">Your hiring and referrals at a glance{account?.company?.name ? ` · ${account.company.name}` : ''}</p>
        </div>
        <div className="db2-actions">
          <Link to="/marketplace" className="db2-btn db2-btn--navy press-scale">Find candidates</Link>
          <Link to="/marketplace/upload" className="db2-btn db2-btn--outline press-scale">Upload a job description</Link>
          <Link to="/refer" className="db2-btn db2-btn--green-outline press-scale">Refer a candidate</Link>
        </div>
      </header>

      {demo && <p className="db2-note" role="note">Log in to see your company’s dashboard.</p>}
      {!demo && !accountLoading && !account?.company && <p className="db2-note" role="note">This login isn’t part of a company yet.</p>}

      {ready && (
        <>
          <Tiles summary={summary} />
          <div className="db2-columns">
            <div className="db2-main">
              <Attention section={attention} />
              {isNew ? <GetStarted /> : (
                <>
                  {summary.loading && <div className="db2-card"><SectionState section={summary} label="your dashboard" /></div>}
                  {showSections && (
                    <>
                      <Pipeline section={pipeline} />
                      <Matches section={matches} />
                      <Referrals section={referrals} />
                    </>
                  )}
                </>
              )}
            </div>
            <aside className="db2-side" aria-label="Activity and saved items">
              <Activity section={activity} />
              <Saved section={saved} />
            </aside>
          </div>
        </>
      )}
    </div>
  )
}
