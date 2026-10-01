import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { BRAND } from '../brand'

// The landing page speaks in the product's own visual language: vertical phone
// frames with burned-in, word-by-word captions — exactly what Lavi exports.

const PHONES = [
  { img: '/landing/i32.webp', hook: 'POV: your creator never cancels', words: ['She', 'posts', 'every', 'single', 'day', 'and', 'never', 'misses', 'a', 'brief'], tilt: -7, x: 0, y: 36, z: 1 },
  { img: '/landing/i5.webp', hook: 'I did not expect this to work', words: ['Okay', 'this', 'serum', 'actually', 'changed', 'my', 'morning', 'routine'], tilt: 0, x: 1, y: 0, z: 3, main: true },
  { img: '/landing/i44.webp', hook: 'Honest review, 30 days in', words: ['Noise', 'cancelling', 'that', 'actually', 'cancels', 'noise', 'finally'], tilt: 7, x: 2, y: 36, z: 2 },
]

function useTicker(len, ms = 420) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setI(v => (v + 1) % (len + 4)), ms)
    return () => clearInterval(t)
  }, [len, ms])
  return i
}

function Phone({ p, size = 'md', live = true, side = '' }) {
  const tick = useTicker(p.words.length, p.main ? 380 : 470)
  const idx = live ? Math.min(tick, p.words.length - 1) : 2
  const group = Math.floor(idx / 3) * 3
  const shown = p.words.slice(group, group + 3)
  const progress = live ? Math.min(1, tick / (p.words.length + 3)) : 0.4
  return (
    <div className={`lv-phone lv-phone-${size} ${side ? 'lv-side-' + side : ''}`}>
      <img src={p.img} alt="" loading={p.main ? 'eager' : 'lazy'} />
      <div className="lv-hook">{p.hook}</div>
      <div className="lv-cap">
        {shown.map((w, i) => <span key={group + i} className={group + i === idx ? 'on' : ''}>{w}</span>)}
      </div>
      <div className="lv-bar"><i style={{ width: `${progress * 100}%` }} /></div>
    </div>
  )
}

