#!/bin/bash
set -e

echo "=== Deploying Backend to Google Cloud Run ==="

echo "[1/3] Setting up GCP credentials..."
echo "$GCP_SA_KEY" > /tmp/gcp_sa.json

echo "[2/3] Bundling server with esbuild..."
npx esbuild server/index.ts --platform=node --bundle --format=cjs --external:*.node --outdir=server_dist

echo "[3/3] Building and deploying to Cloud Run..."
node build-steps.js

echo ""
echo "Backend deployed successfully!"
echo "Live at: https://repair-backend-3siuld7gbq-el.a.run.app"
