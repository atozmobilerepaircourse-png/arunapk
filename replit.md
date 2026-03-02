# Mobi (AtoZ Mobile Repair)

## Project Overview
Mobile-first social networking and directory platform for repair professionals in India.
- **Frontend**: Expo/React Native (Firebase Hosting: `https://mobile-repair-app-276b6.web.app`)
- **Backend**: Express/TypeScript (Google Cloud Run: `https://repair-backend-3siuld7gbq-el.a.run.app`)
- **Database**: Neon.tech PostgreSQL

## Deployment Strategy
- **Frontend**: `npx expo export --platform web` then `npx firebase-tools deploy --only hosting`
- **Backend**: `npx esbuild server/index.ts --platform=node --bundle --format=cjs --external:*.node --outdir=server_dist` then `node build-steps.js`.

## Configuration
- **Primary Domain**: `https://mobile-repair-app-276b6.web.app`
- **Backend URL**: `https://repair-backend-3siuld7gbq-el.a.run.app`
- **Note**: `atozmobilerepair.in` has been removed from all configurations as per user request.
