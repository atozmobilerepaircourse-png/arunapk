# Mobi (AtoZ Mobile Repair)

## Project Overview
Mobile-first social networking and directory platform for repair professionals in India.
- **Frontend**: Expo/React Native (Firebase Hosting: `https://mobile-repair-app-276b6.web.app`)
- **Backend**: Express/TypeScript (Google Cloud Run: `https://repair-backend-3siuld7gbq-el.a.run.app`)
- **Database**: Neon.tech PostgreSQL
- **Image Storage**: Google Cloud Storage (`mobi-app-uploads` bucket in asia-south1)

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
- Admin phone `8179142535` always receives OTP `123456`

## Image Storage
- **Bunny.net DISABLED** (`bunnyAvailable = false`, `bunnyStreamAvailable = false`)
- Images uploaded to **Google Cloud Storage** bucket `mobi-app-uploads` (public read, CORS enabled)
- Images auto-compressed with **sharp** (max 1200px, JPEG 80% quality) before upload
- Fallback: local disk `/uploads/` if GCS unavailable (won't persist on Cloud Run)

## Database — CRITICAL: Two Separate Databases
**The local dev environment and production Cloud Run use DIFFERENT Neon databases:**
- **Local dev** (`DATABASE_URL` in Replit env): `helium.neon.tech/heliumdb`
- **Production** (in Cloud Run env vars): `ep-spring-pine-aeetxjpk-pooler.c-2.us-east-2.aws.neon.tech/neondb`

**When running `npm run db:push`, it only updates the LOCAL database — NOT the production one.**
To fix schema issues in production, connect directly with the production URL from Cloud Run env vars (retrieved via GCP API using SA key).

## Database Tables (Neon PostgreSQL)
Key tables: profiles, sessions, otp_tokens, posts, jobs, conversations, messages, products, orders, courses, payments, appSettings, emailCampaigns, reviews, service_requests, insurance_plans, insurance_policies, diagnostics

## Features
- **Trust & Reputation**: Trust scores, badges (New Member/Trusted/Pro/Verified Expert), ratings (1-5 stars), reviews
- **Service Requests**: Customers post repair requests, technicians respond, location-based matching
- **Subscriptions**: All roles (technician, teacher, supplier, customer) support subscription model. Admin controls pricing. Customer subscription disabled by default (enable from admin panel with pricing).
- **Live Sessions**: Teachers go live with YouTube/Zoom links, share photos, users join via in-app browser
- **Live Chat**: Real-time messaging between users
- **Directory**: Sort by recently active, highest rated, most trusted, nearest location
- **Admin Panel**: Users, Subscriptions, Security (blocked users with unblock), Reviews moderation, Revenue, Notifications, Insurance, Diagnostics tabs
- **Diagnostics**: AI-powered device health scanner (battery, storage, network) with OpenAI suggestions, insurance discount display, nearby technician booking
- **Insurance**: Basic (₹30/mo, ₹500 discount) and Premium (₹59/mo, ₹1000 discount) plans already seeded
- **Customer Tabs**: Home, Experts, Diagnose, Shop, Profile (Diagnose replaced "Post Job")

## Key Notes
- `UserProfile` type includes: `blocked`, `pushToken`, `lastSeen` fields (critical for admin security)
- Admin OTP: `8179142535` → always `123456`
- Session key: `mobi_session_token_v2`
- Role change: `/api/profile/change-role` with `{ userId, newRole }` (NOT admin endpoint)
- Trust scores: `/api/trust-score/:userId` (computed dynamically)
- Batch trust scores: `/api/reviews/stats/all` (returns all user review stats in one call)
- Chat renamed to "Live Chat" throughout the app
- Admin panel: no payouts tab, no commission system; supports 4 roles for subscriptions
- Customer subscription popup: shows admin phone (8179142535) + WhatsApp when inactive
- Directory: Map removed from page; accessible via icon on Home screen
- Error handling: 15-second timeout with retry on all major screens
- Push notifications: sent on new messages, live session start, subscription expiry
- Google login: popup-based OAuth flow with postMessage communication
- APK icon: adaptive icon uses foregroundImage + backgroundColor only (no backgroundImage)

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
