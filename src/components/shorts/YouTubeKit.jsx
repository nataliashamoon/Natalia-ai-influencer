import { useRef, useState } from 'react'
import { Card, Btn, Label, CopyBtn, ErrorNote, Progress, inputStyle, downloadUrl } from './ui'
import { youtubeKit, chaptersText } from '../../utils/shorts/ai'
import { fmtTime } from '../../utils/shorts/transcribe'
import { makeThumbnail } from '../../utils/shorts/hf'
import { isHFConnected, startHiggsfieldOAuthPopup } from '../../utils/higgsfieldAuth'

export default function YouTubeKit({ project, srcUrl, onChange }) {
  const kit = project.youtube
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [frameT, setFrameT] = useState(() => project.clips?.[0]?.start ?? Math.min(30, project.duration / 3))
  const [thumbBusy, setThumbBusy] = useState({})
  const videoRef = useRef(null)

  async function build() {
    setBusy(true); setError(null)
    try {
      const k = await youtubeKit({ segments: project.segments, duration: project.duration, context: project.context })
      onChange({ ...project, youtube: { ...k, thumbs: {} } })
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  function grabFrame() {
    const v = videoRef.current
    if (!v?.videoWidth) return null
    const c = document.createElement('canvas')
    const s = Math.min(1, 1280 / v.videoWidth)
    c.width = v.videoWidth * s; c.height = v.videoHeight * s
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', 0.9)
  }

  async function genThumb(i) {
    setError(null)
    if (!isHFConnected()) { try { await startHiggsfieldOAuthPopup() } catch { return } }
    const t = kit.thumbnails[i]
    setThumbBusy(b => ({ ...b, [i]: 0 }))
    try {
      const url = await makeThumbnail({ concept: t.concept, text: t.text, frameDataUrl: grabFrame(), onProgress: p => setThumbBusy(b => ({ ...b, [i]: p })) })
      if (!url) throw new Error('Thumbnail generation returned nothing')
      onChange({ ...project, youtube: { ...kit, thumbs: { ...(kit.thumbs || {}), [i]: [...(kit.thumbs?.[i] || []), url] } } })
    } catch (e) { setError(e.message) } finally { setThumbBusy(b => { const n = { ...b }; delete n[i]; return n }) }
  }

  if (!kit) {
    return (
      <Card style={{ padding: 30, textAlign: 'center' }}>
        <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>YouTube kit</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, maxWidth: 440, margin: '0 auto 18px', lineHeight: 1.55 }}>10 title options, an SEO description with chapters, tags, and AI thumbnails made from a frame of your video.</p>
        <ErrorNote onClose={() => setError(null)}>{error}</ErrorNote>
        <Btn size="lg" disabled={busy} onClick={build} style={{ marginTop: 10 }}>{busy ? 'Writing…' : 'Generate YouTube kit'}</Btn>
      </Card>
    )
  }

  const fullDescription = `${kit.description}\n\n${chaptersText(kit.chapters)}${kit.tags?.length ? `\n\n${kit.tags.map(t => '#' + t.replace(/\s+/g, '')).slice(0, 5).join(' ')}` : ''}`

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <ErrorNote onClose={() => setError(null)}>{error}</ErrorNote>
      {kit.offline && <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Basic kit made offline — add a Claude key in Settings for 10 AI titles and smarter chapters.</div>}
      <div className="lavi-yt" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        <Card style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Label>Title ideas</Label>
            <Btn size="sm" kind="ghost" disabled={busy} onClick={build}>{busy ? 'Writing…' : 'Regenerate'}</Btn>
          </div>
          <ol style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {kit.titles.map((t, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, background: 'var(--bg-tertiary)' }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#8B5CF6', width: 18 }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600, lineHeight: 1.35 }}>{t}</span>
                <span style={{ fontSize: 11, color: t.length > 70 ? '#E5372C' : 'var(--text-tertiary)' }}>{t.length}</span>
                <CopyBtn text={t} label="Copy" kind="ghost" />
              </li>
            ))}
          </ol>
        </Card>

        <Card style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Label>Description + chapters</Label>
            <CopyBtn text={fullDescription} label="Copy all" />
          </div>
          <textarea value={kit.description} onChange={e => onChange({ ...project, youtube: { ...kit, description: e.target.value } })} rows={6} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.55, fontSize: 13.5 }} />
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {kit.chapters.map((c, i) => (
              <div key={i} style={{ fontSize: 13.5, display: 'flex', gap: 10 }}>
                <span style={{ color: '#8B5CF6', fontWeight: 700, fontVariantNumeric: 'tabular-nums', width: 52 }}>{fmtTime(c.time)}</span>{c.title}
              </div>
            ))}
          </div>
          {kit.tags?.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Label>Tags</Label><CopyBtn text={kit.tags.join(', ')} label="Copy tags" kind="ghost" />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {kit.tags.map(t => <span key={t} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>{t}</span>)}
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card style={{ padding: 20 }}>
        <Label hint="made with Higgsfield using a frame from your video">Thumbnails</Label>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <video ref={videoRef} src={srcUrl} muted playsInline preload="auto" onLoadedMetadata={e => { e.currentTarget.currentTime = frameT }} style={{ width: 200, aspectRatio: '16/9', objectFit: 'cover', borderRadius: 10, background: '#000' }} />
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 6 }}>Reference frame at {fmtTime(frameT)} — pick a moment with a strong facial expression.</div>
            <input type="range" min={0} max={Math.max(1, project.duration - 0.5)} step={0.5} value={frameT} onChange={e => { const t = Number(e.target.value); setFrameT(t); if (videoRef.current) videoRef.current.currentTime = t }} style={{ width: '100%' }} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
          {kit.thumbnails.map((t, i) => (
            <div key={i} style={{ border: '1px solid var(--border-subtle)', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>“{t.text}”</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.45 }}>{t.concept}</div>
              {(kit.thumbs?.[i] || []).map(u => (
                <button key={u} onClick={() => downloadUrl(u, `thumbnail-${i + 1}.png`)} title="Download" style={{ border: 'none', padding: 0, background: 'none', cursor: 'pointer' }}>
                  <img src={u} alt="" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 10, display: 'block' }} />
                </button>
              ))}
              {thumbBusy[i] != null
                ? <Progress value={thumbBusy[i] || null} label="Generating…" />
                : <Btn size="sm" kind={kit.thumbs?.[i]?.length ? 'secondary' : 'primary'} onClick={() => genThumb(i)}>{kit.thumbs?.[i]?.length ? 'Another version' : 'Generate thumbnail'}</Btn>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
