# AGENTS.md

## Project

NestJS API that extracts/downloads media from social media platforms (TikTok, YouTube, Instagram, Facebook, Twitter). Uses yt-dlp + ffmpeg under the hood.

## Commands

```bash
npm run build          # build (nest build)
npm run start:dev      # dev server with watch
npm run lint           # eslint --fix
npm run typecheck      # tsc --noEmit
npm run test           # jest
```

## Verification order

`lint → typecheck → build`

## Architecture

- `src/pipeline/` — core business logic (platform detection, metadata extraction, media handlers)
- `src/pipeline/platform-config.ts` — per-platform yt-dlp config (format strings, retries, flags)
- `src/pipeline/handlers/` — image, video, carousel download handlers
- `src/controllers/` — REST endpoints (process, media, health)
- `src/main.ts` — bootstrap (helmet, CORS, Swagger at `/api`)

## Key quirks

- **Platform configs matter**: Each platform (TikTok, YouTube, etc.) has its own yt-dlp format string in `platform-config.ts`. TikTok requires `h264*` formats specifically (no bytevc1/H.265) because H.265 streams have broken audio on TikTok.
- **TikTok URL resolution**: Short URLs (`vt.tiktok.com`) are resolved to full URLs via curl before yt-dlp processes them.
- **TikTok retries**: Metadata extraction retries 3 times for TikTok (JS challenge is intermittent).
- **Image posts**: Instagram/Facebook image posts cause yt-dlp to throw "no video in this post" — handled via fallback metadata creation.
- **Buffer limits**: Instagram page scraping uses 50MB buffer (`maxBuffer: 50 * 1024 * 1024`).
- **ffmpeg path**: Configured via `FFMPEG_PATH` env var, defaults to `/opt/homebrew/bin/ffmpeg`.
- **Downloads go to**: `DOWNLOAD_PATH` env var (default `/tmp/media-downloads`).
- **Unused vars**: ESLint allows `_` prefixed unused vars (`argsIgnorePattern: '^_'`).
- **ESLint flat config**: Uses `eslint.config.js` (ESLint 9+), not `.eslintrc`.
