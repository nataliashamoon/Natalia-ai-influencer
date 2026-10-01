// Small shared client for the optional Claude features.
// The user's own key lives in localStorage and is forwarded by /api/claude.

const KEY = 'claude_api_key'
// Newest first; if an account can't use a model we fall back to the next.
const MODELS = ['claude-sonnet-5-5', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001']

export function hasClaudeKey() {
  try { return !!localStorage.getItem(KEY) } catch { return false }
}

async function callOnce(model, { system, messages, maxTokens }) {
  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': localStorage.getItem(KEY) },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.error) {
    const msg = data?.error?.message || `Claude request failed (${res.status})`
    const err = new Error(msg)
    err.modelUnavailable = res.status === 404 || /model/i.test(msg) && /not.*(found|exist|available)|invalid/i.test(msg)
    throw err
  }
  return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim()
}

export async function askClaude({ system, prompt, messages, maxTokens = 2000 }) {
  if (!hasClaudeKey()) throw new Error('Add your Claude API key in Settings to use this feature')
  const msgs = messages || [{ role: 'user', content: prompt }]
  let lastErr
  for (const model of MODELS) {
    try { return await callOnce(model, { system, messages: msgs, maxTokens }) }
    catch (e) { lastErr = e; if (!e.modelUnavailable) throw e }
  }
  throw lastErr
}

// Ask for JSON and parse it, tolerating code fences or a sentence around it.
export async function askClaudeJSON(opts) {
  const text = await askClaude(opts)
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  try { return JSON.parse(cleaned) } catch {}
  const start = cleaned.search(/[[{]/)
  const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'))
  if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1))
  throw new Error('Claude returned an unexpected response')
}
