import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@core/supabase.js'
import { getMessages, sendMessage, getOrCreateConversation, markConversationRead } from './messagesService.js'
import ChatHeader from './components/ChatHeader.jsx'
import ChatHistory from './components/ChatHistory.jsx'
import Composer from './components/Composer.jsx'

export default function MessagesPage() {
  const [conv, setConv] = useState(null)
  const [other, setOther] = useState(null)
  const [messages, setMessages] = useState([])
  const [pendingMessages, setPendingMessages] = useState([])
  const [currentUserId, setCurrentUserId] = useState(null)
  const [currentUserProfile, setCurrentUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [oldestMessageDate, setOldestMessageDate] = useState(null)
  const [searchParams] = useSearchParams()
  const realtimeRef = useRef(null)

  useEffect(() => {
    async function init() {
      setMessages([])
      setPendingMessages([])
      setOther(null)
      setConv(null)
      setLoading(true)

      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id)
      const { data: myProfile } = await supabase.from('profiles').select('id, username, full_name, avatar_url').eq('id', user.id).single()
      setCurrentUserProfile(myProfile)

      const targetUserId = searchParams.get('userId')
      if (!targetUserId) { setLoading(false); return }

      const { data: otherProfile } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .eq('id', targetUserId)
        .single()
      setOther(otherProfile)

      const convId = await getOrCreateConversation(targetUserId)
      if (!convId) { setLoading(false); return }
      setConv({ id: convId })

      const msgs = await getMessages(convId, { limit: 50 })
      setMessages(msgs)
      setHasMore(msgs.length === 50)
      setOldestMessageDate(msgs[0]?.created_at || null)
      await markConversationRead(convId)
      subscribeToMessages(convId)
      setLoading(false)
    }
    init()
    return () => realtimeRef.current?.unsubscribe()
  }, [searchParams.get('userId')])

  function subscribeToMessages(conversationId) {
    realtimeRef.current?.unsubscribe()
    realtimeRef.current = supabase
      .channel(`messages:${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, async payload => {
        const { data } = await supabase
          .from('messages')
          .select('id, content, message_type, created_at, sender_id, link_url, link_title, link_description, link_image, message_attachments (id, object_key, file_name, mime_type, size_bytes)')
          .eq('id', payload.new.id)
          .single()
        if (data) {
          setMessages(prev => prev.find(m => m.id === data.id) ? prev : [...prev, data])
          setPendingMessages([])
        }
      })
      .subscribe()
  }

  async function loadMore() {
    if (!conv || !hasMore || loadingMore || !oldestMessageDate) return
    setLoadingMore(true)
    const older = await getMessages(conv.id, { limit: 50, before: oldestMessageDate })
    if (older.length > 0) {
      setMessages(prev => [...older, ...prev])
      setOldestMessageDate(older[0].created_at)
      setHasMore(older.length === 50)
    } else {
      setHasMore(false)
    }
    setLoadingMore(false)
  }

  async function handleSend({ content, attachments, onProgress }) {
    if (!conv) return
    setSending(true)
    const tempId = Date.now().toString()
    const optimistic = { id: `pending-${tempId}`, tempId, content, sender_id: currentUserId, created_at: new Date().toISOString(), pending: true, message_attachments: [] }
    setPendingMessages(prev => [...prev, optimistic])
    try {
      await sendMessage({ conversationId: conv.id, content, attachments, onProgress })
    } catch (e) {
      console.error('Send failed:', e)
      setPendingMessages(prev => prev.filter(p => p.tempId !== tempId))
    } finally {
      setSending(false)
    }
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text)' }}>Loading...</div>

  if (!searchParams.get('userId')) return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
      Select a conversation from the panel
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <ChatHeader other={other} />
      <ChatHistory
        messages={messages}
        currentUserId={currentUserId}
        pendingMessages={pendingMessages}
        otherProfile={other}
        currentUserProfile={currentUserProfile}
        conversationId={conv?.id}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={loadMore}
      />
      <Composer onSend={handleSend} disabled={sending} />
    </div>
  )
}
