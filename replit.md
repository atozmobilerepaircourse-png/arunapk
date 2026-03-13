# Mobi (AtoZ Mobile Repair)

## Project Overview
Mobile-first social networking, directory, and marketplace platform for repair professionals in India.
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

## OTP Authentication (Updated March 8, 2026)
- **Primary method**: Firebase Phone Authentication (requires Phone Sign-in enabled in Firebase Console)
- **Fallback**: Backend `/api/otp/send` endpoint for testing (returns fallbackOtp when SMS fails)
- **Frontend flow**: `sendOtp()` tries Firebase first, returns early on success
- **Verification**: Firebase ID token verified server-side at `/api/auth/firebase-phone` endpoint
- **No auto-login**: After OTP verification, users proceed through full onboarding (email → details → etc.)
- **OTP tokens table**: PostgreSQL `otp_tokens` stores backend OTPs for fallback/testing (5 min expiry)
- **Note**: Requires `FIREBASE_SERVICE_ACCOUNT` OR `GCP_SA_KEY` env var for Firebase Admin SDK

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

## Recent Updates (March 8, 2026 — Firebase OTP + Auth Flow)

### Firebase Phone Authentication (March 8)
- **Replaced Fast2SMS with Firebase Phone Auth** as primary OTP method
- **Frontend changes** (`app/onboarding.tsx`):
  - `sendOtp()`: Tries Firebase first (web RecaptchaVerifier + signInWithPhoneNumber, native PhoneAuthProvider)
  - `verifyOtp()`: Verifies Firebase credential, gets ID token, calls `/api/auth/firebase-phone`
  - Added `FirebaseRecaptchaVerifierModal` for native, invisible recaptcha container for web
  - Removed **auto-login** after OTP verification — users now proceed to email screen
- **Backend changes** (`server/routes.ts`):
  - Added `/api/auth/firebase-phone` endpoint that verifies Firebase ID tokens using Admin SDK
  - Fixed Firebase Admin SDK initialization to use `GCP_SA_KEY` as fallback (works on Cloud Run)
- **Google login fixed**: Removed auto-login from `handleGooglePhoneSubmit()` to match OTP flow
- **Both auth flows** (OTP + Google) now require full onboarding: phone/google → email → details → selfie → skills/docs → location → login
- **Deployed to web**: https://mobile-repair-app-276b6.web.app ✅

### Prerequisites for Firebase OTP
1. Go to [Firebase Console](https://console.firebase.google.com/project/mobile-repair-app-276b6/authentication/providers)
2. **Authentication** → **Sign-in method**
3. Enable **Phone** → Save
4. Verify authorized domain: `mobile-repair-app-276b6.web.app`

## Previous Updates (March 7, 2026)

### User Profile Page (app/user-profile.tsx) — ENHANCED
- **Chat button**: Now appears for ALL roles when viewing other profiles (not just teacher/supplier)
- **Book Service button**: Appears when viewing a technician's profile (triggers repair booking flow)
- **Verified badge**: Green ✓ badge shown for technicians
- **Star rating + reviews**: Dynamic, stable ratings (seeded per technician ID) shown for technicians
- **Services & Pricing grid**: 6 services displayed (Screen Replacement, Battery, Charging Port, Back Panel, Camera, Software) with starting prices

### Settings Page (app/(tabs)/profile.tsx) — NAVIGATION UPDATED
- Added **Jobs** → Routes to jobs tab
- Added **Bookings** → Routes to orders tab
- Renamed **Notifications** section with new nav items
- Renamed support link to **Help & Support**

### Customer Home Screen (app/(tabs)/customer-home.tsx) — DYNAMIC ADS + LOCATION
- **Dynamic ad banner**: Fetches active ads from `/api/ads/active` and displays first ad, falls back to insurance promo if no ads
- **Location saving**: Customer GPS location now automatically saved to profile via `POST /api/profiles/:id/location` when home screen loads
- **Ads system**: Admin can create/toggle/delete ads in the admin panel, and they automatically display on customer home

### Admin Ads (app/admin.tsx) — TOGGLE FIX
- Fixed ad toggle to use direct `apiRequest()` call instead of fetch with dynamic import

## UX Pilot Dark Theme Redesign — Technician App (March 12, 2026)

### New File: constants/techTheme.ts
- Complete dark design token system for the technician UI
- Tokens: `bg=#121212`, `card=#1E1E1E`, `cardSurface=#2A2A2A`, `border=#2C2C2C`, `accent=#FF6B2C`, `text=#F3F4F6`, `muted=#9CA3AF`
- Includes semantic color maps, category colors, and badge helpers

### Technician Home Feed (app/(tabs)/index.tsx) — DARK THEME
- Dark background applied only when `profile?.role === 'technician'`
- Post type badges per category (repair=blue, question=yellow, job=green, sell=orange)
- Category filter chips with per-category accent colors
- Icon-based header buttons (Schematics / Live / Tools / Chat)
- Improved empty state with icon-background container

### Marketplace (app/(tabs)/marketplace.tsx) — DARK THEME
- Full dark theme using T tokens
- Sub-tabs: Live | Products | Suppliers | Buy & Sell | Ads
- Live card, supplier card, product card all updated to dark

### Skills & Services Screen (app/skills-services.tsx) — NEW
- Full-screen management of technician skills
- Profile card at top, active skills grid with colorful icons
- Remove skill (swipe badge), add from categorized modal with search
- Integrates with `setProfile` from context

### Tab Layout (app/(tabs)/_layout.tsx) — TECHNICIAN CREATE TAB
- Added visible "Post" tab (plus.circle icon) to technician NativeTabs
- Changed Marketplace tab icon to storefront for technicians
- Fixed duplicate `marketplace` trigger in customer NativeTabs

### Directory (app/(tabs)/directory.tsx) — DARK THEME
- Dynamic `D` color object switches between dark (technician) and light (other roles)
- Header, stat cards, search box, filter chips, empty state all themed
- Map view also supports dark theme

### DirectoryCard component (components/DirectoryCard.tsx) — DARK MODE PROP
- Added `darkMode?: boolean` prop
- Dynamically switches card background, text, skill tags, avatar border, dot color

### Profile (app/(tabs)/profile.tsx) — SKILLS LINK
- Added "Skills & Services" button to Technician Tools section
- Routes to `/skills-services` screen
