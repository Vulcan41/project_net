import { useState } from 'react'
import { supabase } from '@core/supabase.js'

export default function RegisterModal({ email, password, onClose }) {
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarFile, setAvatarFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit() {
    if (!username || !fullName) { setError('Username and full name are required'); return }
    setLoading(true)
    setError(null)
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) throw signUpError
      const userId = data.user.id
      let avatarUrl = null
      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop()
        const path = `${userId}/avatar.${ext}`
        await supabase.storage.from('avatars').upload(path, avatarFile, { upsert: true })
        const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
        avatarUrl = pub.publicUrl
      }
      await supabase.from('profiles').upsert({ id: userId, username, full_name: fullName, bio: bio || null, avatar_url: avatarUrl })
      window.location.href = '/verify-email'
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', padding: '2rem', borderRadius: '8px', width: '400px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h2>Create Account</h2>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }} />
        <input placeholder="Full name" value={fullName} onChange={e => setFullName(e.target.value)} style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }} />
        <textarea placeholder="Bio (optional)" value={bio} onChange={e => setBio(e.target.value)} style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }} />
        <input type="file" accept="image/*" onChange={e => setAvatarFile(e.target.files?.[0])} />
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '0.5rem' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={loading} style={{ flex: 1, padding: '0.5rem', background: '#246e9d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            {loading ? 'Creating...' : 'Create account'}
          </button>
        </div>
      </div>
    </div>
  )
}
