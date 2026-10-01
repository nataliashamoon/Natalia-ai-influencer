import { useEffect, useMemo, useRef } from 'react'
import { drawFrame, buildCaptionGroups, ensureFonts, OUT_W, OUT_H } from '../../utils/shorts/render'
import { clipOptions } from './useClipActions'

// Live 9:16 preview of a clip: the source video drawn through the same renderer
// the export uses, so captions, hook, framing and grade look exactly as exported.
// Parent owns play state so only one preview plays at a time.
export default function ClipPreview({ clip, srcUrl, words, playing, onPlayingChange, overlay, style }) {
  const canvasRef = useRef(null)
  const videoRef = useRef(null)
  const options = clipOptions(clip)
  const groups = useMemo(() => buildCaptionGroups(words, clip.start, clip.end, options.wordsPerLine), [words, clip.start, clip.end, options.wordsPerLine])

  useEffect(() => {
    const v = videoRef.current, c = canvasRef.current
    if (!v || !c) return
    const ctx = c.getContext('2d')
    let raf
    ensureFonts()
    const loop = () => {
      if (v.currentTime >= clip.end) { v.pause(); v.currentTime = clip.start; onPlayingChange?.(false) }
      if (v.readyState >= 2) drawFrame(ctx, v, { clip, groups, framing: clip.framing, options, t: Math.max(0, v.currentTime - clip.start) })
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  })

  // Park on the first frame whenever the clip changes
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.pause()
    const seekStart = () => { v.currentTime = clip.start }
    if (v.readyState >= 1) seekStart(); else v.addEventListener('loadedmetadata', seekStart, { once: true })
  }, [clip.id, clip.start, srcUrl])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (playing) {
      if (v.currentTime < clip.start || v.currentTime >= clip.end - 0.1) v.currentTime = clip.start
      v.play().catch(() => onPlayingChange?.(false))
    } else v.pause()
  }, [playing])

  return (
    <div style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', background: '#000', aspectRatio: '9/16', ...style }}>
      <canvas ref={canvasRef} width={OUT_W} height={OUT_H} onClick={() => onPlayingChange?.(!playing)} style={{ width: '100%', height: '100%', display: 'block', cursor: 'pointer' }} />
      {!playing && (
        <button onClick={() => onPlayingChange?.(true)} aria-label="Play preview" style={{ position: 'absolute', inset: 0, margin: 'auto', width: 58, height: 58, borderRadius: '50%', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontSize: 20, cursor: 'pointer' }}>▶</button>
      )}
      {overlay}
      <video ref={videoRef} src={srcUrl} playsInline preload="metadata" style={{ display: 'none' }} onEnded={() => onPlayingChange?.(false)} />
    </div>
  )
}
