#!/bin/bash
set -e

echo "=== Deploying Backend to Google Cloud Run ==="

echo "[1/5] Setting up GCP credentials..."
echo "$GCP_SA_KEY" > /tmp/gcp_sa.json

echo "[2/5] Bundling server with esbuild..."
npx esbuild server/index.ts --platform=node --bundle --format=cjs --external:*.node --outdir=server_dist

echo "[3/5] Downloading static ffmpeg binary for Cloud Run (Linux x86_64)..."
mkdir -p server_dist/bin
if [ ! -f server_dist/bin/ffmpeg ] || [ ! -s server_dist/bin/ffmpeg ]; then
  echo "  Fetching ffmpeg static binary..."
  FFMPEG_URL="https://github.com/eugeneware/ffmpeg-static/releases/download/b6.0/ffmpeg-linux-x64"
  curl -fsSL "$FFMPEG_URL" -o server_dist/bin/ffmpeg 2>/dev/null \
    || wget -q "$FFMPEG_URL" -O server_dist/bin/ffmpeg
  chmod +x server_dist/bin/ffmpeg
  echo "  ffmpeg downloaded: $(du -sh server_dist/bin/ffmpeg | cut -f1)"
else
  echo "  ffmpeg already present: $(du -sh server_dist/bin/ffmpeg | cut -f1)"
fi

echo "[4/5] Granting Cloud Run service account API permissions for Auto Dub..."
node - <<'GRANT_EOF'
const fs = require('fs');
const https = require('https');

const SA = JSON.parse(fs.readFileSync('/tmp/gcp_sa.json', 'utf8'));
const PROJECT_ID = 'mobi-backend-491410';
const CR_SERVICE_ACCOUNT = `deployment-service@${PROJECT_ID}.iam.gserviceaccount.com`;
const ROLES_NEEDED = [
  'roles/speech.serviceAgent',
  'roles/texttospeech.serviceAgent',
  'roles/cloudtranslate.user',
];

const APIS_TO_ENABLE = [
  'speech.googleapis.com',
  'texttospeech.googleapis.com',
  'translate.googleapis.com',
];

function httpsPost(url, headers, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search,
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'GET', headers }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function getToken() {
  const { GoogleAuth } = require('google-auth-library');
  const auth = new GoogleAuth({ keyFile: '/tmp/gcp_sa.json', scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  return (await client.getAccessToken()).token;
}

(async () => {
  try {
    const token = await getToken();
    const authHeader = { Authorization: 'Bearer ' + token };

    // Enable required APIs
    for (const api of APIS_TO_ENABLE) {
      const r = await httpsPost(
        `https://serviceusage.googleapis.com/v1/projects/${PROJECT_ID}/services/${api}:enable`,
        authHeader, '{}'
      );
      if (r.status === 200 || r.status === 204) console.log(`  Enabled API: ${api}`);
      else if (JSON.parse(r.body || '{}').error?.status === 'ALREADY_EXISTS' || r.status === 200) console.log(`  API already enabled: ${api}`);
      else console.log(`  API ${api}: ${r.status} ${r.body.slice(0,100)}`);
    }

    // Get current IAM policy
    const policyR = await httpsPost(
      `https://cloudresourcemanager.googleapis.com/v1/projects/${PROJECT_ID}:getIamPolicy`,
      authHeader, '{}'
    );
    const policy = JSON.parse(policyR.body);
    if (!policy.bindings) policy.bindings = [];

    // Add required roles
    let changed = false;
    for (const role of ROLES_NEEDED) {
      let binding = policy.bindings.find(b => b.role === role);
      const member = `serviceAccount:${CR_SERVICE_ACCOUNT}`;
      if (!binding) {
        policy.bindings.push({ role, members: [member] });
        changed = true;
        console.log(`  Added role ${role} to ${CR_SERVICE_ACCOUNT}`);
      } else if (!binding.members.includes(member)) {
        binding.members.push(member);
        changed = true;
        console.log(`  Added member to role ${role}`);
      } else {
        console.log(`  Role ${role} already granted`);
      }
    }

    if (changed) {
      const setR = await httpsPost(
        `https://cloudresourcemanager.googleapis.com/v1/projects/${PROJECT_ID}:setIamPolicy`,
        authHeader, JSON.stringify({ policy })
      );
      if (setR.status === 200) console.log('  IAM policy updated successfully');
      else console.log(`  IAM policy update: ${setR.status} ${setR.body.slice(0,200)}`);
    }
  } catch (e) {
    console.log('  IAM grant skipped (non-fatal):', e.message);
  }
})();
GRANT_EOF

echo "[5/5] Building and deploying to Cloud Run..."
node build-steps.js

echo ""
echo "Backend deployed successfully!"
echo "Live at: https://repair-backend-3siuld7gbq-el.a.run.app"
