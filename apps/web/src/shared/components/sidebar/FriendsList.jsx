import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@core/supabase.js'
import { useAppContext } from '@app/AppProviders.jsx'

export default function FriendsList({ collapsed }) {
  const [friends, setFriends] = useState([])
  const [lastMessageTimes, setLastMessageTimes] = useState({})
  const [currentUserId, setCurrentUserId] = useState(null)
  const { onlineIds } = useAppContext()
  const navigate = useNavigate()
  const msgChannelRef = useRef(null)

  useEffect(() => {
    let userId = null

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      userId = user.id
      setCurrentUserId(user.id)
      await loadFriends(user.id)

      msgChannelRef.current = supabase
        .channel('sidebar-messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async payload => {
          const senderId = payload.new.sender_id
          const newTime = payload.new.created_at

          setLastMessageTimes(prev => ({ ...prev, [senderId]: newTime, [userId]: newTime }))
          setFriends(prev => {
            const updated = [...prev]
            const friendId = senderId === userId ? null : senderId
            if (!friendId) return updated
            const idx = updated.findIndex(f => f.id === friendId)
            if (idx > 0) {
              const [friend] = updated.splice(idx, 1)
              updated.unshift(friend)
            }
            return updated
          })
        })
        .subscribe()
    }
    init()

    return () => {
      msgChannelRef.current?.unsubscribe()
    }
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

    // Fetch last message times
    const { data: participants } = await supabase
      .from('conversation_participants')
      .select('conversation_id, conversations(last_message_at)')
      .eq('user_id', userId)

    // Build a map of otherUserId -> last_message_at
    const { data: otherParticipants } = await supabase
      .from('conversation_participants')
      .select('conversation_id, user_id')
      .neq('user_id', userId)
      .in('conversation_id', participants?.map(p => p.conversation_id) ?? [])

    const convTimeMap = {}
    participants?.forEach(p => {
      convTimeMap[p.conversation_id] = p.conversations?.last_message_at || ''
    })

    const userConvMap = {}
    otherParticipants?.forEach(p => {
      userConvMap[p.user_id] = convTimeMap[p.conversation_id] || ''
    })

    // Sort by last message time descending
    list.sort((a, b) => {
      const aTime = userConvMap[a.id] || ''
      const bTime = userConvMap[b.id] || ''
      return new Date(bTime) - new Date(aTime)
    })

    setFriends(list)
    setLastMessageTimes(userConvMap)
  }

  function handleFriendClick(friendId) {
    navigate(`/messages?userId=${friendId}`)
  }

  if (!friends.length) return (
    <div style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>No friends yet</div>
  )

  return (
    <div style={{ overflowY: 'auto', flex: 1 }}>
      {friends.map(f => (
        <FriendRow key={f.id} friend={f} online={onlineIds.has(f.id)} collapsed={collapsed} onClick={() => handleFriendClick(f.id)} />
      ))}
    </div>
  )
}

function FriendRow({ friend, online, collapsed, onClick }) {
  return (
    <div onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: collapsed ? '0.5rem' : '0.4rem 0.75rem', cursor: 'pointer', borderRadius: '6px', margin: '0 0.5rem 0.1rem', transition: 'background 0.1s' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {friend.avatar_url
            ? <img src={friend.avatar_url} alt={friend.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <img src="/assets/user_icon.png" alt="default" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
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
