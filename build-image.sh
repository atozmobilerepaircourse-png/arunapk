#!/bin/bash

REGION="asia-south1"
PROJECT_ID="atoz-mobile-repair-488915"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy/repair-backend:latest"

die() { echo "FATAL: $1" >&2; exit 1; }

echo "=== STEP 1: Setup crane ==="
cp crane /usr/local/bin/crane || die "cp crane failed"
chmod +x /usr/local/bin/crane || die "chmod failed"
/usr/local/bin/crane version || die "crane version failed"

echo "=== STEP 2: Get metadata token via Python3 ==="
TOKEN=$(python3 -c "
import urllib.request, json
req = urllib.request.Request(
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
  headers={'Metadata-Flavor': 'Google'}
)
data = json.loads(urllib.request.urlopen(req).read())
print(data['access_token'])
" 2>&1)
PYTHON_EXIT=$?
echo "Python3 token exit: $PYTHON_EXIT | token_length: ${#TOKEN}"
[ $PYTHON_EXIT -ne 0 ] && die "Python3 token fetch failed: $TOKEN"
[ -z "$TOKEN" ] && die "empty token"

echo "=== STEP 3: Auth crane ==="
echo "$TOKEN" | /usr/local/bin/crane auth login "${REGION}-docker.pkg.dev" \
  --username oauth2accesstoken --password-stdin || die "crane auth failed"

echo "=== STEP 4: Create app layer ==="
mkdir -p /tmp/applayerdir/app/server/templates /tmp/applayerdir/app/uploads
cp -r server_dist /tmp/applayerdir/app/ || die "cp server_dist failed"
cp -r shared /tmp/applayerdir/app/ || die "cp shared failed"
cp -r assets /tmp/applayerdir/app/ || die "cp assets failed"
cp server/templates/* /tmp/applayerdir/app/server/templates/ || die "cp templates failed"
cp app.json /tmp/applayerdir/app/ || die "cp app.json failed"
ls /tmp/applayerdir/app/
tar -czf /tmp/app-layer.tar.gz -C /tmp/applayerdir . || die "tar failed"
ls -lh /tmp/app-layer.tar.gz

echo "=== STEP 5: crane append ==="
/usr/local/bin/crane append -b node:20-slim -f /tmp/app-layer.tar.gz -t "$IMAGE" \
  || die "crane append failed"
echo "crane append: OK"

echo "=== STEP 6: crane mutate ==="
/usr/local/bin/crane mutate "$IMAGE" \
  --workdir /app \
  --env PORT=8080 \
  --env NODE_ENV=production \
  --cmd "node,server_dist/index.js" || die "crane mutate failed"

echo "=== IMAGE READY: $IMAGE ==="
/usr/local/bin/crane digest "$IMAGE"
