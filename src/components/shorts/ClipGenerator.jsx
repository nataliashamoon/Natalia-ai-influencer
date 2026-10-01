import { useEffect, useRef, useState } from 'react'
import { Card, Btn, Label, Segmented, Progress, ScoreBadge, ErrorNote, inputStyle, G } from './ui'
import ClipEditor from './ClipEditor'
import YouTubeKit from './YouTubeKit'
import { decodeAudio, transcribeAudio, wordsToSegments, fmtTime } from '../../utils/shorts/transcribe'
import { detectMoments } from '../../utils/shorts/ai'
import { listProjects, saveProject, getProject, deleteProject, putBlob, getBlob } from '../../utils/shorts/db'
import { hasClaudeKey } from '../../utils/claudeClient'

const LENGTHS = [['short', '15–30s'], ['mid', '30–60s'], ['long', '60–90s']]
const LEN_RANGE = { short: [15, 30], mid: [30, 60], long: [60, 90] }
const LANGS = [['', 'Auto-detect'], ['en', 'English'], ['es', 'Spanish'], ['pt', 'Portuguese'], ['fr', 'French'], ['de', 'German'], ['it', 'Italian'], ['ar', 'Arabic'], ['hi', 'Hindi'], ['ja', 'Japanese'], ['ko', 'Korean'], ['zh', 'Chinese']]

const UNPLAYABLE = "Your browser can't play this video. It may be HEVC / H.265 (common for iPhone and TikTok downloads) — export or convert it to an H.264 MP4 and try again."

function videoDuration(url) {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video')
    // Chrome doesn't load media in a background tab, so the timeout only starts
    // counting while the tab is visible — otherwise this would wait forever.
    let waited = 0
    const tick = setInterval(() => {
      if (document.hidden) return
      if ((waited += 1) >= 20) { clearInterval(tick); reject(new Error(UNPLAYABLE)) }
    }, 1000)
    const done = fn => arg => { clearInterval(tick); fn(arg) }
    v.preload = 'metadata'; v.muted = true
    v.onloadedmetadata = done(() => resolve({ duration: v.duration, width: v.videoWidth, height: v.videoHeight }))
    v.onerror = done(() => reject(new Error(UNPLAYABLE)))
    v.src = url
  })
}

