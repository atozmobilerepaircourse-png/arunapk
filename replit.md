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
Key tables: profiles, sessions, otp_tokens, posts, jobs, conversations, messages, products, orders, courses, payments, appSettings, emailCampaigns, repair_bookings

### repair_bookings table (added March 2026)
Repair booking system with fields: id (varchar PK), customer_id, customer_name, customer_phone, device_brand, device_model, repair_type, price, address, latitude, longitude, booking_date, booking_time, status (pending/assigned/on_the_way/repair_started/completed/cancelled), technician_id, technician_name, technician_phone, notes, created_at, updated_at

### profiles table additions (March 2026)
- `available_for_jobs` TEXT DEFAULT 'true' — technician online/offline toggle
- `verified` INTEGER DEFAULT 0 — admin-verified technician badge

## Repair Booking System (Added March 2026)
### New API Endpoints
- `POST /api/repair-bookings` — create booking with GPS, auto-matches nearest verified technician within 10km
- `GET /api/repair-bookings?customerId=&technicianId=&status=` — filtered bookings list
- `GET /api/repair-bookings/:id` — single booking detail
- `PATCH /api/repair-bookings/:id/status` — update status + optional technician assignment
- `DELETE /api/repair-bookings/:id` — delete booking
- `GET /api/technicians/nearby?lat=&lng=&radius=` — verified+available technicians sorted by Haversine distance
- `PATCH /api/profiles/:id/availability` — toggle available_for_jobs (technician self-service)
- `PATCH /api/profiles/:id/verify` — admin verifies a technician

### New Screens
- `app/repair-booking.tsx` — customer booking flow (brand→model→problem→date/time/address with GPS)
- `app/technician-jobs.tsx` — technician job inbox (60s accept/reject timer, status flow buttons)
- `app/repair-tracking.tsx` — customer live status timeline (auto-refresh 10s)
- `app/technician-earnings.tsx` — today/total earnings from completed bookings
- `app/technician-map.tsx` — nearby technicians map (uses platform extensions for web compat)
- `components/TechMap.tsx` — web list fallback (no react-native-maps)
- `components/TechMap.native.tsx` — native MapView with markers (react-native-maps 1.18.0)

### react-native-maps Web Workaround
react-native-maps cannot be imported at the top level for web builds. Use platform file extensions:
- `components/TechMap.tsx` — web version (list UI, no map import)
- `components/TechMap.native.tsx` — native version (real MapView)
- `app/technician-map.tsx` imports `@/components/TechMap` — Metro auto-selects the right file per platform

## Android Builds (EAS)
- **EAS CLI**: Installed in `node_modules/.bin/eas`
- **eas.json**: Configured with `preview` (APK) and `production` (AAB) profiles
- **Package name**: `com.mobi.app`
- **App icon**: Mobi logo from `assets/images/icon.png` (yellow background, #FFD000)
- **Build workflows**: "Build APK (Testing)" and "Build AAB (Play Store)" in Replit

### To Run Builds:
1. Open Replit Shell and run: `./node_modules/.bin/eas login`
2. First-time only: `./node_modules/.bin/eas build:configure` (links to Expo account)
3. Click "Build APK (Testing)" workflow → APK for direct install
4. Click "Build AAB (Play Store)" workflow → AAB for Google Play

Builds run on Expo's cloud servers (10-25 min). Download from https://expo.dev dashboard.
