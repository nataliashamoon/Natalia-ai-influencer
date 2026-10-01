// Higgsfield-powered steps for Shorts Studio: dubbing, thumbnails and UGC actor videos.
// Everything runs on the user's own Higgsfield account through the existing MCP proxy.

import { initSession, callTool, unwrapMCP, extractJobIds, isHFErrorText, pollVideoJobs, uploadBlobForId, generateSingleImage } from '../higgsfieldGenerate'

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

export const DUB_LANGUAGES = [
  ['spa', 'Spanish'], ['por', 'Portuguese'], ['fra', 'French'], ['deu', 'German'], ['ita', 'Italian'],
  ['eng', 'English'], ['hin', 'Hindi'], ['ara', 'Arabic'], ['jpn', 'Japanese'], ['kor', 'Korean'],
  ['cmn', 'Chinese'], ['rus', 'Russian'], ['tur', 'Turkish'], ['pol', 'Polish'], ['ind', 'Indonesian'],
  ['fil', 'Filipino'], ['swe', 'Swedish'], ['fin', 'Finnish'],
]

function hfError(res) {
  const raw = JSON.stringify(unwrapMCP(res) ?? '')
  const m = raw.match(/(Something went wrong[^"\\]{0,40}|Error[^"\\]{0,160}|insufficient[^"\\]{0,120}|not enough credits[^"\\]{0,80})/i)
  return m ? m[0].replace(/\\n/g, ' ') : null
}

function jobIdsExcluding(res, exclude = []) {
  const ex = new Set(exclude.filter(Boolean).map(s => s.toLowerCase()))
  const ids = extractJobIds(res).filter(id => !ex.has(String(id).toLowerCase()))
  if (!ids.length) throw new Error(hfError(res) || 'Higgsfield did not return a job')
  return ids
}

// dataURL / blob / url → Higgsfield media id
export async function toMediaId(src, type = 'image') {
  if (!src) return null
  if (src instanceof Blob) return (await uploadBlobForId(src, { type })).id
  // Data URLs and this app's own files (e.g. /kayla/main.jpg) are uploaded from the
  // browser: Higgsfield can't fetch a relative path, or a preview behind Vercel login.
  const url = new URL(src, window.location.href)
  if (src.startsWith('data:') || url.origin === window.location.origin) {
    const r = await fetch(url)
    if (!r.ok) throw new Error(`Could not load image (${r.status})`)
    return (await uploadBlobForId(await r.blob(), { type })).id
  }
  const res = await callTool('media_import_url', { url: url.toString() })
  const data = unwrapMCP(res)
  const text = JSON.stringify(data ?? '')
  if (isHFErrorText(typeof data === 'string' ? data : '')) throw new Error(`Higgsfield couldn't import that image: ${String(data).split('\n')[0]}`)
  const id = data?.media_id || data?.id || (text.replace(/request[ _-]?id\W*[0-9a-f-]{36}/gi, '').match(UUID) || [])[0]
  if (!id) throw new Error('Could not import image into Higgsfield')
  return id
}

export async function dubClip(blob, language, { onProgress, isCancelled } = {}) {
  await initSession()
  onProgress?.(0.05)
  const { id } = await uploadBlobForId(blob, { type: 'video' })
  onProgress?.(0.25)
  const res = await callTool('dubbing', { params: { video_id: id, target_language: language } })
  const jobIds = jobIdsExcluding(res, [id])
  const out = await pollVideoJobs(jobIds.slice(0, 1), 1, p => onProgress?.(0.25 + (p / 100) * 0.75), null, isCancelled)
  return out.urls[0]
}

export async function makeThumbnail({ concept, text, frameDataUrl, onProgress }) {
  const prompt = `YouTube thumbnail, 16:9, ultra eye-catching, high contrast, professional creator style. ${concept}. ` +
    (frameDataUrl ? 'Use the person from the reference image as the main subject with an expressive face, keep their identity. ' : '') +
    (text ? `Large bold readable headline text on the image: "${text}". ` : '') +
    'Clean composition, strong subject separation, vivid colors, no watermark.'
  return generateSingleImage({ prompt, aspectRatio: '16:9', resolution: '2k', referenceImage: frameDataUrl || null, onProgress: p => onProgress?.(p / 100) })
}

// Talking-head UGC ad: the creator speaks the script on camera with native lip-synced audio.
export async function makeUgcVideo({ script, actorImage, productImage, duration = 15, setting = '', action = '', voice = '', quality = '720p', onProgress, isCancelled }) {
  await initSession()
  onProgress?.(0.03)
  const medias = []
  const actorId = await toMediaId(actorImage)
  if (actorId) medias.push({ role: 'image_references', value: actorId })
  const productId = productImage ? await toMediaId(productImage) : null
  if (productId) medias.push({ role: 'image_references', value: productId })
  onProgress?.(0.15)

  const prompt = [
    'Authentic UGC-style vertical selfie video, filmed on a phone held at arm\'s length, natural light, handheld micro-movement, looks like a real TikTok creator.',
    actorId ? 'The creator is the person in @image_1 — keep their exact face, hair and identity.' : '',
    productId ? `They ${action || 'hold and show'} the product from @image_${actorId ? 2 : 1}, keeping its exact look and packaging.` : (action ? `They ${action}.` : ''),
    setting ? `Setting: ${setting}.` : '',
    `They look straight into the camera and say, with natural lip sync and expressive delivery${voice ? ` (${voice} voice)` : ''}: "${script.replace(/"/g, "'")}"`,
    'Clear speech audio, no background music, no on-screen text, no subtitles.',
  ].filter(Boolean).join(' ')

  const params = {
    model: 'seedance_2_5',
    mode: medias.length ? 'omni_reference' : 't2v',
    prompt,
    aspect_ratio: '9:16',
    duration: Math.max(4, Math.min(30, Math.round(duration))),
    resolution: quality,
    generate_audio: true,
  }
  if (medias.length) params.medias = medias
  const res = await callTool('generate_video', { params })
  const jobIds = jobIdsExcluding(res, [actorId, productId])
  onProgress?.(0.3)
  const out = await pollVideoJobs(jobIds.slice(0, 1), 1, p => onProgress?.(0.3 + (p / 100) * 0.7), null, isCancelled)
  return out.urls[0]
}

export async function estimateUgcCost(duration = 15, quality = '720p') {
  try {
    await initSession()
    const res = await callTool('generate_video', { params: { model: 'seedance_2_5', mode: 't2v', prompt: 'cost check', aspect_ratio: '9:16', duration, resolution: quality, generate_audio: true, get_cost: true } })
    const data = unwrapMCP(res)
    const n = data?.credits ?? data?.cost ?? Number((JSON.stringify(data).match(/"(?:credits|cost)"\s*:\s*([\d.]+)/) || [])[1])
    return Number.isFinite(n) ? n : null
  } catch { return null }
}
