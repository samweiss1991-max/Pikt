// Loads a candidate profile for the profile page.
//
// Real candidates: the candidate-profile edge function decides (server-side)
// what the viewer may see, so a locked profile never contains employer
// names, full feedback, outcome reasons or contact details.
//
// Demo candidates (seed / mock data, whose ids aren't database UUIDs): built
// in the browser with the same shapeProfile() rules, so the page behaves the
// same. Demo data lives in the browser anyway, so this is for demos only.

import { supabase } from './supabase'
import { getCandidatesRaw } from './seedData'
import { isUnlocked } from './sanitizeCandidate'
import { CANDIDATES as MOCK_CANDIDATES } from '../data/discoveryOptions'
import { demoCandidateExtras, demoInterviews } from '../data/demoInterviews'
import { shapeProfile } from '../../supabase/functions/_shared/profileShape.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Seed/mock candidates use ids like "1" or "candidate-3"; real ones are UUIDs. */
export function isDemoCandidateId(id) {
  return !UUID_RE.test(String(id))
}

function demoProfile(id) {
  const raw = getCandidatesRaw()?.find(c => c.id === id)
    || MOCK_CANDIDATES.find(c => c.id === id)
  if (!raw) return null
  const candidate = { ...raw, ...demoCandidateExtras(raw) }
  return shapeProfile({ candidate, interviews: demoInterviews(candidate), unlocked: isUnlocked(id) })
}

export async function fetchCandidateProfile(id) {
  if (isDemoCandidateId(id)) {
    const profile = demoProfile(id)
    if (!profile) throw new Error('Candidate not found')
    return profile
  }

  const { data, error } = await supabase.functions.invoke('candidate-profile', {
    body: { candidateId: id },
  })
  if (error) {
    let message = error.message
    try {
      const body = await error.context?.json?.()
      if (body?.error) message = body.error
    } catch { /* keep generic message */ }
    throw new Error(message)
  }
  return data
}
