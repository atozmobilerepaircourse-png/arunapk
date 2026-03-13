import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'mobile-repair-app-276b6.appspot.com',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
};

console.log('[Firebase] Initializing with config:', {
  apiKey: firebaseConfig.apiKey ? firebaseConfig.apiKey.substring(0, 10) + '...' : 'MISSING',
  authDomain: firebaseConfig.authDomain || 'MISSING',
  projectId: firebaseConfig.projectId || 'MISSING',
  appId: firebaseConfig.appId ? firebaseConfig.appId.substring(0, 10) + '...' : 'MISSING',
  messagingSenderId: firebaseConfig.messagingSenderId || 'MISSING',
});

export const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const firebaseAuth = getAuth(firebaseApp);
export const firebaseStorage = getStorage(firebaseApp);
export const firestoreDb = getFirestore(firebaseApp);
export { firebaseConfig };
