import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'
import { useViewMode } from './ViewModeContext'
import { accountApi, VIEW_PREF_APPLIED_KEY } from '../lib/account'

// Who's signed in, and what the Owner lets their role do (Account settings → Manage access).
// These only decide what to show: the server makes the real decisions, and sends no
// amounts to anyone without the permission in the first place.
// eslint-disable-next-line react-refresh/only-export-components
export const PERMISSION_KEYS = ['approve', 'unlock', 'record_hire', 'see_commission', 'manage_users', 'see_billing', 'export']
const allowAll = Object.fromEntries(PERMISSION_KEYS.map(k => [k, true]))
const allowNone = Object.fromEntries(PERMISSION_KEYS.map(k => [k, false]))

function shape(perms, extra) {
  return {
    ...extra,
    permissions: perms,
    // Approving requests and seeing placement fees go together
    canApprove: perms.approve,
    canSeeMoney: perms.approve,
    canUnlock: perms.unlock,
    canRecordHire: perms.record_hire,
    canSeeCommission: perms.see_commission,
    canManageUsers: perms.manage_users,
    canSeeBilling: perms.see_billing,
    canExport: perms.export,
  }
}

const AccountContext = createContext(shape(allowNone, { account: null, loading: true, isOwner: false, refresh: () => {} }))

export function AccountProvider({ children }) {
  const { user } = useAuth()
  const { setViewMode } = useViewMode()
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(Boolean(user))

  const refresh = useCallback(async () => {
    if (!user) return null
    try {
      const me = await accountApi('me')
      setAccount(me)
      return me
    } catch {
      return null
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    let cancelled = false
    if (!user) return undefined
    accountApi('me')
      .then(me => {
        if (cancelled) return
        setAccount(me)
        // Their saved results view applies once per login, then the switcher takes over
        try {
          if (!sessionStorage.getItem(VIEW_PREF_APPLIED_KEY)) {
            sessionStorage.setItem(VIEW_PREF_APPLIED_KEY, '1')
            if (me.preferences?.defaultView) setViewMode(me.preferences.defaultView)
          }
        } catch { /* storage blocked */ }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })

    // Keeps the request badge up to date
    const timer = setInterval(() => { accountApi('me').then(me => { if (!cancelled) setAccount(me) }).catch(() => {}) }, 60000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [user, setViewMode])

  const value = useMemo(() => {
    // The local demo mode has no login, and only ever shows demo candidates
    if (!user) return shape(allowAll, { account: null, loading: false, demo: true, isOwner: true, refresh })
    // If the account can't be loaded, show the least: the server would refuse anyway
    const perms = { ...allowNone }
    for (const k of PERMISSION_KEYS) perms[k] = account?.permissions?.[k] === true
    return shape(perms, { account, loading, demo: false, isOwner: account?.isOwner === true, refresh })
  }, [user, account, loading, refresh])

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAccount() {
  return useContext(AccountContext)
}
