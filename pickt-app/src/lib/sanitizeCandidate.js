/**
 * Client-side candidate sanitization.
 * Mirrors the backend candidates_public view and sanitize-candidate.ts.
 * Ensures PII is never present in marketplace/card data flows.
 */

const PII_FIELDS = [
  'full_name', 'email', 'mobile_number', 'linkedin_url', 'portfolio_url',
  'current_employer', 'current_job_title',
  'cv_file_url', 'cv_filename', 'cover_letter_url', 'additional_documents',
  'date_of_birth', 'gender',
]

// Fields that must NEVER appear in any client response, even after unlock
const NEVER_EXPOSE = ['date_of_birth', 'gender']

/**
 * Strip interviewer_name from interview_notes array.
 * Retains interviewer_role, outcome, note_text, score, date.
 */
function sanitizeInterviewNotes(notes) {
  if (!Array.isArray(notes)) return notes
  return notes.map(({ interviewer_name, ...rest }) => rest)
}

/**
 * Returns a candidate object safe for marketplace display.
 * All PII fields are set to null.
 */
export function sanitizeForMarketplace(candidate) {
  if (!candidate) return null
  const safe = { ...candidate }
  for (const field of PII_FIELDS) {
    safe[field] = null
  }
  if (safe.interview_notes) {
    safe.interview_notes = sanitizeInterviewNotes(safe.interview_notes)
  }
  return safe
}

/**
 * Returns a candidate with PII revealed (post-unlock).
 * Still strips date_of_birth, gender, and raw file URLs.
 * Still strips interviewer_name from interview_notes.
 */
export function sanitizeForProfile(candidate) {
  if (!candidate) return null
  const safe = { ...candidate }
  for (const field of NEVER_EXPOSE) {
    delete safe[field]
  }
  // Never expose raw storage paths
  delete safe.cv_file_url
  delete safe.cover_letter_url
  // Keep cv_filename for display, convert docs to count
  safe.has_cv = !!candidate.cv_file_url || !!candidate.cv_filename
  safe.has_cover_letter = !!candidate.cover_letter_url
  safe.additional_documents_count = Array.isArray(candidate.additional_documents)
    ? candidate.additional_documents.length : 0
  delete safe.additional_documents
  if (safe.interview_notes) {
    safe.interview_notes = sanitizeInterviewNotes(safe.interview_notes)
  }
  return safe
}

// ── Unlock persistence (mirrors candidate_unlocks table) ──

const UNLOCKS_KEY = 'pickt_unlocks'

export function getUnlockedIds() {
  try {
    const raw = localStorage.getItem(UNLOCKS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function isUnlocked(candidateId) {
  return getUnlockedIds().includes(candidateId)
}

export function persistUnlock(candidateId) {
  const ids = getUnlockedIds()
  if (!ids.includes(candidateId)) {
    ids.push(candidateId)
    localStorage.setItem(UNLOCKS_KEY, JSON.stringify(ids))
  }
}
