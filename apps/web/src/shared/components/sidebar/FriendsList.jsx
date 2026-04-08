import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@core/supabase.js'
import { useAppContext } from '@app/AppProviders.jsx'

export default function FriendsList({ collapsed }) {
  const [friends, setFriends] = useState([])
  const [unreadCounts, setUnreadCounts] = useState({})
  const [currentUserId, setCurrentUserId] = useState(null)
  const { onlineIds } = useAppContext()
  const navigate = useNavigate()

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)
      await loadFriends(user.id)
      await loadUnreadCounts(user.id)
    }
    init()
  }, [])

  async function loadFriends(userId) {
    const { data, error } = await supabase
      .from('friendships')
      .select(`
        id,
        requester:requester_id (id, username, full_name, avatar_url),
        receiver:receiver_id (id, username, full_name, avatar_url)
      `)
      .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)
      .eq('status', 'accepted')
    if (error) return
    const list = data.map(f => f.requester.id === userId ? f.receiver : f.requester)
    setFriends(list)
  }

  async function loadUnreadCounts(userId) {
    const { data: participants } = await supabase
      .from('conversation_participants')
      .select('conversation_id, last_read_at')
      .eq('user_id', userId)
    if (!participants) return
    const counts = {}
    for (const p of participants) {
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', p.conversation_id)
        .gt('created_at', p.last_read_at || '1970-01-01')
        .neq('sender_id', userId)
      if (count > 0) counts[p.conversation_id] = count
    }
    setUnreadCounts(counts)
  }

  function handleFriendClick(friendId) {
    navigate(`/messages?userId=${friendId}`)
  }

  if (!friends.length) return (
    !collapsed ? <div style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>No friends yet</div> : null
  )

  const online = friends.filter(f => onlineIds.has(f.id))
  const offline = friends.filter(f => !onlineIds.has(f.id))

  return (
    <div style={{ overflowY: 'auto', flex: 1 }}>
      {online.length > 0 && (
        <div>
          {!collapsed && <div style={{ padding: '0.75rem 1rem 0.25rem', fontSize: '0.7rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Online — {online.length}</div>}
          {online.map(f => <FriendRow key={f.id} friend={f} online collapsed={collapsed} onClick={() => handleFriendClick(f.id)} />)}
        </div>
      )}
      {offline.length > 0 && (
        <div>
          {!collapsed && <div style={{ padding: '0.75rem 1rem 0.25rem', fontSize: '0.7rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Offline — {offline.length}</div>}
          {offline.map(f => <FriendRow key={f.id} friend={f} online={false} collapsed={collapsed} onClick={() => handleFriendClick(f.id)} />)}
        </div>
      )}
    </div>
  )
}

function FriendRow({ friend, online, collapsed, onClick }) {
  const initial = friend.full_name?.[0]?.toUpperCase() ?? '?'
  return (
    <div onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: collapsed ? '0.5rem' : '0.4rem 0.75rem', cursor: 'pointer', borderRadius: '6px', margin: '0 0.5rem 0.1rem', transition: 'background 0.1s' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#246e9d', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '0.8rem' }}>
          {friend.avatar_url ? <img src={friend.avatar_url} alt={friend.full_name} crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initial}
        </div>
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: '10px', height: '10px', borderRadius: '50%', background: online ? '#3ba55c' : '#747f8d', border: '2px solid var(--bg-card)' }} />
      </div>
      {!collapsed && (
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{friend.full_name}</div>
          <div style={{ fontSize: '0.72rem', color: online ? '#3ba55c' : 'var(--text-secondary)' }}>{online ? 'Online' : 'Offline'}</div>
        </div>
      )}
    </div>
  )
}
