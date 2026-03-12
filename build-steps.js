const { GoogleAuth } = require('google-auth-library');
const { readFileSync, writeFileSync, existsSync } = require('fs');
const { execSync } = require('child_process');

const SA_KEY = JSON.parse(readFileSync('/tmp/gcp_sa.json', 'utf8'));
const auth = new GoogleAuth({ credentials: SA_KEY, scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
const PROJECT_ID = 'atoz-mobile-repair-488915';
const REGION = 'asia-south1';
const BUCKET = PROJECT_ID + '_cloudbuild';
const IMAGE = `${REGION}-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy/repair-backend:latest`;
const OBJECT = 'source-v19-' + Date.now() + '.tar.gz';
const WORKSPACE = '/home/runner/workspace';
const TAR_PATH = '/tmp/source-deploy.tar.gz';

const getToken = async () => (await (await auth.getClient()).getAccessToken()).token;

// Python snippet to get token via metadata server (runs inside Cloud Build)
const pyGetToken = `python3 -c "import urllib.request,json; req=urllib.request.Request('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',headers={'Metadata-Flavor':'Google'}); data=json.loads(urllib.request.urlopen(req).read()); print(data['access_token'])"`;

// Create the source tarball for Cloud Build (includes push-oci.js and server files)
console.log('=== Creating source tarball ===');
const includeFiles = [
  'push-oci.js',         // OCI push script that runs inside Cloud Build
  'server_dist',         // Fully-bundled server (all npm packages inlined, no node_modules needed)
  'shared',
  'assets',
  'app.json',
];
const optionalFiles = ['server/templates', 'static-build', 'patches'];
for (const f of optionalFiles) {
  if (existsSync(`${WORKSPACE}/${f}`)) includeFiles.push(f);
}

const tarArgs = includeFiles.map(f => `"${f}"`).join(' ');
execSync(
  `cd "${WORKSPACE}" && tar -czf "${TAR_PATH}" ${tarArgs} 2>&1`,
  { stdio: 'pipe' }
);
const tarSize = readFileSync(TAR_PATH).length;
console.log(`Tarball: ${TAR_PATH} (${(tarSize / 1024 / 1024).toFixed(2)} MB)`);
console.log('Includes:', includeFiles.join(', '));

const buildConfig = {
  source: { storageSource: { bucket: BUCKET, object: OBJECT } },
  steps: [
    {
      // push-oci.js downloads node:20-slim from Docker Hub, adds our /app layer, pushes to AR
      name: 'node:20',
      id: 'BuildAndPushImage',
      entrypoint: 'node',
      args: ['push-oci.js'],
      timeout: '600s'
    },
    {
      // Deploy the newly built image to Cloud Run using gcloud inside Cloud Build
      // Also syncs all required secrets as env vars so Cloud Run has them at runtime
      name: 'gcr.io/google.com/cloudsdktool/cloud-sdk',
      id: 'DeployToCloudRun',
      entrypoint: 'gcloud',
      args: (() => {
        // Extract the actual client_secret value from the JSON blob (avoids JSON chars breaking gcloud args)
        let googleClientSecret = '';
        try {
          const raw = process.env.GOOGLE_CLIENT_SECRET || '';
          const parsed = JSON.parse(raw);
          googleClientSecret = parsed?.web?.client_secret
            || parsed?.installed?.client_secret
            || parsed?.client_secret
            || raw;
        } catch {
          googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
        }

        const fast2sms = process.env.FAST2SMS_API_KEY || '';
        const bunnyKey = process.env.BUNNY_STREAM_API_KEY || '';
        const bunnyLib = process.env.BUNNY_STREAM_LIBRARY_ID || '';

        // Build env vars string — use ^##^ separator so commas in values don't break parsing
        const envVarParts = [];
        if (googleClientSecret) envVarParts.push(`GOOGLE_CLIENT_SECRET=${googleClientSecret}`);
        if (fast2sms)           envVarParts.push(`FAST2SMS_API_KEY=${fast2sms}`);
        if (bunnyKey)           envVarParts.push(`BUNNY_STREAM_API_KEY=${bunnyKey}`);
        if (bunnyLib)           envVarParts.push(`BUNNY_STREAM_LIBRARY_ID=${bunnyLib}`);

        const args = [
          'run', 'deploy', 'repair-backend',
          '--image', IMAGE,
          '--project', PROJECT_ID,
          '--region', REGION,
          '--platform', 'managed',
          '--quiet',
        ];
        if (envVarParts.length > 0) {
          args.push('--update-env-vars', '^##^' + envVarParts.join('##'));
        }
        return args;
      })(),
      timeout: '300s'
    }
  ],
  options: { logging: 'CLOUD_LOGGING_ONLY' },
  timeout: '1000s'
};

writeFileSync('/tmp/build-config.json', JSON.stringify(buildConfig, null, 2));
console.log('Build config written. push-oci.js will build and push OCI image inside Cloud Build.');
console.log('server_dist/index.js is now fully bundled (26MB) with all npm packages inlined — no node_modules needed.');

(async () => {
  const token = await getToken();

  // Upload source tarball to GCS
  console.log('\n=== Uploading source tarball to GCS ===');
  const tarContent = readFileSync(TAR_PATH);
  const up = await fetch(
    `https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o?uploadType=media&name=${OBJECT}`,
    {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/gzip' },
      body: tarContent
    }
  );
  if (!up.ok) {
    console.error('Upload failed:', up.status, await up.text());
    process.exit(1);
  }
  console.log('Upload:', up.status, '✓');

  // Submit Cloud Build
  console.log('\n=== Submitting Cloud Build job ===');
  const resp = await fetch(
    `https://cloudbuild.googleapis.com/v1/projects/${PROJECT_ID}/builds`,
    {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildConfig)
    }
  );
  const d = await resp.json();
  if (!d.metadata?.build?.id) {
    console.error('Failed to start build:', JSON.stringify(d).slice(0, 500));
    process.exit(1);
  }
  const buildId = d.metadata.build.id;
  console.log('Build ID:', buildId);
  console.log('Log URL: https://console.cloud.google.com/cloud-build/builds/' + buildId + '?project=' + PROJECT_ID);

  // Poll until complete (max 15 minutes)
  for (let i = 0; i < 90; i++) {
    await new Promise(r => setTimeout(r, 10000));
    const tok = await getToken();
    const r2 = await fetch(
      `https://cloudbuild.googleapis.com/v1/projects/${PROJECT_ID}/builds/${buildId}`,
      { headers: { Authorization: 'Bearer ' + tok } }
    );
    const d2 = await r2.json();
    const stepStatuses = (d2.steps || []).map(s => `${s.id || 'step'}:${s.status || 'PENDING'}`).join(', ');
    const elapsed = (i + 1) * 10;
    console.log(`[${elapsed}s] ${d2.status} | ${stepStatuses}`);

    if (!['QUEUED', 'WORKING'].includes(d2.status)) {
      if (d2.failureInfo) console.log('Failure info:', JSON.stringify(d2.failureInfo));

      if (d2.status === 'SUCCESS') {
        console.log('\n=== Build SUCCESS! Cloud Run updated by Cloud Build gcloud step. ===');

        // ── Inject environment variables into Cloud Run ──────────────────
        console.log('\n=== Syncing environment variables to Cloud Run ===');
        try {
          const envToken = await getToken();
          const serviceUrl = `https://run.googleapis.com/v2/projects/${PROJECT_ID}/locations/${REGION}/services/repair-backend`;

          // Get current service definition
          const svcResp = await fetch(serviceUrl, {
            headers: { Authorization: 'Bearer ' + envToken }
          });
          const svc = await svcResp.json();

          if (!svc.template?.containers?.[0]) {
            console.warn('  Could not read service template — skipping env var sync');
          } else {
            // Build env map from existing vars, then apply overrides from Replit secrets
            const existingEnv = svc.template.containers[0].env || [];
            const envMap = {};
            for (const e of existingEnv) {
              if (e.name && e.value !== undefined) envMap[e.name] = e.value;
            }

            // Secrets to sync from Replit → Cloud Run
            const secretsToSync = [
              'GOOGLE_CLIENT_SECRET',
              'FAST2SMS_API_KEY',
              'BUNNY_STREAM_API_KEY',
              'BUNNY_STREAM_LIBRARY_ID',
              'GCP_SA_KEY',
            ];
            let syncCount = 0;
            for (const key of secretsToSync) {
              const val = process.env[key];
              if (val) {
                envMap[key] = val;
                syncCount++;
                console.log(`  ✓ ${key} (${val.length} chars)`);
              } else {
                console.log(`  ⚠ ${key} not set in Replit env — skipping`);
              }
            }

            // Rebuild env array
            svc.template.containers[0].env = Object.entries(envMap).map(([name, value]) => ({ name, value }));

            // PATCH the service
            const patchResp = await fetch(serviceUrl, {
              method: 'PATCH',
              headers: { Authorization: 'Bearer ' + envToken, 'Content-Type': 'application/json' },
              body: JSON.stringify(svc)
            });
            const patchData = await patchResp.json();
            if (patchResp.ok) {
              console.log(`  ✅ ${syncCount} env var(s) synced to Cloud Run`);
              // Wait a moment for the new revision to roll out
              await new Promise(r => setTimeout(r, 5000));
              console.log('  New revision rolling out...');
            } else {
              console.warn('  ⚠ Failed to patch env vars:', JSON.stringify(patchData).slice(0, 300));
            }
          }
        } catch (envErr) {
          console.warn('  Env var sync error (non-fatal):', envErr.message);
        }
        // ─────────────────────────────────────────────────────────────────

        console.log('Deploy complete! Live at: https://repair-backend-3siuld7gbq-el.a.run.app');
      } else {
        console.error('Build FAILED with status:', d2.status);
        process.exit(1);
      }
      break;
    }
  }
})().catch(err => { console.error(err); process.exit(1); });
