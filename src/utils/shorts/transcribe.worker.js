// Whisper speech-to-text with word timestamps, running fully in the browser.
// transformers.js is loaded from the CDN on first use so it never bloats the app
// bundle; model weights are cached by the browser after the first download.

const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0'

const MODELS = {
  fast: 'onnx-community/whisper-tiny_timestamped',
  balanced: 'onnx-community/whisper-base_timestamped',
  accurate: 'onnx-community/whisper-small_timestamped',
}

let pipePromise = null
let pipeKey = null

async function getPipe(quality, post) {
  const key = quality
  if (pipePromise && pipeKey === key) return pipePromise
  pipeKey = key
  pipePromise = (async () => {
    const { pipeline, env } = await import(/* @vite-ignore */ TRANSFORMERS_URL)
    env.allowLocalModels = false
    const webgpu = !!self.navigator?.gpu && !!(await self.navigator.gpu.requestAdapter().catch(() => null))
    const files = new Map()
    const progress_callback = p => {
      if (p.status === 'progress' && p.file) {
        files.set(p.file, { loaded: p.loaded || 0, total: p.total || 0 })
        let loaded = 0, total = 0
        for (const f of files.values()) { loaded += f.loaded; total += f.total }
        post({ type: 'download', loaded, total })
      }
    }
    const opts = webgpu
      ? { device: 'webgpu', dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' }, progress_callback }
      : { device: 'wasm', dtype: 'q8', progress_callback }
    try {
      return { pipe: await pipeline('automatic-speech-recognition', MODELS[quality] || MODELS.balanced, opts), device: opts.device }
    } catch (e) {
      if (!webgpu) throw e
      // WebGPU can fail on some drivers — fall back to plain WASM.
      return { pipe: await pipeline('automatic-speech-recognition', MODELS[quality] || MODELS.balanced, { device: 'wasm', dtype: 'q8', progress_callback }), device: 'wasm' }
    }
  })()
  try { return await pipePromise } catch (e) { pipePromise = null; throw e }
}

const SR = 16000

// Split long audio at quiet points near ~28s so words aren't cut in half.
function chunkBounds(audio, target = 28, search = 4) {
  const bounds = []
  let start = 0
  const n = audio.length
  const win = Math.floor(0.05 * SR)
  while (start < n) {
    let end = Math.min(n, start + target * SR)
    if (end < n) {
      const from = Math.max(start + (target - search) * SR, start + SR)
      let best = end, bestE = Infinity
      for (let i = from; i + win < end; i += win) {
        let e = 0
        for (let j = i; j < i + win; j += 4) e += audio[j] * audio[j]
        if (e < bestE) { bestE = e; best = i + (win >> 1) }
      }
      end = best
    }
    bounds.push([start, end])
    start = end
  }
  return bounds
}

self.onmessage = async ({ data }) => {
  if (data.type !== 'transcribe') return
  const post = msg => self.postMessage(msg)
  try {
    const { audio, quality = 'balanced', language = null } = data
    post({ type: 'status', message: 'Loading speech model…' })
    const { pipe, device } = await getPipe(quality, post)
    post({ type: 'status', message: device === 'webgpu' ? 'Transcribing (GPU)…' : 'Transcribing…' })

    const bounds = chunkBounds(audio)
    const words = []
    for (let i = 0; i < bounds.length; i++) {
      const [s, e] = bounds[i]
      const offset = s / SR
      const slice = audio.subarray(s, e)
      const out = await pipe(slice, {
        return_timestamps: 'word',
        ...(language ? { language, task: 'transcribe' } : {}),
      })
      for (const c of out.chunks || []) {
        const text = (c.text || '').trim()
        if (!text) continue
        const [a, b] = c.timestamp || []
        const start = offset + (a ?? 0)
        const end = offset + (b ?? (a ?? 0) + 0.3)
        words.push({ text, start: +start.toFixed(2), end: +Math.max(end, start + 0.05).toFixed(2) })
      }
      post({ type: 'progress', done: i + 1, total: bounds.length, words: words.length })
    }
    post({ type: 'done', words })
  } catch (e) {
    post({ type: 'error', message: e?.message || String(e) })
  }
}
