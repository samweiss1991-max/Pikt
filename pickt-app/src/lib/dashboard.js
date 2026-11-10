// Calls for the Dashboard's server function (supabase/functions/dashboard).

import { supabase } from './supabase'

async function invoke(body) {
  const { data, error } = await supabase.functions.invoke('dashboard', { body })
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

/** Start of this month in the person's own time zone, for "Unlocked this month" */
function monthStart() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
}

export const dashboardSection = section => invoke({ action: 'section', section, monthStart: monthStart() })
export const unlockedCandidates = (params = {}) => invoke({ action: 'unlocked', monthStart: monthStart(), ...params })
export const openRole = id => invoke({ action: 'role', id })
export const setCandidateStage = (candidateId, stage) => invoke({ action: 'set_stage', candidateId, stage })

/** The unfinished Refer form saved in this browser, if any */
export function referralDraft() {
  try {
    const raw = localStorage.getItem('pickt_refer_draft')
    if (!raw) return null
    const d = JSON.parse(raw)
    const hasData = d.role_applied_for || d.industry || (Array.isArray(d.skills) && d.skills.length > 0)
    return hasData ? { role: d.role_applied_for || 'Untitled candidate' } : null
  } catch {
    return null
  }
}
