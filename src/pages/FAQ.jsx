import { useState } from 'react'

const FAQS = [
  {
    q: 'What is Influencer Studio?',
    a: 'Influencer Studio is a platform for designing and managing AI-generated influencers. You can create a character with a unique look, backstory, niche, and style, then generate photos and videos of them using AI.',
  },
  {
    q: 'How do I generate photos and videos?',
    a: 'Influencer Studio uses Higgsfield AI to generate images and videos. You need to connect your Higgsfield account under Settings → Connect Higgsfield. Once connected, you can generate content directly from each influencer\'s profile.',
  },
  {
    q: 'Is my data private?',
    a: 'Yes. Your influencers are stored in a private, secure database tied to your account. Other users cannot see or access your influencers. We do not sell or share your data.',
  },
  {
    q: 'Do I need a Higgsfield account?',
    a: 'Yes, image and video generation requires a Higgsfield account. You can connect it under Settings. Creating an influencer profile and browsing the app does not require Higgsfield.',
  },
  {
    q: 'What AI models are used for generation?',
    a: 'Influencer Studio supports several Higgsfield models including Soul 2, GPT Image 2, Nano Banana 2, and Seedance 2.0. Each model has different strengths — Soul 2 is great for consistent character photos, while Seedance excels at video.',
  },
  {
    q: 'Can I use AI-generated content commercially?',
    a: 'Usage rights for AI-generated content depend on the terms of the underlying model provider (Higgsfield). Please review their terms of service for details on commercial use.',
  },
  {
    q: 'How do I sign in?',
    a: 'Click the "Sign in" button in the top navigation bar and sign in with your Google account. Signing in lets your influencers sync to the cloud so you can access them from any device.',
  },
  {
    q: 'What happens to my influencers if I sign out?',
    a: 'Your influencers are saved to your cloud account. Signing out on one device does not delete them — they will be waiting for you the next time you sign in.',
  },
  {
    q: 'Is Influencer Studio free?',
    a: 'The app itself is free to use. Generating images and videos consumes Higgsfield credits, which are billed through your Higgsfield account.',
  },
  {
    q: 'How do I contact support?',
    a: 'Email us at nataliashamoon1@gmail.com and we\'ll get back to you as soon as possible.',
  },
]

function Item({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{
      borderBottom: '1px solid var(--border)',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', textAlign: 'left', background: 'none', border: 'none',
          cursor: 'pointer', padding: '20px 0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16,
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{q}</span>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          {a}
        </p>
      )}
    </div>
  )
}

export default function FAQ() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 'calc(var(--nav-h) + 48px) 24px 80px' }}>
      <h1 style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
        FAQ
      </h1>
      <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 40 }}>
        Frequently asked questions about Influencer Studio.
      </p>
      <div>
        {FAQS.map(item => <Item key={item.q} {...item} />)}
      </div>
    </div>
  )
}
