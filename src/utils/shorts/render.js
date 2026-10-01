// Draws a vertical short onto a canvas — reframed video, burned-in captions,
// hook text, color grade and zoom punch-ins — and records it with MediaRecorder.
// The same drawFrame() powers the live preview and the final export.

import { GRADES } from './ai'
import { sampleAt } from './reframe'

export const OUT_W = 1080
export const OUT_H = 1920

export const CAPTION_STYLES = {
  bold:    { label: 'Bold pop',   upper: true,  size: 84, fill: '#FFFFFF', active: '#FFE14D', stroke: 14, box: false, shadow: true },
  brand:   { label: 'Lavi pink',  upper: true,  size: 84, fill: '#FFFFFF', active: '#FF4FB0', stroke: 14, box: false, shadow: true },
  karaoke: { label: 'Highlight',  upper: false, size: 78, fill: '#FFFFFF', active: '#111111', stroke: 0,  box: true,  boxColor: '#FFE14D', shadow: true },
  clean:   { label: 'Clean',      upper: false, size: 66, fill: '#FFFFFF', active: '#FFFFFF', stroke: 0,  box: false, shadow: true, weight: 700 },
  none:    { label: 'No captions' },
}

export const DEFAULT_OPTIONS = {
  layout: 'auto',            // auto | track | split | fit | center
  captionStyle: 'bold',
  captionY: 0.68,            // 0..1 from top
  wordsPerLine: 3,
  hook: true,
  hookSeconds: 3.2,
  grade: 'punchy',
  zoom: true,
  progressBar: true,
  handle: '',
}

