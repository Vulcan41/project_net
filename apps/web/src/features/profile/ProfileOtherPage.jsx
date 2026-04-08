import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getProfileById, getFriendshipStatus, sendFriendRequest } from './profileService.js'
import { supabase } from '@core/supabase.js'

export default function ProfileOtherPage() {
  const { userId } = useParams()
  const [profile, setProfile] = useState(null)
  const [friendship, setFriendship] = useState(null)
  const [currentUserId, setCurrentUserId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id)
      if (user?.id === userId) { navigate('/profile'); return }
      const [p, f] = await Promise.all([getProfileById(userId), getFriendshipStatus(userId)])
      setProfile(p)
      setFriendship(f)
      setLoading(false)
    }
    load().catch(e => { setError(e.message); setLoading(false) })
  }, [userId])

  async function handleAddFriend() {
    try {
      await sendFriendRequest(userId)
      setFriendship({ status: 'pending', requester_id: currentUserId })
    } catch (e) { setError(e.message) }
  }

  if (loading) return <div style={{ padding: '2rem' }}>Loading...</div>
  if (error) return <div style={{ padding: '2rem', color: 'red' }}>Error: {error}</div>

  const initial = profile.full_name?.[0]?.toUpperCase() ?? '?'
  const isFriend = friendship?.status === 'accepted'
  const isPending = friendship?.status === 'pending'

  return (
    <div style={{ padding: '2rem', maxWidth: '600px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#246e9d', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '2rem', flexShrink: 0 }}>
          {profile.avatar_url ? <img src={profile.avatar_url} alt={profile.full_name} crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initial}
        </div>
        <div>
          <h1 style={{ margin: 0 }}>{profile.full_name}</h1>
          <div style={{ color: '#888', marginTop: '0.25rem' }}>@{profile.username}</div>
          {profile.bio && <div style={{ marginTop: '0.5rem', color: '#555' }}>{profile.bio}</div>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '1rem' }}>
        {isFriend ? (
          <button onClick={() => navigate('/messages')} style={{ padding: '0.6rem 1.5rem', background: '#246e9d', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Message</button>
        ) : isPending ? (
          <button disabled style={{ padding: '0.6rem 1.5rem', background: '#f0f0f0', color: '#888', border: 'none', borderRadius: '6px' }}>Pending</button>
        ) : (
          <button onClick={handleAddFriend} style={{ padding: '0.6rem 1.5rem', background: '#111', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Add Friend</button>
        )}
      </div>
    </div>
  )
}
