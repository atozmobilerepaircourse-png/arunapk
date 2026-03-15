import { Platform, Alert } from 'react-native';
import { apiRequest, getApiUrl } from './query-client';

let recaptchaVerifierId: string | null = null;
let recaptchaVerificationToken: string | null = null;

export async function initializeRecaptcha(phone: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      // Web: Use Firebase reCAPTCHA
      const { getFirebaseAuth } = await import('./firebase');
      const auth = getFirebaseAuth();
      if (!auth) {
        console.log('[Firebase Phone Auth] Auth not available, will use fallback');
        return;
      }

      try {
        const { RecaptchaVerifier, signInWithPhoneNumber } = await import('firebase/auth');
        
        if (!window.recaptchaVerifier) {
          window.recaptchaVerifier = new RecaptchaVerifier(
            'recaptcha-container',
            { size: 'invisible' },
            auth
          );
        }
        console.log('[Firebase Phone Auth] reCAPTCHA initialized');
      } catch (e) {
        console.log('[Firebase Phone Auth] reCAPTCHA init failed, will fallback:', e);
      }
    }
  } catch (e) {
    console.log('[Firebase Phone Auth] Firebase phone auth unavailable, will use fallback');
  }
}

export async function sendFirebaseOTP(phone: string): Promise<{ success: boolean; verifierId?: string; error?: string }> {
  try {
    if (Platform.OS === 'web') {
      const { getFirebaseAuth } = await import('./firebase');
      const auth = getFirebaseAuth();
      if (!auth) {
        return { success: false, error: 'Firebase not configured' };
      }

      try {
        const { signInWithPhoneNumber } = await import('firebase/auth');
        const fullPhone = phone.startsWith('+91') ? phone : `+91${phone}`;
        
        const confirmationResult = await Promise.race([
          signInWithPhoneNumber(auth, fullPhone, window.recaptchaVerifier),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Firebase OTP timeout')), 10000)
          )
        ]);

        recaptchaVerifierId = confirmationResult?.verificationId || null;
        console.log('[Firebase Phone Auth] OTP sent successfully');
        return { success: true, verifierId: recaptchaVerifierId || undefined };
      } catch (error: any) {
        const errorMsg = error?.message || 'Firebase OTP failed';
        console.warn('[Firebase Phone Auth] Failed:', errorMsg);
        return { success: false, error: errorMsg };
      }
    }
    return { success: false, error: 'Firebase not available on native' };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Error' };
  }
}

export async function verifyFirebaseOTP(code: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!recaptchaVerifierId || Platform.OS !== 'web') {
      return { success: false, error: 'Firebase verification not initialized' };
    }

    try {
      const { getFirebaseAuth } = await import('./firebase');
      const auth = getFirebaseAuth();
      if (!auth) {
        return { success: false, error: 'Firebase auth not available' };
      }

      const { signInWithCredential, PhoneAuthProvider } = await import('firebase/auth');
      const credential = PhoneAuthProvider.credential(recaptchaVerifierId, code);
      
      await Promise.race([
        signInWithCredential(auth, credential),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Verification timeout')), 5000)
        )
      ]);

      console.log('[Firebase Phone Auth] OTP verified successfully');
      recaptchaVerifierId = null;
      return { success: true };
    } catch (error: any) {
      const errorMsg = error?.message || 'Verification failed';
      console.warn('[Firebase Phone Auth] Verification failed:', errorMsg);
      return { success: false, error: errorMsg };
    }
  } catch (e: any) {
    return { success: false, error: e?.message || 'Error' };
  }
}

export async function sendFallbackOTP(phone: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await apiRequest('POST', '/api/otp/send', { phone });
    const data = await res.json();
    
    if (data.success) {
      console.log('[Fallback OTP] Sent successfully');
      return { success: true };
    }
    
    return { success: false, error: data.message || 'Failed to send OTP' };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Network error' };
  }
}

export async function verifyFallbackOTP(phone: string, code: string): Promise<any> {
  try {
    const deviceId = await (await import('./device-fingerprint')).getDeviceId();
    const res = await apiRequest('POST', '/api/otp/verify', { phone, otp: code, deviceId });
    const data = await res.json();
    
    if (data.success) {
      console.log('[Fallback OTP] Verified successfully');
      return { success: true, data };
    }
    
    return { success: false, error: data.message || 'Invalid OTP' };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Network error' };
  }
}

// Declare recaptcha container for web
declare global {
  interface Window {
    recaptchaVerifier?: any;
  }
}
