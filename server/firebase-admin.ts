import admin from 'firebase-admin';

let initialized = false;

function ensureInitialized() {
  if (!initialized) {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountJson) {
      throw new Error('[Firebase] FIREBASE_SERVICE_ACCOUNT env var not set');
    }
    let serviceAccount: admin.ServiceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch (e) {
      throw new Error('[Firebase] Failed to parse FIREBASE_SERVICE_ACCOUNT JSON');
    }
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    initialized = true;
    console.log('[Firebase] Admin SDK initialized for project:', (serviceAccount as any).project_id);
  }
}

export function getFirestore(): admin.firestore.Firestore {
  ensureInitialized();
  return admin.firestore();
}

export function getAdminAuth(): admin.auth.Auth {
  ensureInitialized();
  return admin.auth();
}
