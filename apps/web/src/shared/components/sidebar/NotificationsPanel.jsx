import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@core/supabase.js'

export default function NotificationsPanel() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('notifications')
        .select('id, type, read, created_at, friendship_id, project_id, sender:sender_id (id, username, full_name, avatar_url)')
        .eq('receiver_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)
      setNotifications(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  async function handleMarkRead(id) {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  async function handleMarkAllRead() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('notifications').update({ read: true }).eq('receiver_id', user.id).eq('read', false)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  if (loading) return <div style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Loading...</div>

  const unread = notifications.filter(n => !n.read).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {unread > 0 && (
        <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={handleMarkAllRead}
            style={{ fontSize: '0.75rem', background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer' }}>
            Mark all read
          </button>
        </div>
      )}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {notifications.length === 0 ? (
          <div style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>No notifications</div>
        ) : notifications.map(n => (
          <div key={n.id} onClick={() => !n.read && handleMarkRead(n.id)}
            style={{ padding: '0.65rem 0.75rem', borderBottom: '1px solid var(--border)', background: n.read ? 'transparent' : 'var(--bg-secondary)', cursor: n.read ? 'default' : 'pointer', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.7rem', fontWeight: 'bold', flexShrink: 0 }}>
              {n.sender?.avatar_url ? <img src={n.sender.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" /> : (n.sender?.username?.[0]?.toUpperCase() ?? '?')}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text)', lineHeight: 1.3 }}>{n.type}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>{new Date(n.created_at).toLocaleDateString()}</div>
            </div>
            {!n.read && <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: '0.3rem' }} />}
          </div>
        ))}
      </div>
    </div>
  )
}
