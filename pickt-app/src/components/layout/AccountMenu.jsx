import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount } from '../../context/AccountContext'
import { logOut } from '../../lib/account'
import './AccountMenu.css'

const ROLE_LABELS = { owner: 'Owner', admin: 'Admin', member: 'Member' }

/** $58k, $1.2m, $950 */
function shortMoney(n) {
  if (!(Number(n) > 0)) return null
  const v = Number(n)
  if (v >= 1e6) return `$${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace(/\.0$/, '')}m`
  if (v >= 1e3) return `$${Math.round(v / 1e3)}k`
  return `$${Math.round(v)}`
}

/**
 * The profile icon's menu. Keyboard: Enter, Space or Down opens it, arrow keys, Home
 * and End move, Escape closes and returns to the icon.
 */
export default function AccountMenu() {
  const navigate = useNavigate()
  const { account, canApprove, isOwner, canSeeEarnings, canSeeBilling } = useAccount()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const focusOnOpen = useRef(false)

  const pending = canApprove ? account?.pendingCount || 0 : 0

  const items = [
    { label: 'Account settings', icon: 'person', go: () => navigate('/account?tab=profile') },
    { label: 'Preferences', icon: 'tune', go: () => navigate('/account?tab=preferences') },
    { label: 'Company & team', icon: 'groups', go: () => navigate('/account?tab=team'), badge: pending },
    ...(canSeeEarnings ? [{ label: 'Earnings & savings', icon: 'attach_money', tone: 'green', go: () => navigate('/earnings'), value: shortMoney(account?.earningsValue) }] : []),
    ...(canSeeBilling ? [{ label: 'Billing & unlocks', icon: 'receipt_long', go: () => navigate('/account?tab=billing') }] : []),
    ...(isOwner ? [{ label: 'Manage access', icon: 'admin_panel_settings', go: () => navigate('/account?tab=access') }] : []),
    ...(account?.isPicktAdmin ? [{ label: 'Pickt admin (Commissions)', icon: 'admin_panel_settings', go: () => navigate('/admin/commissions') }] : []),
    { label: 'Log out', icon: 'logout', separate: true, go: () => logOut() },
  ]

  const menuItems = () => [...(menuRef.current?.querySelectorAll('[role="menuitem"]') || [])]

  useEffect(() => {
    if (!open) return undefined
    if (focusOnOpen.current) {
      focusOnOpen.current = false
      menuItems()[0]?.focus()
    }
    const onOutside = e => { if (!wrapRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  function onTriggerClick(e) {
    // detail is 0 when "clicked" with Enter or Space
    focusOnOpen.current = e.detail === 0
    setOpen(o => !o)
  }

  function onTriggerKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      focusOnOpen.current = true
      if (open) menuItems()[0]?.focus()
      else setOpen(true)
    }
  }

  function onMenuKeyDown(e) {
    const list = menuItems()
    const i = list.indexOf(document.activeElement)
    if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length]?.focus() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length]?.focus() }
    else if (e.key === 'Home') { e.preventDefault(); list[0]?.focus() }
    else if (e.key === 'End') { e.preventDefault(); list[list.length - 1]?.focus() }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); triggerRef.current?.focus() }
    else if (e.key === 'Tab') setOpen(false)
  }

  const name = account?.user?.fullName || account?.user?.email || 'Your account'

  return (
    <div className="am-wrap" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className="am-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="account-menu"
        aria-label={pending > 0 ? `Account menu, ${pending} pending ${pending === 1 ? 'request' : 'requests'}` : 'Account menu'}
        onClick={onTriggerClick}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="topbar-profile-label">Profile</span>
        <span className="topbar-avatar">
          <span className="material-symbols-outlined" aria-hidden="true">person</span>
          {pending > 0 && <span className="am-badge" aria-hidden="true">{pending > 9 ? '9+' : pending}</span>}
        </span>
      </button>

      {open && (
        <div className="am-menu" id="account-menu" role="menu" aria-label="Account" ref={menuRef} onKeyDown={onMenuKeyDown}>
          <div className="am-who" role="presentation">
            <div className="am-name">{name}</div>
            {account?.user?.email && <div className="am-line">{account.user.email}</div>}
            {account?.company?.name && <div className="am-line">{account.company.name}</div>}
            {account?.role && <span className="am-role">{ROLE_LABELS[account.role] || account.role}</span>}
          </div>
          {items.map(item => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className={`am-item ${item.separate ? 'am-item--separate' : ''} ${item.tone === 'green' ? 'am-item--green' : ''}`}
              onClick={() => { setOpen(false); item.go() }}
            >
              <span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span>
              <span className="am-item-label">{item.label}</span>
              {item.badge > 0 && <span className="am-item-badge">{item.badge}</span>}
              {item.value && <span className="am-item-value">{item.value} value</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