function Check({ children }) {
  return (
    <li>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
      <span>{children}</span>
    </li>
  )
}

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="lv">
      {/* Hero */}
      <section className="lv-hero">
        <div className="lv-hero-copy">
          <h1>Your brand’s own creators, posting every day.</h1>
          <p className="lv-lede">
            {BRAND.name} designs AI influencers that look, dress and speak on-brand — then turns them, and your long videos, into photos, UGC ads and captioned shorts. No casting, no shoots, no waiting on deliverables.
          </p>
          <div className="lv-ctas">
            <button className="lv-btn lv-btn-primary" onClick={() => navigate('/create')}>Create a creator</button>
            <button className="lv-btn lv-btn-quiet" onClick={() => navigate('/shorts')}>Clip a long video</button>
          </div>
          <p className="lv-fine">Free and open source. Runs on your own Higgsfield account.</p>
        </div>
        <div className="lv-hero-stage" aria-hidden="true">
          {PHONES.map((p, i) => (
            <div key={i} className="lv-slot" style={{ '--tilt': `${p.tilt}deg`, '--x': p.x, '--y': `${p.y}px`, zIndex: p.z }}>
              <Phone p={p} size={p.main ? 'lg' : 'md'} side={p.x === 0 ? 'left' : p.x === 2 ? 'right' : ''} />
            </div>
          ))}
        </div>
      </section>

      <p className="lv-for">For social managers, influencer marketers, DTC brands, agencies and founders who need creator content without a creator budget.</p>

      {/* Creators */}
      <section className="lv-row">
        <div className="lv-row-visual lv-mosaic" aria-hidden="true">
          {['i26', 'i43', 'i11', 'i29'].map((n, i) => <img key={n} src={`/landing/${n}.webp`} alt="" loading="lazy" className={`m${i}`} />)}
        </div>
        <div className="lv-row-copy">
          <h2>Design a creator once. Use them in every campaign.</h2>
          <p>Pick a face, a niche, a wardrobe and a voice. Your creator stays recognisably the same person across every shoot, outfit and city.</p>
          <ul className="lv-list">
            <Check>Photo studio for lifestyle, product and brand-deal shots</Check>
            <Check>Wardrobe library and locations that match your brand</Check>
            <Check>Video studio for talking, walking and product moments</Check>
          </ul>
          <Link to="/create" className="lv-link">Start the creator wizard</Link>
        </div>
      </section>

      {/* Shorts */}
      <section className="lv-row lv-row-flip">
        <div className="lv-row-visual lv-reframe" aria-hidden="true">
          <div className="lv-wide">
            <img src="/landing/i3.webp" alt="" loading="lazy" />
            <img src="/landing/i6.webp" alt="" loading="lazy" />
            <span className="lv-wide-tag">1:12:40 podcast</span>
          </div>
          <svg className="lv-arrow" width="56" height="24" viewBox="0 0 56 24" fill="none"><path d="M2 12h48m0 0-8-8m8 8-8 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <Phone p={{ img: '/landing/i6.webp', hook: 'The mistake that cost us a year', words: ['We', 'quit', 'right', 'before', 'it', 'started', 'working'] }} size="sm" />
        </div>
        <div className="lv-row-copy">
          <h2>One long video in. A week of shorts out.</h2>
          <p>Drop in a podcast, webinar or livestream. {BRAND.name} transcribes it, finds the moments most likely to travel, and cuts them into vertical clips ready for TikTok, Reels and Shorts.</p>
          <ul className="lv-list">
            <Check>AI picks 3–15 moments and scores each one</Check>
            <Check>Smart 9:16 framing follows the speaker, or splits two</Check>
            <Check>Word-by-word captions, hook text, color grades and zooms</Check>
            <Check>Dub into 18 languages, plus titles, chapters and thumbnails for YouTube</Check>
          </ul>
          <Link to="/shorts" className="lv-link">Open Shorts Studio</Link>
        </div>
      </section>

      {/* UGC */}
      <section className="lv-row">
        <div className="lv-row-visual lv-ugc" aria-hidden="true">
          <div className="lv-script">
            <b>Script · honest review</b>
            “Okay, I need to tell you about this serum. I’ve used it every morning for two weeks and my skin has never looked this calm.”
          </div>
          <Phone p={{ img: '/landing/i5.webp', hook: 'Two weeks in, honest review', words: ['My', 'skin', 'has', 'never', 'looked', 'this', 'calm'] }} size="sm" />
        </div>
        <div className="lv-row-copy">
          <h2>UGC ads, minus the UGC creators.</h2>
          <p>Paste a product link. Claude writes three angles, you pick one, and your creator says it to camera — lip-synced, with natural voice, in about two minutes.</p>
          <ul className="lv-list">
            <Check>Use any {BRAND.name} creator, or upload a photo of a real one</Check>
            <Check>Hold-the-product shots that keep your packaging exact</Check>
            <Check>8 to 30 seconds, vertical, ready to run as an ad</Check>
          </ul>
          <Link to="/shorts?tab=ugc" className="lv-link">Make a UGC ad</Link>
        </div>
      </section>

      {/* How it works — a real sequence */}
      <section className="lv-steps">
        <h2>Up and running in three steps</h2>
        <ol>
          <li><span>1</span><div><h3>Connect Higgsfield</h3><p>Sign in with your own account. Generations use your credits — no markup, no middleman.</p></div></li>
          <li><span>2</span><div><h3>Create or pick a creator</h3><p>Answer a few questions or start from a template. Add a Claude key for smarter prompts and scripts.</p></div></li>
          <li><span>3</span><div><h3>Generate, clip, post</h3><p>Photos, videos, UGC ads and shorts — download them or share straight to TikTok, Reels and YouTube.</p></div></li>
        </ol>
      </section>

      {/* Closing */}
      <section className="lv-close">
        <div className="lv-close-faces" aria-hidden="true">
          {['i13', 'i40', 'i22', 'i33', 'i8'].map(n => <img key={n} src={`/landing/${n}.webp`} alt="" loading="lazy" />)}
        </div>
        <h2>Meet your first creator in five minutes.</h2>
        <div className="lv-ctas lv-ctas-center">
          <button className="lv-btn lv-btn-primary" onClick={() => navigate('/create')}>Create a creator</button>
          <a className="lv-btn lv-btn-quiet" href={BRAND.repoUrl} target="_blank" rel="noreferrer">View the code on GitHub</a>
        </div>
      </section>

      <style>{`
        .lv { --lv-ink: var(--text-primary); --lv-muted: var(--text-secondary); --lv-pink: #EC4899; --lv-violet: #8B5CF6; --lv-cap: #FFE14D;
          padding-top: var(--nav-h); background: var(--lv-bg, #FAF8FC); color: var(--lv-ink); overflow: hidden; }
        [data-theme="dark"] .lv { --lv-bg: #0B0A10; }
        .lv h1, .lv h2 { font-family: 'Archivo', Inter, sans-serif; font-stretch: 112%; font-weight: 800; letter-spacing: -0.035em; }
        .lv h1 { font-size: clamp(40px, 6.2vw, 78px); line-height: 0.98; max-width: 11ch; }
        .lv h2 { font-size: clamp(28px, 3.4vw, 44px); line-height: 1.04; max-width: 16ch; }
        .lv h3 { font-size: 17px; font-weight: 700; letter-spacing: -0.2px; margin-bottom: 6px; }
        .lv p { line-height: 1.6; }

        .lv-hero { max-width: 1240px; margin: 0 auto; padding: clamp(36px, 7vw, 92px) 28px 40px; display: grid; grid-template-columns: 1.05fr 1fr; gap: 40px; align-items: center; }
        .lv-lede { font-size: clamp(16px, 1.35vw, 18.5px); color: var(--lv-muted); max-width: 54ch; margin: 26px 0 32px; }
        .lv-ctas { display: flex; gap: 12px; flex-wrap: wrap; }
        .lv-ctas-center { justify-content: center; }
        .lv-btn { font: inherit; font-size: 15.5px; font-weight: 700; padding: 15px 26px; border-radius: 14px; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; border: none; transition: transform .15s, box-shadow .15s, background .15s; }
        .lv-btn:focus-visible, .lv-link:focus-visible { outline: 3px solid var(--lv-violet); outline-offset: 3px; }
        .lv-btn-primary { background: ${BRAND.colors.gradient}; color: #fff; box-shadow: 0 8px 28px rgba(139,92,246,.35); }
        .lv-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 34px rgba(139,92,246,.45); }
        .lv-btn-quiet { background: transparent; color: var(--lv-ink); box-shadow: inset 0 0 0 1.5px var(--border); }
        .lv-btn-quiet:hover { background: var(--bg-tertiary); }
        .lv-fine { font-size: 13px; color: var(--text-tertiary); margin-top: 18px; }

        .lv-hero-stage { position: relative; height: clamp(440px, 46vw, 600px); }
        .lv-slot { position: absolute; top: 50%; left: 50%; transform: translate(calc(-50% + (var(--x) - 1) * 80%), calc(-50% + var(--y))) rotate(var(--tilt)); }
        .lv-phone-md .lv-hook { display: none; }
        .lv-phone-md .lv-cap { top: 74%; }
        .lv-side-left .lv-cap { justify-content: flex-start; padding-right: 40%; }
        .lv-side-right .lv-cap { justify-content: flex-end; padding-left: 40%; }
        .lv-phone { position: relative; aspect-ratio: 9/16; border-radius: 26px; overflow: hidden; background: #000; box-shadow: 0 30px 70px rgba(26,21,35,.28), 0 0 0 6px #fff, 0 0 0 7px rgba(26,21,35,.08); container-type: inline-size; }
        [data-theme="dark"] .lv-phone { box-shadow: 0 30px 70px rgba(0,0,0,.6), 0 0 0 6px #1C1A24, 0 0 0 7px rgba(255,255,255,.08); }
        .lv-phone-lg { width: clamp(210px, 21vw, 290px); }
        .lv-phone-md { width: clamp(170px, 17vw, 236px); filter: saturate(.92); }
        .lv-phone-sm { width: clamp(150px, 15vw, 200px); }
        .lv-phone img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        .lv-hook { position: absolute; top: 13%; left: 50%; transform: translateX(-50%); width: max-content; max-width: 84%; text-align: center; background: #fff; color: #111; font-weight: 800; font-size: 6.4cqw; line-height: 1.2; padding: 3.2cqw 4.4cqw; border-radius: 3.4cqw; box-shadow: 0 6px 20px rgba(0,0,0,.25); }
        .lv-cap { position: absolute; left: 0; right: 0; top: 66%; display: flex; justify-content: center; flex-wrap: wrap; gap: 0 2.6cqw; padding: 0 6cqw; font-weight: 900; font-size: 9.2cqw; text-transform: uppercase; color: #fff; letter-spacing: -0.01em; text-shadow: 0 0.6cqw 2cqw rgba(0,0,0,.5); -webkit-text-stroke: 1.2cqw #000; paint-order: stroke fill; }
        .lv-cap span { transition: color .12s; }
        .lv-cap span.on { color: var(--lv-cap); }
        .lv-bar { position: absolute; left: 0; right: 0; bottom: 0; height: 1.3cqw; background: rgba(255,255,255,.25); }
        .lv-bar i { display: block; height: 100%; background: ${BRAND.colors.gradient}; transition: width .4s linear; }

        .lv-for { max-width: 760px; margin: 10px auto 0; padding: 26px 28px 0; text-align: center; font-size: clamp(16px, 1.5vw, 19px); color: var(--lv-muted); border-top: 1px solid var(--border-subtle); }

        .lv-row { max-width: 1140px; margin: 0 auto; padding: clamp(64px, 9vw, 120px) 28px 0; display: grid; grid-template-columns: 1fr 1fr; gap: clamp(32px, 6vw, 80px); align-items: center; }
        .lv-row-flip .lv-row-visual { order: 2; }
        .lv-row-copy > p { color: var(--lv-muted); font-size: 16.5px; max-width: 50ch; margin: 18px 0 20px; }
        .lv-list { list-style: none; display: grid; gap: 11px; margin-bottom: 26px; }
        .lv-list li { display: flex; gap: 11px; align-items: flex-start; font-size: 15px; line-height: 1.45; }
        .lv-list svg { color: var(--lv-violet); flex-shrink: 0; margin-top: 1px; }
        .lv-link { font-weight: 700; font-size: 15px; color: var(--lv-violet); text-decoration: none; border-bottom: 2px solid rgba(139,92,246,.3); padding-bottom: 2px; }
        .lv-link:hover { border-color: var(--lv-violet); }

        .lv-mosaic { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; max-width: 470px; justify-self: center; width: 100%; }
        .lv-mosaic img { width: 100%; aspect-ratio: 3/4; object-fit: cover; border-radius: 18px; }
        .lv-mosaic .m1, .lv-mosaic .m3 { transform: translateY(34px); }

        .lv-reframe { display: flex; align-items: center; gap: 18px; justify-content: center; }
        .lv-wide { position: relative; display: grid; grid-template-columns: 1fr 1fr; width: clamp(200px, 24vw, 300px); aspect-ratio: 16/9; border-radius: 14px; overflow: hidden; box-shadow: 0 16px 40px rgba(26,21,35,.18); }
        .lv-wide img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 25%; }
        .lv-wide-tag { position: absolute; left: 8px; bottom: 8px; font-size: 11px; font-weight: 700; color: #fff; background: rgba(0,0,0,.55); padding: 3px 8px; border-radius: 6px; }
        .lv-arrow { color: var(--lv-violet); flex-shrink: 0; }

        .lv-ugc { display: flex; align-items: center; justify-content: center; gap: 22px; }
        .lv-script { max-width: 230px; background: var(--surface); border: 1px solid var(--border-subtle); border-radius: 18px 18px 4px 18px; padding: 16px 18px; font-size: 14.5px; line-height: 1.5; box-shadow: var(--shadow-md); }
        .lv-script b { display: block; font-size: 12px; color: var(--lv-violet); margin-bottom: 6px; }

        .lv-steps { max-width: 1140px; margin: 0 auto; padding: clamp(80px, 10vw, 140px) 28px 0; }
        .lv-steps ol { list-style: none; display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; margin-top: 34px; counter-reset: s; }
        .lv-steps li { display: flex; gap: 16px; padding-top: 20px; border-top: 2px solid var(--lv-ink); }
        .lv-steps li > span { font-family: 'Archivo', Inter, sans-serif; font-stretch: 125%; font-weight: 800; font-size: 30px; line-height: 1; color: var(--lv-violet); }
        .lv-steps p { color: var(--lv-muted); font-size: 14.5px; }

        .lv-close { text-align: center; padding: clamp(90px, 11vw, 150px) 28px clamp(80px, 10vw, 130px); }
        .lv-close h2 { margin: 26px auto 28px; max-width: 18ch; }
        .lv-close-faces { display: flex; justify-content: center; }
        .lv-close-faces img { width: 62px; height: 62px; border-radius: 50%; object-fit: cover; border: 3px solid var(--lv-bg, #FAF8FC); margin-left: -14px; }
        .lv-close-faces img:first-child { margin-left: 0; }
        [data-theme="dark"] .lv-close-faces img { border-color: #0B0A10; }

        @media (max-width: 900px) {
          .lv-hero { grid-template-columns: 1fr; text-align: left; }
          .lv-hero-stage { height: 470px; }
          .lv-row { grid-template-columns: 1fr; }
          .lv-row-flip .lv-row-visual { order: 0; }
          .lv-steps ol { grid-template-columns: 1fr; }
        }
        @media (max-width: 520px) {
          .lv-hero-stage { height: 400px; }
          .lv-slot { transform: translate(calc(-50% + (var(--x) - 1) * 62%), calc(-50% + var(--y))) rotate(var(--tilt)); }
          .lv-phone-lg { width: 190px; } .lv-phone-md { width: 150px; }
          .lv-reframe { flex-direction: column; } .lv-arrow { transform: rotate(90deg); }
          .lv-ugc { flex-direction: column; }
        }
        @media (prefers-reduced-motion: reduce) { .lv-btn, .lv-bar i, .lv-cap span { transition: none; } }
      `}</style>
    </div>
  )
}
