// Firebase configuration - completely lazy initialization
let firebaseApp: any = null;
let firebaseAuth: any = null;
let firebaseInitAttempted = false;
let firebaseAvailable = false;

// Get config lazily - don't process at module load time
function getFirebaseConfig() {
  if (typeof process === 'undefined') return null;
  const config = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'mobile-repair-app-276b6.appspot.com',
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  };
  // Only log if all config exists
  if (config.apiKey && config.authDomain && config.projectId) {
    // Silent initialization
  }
  return config;
}

export const firebaseConfig = getFirebaseConfig();

const hasRequiredConfig = !!(firebaseConfig?.apiKey && firebaseConfig?.authDomain && firebaseConfig?.projectId);

// Lazy initialization function - called only when Firebase is actually needed
function initializeFirebase() {
  if (firebaseInitAttempted) return firebaseAvailable;
  firebaseInitAttempted = true;

  if (!hasRequiredConfig) {
    if (typeof process !== 'undefined' && (process.env as any).NODE_ENV !== 'production') {
      console.warn('[Firebase] Skipping initialization — missing required config');
    }
    return false;
  }

  try {
    // Use require to avoid module-level initialization
    const firebase = require('firebase/app');
    const { initializeApp, getApps } = firebase;
    
    // Check if already initialized safely
    let apps: any[] = [];
    try {
      apps = getApps();
    } catch (e) {
      // Ignore errors from getApps
    }
    
    if (apps.length === 0) {
      firebaseApp = initializeApp(firebaseConfig);
      console.log('[Firebase] App initialized successfully');
    } else {
      firebaseApp = apps[0];
      console.log('[Firebase] Using existing app instance');
    }
    
    firebaseAvailable = true;
    return true;
  } catch (error: any) {
    console.error('[Firebase] Initialization failed:', error?.message || error?.toString?.());
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

// Export for backward compatibility with live-chat.tsx
// This is a lazy getter that doesn't cause module-load errors
export const firestoreDb = {
  _db: null as any,
  getDb() {
    if (!this._db) this._db = getFirestoreDb();
    return this._db;
  }
} as any;
