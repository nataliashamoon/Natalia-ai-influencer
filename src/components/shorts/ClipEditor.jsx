import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, Btn, Label, Segmented, Progress, Toggle, CopyBtn, inputStyle, ScoreBadge, ErrorNote, HiggsfieldNotice, useHiggsfield, downloadBlob, downloadUrl, slug } from './ui'
import { drawFrame, buildCaptionGroups, renderClip, ensureFonts, CAPTION_STYLES, DEFAULT_OPTIONS, OUT_W, OUT_H } from '../../utils/shorts/render'
import { analyzeFraming } from '../../utils/shorts/reframe'
import { GRADES } from '../../utils/shorts/ai'
import { fmtTime } from '../../utils/shorts/transcribe'
import { putBlob, getBlob } from '../../utils/shorts/db'
import { dubClip, DUB_LANGUAGES } from '../../utils/shorts/hf'

const LAYOUTS = [['auto', 'Auto'], ['track', 'Follow face'], ['split', 'Split'], ['fit', 'Fit'], ['center', 'Center']]

export default function ClipEditor({ project, clip, srcUrl, onChange, words }) {
  const canvasRef = useRef(null)
  const videoRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [framingBusy, setFramingBusy] = useState(false)
  const [framingProgress, setFramingProgress] = useState(0)
  const [rendering, setRendering] = useState(null) // progress 0..1
  const [renderUrl, setRenderUrl] = useState(null)
  const [renderMeta, setRenderMeta] = useState(null)
  const [dubLang, setDubLang] = useState('spa')
  const [dubbing, setDubbing] = useState(null)
  const [error, setError] = useState(null)
  const abortRef = useRef(null)

  const options = { ...DEFAULT_OPTIONS, grade: clip.grade || DEFAULT_OPTIONS.grade, ...(clip.options || {}) }
  const setOpt = (k, v) => onChange({ ...clip, options: { ...(clip.options || {}), [k]: v }, renderKey: null })
  const groups = useMemo(() => buildCaptionGroups(words, clip.start, clip.end, options.wordsPerLine), [words, clip.start, clip.end, options.wordsPerLine])

  // Load an existing render for this clip
  useEffect(() => {
    let url = null
    setRenderUrl(null); setRenderMeta(null); setError(null)
    if (clip.renderKey) getBlob(clip.renderKey).then(b => { if (b) { url = URL.createObjectURL(b); setRenderUrl(url); setRenderMeta({ blob: b, ext: b.type.includes('mp4') ? 'mp4' : 'webm' }) } })
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [clip.id, clip.renderKey])

  // Face analysis for smart reframing (cached on the clip)
  useEffect(() => {
    if (clip.framing || !srcUrl) return
    let cancelled = false
    const v = document.createElement('video')
    v.src = srcUrl; v.muted = true; v.preload = 'auto'
    setFramingBusy(true); setFramingProgress(0)
    v.onloadedmetadata = async () => {
      try {
        const f = await analyzeFraming(v, clip.start, clip.end, { step: Math.max(0.5, (clip.end - clip.start) / 70), onProgress: p => !cancelled && setFramingProgress(p) })
        if (!cancelled) onChange({ ...clip, framing: f })
      } catch (e) { console.warn(e) }
      finally { if (!cancelled) setFramingBusy(false); v.removeAttribute('src'); v.load() }
    }
    return () => { cancelled = true }
  }, [clip.id, clip.start, clip.end, srcUrl, !!clip.framing])

  // Live preview loop
  useEffect(() => {
    const v = videoRef.current, c = canvasRef.current
    if (!v || !c) return
    const ctx = c.getContext('2d')
    let raf
    ensureFonts()
    const loop = () => {
      const t = v.currentTime - clip.start
      if (v.currentTime >= clip.end) { v.pause(); v.currentTime = clip.start; setPlaying(false) }
      drawFrame(ctx, v, { clip, groups, framing: clip.framing, options, t: Math.max(0, t) })
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  })

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.pause(); setPlaying(false)
    const seekStart = () => { v.currentTime = clip.start }
    if (v.readyState >= 1) seekStart(); else v.addEventListener('loadedmetadata', seekStart, { once: true })
  }, [clip.id, clip.start, srcUrl])

  function togglePlay() {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      if (v.currentTime < clip.start || v.currentTime >= clip.end - 0.1) v.currentTime = clip.start
      v.play(); setPlaying(true)
    } else { v.pause(); setPlaying(false) }
  }

  function nudge(field, d) {
    const dur = project.duration
    let { start, end } = clip
    if (field === 'start') start = Math.max(0, Math.min(end - 3, start + d))
    else end = Math.min(dur, Math.max(start + 3, end + d))
    onChange({ ...clip, start, end, framing: null, renderKey: null })
  }

  async function exportClip() {
    setError(null)
    const ctrl = new AbortController(); abortRef.current = ctrl
    videoRef.current?.pause(); setPlaying(false)
    setRendering(0)
    try {
      const { blob, ext } = await renderClip({ src: srcUrl, clip, words, framing: clip.framing, options, onProgress: setRendering, signal: ctrl.signal })
      const key = `render_${project.id}_${clip.id}_${Date.now()}`
      await putBlob(key, blob).catch(() => {})
      onChange({ ...clip, renderKey: key })
      const url = URL.createObjectURL(blob)
      setRenderUrl(url); setRenderMeta({ blob, ext })
      downloadBlob(blob, `${slug(clip.title)}.${ext}`)
    } catch (e) {
      if (e.message !== 'CANCELLED') setError(e.message)
    } finally { setRendering(null); abortRef.current = null }
  }

  const hf = useHiggsfield()

  async function dub() {
    if (!renderMeta?.blob) return
    setError(null)
    if (!hf.connected && !(await hf.connect().catch(e => { setError(e.message); return false }))) return
    setDubbing(0)
    try {
      const url = await dubClip(renderMeta.blob, dubLang, { onProgress: setDubbing })
      onChange({ ...clip, dubs: { ...(clip.dubs || {}), [dubLang]: { url, at: Date.now() } } })
    } catch (e) { setError(e.message) } finally { setDubbing(null) }
  }

  async function share() {
    if (!renderMeta?.blob) return
    const file = new File([renderMeta.blob], `${slug(clip.title)}.${renderMeta.ext}`, { type: renderMeta.blob.type })
    const text = `${clip.caption || clip.title}\n\n${(clip.hashtags || []).map(h => '#' + h).join(' ')}`
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], text, title: clip.title }) } catch {}
    } else setError('Sharing files works on phones and Safari. Download the clip, then upload it on TikTok, Instagram or YouTube.')
  }

  const caption = `${clip.caption || clip.title}\n\n${(clip.hashtags || []).map(h => '#' + h).join(' ')}`.trim()
  const layoutUsed = options.layout === 'auto' ? (clip.framing?.layout || '…') : options.layout

  return (
    <div className="lavi-editor" style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 360px) 1fr', gap: 22, alignItems: 'start' }}>
      {/* Preview */}
      <div style={{ position: 'sticky', top: 'calc(var(--nav-h) + 16px)' }}>
        <div style={{ position: 'relative', borderRadius: 22, overflow: 'hidden', background: '#000', aspectRatio: '9/16', boxShadow: 'var(--shadow-lg)' }}>
          <canvas ref={canvasRef} width={OUT_W} height={OUT_H} style={{ width: '100%', height: '100%', display: 'block' }} onClick={togglePlay} />
          {!playing && (
            <button onClick={togglePlay} aria-label="Play preview" style={{ position: 'absolute', inset: 0, margin: 'auto', width: 64, height: 64, borderRadius: '50%', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontSize: 22, cursor: 'pointer' }}>▶</button>
          )}
          {framingBusy && (
            <div style={{ position: 'absolute', left: 12, right: 12, bottom: 18, padding: '8px 10px', borderRadius: 10, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 11.5 }}>
              Finding faces for smart crop… {Math.round(framingProgress * 100)}%
            </div>
          )}
        </div>
        <video ref={videoRef} src={srcUrl} playsInline preload="auto" style={{ display: 'none' }} onEnded={() => setPlaying(false)} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontSize: 12.5, color: 'var(--text-secondary)' }}>
          <span>{fmtTime(clip.start)} – {fmtTime(clip.end)} · {Math.round(clip.end - clip.start)}s</span>
          <span title={clip.framing?.reason}>Layout: <b style={{ color: 'var(--text-primary)' }}>{layoutUsed}</b></span>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
        <Card style={{ padding: 18 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
            <ScoreBadge score={clip.score} />
            <input value={clip.title} onChange={e => onChange({ ...clip, title: e.target.value })} style={{ ...inputStyle, background: 'transparent', border: 'none', padding: 0, fontSize: 18, fontWeight: 800, letterSpacing: '-0.3px' }} />
          </div>
          {clip.reason && <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 14 }}>{clip.reason}</p>}
          <Label>Trim</Label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', width: 38 }}>Start</span>
            <Btn size="sm" kind="secondary" onClick={() => nudge('start', -1)}>−1s</Btn>
            <Btn size="sm" kind="secondary" onClick={() => nudge('start', 1)}>+1s</Btn>
            <span style={{ width: 18 }} />
            <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', width: 30 }}>End</span>
            <Btn size="sm" kind="secondary" onClick={() => nudge('end', -1)}>−1s</Btn>
            <Btn size="sm" kind="secondary" onClick={() => nudge('end', 1)}>+1s</Btn>
          </div>
        </Card>

        <Card style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <Label hint="first 3 seconds">Hook text</Label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input value={clip.hook} onChange={e => onChange({ ...clip, hook: e.target.value, renderKey: null })} placeholder="e.g. Nobody tells you this about…" style={inputStyle} />
              <Toggle on={options.hook} onChange={v => setOpt('hook', v)} label="" />
            </div>
          </div>
          <div>
            <Label>Captions</Label>
            <Segmented size="sm" value={options.captionStyle} onChange={v => setOpt('captionStyle', v)} options={Object.entries(CAPTION_STYLES).map(([k, s]) => [k, s.label])} />
            <div style={{ display: 'flex', gap: 16, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ fontSize: 12.5, color: 'var(--text-secondary)', display: 'flex', gap: 8, alignItems: 'center' }}>
                Position
                <input type="range" min={0.45} max={0.85} step={0.01} value={options.captionY} onChange={e => setOpt('captionY', Number(e.target.value))} />
              </label>
              <label style={{ fontSize: 12.5, color: 'var(--text-secondary)', display: 'flex', gap: 8, alignItems: 'center' }}>
                Words per line
                <Segmented size="sm" value={options.wordsPerLine} onChange={v => setOpt('wordsPerLine', v)} options={[[1, '1'], [2, '2'], [3, '3'], [5, '5']]} />
              </label>
            </div>
          </div>
          <div>
            <Label>Framing</Label>
            <Segmented size="sm" value={options.layout} onChange={v => setOpt('layout', v)} options={LAYOUTS} />
            {clip.framing?.reason && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 7 }}>{clip.framing.reason}</div>}
          </div>
          <div>
            <Label>Color grade</Label>
            <Segmented size="sm" value={options.grade} onChange={v => setOpt('grade', v)} options={Object.entries(GRADES).map(([k, g]) => [k, g.label])} />
          </div>
          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'center' }}>
            <Toggle on={options.zoom} onChange={v => setOpt('zoom', v)} label="Zoom punch-ins" />
            <Toggle on={options.progressBar} onChange={v => setOpt('progressBar', v)} label="Progress bar" />
            <input value={options.handle} onChange={e => setOpt('handle', e.target.value)} placeholder="@handle watermark" style={{ ...inputStyle, width: 170, padding: '7px 11px', fontSize: 13 }} />
          </div>
        </Card>

        <Card style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ErrorNote onClose={() => setError(null)}>{error}</ErrorNote>
          {rendering != null ? (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ flex: 1 }}><Progress value={rendering} label="Rendering your short" sub={`${Math.round(rendering * 100)}% · keep this tab open`} /></div>
              <Btn size="sm" kind="ghost" onClick={() => abortRef.current?.abort()}>Cancel</Btn>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Btn onClick={exportClip} disabled={framingBusy && !clip.framing}>{framingBusy && !clip.framing ? 'Framing…' : renderUrl ? 'Re-export' : 'Export video'}</Btn>
              {renderMeta && <Btn kind="secondary" onClick={() => downloadBlob(renderMeta.blob, `${slug(clip.title)}.${renderMeta.ext}`)}>Download {renderMeta.ext.toUpperCase()}</Btn>}
              {renderMeta && <Btn kind="secondary" onClick={share}>Share…</Btn>}
            </div>
          )}

          {renderMeta && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
              <div>
                <Label hint="lip-synced, via Higgsfield">Dub into another language</Label>
                <div style={{ marginBottom: 10 }}><HiggsfieldNotice what="Dubbing" /></div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select value={dubLang} onChange={e => setDubLang(e.target.value)} style={{ ...inputStyle, width: 170, padding: '8px 11px' }}>
                    {DUB_LANGUAGES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                  </select>
                  <Btn kind="secondary" disabled={dubbing != null} onClick={dub}>{dubbing != null ? `Dubbing… ${Math.round(dubbing * 100)}%` : 'Dub clip'}</Btn>
                </div>
                {Object.entries(clip.dubs || {}).length > 0 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                    {Object.entries(clip.dubs).map(([k, d]) => (
                      <Btn key={k} size="sm" kind="ghost" onClick={() => downloadUrl(d.url, `${slug(clip.title)}-${k}.mp4`)}>⬇ {DUB_LANGUAGES.find(l => l[0] === k)?.[1] || k}</Btn>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Label>Post it</Label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <CopyBtn text={caption} label="Copy caption + hashtags" />
                  <a href="https://www.tiktok.com/tiktokstudio/upload" target="_blank" rel="noreferrer"><Btn size="sm" kind="ghost">TikTok ↗</Btn></a>
                  <a href="https://www.instagram.com/" target="_blank" rel="noreferrer"><Btn size="sm" kind="ghost">Instagram ↗</Btn></a>
                  <a href="https://www.youtube.com/upload" target="_blank" rel="noreferrer"><Btn size="sm" kind="ghost">YouTube Shorts ↗</Btn></a>
                </div>
              </div>
            </div>
          )}
        </Card>

        <Card style={{ padding: 18 }}>
          <Label>Caption</Label>
          <textarea value={clip.caption} onChange={e => onChange({ ...clip, caption: e.target.value })} rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
          <input value={(clip.hashtags || []).map(h => '#' + h).join(' ')} onChange={e => onChange({ ...clip, hashtags: e.target.value.split(/[\s,]+/).map(t => t.replace(/^#/, '')).filter(Boolean) })} style={{ ...inputStyle, marginTop: 8, fontSize: 13, color: '#8B5CF6' }} />
        </Card>
      </div>
    </div>
  )
}
