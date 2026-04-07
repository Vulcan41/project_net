export default function ChatHeader({ other }) {
  if (!other) return null
  const initial = other.full_name?.[0]?.toUpperCase() ?? '?'
  return (
    <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
      <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#246e9d', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', flexShrink: 0 }}>
        {other.avatar_url ? <img src={other.avatar_url} alt={other.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initial}
      </div>
      <div>
        <div style={{ fontWeight: '600' }}>{other.full_name}</div>
        <div style={{ fontSize: '0.8rem', color: '#888' }}>@{other.username}</div>
      </div>
    </div>
  )
}
