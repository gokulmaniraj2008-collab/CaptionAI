# CaptionAI

A Next.js AI video captioning starter.

## Features
- Upload video in browser
- Extract audio with FFmpeg WASM
- Server-side OpenAI Whisper transcription
- Timestamped English caption segments
- Live caption preview
- Caption style controls
- SRT download
- Responsive mobile UI

## Run locally

```bash
npm install
cp .env.example .env.local
# put your API key in .env.local
npm run dev
```

Open http://localhost:3000.

## Deploy

Deploy the project to Vercel and add `OPENAI_API_KEY` under Project Settings → Environment Variables.

## Important production note

This starter keeps the OpenAI key server-side. For large videos and a production-grade "download MP4 with burned-in captions" pipeline, move video rendering to a worker/server that supports FFmpeg (for example a dedicated container/compute service). The current browser pipeline previews captions and exports SRT without exposing the API key.
