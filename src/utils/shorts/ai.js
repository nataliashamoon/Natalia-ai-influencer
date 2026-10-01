// AI layer for Shorts Studio: viral moment detection, hooks, YouTube kit and UGC scripts.
// Uses Claude when the user has added a key; otherwise falls back to local heuristics
// so the clipper still works end to end.

import { askClaudeJSON, hasClaudeKey } from '../claudeClient'
import { fmtTime } from './transcribe'

export const GRADES = {
  none:     { label: 'Natural',    filter: 'none' },
  punchy:   { label: 'Punchy',     filter: 'contrast(1.12) saturate(1.28) brightness(1.02)' },
  warm:     { label: 'Warm film',  filter: 'sepia(0.18) saturate(1.12) contrast(1.06) brightness(1.03)' },
  cool:     { label: 'Cool clean', filter: 'saturate(0.95) contrast(1.06) hue-rotate(-8deg) brightness(1.04)' },
  moody:    { label: 'Moody',      filter: 'contrast(1.22) saturate(0.82) brightness(0.92)' },
  bright:   { label: 'Bright pop', filter: 'brightness(1.1) saturate(1.2) contrast(1.04)' },
  mono:     { label: 'B&W',        filter: 'grayscale(1) contrast(1.18)' },
}

function transcriptForPrompt(segments, maxChars = 60000) {
  let out = ''
  for (const s of segments) {
    const line = `[${s.start.toFixed(1)}-${s.end.toFixed(1)}] ${s.text}\n`
    if (out.length + line.length > maxChars) break
    out += line
  }
  return out
}

const MOMENTS_SYSTEM = `You are a short-form video editor who finds the most viral moments in long videos for TikTok, Instagram Reels and YouTube Shorts.
You get a timestamped transcript. Pick the strongest self-contained moments: a clear hook in the first 2 seconds, one idea, a payoff, emotion, surprise, a strong opinion, a useful tip, or a funny beat.
Rules:
- Each clip must start and end exactly on segment boundaries from the transcript and make sense with no context.
- Clips must not overlap.
- Respect the requested length range.
- Score virality 0-100 honestly; sort clips by score, best first.
Return JSON only, no prose:
{"clips":[{"start":number,"end":number,"score":number,"title":"short catchy title","hook":"on-screen hook text, max 8 words, no emojis","reason":"why this will perform, one sentence","caption":"social caption, 1-2 sentences","hashtags":["tag","tag","tag"],"grade":"one of: none, punchy, warm, cool, moody, bright, mono","emphasis":["2-4 single words spoken in the clip worth a zoom punch-in"]}]}`

export async function detectMoments({ segments, duration, count = 8, minLen = 20, maxLen = 60, context = '' }) {
  if (!segments.length) return evenSplit(duration, count, minLen, maxLen)
  if (!hasClaudeKey()) return heuristicMoments(segments, count, minLen, maxLen)

  const prompt = `Video length: ${fmtTime(duration)} (${Math.round(duration)}s).
Find ${count} clips (fewer if the material is thin), each ${minLen}-${maxLen} seconds.
${context ? `Creator/brand context: ${context}\n` : ''}
Transcript:
${transcriptForPrompt(segments)}`
  const json = await askClaudeJSON({ system: MOMENTS_SYSTEM, prompt, maxTokens: 4000 })
  const clips = (json.clips || [])
    .map(c => snapClip(c, segments, duration, minLen, maxLen))
    .filter(Boolean)
  return dedupe(clips).sort((a, b) => b.score - a.score).slice(0, count)
}

