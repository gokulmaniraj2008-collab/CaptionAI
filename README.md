# CaptionAI

A Next.js AI video captioning app powered by Google Gemini.

## Features
- Upload MP4, MOV, WebM and other browser-supported videos
- Gemini multimodal video understanding
- Timestamped English caption segments
- Live caption preview
- Caption size, position and background controls
- SRT download
- Responsive mobile UI
- Gemini API key stays server-side

## Run locally

```bash
npm install
cp .env.example .env.local
# put your Gemini API key in .env.local
npm run dev
```

Open http://localhost:3000.

## Gemini API key

Create a Gemini API key in Google AI Studio and set:

```env
GEMINI_API_KEY=your_key_here
```

Never commit the real API key to GitHub. Add it to Vercel as an Environment Variable for production.

## Deploy to Vercel

Import the repository into Vercel and add `GEMINI_API_KEY` under Project Settings → Environment Variables.

Gemini supports multimodal video understanding, and short videos can be passed directly as inline video data. For larger production uploads, use the Gemini Files API instead of sending the entire video inline.

## Production note

The current app generates synchronized caption data and an SRT file. It previews captions in the browser but does not yet render a new MP4 with captions permanently burned into the video. A production MP4 export can be added with an FFmpeg worker/server pipeline.
