import { useSearchParams } from 'react-router-dom'
import ClipGenerator from '../components/shorts/ClipGenerator'
import UgcCreator from '../components/shorts/UgcCreator'
import { G } from '../components/shorts/ui'

const TABS = [
  { id: 'clips', label: 'Clip Generator', sub: 'Long video → viral shorts', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>
  ) },
  { id: 'ugc', label: 'UGC Creator', sub: 'AI actor talking ads', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
  ) },
  { id: 'youtube', label: 'YouTube Studio', sub: 'Titles, chapters, thumbnails', icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="4"/><polygon points="10 9 15 12 10 15 10 9" fill="currentColor"/></svg>
  ) },
]

export default function Shorts() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.some(t => t.id === params.get('tab')) ? params.get('tab') : 'clips'

  return (
    <div style={{ paddingTop: 'var(--nav-h)', minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '34px 24px 90px' }}>
        <div style={{ marginBottom: 26 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 11px', borderRadius: 20, background: 'rgba(139,92,246,0.10)', color: '#8B5CF6', fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: G }} /> New in Lavi
          </div>
          <h1 style={{ fontSize: 'clamp(30px, 4vw, 42px)', fontWeight: 800, letterSpacing: '-1.4px', lineHeight: 1.05 }}>Shorts Studio</h1>
          <p style={{ fontSize: 15.5, color: 'var(--text-secondary)', marginTop: 8, maxWidth: 640, lineHeight: 1.55 }}>
            Turn long videos into captioned, auto-framed vertical clips, make talking UGC ads with your AI creators, and package everything for YouTube.
          </p>
        </div>

        <div className="lavi-tabs" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 26 }}>
          {TABS.map(t => {
            const on = t.id === tab
            return (
              <button key={t.id} onClick={() => setParams({ tab: t.id })} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 16, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                background: on ? 'var(--surface)' : 'transparent', border: on ? '1.5px solid #8B5CF6' : '1px solid var(--border-subtle)',
                boxShadow: on ? '0 6px 24px rgba(139,92,246,0.14)' : 'none', color: 'var(--text-primary)', transition: 'all 0.15s',
              }}>
                <span style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: on ? G : 'var(--bg-tertiary)', color: on ? '#fff' : 'var(--text-secondary)' }}>{t.icon}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14.5, fontWeight: 800 }}>{t.label}</span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{t.sub}</span>
                </span>
              </button>
            )
          })}
        </div>

        {tab === 'clips' && <ClipGenerator key="clips" mode="clips" />}
        {tab === 'ugc' && <UgcCreator />}
        {tab === 'youtube' && <ClipGenerator key="youtube" mode="youtube" />}
      </div>
    </div>
  )
}
