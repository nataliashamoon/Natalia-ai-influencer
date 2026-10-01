// Rewrites Chrome's MediaRecorder MP4 into a standard (non-fragmented) MP4.
// MediaRecorder emits fragmented MP4 (moof/mdat) with an irregular frame rate;
// it plays everywhere but Higgsfield's dubbing rejects it. A stream copy into a
// normal MP4 fixes that without re-encoding. ffmpeg.wasm's core (~30 MB) loads
// from the CDN on first use only, like the speech model, so the app stays small.

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

const CORE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm'

let loading = null
function getFFmpeg() {
  if (!loading) {
    loading = (async () => {
      const ff = new FFmpeg()
      await ff.load({
        coreURL: await toBlobURL(`${CORE}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${CORE}/ffmpeg-core.wasm`, 'application/wasm'),
      })
      return ff
    })().catch(e => { loading = null; throw e })
  }
  return loading
}

// True when an MP4's top-level boxes include a movie fragment (moof).
async function isFragmentedMp4(blob) {
  const head = new Uint8Array(await blob.slice(0, 1 << 20).arrayBuffer())
  const view = new DataView(head.buffer)
  for (let i = 0; i + 8 <= head.length;) {
    const size = view.getUint32(i)
    const type = String.fromCharCode(head[i + 4], head[i + 5], head[i + 6], head[i + 7])
    if (type === 'moof') return true
    if (size < 8) return false
    i += size
  }
  return false
}

// Returns a standard MP4 for fragmented MP4 input; anything else is returned as is.
export async function toStandardMp4(blob) {
  if (!/mp4/.test(blob.type || 'video/mp4') || !(await isFragmentedMp4(blob))) return blob
  const ff = await getFFmpeg()
  const id = Math.random().toString(36).slice(2, 8)
  const input = `in_${id}.mp4`, output = `out_${id}.mp4`
  await ff.writeFile(input, await fetchFile(blob))
  try {
    const code = await ff.exec(['-i', input, '-c', 'copy', '-movflags', '+faststart', output])
    if (code !== 0) throw new Error('Could not prepare the video for dubbing')
    const data = await ff.readFile(output)
    return new Blob([data.buffer], { type: 'video/mp4' })
  } finally {
    await ff.deleteFile(input).catch(() => {})
    await ff.deleteFile(output).catch(() => {})
  }
}
