import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMySettings, updatePreferences, updatePassword, updateEmail, deleteAccount } from './settingsService.js'
import { signOut } from '@features/auth/authService.js'
import { useAppContext } from '@app/AppProviders.jsx'

const TABS = ['Account', 'Preferences', 'Appearance', 'Privacy', 'Danger Zone']

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('Account')
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMySettings().then(setSettings).finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text)' }}>Loading...</div>

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg)' }}>
      <aside style={{ width: '200px', borderRight: '1px solid var(--border)', padding: '1.5rem 1rem', flexShrink: 0 }}>
        <h2 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.05em' }}>Settings</h2>
        {TABS.map(tab => (
          <div key={tab} onClick={() => setActiveTab(tab)}
            style={{ padding: '0.6rem 0.75rem', borderRadius: '6px', cursor: 'pointer', marginBottom: '0.25rem', background: activeTab === tab ? 'var(--bg-secondary)' : 'transparent', fontWeight: activeTab === tab ? '500' : 'normal', color: tab === 'Danger Zone' ? 'var(--danger)' : 'var(--text)' }}>
            {tab}
          </div>
        ))}
      </aside>
      <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        {activeTab === 'Account' && <AccountTab settings={settings} onUpdate={setSettings} />}
        {activeTab === 'Preferences' && <PreferencesTab settings={settings} onUpdate={setSettings} />}
        {activeTab === 'Appearance' && <AppearanceTab />}
        {activeTab === 'Privacy' && <PrivacyTab settings={settings} onUpdate={setSettings} />}
        {activeTab === 'Danger Zone' && <DangerTab />}
      </main>
    </div>
  )
}

