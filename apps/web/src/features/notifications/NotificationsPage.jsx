import { useEffect, useState } from 'react'
import { getMyNotifications, markAsRead, markAllAsRead } from './notificationsService.js'

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function load() {
    try {
      const data = await getMyNotifications()
      setNotifications(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleMarkAllRead() {
    await markAllAsRead()
    load()
  }

  async function handleMarkRead(id) {
    await markAsRead(id)
    load()
  }

  if (loading) return <div style={{ padding: '2rem' }}>Loading...</div>
  if (error) return <div style={{ padding: '2rem', color: 'red' }}>Error: {error}</div>

  const unread = notifications.filter(n => !n.read).length

  return (
    <div style={{ padding: '2rem', maxWidth: '700px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0 }}>Notifications {unread > 0 && <span style={{ fontSize: '0.9rem', background: '#246e9d', color: 'white', borderRadius: '20px', padding: '0.2rem 0.6rem', marginLeft: '0.5rem' }}>{unread}</span>}</h1>
        {unread > 0 && <button onClick={handleMarkAllRead} style={{ padding: '0.4rem 1rem', background: '#f0f0f0', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Mark all as read</button>}
      </div>

      {notifications.length === 0 ? (
        <div style={{ border: '2px dashed #ddd', borderRadius: '8px', padding: '2rem', textAlign: 'center', color: '#aaa' }}>No notifications yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {notifications.map(n => (
            <div key={n.id} onClick={() => !n.read && handleMarkRead(n.id)}
              style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '1rem', border: '1px solid #eee', borderRadius: '8px', background: n.read ? 'white' : '#f0f7ff', cursor: n.read ? 'default' : 'pointer' }}>
              <Avatar profile={n.sender} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.95rem' }}>{n.link_title || n.message_type || n.type}</div>
                <div style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '0.25rem' }}>{new Date(n.created_at).toLocaleString()}</div>
              </div>
              {!n.read && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#246e9d', flexShrink: 0, marginTop: '0.4rem' }} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Avatar({ profile }) {
  const initial = profile?.full_name?.[0]?.toUpperCase() ?? '?'
  return (
    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#246e9d', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', flexShrink: 0 }}>
      {profile?.avatar_url ? <img src={profile.avatar_url} alt={profile?.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initial}
    </div>
  )
}
