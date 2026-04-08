import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '@core/supabase.js'

export default function VerifyEmailPage() {
  const [status, setStatus] = useState('checking')
  const navigate = useNavigate()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setStatus('verified')
        setTimeout(() => navigate('/home'), 2000)
      }
    })
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { setStatus('verified'); setTimeout(() => navigate('/home'), 2000) }
      else setStatus('pending')
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
      <div style={{ background: 'white', padding: '2rem', borderRadius: '8px', width: '360px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}>
        {status === 'checking' && <p style={{ color: '#888' }}>Checking verification...</p>}
        {status === 'pending' && (
          <>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📧</div>
            <h2 style={{ marginBottom: '0.5rem' }}>Check your email</h2>
            <p style={{ color: '#888', marginBottom: '1.5rem' }}>We sent you a verification link. Click it to activate your account.</p>
            <Link to="/" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Back to login</Link>
          </>
        )}
        {status === 'verified' && (
          <>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>✅</div>
            <h2 style={{ marginBottom: '0.5rem' }}>Email verified!</h2>
            <p style={{ color: '#888' }}>Redirecting you to the app...</p>
          </>
        )}
      </div>
    </div>
  )
}
