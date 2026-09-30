// Saved searches, stored on the employer's account (saved_searches table,
// migration 028) so they're available on any device. Requires a real login.

import { supabase } from './supabase'
import { criteriaKey } from './searchCriteria'

const PENDING_KEY = 'pickt_pending_saved_search'

export async function getSignedInUser() {
  const { data } = await supabase.auth.getSession()
  return data?.session?.user ?? null
}

export async function listSavedSearches() {
  const { data, error } = await supabase
    .from('saved_searches')
    .select('id, name, criteria, criteria_key, created_at')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message || 'Could not load saved searches')
  return data || []
}

/** Returns { status: 'saved', row } or { status: 'duplicate' }. Throws on other errors. */
export async function createSavedSearch(name, criteria) {
  const { data, error } = await supabase
    .from('saved_searches')
    .insert({ name: name.trim(), criteria, criteria_key: criteriaKey(criteria) })
    .select('id, name, criteria, criteria_key, created_at')
    .single()
  if (error) {
    if (error.code === '23505') return { status: 'duplicate' }
    throw new Error(error.message || 'Could not save search')
  }
  return { status: 'saved', row: data }
}

export async function deleteSavedSearch(id) {
  const { error } = await supabase.from('saved_searches').delete().eq('id', id)
  if (error) throw new Error(error.message || 'Could not delete saved search')
}

// ── Save-after-login ──
// If a signed-out user clicks Save, the search waits here until they log in.

export function setPendingSavedSearch(name, criteria) {
  try { sessionStorage.setItem(PENDING_KEY, JSON.stringify({ name, criteria })) } catch { /* storage blocked */ }
}

export function takePendingSavedSearch() {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY)
    sessionStorage.removeItem(PENDING_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}