export default function ClipGenerator({ mode = 'clips' }) {
  const [projects, setProjects] = useState([])
  const [project, setProject] = useState(null)
  const [srcUrl, setSrcUrl] = useState(null)
  const [file, setFile] = useState(null)
  const [settings, setSettings] = useState({ count: 8, length: 'mid', quality: 'balanced', language: '', context: '' })
  const [stage, setStage] = useState(null) // {step, status, progress}
  const [error, setError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [view, setView] = useState(mode === 'youtube' ? 'youtube' : 'clips')
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef(null)
  const saveTimer = useRef(null)

  useEffect(() => { listProjects().then(setProjects).catch(() => {}) }, [])
  useEffect(() => () => { if (srcUrl) URL.revokeObjectURL(srcUrl) }, [srcUrl])

  function pickFile(f) {
    if (!f) return
    if (!f.type.startsWith('video/') && !/\.(mp4|mov|m4v|webm|mkv)$/i.test(f.name)) { setError('Please choose a video file (MP4, MOV, WebM).'); return }
    setError(null); setFile(f)
  }

  async function openProject(p) {
    setError(null)
    const full = await getProject(p.id)
    const blob = full?.sourceKey ? await getBlob(full.sourceKey) : null
    if (!blob) { setError('The original video for this project is no longer stored in this browser. Upload it again to keep editing.'); return }
    if (srcUrl) URL.revokeObjectURL(srcUrl)
    setSrcUrl(URL.createObjectURL(blob))
    setProject(full); setSelectedId(full.clips?.[0]?.id || null)
  }

  function updateProject(next) {
    setProject(next)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      // framing samples are bulky — keep only what rendering needs
      const slim = { ...next, clips: next.clips.map(c => c.framing ? { ...c, framing: { ...c.framing, samples: undefined } } : c) }
      saveProject(slim).then(() => listProjects().then(setProjects)).catch(() => {})
    }, 400)
  }

  async function run() {
    if (!file) return
    setError(null)
    const id = Math.random().toString(36).slice(2, 10)
    const url = URL.createObjectURL(file)
    try {
      setStage({ step: 1, status: document.hidden ? 'Waiting for this tab to be in front…' : 'Reading video…', progress: null })
      const meta = await videoDuration(url)
      setStage({ step: 1, status: 'Extracting audio…', progress: null })
      const audio = await decodeAudio(file, s => setStage(st => ({ ...st, status: s })))
      setStage({ step: 2, status: 'Loading speech model…', progress: null })
      const words = await transcribeAudio(audio, {
        quality: settings.quality, language: settings.language || null,
        onStatus: s => setStage(st => ({ ...st, status: s })),
        onProgress: p => setStage(st => ({ ...st, progress: p, status: `Transcribing… ${Math.round(p * 100)}%` })),
      })
      const segments = wordsToSegments(words)
      let clips = []
      if (mode !== 'youtube') {
        setStage({ step: 3, status: hasClaudeKey() ? 'Claude is scoring every moment…' : 'Scoring moments…', progress: null })
        const [minLen, maxLen] = LEN_RANGE[settings.length]
        clips = await detectMoments({ segments, duration: meta.duration, count: settings.count, minLen, maxLen, context: settings.context })
      }
      const sourceKey = `src_${id}`
      let stored = true
      try { await putBlob(sourceKey, file) } catch { stored = false }
      const p = {
        id, name: file.name.replace(/\.[^.]+$/, ''), createdAt: Date.now(), duration: meta.duration, width: meta.width, height: meta.height,
        sourceKey: stored ? sourceKey : null, words, segments, clips, context: settings.context, kind: mode,
      }
      await saveProject(p).catch(() => {})
      setSrcUrl(url); setProject(p); setSelectedId(clips[0]?.id || null); setFile(null)
      if (mode === 'youtube') setView('youtube')
      listProjects().then(setProjects)
    } catch (e) {
      URL.revokeObjectURL(url)
      setError(e.message || String(e))
    } finally { setStage(null) }
  }

  async function addMore() {
    if (!project) return
    setStage({ step: 3, status: 'Finding more moments…', progress: null })
    try {
      const [minLen, maxLen] = LEN_RANGE[settings.length]
      const more = await detectMoments({ segments: project.segments, duration: project.duration, count: settings.count + project.clips.length, minLen, maxLen, context: project.context })
      const fresh = more.filter(m => !project.clips.some(c => Math.min(c.end, m.end) - Math.max(c.start, m.start) > 3))
      updateProject({ ...project, clips: [...project.clips, ...fresh] })
      if (!fresh.length) setError('No new non-overlapping moments found.')
    } catch (e) { setError(e.message) } finally { setStage(null) }
  }

  const selected = project?.clips.find(c => c.id === selectedId)

  // ── Processing ──
  if (stage) {
    const steps = mode === 'youtube' ? ['Extract audio', 'Transcribe'] : ['Extract audio', 'Transcribe', 'Find viral moments']
    return (
      <Card style={{ padding: 32, maxWidth: 560, margin: '30px auto' }}>
        <h3 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 6 }}>Working on it</h3>
        <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 24 }}>Everything runs in your browser — keep this tab open.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
          {steps.map((s, i) => {
            const n = i + 1, done = stage.step > n, active = stage.step === n
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, color: done || active ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: active ? 700 : 500 }}>
                <span style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, background: done ? G : active ? 'var(--text-primary)' : 'var(--bg-tertiary)', color: done || active ? '#fff' : 'var(--text-tertiary)' }}>{done ? '✓' : n}</span>
                {s}
              </div>
            )
          })}
        </div>
        <Progress value={stage.progress} label={stage.status} sub={stage.progress != null ? undefined : ''} />
      </Card>
    )
  }

  // ── Project open ──
  if (project) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
          <Btn kind="ghost" size="sm" onClick={() => { setProject(null); setSelectedId(null) }}>← Projects</Btn>
          <h3 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.3px', marginRight: 'auto' }}>{project.name}</h3>
          <Segmented size="sm" value={view} onChange={setView} options={[['clips', `Clips (${project.clips.length})`], ['youtube', 'YouTube kit'], ['transcript', 'Transcript']]} />
        </div>
        <ErrorNote onClose={() => setError(null)}>{error}</ErrorNote>

        {view === 'clips' && (
          project.clips.length === 0 ? (
            <Card style={{ padding: 30, textAlign: 'center' }}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 14 }}>No clips yet for this video.</p>
              <Btn onClick={addMore}>Find viral clips</Btn>
            </Card>
          ) : (
            <div className="lavi-clips" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 22, alignItems: 'start', marginTop: 4 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {project.clips.map((c, i) => {
                  const on = c.id === selectedId
                  return (
                    <button key={c.id} onClick={() => setSelectedId(c.id)} style={{
                      textAlign: 'left', padding: 14, borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit',
                      background: on ? 'var(--surface)' : 'transparent', border: on ? '1.5px solid #8B5CF6' : '1px solid var(--border-subtle)',
                      boxShadow: on ? '0 0 0 4px rgba(139,92,246,0.10)' : 'none', color: 'var(--text-primary)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-tertiary)' }}>#{i + 1}</span>
                        <ScoreBadge score={c.score} />
                        <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text-tertiary)' }}>{Math.round(c.end - c.start)}s</span>
                        {c.renderKey && <span title="Exported" style={{ fontSize: 11, color: '#10B981' }}>●</span>}
                      </div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.35, marginBottom: 4 }}>{c.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{fmtTime(c.start)} – {fmtTime(c.end)}</div>
                    </button>
                  )
                })}
                <Btn kind="ghost" size="sm" onClick={addMore}>+ Find more clips</Btn>
              </div>
              {selected && (
                <ClipEditor
                  key={selected.id}
                  project={project}
                  clip={selected}
                  srcUrl={srcUrl}
                  words={project.words}
                  onChange={c => updateProject({ ...project, clips: project.clips.map(x => x.id === c.id ? c : x) })}
                />
              )}
            </div>
          )
        )}

        {view === 'youtube' && <YouTubeKit project={project} srcUrl={srcUrl} onChange={updateProject} />}

        {view === 'transcript' && (
          <Card style={{ padding: 22, maxHeight: '70vh', overflow: 'auto' }}>
            {project.segments.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>No speech was detected in this video.</p>}
            {project.segments.map((s, i) => (
              <p key={i} style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#8B5CF6', fontWeight: 700, marginRight: 10, fontVariantNumeric: 'tabular-nums' }}>{fmtTime(s.start)}</span>{s.text}
              </p>
            ))}
          </Card>
        )}
      </div>
    )
  }

  // ── New project ──
  return (
    <div style={{ display: 'grid', gap: 22 }}>
      <ErrorNote onClose={() => setError(null)}>{error}</ErrorNote>
      <div className="lavi-new" style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 22, alignItems: 'stretch' }}>
        <div
          onClick={() => fileInput.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files?.[0]) }}
          style={{
            borderRadius: 22, border: `2px dashed ${dragging ? '#8B5CF6' : 'var(--border)'}`, background: dragging ? 'rgba(139,92,246,0.06)' : 'var(--surface)',
            minHeight: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, cursor: 'pointer', padding: 30, textAlign: 'center',
            transition: 'all 0.15s',
          }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: G, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 30px rgba(139,92,246,0.35)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
          </div>
          {file ? (
            <>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{file.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{(file.size / 1e6).toFixed(0)} MB · click to change</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.3px' }}>{mode === 'youtube' ? 'Drop your long-form video' : 'Drop a podcast, webinar, stream or vlog'}</div>
              <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', maxWidth: 360, lineHeight: 1.5 }}>MP4, MOV or WebM at full resolution. Your video stays on your computer — nothing is uploaded to find clips.</div>
            </>
          )}
          <input ref={fileInput} type="file" accept="video/*,.mkv" style={{ display: 'none' }} onChange={e => { pickFile(e.target.files?.[0]); e.target.value = '' }} />
        </div>

        <Card style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {mode !== 'youtube' && (
            <>
              <div>
                <Label hint={`${settings.count}`}>Number of clips</Label>
                <input type="range" min={3} max={15} value={settings.count} onChange={e => setSettings(s => ({ ...s, count: Number(e.target.value) }))} style={{ width: '100%' }} />
              </div>
              <div>
                <Label>Clip length</Label>
                <Segmented value={settings.length} onChange={v => setSettings(s => ({ ...s, length: v }))} options={LENGTHS} />
              </div>
            </>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <Label>Transcription</Label>
              <select value={settings.quality} onChange={e => setSettings(s => ({ ...s, quality: e.target.value }))} style={{ ...inputStyle, padding: '9px 11px' }}>
                <option value="fast">Fast</option>
                <option value="balanced">Balanced</option>
                <option value="accurate">Most accurate</option>
              </select>
            </div>
            <div>
              <Label>Language</Label>
              <select value={settings.language} onChange={e => setSettings(s => ({ ...s, language: e.target.value }))} style={{ ...inputStyle, padding: '9px 11px' }}>
                {LANGS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
              </select>
            </div>
          </div>
          <div>
            <Label hint="optional">What's this channel about?</Label>
            <input value={settings.context} onChange={e => setSettings(s => ({ ...s, context: e.target.value }))} placeholder="e.g. skincare brand talking to women 25–40" style={inputStyle} />
          </div>
          {!hasClaudeKey() && (
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, padding: '10px 12px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
              Add a Claude key in <a href="/settings" style={{ color: '#D97706', fontWeight: 700 }}>Settings</a> for AI-picked viral moments, hooks and captions. Without it, a simpler offline scorer is used.
            </div>
          )}
          <Btn size="lg" disabled={!file} onClick={run} style={{ marginTop: 'auto' }}>{mode === 'youtube' ? 'Build YouTube kit' : 'Find viral clips'}</Btn>
        </Card>
      </div>

      {projects.length > 0 && (
        <div>
          <Label>Recent projects</Label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 12 }}>
            {projects.map(p => (
              <Card key={p.id} style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={() => openProject(p)} style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', fontFamily: 'inherit', minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>{fmtTime(p.duration)} · {p.clips?.length || 0} clips · {new Date(p.updatedAt || p.createdAt).toLocaleDateString()}</div>
                </button>
                <button title="Delete project" onClick={async () => { if (confirm(`Delete "${p.name}"?`)) { await deleteProject(p); setProjects(await listProjects()) } }} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 16 }}>×</button>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
