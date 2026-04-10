import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from '@features/auth/authService.js'
import { useAppContext } from '@app/AppProviders.jsx'

export default function Header() {
  const { profile } = useAppContext()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const navigate = useNavigate()

  const [ping, setPing] = useState(null)
  const [connType, setConnType] = useState(null)

  useEffect(() => {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection
    if (conn) {
      setConnType(conn.effectiveType)
      conn.addEventListener('change', () => setConnType(conn.effectiveType))
    }

    async function measurePing() {
      try {
        const start = performance.now()
        await fetch('https://noesisflowapi-production.up.railway.app/api/health', { cache: 'no-store' })
        const ms = Math.round(performance.now() - start)
        setPing(ms)
      } catch {
        setPing(null)
      }
    }

    measurePing()
    const interval = setInterval(measurePing, 30000)
    return () => clearInterval(interval)
  }, [])

  function getQuality() {
    if (ping === null) return { color: '#747f8d', label: 'Offline', bar: 0 }
    if (ping < 80) return { color: '#3ba55c', label: 'Excellent', bar: 3 }
    if (ping < 200) return { color: '#f0a500', label: 'Good', bar: 2 }
    if (ping < 500) return { color: '#e67e22', label: 'Fair', bar: 1 }
    return { color: '#e53e3e', label: 'Poor', bar: 0 }
  }

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  const quality = getQuality()

  return (
    <header style={{ height: '40px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.25rem', background: 'var(--bg-card)', flexShrink: 0, zIndex: 100 }}>
      <img src="/assets/logo_5.png" alt="Noesis" onClick={() => navigate('/home')} style={{ height: '18px', cursor: 'pointer', objectFit: 'contain' }} />
      <input placeholder="Search..." style={{ padding: '0.35rem 1rem', border: '1px solid var(--border)', borderRadius: '20px', width: '240px', outline: 'none', background: 'var(--input-bg)', color: 'var(--text)', fontSize: '0.9rem' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <ConnectionIndicator ping={ping} quality={quality} connType={connType} />
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
              <div onClick={handleSignOut} style={{ padding: '0.7rem 1rem', cursor: 'pointer', color: 'var(--danger)', fontSize: '0.9rem' }}>Log out</div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function ConnectionIndicator({ ping, quality, connType }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', cursor: 'default', height: '16px' }}>
        {[1, 2, 3].map(level => (
          <div key={level} style={{
            width: '4px',
            height: `${4 + level * 4}px`,
            borderRadius: '2px',
            background: quality.bar >= level ? quality.color : 'var(--border)',
            transition: 'background 0.3s'
          }} />
        ))}
      </div>
      {hovered && (
        <div style={{ position: 'absolute', top: '28px', right: '0', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.6rem 0.85rem', boxShadow: 'var(--shadow)', zIndex: 300, whiteSpace: 'nowrap', minWidth: '160px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: quality.color, flexShrink: 0 }} />
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text)' }}>{quality.label}</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            {ping !== null ? `${ping}ms latency` : 'Cannot reach server'}
          </div>
          {connType && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Network: {connType.toUpperCase()}
            </div>
          )}
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.35rem', borderTop: '1px solid var(--border)', paddingTop: '0.35rem' }}>
            Server: Railway API
          </div>
        </div>
      )}
    </div>
  )
}
