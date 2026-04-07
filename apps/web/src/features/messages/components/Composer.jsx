import { useState, useRef } from 'react'

export default function Composer({ onSend, disabled }) {
  const [text, setText] = useState('')
  const [files, setFiles] = useState([])
  const fileInputRef = useRef(null)

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleSend() {
    if (!text.trim() && !files.length) return
    onSend({ content: text.trim(), attachments: files })
    setText('')
    setFiles([])
  }

  function handleFiles(newFiles) {
    setFiles(prev => [...prev, ...Array.from(newFiles)])
  }

  return (
    <div style={{ borderTop: '1px solid #eee', padding: '0.75rem 1.25rem', flexShrink: 0 }}>
      {files.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          {files.map((f, i) => (
            <div key={i} style={{ background: '#f0f0f0', borderRadius: '6px', padding: '0.25rem 0.5rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              📎 {f.name}
              <span onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} style={{ cursor: 'pointer', color: '#888' }}>×</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
        <button onClick={() => fileInputRef.current?.click()} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '0.25rem' }} title="Attach file">📎</button>
        <input ref={fileInputRef} type="file" multiple hidden onChange={e => handleFiles(e.target.files)} />
        <textarea value={text} onChange={e => setText(e.target.value)} onKeyDown={handleKeyDown}
          placeholder="Write a message..." disabled={disabled}
          style={{ flex: 1, padding: '0.6rem 0.85rem', border: '1px solid #ddd', borderRadius: '20px', resize: 'none', outline: 'none', fontFamily: 'inherit', fontSize: '0.92rem', maxHeight: '80px', overflowY: 'auto' }}
          rows={1} />
        <button onClick={handleSend} disabled={disabled || (!text.trim() && !files.length)}
          style={{ padding: '0.5rem 1.1rem', background: '#111', color: 'white', border: 'none', borderRadius: '20px', cursor: 'pointer', fontWeight: '500', flexShrink: 0 }}>
          Send
        </button>
      </div>
    </div>
  )
}
