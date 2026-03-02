#!/bin/bash

# Diagnostic script to find why it fails with exit 1
REGION="asia-south1"
PROJECT_ID="atoz-mobile-repair-488915"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy/repair-backend:latest"

echo "=== DIAGNOSTIC START ==="
pwd
ls -F

echo "=== STEP 1: Setup crane ==="
if [ -f "./crane" ]; then
  cp ./crane /usr/local/bin/crane
  chmod +x /usr/local/bin/crane
  /usr/local/bin/crane version
else
  echo "ERROR: crane binary not found in current directory"
  exit 1
fi

echo "=== STEP 2: Get metadata token ==="
# Using a simpler python script for token retrieval
TOKEN=$(python3 - <<EOF
import urllib.request, json
try:
    req = urllib.request.Request(
        'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
        headers={'Metadata-Flavor': 'Google'}
    )
    with urllib.request.urlopen(req) as f:
        data = json.loads(f.read().decode())
        print(data['access_token'])
except Exception as e:
    print(f"ERROR: {e}")
    exit(1)
EOF
)
if [ $? -ne 0 ]; then
  echo "FATAL: Token retrieval failed: $TOKEN"
  exit 1
fi
echo "Token retrieved (length: ${#TOKEN})"

echo "=== STEP 3: Auth crane ==="
echo "$TOKEN" | /usr/local/bin/crane auth login "${REGION}-docker.pkg.dev" \
  --username oauth2accesstoken --password-stdin || { echo "Auth failed"; exit 1; }

echo "=== STEP 4: Create app layer ==="
mkdir -p /tmp/applayerdir/app/server/templates /tmp/applayerdir/app/uploads
cp -r server_dist /tmp/applayerdir/app/ || { echo "cp server_dist failed"; exit 1; }
cp -r shared /tmp/applayerdir/app/ || { echo "cp shared failed"; exit 1; }
cp -r assets /tmp/applayerdir/app/ || { echo "cp assets failed"; exit 1; }
# Ensure templates directory exists and copy contents
if [ -d "server/templates" ]; then
  cp -r server/templates/* /tmp/applayerdir/app/server/templates/ || { echo "cp templates failed"; exit 1; }
fi
cp app.json /tmp/applayerdir/app/ || { echo "cp app.json failed"; exit 1; }

tar -czf /tmp/app-layer.tar.gz -C /tmp/applayerdir . || { echo "tar failed"; exit 1; }
echo "App layer created: $(ls -lh /tmp/app-layer.tar.gz)"

echo "=== STEP 5: crane append ==="
/usr/local/bin/crane append -b node:20-slim -f /tmp/app-layer.tar.gz -t "$IMAGE" || { echo "crane append failed"; exit 1; }

echo "=== STEP 6: crane mutate ==="
/usr/local/bin/crane mutate "$IMAGE" \
  --workdir /app \
  --env PORT=8080 \
  --env NODE_ENV=production \
  --cmd "node,server_dist/index.js" || { echo "crane mutate failed"; exit 1; }

echo "=== SUCCESS: $IMAGE ==="
/usr/local/bin/crane digest "$IMAGE"
