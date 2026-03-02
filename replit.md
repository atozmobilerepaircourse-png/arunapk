# Mobi (AtoZ Mobile Repair)

## Project Overview
Mobile-first social networking and directory platform for repair professionals in India.
- **Frontend**: Expo/React Native (Firebase Hosting: `https://mobile-repair-app-276b6.web.app`)
- **Backend**: Express/TypeScript (Google Cloud Run: `https://repair-backend-3siuld7gbq-el.a.run.app`)
- **Database**: Neon.tech PostgreSQL

## Deployment Strategy

### Frontend (Firebase Hosting — project: mobile-repair-app-276b6)
```
npx expo export --platform web
FIREBASE_TOKEN="TOKEN" npx firebase-tools deploy --only hosting --project mobile-repair-app-276b6 --non-interactive
```
**IMPORTANT**: Use `--project mobile-repair-app-276b6` (NOT `atoz-mobile-repair-488915`). The Firebase Hosting site belongs to the `mobile-repair-app-276b6` project.

### Backend (Cloud Run — project: atoz-mobile-repair-488915, region: asia-south1)
```
node -e "require('fs').writeFileSync('/tmp/gcp_sa.json', process.env.GCP_SA_KEY)"
npx esbuild server/index.ts --platform=node --bundle --format=cjs --external:*.node --outdir=server_dist
node build-steps.js && node push-oci.js
```
- `build-steps.js` uploads tarball to GCS and submits Cloud Build
- Cloud Build runs `push-oci.js` (builds Docker image) + `gcloud run deploy` (deploys to Cloud Run)
- The PATCH 403 error at the end of push-oci.js is **expected and harmless** — Cloud Build handles the actual deploy
- `npm run server:build` is BROKEN — always use esbuild directly

## Configuration
- **Primary Domain**: `https://mobile-repair-app-276b6.web.app`
- **Backend URL**: `https://repair-backend-3siuld7gbq-el.a.run.app`
- **GCP Project**: `atoz-mobile-repair-488915` (Cloud Run, Cloud Build, Artifact Registry)
- **Firebase Project**: `mobile-repair-app-276b6` (Hosting only)

## OTP Authentication
- OTPs are stored in the `otp_tokens` PostgreSQL table (persists across Cloud Run restarts/scale-to-zero)
- Twilio sends via WhatsApp first, falls back to SMS
- Table is auto-created on server startup via migration in `server/index.ts`

## Database Tables (Neon PostgreSQL)
Key tables: profiles, sessions, otp_tokens, posts, jobs, conversations, messages, products, orders, courses, payments, appSettings, emailCampaigns
