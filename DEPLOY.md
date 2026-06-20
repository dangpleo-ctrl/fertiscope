# FertiScope — run & publish

A Next.js 16 app. Tokenizers are **pure-JS** (`js-tiktoken`, `llama3-tokenizer-js`) with **no native
dependencies**, so it deploys to any Node/serverless host with zero special config. No env vars, no database.

## Run locally
```bash
cd fertiscope
npm install          # first time only
npm run dev          # http://localhost:3000  (hot reload)
# or production:
npm run build && npm start
```
If you change the bundled corpus, regenerate the leaderboard:
```bash
node scripts/precompute.mjs
```

## Publish a shareable link

### ▶ Option A — Vercel (recommended; made by the Next.js team)
Best for sharing with an audience: a stable public URL, auto HTTPS, the `/api/analyze` route runs as a
serverless function automatically.

**Fastest (CLI, no git needed):**
```bash
npm i -g vercel          # or use: npx vercel
cd fertiscope
vercel                   # logs you in, links the project, deploys a preview URL
vercel --prod            # promotes to your production URL (fertiscope-xxx.vercel.app)
```
The first `vercel` run asks a few questions (scope, project name) — accept the defaults. It auto-detects
Next.js. Share the printed `https://….vercel.app` link.

**Or via GitHub (auto-deploy on every push):**
1. `git init && git add -A && git commit -m "FertiScope"` then push to a new GitHub repo.
2. Go to vercel.com → New Project → import the repo → Deploy. Done.

### ▶ Option B — Instant throwaway demo (tunnel your local server)
Good for a quick live demo on a call; the link dies when your laptop sleeps.
```bash
npm run build && npm start            # serves on :3000
# in a second terminal:
npx localtunnel --port 3000           # prints a https://….loca.lt URL
# or, no-signup Cloudflare quick tunnel:
brew install cloudflared && cloudflared tunnel --url http://localhost:3000
```

### ▶ Option C — Netlify / Render / Railway / Fly.io
All support Next.js. Netlify: `npx netlify deploy`. Render/Railway: connect the repo, build `npm run build`,
start `npm start`. Nothing app-specific is required.

## Notes
- The whole app works on serverless because tokenization is pure JS — no `onnxruntime`/native bindings.
- Want it fully static (no server)? The only server piece is `/api/analyze` (live custom-text analysis).
  The Leaderboard, Cost Calculator, and Methodology pages are already static and would export as-is.
