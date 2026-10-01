import { rateLimit, clientIp } from '../lib/rateLimit.js'
import { checkUrl, safeFetchText } from '../lib/safeFetch.js'

// Reads a public product page and returns its name, description and main image,
// so the UGC creator can start from just a link.

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
  if (!raw || !checkUrl(raw)) return res.status(400).json({ error: 'URL not allowed' })

  try {
    const { url, body: html } = await safeFetchText(raw, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36', Accept: 'text/html' },
    })
    const title = meta(html, ['og:title', 'twitter:title']) || (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '').trim()
    const description = meta(html, ['og:description', 'description', 'twitter:description'])
    let image = meta(html, ['og:image', 'og:image:secure_url', 'twitter:image'])
    if (image) { try { image = new URL(image, url).toString() } catch { image = '' } }
    const price = meta(html, ['product:price:amount', 'og:price:amount'])
    return res.status(200).json({ name: decode(title).slice(0, 200), description: decode(description).slice(0, 1200), image, price, url: url.toString() })
  } catch (e) {
    if (e.code === 'EBLOCKED') return res.status(400).json({ error: 'URL not allowed' })
    return res.status(502).json({ error: 'Could not read that page' })
  }
}
