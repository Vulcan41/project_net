import { useEffect, useRef } from 'react'
import { getDownloadUrl } from '../messagesService.js'

export default function ChatHistory({ messages, currentUserId, pendingMessages }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pendingMessages])

  const allMessages = [...(messages || []), ...(pendingMessages || [])]

  if (!allMessages.length) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa' }}>No messages yet. Say hello!</div>
  )

  let lastDate = null

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      {allMessages.map((msg, i) => {
        const isOwn = msg.sender_id === currentUserId
        const isPending = msg.pending
        const msgDate = new Date(msg.created_at).toDateString()
        const showDivider = msgDate !== lastDate
        lastDate = msgDate
        return (
          <div key={msg.id || `pending-${i}`}>
            {showDivider && (
              <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#aaa', margin: '0.75rem 0' }}>{new Date(msg.created_at).toLocaleDateString()}</div>
            )}
            <div style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start', marginBottom: '0.15rem' }}>
              <div style={{ maxWidth: '65%', padding: '0.5rem 0.85rem', borderRadius: isOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: isOwn ? 'var(--accent)' : '#f2f3f5', color: isOwn ? 'white' : 'var(--text)', fontSize: '0.92rem', opacity: isPending ? 0.6 : 1 }}>
                {msg.content && <div>{msg.content}</div>}
                {msg.link_url && (
                  <a href={msg.link_url} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'block', marginTop: '0.4rem', fontSize: '0.82rem', color: isOwn ? 'rgba(255,255,255,0.85)' : 'var(--accent)', wordBreak: 'break-all' }}>
                    {msg.link_title || msg.link_url}
                  </a>
                )}
                {msg.message_attachments?.map(att => (
                  <AttachmentCard key={att.id} attachment={att} isOwn={isOwn} />
                ))}
              </div>
            </div>
          </div>
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}

function AttachmentCard({ attachment, isOwn }) {
  const isImage = attachment.mime_type?.startsWith('image/')

  async function handleClick() {
    const url = await getDownloadUrl(attachment.object_key)
    window.open(url, '_blank')
  }

  return (
    <div onClick={handleClick} style={{ marginTop: '0.4rem', padding: '0.5rem 0.75rem', background: isOwn ? 'rgba(255,255,255,0.15)' : '#e8e8e8', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem' }}>
      📎 {attachment.file_name} {attachment.size_bytes ? `(${Math.round(attachment.size_bytes / 1024)}KB)` : ''}
    </div>
  )
}
