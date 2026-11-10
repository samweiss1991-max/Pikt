// Calls for the signed-in person's account, and things that happen at login and log out.

import { supabase } from './supabase'
import { REMEMBERED_SEARCH_KEY } from './searchCriteria'

async function invoke(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    let message = error.message
    try {
      const errorBody = await error.context?.json?.()
      if (errorBody?.error) message = errorBody.error
    } catch { /* keep the generic message */ }
    const wrapped = new Error(message)
    wrapped.status = error.context?.status
    throw wrapped
  }
  return data
}

export const accountApi = (action, params = {}) => invoke('account', { action, ...params })
export const requestsApi = (action, params = {}) => invoke('company-requests', { action, ...params })

export const HOMEPAGES = [
  { value: 'marketplace', label: 'Marketplace', path: '/marketplace' },
  { value: 'my-candidates', label: 'My Candidates', path: '/my-candidates' },
  { value: 'shortlist', label: 'Pickt List (saved candidates and saved searches)', path: '/shortlist' },
  { value: 'refer', label: 'Refer a candidate', path: '/refer' },
  { value: 'dashboard', label: 'Dashboard', path: '/' },
]

/** Where this person goes after logging in. Marketplace unless they've chosen otherwise. */
export async function homepagePath() {
  try {
    const me = await accountApi('me')
    return HOMEPAGES.find(h => h.value === me.preferences?.homepage)?.path || '/marketplace'
  } catch {
    return '/marketplace'
  }
}

export const VIEW_PREF_APPLIED_KEY = 'pickt_view_pref_applied'
const LOGGED_OUT_KEY = 'pickt_just_logged_out'

// Anything saved in this browser that belongs to the person logging out
const PERSONAL_LOCAL_KEYS = [
  REMEMBERED_SEARCH_KEY, 'pickt_refer_draft', 'pickt_pending_saved_search', 'pickt_shortlist',
  'pickt_shortlist_stages', 'pickt_unlocks', 'pickt_dev_auth',
]
const PERSONAL_SESSION_KEYS = ['pickt_discovery_confirmed', VIEW_PREF_APPLIED_KEY]

export async function logOut() {
  for (const key of PERSONAL_LOCAL_KEYS) { try { localStorage.removeItem(key) } catch { /* storage blocked */ } }
  for (const key of PERSONAL_SESSION_KEYS) { try { sessionStorage.removeItem(key) } catch { /* storage blocked */ } }
  // Set first: signing out sends them to the login page straight away
  try { sessionStorage.setItem(LOGGED_OUT_KEY, '1') } catch { /* storage blocked */ }
  try {
    await supabase.auth.signOut()
  } catch {
    // Offline or a server problem: still end the session in this browser
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
  }
}

/** True once, on the first look after logging out. */
export function takeLoggedOutMessage() {
  try {
    const value = sessionStorage.getItem(LOGGED_OUT_KEY)
    sessionStorage.removeItem(LOGGED_OUT_KEY)
    return Boolean(value)
  } catch {
    return false
  }
}
