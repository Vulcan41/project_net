import { useEffect, useRef } from 'react'
import { getDownloadUrl } from '../messagesService.js'

export default function ChatHistory({ messages, currentUserId, pendingMessages }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pendingMessages])

  const allMessages = [...(messages || []), ...(pendingMessages || [])]
  if (!allMessages.length) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
      No messages yet. Say hello!
    </div>
  )

  // Group consecutive messages from same sender
  const groups = []
  let currentGroup = null
  let lastDate = null

  for (const msg of allMessages) {
    const msgDate = new Date(msg.created_at).toDateString()
    if (msgDate !== lastDate) {
      groups.push({ type: 'divider', date: new Date(msg.created_at) })
      lastDate = msgDate
      currentGroup = null
    }
    if (currentGroup && currentGroup.senderId === msg.sender_id) {
      currentGroup.messages.push(msg)
    } else {
      currentGroup = { type: 'group', senderId: msg.sender_id, isOwn: msg.sender_id === currentUserId, messages: [msg] }
      groups.push(currentGroup)
    }
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 0' }}>
      {groups.map((group, i) => {
        if (group.type === 'divider') return (
          <div key={`divider-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1rem', margin: '0.5rem 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            <span style={{ fontSize: '0.72rem', fontWeight: '600', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              {group.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          </div>
        )

        const firstMsg = group.messages[0]
        const time = new Date(firstMsg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

        return (
          <div key={`group-${i}`} style={{ display: 'flex', gap: '0.85rem', padding: '0.15rem 1rem', alignItems: 'flex-start' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <div style={{ width: '40px', flexShrink: 0, paddingTop: '2px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', background: '#e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="/assets/user_icon_2.jpg" alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.2rem' }}>
                <span style={{ fontWeight: '600', fontSize: '0.95rem', color: group.isOwn ? 'var(--btn-primary)' : 'var(--text)' }}>
                  {group.isOwn ? 'You' : 'User'}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{time}</span>
              </div>
              {group.messages.map((msg, j) => (
                <div key={msg.id || `pending-${j}`} style={{ fontSize: '0.92rem', color: msg.pending ? 'var(--text-secondary)' : 'var(--text)', lineHeight: 1.5, marginBottom: '0.1rem', wordBreak: 'break-word' }}>
                  {msg.content && <div>{msg.content}</div>}
                  {msg.link_url && (
                    <a href={msg.link_url} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'inline-block', marginTop: '0.25rem', color: 'var(--btn-primary)', fontSize: '0.85rem', wordBreak: 'break-all' }}>
                      {msg.link_title || msg.link_url}
                    </a>
                  )}
                  {msg.message_attachments?.map(att => (
                    <AttachmentCard key={att.id} attachment={att} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}

function AttachmentCard({ attachment }) {
  async function handleClick() {
    const url = await getDownloadUrl(attachment.object_key)
    window.open(url, '_blank')
  }
  return (
    <div onClick={handleClick}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem', padding: '0.5rem 0.75rem', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text)' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'}
      onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-secondary)'}>
      📎 <span>{attachment.file_name}</span>
      {attachment.size_bytes && <span style={{ color: 'var(--text-secondary)' }}>({Math.round(attachment.size_bytes / 1024)}KB)</span>}
    </div>
  )
}
