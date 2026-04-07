import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from '@features/auth/authService.js'
import { supabase } from '@core/supabase.js'
import { useEffect } from 'react'

export default function Header() {
  const [profile, setProfile] = useState(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('username, avatar_url, credits').eq('id', user.id).single()
      setProfile(data)
    }
    loadProfile()
  }, [])

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <header style={{ height: '60px', borderBottom: '1px solid #ececec', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem', background: 'white', position: 'sticky', top: 0, zIndex: 100 }}>
      <div style={{ fontWeight: 'bold', fontSize: '1.2rem', letterSpacing: '0.05em' }}>NOESIS</div>
      <input placeholder="Search..." style={{ padding: '0.4rem 1rem', border: '1px solid #ddd', borderRadius: '20px', width: '260px', outline: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button onClick={() => navigate('/home')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }} title="Dashboard">🏠</button>
        <button onClick={() => navigate('/messages')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }} title="Messages">💬</button>
        <button onClick={() => navigate('/friends')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }} title="Friends">👥</button>
        <button onClick={() => navigate('/notifications')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }} title="Notifications">🔔</button>
        {profile && <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>{profile.credits ?? 0} ♦</span>}
        <div style={{ position: 'relative' }}>
          <div onClick={() => setDropdownOpen(o => !o)} style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#246e9d', cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (profile?.username?.[0]?.toUpperCase() ?? '?')}
          </div>
          {dropdownOpen && (
            <div style={{ position: 'absolute', right: 0, top: '44px', background: 'white', border: '1px solid #eee', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', minWidth: '160px', zIndex: 200 }}>
              <div onClick={() => { navigate('/profile'); setDropdownOpen(false) }} style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}>Profile</div>
              <div onClick={() => { navigate('/settings'); setDropdownOpen(false) }} style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}>Settings</div>
              <div onClick={handleSignOut} style={{ padding: '0.75rem 1rem', cursor: 'pointer', color: 'red' }}>Log out</div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
