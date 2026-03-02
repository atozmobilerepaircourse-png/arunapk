# Mobi

## Overview

Mobi is a mobile-first social networking and directory platform designed for repair professionals in India. It aims to connect technicians, teachers/trainers, spare parts suppliers, and job providers within the repair industry. The platform offers a social feed, a professional directory with search and filter capabilities, job listings, direct messaging, and comprehensive user profiles. Its core purpose is to facilitate communication, collaboration, and commerce among industry participants, thereby enhancing efficiency and growth in the repair sector.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (Expo / React Native)

The frontend is built using Expo SDK 54 and React Native 0.81, leveraging `expo-router` for file-based, typed routing. It features a tab-based navigation tailored to different user roles (Customer, Teacher/Supplier, Technician/JobProvider). Global application state is managed via React Context, with server polling for real-time updates. The UI adheres to a dark theme using the Inter font family. Key libraries include `expo-image`, `expo-image-picker`, `expo-haptics`, `react-native-keyboard-controller`, `react-native-reanimated`, `react-native-gesture-handler`, and `expo-location`. The directory includes map functionalities, utilizing `react-native-maps` for native and Leaflet.js (via iframe) for web platforms.

### Backend (Express)

The backend is an Express 5 application running on Node.js, providing a comprehensive API for user profiles, posts, jobs, conversations, messages, reels, products, courses, and payments. It handles file storage with Bunny.net Storage for images and videos, with a local fallback. CORS is configured for development and production environments. In production (port 8080), it serves a landing page. In development (port 5000), a proxy forwards non-API requests to Metro on port 8081.

**Server bundle**: Built with esbuild using `--bundle --format=cjs --external:'*.node'` — all npm packages are bundled inline into `server_dist/index.js` (26MB CJS file). No `node_modules` are needed at runtime. Run `npm run server:build` after server code changes to rebuild.

**Cloud Run deployment**: Backend is deployed to Google Cloud Run (`asia-south1`, service `repair-backend`). The deployment pipeline:
1. `node build-steps.js` — creates a source tarball, uploads to GCS, triggers Cloud Build
2. Cloud Build runs `node push-oci.js` which: downloads `node:20-slim` from Docker Hub, creates an OCI layer with `server_dist/` + `shared/` + `assets/` + `server/templates/` + `static-build/`, pushes to Artifact Registry, PATCHes Cloud Run to create a new revision
3. The Cloud Build SA (`[PROJECT_NUMBER]@cloudbuild.gserviceaccount.com`) has `iam.serviceaccounts.actAs` on `deployment-service` SA, so the Cloud Run PATCH works from inside Cloud Build (not from Replit directly)

**Key fix history**: Previous deployments used `--packages=external` in esbuild which required `node_modules` at runtime. The Cloud Run container had no `node_modules`, causing all revisions to fail. Fixed by switching to `--bundle --format=cjs` which creates a fully self-contained bundle.

**Socket.IO**: Live chat uses Socket.IO attached to the Express httpServer. In development, the Replit dev domain routes to Metro (port 8081), so `metro.config.js` includes a proxy for `/socket.io/` and `/api/` paths to forward them to the Express server on port 5000. The `setupWebAppFallback` in `server/index.ts` also skips `/socket.io` paths to avoid serving HTML to Socket.IO handshake requests.

**Chat data (conversations + messages) is stored in Firebase Firestore** via the Admin SDK (`server/firebase-admin.ts`). All other data (profiles, posts, jobs, courses, etc.) remains in PostgreSQL. The frontend chat UI is unchanged — same screens, same API endpoints.

### Database (PostgreSQL via Drizzle)

PostgreSQL is used as the primary database, accessed via Drizzle ORM. The schema, defined in `shared/schema.ts`, includes tables for profiles, posts, jobs, conversations, messages, reels, products, orders, subscription settings, courses, course chapters, videos, enrollments, dubbed videos, and payments. Schema validation is performed using `drizzle-zod`. The `pg` package is used as the database driver.

### Data Model

The system utilizes a comprehensive data model to support its features, including `UserProfile` (with roles like technician, teacher, supplier, job_provider, customer), `Post`, `Job`, `Conversation`, `ChatMessage`, `Reel`, `Product`, `Course`, `CourseChapter`, `CourseVideo`, `CourseEnrollment`, `Payment`, `DubbedVideo`, `LiveClass`, `CourseNotice`, and `AppSetting`. This structure enables detailed user management, content sharing, e-learning, and e-commerce functionalities.

### App Flow

The application features an onboarding process that registers and authenticates users via phone number, collecting role-specific details and location. Post-onboarding, users are directed to a main tab navigator offering a social feed, professional directory, job listings, and profile management. Messaging is integrated, allowing direct communication and image sharing. The platform supports admin functionalities for user and subscription control. Teachers can create and manage courses with video content, chapters, and AI dubbing. Course browsing, enrollment, and payment processing via Razorpay are integral parts of the e-learning experience. The course player (`app/course-player.tsx`) includes:
- **Tabs**: Lessons (playlist), Notes (course notices), Chat (community chat via Socket.IO), AI Tips (AI recommendations)
- **Lock Screen**: Lock button in video controls; tap-to-unlock overlay
- **Auto Mark Complete**: Automatically calls `POST /api/videos/:videoId/complete` at 90% playback (stores in `completed_videos` column on `course_enrollments`)
- **Resume Watching**: Saves last position to localStorage (web) and resumes on next play
- **Demo limitations** and **AI dubbing** capabilities
- **AI Study Coach**: The "AI Tips" tab uses OpenAI (via Replit AI Integrations) to generate 4 personalized study recommendations based on the student's actual progress — completed videos, chapter performance, and what's next. Backend endpoint: `GET /api/courses/:courseId/recommendations?studentId=...`. Falls back to rule-based recommendations if AI fails. Refresh button lets students regenerate recommendations anytime.

