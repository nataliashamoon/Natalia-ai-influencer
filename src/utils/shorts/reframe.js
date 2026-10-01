// Smart 9:16 reframing. Samples frames from a clip, finds faces with MediaPipe,
// and picks a layout:
//   track  – one main speaker: a virtual camera follows their face
//   split  – two people far apart (podcast): stacked top/bottom
//   fit    – no faces (screencast, b-roll): full frame over a blurred fill
// MediaPipe loads from the CDN on first use; if it can't load we fall back to a center crop.

const MP_VER = '1.0.1'
const MP_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VER}/vision_bundle.mjs`
const MP_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VER}/wasm`
const FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite'

let detectorPromise = null
async function getDetector() {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const { FilesetResolver, FaceDetector } = await import(/* @vite-ignore */ MP_URL)
      const fileset = await FilesetResolver.forVisionTasks(MP_WASM)
      const make = delegate => FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: FACE_MODEL, delegate },
        runningMode: 'IMAGE',
        minDetectionConfidence: 0.45,
      })
      try { return await make('GPU') } catch { return await make('CPU') }
    })().catch(e => { detectorPromise = null; throw e })
  }
  return detectorPromise
}

function seek(video, t) {
  return new Promise(resolve => {
    const done = () => { video.removeEventListener('seeked', done); resolve() }
    video.addEventListener('seeked', done)
    video.currentTime = t
    setTimeout(done, 2500) // never hang on a bad seek
  })
}

export async function analyzeFraming(video, start, end, { step = 0.5, onProgress } = {}) {
  let detector
  try { detector = await getDetector() } catch (e) {
    console.warn('[reframe] face detector unavailable, using center crop:', e?.message)
    return { layout: 'center', samples: [], reason: 'Face tracking unavailable — centered crop' }
  }

  const vw = video.videoWidth, vh = video.videoHeight
  const scale = Math.min(1, 640 / vw)
  const c = document.createElement('canvas')
  c.width = Math.round(vw * scale); c.height = Math.round(vh * scale)
  const ctx = c.getContext('2d', { willReadFrequently: true })

  const samples = []
  const total = Math.max(1, Math.ceil((end - start) / step))
  for (let i = 0, t = start; t < end; i++, t += step) {
    await seek(video, t)
    ctx.drawImage(video, 0, 0, c.width, c.height)
    let faces = []
    try {
      const res = detector.detect(c)
      faces = (res.detections || []).map(d => {
        const b = d.boundingBox
        return { cx: (b.originX + b.width / 2) / c.width, cy: (b.originY + b.height / 2) / c.height, w: b.width / c.width, h: b.height / c.height, score: d.categories?.[0]?.score ?? 0 }
      }).filter(f => f.w > 0.03).sort((a, b) => b.w * b.h - a.w * a.h)
    } catch {}
    samples.push({ t: t - start, faces })
    onProgress?.(Math.min(1, (i + 1) / total))
  }

  const withFace = samples.filter(s => s.faces.length)
  const twoApart = samples.filter(s => s.faces.length >= 2 && Math.abs(s.faces[0].cx - s.faces[1].cx) > 0.28 && s.faces[1].w > s.faces[0].w * 0.55)
  const portraitSource = vh >= vw

  let layout
  if (portraitSource) layout = withFace.length ? 'track' : 'fit'
  else if (twoApart.length > samples.length * 0.5) layout = 'split'
  else if (withFace.length > samples.length * 0.35) layout = 'track'
  else layout = 'fit'

  return {
    layout,
    samples,
    path: buildPath(samples),
    splitPaths: layout === 'split' ? buildSplitPaths(samples) : null,
    reason: layout === 'split' ? 'Two speakers detected — split screen'
      : layout === 'track' ? 'Speaker detected — face tracking'
      : 'No faces found — full frame with blurred fill',
  }
}

// Pick a target face per sample with hysteresis, then smooth like a camera operator:
// hold still inside a dead zone, ease toward the subject when they move out of it.
function buildPath(samples) {
  let target = 0.5
  let last = null
  const raw = samples.map(s => {
    if (!s.faces.length) return last ?? 0.5
    let pick = s.faces[0]
    if (last != null && s.faces.length > 1) {
      const near = s.faces.reduce((a, b) => Math.abs(a.cx - last) < Math.abs(b.cx - last) ? a : b)
      if (near.w * near.h * 1.35 > pick.w * pick.h) pick = near
    }
    last = pick.cx
    return pick.cx
  })
  const out = []
  for (let i = 0; i < raw.length; i++) {
    const want = raw[i]
    if (Math.abs(want - target) > 0.06) target += (want - target) * 0.55
    out.push({ t: samples[i].t, x: target })
  }
  return out
}

function buildSplitPaths(samples) {
  let a = 0.3, b = 0.7
  const pa = [], pb = []
  for (const s of samples) {
    if (s.faces.length >= 2) {
      const [f1, f2] = [s.faces[0], s.faces[1]].sort((x, y) => x.cx - y.cx)
      a += (f1.cx - a) * 0.5; b += (f2.cx - b) * 0.5
    }
    pa.push({ t: s.t, x: a }); pb.push({ t: s.t, x: b })
  }
  return [pa, pb]
}

export function sampleAt(path, t) {
  if (!path?.length) return 0.5
  if (t <= path[0].t) return path[0].x
  for (let i = 1; i < path.length; i++) {
    if (t <= path[i].t) {
      const a = path[i - 1], b = path[i]
      const k = (t - a.t) / Math.max(1e-6, b.t - a.t)
      const e = k * k * (3 - 2 * k) // smoothstep
      return a.x + (b.x - a.x) * e
    }
  }
  return path[path.length - 1].x
}
