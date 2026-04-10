import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { applyTheme } from '@shared/hooks/useTheme.js'
import { supabase } from '@core/supabase.js'

const AppContext = createContext({})

export function useAppContext() {
  return useContext(AppContext)
}

export default function AppProviders({ children }) {
  const [theme, setThemeState] = useState(() => localStorage.getItem('theme') || 'system')
  const [language, setLanguageState] = useState(() => localStorage.getItem('language') || 'en')
  const [profile, setProfile] = useState(null)
  const [onlineIds, setOnlineIds] = useState(new Set())
  const presenceRef = useRef(null)

  useEffect(() => { applyTheme(theme) }, [theme])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, credits')
        .eq('id', user.id)
        .single()
      setProfile(data)

      presenceRef.current = supabase.channel('global-presence', {
        config: { presence: { key: user.id } }
      })
      presenceRef.current
        .on('presence', { event: 'sync' }, () => {
          const state = presenceRef.current.presenceState()
          setOnlineIds(new Set(Object.keys(state)))
        })
        .subscribe(async status => {
          if (status === 'SUBSCRIBED') {
            await presenceRef.current.track({ user_id: user.id, online_at: new Date().toISOString() })
          }
        })
    }
    init()
    return () => { presenceRef.current?.unsubscribe() }
  }, [])

  function setTheme(t) {
    localStorage.setItem('theme', t)
    setThemeState(t)
    applyTheme(t)
  }

  function setLanguage(l) {
    localStorage.setItem('language', l)
    setLanguageState(l)
  }

  async function refreshProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, credits')
      .eq('id', user.id)
      .single()
    setProfile(data)
  }

  return (
    <AppContext.Provider value={{ theme, setTheme, language, setLanguage, profile, setProfile, refreshProfile, onlineIds }}>
      {children}
    </AppContext.Provider>
  )
}