function AccountTab({ settings, onUpdate }) {
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  async function handleEmailChange() {
    if (!newEmail) return
    setSaving(true); setError(null); setMessage(null)
    try {
      await updateEmail(newEmail)
      setMessage('Verification email sent to ' + newEmail)
      setNewEmail('')
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  async function handlePasswordChange() {
    if (!newPassword || newPassword !== confirm) { setError('Passwords do not match'); return }
    setSaving(true); setError(null); setMessage(null)
    try {
      await updatePassword(newPassword)
      setMessage('Password updated successfully')
      setNewPassword(''); setConfirm('')
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  return (
    <div style={{ maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <h1 style={{ margin: 0, color: 'var(--text)' }}>Account</h1>
      {message && <p style={{ color: 'green', margin: 0 }}>{message}</p>}
      {error && <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p>}

      <section style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '1rem' }}>Profile</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>Current email: <strong style={{ color: 'var(--text)' }}>{settings?.email}</strong></p>
        <button onClick={() => navigate('/profile/edit')} style={{ padding: '0.6rem 1.5rem', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', alignSelf: 'flex-start' }}>Edit Profile</button>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '1rem' }}>Change Email</h3>
        <input placeholder="New email address" value={newEmail} onChange={e => setNewEmail(e.target.value)}
          style={{ padding: '0.5rem', border: '1px solid var(--input-border)', borderRadius: '4px', background: 'var(--input-bg)', color: 'var(--text)' }} />
        <button onClick={handleEmailChange} disabled={saving}
          style={{ padding: '0.6rem 1.5rem', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', alignSelf: 'flex-start' }}>
          {saving ? 'Sending...' : 'Send verification'}
        </button>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '1rem' }}>Change Password</h3>
        <input type="password" placeholder="New password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
          style={{ padding: '0.5rem', border: '1px solid var(--input-border)', borderRadius: '4px', background: 'var(--input-bg)', color: 'var(--text)' }} />
        <input type="password" placeholder="Confirm password" value={confirm} onChange={e => setConfirm(e.target.value)}
          style={{ padding: '0.5rem', border: '1px solid var(--input-border)', borderRadius: '4px', background: 'var(--input-bg)', color: 'var(--text)' }} />
        <button onClick={handlePasswordChange} disabled={saving}
          style={{ padding: '0.6rem 1.5rem', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', alignSelf: 'flex-start' }}>
          {saving ? 'Saving...' : 'Change Password'}
        </button>
      </section>
    </div>
  )
}

function PreferencesTab({ settings, onUpdate }) {
  const { setTheme, setLanguage } = useAppContext()
  const [form, setForm] = useState({
    theme: settings?.theme || 'system',
    language: settings?.language || 'en',
    emailNotifs: settings?.email_notifs ?? true
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  async function handleSave() {
    setSaving(true)
    try {
      await updatePreferences({ ...form, profileVisibility: settings?.profile_visibility, allowFriendRequests: settings?.allow_friend_requests, allowMessages: settings?.allow_messages })
      setTheme(form.theme)
      setLanguage(form.language)
      onUpdate(prev => ({ ...prev, theme: form.theme, language: form.language, email_notifs: form.emailNotifs }))
      setMessage('Preferences saved')
    } catch (e) { setMessage('Error: ' + e.message) } finally { setSaving(false) }
  }

  const selectStyle = { padding: '0.5rem', border: '1px solid var(--input-border)', borderRadius: '4px', background: 'var(--input-bg)', color: 'var(--text)', width: '100%' }

  return (
    <div style={{ maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <h1 style={{ margin: 0, color: 'var(--text)' }}>Preferences</h1>
      {message && <p style={{ color: 'green', margin: 0 }}>{message}</p>}

      <section style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '1rem' }}>Theme</h3>
        <select value={form.theme} onChange={e => setForm(f => ({ ...f, theme: e.target.value }))} style={selectStyle}>
          <option value="system">System default</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '1rem' }}>Language</h3>
        <select value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))} style={selectStyle}>
          <option value="en">English</option>
          <option value="el">Ελληνικά</option>
        </select>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '1rem' }}>Notifications</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', color: 'var(--text)' }}>
          <input type="checkbox" checked={form.emailNotifs} onChange={e => setForm(f => ({ ...f, emailNotifs: e.target.checked }))} />
          Receive email notifications
        </label>
      </section>

      <button onClick={handleSave} disabled={saving}
        style={{ padding: '0.6rem 1.5rem', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', alignSelf: 'flex-start' }}>
        {saving ? 'Saving...' : 'Save preferences'}
      </button>
    </div>
  )
}

function PrivacyTab({ settings, onUpdate }) {
  const [form, setForm] = useState({
    profileVisibility: settings?.profile_visibility || 'public',
    allowFriendRequests: settings?.allow_friend_requests || 'everyone',
    allowMessages: settings?.allow_messages || 'everyone'
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  async function handleSave() {
    setSaving(true)
    try {
      await updatePreferences({ theme: settings?.theme, language: settings?.language, emailNotifs: settings?.email_notifs, ...form })
      onUpdate(prev => ({ ...prev, profile_visibility: form.profileVisibility, allow_friend_requests: form.allowFriendRequests, allow_messages: form.allowMessages }))
      setMessage('Privacy settings saved')
    } catch (e) { setMessage('Error: ' + e.message) } finally { setSaving(false) }
  }

  const selectStyle = { padding: '0.5rem', border: '1px solid var(--input-border)', borderRadius: '4px', background: 'var(--input-bg)', color: 'var(--text)', width: '100%' }

  return (
    <div style={{ maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <h1 style={{ margin: 0, color: 'var(--text)' }}>Privacy</h1>
      {message && <p style={{ color: 'green', margin: 0 }}>{message}</p>}

      <section style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '1rem' }}>Profile visibility</h3>
        <select value={form.profileVisibility} onChange={e => setForm(f => ({ ...f, profileVisibility: e.target.value }))} style={selectStyle}>
          <option value="public">Public — anyone can view</option>
          <option value="friends">Friends only</option>
          <option value="private">Private — only me</option>
        </select>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '1rem' }}>Friend requests</h3>
        <select value={form.allowFriendRequests} onChange={e => setForm(f => ({ ...f, allowFriendRequests: e.target.value }))} style={selectStyle}>
          <option value="everyone">Everyone can send requests</option>
          <option value="nobody">Nobody</option>
        </select>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '1rem' }}>Messages</h3>
        <select value={form.allowMessages} onChange={e => setForm(f => ({ ...f, allowMessages: e.target.value }))} style={selectStyle}>
          <option value="everyone">Everyone can message me</option>
          <option value="friends">Friends only</option>
          <option value="nobody">Nobody</option>
        </select>
      </section>

      <button onClick={handleSave} disabled={saving}
        style={{ padding: '0.6rem 1.5rem', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', alignSelf: 'flex-start' }}>
        {saving ? 'Saving...' : 'Save privacy settings'}
      </button>
    </div>
  )
}

function AppearanceTab() {
  const [accentColor, setAccentColor] = useState('#000000')

  useEffect(() => {
    document.documentElement.style.setProperty('--btn-primary', '#000000')
  }, [])

  function handleAccent(val) {
    setAccentColor(val)
    document.documentElement.style.setProperty('--btn-primary', val)
  }

  return (
    <div style={{ maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <h1 style={{ margin: 0, color: 'var(--text)' }}>Appearance</h1>
      <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.85rem' }}>
        Changes apply instantly. Database persistence coming soon.
      </p>

      <section style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <label style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text)' }}>Accent Color</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: accentColor, border: '2px solid var(--border)', flexShrink: 0 }} />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{accentColor}</span>
        </div>
        <div style={{ position: 'relative', height: '28px', borderRadius: '999px', overflow: 'hidden', cursor: 'crosshair', background: 'linear-gradient(to right, #ff0000, #ff8800, #ffff00, #00cc00, #0088ff, #8800ff, #ff0088)' }}
          onClick={e => {
            const rect = e.currentTarget.getBoundingClientRect()
            const x = e.clientX - rect.left
            const pct = x / rect.width
            const canvas = document.createElement('canvas')
            canvas.width = 100; canvas.height = 1
            const ctx = canvas.getContext('2d')
            const grad = ctx.createLinearGradient(0, 0, 100, 0)
            grad.addColorStop(0, '#ff0000')
            grad.addColorStop(1/6, '#ff8800')
            grad.addColorStop(2/6, '#ffff00')
            grad.addColorStop(3/6, '#00cc00')
            grad.addColorStop(4/6, '#0088ff')
            grad.addColorStop(5/6, '#8800ff')
            grad.addColorStop(1, '#ff0088')
            ctx.fillStyle = grad
            ctx.fillRect(0, 0, 100, 1)
            const [r, g, b] = ctx.getImageData(Math.floor(pct * 99), 0, 1, 1).data
            handleAccent(`rgb(${r},${g},${b})`)
          }}
          onMouseMove={e => {
            const rect = e.currentTarget.getBoundingClientRect()
            const x = e.clientX - rect.left
            const pct = x / rect.width
            const canvas = document.createElement('canvas')
            canvas.width = 100; canvas.height = 1
            const ctx = canvas.getContext('2d')
            const grad = ctx.createLinearGradient(0, 0, 100, 0)
            grad.addColorStop(0, '#ff0000')
            grad.addColorStop(1/6, '#ff8800')
            grad.addColorStop(2/6, '#ffff00')
            grad.addColorStop(3/6, '#00cc00')
            grad.addColorStop(4/6, '#0088ff')
            grad.addColorStop(5/6, '#8800ff')
            grad.addColorStop(1, '#ff0088')
            ctx.fillStyle = grad
            ctx.fillRect(0, 0, 100, 1)
            const [r, g, b] = ctx.getImageData(Math.floor(pct * 99), 0, 1, 1).data
            e.currentTarget.style.cursor = `crosshair`
          }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)', pointerEvents: 'none', letterSpacing: '0.05em' }}>
            drag to pick color
          </div>
        </div>
        <input type="range" min="0" max="360" defaultValue="210"
          onChange={e => {
            const h = e.target.value
            const color = `hsl(${h}, 70%, 45%)`
            handleAccent(color)
          }}
          style={{ width: '100%', height: '4px', cursor: 'pointer', accentColor: accentColor }} />
        <button onClick={() => handleAccent('#000000')}
          style={{ alignSelf: 'flex-start', padding: '0.35rem 0.85rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer' }}>
          Reset to default
        </button>
      </section>
    </div>
  )
}

function DangerTab() {
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  async function handleDelete() {
    if (confirm !== 'DELETE') { setError('Type DELETE to confirm'); return }
    setLoading(true)
    try {
      await deleteAccount()
      await signOut()
      navigate('/')
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  return (
    <div style={{ maxWidth: '480px' }}>
      <h1 style={{ marginBottom: '1.5rem', color: 'var(--danger)' }}>Danger Zone</h1>
      <div style={{ border: '1px solid var(--danger)', borderRadius: '8px', padding: '1.5rem', background: 'rgba(229,62,62,0.05)' }}>
        <h3 style={{ margin: '0 0 0.5rem', color: 'var(--danger)' }}>Delete Account</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>This action is permanent and cannot be undone.</p>
        {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
        <input placeholder='Type DELETE to confirm' value={confirm} onChange={e => setConfirm(e.target.value)}
          style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--danger)', borderRadius: '4px', marginBottom: '1rem', boxSizing: 'border-box', background: 'var(--input-bg)', color: 'var(--text)' }} />
        <button onClick={handleDelete} disabled={loading}
          style={{ padding: '0.6rem 1.5rem', background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
          {loading ? 'Deleting...' : 'Delete My Account'}
        </button>
      </div>
    </div>
  )
}