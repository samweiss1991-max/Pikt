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

  const { count: placementCount } = await supabase
    .from('placements')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)

  return { ...data, placementCount: placementCount ?? 0 }
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

/** Unlock a candidate (creates record, triggers email + ATS push) */
export async function unlockCandidate(candidateId) {
  const { data, error } = await supabase.functions.invoke('unlock-candidate', {
    body: { candidateId },
  })
  if (error) throw error
  return data
}

/** Get a signed URL for downloading a candidate's CV */
export async function getCvUrl(candidateId) {
  const { data, error } = await supabase.functions.invoke('cv-url', {
    body: { candidateId },
  })
  if (error) throw error
  return data
}
