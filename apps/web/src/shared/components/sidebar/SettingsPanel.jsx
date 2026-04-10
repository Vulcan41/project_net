const ITEMS = [
  { id: 'account', label: 'Account' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'danger', label: 'Danger Zone', danger: true },
]

export default function SettingsPanel({ onNavigate }) {
  return (
    <div style={{ padding: '0.5rem', overflowY: 'auto', flex: 1 }}>
      {ITEMS.map(item => (
        <div key={item.id} onClick={() => onNavigate('settings', item.id)}
          style={{ padding: '0.6rem 0.75rem', borderRadius: '6px', cursor: 'pointer', color: item.danger ? 'var(--danger)' : 'var(--text)', fontSize: '0.88rem', transition: 'background 0.1s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          {item.label}
        </div>
      ))}
    </div>
  )
}
