# Project context for Claude Code

This file gives a new Claude Code session enough context to be useful
immediately. Read this first before making changes.

## What this app is

**Lavi** (formerly "AI Influencer Studio"). A React+Vite single-page app for designing and generating AI influencers.
Local-first: every user's data lives in their own browser localStorage.
Image and video generation happens through the user's own Higgsfield
account (OAuth, PKCE).

## Tech stack

- **React 18** + **Vite 5** + **React Router 6**
- **No build-time API keys** — Higgsfield is OAuthed per-user; the optional
  Claude features call through a serverless proxy that expects an
  `x-api-key` header from the browser.
- **Vercel** is the intended host: `api/*.js` are Vercel serverless
  functions, and `vite.config.js` mirrors them as local dev proxies so
  the dev server behaves the same as production.

## Key files to know

| Path | What it does |
|---|---|
| `src/App.jsx` | Routes + `<ThemeProvider>` + `<StoreProvider>` |
| `src/store.jsx` | localStorage-backed contexts (`useInfluencers`, etc.) and the `Kayla` seed |
| `src/utils/higgsfieldAuth.js` | OAuth PKCE flow against `mcp.higgsfield.ai` |
| `src/utils/higgsfieldGenerate.js` | MCP-style image/video generation, polling, media uploads |
| `src/utils/systemPrompt.js` | Prompt templates — poses, wardrobe library, vibe palettes, Soul vs GPT Image 2 variants |
| `src/pages/Create.jsx` | Multi-step influencer creation wizard |
| `src/pages/Influencers.jsx` | Influencer profile + Content Studio + Video Studio (very large — known structural debt) |
| `api/hf/[...path].js` | Edge function that proxies all Higgsfield MCP traffic and forwards SSE streams |
| `api/claude.js` | Anthropic API proxy — caller supplies their own `x-api-key` |
| `api/product.js` | Reads a public product page (title, description, og:image) for the UGC creator |
| `src/brand.js` | Product name / colors — single place to rename |
| `src/pages/Shorts.jsx` | Shorts Studio shell: Clip Generator, UGC Creator, YouTube Studio tabs |
| `src/utils/shorts/*` | Whisper worker (transformers.js from CDN), MediaPipe reframing, canvas renderer, Claude prompts, Higgsfield dubbing/thumbnail/UGC calls |
| `src/utils/claudeClient.js` | Shared Claude helper with model fallback |

## Conventions

- Inline styles with CSS variables (`var(--bg)`, `var(--text-primary)`).
  Theme tokens are set on `<html data-theme="dark|light">` from
  `src/context/theme.jsx`.
- IDs use `generateId()` from `store.jsx` (`Date.now() + random`).
- Higgsfield models supported: `soul_2`, `gpt_image_2`, `nano_banana_2`,
  `nano_banana_flash`, `seedance_2_0`. Soul has its own simplified
  pose set (`POSES_SOUL`) because it struggles with detailed spatial pose
  instructions.

## Shorts Studio notes

- transformers.js and MediaPipe load from jsDelivr at runtime (not npm) so the bundle
  stays small and Vercel never installs onnxruntime-node.
- Projects (source video, transcript, clips, renders) live in IndexedDB (`lavi_shorts`).
- Rendering is real-time via canvas + MediaRecorder; Chrome emits MP4 (H.264/AAC),
  other browsers may emit WebM.

## Things not to do

- **Never kill the Vite dev server** (port 5173). The owner wants it
  running at all times.
- Don't trust the comment in `modelBaseParams` saying resolution and
  quality conflict for `gpt_image_2` — they don't, the working code
  intentionally passes both.
- Don't refactor `Influencers.jsx` casually. It's 4,700+ lines and the
  state is tangled; any split needs its own dedicated session with
  in-browser verification of every flow.

## Dev workflow

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # production build
npm run preview      # preview the production build locally
```

To diagnose Higgsfield issues, flip `HF_DEBUG = true` at the top of
`src/utils/higgsfieldGenerate.js` for verbose request/response logs.