// ── Caption grouping ──
export function buildCaptionGroups(words, start, end, perGroup = 3) {
  const inClip = words.filter(w => w.end > start && w.start < end)
  const groups = []
  let cur = []
  for (const w of inClip) {
    cur.push(w)
    const punct = /[.!?,;:]$/.test(w.text)
    if (cur.length >= perGroup || punct) { groups.push(cur); cur = [] }
  }
  if (cur.length) groups.push(cur)
  return groups.map(g => ({
    start: g[0].start - start,
    end: g[g.length - 1].end - start,
    words: g.map(w => ({ text: w.text.replace(/^[^\p{L}\p{N}$£€]+|[^\p{L}\p{N}!?%']+$/gu, '') || w.text, start: w.start - start, end: w.end - start })),
  }))
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
}

function wrapLines(ctx, text, maxW) {
  const words = text.split(/\s+/)
  const lines = []
  let line = ''
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w } else line = test
  }
  if (line) lines.push(line)
  return lines
}

// ── Video placement per layout ──
function drawCover(ctx, video, sx, sy, sw, sh, dx, dy, dw, dh) {
  ctx.drawImage(video, sx, sy, sw, sh, dx, dy, dw, dh)
}

function cropForAspect(vw, vh, aspect, cx) {
  // crop a region with width/height = aspect, centered horizontally at cx (0..1)
  let sw, sh
  if (vw / vh > aspect) { sh = vh; sw = vh * aspect } else { sw = vw; sh = vw / aspect }
  const sx = Math.max(0, Math.min(vw - sw, cx * vw - sw / 2))
  const sy = Math.max(0, (vh - sh) / 2)
  return [sx, sy, sw, sh]
}

function drawVideoLayer(ctx, video, layout, framing, t, zoom) {
  const vw = video.videoWidth, vh = video.videoHeight
  if (!vw || !vh) return
  ctx.save()
  if (zoom > 1.0001) {
    ctx.translate(OUT_W / 2, OUT_H * 0.45)
    ctx.scale(zoom, zoom)
    ctx.translate(-OUT_W / 2, -OUT_H * 0.45)
  }
  if (layout === 'split' && framing?.splitPaths) {
    const half = OUT_H / 2
    const [pa, pb] = framing.splitPaths
    drawCover(ctx, video, ...cropForAspect(vw, vh, OUT_W / half, sampleAt(pa, t)), 0, 0, OUT_W, half)
    drawCover(ctx, video, ...cropForAspect(vw, vh, OUT_W / half, sampleAt(pb, t)), 0, half, OUT_W, half)
    ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, half - 3, OUT_W, 6)
  } else if (layout === 'fit') {
    ctx.filter = 'blur(40px) brightness(0.55) saturate(1.2)'
    drawCover(ctx, video, ...cropForAspect(vw, vh, OUT_W / OUT_H, 0.5), -60, -60, OUT_W + 120, OUT_H + 120)
    ctx.filter = 'none'
    const scale = Math.min(OUT_W / vw, OUT_H / vh)
    const dw = vw * scale, dh = vh * scale
    ctx.drawImage(video, (OUT_W - dw) / 2, (OUT_H - dh) / 2 - OUT_H * 0.04, dw, dh)
  } else {
    const cx = layout === 'track' ? sampleAt(framing?.path, t) : 0.5
    drawCover(ctx, video, ...cropForAspect(vw, vh, OUT_W / OUT_H, cx), 0, 0, OUT_W, OUT_H)
  }
  ctx.restore()
}

// ── Main frame draw ──
export function drawFrame(ctx, video, { clip, groups, framing, options, t }) {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const layout = opts.layout === 'auto' ? (framing?.layout || 'center') : opts.layout
  const dur = clip.end - clip.start

  // zoom punch-in on emphasized words
  let zoom = 1
  if (opts.zoom && clip.emphasis?.length) {
    for (const g of groups) for (const w of g.words) {
      if (clip.emphasis.includes(w.text.toLowerCase().replace(/[^\p{L}\p{N}']/gu, ''))) {
        const k = (t - w.start) / 0.9
        if (k >= 0 && k <= 1) zoom = Math.max(zoom, 1 + 0.09 * Math.sin(Math.PI * Math.min(1, k * 1.6)) * (k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4 * 0.4))
      }
    }
  }

  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, OUT_W, OUT_H)
  ctx.filter = GRADES[opts.grade]?.filter || 'none'
  drawVideoLayer(ctx, video, layout, framing, t, zoom)
  ctx.filter = 'none'

  // Captions
  const style = CAPTION_STYLES[opts.captionStyle]
  if (style && style.size) {
    const g = groups.find(g => t >= g.start - 0.05 && t <= g.end + 0.25)
    if (g) drawCaption(ctx, g, t, style, opts.captionY)
  }

  // Hook
  if (opts.hook && clip.hook && t < opts.hookSeconds) drawHook(ctx, clip.hook, t, opts.hookSeconds)

  // Handle watermark
  if (opts.handle) {
    ctx.font = '600 34px Inter, sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 8
    ctx.fillText(opts.handle.startsWith('@') ? opts.handle : '@' + opts.handle, OUT_W / 2, OUT_H - 120)
    ctx.shadowBlur = 0
  }

  // Retention progress bar
  if (opts.progressBar) {
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(0, OUT_H - 10, OUT_W, 10)
    const grad = ctx.createLinearGradient(0, 0, OUT_W, 0)
    grad.addColorStop(0, '#EC4899'); grad.addColorStop(1, '#8B5CF6')
    ctx.fillStyle = grad; ctx.fillRect(0, OUT_H - 10, OUT_W * Math.min(1, t / dur), 10)
  }
}

function drawCaption(ctx, group, t, style, captionY) {
  const weight = style.weight || 900
  const size = style.size
  ctx.font = `${weight} ${size}px Inter, "Arial Black", sans-serif`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  const words = group.words.map(w => ({ ...w, label: style.upper ? w.text.toUpperCase() : w.text }))
  const space = size * 0.28
  const maxW = OUT_W * 0.86
  // layout words into lines
  const lines = [[]]
  let lw = 0
  for (const w of words) {
    const ww = ctx.measureText(w.label).width
    if (lw + ww > maxW && lines[lines.length - 1].length) { lines.push([]); lw = 0 }
    lines[lines.length - 1].push({ ...w, ww })
    lw += ww + space
  }
  const lineH = size * 1.18
  const enter = Math.min(1, Math.max(0, (t - group.start) / 0.12))
  const pop = 0.86 + 0.14 * (1 - Math.pow(1 - enter, 3))
  const baseY = OUT_H * captionY - ((lines.length - 1) * lineH) / 2

  ctx.save()
  ctx.translate(OUT_W / 2, OUT_H * captionY)
  ctx.scale(pop, pop)
  ctx.translate(-OUT_W / 2, -OUT_H * captionY)
  lines.forEach((line, li) => {
    const total = line.reduce((s, w) => s + w.ww, 0) + space * (line.length - 1)
    let x = (OUT_W - total) / 2
    const y = baseY + li * lineH
    for (const w of line) {
      const active = t >= w.start - 0.04 && t <= w.end + 0.06
      if (style.box && active) {
        ctx.fillStyle = style.boxColor
        roundRect(ctx, x - 16, y - size * 0.62, w.ww + 32, size * 1.24, 18); ctx.fill()
      }
      if (style.shadow) { ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4 }
      if (style.stroke) {
        ctx.lineJoin = 'round'; ctx.miterLimit = 2
        ctx.strokeStyle = '#000'; ctx.lineWidth = style.stroke
        ctx.strokeText(w.label, x, y)
        ctx.shadowColor = 'transparent'
      }
      ctx.fillStyle = active ? style.active : style.fill
      ctx.fillText(w.label, x, y)
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0
      x += w.ww + space
    }
  })
  ctx.restore()
}

function drawHook(ctx, text, t, dur) {
  const inK = Math.min(1, t / 0.3)
  const outK = Math.min(1, Math.max(0, (dur - t) / 0.3))
  const alpha = outK // visible from the very first frame so it lands in the thumbnail
  const scale = 0.94 + 0.06 * (1 - Math.pow(1 - inK, 3))
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.font = '800 64px Inter, sans-serif'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  const lines = wrapLines(ctx, text, OUT_W * 0.74)
  const lineH = 78
  const boxW = Math.min(OUT_W * 0.86, Math.max(...lines.map(l => ctx.measureText(l).width)) + 90)
  const boxH = lines.length * lineH + 56
  const cy = OUT_H * 0.2
  ctx.translate(OUT_W / 2, cy); ctx.scale(scale, scale); ctx.translate(-OUT_W / 2, -cy)
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 8
  ctx.fillStyle = '#FFFFFF'
  roundRect(ctx, (OUT_W - boxW) / 2, cy - boxH / 2, boxW, boxH, 28); ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.fillStyle = '#111111'
  lines.forEach((l, i) => ctx.fillText(l, OUT_W / 2, cy - ((lines.length - 1) * lineH) / 2 + i * lineH))
  ctx.restore()
}

// ── Export ──
function pickMime() {
  const opts = [
    'video/mp4;codecs=avc1.640028,mp4a.40.2',
    'video/mp4;codecs=avc1.42E01F,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ]
  return opts.find(m => window.MediaRecorder?.isTypeSupported?.(m)) || ''
}

export async function ensureFonts() {
  try { await Promise.all(['900 84px Inter', '800 64px Inter', '700 66px Inter'].map(f => document.fonts.load(f))) } catch {}
}

// Renders one clip in real time. Resolves with { blob, mime, ext }.
export async function renderClip({ src, clip, words, framing, options, onProgress, onPausedChange, signal }) {
  await ensureFonts()
  const video = document.createElement('video')
  video.src = src
  video.playsInline = true
  video.preload = 'auto'
  video.crossOrigin = 'anonymous'
  await new Promise((res, rej) => { video.onloadedmetadata = res; video.onerror = () => rej(new Error('Could not load video')) })

  const canvas = document.createElement('canvas')
  canvas.width = OUT_W; canvas.height = OUT_H
  const ctx = canvas.getContext('2d')
  const groups = buildCaptionGroups(words, clip.start, clip.end, options?.wordsPerLine || 3)

  // Route audio into the recording only (not the speakers)
  const AC = window.AudioContext || window.webkitAudioContext
  const actx = new AC()
  const srcNode = actx.createMediaElementSource(video)
  const dest = actx.createMediaStreamDestination()
  srcNode.connect(dest)
  // Browsers only start audio after the user has clicked on the page; without
  // that, resume() never settles, so don't wait on it forever.
  await Promise.race([actx.resume().catch(() => {}), new Promise(r => setTimeout(r, 3000))])
  if (actx.state !== 'running') {
    actx.close?.(); video.removeAttribute('src'); video.load()
    throw new Error('Your browser blocked audio for this export. Click anywhere on the page, then try again.')
  }

  const stream = canvas.captureStream(30)
  dest.stream.getAudioTracks().forEach(tr => stream.addTrack(tr))
  const mime = pickMime()
  const rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: 9_000_000, audioBitsPerSecond: 160_000 })
  const chunks = []
  rec.ondataavailable = e => { if (e.data?.size) chunks.push(e.data) }

  video.currentTime = clip.start
  await new Promise(r => { video.onseeked = r; setTimeout(r, 3000) })
  drawFrame(ctx, video, { clip, groups, framing, options, t: 0 })

  const done = new Promise(resolve => { rec.onstop = resolve })
  rec.start(250)
  try { await video.play() } catch (e) {
    rec.stop(); actx.close?.()
    throw new Error(e.name === 'NotAllowedError' ? 'Your browser blocked playback for this export. Click anywhere on the page, then try again.' : `Couldn't play the video: ${e.message}`)
  }

  const dur = clip.end - clip.start
  await new Promise((resolve, reject) => {
    let raf = null
    const tick = () => {
      raf = null
      if (signal?.aborted) { cleanup(); video.pause(); reject(new Error('CANCELLED')); return }
      const t = video.currentTime - clip.start
      drawFrame(ctx, video, { clip, groups, framing, options, t })
      onProgress?.(Math.min(1, t / dur))
      if (video.currentTime >= clip.end || video.ended) { cleanup(); video.pause(); resolve(); return }
      if (!document.hidden) raf = requestAnimationFrame(tick)
    }
    // A hidden tab only gets ~1 timer tick per second, which records a ~1 fps
    // clip. Pause the recording while hidden and pick up where it left off.
    const onVisibility = () => {
      if (document.hidden) {
        if (raf) cancelAnimationFrame(raf), raf = null
        video.pause(); if (rec.state === 'recording') rec.pause()
        onPausedChange?.(true)
      } else {
        onPausedChange?.(false)
        if (rec.state === 'paused') rec.resume()
        video.play().then(() => { if (!raf) raf = requestAnimationFrame(tick) }, () => {})
      }
    }
    const onAbort = () => { if (document.hidden) tick() }
    const cleanup = () => { document.removeEventListener('visibilitychange', onVisibility); signal?.removeEventListener('abort', onAbort) }
    document.addEventListener('visibilitychange', onVisibility)
    signal?.addEventListener('abort', onAbort)
    if (document.hidden) onVisibility(); else raf = requestAnimationFrame(tick)
  })

  rec.stop()
  await done
  actx.close?.()
  video.removeAttribute('src'); video.load()
  const type = mime.split(';')[0] || 'video/webm'
  return { blob: new Blob(chunks, { type }), mime: type, ext: type.includes('mp4') ? 'mp4' : 'webm' }
}
