# Mobi (AtoZ Mobile Repair)

## Project Overview
Mobile-first social networking and directory platform for repair professionals in India.
- **Frontend**: Expo/React Native (Firebase Hosting: `https://mobile-repair-app-276b6.web.app`)
- **Backend**: Express/TypeScript (Google Cloud Run: `https://repair-backend-3siuld7gbq-el.a.run.app`)
- **Database**: Neon.tech PostgreSQL

## Deployment Strategy

### Frontend (Firebase Hosting — project: mobile-repair-app-276b6)
```bash
# Step 1: Build
npx expo export -p web

# Step 2: ALWAYS copy fonts after build (expo export wipes dist/_expo/static/fonts/ each time)
mkdir -p dist/_expo/static/fonts
cp node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/*.ttf dist/_expo/static/fonts/
cp node_modules/@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf dist/_expo/static/fonts/
cp node_modules/@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf dist/_expo/static/fonts/
cp node_modules/@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf dist/_expo/static/fonts/
cp node_modules/@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf dist/_expo/static/fonts/

# Step 3: ALWAYS inject @font-face CSS into dist/index.html (see below for snippet)
# The style block with id="icon-fonts" must be added before id="expo-reset"
# It declares @font-face for: AntDesign, Entypo, EvilIcons, Feather, FontAwesome, FontAwesome5/6 variants,
# Fontisto, Foundation, Ionicons, MaterialCommunityIcons, MaterialIcons, Octicons, SimpleLineIcons, Zocial,
# and Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold

# Step 4: Deploy
FIREBASE_TOKEN="TOKEN" ./node_modules/.bin/firebase deploy --only hosting --project mobile-repair-app-276b6 --non-interactive
```
**IMPORTANT**: Use `--project mobile-repair-app-276b6` (NOT `atoz-mobile-repair-488915`). The Firebase Hosting site belongs to the `mobile-repair-app-276b6` project.
**IMPORTANT**: Always use `./node_modules/.bin/firebase` not `npx firebase-tools` to avoid version mismatch.

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

## Database — CRITICAL: Two Separate Databases
**The local dev environment and production Cloud Run use DIFFERENT Neon databases:**
- **Local dev** (`DATABASE_URL` in Replit env): `helium.neon.tech/heliumdb`
- **Production** (in Cloud Run env vars): `ep-spring-pine-aeetxjpk-pooler.c-2.us-east-2.aws.neon.tech/neondb`

**When running `npm run db:push`, it only updates the LOCAL database — NOT the production one.**
To fix schema issues in production, connect directly with the production URL from Cloud Run env vars (retrieved via GCP API using SA key).

### Getting the Production DATABASE_URL
```js
node -e "require('fs').writeFileSync('/tmp/gcp_sa.json', process.env.GCP_SA_KEY)"
// Then use google-auth-library to GET:
// https://run.googleapis.com/v2/projects/atoz-mobile-repair-488915/locations/asia-south1/services/repair-backend
// and extract the DATABASE_URL from template.containers[0].env
```

### Applying Schema Changes to Production DB
Run SQL directly against the production DATABASE_URL fetched above.

## Database Tables (Neon PostgreSQL)
Key tables: profiles, sessions, otp_tokens, posts, jobs, conversations, messages, products, orders, courses, payments, appSettings, emailCampaigns
