# Lavi

Design AI influencers, generate their photos, videos and UGC ads, and turn any
long video into captioned viral shorts. React + Vite frontend, Higgsfield for
image & video generation on **your own** Higgsfield account, optional Claude for
smarter prompts and scripts. Your data lives in your browser.

## What's inside

- **Creator wizard** — templates, references, backstory, look, then 3 AI variations to pick from.
- **Influencer studio** — photo studio, wardrobe, video studio and brand-deal shots for every creator.
- **Shorts Studio** (`/shorts`)
  - **Clip Generator** — upload a podcast, webinar, stream or vlog. Whisper transcribes it
    in the browser (word-level timestamps), Claude scores the 3–15 most viral moments,
    MediaPipe face tracking reframes to 9:16 (follow-face, split screen for two speakers,
    or blurred fit), then each clip is rendered with word-by-word captions, a hook,
    color grade, zoom punch-ins and a progress bar. Dub any clip into 18 languages
    (Higgsfield), copy captions + hashtags, share or download.
  - **UGC Creator** — paste a product link, Claude writes three ad scripts, and one of your
    Lavi creators (or any uploaded photo) says it on camera with lip-synced native audio
    (Higgsfield Seedance).
  - **YouTube Studio** — 10 title ideas, SEO description with chapters, tags, and AI
    thumbnails generated from a frame of your video.

Nothing in the clip pipeline is uploaded to find moments: transcription, face tracking
and rendering all run locally in the browser. Only dubbing, thumbnails and UGC
generation call Higgsfield.

---

## Setup (no tech experience needed)

You only install one thing — **Antigravity**. Everything else lives inside
it. Just follow these steps in order.

1. **Download the project.** Go to the
   [GitHub page](https://github.com/nataliashamoon/Natalia-ai-influencer), click the green
   **Code** button → **Download ZIP**, then unzip it onto your Desktop.
2. **Install Antigravity.** Search "Antigravity" on Google (or go to
   [antigravity.dev](https://antigravity.dev)) and install it like any app.
3. **Open the project.** In Antigravity, click **File → Open Folder** and pick
   the unzipped folder.
4. **Add Claude.** Click the **Extensions** icon in the left sidebar, search
   **Claude Code**, click **Install**, and sign in with your Anthropic account.
5. **Start it.** Open **Terminal → New Terminal**, type `claude`, press Enter,
   then tell Claude: *"install everything and start the app."*
6. **Open it.** When Claude says it's running, it will show a web address
   (something like `http://localhost:5173` — the number may differ on your
   computer). Open that address in Chrome.
7. **Connect Higgsfield.** In the app: **Settings → Connect Higgsfield** (uses
   your own Higgsfield credits).

That's it. Stuck on anything? Just ask Claude in the terminal — that's what
it's there for. To change something, tell it: *"change the homepage
headline,"* *"add a new vibe option,"* etc.

---

## Updating

In the terminal, type `claude` and tell it: *"get the latest version."*

Your saved data (influencers, brand deals, inspiration boards) stays in your
browser and survives updates.

---

## Project structure

```
src/
  brand.js         Product name, tagline, colors — rename/re-skin here
  pages/           Routes: Landing, Influencers, Shorts, Inspiration, BrandDeals, Create, Settings
  components/      Reusable UI: Nav, ImageGrid, MasonryGrid, Lightbox
  components/shorts/  Shorts Studio: ClipGenerator, ClipEditor, YouTubeKit, UgcCreator
  utils/shorts/    transcribe (Whisper worker), reframe (MediaPipe), render (canvas +
                   MediaRecorder), ai (moments, YouTube kit, UGC scripts), hf (dub, thumbnails, UGC video)
  context/         React contexts (theme)
  utils/           Higgsfield API, OAuth, prompt builders, image helpers
  store.jsx        localStorage-backed React contexts
api/               Vercel serverless functions (proxies + image proxy)
docs/              Prompt engineering reference docs
```

---

## Deployment (optional)
   
The repo is Vercel-ready. Connect the GitHub repo at vercel.com → it
auto-detects Vite + the `api/` folder and deploys in ~60 seconds. End
users still bring their own Higgsfield account.

---

Environment variables (all optional): `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
enable Google sign-in and cloud sync. Without them the app runs fully local.

---

Made by Natalia Shamoon.
