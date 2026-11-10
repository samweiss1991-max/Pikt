import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount } from '../../context/AccountContext'
import { accountApi } from '../../lib/account'
import './NotificationPanel.css'

const ICONS = { unlock_request: 'lock_open', hire_request: 'how_to_reg', request_outcome: 'task_alt', referral_status: 'campaign' }

function timeAgo(date) {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export default function NotificationPanel({ onClose }) {
  const navigate = useNavigate()
  const { account, refresh, demo } = useAccount()
  const [items, setItems] = useState(null)

  useEffect(() => {
    let cancelled = false
    if (demo) return undefined
    accountApi('notifications')
      .then(d => { if (!cancelled) setItems(d.notifications) })
      .catch(() => { if (!cancelled) setItems([]) })
    return () => { cancelled = true }
  }, [demo])

  async function markRead() {
    await accountApi('mark_notifications_read').catch(() => {})
    setItems(prev => (prev || []).map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })))
    refresh()
  }

  function open(n) {
    onClose()
    if (n.link) navigate(n.link)
  }

  const list = demo ? [] : items
  return (
    <>
      <div className="np-backdrop" onClick={onClose} />
      <div className="np-panel reveal-fade-up">
        <div className="np-header">
          <span className="np-title">Notifications</span>
          {account?.unreadNotifications > 0 && <button className="np-mark-read" onClick={markRead}>Mark all read</button>}
        </div>
        <div className="np-list">
          {list === null && <p className="np-text" role="status" style={{ padding: '1rem' }}>Loading…</p>}
          {list?.length === 0 && <p className="np-text" style={{ padding: '1rem' }}>You're all caught up.</p>}
          {list?.map(n => (
            <button key={n.id} type="button" className={`np-item ${n.read_at ? '' : 'np-item--unread'}`} style={{ width: '100%', textAlign: 'left', background: 'none', border: 0, font: 'inherit', cursor: n.link ? 'pointer' : 'default' }} onClick={() => open(n)}>
              <span className="material-symbols-outlined np-icon" aria-hidden="true">{ICONS[n.kind] || 'notifications'}</span>
              <div className="np-content">
                <p className="np-text">{n.title}{n.body ? ` ${n.body}` : ''}</p>
                <span className="np-time">{timeAgo(n.created_at)}</span>
              </div>
              {!n.read_at && <div className="np-unread-dot" />}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
