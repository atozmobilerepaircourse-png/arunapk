import { initializeApp, getApps } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'mobile-repair-app-276b6.appspot.com',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
};

const hasRequiredConfig = !!(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId);

console.log('[Firebase] Config check:', {
  hasApiKey: !!firebaseConfig.apiKey,
  hasAuthDomain: !!firebaseConfig.authDomain,
  hasProjectId: !!firebaseConfig.projectId,
  isConfigValid: hasRequiredConfig,
});

let firebaseApp: any = null;
let firebaseAuth: Auth | null = null;
let initialized = false;

try {
  if (hasRequiredConfig) {
    firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    // DO NOT call getAuth() here - it causes hook errors at module initialization
    // Delay getAuth() until it's actually needed
    console.log('[Firebase] App initialized, auth will be loaded on demand');
    initialized = true;
  } else {
    console.warn('[Firebase] Skipping initialization — missing required config');
  }
} catch (error: any) {
  console.error('[Firebase] Initialization failed:', error?.message);
}

export { firebaseApp };

// Lazy-load Firebase Auth only when needed
export function getFirebaseAuth(): Auth | null {
  try {
    if (!initialized || !firebaseApp) return null;
    if (!firebaseAuth) {
      firebaseAuth = getAuth(firebaseApp);
    }
    return firebaseAuth;
  } catch (error: any) {
    console.error('[Firebase] Failed to get auth:', error?.message);
    return null;
  }
}

// Lazy-load Firebase Storage only when needed
export function getFirebaseStorage() {
  try {
    if (!firebaseApp) return null;
    return getStorage(firebaseApp);
  } catch (error: any) {
    console.error('[Firebase] Failed to get storage:', error?.message);
    return null;
  }
}

// Lazy-load Firestore only when needed
export function getFirestoreDb() {
  try {
    if (!firebaseApp) return null;
    return getFirestore(firebaseApp);
  } catch (error: any) {
    console.error('[Firebase] Failed to get firestore:', error?.message);
    return null;
  }
}
