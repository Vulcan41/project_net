import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from '@features/auth/authService.js'
import { useAppContext } from '@app/AppProviders.jsx'

export default function Header() {
  const { profile, setSettingsOpen } = useAppContext()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <header style={{ height: '40px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.25rem', background: 'var(--bg-card)', flexShrink: 0, zIndex: 100 }}>
      <img src="/assets/logo_5.png" alt="Noesis" onClick={() => navigate('/home')} style={{ height: '18px', cursor: 'pointer', objectFit: 'contain' }} />
      <input placeholder="Search..." style={{ padding: '0.35rem 1rem', border: '1px solid var(--border)', borderRadius: '20px', width: '240px', outline: 'none', background: 'var(--input-bg)', color: 'var(--text)', fontSize: '0.9rem' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <button onClick={() => navigate('/home')} title="Dashboard"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center' }}>
          <img src="/assets/home.png" alt="Home" style={{ width: '18px', height: '18px', opacity: 1 }} />
        </button>
        <button onClick={() => setSettingsOpen(true)} title="Settings"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center' }}>
          <img src="/assets/settings.png" alt="Settings" style={{ width: '18px', height: '18px' }} />
        </button>
        {profile && <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text)' }}>{profile.credits ?? 0} ♦</span>}
        <div style={{ position: 'relative' }}>
          <div onClick={() => setDropdownOpen(o => !o)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.25rem 0.5rem', borderRadius: '20px', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <div style={{ width: '26px', height: '26px', borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <img src="/assets/user_icon.png" alt="default" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
            <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text)', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.username ?? ''}</span>
          </div>
          {dropdownOpen && (
            <div style={{ position: 'absolute', right: 0, top: '38px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', boxShadow: 'var(--shadow)', minWidth: '160px', zIndex: 200 }}>
              <div onClick={() => { navigate('/profile'); setDropdownOpen(false) }} style={{ padding: '0.7rem 1rem', cursor: 'pointer', color: 'var(--text)', borderBottom: '1px solid var(--border)', fontSize: '0.9rem' }}>Profile</div>
              <div onClick={() => { setSettingsOpen(true); setDropdownOpen(false) }} style={{ padding: '0.7rem 1rem', cursor: 'pointer', color: 'var(--text)', borderBottom: '1px solid var(--border)', fontSize: '0.9rem' }}>Settings</div>
              <div onClick={handleSignOut} style={{ padding: '0.7rem 1rem', cursor: 'pointer', color: 'var(--danger)', fontSize: '0.9rem' }}>Log out</div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
