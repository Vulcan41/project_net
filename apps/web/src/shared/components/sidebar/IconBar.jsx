export default function IconBar({ activeSection, onSelect }) {
  const icons = [
    { id: 'friends', icon: '/assets/chat_2.png', iconSelected: '/assets/chat_2.png', label: 'Direct Messages' },
    { id: 'notifications', icon: '/assets/notifications.png', iconSelected: '/assets/notifications.png', label: 'Notifications' },
  ]

  return (
    <div style={{ width: '52px', background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '0.75rem', gap: '0.25rem', flexShrink: 0 }}>
      {icons.map(icon => {
        const isActive = activeSection === icon.id
        return (
          <button key={icon.id} onClick={() => onSelect(icon.id)} title={icon.label}
            style={{ width: '34px', height: '34px', borderRadius: isActive ? '12px' : '50%', background: isActive ? 'var(--btn-primary)' : 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-radius 0.2s, background 0.2s' }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderRadius = '12px' }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderRadius = '50%' }}>
            <img src={isActive ? icon.iconSelected : icon.icon} alt={icon.label} style={{ width: '18px', height: '18px' }} />
          </button>
        )
      })}
    </div>
  )
}

