const STORAGE_KEY = 'pickt_shortlist'
const STAGES_KEY = 'pickt_shortlist_stages'

export function getShortlist() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch { return [] }
}

export function addToShortlist(id) {
  const list = getShortlist()
  if (!list.includes(id)) {
    list.push(id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  }
}

export function removeFromShortlist(id) {
  const list = getShortlist().filter(x => x !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

export function isInShortlist(id) {
  return getShortlist().includes(id)
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
  localStorage.setItem(STAGES_KEY, JSON.stringify(overrides))
}
