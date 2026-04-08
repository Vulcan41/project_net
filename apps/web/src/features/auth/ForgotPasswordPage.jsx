import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@core/supabase.js'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit() {
    if (!email) return
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })
    if (error) { setError(error.message); setLoading(false); return }
    setSent(true)
    setLoading(false)
  }

  if (sent) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
      <div style={{ background: 'white', padding: '2rem', borderRadius: '8px', width: '360px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📧</div>
        <h2 style={{ marginBottom: '0.5rem' }}>Check your email</h2>
        <p style={{ color: '#888', marginBottom: '1.5rem' }}>We sent a password reset link to <strong>{email}</strong></p>
        <Link to="/" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Back to login</Link>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
      <div style={{ background: 'white', padding: '2rem', borderRadius: '8px', width: '360px', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}>
        <h2 style={{ margin: 0 }}>Reset your password</h2>
        <p style={{ color: '#888', margin: 0, fontSize: '0.9rem' }}>Enter your email and we'll send you a reset link.</p>
        {error && <p style={{ color: 'red', margin: 0 }}>{error}</p>}
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
          style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }} />
        <button onClick={handleSubmit} disabled={loading}
          style={{ padding: '0.75rem', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
          {loading ? 'Sending...' : 'Send reset link'}
        </button>
        <Link to="/" style={{ textAlign: 'center', color: '#888', fontSize: '0.9rem', textDecoration: 'none' }}>Back to login</Link>
      </div>
    </div>
  )
}
