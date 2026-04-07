import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { signIn } from './authService.js'
import RegisterModal from './RegisterModal.jsx'

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showRegister, setShowRegister] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleAction() {
    if (!email || !password) return
    setError(null)
    setLoading(true)
    try {
      if (isLogin) {
        await signIn(email, password)
        navigate('/home')
      } else {
        setShowRegister(true)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
      <div style={{ background: 'white', padding: '2rem', borderRadius: '8px', width: '360px', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}>
        <h1 style={{ textAlign: 'center', margin: 0 }}>noesis</h1>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{isLogin ? 'Log in' : 'Sign up'}</span>
          <input type="checkbox" checked={isLogin} onChange={e => setIsLogin(e.target.checked)} />
        </div>
        {error && <p style={{ color: 'red', margin: 0 }}>{error}</p>}
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }} />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }} />
        <div style={{ textAlign: 'right', marginTop: '-0.5rem' }}>
          <Link to="/forgot-password" style={{ fontSize: '0.85rem', color: '#246e9d', textDecoration: 'none' }}>Forgot password?</Link>
        </div>
        <button onClick={handleAction} disabled={loading} style={{ padding: '0.75rem', background: '#246e9d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
          {loading ? '...' : isLogin ? 'Log in' : 'Sign up'}
        </button>
      </div>
      {showRegister && <RegisterModal email={email} password={password} onClose={() => setShowRegister(false)} />}
    </div>
  )
}
