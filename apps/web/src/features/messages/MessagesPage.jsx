import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@core/supabase.js'
import { getConversations, getMessages, sendMessage, getOrCreateConversation, markConversationRead } from './messagesService.js'
import ConversationsPanel from './components/ConversationsPanel.jsx'
import ChatHeader from './components/ChatHeader.jsx'
import ChatHistory from './components/ChatHistory.jsx'
import Composer from './components/Composer.jsx'

export default function MessagesPage() {
  const [conversations, setConversations] = useState([])
  const [activeConv, setActiveConv] = useState(null)
  const [messages, setMessages] = useState([])
  const [pendingMessages, setPendingMessages] = useState([])
  const [currentUserId, setCurrentUserId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [searchParams] = useSearchParams()
  const realtimeRef = useRef(null)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id)
      const { conversations, userId } = await getConversations()
      setConversations(conversations)
      setLoading(false)

      const targetUserId = searchParams.get('userId')
      if (targetUserId) {
        const convId = await getOrCreateConversation(targetUserId)
        const found = conversations.find(c => c.id === convId)
        if (found) selectConversation(found)
        else {
          const fresh = await getConversations()
          setConversations(fresh.conversations)
          const c = fresh.conversations.find(c => c.id === convId)
          if (c) selectConversation(c)
        }
      }

      subscribeToList(user?.id)
    }
    init()
    return () => { realtimeRef.current?.unsubscribe() }
  }, [])

  async function selectConversation(conv) {
    setActiveConv(conv)
    setMessages([])
    setPendingMessages([])
    const msgs = await getMessages(conv.id)
    setMessages(msgs)
    await markConversationRead(conv.id)
    subscribeToMessages(conv.id)
  }

  function subscribeToMessages(conversationId) {
    realtimeRef.current?.unsubscribe()
    realtimeRef.current = supabase
      .channel(`messages:${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, async payload => {
        const { data } = await supabase
          .from('messages')
          .select('id, content, message_type, created_at, sender_id, message_attachments (id, object_key, file_name, mime_type, size_bytes)')
          .eq('id', payload.new.id)
          .single()
        if (data) {
          setMessages(prev => {
            if (prev.find(m => m.id === data.id)) return prev
            return [...prev, data]
          })
          setPendingMessages([])
        }
      })
      .subscribe()
  }

  function subscribeToList(userId) {
    supabase.channel('conv-list')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async () => {
        const { conversations } = await getConversations()
        setConversations(conversations)
      })
      .subscribe()
  }

  async function handleSend({ content, attachments }) {
    if (!activeConv) return
    setSending(true)
    const tempId = Date.now().toString()
    const optimistic = { id: `pending-${tempId}`, tempId, content, sender_id: currentUserId, created_at: new Date().toISOString(), pending: true, message_attachments: [] }
    setPendingMessages(prev => [...prev, optimistic])
    try {
      await sendMessage({ conversationId: activeConv.id, content, attachments })
    } catch (e) {
      console.error('Send failed:', e)
      setPendingMessages(prev => prev.filter(p => p.tempId !== tempId))
    } finally {
      setSending(false)
    }
  }

  if (loading) return <div style={{ padding: '2rem' }}>Loading...</div>

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <ConversationsPanel conversations={conversations} activeId={activeConv?.id} onSelect={selectConversation} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!activeConv ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa' }}>Select a conversation to start chatting</div>
        ) : (
          <>
            <ChatHeader other={activeConv.other} />
            <ChatHistory messages={messages} currentUserId={currentUserId} pendingMessages={pendingMessages} />
            <Composer onSend={handleSend} disabled={sending} />
          </>
        )}
      </div>
    </div>
  )
}
