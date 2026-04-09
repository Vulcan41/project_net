import { useAppContext } from '@app/AppProviders.jsx'

export default function ChatHeader({ other }) {
  const { onlineIds } = useAppContext()
  if (!other) return null

  const isOnline = onlineIds?.has(other.id)
  const initial = other.full_name?.[0]?.toUpperCase() ?? '?'

  return (
    <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{ width: '38px', height: '38px', borderRadius: '50%', overflow: 'hidden', background: '#e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {other.avatar_url
            ? <img src={other.avatar_url} alt={other.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" />
            : <img src="/assets/user_icon.png" alt="default" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        </div>
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: '10px', height: '10px', borderRadius: '50%', background: isOnline ? '#3ba55c' : '#747f8d', border: '2px solid var(--bg-card)' }} />
      </div>
      <div>
        <div style={{ fontWeight: '600', fontSize: '0.95rem', color: 'var(--text)' }}>{other.full_name}</div>
        <div style={{ fontSize: '0.75rem', color: isOnline ? '#3ba55c' : 'var(--text-secondary)', marginTop: '1px' }}>{isOnline ? 'Online' : 'Offline'}</div>
      </div>
    </div>
  )
}
