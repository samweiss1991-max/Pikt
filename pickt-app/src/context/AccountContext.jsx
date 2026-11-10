import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'
import { useViewMode } from './ViewModeContext'
import { accountApi, VIEW_PREF_APPLIED_KEY } from '../lib/account'

// Who's signed in, and what their role lets them do. These only decide what to show:
// the server makes the real decisions, and sends a Member no amounts in the first place.
const AccountContext = createContext({ account: null, loading: true, canApprove: false, canSeeMoney: false, refresh: () => {} })

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
    if (!user) return { account: null, loading: false, demo: true, canApprove: true, canSeeMoney: true, refresh }
    return {
      account,
      loading,
      demo: false,
      // If the account can't be loaded, show the least: the server would refuse anyway
      canApprove: Boolean(account?.canApprove),
      canSeeMoney: Boolean(account?.canSeeMoney),
      refresh,
    }
  }, [user, account, loading, refresh])

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAccount() {
  return useContext(AccountContext)
}
