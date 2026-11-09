import { supabase } from './supabase'
import { computeCategoryCounts } from './roleCategories'

/**
 * Supabase query service layer.
 *
 * These functions replace the Next.js API routes that were thin wrappers
 * around Supabase queries. Security is enforced by Row Level Security (RLS)
 * at the database level.
 *
 * For operations that need server secrets (signed CV URLs, email notifications,
 * ATS push), use supabase.functions.invoke() — see Edge Functions in
 * supabase/functions/.
 */

// ── Candidates ─────────────────────────────────────────────

/** Fetch all public candidates (PII-stripped by the candidates_public view) */
export async function fetchCandidatesPublic(filters = {}) {
  let query = supabase.from('candidates_public').select('*')

  if (filters.industry) {
    query = query.eq('industry', filters.industry)
  }
  if (filters.role) {
    query = query.ilike('role_applied_for', `%${filters.role}%`)
  }
  if (filters.seniority && filters.seniority !== 'Any level — show all') {
    query = query.ilike('seniority_level', `%${filters.seniority.split(' ')[0]}%`)
  }
  if (filters.location && filters.location !== 'Any location') {
    query = query.ilike('location_city', `%${filters.location}%`)
  }
  if (filters.workType) {
    query = query.eq('preferred_work_type', filters.workType)
  }
  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  query = query.order('created_at', { ascending: false })

  if (filters.limit) {
    query = query.limit(filters.limit)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

/** Fetch a single candidate by ID (public view) */
/** Fetch several public candidates by id (e.g. the company's saved candidates) */
export async function fetchCandidatesByIds(ids) {
  if (!ids || ids.length === 0) return []
  const { data, error } = await supabase
    .from('candidates_public')
    .select('*')
    .in('id', ids)

  if (error) throw error
  return data || []
}

export async function fetchCandidateById(id) {
  const { data, error } = await supabase
    .from('candidates_public')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

/** Full-text search on candidates_public */
export async function searchCandidates(query) {
  if (!query?.trim()) return []

  const term = `%${query.trim()}%`
  const { data, error } = await supabase
    .from('candidates_public')
    .select('*')
    .or(`role_applied_for.ilike.${term},location_city.ilike.${term},skills.cs.{${query.trim()}}`)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error
  return data ?? []
}

/** Get total candidate count */
export async function fetchCandidateCount() {
  const { count, error } = await supabase
    .from('candidates_public')
    .select('id', { count: 'exact', head: true })

  if (error) throw error
  return count ?? 0
}

/** Get counts grouped by role category, final round status, and remote */
export async function fetchCategoryCounts() {
  const { data, error } = await supabase
    .from('candidates_public')
    .select('role_applied_for, interview_stage_reached, preferred_work_type')

  if (error) throw error
  if (!data) return { totalCount: 0, categoryCounts: {} }

  return computeCategoryCounts(data)
}

/**
 * Dashboard stats: total candidates, distinct roles, and aggregate placement savings.
 * Each piece is fetched independently and falls back to null on error so a
 * single broken query doesn't break the whole dashboard.
 */
export async function fetchDashboardStats() {
  const [verifiedReferrals, activeRoles, savedAmount] = await Promise.all([
    fetchCandidateCount().catch(() => null),
    supabase
      .from('candidates_public')
      .select('role_applied_for')
      .then(({ data, error }) => {
        if (error || !data) return null
        return new Set(data.map(r => r.role_applied_for).filter(Boolean)).size
      })
      .catch(() => null),
    // The signed-in company's own hires only, worked out by the server
    Promise.resolve(supabase.rpc('my_hire_savings'))
      .then(({ data, error }) => (error || data == null ? null : Number(data)))
      .catch(() => null),
  ])
  return { verifiedReferrals, activeRoles, savedAmount }
}

// ── Saved candidates ───────────────────────────────────────

/** Get all saved candidates for the current user */
export async function fetchSavedCandidates() {
  const { data, error } = await supabase
    .from('saved_candidates')
    .select('*, candidates_public(*)')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

/** Save a candidate */
export async function saveCandidate(candidateId) {
  const { data, error } = await supabase
    .from('saved_candidates')
    .insert({ candidate_id: candidateId })
    .select()
    .single()

  if (error) throw error
  return data
}

/** Unsave a candidate */
export async function unsaveCandidate(candidateId) {
  const { error } = await supabase
    .from('saved_candidates')
    .delete()
    .eq('candidate_id', candidateId)

  if (error) throw error
}

// ── Company ────────────────────────────────────────────────

/** Get public company info (name + reputation) */
export async function fetchCompanyPublic(companyId) {
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, reputation_score')
    .eq('id', companyId)
    .single()

  if (error) throw error
  return data
}

// ── Unlocks ────────────────────────────────────────────────

/** Check if the current user has unlocked a candidate */
export async function checkUnlockStatus(candidateId) {
  const { data, error } = await supabase
    .from('candidate_unlocks')
    .select('id')
    .eq('candidate_id', candidateId)
    .maybeSingle()

  if (error) throw error
  return !!data
}

/** Fetch full (unlocked) candidate data — only works if user has an unlock record */
export async function fetchUnlockedCandidate(candidateId) {
  const { data, error } = await supabase
    .from('candidates')
    .select('*')
    .eq('id', candidateId)
    .single()

  if (error) throw error
  return data
}

// ── Server-only operations (via Edge Functions) ────────────

/** Calls an edge function, surfacing its structured error body when present */
async function invokeFunction(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    let message = error.message
    try {
      const errorBody = await error.context?.json?.()
      if (errorBody?.error) message = errorBody.error
    } catch { /* fall back to error.message */ }
    const wrapped = new Error(message)
    wrapped.status = error.context?.status
    throw wrapped
  }
  return data
}

/** Unlock a candidate (creates record, triggers email + ATS push) */
export function unlockCandidate(candidateId) {
  return invokeFunction('unlock-candidate', { candidateId })
}

/** Employer records a hire. Returns the total fee only. */
export function recordHire({ candidateId, salary, startDate }) {
  return invokeFunction('record-hire', { candidateId, salary, startDate })
}

/** Is this person already on Pickt, and what would this company earn? Own rate only. */
export function checkReferralStatus({ email, mobile, candidateId }) {
  return invokeFunction('referral-status', { email, mobile, candidateId })
}

/** This company's referrals with status and its own commission */
export function fetchMyReferrals() {
  return invokeFunction('my-referrals', {})
}

/** Pickt admins only: every other caller gets a 403 from the server */
export function adminCommissions(action, params = {}) {
  return invokeFunction('admin-commissions', { action, ...params })
}

/** Whether to show the Admin menu link. The server still checks every request. */
export async function amIPicktAdmin() {
  const { data, error } = await supabase.rpc('am_i_pickt_admin')
  return !error && data === true
}

/** Get a signed URL for downloading a candidate's CV */
export async function getCvUrl(candidateId) {
  const { data, error } = await supabase.functions.invoke('cv-url', {
    body: { candidateId },
  })
  if (error) throw error
  return data
}
