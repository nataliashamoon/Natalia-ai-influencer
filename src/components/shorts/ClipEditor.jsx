import { useEffect, useState } from 'react'
import { Card, Btn, Label, Segmented, Progress, Toggle, CopyBtn, inputStyle, ScoreBadge, ErrorNote, HiggsfieldNotice, downloadBlob, downloadUrl, slug } from './ui'
import { CAPTION_STYLES } from '../../utils/shorts/render'
import { GRADES } from '../../utils/shorts/ai'
import { fmtTime } from '../../utils/shorts/transcribe'
import { DUB_LANGUAGES } from '../../utils/shorts/hf'
import ClipPreview from './ClipPreview'
import { useClipActions, analyzeClipFraming, clipOptions, clipCaption } from './useClipActions'

const LAYOUTS = [['auto', 'Auto'], ['track', 'Follow face'], ['split', 'Split'], ['fit', 'Fit'], ['center', 'Center']]

export default function ClipEditor({ project, clip, srcUrl, onChange, words }) {
  const [playing, setPlaying] = useState(false)
  const [framingBusy, setFramingBusy] = useState(false)
  const [framingProgress, setFramingProgress] = useState(0)
  const [dubLang, setDubLang] = useState('spa')
  const actions = useClipActions({ project, clip, srcUrl, words, onChange })
  const { renderMeta, rendering, paused, dubbing, error, setError } = actions

  const options = clipOptions(clip)
  const setOpt = (k, v) => onChange({ ...clip, options: { ...(clip.options || {}), [k]: v }, renderKey: null })

  // Face analysis for smart reframing (cached on the clip)
  useEffect(() => {
    if (clip.framing || !srcUrl) return
    let cancelled = false
    setFramingBusy(true); setFramingProgress(0)
    analyzeClipFraming(srcUrl, clip, p => !cancelled && setFramingProgress(p))
      .then(f => { if (!cancelled) onChange({ ...clip, framing: f }) })
      .catch(e => console.warn(e))
      .finally(() => { if (!cancelled) setFramingBusy(false) })
    return () => { cancelled = true }
  }, [clip.id, clip.start, clip.end, srcUrl, !!clip.framing])

  function nudge(field, d) {
    const dur = project.duration
    let { start, end } = clip
    if (field === 'start') start = Math.max(0, Math.min(end - 3, start + d))
    else end = Math.min(dur, Math.max(start + 3, end + d))
    onChange({ ...clip, start, end, framing: null, renderKey: null })
  }

  async function share() {
    setPlaying(false)
    if (!(await actions.share())) setError('Sharing files works on phones and Safari. Download the clip, then upload it on TikTok, Instagram or YouTube.')
  }

  const caption = clipCaption(clip)
  const layoutUsed = options.layout === 'auto' ? (clip.framing?.layout || '…') : options.layout

  return (
    <div className="lavi-editor" style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 360px) 1fr', gap: 22, alignItems: 'start' }}>
      {/* Preview */}
      <div style={{ position: 'sticky', top: 'calc(var(--nav-h) + 16px)' }}>
        <ClipPreview clip={clip} srcUrl={srcUrl} words={words} playing={playing} onPlayingChange={setPlaying}
          style={{ borderRadius: 22, boxShadow: 'var(--shadow-lg)' }}
          overlay={framingBusy && (
            <div style={{ position: 'absolute', left: 12, right: 12, bottom: 18, padding: '8px 10px', borderRadius: 10, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 11.5 }}>
              Finding faces for smart crop… {Math.round(framingProgress * 100)}%
            </div>
          )} />
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
              <div style={{ flex: 1 }}><Progress value={rendering} label="Rendering your short" sub={paused ? 'Paused — come back to this tab to continue' : `${Math.round(rendering * 100)}% · keep this tab open`} /></div>
              <Btn size="sm" kind="ghost" onClick={actions.cancel}>Cancel</Btn>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Btn onClick={() => { setPlaying(false); actions.exportClip() }} disabled={framingBusy && !clip.framing}>{framingBusy && !clip.framing ? 'Framing…' : 'Export video'}</Btn>
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
                  <Btn kind="secondary" disabled={dubbing != null} onClick={() => actions.dub(dubLang)}>{dubbing != null ? `Dubbing… ${Math.round(dubbing * 100)}%` : 'Dub clip'}</Btn>
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
