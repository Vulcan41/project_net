import { useEffect, useRef, useState } from 'react'
import { getDownloadUrl } from '../messagesService.js'

export default function ChatHistory({ messages, currentUserId, pendingMessages, otherProfile, currentUserProfile, conversationId, hasMore, loadingMore, onLoadMore }) {
  const containerRef = useRef(null)
  const isInitialLoad = useRef(true)
  const prevScrollHeight = useRef(0)

  // On initial load — jump to bottom instantly
  useEffect(() => {
    if (!containerRef.current) return
    if (isInitialLoad.current && messages.length > 0) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
      isInitialLoad.current = false
    }
  }, [messages.length > 0])

  // Reset on conversation change
  useEffect(() => {
    isInitialLoad.current = true
  }, [conversationId])

  // When new messages arrive (realtime) — scroll to bottom only if already near bottom
  useEffect(() => {
    if (!containerRef.current || isInitialLoad.current) return
    const el = containerRef.current
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    if (isNearBottom) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages.length, pendingMessages?.length])

  // When older messages are prepended — preserve scroll position
  useEffect(() => {
    if (!containerRef.current || loadingMore) return
    if (prevScrollHeight.current > 0) {
      const el = containerRef.current
      el.scrollTop = el.scrollHeight - prevScrollHeight.current
      prevScrollHeight.current = 0
    }
  }, [messages.length])

  function handleScroll() {
    if (!containerRef.current) return
    const el = containerRef.current
    if (el.scrollTop < 80 && hasMore && !loadingMore) {
      prevScrollHeight.current = el.scrollHeight
      onLoadMore?.()
    }
  }

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
    <div ref={containerRef} onScroll={handleScroll}
      style={{ flex: 1, overflowY: 'auto', padding: '1rem 0' }}>
      {loadingMore && (
        <div style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Loading older messages...</div>
      )}
      {hasMore === false && messages.length > 0 && (
        <div style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Beginning of conversation</div>
      )}
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
          <div key={`group-${i}`} style={{ display: 'flex', gap: '0.85rem', padding: '0.15rem 1rem', alignItems: 'flex-start' }}>
            <div style={{ width: '32px', flexShrink: 0 }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', background: '#e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {avatarUrl
                  ? <img src={avatarUrl} alt={avatarName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <img src="/assets/user_icon.png" alt="default" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
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
                          ? <LinkWithPreview key={idx} url={part}
                              title={msg.link_url === part ? msg.link_title : null}
                              description={msg.link_url === part ? msg.link_description : null}
                              image={msg.link_url === part ? msg.link_image : null}
                              site={msg.link_url === part ? msg.link_site : null} />
                          : <span key={idx}>{part}</span>
                      )}
                    </div>
                  )}
                  {(() => {
                    const images = msg.message_attachments?.filter(a => a.mime_type?.startsWith('image/')) ?? []
                    const files = msg.message_attachments?.filter(a => !a.mime_type?.startsWith('image/')) ?? []
                    return <>
                      {images.length > 0 && (
                        <div style={{
                          display: 'grid',
                          marginTop: '0.35rem',
                          gap: '3px',
                          maxWidth: images.length === 1 ? '320px' : images.length === 2 ? '320px' : images.length === 3 ? '360px' : images.length === 4 ? '320px' : '360px',
                          gridTemplateColumns: images.length === 1 ? '1fr' : images.length === 2 ? '1fr 1fr' : images.length === 3 ? '1fr 1fr 1fr' : images.length === 4 ? '1fr 1fr' : '1fr 1fr 1fr',
                        }}>
                          {images.map((att, idx) => (
                            <ImageAttachmentCard
                              key={att.id}
                              attachment={att}
                              conversationId={conversationId}
                              allImages={images}
                              index={idx}
                              count={images.length}
                            />
                          ))}
                        </div>
                      )}
                      {files.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '0.35rem' }}>
                          {files.map(att => <FileAttachmentCard key={att.id} attachment={att} conversationId={conversationId} />)}
                        </div>
                      )}
                    </>
                  })()}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function LinkWithPreview({ url, title, description, image, site }) {
  const [hovered, setHovered] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const linkRef = useRef(null)
  const hasPreview = !!(title || description || image)

  function handleMouseEnter() {
    if (!hasPreview) return
    const rect = linkRef.current?.getBoundingClientRect()
    if (rect) {
      setPos({
        top: rect.bottom + window.scrollY + 8,
        left: Math.min(rect.left + window.scrollX, window.innerWidth - 320 - 16)
      })
    }
    setHovered(true)
  }

  return (
    <>
      <a ref={linkRef} href={url} target="_blank" rel="noopener noreferrer"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setHovered(false)}
        style={{ color: '#7c3aed', fontWeight: '600', textDecoration: 'none', wordBreak: 'break-all', cursor: 'pointer' }}>
        {url}
      </a>
      {hovered && hasPreview && (
        <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: '300px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', zIndex: 500, overflow: 'hidden', pointerEvents: 'auto' }}>
          {image && (
            <img src={image} alt="" style={{ width: '100%', height: '140px', objectFit: 'cover', display: 'block' }} />
          )}
          <div style={{ padding: '0.75rem' }}>
            {site && <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>{site}</div>}
            {title && <div style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text)', marginBottom: '0.2rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{title}</div>}
            {description && <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{description}</div>}
            <div style={{ fontSize: '0.72rem', color: '#7c3aed', marginTop: '0.4rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</div>
          </div>
        </div>
      )}
    </>
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

