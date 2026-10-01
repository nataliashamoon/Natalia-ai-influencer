// Main-thread side of transcription: decode the video's audio to 16 kHz mono,
// hand it to the Whisper worker, and group words into readable segments.

const SR = 16000

export async function decodeAudio(file, onStatus) {
  onStatus?.('Extracting audio…')
  const buf = await file.arrayBuffer()
  const Ctx = window.AudioContext || window.webkitAudioContext
  const ctx = new Ctx({ sampleRate: SR })
  try {
    const decoded = await ctx.decodeAudioData(buf)
    // Mix down to mono
    const n = decoded.length
    const mono = new Float32Array(n)
    for (let c = 0; c < decoded.numberOfChannels; c++) {
      const ch = decoded.getChannelData(c)
      for (let i = 0; i < n; i++) mono[i] += ch[i] / decoded.numberOfChannels
    }
    return mono
  } catch {
    throw new Error("Couldn't read audio from this file. Try an MP4 or MOV export.")
  } finally {
    ctx.close?.()
  }
}

let worker = null
function getWorker() {
  if (!worker) worker = new Worker(new URL('./transcribe.worker.js', import.meta.url), { type: 'module' })
  return worker
}

export function transcribeAudio(audio, { quality = 'balanced', language = null, onStatus, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const w = getWorker()
    const onMsg = ({ data }) => {
      if (data.type === 'status') onStatus?.(data.message)
      else if (data.type === 'download') {
        const pct = data.total ? Math.round((data.loaded / data.total) * 100) : 0
        onStatus?.(`Downloading speech model… ${pct}% (one-time)`)
      } else if (data.type === 'progress') onProgress?.(data.done / data.total)
      else if (data.type === 'done') { w.removeEventListener('message', onMsg); resolve(data.words) }
      else if (data.type === 'error') { w.removeEventListener('message', onMsg); reject(new Error(data.message)) }
    }
    w.addEventListener('message', onMsg)
    // Copy (not transfer) so the caller can keep its buffer
    w.postMessage({ type: 'transcribe', audio, quality, language })
  })
}

// Group words into sentence-like segments for display, chapters and AI prompts.
export function wordsToSegments(words, { maxGap = 0.9, maxLen = 14 } = {}) {
  const segs = []
  let cur = null
  for (const w of words) {
    const breakHere = !cur
      || w.start - cur.end > maxGap
      || cur.end - cur.start > maxLen
      || /[.!?]$/.test(cur.words[cur.words.length - 1].text)
    if (breakHere) { cur = { start: w.start, end: w.end, words: [w] }; segs.push(cur) }
    else { cur.words.push(w); cur.end = w.end }
  }
  return segs.map(s => ({ start: s.start, end: s.end, text: s.words.map(w => w.text).join(' ').replace(/\s+([,.!?])/g, '$1') }))
}

export function fmtTime(sec, withMs = false) {
  sec = Math.max(0, sec || 0)
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  const base = h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
  return withMs ? `${base}.${String(Math.floor((sec % 1) * 10))}` : base
}
