import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { autoSearchName, criteriaKey } from '../../lib/searchCriteria'
import {
  listSavedSearches, createSavedSearch, deleteSavedSearch,
  setPendingSavedSearch, takePendingSavedSearch,
} from '../../lib/savedSearches'

const LOGIN_RETURN = '/login?next=/marketplace/discover'
const FEEDBACK_MS = 3000

// A save that was waiting for login. Shared at module level so it runs once
// even if the component mounts twice (React dev StrictMode), and whichever
// copy is on screen shows the result.
let pendingSaveJob = null

/**
 * "Saved searches" dropdown + "Save search" button (marketplace search page).
 * Saved searches live on the employer's account (server), so they need a real login.
 */
export default function SaveSearchControls({ criteria, hasCriteria, onRun }) {
  const navigate = useNavigate()
  const [user, setUser] = useState(undefined) // undefined = still checking
  const [saved, setSaved] = useState([])
  const [status, setStatus] = useState('idle') // idle | saving | saved | duplicate
  const [error, setError] = useState(null)
  const [dialog, setDialog] = useState(null)   // { mode: 'name', name } | { mode: 'login' }
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmId, setConfirmId] = useState(null)
  const menuRef = useRef(null)
  const statusTimer = useRef(null)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  // Signed-in user (Supabase session), kept up to date
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data?.session?.user ?? null))
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null))
    return () => data.subscription.unsubscribe()
  }, [])

  const refresh = useCallback(async () => {
    try { setSaved(await listSavedSearches()) } catch { /* list stays as it was */ }
  }, [])

  function flash(next) {
    setStatus(next)
    clearTimeout(statusTimer.current)
    statusTimer.current = setTimeout(() => setStatus('idle'), FEEDBACK_MS)
  }
  useEffect(() => () => clearTimeout(statusTimer.current), [])

  const save = useCallback(async (name, crit) => {
    setStatus('saving')
    setError(null)
    try {
      const result = await createSavedSearch(name, crit)
      flash(result.status === 'duplicate' ? 'duplicate' : 'saved')
      refresh()
    } catch (e) {
      setStatus('idle')
      setError(e.message ? `Couldn't save search: ${e.message}` : "Couldn't save search. Please try again.")
    }
  }, [refresh])

  // Once signed in: load saved searches, and finish a save that was waiting for login
  useEffect(() => {
    if (!user) return
    // Deferred a tick: these update state, which shouldn't happen synchronously in an effect
    Promise.resolve().then(() => {
      refresh()
      if (!pendingSaveJob) {
        const pending = takePendingSavedSearch()
        if (pending) pendingSaveJob = { pending, promise: createSavedSearch(pending.name, pending.criteria) }
      }
      const job = pendingSaveJob
      if (!job) return
      onRun(job.pending.criteria)
      setStatus('saving')
      job.promise
        .then(result => {
          if (!mounted.current) return   // leave the result for the copy that's on screen
          if (pendingSaveJob === job) pendingSaveJob = null
          flash(result.status === 'duplicate' ? 'duplicate' : 'saved')
          refresh()
        })
        .catch(e => {
          if (!mounted.current) return
          if (pendingSaveJob === job) pendingSaveJob = null
          setStatus('idle')
          setError(`Couldn't save search: ${e.message}`)
        })
    })
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close the dropdown on outside click / Esc
  useEffect(() => {
    if (!menuOpen) return
    const onDown = e => { if (!menuRef.current?.contains(e.target)) { setMenuOpen(false); setConfirmId(null) } }
    const onKey = e => { if (e.key === 'Escape') { setMenuOpen(false); setConfirmId(null) } }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [menuOpen])

  function onSaveClick() {
    setError(null)
    // Exact same search already saved? Say so instead of creating a duplicate
    if (user && saved.some(s => s.criteria_key === criteriaKey(criteria))) { flash('duplicate'); return }
    setDialog(user ? { mode: 'name', name: autoSearchName(criteria) } : { mode: 'login' })
  }

  function confirmName(e) {
    e.preventDefault()
    const name = dialog.name.trim()
    if (!name) return
    setDialog(null)
    save(name, criteria)
  }

  function goToLogin() {
    setPendingSavedSearch(autoSearchName(criteria), criteria)
    navigate(LOGIN_RETURN)
  }

  async function remove(id) {
    setConfirmId(null)
    const before = saved
    setSaved(prev => prev.filter(s => s.id !== id))
    try { await deleteSavedSearch(id) } catch {
      setSaved(before)
      setError("Couldn't delete that saved search. Please try again.")
    }
  }

  const label = { saving: 'Saving…', saved: 'Saved', duplicate: 'Already saved' }[status] || 'Save search'
  const icon = { saved: 'check', duplicate: 'bookmark_added' }[status] || 'bookmark_border'

  return (
    <>
      <div className="sa-menu-wrap" ref={menuRef}>
        <button
          type="button"
          className="sa-btn press-scale"
          aria-haspopup="true"
          aria-expanded={menuOpen}
          aria-controls="sa-saved-menu"
          onClick={() => { setMenuOpen(o => !o); setConfirmId(null) }}
        >
          Saved searches{user && saved.length > 0 ? ` (${saved.length})` : ''}
          <span className="material-symbols-outlined" aria-hidden="true">{menuOpen ? 'expand_less' : 'expand_more'}</span>
        </button>
        {menuOpen && (
          <ul className="sa-menu" id="sa-saved-menu" aria-label="Saved searches">
            {!user && (
              <li className="sa-menu-empty">
                <a href={LOGIN_RETURN} onClick={e => { e.preventDefault(); navigate(LOGIN_RETURN) }}>Log in</a> to see your saved searches.
              </li>
            )}
            {user && saved.length === 0 && <li className="sa-menu-empty">No saved searches yet.</li>}
            {user && saved.map(s => (
              <li key={s.id}>
                {confirmId === s.id ? (
                  <div className="sa-confirm" role="group" aria-label={`Delete ${s.name}?`}>
                    <p>Delete “{s.name}”?</p>
                    <button type="button" className="sa-confirm-yes" onClick={() => remove(s.id)}>Delete</button>
                    <button type="button" className="sa-confirm-no" onClick={() => setConfirmId(null)} autoFocus>Cancel</button>
                  </div>
                ) : (
                  <div className="sa-item">
                    <button type="button" className="sa-item-run" title={s.name} onClick={() => { setMenuOpen(false); onRun(s.criteria) }}>
                      {s.name}
                    </button>
                    <button type="button" className="sa-item-delete" aria-label={`Delete saved search ${s.name}`} onClick={() => setConfirmId(s.id)}>
                      <span className="material-symbols-outlined" aria-hidden="true">close</span>
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        className={`sa-btn press-scale ${status === 'saved' ? 'sa-btn--done' : ''} ${status === 'duplicate' ? 'sa-btn--info' : ''}`}
        disabled={!hasCriteria || status === 'saving'}
        title={hasCriteria ? undefined : 'Add search text or a filter to save this search'}
        onClick={onSaveClick}
      >
        <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
        {label}
      </button>
      <span className="sa-sr-only" role="status">{status === 'saved' ? 'Search saved' : status === 'duplicate' ? 'This search is already saved' : ''}</span>
      {error && <p className="sa-error" role="alert">{error}</p>}

      {dialog && (
        <div className="sa-dialog-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setDialog(null) }}>
          <div className="sa-dialog" role="dialog" aria-modal="true" aria-labelledby="sa-dialog-title" onKeyDown={e => { if (e.key === 'Escape') setDialog(null) }}>
            {dialog.mode === 'name' ? (
              <form onSubmit={confirmName}>
                <h2 id="sa-dialog-title">Save this search</h2>
                <p>It'll be saved to your account, so you can run it again from any device.</p>
                <label htmlFor="sa-name">Name</label>
                <input id="sa-name" value={dialog.name} maxLength={120} autoFocus onChange={e => setDialog({ ...dialog, name: e.target.value })} />
                <div className="sa-dialog-actions">
                  <button type="button" className="sa-btn" onClick={() => setDialog(null)}>Cancel</button>
                  <button type="submit" className="sa-dialog-primary" disabled={!dialog.name.trim()}>Save search</button>
                </div>
              </form>
            ) : (
              <>
                <h2 id="sa-dialog-title">Log in to save searches</h2>
                <p>Saved searches are stored on your employer account. Log in and we'll save this search for you straight away.</p>
                <div className="sa-dialog-actions">
                  <button type="button" className="sa-btn" onClick={() => setDialog(null)}>Cancel</button>
                  <button type="button" className="sa-dialog-primary" onClick={goToLogin} autoFocus>Log in</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
