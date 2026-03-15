import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, ScrollView,
  Platform, Alert, ActivityIndicator, Modal, FlatList,
} from 'react-native';
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

const SUPER_ADMIN_PHONE = '8179142535';

function getRoleRoute(profile: { role?: string; phone?: string; email?: string }): string {
  if (!profile) return '/(tabs)';
  
  // Super admin (phone-based only) ALWAYS gets admin panel
  const phone = profile.phone || '';
  const isEmailBased = phone.startsWith('email:');
  const cleanPhone = phone.replace(/\D/g, '').slice(-10);
  
  if (!isEmailBased && cleanPhone === SUPER_ADMIN_PHONE) return '/admin';
  // Regular admin role goes to admin panel
  if (profile.role === 'admin') return '/admin';
  // Customer goes to customer home
  if (profile.role === 'customer') return '/(tabs)/customer-home';
  // Everyone else goes to main app
  return '/(tabs)';
}

const ROLES: { key: UserRole; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { key: 'customer', icon: 'person', color: '#FF375F' },
  { key: 'technician', icon: 'construct', color: '#32D74B' },
  { key: 'teacher', icon: 'school', color: '#FFD60A' },
  { key: 'supplier', icon: 'cube', color: '#FF9F0A' },
];

type ScreenName = 'welcome' | 'google-phone' | 'details' | 'selfie' | 'skills' | 'sellType' | 'teachType' | 'businessDocs' | 'location';

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ email?: string; name?: string; google?: string; error?: string }>();
  const { completeOnboarding, loginWithProfile, isOnboarded, profile } = useApp();
  
  // If user is already onboarded (logged in), redirect immediately
  useEffect(() => {
    if (isOnboarded && profile?.id) {
      router.replace(getRoleRoute(profile) as any);
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
  const [otpRateLimitTimer, setOtpRateLimitTimer] = useState(0);

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
    const screens: ScreenName[] = googleSignedIn
      ? ['google-phone', 'details']
      : ['welcome'];
    if (!googleSignedIn && step > 0) {
      // After welcome (guest or google), continue with normal flow
      screens.push('details');
    }
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

  // Rate limit cooldown timer
  useEffect(() => {
    if (otpRateLimitTimer <= 0) return;
    const interval = setInterval(() => {
      setOtpRateLimitTimer(t => {
        if (t <= 1) { clearInterval(interval); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [otpRateLimitTimer]);

  const sendOtp = async (phoneNumber: string) => {
    setOtpSending(true);
    setOtpError('');
    const cleanDigits = phoneNumber.replace(/\D/g, '').replace(/^91/, '');
    setDebugInfo(`Sending OTP to +91${cleanDigits}...`);
    try {
      await sendBackendOTP(cleanDigits);
    } catch (err: any) {
      const msg = err?.message || 'Could not send OTP. Please try again.';
      setOtpError(msg);
      setDebugInfo(`❌ Failed`);
      Alert.alert('OTP Error', msg);
    } finally {
      setOtpSending(false);
    }
  };

  const sendBackendOTP = async (cleanDigits: string) => {
    try {
      console.log('[OTP] Sending via backend for phone:', cleanDigits);
      const res = await apiRequest('POST', '/api/otp/send', { phone: cleanDigits });
      const data = await res.json();
      if (data.success) {
        setOtpSent(true);
        setOtpResendTimer(30);
        const hint = data.smsSent
          ? `✅ OTP sent via SMS to +91${cleanDigits}`
          : `⚠️ SMS delivery issue. ${data.otp ? `Code: ${data.otp}` : 'Check your number.'}`;
        setDebugInfo(hint);
        console.log('[OTP] Result → smsSent:', data.smsSent, '|', data.message, data.otp ? `| code: ${data.otp}` : '');
        if (!data.smsSent) {
          Alert.alert(
            'SMS Issue',
            data.otp
              ? `SMS delivery failed, but your code is: ${data.otp}\n(Development mode only)`
              : `Could not deliver SMS to +91${cleanDigits}. Check your phone number and try again.`
          );
        }
      } else {
        // Handle rate limit
        if (data.message?.includes('Too many OTP')) {
          const match = data.message.match(/(\d+) seconds/);
          const secs = match ? parseInt(match[1]) : 60;
          setOtpRateLimitTimer(secs);
        }
        throw new Error(data.message || 'Failed to send OTP');
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
        router.replace(getRoleRoute(p) as any);
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
      Alert.alert('Invalid OTP', 'Please enter all 6 digits.');
      return;
    }
    setOtpVerifying(true);
    setOtpError('');
    try {
      const deviceId = await getDeviceId();
      console.log('[OTP] Verifying code for phone:', cleanPhone);
      const res  = await apiRequest('POST', '/api/otp/verify', { phone: cleanPhone, otp: otpCode, deviceId });
      const data = await res.json();
      if (!data.success) {
        const msg = data.message || 'Invalid OTP. Please try again.';
        setOtpError(msg);
        Alert.alert('Verification Failed', msg);
        return;
      }
      await handleOtpVerified(data, cleanPhone, deviceId);
    } catch (e: any) {
      const msg = e?.message || 'Could not verify OTP. Please try again.';
      setOtpError(msg);
      Alert.alert('Error', msg);
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
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // Check if existing user
      try {
        const res = await apiRequest('POST', '/api/auth/check-phone', { phone: cleanPhone });
        const data = await res.json();
        if (data.success && data.exists && data.profile) {
          // Existing user - log in directly (no OTP needed)
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
          setSessionToken(data.sessionToken || '');
          await loginWithProfile(serverProfile, data.sessionToken);
          router.replace(getRoleRoute(serverProfile) as any);
          return;
        }
        // New user - go to details form
        setExistingProfile(null);
        setStep(s => s + 1);
      } catch (checkErr) {
        console.warn('[checkPhone] check-phone failed:', checkErr);
        Alert.alert('Error', 'Could not verify phone. Please try again.');
      }
    } finally {
      setChecking(false);
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
            router.replace(getRoleRoute(data.profile) as any);
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
    if (currentScreen === 'welcome') {
      // Continue as Guest - skip to details
      setStep(s => s + 1);
      return;
    }
    if (currentScreen === 'google-phone') {
      handleGooglePhoneSubmit();
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
      phone: phone.replace(/\D/g, '').trim(),
      email: googleEmail || newUserEmail.trim() || undefined,
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
    router.replace(getRoleRoute({ role, phone }) as any);
  };

  const renderStep = () => {
    switch (currentScreen) {
      case 'welcome':
        return (
          <View style={{ flex: 1, backgroundColor: '#FFF' }}>
            {/* Hero Image */}
            <View style={{ height: '55%', width: '100%', position: 'relative', overflow: 'hidden' }}>
              <Image
                source={{ uri: 'https://storage.googleapis.com/uxpilot-auth.appspot.com/dd3bf1e2c1-260bee728f899a29be1e.png' }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
              />
              <LinearGradient
                colors={['transparent', 'rgba(255,255,255,0.8)', '#FFFFFF']}
                style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 120 }}
              />
            </View>

            {/* Content Section */}
            <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 32, justifyContent: 'space-between' }}>
              {/* Typography */}
              <View style={{ marginBottom: 'auto' }}>
                <Text style={{ fontSize: 28, fontWeight: '700', color: '#111827', textAlign: 'center', lineHeight: 36, marginBottom: 16 }}>
                  Welcome to {'\n'}Mobi Mobile {'\n'}Repair Technician {'\n'}Community
                </Text>
                <Text style={{ fontSize: 15, color: '#6b7280', textAlign: 'center', lineHeight: 22 }}>
                  Network, Learn & Grow with technicians across India.
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={{ gap: 12, marginBottom: Math.max(insets.bottom, 12) }}>
                {/* Google Sign-In Button */}
                <Pressable
                  onPress={startGoogleSignIn}
                  style={({ pressed }) => ({
                    width: '100%',
                    height: 48,
                    backgroundColor: '#FFF',
                    borderWidth: 1,
                    borderColor: '#d1d5db',
                    borderRadius: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                    opacity: pressed ? 0.9 : 1,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 4,
                    elevation: 2,
                  })}
                >
                  <Ionicons name="logo-google" size={20} color="#1f2937" />
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#1f2937' }}>Continue with Google</Text>
                </Pressable>

                {/* Continue as Guest Button */}
                <Pressable
                  onPress={handleNext}
                  style={({ pressed }) => ({
                    width: '100%',
                    height: 48,
                    backgroundColor: 'transparent',
                    borderRadius: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#3b82f6' }}>Continue as Guest</Text>
                </Pressable>
              </View>
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
          {step > 0 && (
            <Pressable style={styles.backBtn} onPress={() => {
              if (currentScreen === 'otp') {
                setOtpCode('');
                setOtpSent(false);
                setOtpResendTimer(0);
                setOtpError('');
                setDebugInfo('');
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

      {/* Email link overlay removed - now using email OTP */}
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
