import { useState } from 'react'

export const G = 'linear-gradient(135deg,#EC4899,#8B5CF6)'

export function Card({ children, style, ...rest }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 18, boxShadow: 'var(--shadow-sm)', ...style }} {...rest}>
      {children}
    </div>
  )
}

export function Btn({ children, kind = 'primary', size = 'md', disabled, style, ...rest }) {
  const pad = size === 'sm' ? '7px 12px' : size === 'lg' ? '14px 26px' : '10px 18px'
  const fs = size === 'sm' ? 12.5 : size === 'lg' ? 15 : 13.5
  const base = {
    padding: pad, fontSize: fs, fontWeight: 700, borderRadius: size === 'lg' ? 14 : 10,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1,
    transition: 'transform 0.15s, box-shadow 0.15s, background 0.15s', whiteSpace: 'nowrap',
    border: 'none', fontFamily: 'inherit',
  }
  const kinds = {
    primary: { background: G, color: '#fff', boxShadow: disabled ? 'none' : '0 4px 18px rgba(139,92,246,0.32)' },
    secondary: { background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' },
    ghost: { background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)' },
    dark: { background: 'var(--text-primary)', color: 'var(--bg)' },
  }
  return <button disabled={disabled} style={{ ...base, ...kinds[kind], ...style }} {...rest}>{children}</button>
}

export function Label({ children, hint }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
      {children}{hint && <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500, marginLeft: 6 }}>{hint}</span>}
    </div>
  )
}

export function Segmented({ options, value, onChange, size = 'md' }) {
  return (
    <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4, padding: 4, borderRadius: 12, background: 'var(--bg-tertiary)' }}>
      {options.map(o => {
        const [v, label] = Array.isArray(o) ? o : [o, o]
        const on = v === value
        return (
          <button key={v} onClick={() => onChange(v)} style={{
            padding: size === 'sm' ? '5px 10px' : '7px 13px', borderRadius: 9, fontSize: size === 'sm' ? 12 : 13, fontWeight: 600,
            background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--text-primary)' : 'var(--text-secondary)',
            boxShadow: on ? 'var(--shadow-sm)' : 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          }}>{label}</button>
        )
      })}
    </div>
  )
}

export function Progress({ value, label, sub }) {
  return (
    <div>
      {(label || sub) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 7 }}>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
          <span style={{ color: 'var(--text-tertiary)' }}>{sub ?? (value != null ? `${Math.round(value * 100)}%` : '')}</span>
        </div>
      )}
      <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-tertiary)', overflow: 'hidden', position: 'relative' }}>
        {value == null
          ? <div style={{ position: 'absolute', inset: 0, width: '35%', background: G, borderRadius: 3, animation: 'lavi-indet 1.2s ease-in-out infinite' }} />
          : <div style={{ height: '100%', width: `${Math.max(2, value * 100)}%`, background: G, borderRadius: 3, transition: 'width 0.3s' }} />}
      </div>
    </div>
  )
}

export function Toggle({ on, onChange, label }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', userSelect: 'none' }}>
      <span onClick={() => onChange(!on)} style={{ width: 36, height: 21, borderRadius: 11, background: on ? '#8B5CF6' : 'var(--bg-tertiary)', border: '1px solid var(--border)', position: 'relative', transition: 'background 0.15s', flexShrink: 0 }}>
        <span style={{ position: 'absolute', top: 2, left: on ? 17 : 2, width: 15, height: 15, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 0.15s' }} />
      </span>
      <span onClick={() => onChange(!on)}>{label}</span>
    </label>
  )
}

export function CopyBtn({ text, label = 'Copy', size = 'sm', kind = 'secondary' }) {
  const [done, setDone] = useState(false)
  return (
    <Btn size={size} kind={kind} onClick={async () => {
      try { await navigator.clipboard.writeText(text) } catch {
        const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove()
      }
      setDone(true); setTimeout(() => setDone(false), 1400)
    }}>{done ? 'Copied ✓' : label}</Btn>
  )
}

export const inputStyle = {
  width: '100%', padding: '11px 14px', borderRadius: 11, border: '1.5px solid var(--border)', background: 'var(--bg-tertiary)',
  fontSize: 14, color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
}

export function ScoreBadge({ score }) {
  const color = score >= 80 ? '#10B981' : score >= 60 ? '#F59E0B' : '#94A3B8'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', whiteSpace: 'nowrap', flexShrink: 0, borderRadius: 20, fontSize: 11.5, fontWeight: 800, color, background: `${color}18`, border: `1px solid ${color}40` }}>
      🔥 {score}
    </span>
  )
}

export function ErrorNote({ children, onClose }) {
  if (!children) return null
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '11px 14px', borderRadius: 12, background: 'rgba(255,59,48,0.07)', border: '1px solid rgba(255,59,48,0.22)', color: '#E5372C', fontSize: 13, lineHeight: 1.5 }}>
      <span style={{ flex: 1 }}>{children}</span>
      {onClose && <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>}
    </div>
  )
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export async function downloadUrl(url, name) {
  try {
    const r = await fetch(url); const b = await r.blob(); downloadBlob(b, name)
  } catch {
    window.open(`/api/img-proxy?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`, '_blank')
  }
}

export function slug(s) { return (s || 'clip').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'clip' }
