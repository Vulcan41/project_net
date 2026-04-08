import { useEffect, useState } from 'react'
import { getMyFriends, acceptFriend, rejectFriend, removeFriend } from './friendsService.js'

export default function FriendsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function load() {
    try {
      const result = await getMyFriends()
      setData(result)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) return <div style={{ padding: '2rem' }}>Loading...</div>
  if (error) return <div style={{ padding: '2rem', color: 'red' }}>Error: {error}</div>

  const { userId, friends } = data
  const pending = friends.filter(f => f.status === 'pending' && f.receiver?.id === userId)
  const active = friends.filter(f => f.status === 'accepted')

  function getOther(f) {
    return f.requester?.id === userId ? f.receiver : f.requester
  }

  async function handle(action, id) {
    if (action === 'accept') await acceptFriend(id)
    if (action === 'reject') await rejectFriend(id)
    if (action === 'remove') await removeFriend(id)
    load()
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px' }}>
      <h1 style={{ marginBottom: '2rem' }}>Friends</h1>

      {pending.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1rem', color: '#888', marginBottom: '1rem' }}>Pending Requests</h2>
          {pending.map(f => {
            const other = getOther(f)
            return (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', border: '1px solid #eee', borderRadius: '8px', marginBottom: '0.5rem', background: 'white' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Avatar profile={other} />
                  <div>
                    <div style={{ fontWeight: '500' }}>{other?.full_name}</div>
                    <div style={{ fontSize: '0.8rem', color: '#888' }}>@{other?.username}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => handle('accept', f.id)} style={{ padding: '0.4rem 1rem', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '20px', cursor: 'pointer' }}>Accept</button>
                  <button onClick={() => handle('reject', f.id)} style={{ padding: '0.4rem 1rem', background: '#f0f0f0', color: '#555', border: 'none', borderRadius: '20px', cursor: 'pointer' }}>Reject</button>
                </div>
              </div>
            )
          })}
        </section>
      )}

      <section>
        <h2 style={{ fontSize: '1rem', color: '#888', marginBottom: '1rem' }}>My Friends ({active.length})</h2>
        {active.length === 0 ? (
          <div style={{ border: '2px dashed #ddd', borderRadius: '8px', padding: '2rem', textAlign: 'center', color: '#aaa' }}>No friends yet.</div>
        ) : (
          active.map(f => {
            const other = getOther(f)
            return (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', border: '1px solid #eee', borderRadius: '8px', marginBottom: '0.5rem', background: 'white' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Avatar profile={other} />
                  <div>
                    <div style={{ fontWeight: '500' }}>{other?.full_name}</div>
                    <div style={{ fontSize: '0.8rem', color: '#888' }}>@{other?.username}</div>
                  </div>
                </div>
                <button onClick={() => handle('remove', f.id)} style={{ padding: '0.4rem 1rem', background: '#fff0f0', color: '#e53e3e', border: '1px solid #fecaca', borderRadius: '20px', cursor: 'pointer' }}>Remove</button>
              </div>
            )
          })
        )}
      </section>
    </div>
  )
}

function Avatar({ profile }) {
  const initial = profile?.full_name?.[0]?.toUpperCase() ?? '?'
  return (
    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', flexShrink: 0 }}>
      {profile?.avatar_url ? <img src={profile.avatar_url} alt={profile.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initial}
    </div>
  )
}
