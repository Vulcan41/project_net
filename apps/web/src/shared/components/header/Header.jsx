import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from '@features/auth/authService.js'
import { supabase } from '@core/supabase.js'

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
    <header style={{ height: '40px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.25rem', background: 'var(--bg-card)', flexShrink: 0, zIndex: 100 }}>
      <div onClick={() => navigate('/home')} style={{ fontWeight: '800', fontSize: '1.1rem', letterSpacing: '0.08em', cursor: 'pointer', color: 'var(--text)' }}>NOESIS</div>
      <input placeholder="Search..." style={{ padding: '0.35rem 1rem', border: '1px solid var(--border)', borderRadius: '20px', width: '240px', outline: 'none', background: 'var(--input-bg)', color: 'var(--text)', fontSize: '0.9rem' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <button onClick={() => navigate('/home')} title="Dashboard"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center' }}>
          <img src="/assets/home_icon.png" alt="Home" style={{ width: '18px', height: '18px', opacity: 1 }} />
        </button>
        <button onClick={() => navigate('/notifications')} title="Notifications"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center' }}>
          <img src="/assets/2222.png" alt="Notifications" style={{ width: '18px', height: '18px', opacity: 1 }} />
        </button>
        {profile && <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text)' }}>{profile.credits ?? 0} ♦</span>}
        <div style={{ position: 'relative' }}>
          <div onClick={() => setDropdownOpen(o => !o)} style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'var(--accent)', cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '0.85rem' }}>
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (profile?.username?.[0]?.toUpperCase() ?? '?')}
          </div>
          {dropdownOpen && (
            <div style={{ position: 'absolute', right: 0, top: '42px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', boxShadow: 'var(--shadow)', minWidth: '160px', zIndex: 200 }}>
              <div onClick={() => { navigate('/profile'); setDropdownOpen(false) }} style={{ padding: '0.7rem 1rem', cursor: 'pointer', color: 'var(--text)', borderBottom: '1px solid var(--border)', fontSize: '0.9rem' }}>Profile</div>
              <div onClick={() => { navigate('/settings'); setDropdownOpen(false) }} style={{ padding: '0.7rem 1rem', cursor: 'pointer', color: 'var(--text)', borderBottom: '1px solid var(--border)', fontSize: '0.9rem' }}>Settings</div>
              <div onClick={handleSignOut} style={{ padding: '0.7rem 1rem', cursor: 'pointer', color: 'var(--danger)', fontSize: '0.9rem' }}>Log out</div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
