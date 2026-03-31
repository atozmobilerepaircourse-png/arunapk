import { Platform, Alert } from 'react-native';
import { apiRequest, getApiUrl } from './query-client';

let currentSessionToken: string | null = null;

export async function initializeRecaptcha(phone: string): Promise<void> {
  // Firebase OTP system - initialization handled by backend
  return;
}

export async function sendFirebaseOTP(phone: string): Promise<{ success: boolean; verifierId?: string; error?: string }> {
  try {
    // Phone OTP via backend (email fallback)
    // Generate OTP via backend and send via configured email service
    const digits = phone.replace(/\D/g, '').slice(-10);
    if (!digits || digits.length !== 10) {
      return { success: false, error: 'Invalid phone number' };
    }

    const res = await apiRequest('POST', '/api/firebase-otp/send-phone', { phone: `+91${digits}` });
    const data = await res.json();

    if (data.success) {
      currentSessionToken = data.sessionToken || null;
      console.log('[Firebase OTP] Phone OTP sent successfully');
      return { success: true };
    }

    return { success: false, error: data.message || 'Failed to send OTP' };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Network error' };
  }
}

export async function verifyFirebaseOTP(code: string): Promise<{ success: boolean; error?: string; sessionToken?: string }> {
  try {
    const res = await apiRequest('POST', '/api/firebase-otp/verify-phone', { otp: code });
    const data = await res.json();

    if (data.success) {
      currentSessionToken = data.sessionToken || null;
      console.log('[Firebase OTP] Phone OTP verified successfully');
      return { success: true, sessionToken: data.sessionToken };
    }

    return { success: false, error: data.message || 'Invalid OTP' };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Network error' };
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
