export default function IconBar({ activeSection, onSelect }) {
  const icons = [
    { id: 'friends', icon: '/assets/1111.png', label: 'Direct Messages' },
    { id: 'notifications', icon: '/assets/2222.png', label: 'Notifications' },
  ]

  return (
    <div style={{ width: '52px', background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '0.75rem', gap: '0.25rem', flexShrink: 0 }}>
      {icons.map(icon => (
        <button key={icon.id} onClick={() => onSelect(icon.id)} title={icon.label}
          style={{ width: '36px', height: '36px', borderRadius: activeSection === icon.id ? '12px' : '50%', background: activeSection === icon.id ? 'var(--accent)' : 'var(--bg-card)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-radius 0.2s, background 0.2s' }}
          onMouseEnter={e => { if (activeSection !== icon.id) e.currentTarget.style.borderRadius = '12px' }}
          onMouseLeave={e => { if (activeSection !== icon.id) e.currentTarget.style.borderRadius = '50%' }}>
          <img src={icon.icon} alt={icon.label} style={{ width: '20px', height: '20px' }} />
        </button>
      ))}
    </div>
  )
}
