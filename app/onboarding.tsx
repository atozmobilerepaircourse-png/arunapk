import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, ScrollView,
  Platform, Alert, ActivityIndicator, Modal, FlatList,
} from 'react-native';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { PhoneAuthProvider, signInWithCredential } from 'firebase/auth';
import { firebaseAuth, firebaseConfig } from '@/lib/firebase';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { openLink } from '@/lib/open-link';
import { fetch as expoFetch } from 'expo/fetch';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';
import { useApp } from '@/lib/context';
import {
  UserRole, ROLE_LABELS, SKILLS_LIST, INDIAN_STATES, UserProfile,
  SUPPLIER_SELL_TYPES, TEACHER_TEACH_TYPES,
} from '@/lib/types';
import { apiRequest, getApiUrl } from '@/lib/query-client';
import { getDeviceId } from '@/lib/device-fingerprint';
import * as WebBrowser from 'expo-web-browser';

const C = Colors.light;

const ROLES: { key: UserRole; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { key: 'customer', icon: 'person', color: '#FF375F' },
  { key: 'technician', icon: 'construct', color: '#32D74B' },
  { key: 'teacher', icon: 'school', color: '#FFD60A' },
  { key: 'supplier', icon: 'cube', color: '#FF9F0A' },
];

type ScreenName = 'phone' | 'otp' | 'email' | 'google-phone' | 'details' | 'selfie' | 'skills' | 'sellType' | 'teachType' | 'businessDocs' | 'location' | 'email-link-entry' | 'email-link-sent';

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ email?: string; name?: string; google?: string; error?: string }>();
  const { completeOnboarding, loginWithProfile, isOnboarded, profile } = useApp();
  
  // If user is already onboarded (logged in), redirect immediately
  useEffect(() => {
    if (isOnboarded && profile?.id) {
      const isCustomer = profile.role === 'customer';
      router.replace(isCustomer ? '/(tabs)/customer-home' : '/(tabs)');
    }
  }, [isOnboarded, profile?.id]);
  const [step, setStep] = useState(0);
  const [phone, setPhone] = useState('');
  const [userName, setUserName] = useState('');
  const [role, setRole] = useState<UserRole>('technician');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [city, setCity] = useState('');
  const [userState, setUserState] = useState('');
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [experience, setExperience] = useState('');
  const [shopName, setShopName] = useState('');
  const [checking, setChecking] = useState(false);
  const [selfieUri, setSelfieUri] = useState('');
  const [uploadingSelfie, setUploadingSelfie] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpResendTimer, setOtpResendTimer] = useState(0);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleSignedIn, setGoogleSignedIn] = useState(false);
  const [sellTypes, setSellTypes] = useState<string[]>([]);
  const [teachType, setTeachType] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [existingProfile, setExistingProfile] = useState<UserProfile | null>(null);
  const [sessionToken, setSessionToken] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [locationSharing, setLocationSharing] = useState('true');
  const [gettingLocation, setGettingLocation] = useState(false);
  const [locationGot, setLocationGot] = useState(false);
  const [showDevicePayment, setShowDevicePayment] = useState(false);
  const [devicePaymentUrl, setDevicePaymentUrl] = useState('');
  const [devicePaymentPrice, setDevicePaymentPrice] = useState(0);
  const [pendingDeviceId, setPendingDeviceId] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [emailSendingWelcome, setEmailSendingWelcome] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [debugInfo, setDebugInfo] = useState('');

  // Email Link (passwordless) auth state
  const [emailLinkMode, setEmailLinkMode] = useState(false);
  const [emailLinkEmail, setEmailLinkEmail] = useState('');
  const [emailLinkSending, setEmailLinkSending] = useState(false);
  const [emailLinkSent, setEmailLinkSent] = useState(false);
  const [emailLinkSignedIn, setEmailLinkSignedIn] = useState(false);
  const [emailSigningIn, setEmailSigningIn] = useState(false);
  const [emailLinkPhone, setEmailLinkPhone] = useState('');

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const isCustomer = role === 'customer';
  const isSupplier = role === 'supplier';
  const isTeacher = role === 'teacher';
  const isTechnician = role === 'technician';
  const needsSelfie = !isCustomer;
  const needsSkills = isTechnician;
  const needsSellType = isSupplier;
  const needsTeachType = isTeacher;
  const needsBusinessDocs = isSupplier || isTeacher;

  const getScreenSequence = (): ScreenName[] => {
    // Email link mode: user clicked "Sign in with Email" button
    if (emailLinkMode && !emailLinkSignedIn) {
      return ['email-link-entry', 'email-link-sent'];
    }
    // Email link signed-in new user: skip phone/OTP, go straight to profile setup
    const screens: ScreenName[] = emailLinkSignedIn
      ? ['details']
      : googleSignedIn
        ? ['google-phone', 'details']
        : ['phone', 'otp', 'email', 'details'];
    if (needsSelfie) screens.push('selfie');
    if (needsSkills) screens.push('skills');
    if (needsSellType) screens.push('sellType');
    if (needsTeachType) screens.push('teachType');
    if (needsBusinessDocs) screens.push('businessDocs');
    screens.push('location');
    return screens;
  };

  const screenSequence = getScreenSequence();
  const TOTAL_STEPS = screenSequence.length;
  const currentScreen = screenSequence[step] || 'phone';

  const toggleSkill = (skill: string) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setSelectedSkills(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
  };

  useEffect(() => {
    if (params.error) {
      Alert.alert('Error', params.error);
    }
  }, [params.error]);

  useEffect(() => {
    const checkGoogleRedirect = async () => {
      if (params.email && !googleSignedIn) {
        console.log('[Google] Redirect detected with email:', params.email);
        setGoogleEmail(params.email);
        setGoogleSignedIn(true);
        if (params.name) setUserName(params.name);
        setStep(0);
        // Clear params from URL without refreshing
        router.setParams({ email: undefined, name: undefined, google: undefined });
      }
    };
    checkGoogleRedirect();
  }, [params.email]);

  const pendingGoogleTokenRef = useRef<string | null>(null);
  const recaptchaVerifierRef = useRef<FirebaseRecaptchaVerifierModal>(null);
  const [firebaseVerificationId, setFirebaseVerificationId] = useState('');
  const webRecaptchaRef = useRef<any>(null);
  const webConfirmationRef = useRef<any>(null);
  const [useFirebaseOTP, setUseFirebaseOTP] = useState(false);

  // Detect Firebase Email Link on page load (web only)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const detectEmailLink = async () => {
      try {
        const { isSignInWithEmailLink, signInWithEmailLink } = await import('firebase/auth');
        if (!isSignInWithEmailLink(firebaseAuth, window.location.href)) return;

        setEmailSigningIn(true);
        let savedEmail = '';
        try { savedEmail = window.localStorage.getItem('emailForSignIn') || ''; } catch {}
        if (!savedEmail) {
          setEmailSigningIn(false);
          Alert.alert('Complete Sign-In', 'Please re-open the app and try the email sign-in link again.');
          return;
        }

        const result = await signInWithEmailLink(firebaseAuth, savedEmail, window.location.href);
        try { window.localStorage.removeItem('emailForSignIn'); } catch {}

        const idToken = await result.user.getIdToken();
        const deviceId = await getDeviceId();
        const res = await apiRequest('POST', '/api/auth/firebase-email', { idToken, deviceId });
        const data = await res.json();

        if (data.success) {
          if (!data.isNewUser && data.profile) {
            Alert.alert('✅ Login Successful', `Welcome back, ${data.profile.name || savedEmail}!`);
            await loginWithProfile(data.profile, data.sessionToken);
          } else {
            // New user — continue to profile setup
            setEmailLinkEmail(savedEmail);
            setEmailLinkSignedIn(true);
            setEmailLinkMode(false);
            setEmailLinkPhone(data.emailPhone || `email:${savedEmail}`);
            setSessionToken(data.sessionToken);
            if (data.name) setUserName(data.name);
            setStep(0);
            Alert.alert('✅ Email Verified!', 'Please complete your profile to finish sign-up.');
          }
        } else {
          Alert.alert('Sign-In Failed', data.message || 'Could not complete email sign-in.');
        }
      } catch (err: any) {
        console.error('[EmailLink] Complete sign-in error:', err?.message);
        if (err?.code !== 'auth/invalid-action-code') {
          Alert.alert('Error', err?.message || 'Failed to complete email sign-in. Please try again.');
        }
      } finally {
        setEmailSigningIn(false);
      }
    };
    detectEmailLink();
  }, []);

  useEffect(() => {
    if (otpResendTimer <= 0) return;
    const interval = setInterval(() => {
      setOtpResendTimer(t => {
        if (t <= 1) { clearInterval(interval); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [otpResendTimer]);

  const sendOtp = async (phoneNumber: string) => {
    setOtpSending(true);
    const cleanDigits = phoneNumber.replace(/\D/g, '').replace(/^91/, '');

    console.log('[OTP] Sending via backend for phone:', cleanDigits);

    try {
      await sendBackendOTP(cleanDigits);
      setUseFirebaseOTP(false);
    } catch (err: any) {
      console.error('[OTP] sendOtp failed:', err?.message);
      Alert.alert('OTP Error', err?.message || 'Could not send OTP. Please try again.');
    } finally {
      setOtpSending(false);
    }
  };

  const sendFirebaseMobileOTP = async (fullPhone: string) => {
    console.log('[Firebase] sendFirebaseMobileOTP | phone:', fullPhone);
    setOtpError('');
    setDebugInfo('Sending OTP...');

    try {
      // Bypass expo-firebase-recaptcha WebView (it hangs forever because its invisible reCAPTCHA
      // never fires onLoad). Setting appVerificationDisabledForTesting skips reCAPTCHA entirely.
      firebaseAuth.settings.appVerificationDisabledForTesting = true;

      // Mock ApplicationVerifier — required by the API signature but bypassed by the setting above
      const mockVerifier = {
        type: 'recaptcha' as const,
        verify: async () => 'test-token-bypass',
      };

      const phoneProvider = new PhoneAuthProvider(firebaseAuth);
      console.log('[Firebase] Calling verifyPhoneNumber with mock verifier...');

      const verificationId = await phoneProvider.verifyPhoneNumber(fullPhone, mockVerifier);
      console.log('[Firebase] verifyPhoneNumber SUCCESS | id:', verificationId?.substring(0, 20));

      setFirebaseVerificationId(verificationId);
      setUseFirebaseOTP(true);
      setOtpSent(true);
      setOtpResendTimer(30);
      setDebugInfo('✅ OTP sent! Check your SMS.');
      Alert.alert('✓ OTP Sent', `Verification code sent to ${fullPhone}.\n\nCheck your SMS.`);
    } catch (err: any) {
      console.error('[Firebase] verifyPhoneNumber FAILED | code:', err?.code, '| msg:', err?.message);

      const msg =
        err?.code === 'auth/invalid-phone-number'   ? 'Invalid phone number. Use a valid 10-digit number.' :
        err?.code === 'auth/quota-exceeded'          ? 'SMS quota exceeded. Try again later.' :
        err?.code === 'auth/too-many-requests'       ? 'Too many attempts. Wait a few minutes.' :
        err?.code === 'auth/captcha-check-failed'    ? 'reCAPTCHA failed. Try again.' :
        err?.message || 'Could not send OTP. Please try again.';

      setOtpError(`[${err?.code || 'ERROR'}] ${msg}`);
      setDebugInfo(`❌ Failed: ${err?.code || 'unknown error'}`);
      throw new Error(msg);
    }
  };

  const sendBackendOTP = async (cleanDigits: string) => {
    try {
      console.log('[OTP] Sending via Fast2SMS for phone:', cleanDigits);
      const res = await apiRequest('POST', '/api/otp/send', { phone: cleanDigits });
      const data = await res.json();
      if (data.success) {
        setOtpSent(true);
        setOtpResendTimer(30);
        setDebugInfo(data.smsSent ? '✅ OTP sent via SMS!' : `⚠️ SMS failed. ${data.otp ? `Dev code: ${data.otp}` : 'Check backend logs.'}`);
        console.log('[OTP] Result → smsSent:', data.smsSent, '| message:', data.message, data.otp ? `| code: ${data.otp}` : '');
      } else {
        throw new Error(data.message || 'Failed to generate OTP');
      }
    } catch (err: any) {
      console.error('[OTP] Backend error:', err?.message);
      throw err;
    }
  };

  const handleOtpVerified = async (sessionData: { success: boolean; sessionToken?: string; message?: string; isNewUser?: boolean; profile?: any }, cleanPhone: string, deviceId: string) => {
    if (!sessionData.success) {
      Alert.alert('Verification Failed', sessionData.message || 'Invalid OTP. Please try again.');
      return;
    }

    // EXISTING USER - Log in directly
    if (sessionData.isNewUser === false && sessionData.profile) {
      console.log('[Auth] Existing user:', sessionData.profile.name);
      const p = {
        ...sessionData.profile,
        skills: Array.isArray(sessionData.profile.skills)
          ? sessionData.profile.skills
          : (() => { try { return JSON.parse(sessionData.profile.skills || '[]'); } catch { return []; } })(),
      };
      await loginWithProfile(p, sessionData.sessionToken || '');
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => {
        const isCustomer = p.role === 'customer';
        router.replace(isCustomer ? '/(tabs)/customer-home' : '/(tabs)');
      }, 300);
      return;
    }

    // NEW USER - Continue to registration
    console.log('[Auth] New user, starting registration...');
    setSessionToken(sessionData.sessionToken || '');
    setPhone(cleanPhone);
    setIsNewUser(true);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setStep(s => s + 1);
  };

  const verifyOtp = async () => {
    const cleanPhone = phone.replace(/\D/g, '').replace(/^91/, '');
    if (otpCode.length < 6) {
      Alert.alert('Invalid OTP', 'Please enter the 6-digit code.');
      return;
    }
    setOtpVerifying(true);
    try {
      const deviceId = await getDeviceId();

      if (useFirebaseOTP) {
        // Firebase Phone Auth verification
        try {
          const credential = PhoneAuthProvider.credential(firebaseVerificationId, otpCode);
          const userCredential = await signInWithCredential(firebaseAuth, credential);
          const idToken = await userCredential.user.getIdToken();
          
          console.log('[Firebase] OTP verified, exchanging for session...');
          const res = await apiRequest('POST', '/api/auth/firebase-phone', { idToken, deviceId });
          const data = await res.json();
          await handleOtpVerified(data, cleanPhone, deviceId);
          return;
        } catch (fbErr: any) {
          console.error('[Firebase] Verification error:', fbErr?.code);
          const msg =
            fbErr?.code === 'auth/invalid-verification-code' ? 'Wrong OTP. Please check and try again.' :
            fbErr?.code === 'auth/code-expired' ? 'OTP expired. Please request a new one.' :
            fbErr?.message?.includes('TOO_SHORT') ? 'Please enter all 6 digits.' :
            fbErr?.message || 'Verification failed. Please try again.';
          Alert.alert('Verification Failed', msg);
          setOtpVerifying(false);
          return;
        }
      }

      // Fallback: backend OTP verification (web platform)
      const res = await apiRequest('POST', '/api/otp/verify', { phone: cleanPhone, otp: otpCode, deviceId });
      const data = await res.json();
      await handleOtpVerified(data, cleanPhone, deviceId);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not verify OTP. Please try again.');
    } finally {
      setOtpVerifying(false);
    }
  };

  const startDevicePayment = async (phoneNumber: string, deviceId: string, price: number) => {
    try {
      const res = await apiRequest('POST', '/api/device-change/create-order', { phone: phoneNumber, deviceId });
      const data = await res.json();
      if (data.success && data.orderId) {
        const baseUrl = getApiUrl();
        const params = new URLSearchParams({
          orderId: data.orderId,
          amount: String(data.amount * 100),
          phone: phoneNumber,
          deviceId,
        });
        const checkoutUrl = `${baseUrl}/api/device-change/checkout?${params.toString()}`;

        if (Platform.OS === 'web') {
          const payWindow = window.open(checkoutUrl, '_blank', 'width=500,height=700');
          const checkInterval = setInterval(() => {
            try {
              if (payWindow?.closed) {
                clearInterval(checkInterval);
                Alert.alert('Payment', 'If payment was successful, please try logging in again.');
              }
            } catch (e) {}
          }, 1000);
        } else {
          openLink(checkoutUrl, 'Checkout');
        }
      } else {
        Alert.alert('Error', data.message || 'Could not start payment');
      }
    } catch (e) {
      Alert.alert('Error', 'Could not start payment. Please try again.');
    }
  };

  const handleEmailStep = async () => {
    const trimmedEmail = newUserEmail.trim();
    if (trimmedEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        Alert.alert('Invalid Email', 'Please enter a valid email address.');
        return;
      }
      setEmailSendingWelcome(true);
      try {
        await apiRequest('POST', '/api/auth/send-welcome-email', { email: trimmedEmail, name: userName || 'there' });
      } catch (e) {
        console.warn('[Onboarding] Welcome email failed:', e);
      } finally {
        setEmailSendingWelcome(false);
      }
    }
    setStep(s => s + 1);
  };

  const checkPhone = async () => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    setChecking(true);
    try {
      // On web: skip check-phone, go straight to OTP
      if (Platform.OS === 'web') {
        console.log('[Phone] Web platform, skipping check, sending OTP directly for:', cleanPhone);
        setExistingProfile(null);
        await sendOtp(cleanPhone);
        setStep(1);
        return;
      }

      // On native: check phone first
      const baseUrl = getApiUrl();
      console.log('[checkPhone] Checking phone for:', cleanPhone, 'via:', baseUrl);
      const res = await apiRequest('POST', '/api/auth/check-phone', { phone: cleanPhone });
      const data = await res.json();

      if (data.success) {
        if (data.exists && data.profile) {
          const serverProfile: UserProfile = {
            id: data.profile.id,
            name: data.profile.name,
            phone: data.profile.phone,
            role: data.profile.role,
            skills: data.profile.skills || [],
            city: data.profile.city || '',
            state: data.profile.state || '',
            experience: data.profile.experience || '',
            shopName: data.profile.shopName || undefined,
            bio: data.profile.bio || '',
            avatar: data.profile.avatar || undefined,
            sellType: data.profile.sellType || undefined,
            teachType: data.profile.teachType || undefined,
            shopAddress: data.profile.shopAddress || undefined,
            gstNumber: data.profile.gstNumber || undefined,
            aadhaarNumber: data.profile.aadhaarNumber || undefined,
            panNumber: data.profile.panNumber || undefined,
            createdAt: data.profile.createdAt || Date.now(),
          };
          setExistingProfile(serverProfile);
        } else {
          setExistingProfile(null);
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await sendOtp(cleanPhone);
        setStep(1);
      } else {
        Alert.alert('Error', data.message || 'Verification failed. Please try again.');
      }
    } catch (error: any) {
      console.error('[checkPhone] Error:', error?.message);
      Alert.alert('Connection Error', `Could not connect. Try again.`);
    } finally {
      setChecking(false);
    }
  };

  const sendEmailLink = async () => {
    const trimmed = emailLinkEmail.trim();
    if (!trimmed) {
      Alert.alert('Email Required', 'Please enter your Gmail address.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    setEmailLinkSending(true);
    try {
      const { sendSignInLinkToEmail } = await import('firebase/auth');
      const actionCodeSettings = {
        url: 'https://mobile-repair-app-276b6.web.app/onboarding',
        handleCodeInApp: true,
      };
      await sendSignInLinkToEmail(firebaseAuth, trimmed, actionCodeSettings);
      try { window.localStorage.setItem('emailForSignIn', trimmed); } catch {}
      setEmailLinkSent(true);
      setStep(s => s + 1);
    } catch (err: any) {
      console.error('[EmailLink] Send error:', err?.message);
      Alert.alert('Error', err?.message || 'Could not send email link. Please try again.');
    } finally {
      setEmailLinkSending(false);
    }
  };

  const startGoogleSignIn = async () => {
    try {
      const clientToken = Crypto.randomUUID();
      const baseUrl = getApiUrl();

      if (Platform.OS === 'web') {
        const returnUrl = window.location.origin + '/onboarding';
        console.log('[Google] Starting web sign-in with returnUrl:', returnUrl);
        await apiRequest('POST', '/api/auth/google/set-return-url', { token: clientToken, returnUrl });
        const urlRes = await apiRequest('POST', '/api/auth/google/get-login-url', { token: clientToken });
        const urlData = await urlRes.json();
        if (!urlData.success || !urlData.url) {
          Alert.alert('Setup Required', urlData.message || 'Google Sign-In is not yet configured. Please contact support or use phone verification.');
          return;
        }
        window.location.href = urlData.url;
        return;
      }

      await apiRequest('POST', '/api/auth/google/set-return-url', { token: clientToken, returnUrl: `${baseUrl}/api/auth/google/done` });
      const urlRes = await apiRequest('POST', '/api/auth/google/get-login-url', { token: clientToken });
      const urlData = await urlRes.json();
      if (!urlData.success || !urlData.url) {
        Alert.alert('Setup Required', urlData.message || 'Google Sign-In is not yet configured. Please contact support or use phone verification.');
        return;
      }
      pendingGoogleTokenRef.current = clientToken;
      await WebBrowser.openBrowserAsync(urlData.url);
      const tokenToExchange = pendingGoogleTokenRef.current;
      pendingGoogleTokenRef.current = null;
      if (tokenToExchange) {
        try {
          const exchRes = await apiRequest('POST', '/api/auth/google/exchange', { token: tokenToExchange });
          const exchData = await exchRes.json();
          if (exchData.success && exchData.email) {
            setGoogleEmail(exchData.email);
            setGoogleSignedIn(true);
            if (exchData.name) setUserName(exchData.name);
            setStep(0);
          }
        } catch (e) {
          console.warn('[Google] Exchange failed after browser:', e);
        }
      }
    } catch (e) {
      Alert.alert('Error', 'Could not start Google sign-in. Please try again or use phone verification.');
      console.warn('[Google] Sign-in error:', e);
    }
  };

  const handleGooglePhoneSubmit = async () => {
    const cleanPhone = phone.replace(/\D/g, '');
    // Take last 10 digits to handle country code (+91)
    const phoneToSend = cleanPhone.length > 10 ? cleanPhone.slice(-10) : cleanPhone;
    if (phoneToSend.length !== 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    setChecking(true);
    try {
      const deviceId = await getDeviceId();
      console.log('[GooglePhoneSubmit] Submitting:', { email: googleEmail, phone: phoneToSend, deviceId });
      const res = await apiRequest('POST', '/api/auth/google-phone-login', { email: googleEmail, phone: phoneToSend, deviceId });
      const data = await res.json();
      console.log('[GooglePhoneSubmit] Response:', data);
      if (data.success) {
        const token = data.sessionToken || '';
        setSessionToken(token);
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (data.exists && data.profile) {
          console.log('[GooglePhoneSubmit] Existing user, logging in');
          await loginWithProfile(data.profile, token);
          setTimeout(() => {
            const isCustomer = data.profile.role === 'customer';
            router.replace(isCustomer ? '/(tabs)/customer-home' : '/(tabs)');
          }, 100);
          return;
        }
        console.log('[GooglePhoneSubmit] New user, moving to next step');
        setStep(s => s + 1);
      } else {
        Alert.alert('Error', data.message || 'Login failed');
      }
    } catch (e: any) {
      console.error('[GooglePhoneSubmit] Error:', e);
      Alert.alert('Error', e?.message || 'Could not connect to server.');
    } finally {
      setChecking(false);
    }
  };

  const takeSelfie = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera Required', 'Please allow camera access to take your profile photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      cameraType: ImagePicker.CameraType.front,
    });

    if (!result.canceled && result.assets[0]) {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSelfieUri(result.assets[0].uri);
    }
  };

  const retakeSelfie = () => {
    setSelfieUri('');
    takeSelfie();
  };

  const uploadSelfie = async (localUri: string): Promise<string | null> => {
    try {
      const baseUrl = getApiUrl();
      const uploadUrl = new URL('/api/upload', baseUrl).toString();

      if (Platform.OS === 'web') {
        const response = await globalThis.fetch(localUri);
        const blob = await response.blob();
        const formData = new FormData();
        formData.append('image', blob, 'selfie.jpg');
        const uploadRes = await globalThis.fetch(uploadUrl, { method: 'POST', body: formData });
        const data = await uploadRes.json();
        if (data.url) return new URL(data.url, baseUrl).toString();
        return null;
      } else {
        const formData = new FormData();
        formData.append('image', {
          uri: localUri,
          name: 'selfie.jpg',
          type: 'image/jpeg',
        } as any);
        const uploadRes = await expoFetch(uploadUrl, { method: 'POST', body: formData });
        const data = await uploadRes.json();
        if (data.url) return new URL(data.url, baseUrl).toString();
        return null;
      }
    } catch (e) {
      console.warn('[Onboarding] Selfie upload failed:', e);
      return null;
    }
  };

  const captureLocation = async () => {
    if (locationGot) return;
    setGettingLocation(true);
    try {
      if (Platform.OS === 'web') {
        if (!navigator.geolocation) { setGettingLocation(false); return; }
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              setLatitude(position.coords.latitude.toString());
              setLongitude(position.coords.longitude.toString());
              setLocationGot(true);
              resolve();
            },
            () => resolve(),
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
          );
        });
        setGettingLocation(false);
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setGettingLocation(false); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLatitude(loc.coords.latitude.toString());
      setLongitude(loc.coords.longitude.toString());
      setLocationGot(true);
    } catch (e) {
      console.warn('[Location] Failed to get location:', e);
    } finally {
      setGettingLocation(false);
    }
  };

  useEffect(() => {
    if (currentScreen === 'location' && !locationGot) {
      captureLocation();
    }
  }, [currentScreen]);

  const handleNext = () => {
    if (currentScreen === 'phone') {
      checkPhone();
      return;
    }
    if (currentScreen === 'google-phone') {
      handleGooglePhoneSubmit();
      return;
    }
    if (currentScreen === 'otp') {
      verifyOtp();
      return;
    }
    if (currentScreen === 'email') {
      handleEmailStep();
      return;
    }
    if (currentScreen === 'email-link-entry') {
      sendEmailLink();
      return;
    }
    if (currentScreen === 'email-link-sent') {
      // Nothing to do — the link click handles completion automatically
      // Let user re-send if needed
      return;
    }
    if (currentScreen === 'details' && !userName.trim()) {
      Alert.alert('Required', 'Please enter your name.');
      return;
    }
    if (currentScreen === 'selfie' && !selfieUri) {
      Alert.alert('Photo Required', 'Please take a selfie to continue. Your photo will be shown on your profile.');
      return;
    }
    if (currentScreen === 'skills' && selectedSkills.length === 0) {
      Alert.alert('Required', 'Please select at least one skill.');
      return;
    }
    if (currentScreen === 'sellType' && sellTypes.length === 0) {
      Alert.alert('Required', 'Please select what you sell.');
      return;
    }
    if (currentScreen === 'teachType' && !teachType) {
      Alert.alert('Required', 'Please select what you teach.');
      return;
    }
    if (currentScreen === 'businessDocs') {
      if (isSupplier && !shopAddress.trim()) {
        Alert.alert('Required', 'Please enter your shop address.');
        return;
      }
      if (!aadhaarNumber.trim()) {
        Alert.alert('Required', 'Please enter your Aadhaar number.');
        return;
      }
      if (!panNumber.trim()) {
        Alert.alert('Required', 'Please enter your PAN number.');
        return;
      }
    }
    if (currentScreen === 'location' && (!city.trim() || !userState.trim())) {
      Alert.alert('Required', 'Please enter your city and state.');
      return;
    }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep(s => s + 1);
  };

  const handleComplete = async () => {
    if (!city.trim() || !userState.trim()) {
      Alert.alert('Required', 'Please enter your city and state.');
      return;
    }

    setUploadingSelfie(true);
    let avatarUrl = '';

    if (selfieUri) {
      const uploaded = await uploadSelfie(selfieUri);
      if (uploaded) {
        avatarUrl = uploaded;
      } else {
        Alert.alert('Upload Failed', 'Could not upload your photo. Please check your connection and try again.');
        setUploadingSelfie(false);
        return;
      }
    }

    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const profile: UserProfile = {
      id: Crypto.randomUUID(),
      name: userName.trim(),
      phone: emailLinkSignedIn ? emailLinkPhone : phone.replace(/\D/g, '').trim(),
      email: emailLinkSignedIn ? emailLinkEmail : (googleEmail || newUserEmail.trim() || undefined),
      role,
      skills: selectedSkills,
      city: city.trim(),
      state: userState.trim(),
      experience: experience.trim(),
      shopName: shopName.trim() || undefined,
      bio: '',
      avatar: avatarUrl || undefined,
      sellType: isSupplier ? sellTypes.join(', ') : undefined,
      teachType: isTeacher ? teachType : undefined,
      shopAddress: isSupplier ? shopAddress.trim() : undefined,
      gstNumber: isSupplier ? gstNumber.trim() : undefined,
      aadhaarNumber: needsBusinessDocs ? aadhaarNumber.trim() : undefined,
      panNumber: needsBusinessDocs ? panNumber.trim() : undefined,
      latitude: latitude || undefined,
      longitude: longitude || undefined,
      locationSharing: locationSharing,
      createdAt: Date.now(),
    };
    await completeOnboarding(profile, sessionToken);

    try {
      const isCustomerRole = role === 'customer';
      const welcomeText = isCustomerRole
        ? `Hey technicians! I just joined Mobi. This app is very useful to repair my electronics and mobile.\nBased in ${city.trim()}, ${userState.trim()}.`
        : `Hi, I'm ${userName.trim()}, a ${ROLE_LABELS[role] || role} from ${city.trim()}, ${userState.trim()}. I'm using Mobi app! Feel free to connect with me.`;
      await apiRequest('POST', '/api/posts', {
        userId: profile.id,
        userName: profile.name,
        userRole: profile.role,
        text: welcomeText,
        images: [],
        category: 'repair',
      });
    } catch (e) {
      console.warn('[Onboarding] Auto welcome post failed:', e);
    }

    setUploadingSelfie(false);
    router.replace(isCustomer ? '/(tabs)/customer-home' : '/(tabs)');
  };

  const renderStep = () => {
    switch (currentScreen) {
      case 'phone':
        return (
          <View style={{ flex: 1, backgroundColor: '#0A0A14' }}>
            <LinearGradient
              colors={['#1A1A2E', '#0A0A14']}
              style={StyleSheet.absoluteFill}
            />
            
            {/* 3D Hero Image Section with Gradient Overlay - Portrait optimized */}
            <View style={{ height: '45%', width: '100%', position: 'relative' }}>
              <Image
                source={require('@/assets/images/b69d6758-5343-4e4a-8b8f-6b8b379d6a85_1772630248184.jpeg')}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
              />
              <LinearGradient
                colors={['transparent', 'rgba(10,10,20,0.9)', '#0A0A14']}
                style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 180 }}
              />
            </View>

            <View style={{ paddingHorizontal: 20, flex: 1, justifyContent: 'flex-start', marginTop: -30 }}>
              <Text style={{ 
                fontSize: 30, 
                fontFamily: 'Inter_700Bold', 
                color: '#FFF', 
                textAlign: 'left',
                textShadowColor: 'rgba(0,0,0,0.5)',
                textShadowOffset: { width: 0, height: 2 },
                textShadowRadius: 4,
                marginBottom: 6
              }}>
                Welcome to MOBI
              </Text>
              <Text style={{ 
                fontSize: 15, 
                color: 'rgba(255,255,255,0.7)', 
                textAlign: 'left', 
                marginBottom: 20, 
                fontFamily: 'Inter_400Regular',
                lineHeight: 20
              }}>
                India's technician community
              </Text>

              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                <View style={{
                  backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
                  width: 60, justifyContent: 'center', alignItems: 'center',
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', height: 48,
                }}>
                  <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#FFF' }}>+91</Text>
                </View>
                <TextInput
                  style={{
                    flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
                    paddingHorizontal: 14, fontSize: 16, color: '#FFF',
                    fontFamily: 'Inter_500Medium', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', height: 48,
                  }}
                  placeholder="Mobile number"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={(text) => setPhone(text.replace(/\D/g, '').slice(0, 10))}
                  maxLength={10}
                />
              </View>

              <Pressable
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                  backgroundColor: '#FFF',
                  borderRadius: 12, height: 48,
                  marginBottom: 10,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.2,
                  shadowRadius: 8,
                  elevation: 5,
                  opacity: pressed ? 0.9 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }]
                })}
                onPress={startGoogleSignIn}
              >
                <Ionicons name="logo-google" size={20} color="#4285F4" />
                <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#0A0A14' }}>Sign in with Google</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                  backgroundColor: 'rgba(255,123,71,0.15)',
                  borderRadius: 12, height: 48,
                  marginBottom: 12,
                  borderWidth: 1, borderColor: 'rgba(255,123,71,0.4)',
                  opacity: pressed ? 0.85 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }]
                })}
                onPress={() => { setEmailLinkMode(true); setStep(0); }}
              >
                <Ionicons name="mail" size={20} color="#FF7B47" />
                <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#FF7B47' }}>Sign in with Email Link</Text>
              </Pressable>

              <View style={{ flex: 1 }} />

              <Pressable
                testID="continue-button"
                style={({ pressed }) => ({
                  borderRadius: 14, height: 54,
                  overflow: 'hidden',
                  marginBottom: Math.max(insets.bottom, 12),
                  opacity: pressed ? 0.9 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }]
                })}
                onPress={handleNext}
                disabled={!phone.trim() || checking}
              >
                <LinearGradient
                  colors={['#4285F4', '#FFB28E']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                >
                  {checking ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Text style={{ fontSize: 18, fontFamily: 'Inter_700Bold', color: '#FFF', letterSpacing: 0.5 }}>Get Started</Text>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        );
      case 'google-phone':
        return (
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <View style={styles.stepIconContainer}>
                <Ionicons name="checkmark-circle" size={32} color="#34C759" />
              </View>
              <Text style={styles.stepTitle}>Google Verified</Text>
              <Text style={styles.stepSubtitle}>
                Signed in as {googleEmail}
              </Text>
            </View>
            <Text style={styles.fieldLabel}>WhatsApp Number</Text>
            <View style={styles.phoneRow}>
              <View style={styles.countryCode}>
                <Text style={styles.countryCodeText}>+91</Text>
              </View>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Enter your WhatsApp number"
                placeholderTextColor={C.textTertiary}
                value={phone}
                onChangeText={(text) => setPhone(text.replace(/\D/g, '').slice(0, 10))}
                keyboardType="phone-pad"
                maxLength={10}
                autoFocus
              />
            </View>
            <Text style={{ color: C.textSecondary, fontSize: 13, marginTop: 8 }}>
              No OTP needed — Google verified your identity
            </Text>
          </View>
        );
      case 'otp':
        return (
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <View style={styles.stepIconContainer}>
                <Ionicons name="shield-checkmark" size={32} color={C.primary} />
              </View>
              <Text style={styles.stepTitle}>Verify Your Number</Text>
              <Text style={styles.stepSubtitle}>
                {Platform.OS === 'web' 
                  ? `Sent a 6-digit OTP to +91${phone.replace(/\D/g, '').slice(-10)}`
                  : `Firebase sent a 6-digit OTP via SMS to +91${phone.replace(/\D/g, '').replace(/^91/, '')}`
                }
              </Text>
            </View>
            
            {/* Debug Info Panel */}
            {debugInfo && (
              <View style={{ backgroundColor: 'rgba(255,123,71,0.08)', borderRadius: 8, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,123,71,0.2)' }}>
                <Text style={{ fontSize: 12, color: C.textSecondary, fontFamily: 'Inter_500Medium' }}>
                  {debugInfo}
                </Text>
              </View>
            )}

            {/* Error Panel */}
            {otpError && (
              <View style={{ backgroundColor: 'rgba(255,59,95,0.08)', borderRadius: 8, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,59,95,0.3)' }}>
                <Text style={{ fontSize: 12, color: '#FF3B5F', fontFamily: 'Inter_500Medium' }}>
                  ⚠️ {otpError}
                </Text>
              </View>
            )}
            
            <Text style={styles.fieldLabel}>Enter OTP</Text>
            <TextInput
              style={[styles.input, { textAlign: 'center', fontSize: 22, letterSpacing: 8, fontFamily: 'Inter_700Bold' }]}
              placeholder="------"
              placeholderTextColor={C.textTertiary}
              value={otpCode}
              onChangeText={(text) => {
                const nextCode = text.replace(/\D/g, '').slice(0, 6);
                setOtpCode(nextCode);
                if (nextCode.length === 6) {
                  verifyOtp();
                }
              }}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
            <View style={styles.otpActions}>
              {otpResendTimer > 0 ? (
                <Text style={styles.otpHint}>Resend OTP in {otpResendTimer}s</Text>
              ) : (
                <Pressable
                  onPress={() => sendOtp(phone.replace(/\D/g, ''))}
                  disabled={otpSending}
                >
                  <Text style={[styles.otpHint, { color: C.primary }]}>
                    {otpSending ? 'Sending...' : 'Resend OTP'}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        );
      case 'email':
        return (
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <View style={styles.stepIconContainer}>
                <Ionicons name="mail" size={32} color={C.primary} />
              </View>
              <Text style={styles.stepTitle}>Add Your Gmail</Text>
              <Text style={styles.stepSubtitle}>
                Get important updates & notifications delivered to your inbox. You can skip this step.
              </Text>
            </View>
            <Text style={styles.fieldLabel}>Gmail Address (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="yourname@gmail.com"
              placeholderTextColor={C.textTertiary}
              value={newUserEmail}
              onChangeText={setNewUserEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            <View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.border }}>
              <Ionicons name="checkmark-circle" size={18} color="#34C759" />
              <Text style={{ color: C.textSecondary, fontSize: 13, fontFamily: 'Inter_400Regular', flex: 1 }}>
                A welcome email will be sent to confirm your Mobi account
              </Text>
            </View>
            <Pressable
              onPress={() => setStep(s => s + 1)}
              style={{ marginTop: 20, alignItems: 'center', padding: 12 }}
            >
              <Text style={{ color: C.textTertiary, fontSize: 14, fontFamily: 'Inter_500Medium' }}>Skip for now</Text>
            </Pressable>
          </View>
        );
      case 'email-link-entry':
        return (
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <View style={[styles.stepIconContainer, { backgroundColor: 'rgba(255,123,71,0.15)' }]}>
                <Ionicons name="mail" size={32} color="#FF7B47" />
              </View>
              <Text style={styles.stepTitle}>Sign in with Email</Text>
              <Text style={styles.stepSubtitle}>
                Enter your Gmail address and we'll send a secure one-click sign-in link — no password needed.
              </Text>
            </View>
            <Text style={styles.fieldLabel}>Gmail Address</Text>
            <TextInput
              style={styles.input}
              placeholder="yourname@gmail.com"
              placeholderTextColor={C.textTertiary}
              value={emailLinkEmail}
              onChangeText={setEmailLinkEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,123,71,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,123,71,0.2)' }}>
              <Ionicons name="shield-checkmark" size={18} color="#34C759" />
              <Text style={{ color: C.textSecondary, fontSize: 13, fontFamily: 'Inter_400Regular', flex: 1 }}>
                Firebase sends a secure magic link. Click it and you're logged in — no OTP, no password!
              </Text>
            </View>
            <Pressable
              onPress={() => { setEmailLinkMode(false); setStep(0); }}
              style={{ marginTop: 16, alignItems: 'center', padding: 10 }}
            >
              <Text style={{ color: C.textTertiary, fontSize: 14, fontFamily: 'Inter_500Medium' }}>← Back to other sign-in options</Text>
            </Pressable>
          </View>
        );
      case 'email-link-sent':
        return (
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <View style={[styles.stepIconContainer, { backgroundColor: 'rgba(52,199,89,0.15)' }]}>
                <Ionicons name="checkmark-circle" size={32} color="#34C759" />
              </View>
              <Text style={styles.stepTitle}>Check Your Inbox!</Text>
              <Text style={styles.stepSubtitle}>
                A sign-in link has been sent to{'\n'}
                <Text style={{ color: '#FF7B47', fontFamily: 'Inter_600SemiBold' }}>{emailLinkEmail}</Text>
              </Text>
            </View>
            <View style={{ backgroundColor: C.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: C.border, gap: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#4285F420', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="logo-google" size={22} color="#4285F4" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontFamily: 'Inter_600SemiBold', fontSize: 15 }}>1. Open Gmail</Text>
                  <Text style={{ color: C.textSecondary, fontSize: 13 }}>Find the email from Firebase/Mobi</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FF7B4720', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="link" size={22} color="#FF7B47" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontFamily: 'Inter_600SemiBold', fontSize: 15 }}>2. Tap "Sign in to Mobi"</Text>
                  <Text style={{ color: C.textSecondary, fontSize: 13 }}>The magic link logs you in instantly</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#34C75920', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="checkmark-circle" size={22} color="#34C759" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontFamily: 'Inter_600SemiBold', fontSize: 15 }}>3. You're in!</Text>
                  <Text style={{ color: C.textSecondary, fontSize: 13 }}>Return to this screen — it'll log in automatically</Text>
                </View>
              </View>
            </View>
            <Pressable
              onPress={sendEmailLink}
              disabled={emailLinkSending}
              style={{ marginTop: 20, alignItems: 'center', padding: 12 }}
            >
              <Text style={{ color: emailLinkSending ? C.textTertiary : C.primary, fontSize: 14, fontFamily: 'Inter_500Medium' }}>
                {emailLinkSending ? 'Resending...' : "Didn't receive it? Resend link"}
              </Text>
            </Pressable>
          </View>
        );
      case 'details':
        return (
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <View style={styles.stepIconContainer}>
                <Ionicons name="person" size={32} color={C.primary} />
              </View>
              <Text style={styles.stepTitle}>Your Details</Text>
              <Text style={styles.stepSubtitle}>Tell us about yourself</Text>
            </View>
            <Text style={styles.fieldLabel}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your full name"
              placeholderTextColor={C.textTertiary}
              value={userName}
              onChangeText={setUserName}
              autoCapitalize="words"
              autoFocus
            />
            <Text style={styles.fieldLabel}>Who are you?</Text>
            <View style={styles.rolesGrid}>
              {ROLES.map(r => (
                <Pressable
                  key={r.key}
                  style={[
                    styles.roleCard,
                    role === r.key && { borderColor: r.color, backgroundColor: r.color + '12' },
                  ]}
                  onPress={() => {
                    setRole(r.key);
                    if (Platform.OS !== 'web') Haptics.selectionAsync();
                  }}
                >
                  <View style={[styles.roleIcon, { backgroundColor: r.color + '20' }]}>
                    <Ionicons name={r.icon} size={24} color={r.color} />
                  </View>
                  <Text style={[styles.roleLabel, role === r.key && { color: r.color }]}>
                    {ROLE_LABELS[r.key]}
                  </Text>
                  {role === r.key && (
                    <View style={[styles.checkMark, { backgroundColor: r.color }]}>
                      <Ionicons name="checkmark" size={14} color="#FFF" />
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        );
      case 'selfie':
        return (
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <View style={styles.stepIconContainer}>
                <Ionicons name="camera" size={32} color={C.primary} />
              </View>
              <Text style={styles.stepTitle}>Take a Selfie</Text>
              <Text style={styles.stepSubtitle}>Your photo will be displayed on your profile</Text>
            </View>

            {selfieUri ? (
              <View style={styles.selfiePreviewContainer}>
                <View style={styles.selfieImageWrap}>
                  <Image
                    source={{ uri: selfieUri }}
                    style={styles.selfiePreview}
                    contentFit="cover"
                  />
                  <View style={styles.selfieCheckBadge}>
                    <Ionicons name="checkmark-circle" size={28} color="#34C759" />
                  </View>
                </View>
                <Text style={styles.selfieGoodText}>Looking good!</Text>
                <Pressable style={styles.retakeBtn} onPress={retakeSelfie}>
                  <Ionicons name="camera-reverse-outline" size={20} color={C.primary} />
                  <Text style={styles.retakeBtnText}>Retake Photo</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.selfiePromptContainer}>
                <Pressable style={styles.selfieCaptureBtn} onPress={takeSelfie}>
                  <View style={styles.selfieCaptureInner}>
                    <Ionicons name="camera" size={40} color={C.primary} />
                  </View>
                </Pressable>
                <Text style={styles.selfieTapText}>Tap to open camera</Text>
                <Text style={styles.selfieHint}>Use the front camera for a clear selfie</Text>
              </View>
            )}
          </View>
        );
      case 'skills':
        return (
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>Your Skills</Text>
              <Text style={styles.stepSubtitle}>Select your specializations ({selectedSkills.length} selected)</Text>
            </View>
            <View style={styles.skillsGrid}>
              {SKILLS_LIST.map(skill => (
                <Pressable
                  key={skill}
                  style={[
                    styles.skillChip,
                    selectedSkills.includes(skill) && styles.skillChipActive,
                  ]}
                  onPress={() => toggleSkill(skill)}
                >
                  <Text style={[
                    styles.skillChipText,
                    selectedSkills.includes(skill) && styles.skillChipTextActive,
                  ]}>{skill}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        );
      case 'sellType':
        return (
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <View style={styles.stepIconContainer}>
                <Ionicons name="cube" size={32} color="#FF6B2C" />
              </View>
              <Text style={styles.stepTitle}>What do you sell?</Text>
              <Text style={styles.stepSubtitle}>Select all that apply</Text>
            </View>
            <View style={styles.optionsGrid}>
              {SUPPLIER_SELL_TYPES.map(type => {
                const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
                  'Spare Parts': 'cog',
                  'Accessories': 'headset',
                  'Tools': 'hammer',
                  'Software': 'code-slash',
                };
                const selected = sellTypes.includes(type);
                return (
                  <Pressable
                    key={type}
                    style={[styles.optionCard, selected && styles.optionCardActive]}
                    onPress={() => {
                      setSellTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
                      if (Platform.OS !== 'web') Haptics.selectionAsync();
                    }}
                  >
                    <View style={[styles.optionIcon, selected && styles.optionIconActive]}>
                      <Ionicons name={icons[type] || 'cube'} size={28} color={selected ? '#FF6B2C' : C.textSecondary} />
                    </View>
                    <Text style={[styles.optionLabel, selected && styles.optionLabelActive]}>{type}</Text>
                    {selected && (
                      <View style={[styles.checkMark, { backgroundColor: '#FF6B2C' }]}>
                        <Ionicons name="checkmark" size={14} color="#FFF" />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      case 'teachType':
        return (
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <View style={styles.stepIconContainer}>
                <Ionicons name="school" size={32} color="#FFD60A" />
              </View>
              <Text style={styles.stepTitle}>What do you teach?</Text>
              <Text style={styles.stepSubtitle}>Select your teaching domain</Text>
            </View>
            <View style={styles.optionsGrid}>
              {TEACHER_TEACH_TYPES.map(type => {
                const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
                  'Software': 'code-slash',
                  'Hardware': 'hardware-chip',
                };
                const selected = teachType === type;
                return (
                  <Pressable
                    key={type}
                    style={[styles.optionCard, selected && styles.optionCardActive]}
                    onPress={() => {
                      setTeachType(type);
                      if (Platform.OS !== 'web') Haptics.selectionAsync();
                    }}
                  >
                    <View style={[styles.optionIcon, selected && styles.optionIconActive]}>
                      <Ionicons name={icons[type] || 'school'} size={28} color={selected ? '#FFD60A' : C.textSecondary} />
                    </View>
                    <Text style={[styles.optionLabel, selected && styles.optionLabelActive]}>{type}</Text>
                    {selected && (
                      <View style={[styles.checkMark, { backgroundColor: '#FFD60A' }]}>
                        <Ionicons name="checkmark" size={14} color="#FFF" />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      case 'businessDocs':
        return (
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <View style={styles.stepIconContainer}>
                <Ionicons name="document-text" size={32} color={C.primary} />
              </View>
              <Text style={styles.stepTitle}>Business Details</Text>
              <Text style={styles.stepSubtitle}>Required for verification</Text>
            </View>

            {isSupplier && (
              <>
                <Text style={styles.fieldLabel}>Shop Address</Text>
                <TextInput
                  style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
                  placeholder="Enter your shop/warehouse address"
                  placeholderTextColor={C.textTertiary}
                  value={shopAddress}
                  onChangeText={setShopAddress}
                  multiline
                  numberOfLines={3}
                />
                <Text style={styles.fieldLabel}>GST Number (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 22AAAAA0000A1Z5"
                  placeholderTextColor={C.textTertiary}
                  value={gstNumber}
                  onChangeText={setGstNumber}
                  autoCapitalize="characters"
                />
              </>
            )}

            <Text style={styles.fieldLabel}>Aadhaar Number</Text>
            <TextInput
              style={styles.input}
              placeholder="12-digit Aadhaar number"
              placeholderTextColor={C.textTertiary}
              value={aadhaarNumber}
              onChangeText={setAadhaarNumber}
              keyboardType="number-pad"
              maxLength={12}
            />
            <Text style={styles.docHint}>Your Aadhaar is used for identity verification only</Text>

            <Text style={styles.fieldLabel}>PAN Number</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. ABCDE1234F"
              placeholderTextColor={C.textTertiary}
              value={panNumber}
              onChangeText={setPanNumber}
              autoCapitalize="characters"
              maxLength={10}
            />
          </View>
        );
      case 'location':
        return (
          <View style={styles.stepContent}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>Location & Details</Text>
              <Text style={styles.stepSubtitle}>Help others find you</Text>
            </View>

            <View style={styles.locationStatusRow}>
              <Ionicons name={locationGot ? 'location' : 'location-outline'} size={20} color={locationGot ? '#34C759' : C.textTertiary} />
              <Text style={[styles.locationStatusText, locationGot && { color: '#34C759' }, { flex: 1 }]}>
                {gettingLocation ? 'Getting your location...' : locationGot ? 'Location captured automatically' : 'Enter your city and state below'}
              </Text>
              {gettingLocation && <ActivityIndicator size="small" color={C.primary} />}
              {!locationGot && !gettingLocation && (
                <Pressable onPress={captureLocation} style={styles.locationRetryBtn}>
                  <Ionicons name="locate-outline" size={16} color={C.primary} />
                  <Text style={{ color: C.primary, fontSize: 12, fontFamily: 'Inter_500Medium' }}>Allow</Text>
                </Pressable>
              )}
            </View>

            {isCustomer && (
              <Pressable
                style={styles.privacyToggle}
                onPress={() => {
                  setLocationSharing(locationSharing === 'true' ? 'false' : 'true');
                  if (Platform.OS !== 'web') Haptics.selectionAsync();
                }}
              >
                <Ionicons
                  name={locationSharing === 'true' ? 'eye' : 'eye-off'}
                  size={20}
                  color={locationSharing === 'true' ? '#34C759' : '#FF3B30'}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.privacyToggleText}>
                    {locationSharing === 'true' ? 'My location is visible to others' : 'My location is hidden'}
                  </Text>
                  <Text style={styles.privacyToggleHint}>
                    You can change this later in your profile
                  </Text>
                </View>
                <View style={[styles.toggleSwitch, locationSharing === 'true' && styles.toggleSwitchOn]}>
                  <View style={[styles.toggleKnob, locationSharing === 'true' && styles.toggleKnobOn]} />
                </View>
              </Pressable>
            )}

            <Text style={styles.fieldLabel}>City *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Mumbai"
              placeholderTextColor={C.textTertiary}
              value={city}
              onChangeText={setCity}
            />
            <Text style={styles.fieldLabel}>State *</Text>
            <Pressable
              style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
              onPress={() => setShowStatePicker(true)}
            >
              <Text style={{ color: userState ? C.text : C.textTertiary, fontSize: 15, fontFamily: 'Inter_400Regular' }}>
                {userState || 'Select your state'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={C.textTertiary} />
            </Pressable>
            <Modal visible={showStatePicker} transparent animationType="slide">
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                <View style={{ backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '60%' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>
                    <Text style={{ fontSize: 17, fontFamily: 'Inter_600SemiBold', color: C.text }}>Select State</Text>
                    <Pressable onPress={() => setShowStatePicker(false)}>
                      <Ionicons name="close" size={24} color={C.textSecondary} />
                    </Pressable>
                  </View>
                  <FlatList
                    data={INDIAN_STATES}
                    keyExtractor={item => item}
                    renderItem={({ item }) => (
                      <Pressable
                        style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: C.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: userState === item ? `${C.primary}15` : 'transparent' }}
                        onPress={() => {
                          setUserState(item);
                          setShowStatePicker(false);
                          if (Platform.OS !== 'web') Haptics.selectionAsync();
                        }}
                      >
                        <Text style={{ fontSize: 15, color: userState === item ? C.primary : C.text, fontFamily: userState === item ? 'Inter_600SemiBold' : 'Inter_400Regular' }}>{item}</Text>
                        {userState === item && <Ionicons name="checkmark" size={20} color={C.primary} />}
                      </Pressable>
                    )}
                  />
                </View>
              </View>
            </Modal>
            {role !== 'customer' && (
              <>
                <Text style={styles.fieldLabel}>Experience</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 5 years"
                  placeholderTextColor={C.textTertiary}
                  value={experience}
                  onChangeText={setExperience}
                />
                <Text style={styles.fieldLabel}>Shop Name (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Your business name"
                  placeholderTextColor={C.textTertiary}
                  value={shopName}
                  onChangeText={setShopName}
                />
              </>
            )}
          </View>
        );
      default:
        return null;
    }
  };

  const isLastStep = step === TOTAL_STEPS - 1;

  const getButtonText = () => {
    if (currentScreen === 'phone') return checking ? 'Checking...' : 'Continue';
    if (currentScreen === 'google-phone') return checking ? 'Verifying...' : 'Continue';
    if (currentScreen === 'otp') return otpVerifying ? 'Verifying...' : 'Verify OTP';
    if (currentScreen === 'email-link-entry') return emailLinkSending ? 'Sending...' : 'Send Login Link';
    if (currentScreen === 'email-link-sent') return emailLinkSending ? 'Resending...' : 'Resend Link';
    if (isLastStep) return uploadingSelfie ? 'Setting up...' : 'Complete Setup';
    return 'Continue';
  };

  const getButtonIcon = (): keyof typeof Ionicons.glyphMap => {
    if (currentScreen === 'otp') return 'shield-checkmark';
    if (isLastStep) return 'checkmark';
    return 'arrow-forward';
  };

  const handleButtonPress = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      handleNext();
    }
  };

  const isButtonDisabled = () => {
    if (currentScreen === 'phone') return checking || !phone.trim();
    if (currentScreen === 'google-phone') return checking || !phone.trim();
    if (currentScreen === 'otp') return otpVerifying || otpCode.length < 6;
    if (currentScreen === 'email') return emailSendingWelcome;
    if (currentScreen === 'email-link-entry') return emailLinkSending || !emailLinkEmail.trim();
    if (currentScreen === 'email-link-sent') return emailLinkSending;
    if (currentScreen === 'details') return !userName.trim();
    if (currentScreen === 'selfie') return !selfieUri;
    if (uploadingSelfie) return true;
    return false;
  };

  // Don't render if already onboarded
  if (isOnboarded && profile?.id) {
    return null;
  }

  const isPhoneScreen = currentScreen === 'phone';

  return (
    <View style={[styles.container, isPhoneScreen && { backgroundColor: '#0A0A14' }]}>
      <StatusBar style={isPhoneScreen ? 'light' : 'dark'} />
      {Platform.OS !== 'web' && (
        <FirebaseRecaptchaVerifierModal
          ref={recaptchaVerifierRef}
          firebaseConfig={firebaseConfig}
          attemptInvisibleVerification={true}
        />
      )}
      {Platform.OS === 'web' && (
        <View nativeID="recaptcha-container" style={{ position: 'absolute', bottom: 0 }} />
      )}
      <ScrollView
        contentContainerStyle={
          isPhoneScreen
            ? { flexGrow: 1 }
            : [styles.scrollContent, { paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 20 }]
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        pointerEvents="auto"
      >
        {!isPhoneScreen && (
          <View style={styles.progressBar}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.progressDot,
                  i <= step && { backgroundColor: C.primary, flex: i === step ? 2 : 1 },
                ]}
              />
            ))}
          </View>
        )}

        {renderStep()}
      </ScrollView>

      {!isPhoneScreen && (
        <View style={[styles.bottomActions, { paddingBottom: Platform.OS === 'web' ? 34 : Math.max(insets.bottom, 16), zIndex: 9999, elevation: 9999 }]} pointerEvents="box-none">
          {(step > 0 || emailLinkMode) && (
            <Pressable style={styles.backBtn} onPress={() => {
              if (currentScreen === 'otp') {
                setOtpCode('');
                setOtpSent(false);
                setOtpResendTimer(0);
                setUseFirebaseOTP(false);
                setFirebaseVerificationId('');
                webConfirmationRef.current = null;
                webRecaptchaRef.current = null;
              }
              if (emailLinkMode) {
                setEmailLinkMode(false);
                setEmailLinkSent(false);
                setEmailLinkEmail('');
                setStep(0);
                return;
              }
              setStep(s => s - 1);
            }}>
              <Ionicons name="arrow-back" size={22} color={C.textSecondary} />
            </Pressable>
          )}
          <Pressable
            style={({ pressed }) => [
              styles.nextBtn,
              { zIndex: 10000, elevation: 10000 },
              pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              isButtonDisabled() && { opacity: 0.5 },
            ]}
            onPress={handleButtonPress}
            disabled={isButtonDisabled()}
            testID="continue-button"
          >
            {(checking || uploadingSelfie || otpVerifying) ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Text style={styles.nextBtnText}>{getButtonText()}</Text>
                <Ionicons name={getButtonIcon()} size={20} color="#FFF" />
              </>
            )}
          </Pressable>
        </View>
      )}

      {/* Email Link Signing-In Overlay */}
      {emailSigningIn && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(10,10,20,0.92)',
          alignItems: 'center', justifyContent: 'center', zIndex: 99999,
        }}>
          <View style={{ alignItems: 'center', gap: 20, padding: 32, backgroundColor: '#1A1A2E', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,123,71,0.3)', maxWidth: 300 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,123,71,0.15)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="mail" size={32} color="#FF7B47" />
            </View>
            <ActivityIndicator size="large" color="#FF7B47" />
            <Text style={{ color: '#FFF', fontSize: 18, fontFamily: 'Inter_700Bold', textAlign: 'center' }}>Signing you in…</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 }}>
              Verifying your email link with Firebase. This will only take a moment.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'web' ? 140 : 120,
  },
  progressBar: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 32,
  },
  progressDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.surfaceHighlight,
  },
  stepContent: {
    flex: 1,
    padding: 32,
    justifyContent: 'flex-start',
    backgroundColor: C.background,
    paddingTop: 40,
  },
  stepHeader: {
    marginBottom: 40,
    alignItems: 'center',
  },
  stepTitle: {
    fontSize: 34,
    fontFamily: 'Inter_700Bold',
    color: C.text,
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -1,
  },
  stepSubtitle: {
    fontSize: 18,
    color: C.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
    paddingHorizontal: 10,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: C.primary,
    marginBottom: 12,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  countryCode: {
    backgroundColor: C.surface,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  countryCodeText: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: C.text,
  },
  input: {
    backgroundColor: C.surface,
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderRadius: 20,
    fontSize: 18,
    color: C.text,
    borderWidth: 1,
    borderColor: C.border,
    fontFamily: 'Inter_500Medium',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  stepHeader: {
    marginBottom: 28,
    alignItems: 'center',
  },
  stepIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: C.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  stepTitle: {
    color: C.text,
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  stepSubtitle: {
    color: C.textTertiary,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 24,
  },
  fieldLabel: {
    color: C.textSecondary,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    color: C.text,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
    borderColor: C.border,
  },
  otpHint: {
    color: C.textTertiary,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 10,
    textAlign: 'center',
  },
  otpActions: {
    marginTop: 20,
    alignItems: 'center',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countryCode: {
    backgroundColor: C.surfaceElevated,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  countryCodeText: {
    color: C.text,
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.border,
  },
  dividerText: {
    color: C.textTertiary,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  docHint: {
    color: C.textTertiary,
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    marginTop: 4,
    marginBottom: 4,
  },
  rolesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  roleCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 2,
    borderColor: C.border,
    alignItems: 'center',
    gap: 8,
    position: 'relative',
  },
  roleIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleLabel: {
    color: C.textSecondary,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  checkMark: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  skillChipActive: {
    backgroundColor: C.primaryMuted,
    borderColor: C.primary,
  },
  skillChipText: {
    color: C.textSecondary,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  skillChipTextActive: {
    color: C.primary,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  optionCard: {
    width: '47%' as any,
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: C.border,
    alignItems: 'center',
    gap: 10,
    position: 'relative',
  },
  optionCardActive: {
    borderColor: C.primary,
    backgroundColor: C.primaryMuted,
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: C.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconActive: {
    backgroundColor: C.primaryMuted,
  },
  optionLabel: {
    color: C.textSecondary,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  optionLabelActive: {
    color: C.text,
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: C.background,
    borderTopWidth: 1,
    borderTopColor: C.borderLight,
    gap: 12,
  },
  backBtn: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  nextBtn: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    backgroundColor: C.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  nextBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  selfiePreviewContainer: {
    alignItems: 'center',
    gap: 16,
  },
  selfieImageWrap: {
    position: 'relative',
  },
  selfiePreview: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 3,
    borderColor: C.primary,
  },
  selfieCheckBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: C.background,
    borderRadius: 16,
  },
  selfieGoodText: {
    color: '#34C759',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  retakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: C.primaryMuted,
  },
  retakeBtnText: {
    color: C.primary,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  selfiePromptContainer: {
    alignItems: 'center',
    gap: 12,
  },
  selfieCaptureBtn: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    borderColor: C.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selfieCaptureInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: C.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selfieTapText: {
    color: C.text,
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  selfieHint: {
    color: C.textTertiary,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    height: 60,
    borderRadius: 18,
    backgroundColor: '#F8F9FA',
    borderColor: '#E9ECEF',
    borderWidth: 1,
    marginTop: 8,
  },
  googleBtnText: {
    color: '#1A1A1A',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  locationStatusRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  locationStatusText: {
    flex: 1,
    color: C.textSecondary,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  locationRetryBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  privacyToggle: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  privacyToggleText: {
    color: C.text,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  privacyToggleHint: {
    color: C.textTertiary,
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  toggleSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#555',
    justifyContent: 'center' as const,
    padding: 2,
  },
  toggleSwitchOn: {
    backgroundColor: '#34C759',
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFF',
  },
  toggleKnobOn: {
    alignSelf: 'flex-end' as const,
  },
});
