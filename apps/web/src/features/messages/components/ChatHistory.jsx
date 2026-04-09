import { useEffect, useRef, useState } from 'react'
import { getDownloadUrl } from '../messagesService.js'

export default function ChatHistory({ messages, currentUserId, pendingMessages, otherProfile, currentUserProfile, conversationId }) {
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

    const msgTime = new Date(msg.created_at).getTime()
    const lastMsgTime = currentGroup?.messages?.length
      ? new Date(currentGroup.messages[currentGroup.messages.length - 1].created_at).getTime()
      : null
    const withinTimeWindow = lastMsgTime && (msgTime - lastMsgTime) < 10 * 60 * 1000

    if (currentGroup && currentGroup.senderId === msg.sender_id && withinTimeWindow) {
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
        const avatarProfile = group.isOwn ? currentUserProfile : otherProfile
        const avatarUrl = avatarProfile?.avatar_url
        const avatarName = avatarProfile?.full_name
        const displayName = group.isOwn ? (currentUserProfile?.full_name ?? 'You') : (otherProfile?.full_name ?? 'User')

        return (
          <div key={`group-${i}`} style={{ display: 'flex', gap: '0.85rem', padding: '0.15rem 1rem', alignItems: 'flex-start' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <div style={{ width: '32px', flexShrink: 0 }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', background: '#e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {avatarUrl
                  ? <img src={avatarUrl} alt={avatarName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <img src="/assets/user_icon_2.jpg" alt="default" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0, paddingTop: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                <span style={{ fontWeight: '600', fontSize: '0.9rem', color: group.isOwn ? 'var(--btn-primary)' : 'var(--text)' }}>
                  {displayName}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{time}</span>
              </div>
              {group.messages.map((msg, j) => (
                <div key={msg.id || `pending-${j}`} style={{ fontSize: '0.92rem', color: msg.pending ? 'var(--text-secondary)' : 'var(--text)', lineHeight: 1.5, marginBottom: '0.1rem', wordBreak: 'break-word' }}>
                  {msg.content && (
                    <div>
                      {msg.content.split(/(https?:\/\/[^\s]+)/g).map((part, idx) =>
                        /^https?:\/\//.test(part)
                          ? <a key={idx} href={part} target="_blank" rel="noopener noreferrer"
                              style={{ color: '#7c3aed', fontWeight: '600', textDecoration: 'none', wordBreak: 'break-all' }}>{part}</a>
                          : <span key={idx}>{part}</span>
                      )}
                    </div>
                  )}
                  {msg.link_url && (
                    <a href={msg.link_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'block', marginTop: '0.4rem' }}>
                      <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-secondary)', maxWidth: '480px', transition: 'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-secondary)'}>
                        <div style={{ width: '4px', flexShrink: 0, background: 'var(--btn-primary)' }} />
                        <div style={{ flex: 1, padding: '0.6rem 0.75rem', minWidth: 0 }}>
                          {msg.link_site && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{msg.link_site}</div>
                          )}
                          {msg.link_title && (
                            <div style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text)', marginBottom: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{msg.link_title}</div>
                          )}
                          {msg.link_description && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{msg.link_description}</div>
                          )}
                          {!msg.link_title && (
                            <div style={{ fontSize: '0.82rem', color: 'var(--btn-primary)', wordBreak: 'break-all' }}>{msg.link_url}</div>
                          )}
                        </div>
                        {msg.link_image && (
                          <div style={{ width: '80px', flexShrink: 0 }}>
                            <img src={msg.link_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        )}
                      </div>
                    </a>
                  )}
                  {(() => {
                    const images = msg.message_attachments?.filter(a => a.mime_type?.startsWith('image/')) ?? []
                    const files = msg.message_attachments?.filter(a => !a.mime_type?.startsWith('image/')) ?? []
                    return <>
                      {images.map((att, idx) => <ImageAttachmentCard key={att.id} attachment={att} conversationId={conversationId} allImages={images} index={idx} />)}
                      {files.map(att => <FileAttachmentCard key={att.id} attachment={att} conversationId={conversationId} />)}
                    </>
                  })()}
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

function getFileIcon(fileName = '') {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return '/assets/icons_img.png'
  if (ext === 'pdf') return '/assets/icon_pdf.png'
  if (['doc', 'docx'].includes(ext)) return '/assets/icon_doc.png'
  if (ext === 'txt') return '/assets/icon_txt.png'
  if (['xls', 'xlsx', 'csv'].includes(ext)) return '/assets/icon_xls.png'
  if (['zip', 'rar', '7z'].includes(ext)) return '/assets/icon_zip.png'
  if (['mp4', 'mov', 'avi'].includes(ext)) return '/assets/icon_video.png'
  if (['mp3', 'wav'].includes(ext)) return '/assets/icon_audio.png'
  return '/assets/icon_file_file.png'
}

function ImageAttachmentCard({ attachment, conversationId, allImages, index }) {
  const [src, setSrc] = useState(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxSrcs, setLightboxSrcs] = useState([])

  useEffect(() => {
    getDownloadUrl(attachment.object_key, attachment.file_name, conversationId)
      .then(url => setSrc(url))
      .catch(() => {})
  }, [attachment.object_key])

  async function handleClick() {
    const urls = await Promise.all(
      allImages.map(a => getDownloadUrl(a.object_key, a.file_name, conversationId))
    )
    setLightboxSrcs(urls)
    setLightboxOpen(true)
  }

  return (
    <>
      <div onClick={handleClick} style={{ marginTop: '0.35rem', borderRadius: '8px', overflow: 'hidden', maxWidth: '320px', cursor: 'pointer', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
        {src
          ? <img src={src} alt={attachment.file_name} style={{ width: '100%', display: 'block', maxHeight: '240px', objectFit: 'cover' }} loading="lazy" />
          : <div style={{ width: '320px', height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Loading...</div>
        }
      </div>
      {lightboxOpen && (
        <div onClick={() => setLightboxOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <img src={lightboxSrcs[index]} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain' }} onClick={e => e.stopPropagation()} />
          <button onClick={() => setLightboxOpen(false)}
            style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ×
          </button>
        </div>
      )}
    </>
  )
}

function FileAttachmentCard({ attachment, conversationId }) {
  async function handleClick() {
    const url = await getDownloadUrl(attachment.object_key, attachment.file_name, conversationId)
    window.open(url, '_blank')
  }
  return (
    <div onClick={handleClick}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem', padding: '0.5rem 0.75rem', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--text)', maxWidth: '280px' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'}
      onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-secondary)'}>
      <img src={getFileIcon(attachment.file_name)} alt="" style={{ width: '22px', height: '22px', objectFit: 'contain', flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{attachment.file_name}</div>
        {attachment.size_bytes && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{Math.round(attachment.size_bytes / 1024)}KB</div>}
      </div>
    </div>
  )
}
