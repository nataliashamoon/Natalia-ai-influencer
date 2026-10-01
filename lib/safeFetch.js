import http from 'node:http'
import https from 'node:https'
import dns from 'node:dns'
import net from 'node:net'

// Fetches a user-supplied URL without letting it reach private or internal
// addresses. Every address a hostname resolves to is checked inside the
// socket's own DNS lookup, so the address that's checked is the one that's
// connected to (no DNS-rebinding gap), and redirects are followed by hand so
// each hop goes through the same check.

const MAX_REDIRECTS = 5

function v4Blocked(ip) {
  const [a, b] = ip.split('.').map(Number)
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) ||           // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) // benchmarking
}

export function isBlockedAddress(ip) {
  const family = net.isIP(ip)
  if (family === 4) return v4Blocked(ip)
  if (family !== 6) return true
  const h = ip.toLowerCase()
  const mapped = h.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return v4Blocked(mapped[1])
  return h === '::' || h === '::1' ||
    /^f[cd]/.test(h) ||            // unique local fc00::/7
    /^fe[89ab]/.test(h) ||         // link-local fe80::/10
    /^ff/.test(h) ||               // multicast
    h.startsWith('::ffff:') ||     // mapped forms not caught above
    h.startsWith('64:ff9b:')       // NAT64 can reach IPv4 internals
}

function guardedLookup(hostname, options, callback) {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err)
    const bad = addresses.find(a => isBlockedAddress(a.address))
    if (bad || !addresses.length) return callback(Object.assign(new Error('Address not allowed'), { code: 'EBLOCKED' }))
    if (options.all) return callback(null, addresses)
    callback(null, addresses[0].address, addresses[0].family)
  })
}

export function checkUrl(raw) {
  let url
  try { url = new URL(raw) } catch { return null }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password) return null
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (net.isIP(host) && isBlockedAddress(host)) return null
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return null
  return url
}

function request(url, { headers, timeoutMs, maxBytes }) {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === 'https:' ? https : http
    const req = lib.get(url, { headers, lookup: guardedLookup, timeout: timeoutMs }, res => {
      const chunks = []
      let size = 0
      res.on('data', c => {
        size += c.length
        if (size > maxBytes) { chunks.push(c.subarray(0, c.length - (size - maxBytes))); res.destroy(); return }
        chunks.push(c)
      })
      const done = () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') })
      res.on('end', done)
      res.on('close', done)
      res.on('error', reject)
    })
    req.on('timeout', () => req.destroy(new Error('Timed out')))
    req.on('error', reject)
  })
}

// Returns { url, status, body } for the final page, or throws.
export async function safeFetchText(raw, { headers = {}, timeoutMs = 8000, maxBytes = 600_000 } = {}) {
  let url = checkUrl(raw)
  if (!url) throw Object.assign(new Error('URL not allowed'), { code: 'EBLOCKED' })
  const deadline = Date.now() + timeoutMs
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const left = deadline - Date.now()
    if (left <= 0) throw new Error('Timed out')
    const res = await request(url, { headers: { 'Accept-Encoding': 'identity', ...headers }, timeoutMs: left, maxBytes })
    if (res.status >= 300 && res.status < 400 && res.headers.location) {
      let next
      try { next = new URL(res.headers.location, url) } catch { throw new Error('Bad redirect') }
      url = checkUrl(next.toString())
      if (!url) throw Object.assign(new Error('URL not allowed'), { code: 'EBLOCKED' })
      continue
    }
    return { url, status: res.status, body: res.body }
  }
  throw new Error('Too many redirects')
}
