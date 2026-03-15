// Firebase configuration - intentionally delayed initialization
let firebaseApp: any = null;
let firebaseAuth: any = null;
let firebaseInitAttempted = false;
let firebaseAvailable = false;

export const firebaseConfig = {
  apiKey: typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_FIREBASE_API_KEY : undefined,
  authDomain: typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN : undefined,
  projectId: typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID : undefined,
  storageBucket: typeof process !== 'undefined' ? (process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'mobile-repair-app-276b6.appspot.com') : undefined,
  appId: typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_FIREBASE_APP_ID : undefined,
  messagingSenderId: typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID : undefined,
};

const hasRequiredConfig = !!(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId);

if (typeof process !== 'undefined') {
  console.log('[Firebase] Config check:', {
    hasApiKey: !!firebaseConfig.apiKey,
    hasAuthDomain: !!firebaseConfig.authDomain,
    hasProjectId: !!firebaseConfig.projectId,
    isConfigValid: hasRequiredConfig,
  });
}

// Lazy initialization function - called only when Firebase is actually needed
function initializeFirebase() {
  if (firebaseInitAttempted) return firebaseAvailable;
  firebaseInitAttempted = true;

  if (!hasRequiredConfig) {
    console.warn('[Firebase] Skipping initialization — missing required config');
    return false;
  }

  try {
    const { initializeApp, getApps } = require('firebase/app');
    
    // Check if already initialized safely
    let apps;
    try {
      apps = getApps();
    } catch {
      apps = [];
    }
    
    if (apps.length === 0) {
      firebaseApp = initializeApp(firebaseConfig);
    } else {
      firebaseApp = apps[0];
    }
    
    firebaseAvailable = true;
    console.log('[Firebase] App initialized successfully');
    return true;
  } catch (error: any) {
    console.error('[Firebase] Initialization failed:', error?.message || error);
    firebaseApp = null;
    firebaseAvailable = false;
    return false;
  }
}

export { firebaseApp };

// Check if Firebase is available without triggering initialization
export function isFirebaseAvailable(): boolean {
  return hasRequiredConfig;
}

// Lazy-load Firebase Auth only when needed
export function getFirebaseAuth(): any {
  if (!initializeFirebase()) return null;
  
  try {
    if (!firebaseAuth) {
      const { getAuth } = require('firebase/auth');
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
  if (!initializeFirebase()) return null;
  
  try {
    const { getStorage } = require('firebase/storage');
    return getStorage(firebaseApp);
  } catch (error: any) {
    console.error('[Firebase] Failed to get storage:', error?.message);
    return null;
  }
}

// Lazy-load Firestore only when needed
export function getFirestoreDb() {
  if (!initializeFirebase()) return null;
  
  try {
    const { getFirestore } = require('firebase/firestore');
    return getFirestore(firebaseApp);
  } catch (error: any) {
    console.error('[Firebase] Failed to get firestore:', error?.message);
    return null;
  }
}
