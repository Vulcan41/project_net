import { useState, useRef, useEffect } from 'react'

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

function isImage(file) {
  return file.type?.startsWith('image/')
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

export default function Composer({ onSend, disabled }) {
  const [text, setText] = useState('')
  const [files, setFiles] = useState([])
  const [dragOver, setDragOver] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({})
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)
  const imageInputRef = useRef(null)
  const pickerRef = useRef(null)
  const pickerContainerRef = useRef(null)
  let dragCounter = 0

  useEffect(() => {
    if (!showEmojiPicker || !pickerRef.current) return
    import('emoji-mart').then(({ Picker }) => {
      pickerRef.current.innerHTML = ''
      const picker = new Picker({
        data: async () => {
          const response = await fetch('https://cdn.jsdelivr.net/npm/@emoji-mart/data')
          return response.json()
        },
        onEmojiSelect: (emoji) => {
          setText(t => t + emoji.native)
        },
        theme: 'auto',
        previewPosition: 'none',
        skinTonePosition: 'none',
        maxFrequentRows: 2,
      })
      pickerRef.current.appendChild(picker)
    })
  }, [showEmojiPicker])

  useEffect(() => {
    if (!showEmojiPicker) return
    function handleClickOutside(e) {
      if (pickerContainerRef.current && !pickerContainerRef.current.contains(e.target)) {
        setShowEmojiPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showEmojiPicker])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  async function handleSend() {
    if (!text.trim() && !files.length) return
    setUploading(true)
    setUploadProgress({})
    await onSend({
      content: text.trim(),
      attachments: files.map(f => f.file),
      onProgress: (index, pct, name) => {
        setUploadProgress(prev => ({ ...prev, [index]: { pct, name } }))
      }
    })
    setText('')
    setFiles([])
    setUploadProgress({})
    setUploading(false)
  }

  function addFiles(newFiles) {
    const arr = Array.from(newFiles).map(file => ({
      file,
      id: Math.random().toString(36).slice(2),
      previewUrl: isImage(file) ? URL.createObjectURL(file) : null
    }))
    setFiles(prev => [...prev, ...arr])
  }

  function removeFile(id) {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  return (
    <div
      onDragEnter={e => { e.preventDefault(); dragCounter++; setDragOver(true) }}
      onDragOver={e => e.preventDefault()}
      onDragLeave={e => { e.preventDefault(); dragCounter--; if (dragCounter <= 0) { dragCounter = 0; setDragOver(false) } }}
      onDrop={e => { e.preventDefault(); dragCounter = 0; setDragOver(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files) }}
      style={{ borderTop: `1px solid var(--border)`, background: dragOver ? 'var(--bg-secondary)' : 'var(--bg-card)', transition: 'background 0.15s', flexShrink: 0 }}>

      {files.length > 0 && (
        <div style={{ padding: '0.75rem 1rem 0', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {files.map(f => (
            isImage(f.file) ? (
              <div key={f.id} style={{ position: 'relative', width: '72px', height: '72px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)', flexShrink: 0, background: '#f1f3f5' }}>
                <img src={f.previewUrl} alt={f.file.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <button onClick={() => removeFile(f.id)}
                  style={{ position: 'absolute', top: '4px', right: '4px', width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(0,0,0,0.65)', color: 'white', border: 'none', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  ×
                </button>
              </div>
            ) : (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '10px', background: 'var(--bg-secondary)', minWidth: '200px', maxWidth: '280px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <img src={getFileIcon(f.file.name)} alt="" style={{ width: '26px', height: '26px', objectFit: 'contain', flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.file.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>{formatSize(f.file.size)}</div>
                  </div>
                </div>
                <button onClick={() => removeFile(f.id)}
                  style={{ width: '28px', height: '28px', border: 'none', borderRadius: '8px', background: 'transparent', color: 'var(--text-secondary)', fontSize: '18px', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  ×
                </button>
              </div>
            )
          ))}
        </div>
      )}

      {uploading && Object.entries(uploadProgress).map(([idx, { pct, name }]) => (
        <div key={idx} style={{ padding: '0.4rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>{name}</span>
            <span>{pct}%</span>
          </div>
          <div style={{ height: '4px', background: 'var(--border)', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'var(--btn-primary)', borderRadius: '999px', transition: 'width 0.1s' }} />
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', padding: '0.6rem 1rem' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: '0.25rem', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--input-bg)', padding: '0.4rem 0.5rem' }}>
          <textarea value={text} onChange={e => setText(e.target.value)} onKeyDown={handleKeyDown}
            placeholder={dragOver ? 'Drop files here...' : 'Write a message...'}
            disabled={disabled || uploading} rows={1}
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--text)', fontFamily: 'inherit', fontSize: '0.92rem', resize: 'none', maxHeight: '80px', overflowY: 'auto', lineHeight: '1.5', padding: '0' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.1rem', flexShrink: 0 }}>
            <button onClick={() => fileInputRef.current?.click()} title="Attach file" disabled={disabled || uploading}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', opacity: 0.6, borderRadius: '6px' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}>
              <img src="/assets/icon_attach_2.png" alt="Attach" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
            </button>
            <button onClick={() => imageInputRef.current?.click()} title="Send image" disabled={disabled || uploading}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', opacity: 0.6, borderRadius: '6px' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}>
              <img src="/assets/icons_img.png" alt="Image" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
            </button>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowEmojiPicker(o => !o)} title="Emoji" disabled={disabled || uploading}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', opacity: 0.6, borderRadius: '6px' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}>
                <img src="/assets/icon_emoji_2.png" alt="Emoji" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
              </button>
              {showEmojiPicker && (
                <div ref={pickerContainerRef}
                  style={{ position: 'absolute', bottom: '40px', right: '0', zIndex: 500 }}>
                  <div ref={pickerRef} />
                </div>
              )}
            </div>
          </div>
        </div>
        <button onClick={handleSend} disabled={disabled || uploading || (!text.trim() && !files.length)}
          style={{
            padding: '0 1.1rem',
            background: 'var(--btn-primary)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontWeight: '600',
            flexShrink: 0,
            alignSelf: 'stretch',
            opacity: (disabled || uploading || (!text.trim() && !files.length)) ? 0.5 : 1
          }}>
          Send
        </button>
      </div>

      <input ref={fileInputRef} type="file" multiple hidden onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
      <input ref={imageInputRef} type="file" accept="image/*" multiple hidden onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
    </div>
  )
}
