import { useEffect, useRef, useState } from 'react'
import { renderClip, DEFAULT_OPTIONS } from '../../utils/shorts/render'
import { analyzeFraming } from '../../utils/shorts/reframe'
import { putBlob, getBlob } from '../../utils/shorts/db'
import { dubClip } from '../../utils/shorts/hf'
import { useHiggsfield, downloadBlob, slug } from './ui'

export function clipOptions(clip) {
  return { ...DEFAULT_OPTIONS, grade: clip.grade || DEFAULT_OPTIONS.grade, ...(clip.options || {}) }
}

export function clipCaption(clip) {
  return `${clip.caption || clip.title}\n\n${(clip.hashtags || []).map(h => '#' + h).join(' ')}`.trim()
}

// Face analysis for smart reframing. Loads its own muted video so it never
// fights the preview player for playback.
export function analyzeClipFraming(srcUrl, clip, onProgress) {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video')
    v.muted = true; v.preload = 'auto'
    v.onerror = () => reject(new Error('Could not load video'))
    v.onloadedmetadata = async () => {
      try {
        resolve(await analyzeFraming(v, clip.start, clip.end, { step: Math.max(0.5, (clip.end - clip.start) / 70), onProgress }))
      } catch (e) { reject(e) } finally { v.removeAttribute('src'); v.load() }
    }
    v.src = srcUrl
  })
}

// Export, dub and share for one clip — shared by the clip feed cards and the editor.
// `clip` must be the latest version; `onChange` saves it back into the project.
export function useClipActions({ project, clip, srcUrl, words, onChange }) {
  const [renderMeta, setRenderMetaState] = useState(null) // { blob, ext }
  const renderRef = useRef(null) // same value, readable right after a render finishes
  const setRenderMeta = m => { renderRef.current = m; setRenderMetaState(m) }
  const [rendering, setRendering] = useState(null)   // 0..1 while exporting
  const [dubbing, setDubbing] = useState(null)       // 0..1 while dubbing
  const [error, setError] = useState(null)
  const abortRef = useRef(null)
  const latest = useRef(clip)
  latest.current = clip
  const hf = useHiggsfield()

  // Pick up a render saved earlier for this clip
  useEffect(() => {
    setRenderMeta(null)
    if (!clip.renderKey) return
    let alive = true
    getBlob(clip.renderKey).then(b => { if (alive && b) setRenderMeta({ blob: b, ext: b.type.includes('mp4') ? 'mp4' : 'webm' }) })
    return () => { alive = false }
  }, [clip.id, clip.renderKey])

  const fileName = ext => `${slug(clip.title)}.${ext}`

  // Renders the clip (if it isn't already) and returns { blob, ext }
  async function ensureRender({ download = false } = {}) {
    const done = renderRef.current
    if (done) { if (download) downloadBlob(done.blob, fileName(done.ext)); return done }
    const ctrl = new AbortController(); abortRef.current = ctrl
    setError(null); setRendering(0)
    try {
      let c = latest.current
      if (!c.framing) {
        const framing = await analyzeClipFraming(srcUrl, c).catch(() => null)
        if (framing) { c = { ...c, framing }; onChange(c) }
      }
      const out = await renderClip({ src: srcUrl, clip: c, words, framing: c.framing, options: clipOptions(c), onProgress: setRendering, signal: ctrl.signal })
      const key = `render_${project.id}_${c.id}_${Date.now()}`
      await putBlob(key, out.blob).catch(() => {})
      onChange({ ...latest.current, framing: c.framing, renderKey: key })
      setRenderMeta(out)
      if (download) downloadBlob(out.blob, fileName(out.ext))
      return out
    } catch (e) {
      if (e.message !== 'CANCELLED') setError(e.message)
      return null
    } finally { setRendering(null); abortRef.current = null }
  }

  async function dub(lang) {
    setError(null)
    if (!hf.connected && !(await hf.connect().catch(e => { setError(e.message); return false }))) return
    const out = await ensureRender()
    if (!out) return
    setDubbing(0)
    try {
      const url = await dubClip(out.blob, lang, { onProgress: setDubbing })
      const c = latest.current
      onChange({ ...c, dubs: { ...(c.dubs || {}), [lang]: { url, at: Date.now() } } })
    } catch (e) { setError(e.message) } finally { setDubbing(null) }
  }

  // Phones (and Safari) can hand the file straight to TikTok/Instagram; elsewhere
  // copy the caption and download so the user can upload it themselves.
  async function share() {
    const out = await ensureRender()
    if (!out) return false
    const file = new File([out.blob], fileName(out.ext), { type: out.blob.type })
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], text: clipCaption(latest.current), title: clip.title }); return true } catch { return false }
    }
    return false
  }

  return {
    renderMeta, rendering, dubbing, error, setError, hf,
    exportClip: () => ensureRender({ download: true }),
    ensureRender, dub, share,
    cancel: () => abortRef.current?.abort(),
  }
}