function ImageAttachmentCard({ attachment, conversationId, allImages, index, count }) {
  const [src, setSrc] = useState(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxSrcs, setLightboxSrcs] = useState([])
  const [lightboxIndex, setLightboxIndex] = useState(index)

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
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  function handlePrev(e) {
    e.stopPropagation()
    setLightboxIndex(i => (i - 1 + lightboxSrcs.length) % lightboxSrcs.length)
  }

  function handleNext(e) {
    e.stopPropagation()
    setLightboxIndex(i => (i + 1) % lightboxSrcs.length)
  }

  useEffect(() => {
    if (!lightboxOpen) return
    const handler = e => {
      if (e.key === 'ArrowLeft') setLightboxIndex(i => (i - 1 + lightboxSrcs.length) % lightboxSrcs.length)
      if (e.key === 'ArrowRight') setLightboxIndex(i => (i + 1) % lightboxSrcs.length)
      if (e.key === 'Escape') setLightboxOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lightboxOpen, lightboxSrcs.length])

  const height = count === 1 ? '240px' : count === 3 ? '120px' : count >= 5 ? '100px' : '140px'

  return (
    <>
      <div onClick={handleClick}
        style={{ cursor: 'pointer', borderRadius: '6px', overflow: 'hidden', background: 'var(--bg-secondary)', border: '1px solid var(--border)', height }}>
        {src
          ? <img src={src} alt={attachment.file_name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Loading...</div>
        }
      </div>

      {lightboxOpen && (
        <div onClick={() => setLightboxOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <img src={lightboxSrcs[lightboxIndex]} alt="" style={{ maxWidth: '88vw', maxHeight: '88vh', objectFit: 'contain', borderRadius: '6px' }} onClick={e => e.stopPropagation()} />

          {lightboxSrcs.length > 1 && (
            <>
              <button onClick={handlePrev}
                style={{ position: 'absolute', left: '1.5rem', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', fontSize: '1.8rem', cursor: 'pointer', borderRadius: '50%', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}>
                ‹
              </button>
              <button onClick={handleNext}
                style={{ position: 'absolute', right: '1.5rem', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', fontSize: '1.8rem', cursor: 'pointer', borderRadius: '50%', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}>
                ›
              </button>
              <div style={{ position: 'absolute', bottom: '1.5rem', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>
                {lightboxIndex + 1} / {lightboxSrcs.length}
              </div>
            </>
          )}

          <button onClick={() => setLightboxOpen(false)}
            style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', fontSize: '1.3rem', cursor: 'pointer', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}>
            ×
          </button>
        </div>
      )}
    </>
  )
}

function FileAttachmentCard({ attachment, conversationId }) {
  const [hovered, setHovered] = useState(false)

  async function handleClick() {
    const url = await getDownloadUrl(attachment.object_key, attachment.file_name, conversationId)
    window.open(url, '_blank')
  }

  return (
    <div onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '240px',
        border: `1px solid ${hovered ? '#d7dde5' : '#e6e9ee'}`,
        background: hovered ? '#f8fafc' : '#ffffff',
        borderRadius: '14px',
        padding: '10px 12px',
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        transition: 'background 0.15s, border-color 0.15s',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        minWidth: 0,
      }}>
      <img src={getFileIcon(attachment.file_name)} alt="" style={{ width: '28px', height: '28px', objectFit: 'contain', flexShrink: 0, display: 'block' }} />
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: '13px', fontWeight: '600', color: '#171717', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{attachment.file_name}</div>
        <div style={{ fontSize: '11px', color: '#7a7a84', marginTop: '2px' }}>
          {attachment.size_bytes ? (attachment.size_bytes < 1024 * 1024 ? `${(attachment.size_bytes / 1024).toFixed(1)} KB` : `${(attachment.size_bytes / (1024 * 1024)).toFixed(1)} MB`) : ''}
        </div>
      </div>
    </div>
  )
}
