import { Platform, Alert } from 'react-native';
import { apiRequest, getApiUrl } from './query-client';

let currentSessionToken: string | null = null;

export async function initializeRecaptcha(phone: string): Promise<void> {
  // Firebase OTP system - initialization handled by backend
  return;
}

export async function sendFirebaseOTP(phone: string): Promise<{ success: boolean; verifierId?: string; error?: string }> {
  try {
    // Use Firebase's native signInWithPhoneNumber() for SMS
    // Works on Expo/React Native without RecaptchaVerifier
    const digits = phone.replace(/\D/g, '').slice(-10);
    if (!digits || digits.length !== 10) {
      return { success: false, error: 'Invalid phone number' };
    }

    const fullPhone = `+91${digits}`;
    console.log('[Firebase OTP] Sending OTP via Firebase to', fullPhone);

    try {
      const { getFirebaseAuth } = await import('@/lib/firebase');
      const { signInWithPhoneNumber } = await import('firebase/auth');

      const auth = getFirebaseAuth();
      if (!auth) {
        throw new Error('Firebase not initialized');
      }

      // On React Native/Expo, signInWithPhoneNumber sends SMS directly
      // No RecaptchaVerifier needed on mobile
      const confirmationResult = await signInWithPhoneNumber(auth, fullPhone);
      
      // Store confirmation result globally for verification step
      if (typeof window !== 'undefined') {
        (window as any).firebaseConfirmationResult = confirmationResult;
      }

      console.log('[Firebase OTP] SMS sent successfully via Firebase');
      return { success: true };
    } catch (firebaseErr: any) {
      console.error('[Firebase OTP] Firebase error:', firebaseErr?.message);
      throw firebaseErr;
    }
  } catch (e: any) {
    console.error('[Firebase OTP] Send error:', e?.message);
    return { success: false, error: e?.message || 'Failed to send OTP via Firebase' };
  }
}

export async function verifyFirebaseOTP(code: string): Promise<{ success: boolean; error?: string; verified?: boolean }> {
  try {
    // Use Firebase's confirmation result to verify OTP
    const confirmationResult = (typeof window !== 'undefined' && (window as any).firebaseConfirmationResult);
    
    if (!confirmationResult) {
      return { success: false, error: 'OTP not requested yet', verified: false };
    }

    try {
      // Verify using Firebase confirmation result
      const userCredential = await confirmationResult.confirm(code);
      console.log('[Firebase OTP] Verified successfully via Firebase');
      return { success: true, verified: true };
    } catch (firebaseErr: any) {
      console.error('[Firebase OTP] Firebase verification error:', firebaseErr?.message);
      return { success: false, error: firebaseErr?.message || 'Invalid OTP', verified: false };
    }
  } catch (e: any) {
    console.error('[Firebase OTP] Verify error:', e);
    return { success: false, error: e?.message || 'Network error', verified: false };
  }
}

export async function sendFallbackOTP(phone: string): Promise<{ success: boolean; otp?: string; smsSent?: boolean; error?: string }> {
  try {
    const res = await apiRequest('POST', '/api/otp/send', { phone });
    const data = await res.json();
    
    if (data.success) {
      console.log('[Fallback OTP] Generated. smsSent:', data.smsSent);
      return { success: true, otp: data.otp, smsSent: data.smsSent };
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
