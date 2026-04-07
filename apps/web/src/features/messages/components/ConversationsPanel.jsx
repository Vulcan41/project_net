export default function ConversationsPanel({ conversations, activeId, onSelect }) {
  return (
    <div style={{ width: '280px', borderRight: '1px solid #eee', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto' }}>
      <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #eee' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Messages</h2>
      </div>
      {conversations.length === 0 ? (
        <div style={{ padding: '2rem', color: '#aaa', textAlign: 'center', fontSize: '0.9rem' }}>No conversations yet.</div>
      ) : (
        conversations.map(conv => {
          const other = conv.other
          const initial = other?.full_name?.[0]?.toUpperCase() ?? '?'
          const isActive = conv.id === activeId
          const lastMsg = conv.lastMessage?.content
          return (
            <div key={conv.id} onClick={() => onSelect(conv)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1.25rem', cursor: 'pointer', background: isActive ? '#f0f7ff' : 'white', borderBottom: '1px solid #f5f5f5' }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#fafafa' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'white' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#246e9d', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', flexShrink: 0 }}>
                {other?.avatar_url ? <img src={other.avatar_url} alt={other.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initial}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: '500', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{other?.full_name ?? 'Unknown'}</div>
                {lastMsg && <div style={{ fontSize: '0.8rem', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '0.1rem' }}>{lastMsg}</div>}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
