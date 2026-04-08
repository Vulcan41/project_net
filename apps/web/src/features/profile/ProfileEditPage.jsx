import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMyProfile, updateMyProfile } from './profileService.js'

export default function ProfileEditPage() {
  const [form, setForm] = useState({ username: '', fullName: '', bio: '' })
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    getMyProfile().then(p => {
      setForm({ username: p.username ?? '', fullName: p.full_name ?? '', bio: p.bio ?? '' })
      setAvatarPreview(p.avatar_url)
    }).catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [])

  function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      await updateMyProfile({ ...form, avatarFile })
      navigate('/profile')
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ padding: '2rem' }}>Loading...</div>

  const initial = form.fullName?.[0]?.toUpperCase() ?? '?'

  return (
    <div style={{ padding: '2rem', maxWidth: '500px' }}>
      <h1 style={{ marginBottom: '2rem' }}>Edit Profile</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#246e9d', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '1.5rem', flexShrink: 0 }}>
            {avatarPreview ? <img src={avatarPreview} alt="avatar" crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initial}
          </div>
          <input type="file" accept="image/*" onChange={handleAvatarChange} />
        </div>
        <input placeholder="Username" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }} />
        <input placeholder="Full name" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }} />
        <textarea placeholder="Bio" value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', minHeight: '80px' }} />
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={() => navigate('/profile')} style={{ flex: 1, padding: '0.6rem' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: '0.6rem', background: '#246e9d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
