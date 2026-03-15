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

try {
  if (hasRequiredConfig) {
    firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    firebaseAuth = getAuth(firebaseApp);
    console.log('[Firebase] Initialized successfully');
  } else {
    console.warn('[Firebase] Skipping initialization — missing required config');
  }
} catch (error: any) {
  console.error('[Firebase] Initialization failed:', error?.message);
}

export { firebaseApp };
export { firebaseAuth };

// Provide optional auth — returns null if Firebase isn't ready
export function getFirebaseAuth(): Auth | null {
  return firebaseAuth;
}

export const firebaseStorage = firebaseApp ? getStorage(firebaseApp) : null;
export const firestoreDb = firebaseApp ? getFirestore(firebaseApp) : null;