## Admin Panel Features

The admin panel (`app/admin.tsx`) is accessible only to the admin user (phone: 8179142535) at the `/admin` route. It provides the following tabs:
- **Dashboard**: User stats, role breakdown, activity summary
- **Users**: Full user list with block/delete controls, device details, and subscription status
- **Subs**: Subscription settings per role (toggle, price/amount), plus **active subscribers list** showing users with active subscriptions and days remaining
- **Revenue**: Revenue overview including subscription revenue, course revenue (with commission split), teacher earnings breakdown, enrollment stats
- **Posts**: All posts with admin delete
- **Jobs**: All job listings
- **Ads**: Create/toggle/delete promotional ads with image + link
- **Links**: Manage the live stream link and web tools link shown in the feed header
- **Device**: Device lock settings (enable/disable, price) and reset user device locks

Key admin API endpoints:
- `GET /api/admin/revenue` - Aggregated revenue stats
- `GET /api/admin/active-subscriptions` - Users with active subscriptions
- `POST /api/admin/block-user` - Block/unblock user
- `POST /api/admin/delete-user` - Delete user and all data
- `POST /api/admin/reset-device` - Reset device lock for a user

## Screenshot & Screen Capture Protection (Course Player)

- **Native (iOS/Android)**: `expo-screen-capture` `preventScreenCaptureAsync()` is called when entering the course player and released on exit. This sets Android's `FLAG_SECURE` which prevents screenshots, screen recordings, and screen sharing.
- **Web**: Right-click context menu is disabled. Common keyboard shortcuts (F12, Ctrl+U, Ctrl+S, Ctrl+Shift+I/J/C) are blocked. The `<video>` element has `controlsList="nodownload"` and `disablePictureInPicture`. A tab-visibility overlay appears when the user switches to another tab, obscuring the video.

## Teacher Revenue Tracking

- Teachers see a "My Revenue" link in their profile Settings section (`/teacher-revenue`).
- The teacher-revenue screen shows total revenue, commission breakdown, available balance, payout history, and recent sales.
- Teachers can request withdrawals via UPI or bank transfer.
- Backend routes: `GET /api/teacher/revenue/:teacherId`, `POST /api/teacher/payout/request`.

## Admin Payout Management

- Admin panel has a new "Payouts" tab listing all teacher payout requests.
- Pending requests can be marked as Paid (with confirmation) or Rejected.
- Backend routes: `GET /api/admin/teacher-payouts`, `PATCH /api/admin/teacher-payouts/:id`.

## Post Management

Posts can be edited and deleted by their owners:
- `PATCH /api/posts/:id` - Edit post text/category (requires `userId` in body to verify ownership)
- `DELETE /api/posts/:id` - Delete post (requires `userId` in query to verify ownership; admin can delete without userId)
- PostCard component has a "..." menu for post owners showing Edit/Delete options
- Edit opens a bottom sheet modal with text editing capability
- Successful edits update the local context immediately (optimistic UI via `updatePost`)

## External Dependencies

-   **PostgreSQL**: Database solution, configured via `DATABASE_URL`.
-   **AsyncStorage**: For local caching of user profiles.
-   **Expo Services**: Utilized for various mobile functionalities like font loading, image picking, and haptics.
-   **Twilio SMS**: For sending and verifying SMS OTPs.
-   **Bunny.net Storage & CDN**: Primary service for storing and serving user-uploaded images and videos.
-   **Google Cloud AI**: Used for the AI Dubbing Pipeline, specifically Speech-to-Text, Translation API, and Text-to-Speech (Wavenet voices) for multilingual video content.
-   **FFmpeg**: Employed for audio mixing in the AI dubbing process.
-   **Razorpay**: Integrated as the payment gateway for course enrollments, handling order creation, payment processing, and verification.
-   **Expo Push Notifications**: Push notification delivery via Expo's Push API (`https://exp.host/--/api/v2/push/send`). Tokens are stored in the `push_token` column of the `profiles` table and registered on login via `lib/notifications.ts:registerPushToken()`. Backend service: `server/push-notifications.ts`.
-   **Environment Variables**: Critical configuration is managed through environment variables including `DATABASE_URL`, `REPLIT_DEV_DOMAIN`, `EXPO_PUBLIC_DOMAIN`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `SESSION_SECRET`, `BUNNY_STORAGE_API_KEY`, `BUNNY_STORAGE_ZONE_NAME`, `GCS_SERVICE_ACCOUNT_KEY`, `RAZORPAY_KEY_ID`, and `RAZORPAY_KEY_SECRET`.