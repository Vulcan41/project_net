export default function IconBar({ activeSection, onSelect }) {
  const icons = [
    { id: 'home', icon: '/assets/home.png', iconSelected: '/assets/home_selected.png', label: 'Dashboard' },
    { id: 'friends', icon: '/assets/chat_1.png', iconSelected: '/assets/chat_2.png', label: 'Direct Messages' },
    { id: 'notifications', icon: '/assets/notifications_1.png', iconSelected: '/assets/notifications.png', label: 'Notifications' },
    { id: 'settings', icon: '/assets/settings.png', iconSelected: '/assets/settings_selected.png', label: 'Settings' },
  ]

  return (
    <div style={{ width: '52px', background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '0.75rem', gap: '0.25rem', flexShrink: 0 }}>
      {icons.map(icon => {
        const isActive = activeSection === icon.id
        const imgSrc = isActive && icon.iconSelected ? icon.iconSelected : icon.icon
        return (
          <button key={icon.id} onClick={() => onSelect(icon.id)} title={icon.label}
            style={{ width: '36px', height: '36px', borderRadius: isActive ? '12px' : '50%', background: isActive ? 'var(--icon-active-bg)' : 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-radius 0.2s, background 0.2s' }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderRadius = '12px' }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderRadius = '50%' }}>
            <img src={imgSrc} alt={icon.label} style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
          </button>
        )
      })}
    </div>
  )
}
