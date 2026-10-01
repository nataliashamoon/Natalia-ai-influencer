import { useEffect, useRef, useState } from 'react'
import { Card, Btn, Label, Segmented, Progress, ErrorNote, inputStyle, downloadUrl, CopyBtn, G, slug } from './ui'
import { useInfluencers } from '../../store'
import { ugcScripts } from '../../utils/shorts/ai'
import { makeUgcVideo, estimateUgcCost } from '../../utils/shorts/hf'
import { hasClaudeKey } from '../../utils/claudeClient'
import { isHFConnected, startHiggsfieldOAuthPopup } from '../../utils/higgsfieldAuth'
import { compressImage } from '../../utils/imageUtils'

const TONES = [['excited', 'Excited'], ['honest', 'Calm & honest'], ['funny', 'Funny'], ['luxury', 'Luxury'], ['educational', 'Educational']]
const DURATIONS = [[8, '8s'], [10, '10s'], [15, '15s'], [20, '20s'], [30, '30s']]
const HISTORY_KEY = 'lavi_ugc_videos'

function readFileAsDataUrl(f) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = e => res(e.target.result); r.onerror = rej; r.readAsDataURL(f) })
}

export default function UgcCreator() {
  const [influencers] = useInfluencers()
  const [product, setProduct] = useState({ url: '', name: '', description: '', image: null })
  const [importing, setImporting] = useState(false)
  const [actor, setActor] = useState(null) // { kind:'influencer'|'upload', id?, image, name, persona }
  const [tone, setTone] = useState('excited')
  const [duration, setDuration] = useState(15)
  const [audience, setAudience] = useState('')
  const [cta, setCta] = useState('')
  const [quality, setQuality] = useState('720p')
  const [scripts, setScripts] = useState([])
  const [pick, setPick] = useState(0)
  const [writing, setWriting] = useState(false)
  const [gen, setGen] = useState(null)
  const [cost, setCost] = useState(null)
  const [error, setError] = useState(null)
  const [history, setHistory] = useState(() => { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') } catch { return [] } })
  const productFile = useRef(null)
  const actorFile = useRef(null)

  useEffect(() => { try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 30))) } catch {} }, [history])
  useEffect(() => {
    if (!isHFConnected()) return
    let alive = true
    estimateUgcCost(duration, quality).then(c => alive && setCost(c))
    return () => { alive = false }
  }, [duration, quality])

  const people = influencers.filter(i => i.mainImage)

  async function importUrl() {
    if (!product.url.trim()) return
    setImporting(true); setError(null)
    try {
      const r = await fetch(`/api/product?url=${encodeURIComponent(product.url.trim())}`)
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Could not read that page')
      setProduct(p => ({ ...p, name: d.name || p.name, description: d.description || p.description, image: d.image || p.image }))
    } catch (e) { setError(`${e.message}. You can fill in the product details by hand.`) } finally { setImporting(false) }
  }

  async function write() {
    if (!product.name.trim() && !product.description.trim()) { setError('Add a product name or description first.'); return }
    setWriting(true); setError(null)
    try {
      const persona = actor?.persona || ''
      const s = await ugcScripts({ product, audience, tone, duration, cta, count: 3, creator: persona })
      setScripts(s.map(x => ({ ...x }))); setPick(0)
    } catch (e) { setError(e.message) } finally { setWriting(false) }
  }

  async function generate() {
    const s = scripts[pick]
    if (!s?.lines?.trim()) return
    setError(null)
    if (!isHFConnected()) { try { await startHiggsfieldOAuthPopup() } catch { return } }
    setGen(0)
    try {
      const url = await makeUgcVideo({
        script: s.lines, setting: s.setting, action: s.action,
        actorImage: actor?.image || null, productImage: product.image || null,
        duration, quality, onProgress: setGen,
      })
      if (!url) throw new Error('No video came back from Higgsfield')
      setHistory(h => [{ id: Date.now(), url, title: product.name || 'UGC video', script: s.lines, actor: actor?.name || '', at: Date.now() }, ...h])
    } catch (e) { setError(e.message) } finally { setGen(null) }
  }

  const stepHead = (n, title, sub) => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', marginBottom: 14 }}>
      <span style={{ width: 24, height: 24, borderRadius: '50%', background: G, color: '#fff', fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n}</span>
      <div><div style={{ fontSize: 16, fontWeight: 800 }}>{title}</div>{sub && <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>{sub}</div>}</div>
    </div>
  )

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <ErrorNote onClose={() => setError(null)}>{error}</ErrorNote>
      <div className="lavi-ugc" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }}>
        <Card style={{ padding: 22 }}>
          {stepHead(1, 'Product', 'Paste a link or describe it')}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input value={product.url} onChange={e => setProduct(p => ({ ...p, url: e.target.value }))} onKeyDown={e => e.key === 'Enter' && importUrl()} placeholder="https://yourstore.com/products/…" style={inputStyle} />
            <Btn kind="secondary" disabled={importing || !product.url.trim()} onClick={importUrl}>{importing ? 'Reading…' : 'Import'}</Btn>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: 12 }}>
            <button onClick={() => productFile.current?.click()} style={{ width: 96, height: 96, borderRadius: 14, border: '1.5px dashed var(--border)', background: 'var(--bg-tertiary)', cursor: 'pointer', overflow: 'hidden', padding: 0, color: 'var(--text-tertiary)', fontSize: 12, fontFamily: 'inherit' }}>
              {product.image ? <img src={product.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '+ Product photo'}
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input value={product.name} onChange={e => setProduct(p => ({ ...p, name: e.target.value }))} placeholder="Product name" style={inputStyle} />
              <textarea value={product.description} onChange={e => setProduct(p => ({ ...p, description: e.target.value }))} placeholder="What it is, what it does, why people love it" rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.45 }} />
            </div>
          </div>
          <input ref={productFile} type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { const d = await compressImage(await readFileAsDataUrl(f)); setProduct(p => ({ ...p, image: d })) } }} />
        </Card>

        <Card style={{ padding: 22 }}>
          {stepHead(2, 'AI actor', 'Use one of your Lavi creators or upload any photo')}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {people.map(p => {
              const on = actor?.id === p.id
              return (
                <button key={p.id} onClick={() => setActor(on ? null : { kind: 'influencer', id: p.id, image: p.mainImage, name: p.name, persona: [p.name, p.age && `${p.age} years old`, p.niche, p.backstory?.slice(0, 200)].filter(Boolean).join(', ') })} title={p.name}
                  style={{ width: 74, padding: 0, border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-primary)' }}>
                  <div style={{ width: 74, height: 96, borderRadius: 12, overflow: 'hidden', outline: on ? '3px solid #8B5CF6' : '1px solid var(--border-subtle)', outlineOffset: on ? 2 : 0 }}>
                    <img src={p.mainImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, marginTop: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                </button>
              )
            })}
            <button onClick={() => actorFile.current?.click()} style={{ width: 74, padding: 0, border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              <div style={{ width: 74, height: 96, borderRadius: 12, overflow: 'hidden', border: actor?.kind === 'upload' ? 'none' : '1.5px dashed var(--border)', outline: actor?.kind === 'upload' ? '3px solid #8B5CF6' : 'none', outlineOffset: 2, background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 22 }}>
                {actor?.kind === 'upload' ? <img src={actor.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '+'}
              </div>
              <div style={{ fontSize: 11.5, fontWeight: 600, marginTop: 5, color: 'var(--text-secondary)' }}>Upload</div>
            </button>
          </div>
          <input ref={actorFile} type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { const d = await compressImage(await readFileAsDataUrl(f)); setActor({ kind: 'upload', image: d, name: 'Uploaded actor', persona: '' }) } }} />
          {!people.length && <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 12 }}>Create an influencer to reuse them as your on-camera actor across every ad.</p>}
          {!actor && <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 12 }}>No actor picked — Higgsfield will invent a creator that fits the script.</p>}
        </Card>
      </div>

      <Card style={{ padding: 22 }}>
        {stepHead(3, 'Script', hasClaudeKey() ? 'Claude writes three angles — edit any line' : 'Add a Claude key in Settings for three AI-written angles')}
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 16, alignItems: 'flex-end' }}>
          <div><Label>Tone</Label><Segmented size="sm" value={tone} onChange={setTone} options={TONES} /></div>
          <div><Label>Length</Label><Segmented size="sm" value={duration} onChange={setDuration} options={DURATIONS} /></div>
          <div style={{ flex: 1, minWidth: 180 }}><Label hint="optional">Audience</Label><input value={audience} onChange={e => setAudience(e.target.value)} placeholder="e.g. busy moms, gym beginners" style={{ ...inputStyle, padding: '8px 11px' }} /></div>
          <div style={{ flex: 1, minWidth: 180 }}><Label hint="optional">Call to action</Label><input value={cta} onChange={e => setCta(e.target.value)} placeholder="e.g. Use code LAVI20" style={{ ...inputStyle, padding: '8px 11px' }} /></div>
          <Btn disabled={writing} onClick={write}>{writing ? 'Writing…' : scripts.length ? 'Rewrite' : 'Write scripts'}</Btn>
        </div>
        {scripts.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            {scripts.map((s, i) => {
              const on = i === pick
              const words = s.lines.trim().split(/\s+/).length
              return (
                <div key={i} onClick={() => setPick(i)} style={{ padding: 14, borderRadius: 14, cursor: 'pointer', border: on ? '1.5px solid #8B5CF6' : '1px solid var(--border-subtle)', boxShadow: on ? '0 0 0 4px rgba(139,92,246,0.10)' : 'none', background: 'var(--surface)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#8B5CF6', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{s.angle}</span>
                    <span style={{ fontSize: 11.5, color: words / duration > 3 ? '#E5372C' : 'var(--text-tertiary)' }}>~{Math.round(words / 2.6)}s</span>
                  </div>
                  <textarea value={s.lines} onChange={e => setScripts(arr => arr.map((x, j) => j === i ? { ...x, lines: e.target.value } : x))} rows={5} style={{ ...inputStyle, resize: 'vertical', fontSize: 13.5, lineHeight: 1.5, background: 'transparent', border: 'none', padding: 0 }} />
                  {s.setting && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>📍 {s.setting}{s.action ? ` · ${s.action}` : ''}</div>}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {scripts.length > 0 && (
        <Card style={{ padding: 22, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {stepHead(4, 'Generate', 'Lip-synced talking video with native voice, via Higgsfield Seedance')}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <Segmented size="sm" value={quality} onChange={setQuality} options={[['720p', '720p'], ['1080p', '1080p']]} />
            {cost != null && <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>≈ {cost} credits</span>}
            {gen != null
              ? <div style={{ width: 260 }}><Progress value={gen} label="Filming your ad…" sub={`${Math.round(gen * 100)}% · 1–4 min`} /></div>
              : <Btn size="lg" onClick={generate}>Generate video</Btn>}
          </div>
        </Card>
      )}

      {history.length > 0 && (
        <div>
          <Label>Your UGC videos</Label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
            {history.map(h => (
              <Card key={h.id} style={{ padding: 10 }}>
                <video src={h.url} controls playsInline style={{ width: '100%', aspectRatio: '9/16', objectFit: 'cover', borderRadius: 10, background: '#000' }} />
                <div style={{ fontSize: 13, fontWeight: 700, margin: '8px 2px 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.title}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Btn size="sm" kind="secondary" onClick={() => downloadUrl(h.url, `${slug(h.title)}-ugc.mp4`)}>Download</Btn>
                  <CopyBtn text={h.script} label="Script" kind="ghost" />
                  <button onClick={() => setHistory(arr => arr.filter(x => x.id !== h.id))} title="Remove" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}>×</button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
