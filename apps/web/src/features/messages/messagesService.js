import { supabase } from '@core/supabase.js'
import { apiRequest, API_PATHS } from '@core/apiClient.js'

export async function getConversations() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('conversation_participants')
    .select(`
      conversation_id, last_read_at,
      conversations (id, type, last_message_at, created_by)
    `)
    .eq('user_id', user.id)
    .order('last_read_at', { ascending: false })
  if (error) throw error

  const convIds = data.map(d => d.conversation_id)
  if (!convIds.length) return { userId: user.id, conversations: [] }

  const { data: participants } = await supabase
    .from('conversation_participants')
    .select('conversation_id, user_id, profiles (id, username, full_name, avatar_url)')
    .in('conversation_id', convIds)
    .neq('user_id', user.id)

  const { data: lastMessages } = await supabase
    .from('messages')
    .select('conversation_id, content, created_at, sender_id')
    .in('conversation_id', convIds)
    .order('created_at', { ascending: false })

  const lastMsgMap = {}
  lastMessages?.forEach(m => { if (!lastMsgMap[m.conversation_id]) lastMsgMap[m.conversation_id] = m })

  const participantMap = {}
  participants?.forEach(p => {
    if (!participantMap[p.conversation_id]) participantMap[p.conversation_id] = p.profiles
  })

  const conversations = data.map(d => ({
    id: d.conversation_id,
    last_read_at: d.last_read_at,
    other: participantMap[d.conversation_id],
    lastMessage: lastMsgMap[d.conversation_id],
    last_message_at: d.conversations?.last_message_at
  })).sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0))

  return { userId: user.id, conversations }
}

export async function getMessages(conversationId) {
  const { data, error } = await supabase
    .from('messages')
    .select(`
      id, content, message_type, created_at, edited_at, deleted_at, sender_id,
      link_url, link_title, link_description, link_image,
      message_attachments (id, object_key, file_name, mime_type, size_bytes)
    `)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function sendMessage({ conversationId, content, attachments = [] }) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const uploadedAttachments = []
  for (const file of attachments) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('conversationId', conversationId)
    const res = await apiRequest(API_PATHS.MESSAGES_UPLOAD_ATTACHMENT, { method: 'POST', body: formData })
    const data = await res.json()
    if (data.objectKey) uploadedAttachments.push({ objectKey: data.objectKey, fileName: file.name, mimeType: file.type, sizeBytes: file.size })
  }

  // Detect URL in content and fetch link preview
  let linkData = {}
  const urlMatch = content?.match(/https?:\/\/[^\s]+/)
  if (urlMatch) {
    try {
      const res = await apiRequest(API_PATHS.MESSAGES_LINK_PREVIEW, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlMatch[0] })
      })
      const preview = await res.json()
      if (preview?.title) {
        linkData = {
          link_url: urlMatch[0],
          link_title: preview.title || null,
          link_description: preview.description || null,
          link_image: preview.image || null,
          link_site: preview.site || null,
        }
      } else {
        linkData = { link_url: urlMatch[0] }
      }
    } catch (e) {
      linkData = { link_url: urlMatch[0] }
    }
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: content || '',
      message_type: attachments.length ? 'file' : 'text',
      ...linkData
    })
    .select()
    .single()
  if (error) throw error

  if (uploadedAttachments.length) {
    await supabase.from('message_attachments').insert(
      uploadedAttachments.map(a => ({ message_id: data.id, conversation_id: conversationId, sender_id: user.id, object_key: a.objectKey, file_name: a.fileName, mime_type: a.mimeType, size_bytes: a.sizeBytes }))
    )
  }
  return data
}

export async function getOrCreateConversation(targetUserId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: myConvs } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', user.id)

  const myConvIds = myConvs?.map(c => c.conversation_id) ?? []
  if (!myConvIds.length) return null

  const { data: shared } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', targetUserId)
    .in('conversation_id', myConvIds)

  if (shared?.length) return shared[0].conversation_id
  return null
}

export async function markConversationRead(conversationId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('conversation_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
}

export async function getDownloadUrl(objectKey) {
  const res = await apiRequest(API_PATHS.MESSAGES_DOWNLOAD_ATTACHMENT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ objectKey })
  })
  const data = await res.json()
  return data.url
}
