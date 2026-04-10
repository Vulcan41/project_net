import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { getSession } from '@features/auth/authService.js'
import LoginPage from '@features/auth/LoginPage.jsx'
import Layout from './Layout.jsx'
import DashboardPage from '@features/dashboard/DashboardPage.jsx'
import FriendsPage from '@features/friends/FriendsPage.jsx'
import NotificationsPage from '@features/notifications/NotificationsPage.jsx'
import ProfilePage from '@features/profile/ProfilePage.jsx'
import ProfileEditPage from '@features/profile/ProfileEditPage.jsx'
import ProfileOtherPage from '@features/profile/ProfileOtherPage.jsx'
import MessagesPage from '@features/messages/MessagesPage.jsx'
import SettingsPage from '@features/settings/SettingsPage.jsx'
import ForgotPasswordPage from '@features/auth/ForgotPasswordPage.jsx'
import ResetPasswordPage from '@features/auth/ResetPasswordPage.jsx'
import VerifyEmailPage from '@features/auth/VerifyEmailPage.jsx'

function ProtectedRoute({ children }) {
  const [checking, setChecking] = useState(true)
  const [authed, setAuthed] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    getSession().then(session => {
      setAuthed(!!session)
      setChecking(false)
      if (!session) navigate('/')
    })
  }, [])

  if (checking) return null
  return authed ? <Layout>{children}</Layout> : null
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/home" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/project/:id" element={<ProtectedRoute><div style={{ padding: '2rem' }}><h1>Project coming soon</h1></div></ProtectedRoute>} />
      <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
      <Route path="/friends" element={<ProtectedRoute><FriendsPage /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path="/profile/edit" element={<ProtectedRoute><ProfileEditPage /></ProtectedRoute>} />
      <Route path="/profile/:userId" element={<ProtectedRoute><ProfileOtherPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="/settings/:tab" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}
