// Saved candidates ("Save" on the card, listed on the Pickt List page).
//
// Real candidates are saved per company in the saved_candidates table
// (migration 027). Demo/seed candidates aren't in the database, so they are
// saved in this browser only. localStorage also keeps a copy of the saved ids
// so pages can render instantly; syncSavedCandidates() refreshes it from the
// server.

import { supabase } from './supabase'
import { isDemoCandidateId } from './candidateProfile'

const STORAGE_KEY = 'pickt_shortlist'
const STAGES_KEY = 'pickt_shortlist_stages'

// ── Local copy (synchronous) ──

export function getShortlist() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch { return [] }
}

function writeShortlist(ids) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ids)) } catch { /* storage blocked */ }
}

export function addToShortlist(id) {
  const list = getShortlist()
  if (!list.includes(id)) writeShortlist([...list, id])
}

export function removeFromShortlist(id) {
  writeShortlist(getShortlist().filter(x => x !== id))
}

export function isInShortlist(id) {
  return getShortlist().includes(id)
}

// ── Save / unsave (server for real candidates) ──

/** Save a candidate. Throws if the server rejects it. */
export async function saveCandidate(id) {
  if (!isDemoCandidateId(id)) {
    const { error } = await supabase.from('saved_candidates').insert({ candidate_id: id })
    // 23505 = already saved by your company — treat as success
    if (error && error.code !== '23505') throw new Error(error.message || 'Could not save candidate')
  }
  addToShortlist(id)
}

/** Remove a saved candidate. Throws if the server rejects it. */
export async function unsaveCandidate(id) {
  if (!isDemoCandidateId(id)) {
    const { error } = await supabase.from('saved_candidates').delete().eq('candidate_id', id)
    if (error) throw new Error(error.message || 'Could not remove candidate')
  }
  removeFromShortlist(id)
}

/**
 * Refresh the local copy from the server: real ids come from saved_candidates,
 * demo ids stay as they are. Returns the full list of saved ids.
 */
export async function syncSavedCandidates() {
  const { data, error } = await supabase.from('saved_candidates').select('candidate_id')
  if (error) throw error
  const demoIds = getShortlist().filter(isDemoCandidateId)
  const ids = [...demoIds, ...(data || []).map(r => r.candidate_id)]
  writeShortlist(ids)
  return ids
}

// Stage overrides for kanban drag-and-drop
export function getStageOverrides() {
  try {
    return JSON.parse(localStorage.getItem(STAGES_KEY) || '{}')
  } catch { return {} }
}

export function setStageOverride(candidateId, stage) {
  const overrides = getStageOverrides()
  overrides[candidateId] = stage
  try { localStorage.setItem(STAGES_KEY, JSON.stringify(overrides)) } catch { /* storage blocked */ }
}
