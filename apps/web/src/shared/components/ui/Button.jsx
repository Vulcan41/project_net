export default function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  fullWidth = false,
  type = 'button',
  style = {},
  ...props
}) {
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    border: 'none', borderRadius: 'var(--radius)', cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit', fontWeight: '500', transition: 'opacity 0.15s, background 0.15s',
    opacity: disabled ? 0.5 : 1, width: fullWidth ? '100%' : 'auto',
    whiteSpace: 'nowrap',
  }

  const sizes = {
    sm: { padding: '0.3rem 0.75rem', fontSize: '0.8rem' },
    md: { padding: '0.5rem 1.1rem', fontSize: '0.9rem' },
    lg: { padding: '0.7rem 1.5rem', fontSize: '1rem' },
  }

  const variants = {
    primary:   { background: 'var(--btn-primary)', color: 'var(--btn-primary-text)' },
    secondary: { background: 'var(--bg-secondary)', color: 'var(--text)', border: '1px solid var(--border)' },
    danger:    { background: 'var(--danger)', color: 'white' },
    ghost:     { background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)' },
    dark:      { background: 'var(--btn-dark)', color: 'var(--btn-dark-text)' },
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled}
      style={{ ...base, ...sizes[size], ...variants[variant], ...style }}
      {...props}>
      {children}
    </button>
  )
}