function snapClip(c, segments, duration, minLen, maxLen) {
  let start = Math.max(0, Number(c.start) || 0)
  let end = Math.min(duration, Number(c.end) || start + minLen)
  if (end - start < 3) return null
  if (end - start > maxLen + 15) end = start + maxLen
  return {
    id: Math.random().toString(36).slice(2, 10),
    start, end,
    score: Math.max(0, Math.min(100, Math.round(Number(c.score) || 50))),
    title: String(c.title || 'Untitled clip').slice(0, 80),
    hook: String(c.hook || '').slice(0, 70),
    reason: String(c.reason || ''),
    caption: String(c.caption || ''),
    hashtags: (c.hashtags || []).map(t => String(t).replace(/^#/, '')).slice(0, 8),
    grade: GRADES[c.grade] ? c.grade : 'punchy',
    emphasis: (c.emphasis || []).map(w => String(w).toLowerCase().replace(/[^\p{L}\p{N}']/gu, '')).filter(Boolean).slice(0, 4),
    textForClip: segments.filter(s => s.start >= start - 0.1 && s.end <= end + 0.1).map(s => s.text).join(' '),
  }
}

function dedupe(clips) {
  const out = []
  for (const c of clips.sort((a, b) => b.score - a.score)) {
    const overlaps = out.some(o => Math.min(o.end, c.end) - Math.max(o.start, c.start) > 0.4 * (c.end - c.start))
    if (!overlaps) out.push(c)
  }
  return out
}

// ── Offline fallback: score windows by energy words, questions, numbers and pace ──
const HOOK_WORDS = /\b(secret|never|always|biggest|mistake|truth|actually|crazy|insane|best|worst|why|how|stop|need|money|nobody|everyone|first|hack|tip|wrong|love|hate|best|free|lesson|learned)\b/gi

function heuristicMoments(segments, count, minLen, maxLen) {
  const candidates = []
  for (let i = 0; i < segments.length; i++) {
    let j = i, text = ''
    while (j < segments.length && segments[j].end - segments[i].start < maxLen) {
      text += ' ' + segments[j].text
      const len = segments[j].end - segments[i].start
      if (len >= minLen) {
        const words = text.split(/\s+/).length
        const pace = words / len
        const hooks = (segments[i].text.match(HOOK_WORDS) || []).length * 3 + (text.match(HOOK_WORDS) || []).length
        const q = (segments[i].text.match(/\?/g) || []).length * 4 + (text.match(/[!?]/g) || []).length
        const nums = (text.match(/\b\d+\b/g) || []).length
        const score = hooks * 4 + q * 2 + nums * 2 + pace * 6
        candidates.push({ start: segments[i].start, end: segments[j].end, score, first: segments[i].text, text })
      }
      j++
    }
  }
  const max = Math.max(1, ...candidates.map(c => c.score))
  const picked = dedupe(candidates.map(c => ({ ...c, score: Math.round(40 + 55 * c.score / max) })))
  return picked.slice(0, count).map(c => ({
    id: Math.random().toString(36).slice(2, 10),
    start: c.start, end: c.end, score: c.score,
    title: c.first.split(/\s+/).slice(0, 7).join(' '),
    hook: c.first.split(/\s+/).slice(0, 7).join(' ').replace(/[.,]$/, ''),
    reason: 'Picked by the offline scorer (add a Claude key in Settings for AI picks).',
    caption: c.first, hashtags: ['fyp', 'viral', 'shorts'], grade: 'punchy', emphasis: [],
    textForClip: c.text.trim(),
  }))
}

function evenSplit(duration, count, minLen, maxLen) {
  const len = Math.min(maxLen, Math.max(minLen, duration / Math.max(1, count)))
  const out = []
  for (let t = 0; t + 3 < duration && out.length < count; t += len) {
    out.push({ id: Math.random().toString(36).slice(2, 10), start: t, end: Math.min(duration, t + len), score: 50,
      title: `Clip ${out.length + 1}`, hook: '', reason: 'No speech found — split evenly.', caption: '', hashtags: [], grade: 'punchy', emphasis: [], textForClip: '' })
  }
  return out
}

// ── YouTube kit: titles, description with chapters, thumbnail ideas ──
const YT_SYSTEM = `You are a YouTube growth strategist. From a timestamped transcript produce packaging that maximizes click-through and watch time.
Return JSON only:
{"titles":["10 title options, under 70 characters, varied styles: curiosity, number, how-to, bold claim, question"],
 "description":"2-3 short paragraphs, keyword rich, ends with a call to action. No chapters here.",
 "chapters":[{"time":seconds,"title":"short chapter title"}],
 "tags":["10-15 search tags"],
 "thumbnails":[{"text":"2-4 word thumbnail text","concept":"one sentence visual concept for an eye-catching 16:9 thumbnail"}]}
Chapters: first chapter at 0, 4-12 chapters, at least 20 seconds apart, at real topic changes.
Give 3 thumbnail concepts.`

export async function youtubeKit({ segments, duration, context = '' }) {
  if (!hasClaudeKey()) return offlineYoutubeKit(segments, duration)
  const json = await askClaudeJSON({
    system: YT_SYSTEM,
    prompt: `Video length ${fmtTime(duration)}.\n${context ? `Channel context: ${context}\n` : ''}Transcript:\n${transcriptForPrompt(segments, 80000)}`,
    maxTokens: 3000,
  })
  const chapters = (json.chapters || []).map(c => ({ time: Math.max(0, Number(c.time) || 0), title: String(c.title || '') }))
    .sort((a, b) => a.time - b.time)
  if (chapters.length && chapters[0].time !== 0) chapters.unshift({ time: 0, title: 'Intro' })
  return {
    titles: (json.titles || []).slice(0, 10),
    description: json.description || '',
    chapters,
    tags: json.tags || [],
    thumbnails: (json.thumbnails || []).slice(0, 3),
  }
}

function offlineYoutubeKit(segments, duration) {
  const step = Math.max(60, duration / 8)
  const chapters = []
  for (let t = 0; t < duration; t += step) {
    const seg = segments.find(s => s.start >= t) || segments[segments.length - 1]
    if (seg) chapters.push({ time: chapters.length ? Math.floor(seg.start) : 0, title: seg.text.split(/\s+/).slice(0, 6).join(' ') })
  }
  const first = segments[0]?.text || 'New video'
  return {
    titles: [first.split(/\s+/).slice(0, 9).join(' ')],
    description: segments.slice(0, 4).map(s => s.text).join(' '),
    chapters, tags: [], thumbnails: [{ text: first.split(/\s+/).slice(0, 3).join(' '), concept: 'Close-up of the speaker with bold text' }],
    offline: true,
  }
}

export function chaptersText(chapters) {
  return chapters.map(c => `${fmtTime(c.time)} ${c.title}`).join('\n')
}

// ── UGC video scripts ──
const UGC_SYSTEM = `You write scripts for UGC-style vertical video ads: a single creator talking to a phone camera, natural and unpolished, like a real TikTok testimonial.
Rules: open with a scroll-stopping hook in the first sentence; speak like a real person (contractions, short sentences); mention one or two concrete benefits; end with a clear call to action; no stage directions inside the spoken lines; no emojis or hashtags in the lines.
The spoken words must fit the duration at about 2.6 words per second.
Return JSON only: {"scripts":[{"angle":"short name for the angle","lines":"the exact spoken words","setting":"where they are filming, one short phrase","action":"what they do on camera, one short phrase"}]}`

export async function ugcScripts({ product, audience = '', tone = 'excited', duration = 15, cta = '', count = 3, creator = '' }) {
  const words = Math.round(duration * 2.6)
  if (!hasClaudeKey()) {
    const name = product.name || 'this'
    return [{
      angle: 'Honest discovery',
      lines: `Okay, I need to tell you about ${name}. ${product.description ? product.description.split('.')[0] + '.' : ''} I've been using it every day and honestly I'm obsessed. ${cta || 'Link is below, go try it.'}`.trim(),
      setting: 'bright apartment', action: 'holding the product up to the camera',
    }]
  }
  const json = await askClaudeJSON({
    system: UGC_SYSTEM,
    prompt: `Product: ${product.name || ''}
About the product: ${product.description || ''}
${audience ? `Target audience: ${audience}\n` : ''}${creator ? `Creator persona: ${creator}\n` : ''}Tone: ${tone}
Duration: ${duration}s (about ${words} spoken words)
${cta ? `Call to action: ${cta}\n` : ''}Write ${count} scripts with different angles (for example: problem/solution, honest review, unboxing reaction, myth-busting, before/after).`,
    maxTokens: 2000,
  })
  return (json.scripts || []).slice(0, count)
}
