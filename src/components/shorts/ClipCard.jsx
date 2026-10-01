import { useEffect, useRef, useState } from 'react'
import { Card, Btn, Progress, CopyBtn, ScoreBadge, ErrorNote, inputStyle, downloadUrl, slug } from './ui'
import { DUB_LANGUAGES } from '../../utils/shorts/hf'
import ClipPreview from './ClipPreview'
import { useClipActions, clipCaption } from './useClipActions'

const UPLOAD_LINKS = [
  ['TikTok', 'https://www.tiktok.com/tiktokstudio/upload'],
  ['Instagram', 'https://www.instagram.com/'],
  ['YouTube', 'https://www.youtube.com/upload'],
]

function Chip({ children }) {
  return <span style={{ padding: '3px 8px', borderRadius: 7, fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{children}</span>
}

function PlatformRow({ label, text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border-subtle)', minWidth: 0 }}>
      <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.6px', color: 'var(--text-tertiary)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</span>
      <CopyBtn text={text} label="Copy" kind="ghost" />
    </div>
  )
}

// One clip in the feed: live preview, why it was picked, ready-to-paste titles and
// captions, and one-tap export / dub / post. Detailed edits open the full editor.
export default function ClipCard({ index, clip, project, srcUrl, playing, onPlayingChange, onChange, onEdit, queued, onQueueDone }) {
  const actions = useClipActions({ project, clip, srcUrl, words: project.words, onChange })
  const { rendering, dubbing, error, setError } = actions
  const [dubOpen, setDubOpen] = useState(false)
  const [dubLang, setDubLang] = useState('spa')
  const [postNote, setPostNote] = useState(false)
  const busy = rendering != null || dubbing != null

  // "Download all" exports clips one at a time through this queue
  const ranQueue = useRef(false)
  useEffect(() => {
    if (!queued) { ranQueue.current = false; return }
    if (ranQueue.current) return
    ranQueue.current = true
    onPlayingChange(false)
    actions.exportClip().finally(onQueueDone)
  }, [queued])

  async function post() {
    onPlayingChange(false); setPostNote(false)
    if (await actions.share()) return // phones: straight into the TikTok / Instagram share sheet
    if (!(await actions.exportClip())) return
    try { await navigator.clipboard.writeText(clipCaption(clip)) } catch {}
    setPostNote(true)
  }

  const secs = Math.round(clip.end - clip.start)
  const tags = (clip.hashtags || []).slice(0, 2)

  return (
    <Card style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.8px', color: 'var(--text-tertiary)' }}>CLIP {index + 1}</span>
        <ScoreBadge score={clip.score} />
        {clip.renderKey && <span title="Exported" style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 700, color: '#10B981' }}>● Ready</span>}
      </div>

      <ClipPreview clip={clip} srcUrl={srcUrl} words={project.words} playing={playing} onPlayingChange={onPlayingChange} />

      <div>
        <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.3px', lineHeight: 1.3 }}>{clip.title}</div>
        {clip.reason && <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 4 }}>{clip.reason}</p>}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          <Chip>0:{String(secs).padStart(2, '0')}</Chip>
          <Chip>1080×1920</Chip>
          {tags.map(t => <Chip key={t}>#{t}</Chip>)}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        <PlatformRow label="YouTube" text={clip.title} />
        <PlatformRow label="TikTok · IG" text={clipCaption(clip).replace(/\n+/g, ' ')} />
      </div>

      <ErrorNote onClose={() => setError(null)}>{error}</ErrorNote>
      {rendering != null && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ flex: 1 }}><Progress value={rendering} label={queued ? 'Exporting for Download all…' : 'Rendering…'} sub={`${Math.round(rendering * 100)}% · keep this tab open`} /></div>
          <Btn size="sm" kind="ghost" onClick={actions.cancel}>Cancel</Btn>
        </div>
      )}
      {dubbing != null && <Progress value={dubbing} label="Dubbing with Higgsfield…" sub="usually 1–3 min" />}

      {dubOpen && !busy && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={dubLang} onChange={e => setDubLang(e.target.value)} style={{ ...inputStyle, flex: 1, padding: '8px 11px', fontSize: 13 }}>
            {DUB_LANGUAGES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
          </select>
          <Btn size="sm" onClick={() => { setDubOpen(false); onPlayingChange(false); actions.dub(dubLang) }}>Start dub</Btn>
        </div>
      )}
      {Object.keys(clip.dubs || {}).length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {Object.entries(clip.dubs).map(([k, d]) => (
            <Btn key={k} size="sm" kind="ghost" onClick={() => downloadUrl(d.url, `${slug(clip.title)}-${k}.mp4`)}>⬇ {DUB_LANGUAGES.find(l => l[0] === k)?.[1] || k}</Btn>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        <Btn size="sm" kind="secondary" onClick={() => { onPlayingChange(false); onEdit() }}>✂ Edit</Btn>
        <Btn size="sm" kind="secondary" disabled={busy} onClick={() => setDubOpen(o => !o)}>文A Dub</Btn>
        <Btn size="sm" kind="secondary" disabled={busy} onClick={() => { onPlayingChange(false); actions.exportClip() }}>⬇ Download</Btn>
      </div>
      <Btn disabled={busy} onClick={post}>Post</Btn>
      {postNote && (
        <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-secondary)', padding: '10px 12px', borderRadius: 10, background: 'var(--bg-tertiary)' }}>
          Caption copied and the video is downloading. Upload it on{' '}
          {UPLOAD_LINKS.map(([n, u], i) => <span key={n}>{i > 0 && (i === UPLOAD_LINKS.length - 1 ? ' or ' : ', ')}<a href={u} target="_blank" rel="noreferrer" style={{ color: '#8B5CF6', fontWeight: 700 }}>{n}</a></span>)}
          {' '}and paste the caption.
        </div>
      )}
    </Card>
  )
}
