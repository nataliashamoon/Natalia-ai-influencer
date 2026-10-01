import { rateLimit, clientIp } from '../lib/rateLimit.js'

// Reads a public product page and returns its name, description and main image,
// so the UGC creator can start from just a link.

function blockedHost(host) {
  const h = host.toLowerCase()
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return true
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const [a, b] = h.split('.').map(Number)
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return true
  }
  return h.includes(':') // raw IPv6
}

function meta(html, names) {
  for (const n of names) {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${n}["'][^>]*content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${n}["']`, 'i')
    const m = html.match(re)
    if (m) return (m[1] || m[2]).trim()
  }
  return ''
}

const decode = s => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const rl = rateLimit(clientIp(req.headers))
  if (!rl.ok) return res.status(429).json({ error: 'Too many requests' })

  const raw = req.query?.url || new URLSearchParams((req.url || '').split('?')[1] || '').get('url')
  let url
  try { url = new URL(raw) } catch { return res.status(400).json({ error: 'Invalid URL' }) }
  if (!/^https?:$/.test(url.protocol) || blockedHost(url.hostname)) return res.status(400).json({ error: 'URL not allowed' })

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const r = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36', Accept: 'text/html' },
    })
    clearTimeout(timer)
    const html = (await r.text()).slice(0, 600_000)
    const title = meta(html, ['og:title', 'twitter:title']) || (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '').trim()
    const description = meta(html, ['og:description', 'description', 'twitter:description'])
    let image = meta(html, ['og:image', 'og:image:secure_url', 'twitter:image'])
    if (image) { try { image = new URL(image, url).toString() } catch { image = '' } }
    const price = meta(html, ['product:price:amount', 'og:price:amount'])
    return res.status(200).json({ name: decode(title).slice(0, 200), description: decode(description).slice(0, 1200), image, price, url: url.toString() })
  } catch (e) {
    return res.status(502).json({ error: 'Could not read that page' })
  }
}
