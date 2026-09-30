// Demo-only interview history for the seed / mock candidates, shaped like
// rows of the `candidate_interviews` table. Real candidates get theirs from
// the candidate-profile edge function instead.
//
// Deterministic (based on the candidate id) so a profile looks the same on
// every visit.

const EMPLOYERS = [
  { name: 'Atlassian', industry: 'Collaboration software', location: 'Sydney' },
  { name: 'Canva', industry: 'Design platform', location: 'Sydney' },
  { name: 'Xero', industry: 'Accounting software', location: 'Melbourne' },
  { name: 'Afterpay', industry: 'Fintech', location: 'Melbourne' },
  { name: 'SafetyCulture', industry: 'Workplace SaaS', location: 'Brisbane' },
  { name: 'Culture Amp', industry: 'HR tech', location: 'Melbourne' },
  { name: 'Airwallex', industry: 'Payments', location: 'Melbourne' },
  { name: 'Employment Hero', industry: 'HR tech', location: 'Sydney' },
  { name: 'Rokt', industry: 'E-commerce tech', location: 'Sydney' },
  { name: 'Zip Co', industry: 'Fintech', location: 'Sydney' },
]

const STAGES = ['1st phone screen', 'Technical screen', '2nd round', '3rd round', 'Final round']

const FEEDBACK = [
  'Excellent problem solver who explained trade-offs clearly under pressure. Panel was unanimous on technical ability.',
  'Very strong communicator with a calm, structured approach. Would have been a great culture add.',
  'Impressive depth in their core stack and asked sharp questions about our roadmap. Slightly light on people leadership.',
  'Great take-home submission with thoughtful tests and documentation. Pairing session confirmed the quality.',
  'Quick learner with genuine curiosity. Needed a little prompting on system design but recovered well.',
]

const REASONS = [
  'Headcount freeze',
  'Better fit selected',
  'Salary mismatch',
  'Role cancelled',
  'Offer declined',
  'Timing — project delayed',
]

// Activity for demo profiles, cycling through every "last active" state
const DEMO_ACTIVE_DAYS = [0, 1, 5, 12, 45, 3, 21, 60]

// Contact details for mock candidates that don't have any
const DEMO_CONTACTS = [
  { full_name: 'Alex Morgan', email: 'alex.morgan@example.com', mobile_number: '+61 412 345 678', linkedin_url: 'linkedin.com/in/alexmorgan' },
  { full_name: 'Priya Shah', email: 'priya.shah@example.com', mobile_number: '+61 423 456 789', linkedin_url: 'linkedin.com/in/priyashah' },
  { full_name: 'Sam Nguyen', email: 'sam.nguyen@example.com', mobile_number: '+61 434 567 890', linkedin_url: 'linkedin.com/in/samnguyen' },
  { full_name: 'Jordan Lee', email: 'jordan.lee@example.com', mobile_number: '+61 445 678 901', linkedin_url: 'linkedin.com/in/jordanlee' },
]

function seedFrom(id) {
  let h = 0
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h
}

/** Candidate fields the demo adds: activity and (if missing) contact details. */
export function demoCandidateExtras(c) {
  const seed = seedFrom(c.id)
  const days = DEMO_ACTIVE_DAYS[seed % DEMO_ACTIVE_DAYS.length]
  return {
    last_active_at: new Date(Date.now() - days * 86400000).toISOString(),
    open_to_offers: seed % 5 !== 0,
    ...(c.full_name || c.email ? {} : DEMO_CONTACTS[seed % DEMO_CONTACTS.length]),
  }
}

/** candidate_interviews-style rows: the referrer's interview plus 1–3 more employers. */
export function demoInterviews(c) {
  const seed = seedFrom(c.id)
  const referrerName = c.referring_company || c.referringCompany || c.company
  const referrer = EMPLOYERS.find(e => e.name === referrerName)
    || { name: referrerName || 'Referring employer', industry: c.industry || 'Technology', location: c.location_city || c.city }

  const referrerStage = c.interview_stage_reached
    || STAGES[Math.min(STAGES.length, Math.max(1, c.interviews_completed ?? c.interviews ?? 1)) - 1]

  const rows = [{
    id: `${c.id}-iv-0`,
    employer_name: referrer.name,
    employer_industry: referrer.industry,
    employer_location: referrer.location,
    stage_reached: referrerStage,
    interviews_completed: c.interviews_completed ?? c.interviews ?? 1,
    feedback: [c.feedback_summary, c.strengths].filter(Boolean).join(' ') || FEEDBACK[seed % FEEDBACK.length],
    outcome_reason: c.why_not_hired || REASONS[seed % REASONS.length],
  }]

  const others = EMPLOYERS.filter(e => e.name !== referrer.name)
  const extra = 1 + (seed % 3)
  for (let i = 0; i < extra; i++) {
    const employer = others[(seed + i * 3) % others.length]
    const rank = 1 + ((seed >> (i + 1)) % STAGES.length)
    rows.push({
      id: `${c.id}-iv-${i + 1}`,
      employer_name: employer.name,
      employer_industry: employer.industry,
      employer_location: employer.location,
      stage_reached: STAGES[rank - 1],
      interviews_completed: rank,
      feedback: FEEDBACK[(seed + i + 1) % FEEDBACK.length],
      outcome_reason: REASONS[(seed + i + 1) % REASONS.length],
    })
  }
  return rows
}
