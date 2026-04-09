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

export async function getMessages(conversationId, { limit = 50, before = null } = {}) {
  let query = supabase
    .from('messages')
    .select(`
      id, content, message_type, created_at, edited_at, deleted_at, sender_id,
      link_url, link_title, link_description, link_image, link_site,
      message_attachments (id, object_key, file_name, mime_type, size_bytes)
    `)
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (before) {
    query = query.lt('created_at', before)
  }

  const { data, error } = await query
  if (error) throw error
  return (data || []).reverse()
}

export async function sendMessage({ conversationId, content, attachments = [], onProgress }) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: { session } } = await supabase.auth.getSession()
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token || ''}`
  }

  // Upload attachments first
  const uploadedAttachments = []
  for (let i = 0; i < attachments.length; i++) {
    const file = attachments[i]
    const res = await apiRequest(API_PATHS.MESSAGES_UPLOAD_ATTACHMENT, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ conversationId, fileName: file.name, contentType: file.type })
    })
    if (!res.ok) throw new Error('Failed to get upload URL')
    const { uploadUrl, objectKey } = await res.json()

    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', uploadUrl)
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
      xhr.upload.onprogress = e => {
        if (e.lengthComputable && onProgress) {
          onProgress(i, Math.round((e.loaded / e.total) * 100), file.name)
        }
      }
      xhr.onload = () => resolve()
      xhr.onerror = () => reject(new Error('Upload failed'))
      xhr.send(file)
    })

    if (onProgress) onProgress(i, 100, file.name)
    uploadedAttachments.push({ object_key: objectKey, file_name: file.name, mime_type: file.type || null, size_bytes: file.size || 0 })
  }

  // Fetch link preview if URL detected
  let linkData = {}
  const urlMatch = content?.match(/https?:\/\/[^\s]+/)
  if (urlMatch) {
    try {
      const res = await apiRequest(API_PATHS.MESSAGES_LINK_PREVIEW, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ url: urlMatch[0] })
      })
      const preview = await res.json()
      if (preview?.title) {
        linkData = { link_url: urlMatch[0], link_title: preview.title || null, link_description: preview.description || null, link_image: preview.image || null, link_site: preview.site || null }
      } else {
        linkData = { link_url: urlMatch[0] }
      }
    } catch { linkData = { link_url: urlMatch[0] } }
  }

  // Insert message — NO message_type field
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: user.id, content: content || '', ...linkData })
    .select()
    .single()
  if (error) throw error

  // Insert attachments
  if (uploadedAttachments.length) {
    await supabase.from('message_attachments').insert(
      uploadedAttachments.map(a => ({ message_id: data.id, conversation_id: conversationId, sender_id: user.id, object_key: a.object_key, file_name: a.file_name, mime_type: a.mime_type, size_bytes: a.size_bytes }))
    )
  }

  // Update conversation last_message_at
  await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId)

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

export async function getDownloadUrl(objectKey, fileName, conversationId) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await apiRequest(API_PATHS.MESSAGES_DOWNLOAD_ATTACHMENT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token || ''}` },
    body: JSON.stringify({ objectKey, fileName, conversationId })
  })
  const data = await res.json()
  return data.downloadUrl
}
