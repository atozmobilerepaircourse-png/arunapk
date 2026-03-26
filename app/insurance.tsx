import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert,
  TextInput, TouchableOpacity, Platform, Image, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useApp } from '@/lib/context';
import { apiRequest, getApiUrl } from '@/lib/query-client';

const { width: SW } = Dimensions.get('window');

const PRIMARY  = '#FF6B2C';
const PRIMARY_L = '#FFF3ED';
const BG       = '#F5F5F5';
const CARD     = '#FFFFFF';
const DARK     = '#1A1A1A';
const MUTED    = '#8A8A8A';
const GREEN    = '#27AE60';
const GREEN_L  = '#E8F5ED';
const AMBER    = '#F59E0B';
const AMBER_L  = '#FFFBEB';
const BLUE     = '#4A90D9';
const BLUE_L   = '#EBF4FF';
const RED      = '#E53E3E';

const SHADOW = {
  shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08, shadowRadius: 10, elevation: 3,
};

const PHONE_BRANDS = [
  'Samsung', 'Apple', 'Xiaomi', 'Realme', 'Vivo', 'OPPO', 'OnePlus', 'Motorola',
  'Nokia', 'Infinix', 'IQOO', 'Poco', 'Redmi', 'Tecno', 'Nothing', 'Other',
];

const ISSUE_TYPES = [
  'Screen Crack / Damage', 'Display Not Working', 'Touch Not Responding',
  'Water Damage', 'Back Panel Damage', 'Other Hardware Issue',
];

type Step = 'plan' | 'device' | 'imei' | 'images' | 'consent' | 'dashboard';
type PlanType = 'monthly' | 'yearly';
type PlanStatus = 'pending_verification' | 'approved_pending_payment' | 'active' | 'rejected' | 'expired';
type ClaimStatus = 'claim_pending' | 'under_review' | 'approved' | 'assigned' | 'completed' | 'rejected';

interface Device {
  id: string;
  brand: string;
  model: string;
  modelNumber: string;
  imei: string;
  frontImage: string;
  backImage: string;
}

interface Plan {
  id: string;
  userId: string;
  brand: string;
  model: string;
  modelNumber: string;
  imei: string;
  devices?: Device[];
  planType: PlanType;
  price: number;
  status: PlanStatus;
  frontImage?: string;
  backImage?: string;
  claimUsed: number;
  planStartDate?: number;
  rejectionReason?: string;
  createdAt: number;
}

interface Claim {
  id: string;
  status: ClaimStatus;
  issue: string;
  description: string;
  damageImage?: string;
  technicianName?: string;
  rejectionReason?: string;
  createdAt: number;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    pending_verification: { label: 'Under Verification', color: AMBER, bg: AMBER_L },
    approved_pending_payment: { label: 'Approved — Pay Now', color: BLUE, bg: BLUE_L },
    active: { label: 'Active', color: GREEN, bg: GREEN_L },
    rejected: { label: 'Rejected', color: RED, bg: '#FFEEEE' },
    expired: { label: 'Expired', color: MUTED, bg: '#F0F0F0' },
    claim_pending: { label: 'Claim Pending', color: AMBER, bg: AMBER_L },
    under_review: { label: 'Under Review', color: BLUE, bg: BLUE_L },
    approved: { label: 'Approved', color: GREEN, bg: GREEN_L },
    assigned: { label: 'Technician Assigned', color: PRIMARY, bg: PRIMARY_L },
    completed: { label: 'Completed', color: GREEN, bg: GREEN_L },
  };
  const s = map[status] || { label: status, color: MUTED, bg: '#F0F0F0' };
  return (
    <View style={{ backgroundColor: s.bg, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, alignSelf: 'flex-start' }}>
      <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: s.color }}>{s.label}</Text>
    </View>
  );
}

export default function ProtectionPlanScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useApp();

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom + 20;

  const [step, setStep] = useState<Step>('plan');
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'uploading' | 'verifying' | 'success' | 'error'>('idle');
  const [submissionMessage, setSubmissionMessage] = useState('');

  const [existingPlan, setExistingPlan] = useState<Plan | null>(null);
  const [existingClaim, setExistingClaim] = useState<Claim | null>(null);

  // Form state
  const [planType, setPlanType] = useState<PlanType>('yearly');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [modelNumber, setModelNumber] = useState('');
  const [imei, setImei] = useState('');
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [frontImageBase64, setFrontImageBase64] = useState<string | null>(null);
  const [backImageBase64, setBackImageBase64] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);

  // Multiple devices support
  const [devices, setDevices] = useState<Array<{id: string; brand: string; model: string; modelNumber: string; imei: string; frontImage: string | null; backImage: string | null; frontImageBase64: string | null; backImageBase64: string | null}>>([]);

  // Claim state
  const [showClaim, setShowClaim] = useState(false);
  const [claimIssue, setClaimIssue] = useState('');
  const [claimDesc, setClaimDesc] = useState('');
  const [claimImage, setClaimImage] = useState<string | null>(null);
  const [claimImageBase64, setClaimImageBase64] = useState<string | null>(null);
  const [claimSubmitting, setClaimSubmitting] = useState(false);

  const fetchPlan = useCallback(async () => {
    if (!profile?.id) { setLoadingPlan(false); return; }
    try {
      const res = await apiRequest('GET', `/api/protection/my-plan/${profile.id}`);
      const data = await res.json();
      if (data.plan) {
        setExistingPlan(data.plan);
        setExistingClaim(data.claim || null);
        setStep('dashboard');
      }
    } catch (e) {
      console.warn('[Protection] fetch plan error:', e);
    } finally {
      setLoadingPlan(false);
    }
  }, [profile?.id]);

  useEffect(() => { 
    const timer = setTimeout(() => fetchPlan(), 500);
    return () => clearTimeout(timer);
  }, [profile?.id]);

  // ── Camera capture (direct camera on mobile and web) ────────────────────────
  const captureImage = useCallback(async (which: 'front' | 'back' | 'claim') => {
    try {
      const isWeb = typeof window !== 'undefined';

      if (isWeb) {
        // On web: Use HTML5 file input with capture="environment" to force rear camera
        const hiddenInput = document.createElement('input');
        hiddenInput.type = 'file';
        hiddenInput.accept = 'image/*';
        hiddenInput.capture = 'environment'; // Force rear camera on web
        
        hiddenInput.onchange = async (e: any) => {
          const file = e.target.files?.[0];
          if (file) {
            try {
              // Use Promise-based FileReader for proper async handling
              const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (event: any) => {
                  try {
                    const result = event.target.result || '';
                    const b64 = typeof result === 'string' ? result.split(',')[1] || '' : '';
                    if (!b64) reject(new Error('Failed to encode image'));
                    resolve(b64);
                  } catch (err) {
                    reject(err);
                  }
                };
                reader.onerror = () => reject(new Error('Failed to read file'));
                reader.readAsDataURL(file);
              });

              // Use data URI for preview so it survives re-renders (blob URLs can be revoked)
              const mimeType = file.type || 'image/jpeg';
              const dataUri = `data:${mimeType};base64,${base64}`;
              if (which === 'front') { 
                setFrontImage(dataUri); 
                setFrontImageBase64(base64); 
              }
              else if (which === 'back') { 
                setBackImage(dataUri); 
                setBackImageBase64(base64); 
              }
              else { 
                setClaimImage(dataUri); 
                setClaimImageBase64(base64); 
              }
            } catch (err: any) {
              Alert.alert('Error', 'Failed to process image: ' + (err.message || 'Unknown error'));
            }
          }
        };
        hiddenInput.click();
      } else {
        // On mobile: Use expo-image-picker camera with permission handling
        const ImagePicker = await import('expo-image-picker');
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        
        if (!perm.granted) {
          // Fallback: Ask user to allow or use gallery
          Alert.alert('Camera Permission Required', 'Please allow camera access. Would you like to use gallery instead?', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Use Gallery',
              onPress: async () => {
                try {
                  const result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: 'images',
                    quality: 0.7,
                    base64: true,
                    exif: false,
                  });
                  if (!result.canceled && result.assets[0]) {
                    const asset = result.assets[0];
                    const uri = asset.uri;
                    const b64 = asset.base64 || '';
                    if (which === 'front') { setFrontImage(uri); setFrontImageBase64(b64); }
                    else if (which === 'back') { setBackImage(uri); setBackImageBase64(b64); }
                    else { setClaimImage(uri); setClaimImageBase64(b64); }
                  }
                } catch (err) {
                  Alert.alert('Error', 'Failed to pick image from gallery.');
                }
              },
            },
          ]);
          return;
        }

        // Camera permission granted - launch camera directly
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: 'images',
          quality: 0.7,
          base64: true,
          exif: false,
          allowsEditing: false,
        });

        if (!result.canceled && result.assets[0]) {
          const asset = result.assets[0];
          const uri = asset.uri;
          const b64 = asset.base64 || '';
          if (which === 'front') { setFrontImage(uri); setFrontImageBase64(b64); }
          else if (which === 'back') { setBackImage(uri); setBackImageBase64(b64); }
          else { setClaimImage(uri); setClaimImageBase64(b64); }
        }
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to capture image. Please try again.');
    }
  }, []);

  // ── Upload image to backend ─────────────────────────────────────────────────
  const uploadImage = useCallback(async (base64: string, name: string): Promise<string> => {
    try {
      console.log('[Protection] Uploading image:', name, 'size:', base64.length);
      
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Image upload timeout')), 15000)
      );
      
      const uploadPromise = apiRequest('POST', '/api/protection/upload-image', {
        base64,
        filename: name,
      });
      
      const res = await Promise.race([uploadPromise, timeoutPromise]);
      
      if (!res || !res.ok) {
        throw new Error(`Upload failed: ${res?.status || 'no response'}`);
      }
      
      const data = await res.json();
      console.log('[Protection] Image uploaded successfully:', data.url);
      return data.url || '';
    } catch (e: any) {
      console.error('[Protection] Image upload error:', e.message);
      throw new Error(`Failed to upload ${name}: ${e.message}`);
    }
  }, []);

  // ── Submit application ────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!agreed) { Alert.alert('Consent Required', 'Please agree to the terms to continue.'); return; }
    if (!profile?.id) { Alert.alert('Login Required', 'Please log in to continue.'); router.push('/onboarding'); return; }
    
    // Validate all required fields for main device
    if (!imei || imei.length !== 15) { Alert.alert('Invalid IMEI', 'Please enter a valid 15-digit IMEI number.'); return; }
    if (!brand) { Alert.alert('Missing Information', 'Please select your phone brand.'); return; }
    if (!model) { Alert.alert('Missing Information', 'Please enter your phone model.'); return; }
    if (!modelNumber) { Alert.alert('Missing Information', 'Please enter your model number.'); return; }

    // Validate additional devices
    for (const device of devices) {
      if (!device.brand) { Alert.alert('Missing Information', 'Please enter brand for all additional devices.'); return; }
      if (!device.model) { Alert.alert('Missing Information', 'Please enter model for all additional devices.'); return; }
      if (!device.modelNumber) { Alert.alert('Missing Information', 'Please enter model number for all additional devices.'); return; }
      if (!device.imei || device.imei.length !== 15) { Alert.alert('Invalid IMEI', 'All devices must have a valid 15-digit IMEI number.'); return; }
    }

    setSubmitting(true);
    setSubmissionStatus('uploading');
    setSubmissionMessage('Uploading device images...');
    try {
      console.log('[Protection] Starting application submission...', { profile: profile.id, brand, model, imei });
      
      let frontUrl = '';
      let backUrl = '';
      
      // Upload images if available (optional — failures show warning but don't block submission)
      const imageUploadWarnings: string[] = [];

      if (frontImageBase64) {
        try {
          console.log('[Protection] Uploading front image...');
          frontUrl = await uploadImage(frontImageBase64, `front_${Date.now()}.jpg`);
          console.log('[Protection] Front image uploaded:', frontUrl);
        } catch (imgErr: any) {
          console.warn('[Protection] Front image upload failed, continuing:', imgErr.message);
          imageUploadWarnings.push('Front device photo');
        }
      }
      
      if (backImageBase64) {
        try {
          console.log('[Protection] Uploading back image...');
          backUrl = await uploadImage(backImageBase64, `back_${Date.now()}.jpg`);
          console.log('[Protection] Back image uploaded:', backUrl);
        } catch (imgErr: any) {
          console.warn('[Protection] Back image upload failed, continuing:', imgErr.message);
          imageUploadWarnings.push('Back device photo');
        }
      }

      if (imageUploadWarnings.length > 0) {
        Alert.alert(
          'Image Upload Warning',
          `The following photos could not be uploaded and will not be included with your application: ${imageUploadWarnings.join(', ')}. Your application will still be submitted.`,
          [{ text: 'Continue' }]
        );
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      setSubmissionStatus('verifying');
      setSubmissionMessage('Verifying application details...');
      console.log('[Protection] Submitting protection plan application...');
      
      // Build devices array - start with the main device, then add any additional devices
      const devicesArray = [{
        brand,
        model: model.trim(),
        modelNumber: modelNumber.trim(),
        imei: imei.trim(),
        frontImage: frontUrl || '',
        backImage: backUrl || '',
      }];
      
      // Add any additional devices
      for (const device of devices) {
        let additionalFrontUrl = '';
        let additionalBackUrl = '';
        
        // Always upload from base64 if available
        if (device.frontImageBase64) {
          try {
            additionalFrontUrl = await uploadImage(device.frontImageBase64, `front_${Date.now()}_${device.id}.jpg`);
            console.log('[Protection] Additional device front image uploaded:', additionalFrontUrl);
          } catch (e) {
            console.warn('[Protection] Additional device front image upload failed:', e);
          }
        }
        
        if (device.backImageBase64) {
          try {
            additionalBackUrl = await uploadImage(device.backImageBase64, `back_${Date.now()}_${device.id}.jpg`);
            console.log('[Protection] Additional device back image uploaded:', additionalBackUrl);
          } catch (e) {
            console.warn('[Protection] Additional device back image upload failed:', e);
          }
        }
        
        devicesArray.push({
          brand: device.brand,
          model: device.model.trim(),
          modelNumber: device.modelNumber.trim(),
          imei: device.imei.trim(),
          frontImage: additionalFrontUrl,
          backImage: additionalBackUrl,
        });
      }
      
      // Filter out any devices with the same IMEI as the main device
      const filteredDevices = devicesArray.filter(d => d.imei.trim() !== imei.trim());
      
      const payload = {
        userId: profile.id,
        userName: profile.name,
        userPhone: profile.phone,
        imei: imei.trim(),
        brand,
        model: model.trim(),
        modelNumber: modelNumber.trim(),
        planType,
        frontImage: frontUrl || '',
        backImage: backUrl || '',
        devices: filteredDevices,
      };
      console.log('[Protection] Payload:', payload);
      
      // Create timeout promise for the apply request (60 seconds to allow image uploads)
      const applyTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Application submission timeout - server not responding')), 60000)
      );
      
      const applyPromise = apiRequest('POST', '/api/protection/apply', payload);
      
      const res = await Promise.race([applyPromise, applyTimeoutPromise]);
      
      console.log('[Protection] Response status:', res?.status);
      const data = await res.json();
      console.log('[Protection] Application response:', data);
      
      if (!res.ok) {
        throw new Error(data.error || `Server error: ${res.status}`);
      }
      
      if (!data.success) throw new Error(data.error || 'Submission failed');

      setSubmissionStatus('success');
      setSubmissionMessage(data.isUpdate ? 'Plan Updated Successfully!' : 'Application Submitted Successfully!');
      
      console.log('[Protection] Submission successful:', data);
      
      // Wait 3 seconds before refreshing to show success screen
      await new Promise(resolve => setTimeout(resolve, 3000));
      setSubmitting(false);
      setSubmissionStatus('idle');
      fetchPlan();
    } catch (e: any) {
      console.error('[Protection] Submission error:', e);
      console.error('[Protection] Error details:', {
        name: e.name,
        message: e.message,
        stack: e.stack
      });
      const errorMessage = e.message || 'Failed to submit application. Please try again.';
      setSubmissionStatus('error');
      setSubmissionMessage(errorMessage);
      setSubmitting(false);
      // Keep showing error until user dismisses it
    } finally {
      // Don't reset submitting here - let individual branches handle it
    }
  }, [agreed, profile, imei, brand, model, modelNumber, planType, frontImageBase64, backImageBase64, uploadImage, fetchPlan]);

  // ── Make payment ──────────────────────────────────────────────────────────────
  const handlePayment = useCallback(async () => {
    if (!existingPlan) return;
    try {
      const res = await apiRequest('POST', '/api/protection/payment/create-order', {
        planId: existingPlan.id,
        userId: profile?.id,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not create payment order');

      const url = new URL('/api/subscription/checkout', getApiUrl());
      url.searchParams.set('orderId', data.orderId);
      url.searchParams.set('amount', String(data.amount));
      url.searchParams.set('keyId', data.keyId);
      url.searchParams.set('role', 'protection_plan');
      url.searchParams.set('displayAmount', String(data.displayAmount));
      url.searchParams.set('userId', profile?.id || '');
      url.searchParams.set('userName', profile?.name || '');
      url.searchParams.set('userPhone', profile?.phone || '');
      url.searchParams.set('planId', existingPlan.id);
      url.searchParams.set('type', 'protection_plan');

      if (Platform.OS === 'web') {
        window.open(url.toString(), '_blank');
        setTimeout(() => fetchPlan(), 8000);
      } else {
        router.push({ pathname: '/webview', params: { url: url.toString(), type: 'protection_payment' } } as any);
      }
    } catch (e: any) {
      Alert.alert('Payment Error', e.message || 'Failed to initiate payment');
    }
  }, [existingPlan, profile, fetchPlan]);

  // ── Raise Claim ───────────────────────────────────────────────────────────────
  const handleRaiseClaim = useCallback(async () => {
    if (!claimIssue) { Alert.alert('Required', 'Please select an issue type'); return; }
    if (!existingPlan) return;
    setClaimSubmitting(true);
    try {
      let imgUrl = '';
      if (claimImageBase64) imgUrl = await uploadImage(claimImageBase64, `claim_${Date.now()}.jpg`);

      const res = await apiRequest('POST', '/api/protection/claim/raise', {
        planId: existingPlan.id,
        userId: profile?.id,
        issue: claimIssue,
        description: claimDesc,
        damageImage: imgUrl,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to raise claim');

      Alert.alert('Claim Submitted!', 'Your claim has been submitted. Our team will review and contact you within 24 hours.', [
        { text: 'OK', onPress: () => { setShowClaim(false); fetchPlan(); } }
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to submit claim');
    } finally {
      setClaimSubmitting(false);
    }
  }, [claimIssue, claimDesc, claimImageBase64, existingPlan, profile, uploadImage, fetchPlan]);

  // ── Device management (add/remove/update) ──────────────────────────────────────
  const addDevice = useCallback(() => {
    const newDevice = {
      id: Date.now().toString(),
      brand: '',
      model: '',
      modelNumber: '',
      imei: '',
      frontImage: null,
      backImage: null,
      frontImageBase64: null,
      backImageBase64: null,
    };
    setDevices([...devices, newDevice]);
  }, [devices]);

  const removeDevice = useCallback((deviceId: string) => {
    setDevices(devices.filter(d => d.id !== deviceId));
  }, [devices]);

  const updateDevice = useCallback((deviceId: string, updates: any) => {
    setDevices(devices.map(d => d.id === deviceId ? { ...d, ...updates } : d));
  }, [devices]);

  // ── Expiry calculation ────────────────────────────────────────────────────────
  const getExpiryDate = (plan: Plan) => {
    const start = plan.planStartDate || plan.createdAt;
    const months = plan.planType === 'yearly' ? 12 : 3;
    const expiry = new Date(start);
    expiry.setMonth(expiry.getMonth() + months);
    return expiry.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  if (loadingPlan) {
    return (
      <View style={{ flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={PRIMARY} size="large" />
      </View>
    );
  }

  // ─── HEADER ──────────────────────────────────────────────────────────────────
  const Header = () => (
    <View style={[styles.header, { paddingTop: topPad + 8 }]}>
      <TouchableOpacity style={styles.backBtn} onPress={() => {
        if (step !== 'plan' && step !== 'dashboard') {
          const prev: Record<Step, Step> = { plan: 'plan', device: 'plan', imei: 'device', images: 'imei', consent: 'images', dashboard: 'dashboard' };
          setStep(prev[step]);
        } else {
          router.back();
        }
      }}>
        <Ionicons name="arrow-back" size={22} color={DARK} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Mobile Protection Plan</Text>
      <View style={{ width: 44 }} />
    </View>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // STEP: DASHBOARD
  // ════════════════════════════════════════════════════════════════════════════
  if (step === 'dashboard' && existingPlan) {
    const plan = existingPlan;
    const isActive = plan.status === 'active';
    const isPendingPayment = plan.status === 'approved_pending_payment';
    const canClaim = isActive && !plan.claimUsed;

    if (showClaim) {
      return (
        <View style={{ flex: 1, backgroundColor: BG }}>
          <Header />
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: botPad + 100 }}>
            <Text style={styles.sectionTitle}>Raise a Claim</Text>

            {/* Issue selection */}
            <View style={[styles.card, { marginBottom: 16 }]}>
              <Text style={styles.label}>Select Issue *</Text>
              {ISSUE_TYPES.map(issue => (
                <TouchableOpacity
                  key={issue}
                  style={[styles.radioRow, claimIssue === issue && styles.radioRowSelected]}
                  onPress={() => setClaimIssue(issue)}
                >
                  <View style={[styles.radio, claimIssue === issue && styles.radioSelected]}>
                    {claimIssue === issue && <View style={styles.radioDot} />}
                  </View>
                  <Text style={[styles.radioLabel, claimIssue === issue && { color: PRIMARY }]}>{issue}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Description */}
            <View style={[styles.card, { marginBottom: 16 }]}>
              <Text style={styles.label}>Describe the issue</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                placeholder="Please describe the damage in detail..."
                placeholderTextColor={MUTED}
                value={claimDesc}
                onChangeText={setClaimDesc}
                multiline
              />
            </View>

            {/* Damage image */}
            <View style={[styles.card, { marginBottom: 16 }]}>
              <Text style={styles.label}>Capture Damage Photo *</Text>
              <Text style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>Use your device camera to capture the damage</Text>
              <TouchableOpacity style={styles.imgPlaceholder} onPress={() => captureImage('claim')}>
                {claimImage
                  ? <Image source={{ uri: claimImage }} style={{ width: '100%', height: '100%', borderRadius: 12 }} resizeMode="cover" />
                  : <View style={{ alignItems: 'center', gap: 8 }}>
                      <Ionicons name="camera" size={32} color={MUTED} />
                      <Text style={{ color: MUTED, fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>Tap to Capture</Text>
                    </View>
                }
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={[styles.btn, { flex: 1, backgroundColor: '#F0F0F0' }]} onPress={() => setShowClaim(false)}>
                <Text style={[styles.btnText, { color: DARK }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { flex: 2 }]} onPress={handleRaiseClaim} disabled={claimSubmitting}>
                {claimSubmitting ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.btnText}>Submit Claim</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      );
    }

    return (
      <View style={{ flex: 1, backgroundColor: BG }}>
        <Header />
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: botPad + 40 }}>

          {/* Status card */}
          <View style={[styles.card, { marginBottom: 16 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <View style={[styles.shieldBig, { backgroundColor: isActive ? PRIMARY : AMBER }]}>
                <Ionicons name="shield-checkmark" size={28} color="#FFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.planName}>Mobile Protection Plan</Text>
                <Text style={{ fontSize: 12, color: MUTED }}>{plan.planType === 'yearly' ? 'Yearly Plan' : 'Monthly Plan (3-month)'}</Text>
              </View>
            </View>
            <StatusBadge status={plan.status} />

            {isActive && (
              <View style={{ marginTop: 14, backgroundColor: GREEN_L, borderRadius: 12, padding: 12, flexDirection: 'row', gap: 10 }}>
                <Ionicons name="calendar-outline" size={18} color={GREEN} />
                <View>
                  <Text style={{ fontSize: 12, color: MUTED }}>Valid Until</Text>
                  <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: DARK }}>{getExpiryDate(plan)}</Text>
                </View>
              </View>
            )}

            {isPendingPayment && (
              <View style={{ marginTop: 14 }}>
                <Text style={{ fontSize: 13, color: MUTED, marginBottom: 10 }}>Your application has been approved! Complete payment to activate your plan.</Text>
                <TouchableOpacity style={styles.btn} onPress={handlePayment}>
                  <Ionicons name="card-outline" size={18} color="#FFF" />
                  <Text style={styles.btnText}>Pay ₹{plan.price} Now</Text>
                </TouchableOpacity>
              </View>
            )}

            {plan.status === 'rejected' && (
              <View style={{ marginTop: 14, backgroundColor: '#FFEEEE', borderRadius: 12, padding: 14 }}>
                <Text style={{ fontSize: 14, color: RED, fontFamily: 'Inter_700Bold', marginBottom: 8 }}>Application Rejected</Text>
                <Text style={{ fontSize: 12, color: RED, marginBottom: 12 }}>
                  Reason: {plan.rejectionReason || 'Application did not meet eligibility criteria'}
                </Text>
                <Text style={{ fontSize: 12, color: DARK, marginBottom: 12, lineHeight: 18 }}>
                  You can update your details and apply again. We'll help you get your Mobile Protection Plan approved.
                </Text>
                <TouchableOpacity 
                  style={{ 
                    backgroundColor: PRIMARY, 
                    borderRadius: 8, 
                    paddingVertical: 11, 
                    alignItems: 'center',
                    activeOpacity: 0.8
                  }}
                  onPress={() => {
                    // Pre-fill form with previous data
                    setBrand(plan.brand);
                    setModel(plan.model);
                    setModelNumber(plan.modelNumber);
                    setImei(plan.imei);
                    // Navigate to device step for editing
                    setStep('device');
                  }}>
                  <Text style={{ fontSize: 14, color: '#FFF', fontFamily: 'Inter_700Bold' }}>Try Again</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Device details */}
          <View style={[styles.card, { marginBottom: 16 }]}>
            <Text style={styles.sectionTitle}>Device Details</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Brand</Text>
              <Text style={styles.detailValue}>{plan.brand}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Model</Text>
              <Text style={styles.detailValue}>{plan.model}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Model Number</Text>
              <Text style={styles.detailValue}>{plan.modelNumber}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>IMEI</Text>
              <Text style={styles.detailValue}>{plan.imei}</Text>
            </View>
          </View>

          {/* Coverage summary */}
          {isActive && (
            <View style={[styles.card, { marginBottom: 16 }]}>
              <Text style={styles.sectionTitle}>Coverage Summary</Text>
              <View style={styles.coverageRow}>
                <Ionicons name="phone-portrait-outline" size={18} color={PRIMARY} />
                <Text style={styles.coverageText}>1 Screen Damage Claim</Text>
                <View style={[styles.pill, plan.claimUsed ? { backgroundColor: '#FFEEEE' } : { backgroundColor: GREEN_L }]}>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: plan.claimUsed ? RED : GREEN }}>
                    {plan.claimUsed ? 'Used' : 'Available'}
                  </Text>
                </View>
              </View>
              <View style={styles.coverageRow}>
                <Ionicons name="car-outline" size={18} color={GREEN} />
                <Text style={styles.coverageText}>Free Pickup & Drop</Text>
                <View style={[styles.pill, { backgroundColor: GREEN_L }]}>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: GREEN }}>Included</Text>
                </View>
              </View>
              <View style={styles.coverageRow}>
                <Ionicons name="construct-outline" size={18} color={BLUE} />
                <Text style={styles.coverageText}>Service Fee: {plan.planType === 'yearly' ? '₹99–₹149' : '₹199–₹299'}</Text>
                <View style={[styles.pill, { backgroundColor: BLUE_L }]}>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: BLUE }}>Applicable</Text>
                </View>
              </View>
            </View>
          )}

          {/* Claim section */}
          {isActive && (
            <View style={[styles.card, { marginBottom: 16 }]}>
              <Text style={styles.sectionTitle}>Claim Status</Text>
              {existingClaim ? (
                <>
                  <StatusBadge status={existingClaim.status} />
                  <View style={{ marginTop: 12 }}>
                    <Text style={{ fontSize: 13, color: MUTED }}>Issue: {existingClaim.issue}</Text>
                    {existingClaim.technicianName ? (
                      <Text style={{ fontSize: 13, color: DARK, marginTop: 4 }}>
                        Technician: <Text style={{ fontFamily: 'Inter_600SemiBold' }}>{existingClaim.technicianName}</Text>
                      </Text>
                    ) : null}
                    {existingClaim.rejectionReason ? (
                      <Text style={{ fontSize: 13, color: RED, marginTop: 4 }}>Reason: {existingClaim.rejectionReason}</Text>
                    ) : null}
                  </View>
                </>
              ) : canClaim ? (
                <>
                  <Text style={{ fontSize: 13, color: MUTED, marginBottom: 14 }}>
                    You can raise one screen damage claim per plan year.
                  </Text>
                  <TouchableOpacity style={styles.btn} onPress={() => setShowClaim(true)}>
                    <Ionicons name="alert-circle-outline" size={18} color="#FFF" />
                    <Text style={styles.btnText}>Raise a Claim</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={{ fontSize: 13, color: MUTED }}>
                  {plan.claimUsed ? 'Your claim for this plan period has been used.' : 'Claim will be available after the waiting period.'}
                </Text>
              )}
            </View>
          )}

          {/* Device images */}
          {(plan.frontImage || plan.backImage) && (
            <View style={[styles.card, { marginBottom: 16 }]}>
              <Text style={styles.sectionTitle}>Device Images</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {plan.frontImage && (
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Front</Text>
                    <Image source={{ uri: plan.frontImage }} style={{ height: 120, borderRadius: 10 }} resizeMode="cover" />
                  </View>
                )}
                {plan.backImage && (
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Back</Text>
                    <Image source={{ uri: plan.backImage }} style={{ height: 120, borderRadius: 10 }} resizeMode="cover" />
                  </View>
                )}
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // STEP: PLAN SELECTION
  // ════════════════════════════════════════════════════════════════════════════
  if (step === 'plan') {
    return (
      <View style={{ flex: 1, backgroundColor: BG }}>
        <Header />
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: botPad + 100 }}>

          {/* Hero banner */}
          <View style={[styles.heroBanner, { marginBottom: 24 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: 6 }}>
                <Ionicons name="shield-checkmark" size={26} color="#FFF" />
              </View>
              <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: '#FFF' }}>Mobile Protection Plan</Text>
            </View>
            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', marginBottom: 4 }}>
              Screen damage covered • Doorstep service • Fast claims
            </Text>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: 10, marginTop: 8 }}>
              <Text style={{ fontSize: 13, color: '#FFF', fontFamily: 'Inter_600SemiBold' }}>
                💡 Screen repair costs ₹2000+ — save with this plan
              </Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Choose Your Plan</Text>

          {/* Yearly plan */}
          <TouchableOpacity
            style={[styles.planCard, planType === 'yearly' && styles.planCardSelected, { marginBottom: 12 }]}
            onPress={() => setPlanType('yearly')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Text style={[styles.planTitle, planType === 'yearly' && { color: PRIMARY }]}>Yearly Plan</Text>
                  <View style={{ backgroundColor: AMBER, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 10, fontFamily: 'Inter_700Bold', color: '#FFF' }}>BEST VALUE ⭐</Text>
                  </View>
                </View>
                <Text style={styles.planPrice}>₹1499<Text style={styles.planPriceSub}>/year</Text></Text>
                <View style={{ gap: 6, marginTop: 8 }}>
                  {['1 screen damage claim', 'Free pickup & drop', 'Service fee: ₹99–₹149', 'Waiting period: 7 days', 'Validity: 12 months'].map(f => (
                    <View key={f} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <Ionicons name="checkmark-circle" size={15} color={GREEN} />
                      <Text style={{ fontSize: 13, color: DARK }}>{f}</Text>
                    </View>
                  ))}
                </View>
                <View style={{ backgroundColor: GREEN_L, borderRadius: 8, padding: 8, marginTop: 10 }}>
                  <Text style={{ fontSize: 12, color: GREEN, fontFamily: 'Inter_600SemiBold' }}>💰 Save up to ₹4000 on repairs</Text>
                </View>
              </View>
              <View style={[styles.planRadio, planType === 'yearly' && styles.planRadioSelected]}>
                {planType === 'yearly' && <View style={styles.planRadioDot} />}
              </View>
            </View>
          </TouchableOpacity>

          {/* Monthly plan */}
          <TouchableOpacity
            style={[styles.planCard, planType === 'monthly' && styles.planCardSelected, { marginBottom: 24 }]}
            onPress={() => setPlanType('monthly')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.planTitle, planType === 'monthly' && { color: PRIMARY }, { marginBottom: 6 }]}>Monthly Plan</Text>
                <Text style={styles.planPrice}>₹149<Text style={styles.planPriceSub}>/month</Text></Text>
                <Text style={{ fontSize: 12, color: PRIMARY, fontFamily: 'Inter_600SemiBold', marginTop: 2 }}>Pay ₹447 upfront (3 months min)</Text>
                <View style={{ gap: 6, marginTop: 8 }}>
                  {['1 claim per year', 'Free pickup & drop', 'Service fee: ₹199–₹299', 'Waiting period: 30 days'].map(f => (
                    <View key={f} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <Ionicons name="checkmark-circle" size={15} color={GREEN} />
                      <Text style={{ fontSize: 13, color: DARK }}>{f}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={[styles.planRadio, planType === 'monthly' && styles.planRadioSelected]}>
                {planType === 'monthly' && <View style={styles.planRadioDot} />}
              </View>
            </View>
          </TouchableOpacity>

          {/* Eligibility */}
          <View style={[styles.card, { marginBottom: 24, backgroundColor: AMBER_L }]}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="information-circle-outline" size={18} color={AMBER} />
              <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: DARK }}>Eligibility</Text>
            </View>
            {['Devices under ₹20,000 only', 'One active plan per IMEI', 'Device must not be damaged', 'IMEI must be 15 digits'].map(e => (
              <View key={e} style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <Ionicons name="checkmark" size={14} color={AMBER} />
                <Text style={{ fontSize: 13, color: DARK }}>{e}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: botPad + 8 }]}>
          <TouchableOpacity style={styles.btn} onPress={() => {
            if (!profile?.id) { router.push('/onboarding'); return; }
            setStep('device');
          }}>
            <Text style={styles.btnText}>Get Protection — {planType === 'yearly' ? '₹1499/year' : '₹447 upfront'}</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // STEP: DEVICE DETAILS
  // ════════════════════════════════════════════════════════════════════════════
  if (step === 'device') {
    return (
      <View style={{ flex: 1, backgroundColor: BG }}>
        <Header />
        <ProgressBar step={2} total={5} />
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: botPad + 100 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.stepHeading}>Device Details</Text>
          <Text style={styles.stepSubheading}>Tell us about your device</Text>

          {/* Brand dropdown */}
          <Text style={styles.label}>Brand *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {PHONE_BRANDS.map(b => (
                <TouchableOpacity
                  key={b}
                  style={[styles.chip, brand === b && styles.chipSelected]}
                  onPress={() => setBrand(b)}
                >
                  <Text style={[styles.chipText, brand === b && styles.chipTextSelected]}>{b}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <Text style={styles.label}>Model Name *</Text>
          <TextInput
            style={[styles.input, { marginBottom: 16 }]}
            placeholder="e.g. Galaxy A54, iPhone 14"
            placeholderTextColor={MUTED}
            value={model}
            onChangeText={setModel}
          />

          <Text style={styles.label}>Model Number *</Text>
          <TextInput
            style={[styles.input, { marginBottom: 4 }]}
            placeholder="e.g. SM-A546B, A2650"
            placeholderTextColor={MUTED}
            value={modelNumber}
            onChangeText={setModelNumber}
          />
          <Text style={{ fontSize: 12, color: MUTED, marginBottom: 24 }}>Find in Settings → About Phone → Model Number</Text>

          <View style={[styles.card, { backgroundColor: BLUE_L, marginBottom: 16 }]}>
            <Text style={{ fontSize: 13, color: BLUE, fontFamily: 'Inter_600SemiBold' }}>
              ⚠️ Only devices priced under ₹20,000 are eligible for this plan.
            </Text>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: botPad + 8 }]}>
          <TouchableOpacity style={styles.btn} onPress={() => {
            if (!brand) { Alert.alert('Required', 'Please select your phone brand'); return; }
            if (!model.trim()) { Alert.alert('Required', 'Please enter your phone model'); return; }
            if (!modelNumber.trim()) { Alert.alert('Required', 'Please enter your model number'); return; }
            setStep('imei');
          }}>
            <Text style={styles.btnText}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // STEP: IMEI
  // ════════════════════════════════════════════════════════════════════════════
  if (step === 'imei') {
    const imeiValid = /^\d{15}$/.test(imei);
    return (
      <View style={{ flex: 1, backgroundColor: BG }}>
        <Header />
        <ProgressBar step={3} total={5} />
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: botPad + 100 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.stepHeading}>IMEI Number</Text>
          <Text style={styles.stepSubheading}>Enter your device's 15-digit IMEI</Text>

          <TextInput
            style={[styles.input, { fontSize: 20, fontFamily: 'Inter_700Bold', letterSpacing: 2, textAlign: 'center', marginVertical: 20 }, imeiValid && { borderColor: GREEN }]}
            placeholder="000000000000000"
            placeholderTextColor={MUTED}
            value={imei}
            onChangeText={t => setImei(t.replace(/\D/g, '').slice(0, 15))}
            keyboardType="numeric"
            maxLength={15}
          />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <View style={[styles.pill, { backgroundColor: imeiValid ? GREEN_L : '#F0F0F0' }]}>
              <Ionicons name={imeiValid ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={imeiValid ? GREEN : MUTED} />
              <Text style={{ fontSize: 12, color: imeiValid ? GREEN : MUTED }}>{imei.length}/15 digits</Text>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: PRIMARY_L, marginTop: 16 }]}>
            <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: DARK, marginBottom: 6 }}>How to find your IMEI:</Text>
            <Text style={{ fontSize: 13, color: DARK }}>1. Dial <Text style={{ fontFamily: 'Inter_700Bold' }}>*#06#</Text> on your phone</Text>
            <Text style={{ fontSize: 13, color: DARK, marginTop: 4 }}>2. Or check Settings → About Phone → IMEI</Text>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: botPad + 8 }]}>
          <TouchableOpacity style={[styles.btn, !imeiValid && { opacity: 0.5 }]} onPress={() => {
            if (!imeiValid) { Alert.alert('Invalid IMEI', 'Please enter a valid 15-digit IMEI number'); return; }
            setStep('images');
          }} disabled={!imeiValid}>
            <Text style={styles.btnText}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // STEP: IMAGES
  // ════════════════════════════════════════════════════════════════════════════
  if (step === 'images') {
    return (
      <View style={{ flex: 1, backgroundColor: BG }}>
        <Header />
        <ProgressBar step={4} total={5} />
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: botPad + 100 }}>
          <Text style={styles.stepHeading}>Capture Device Photos</Text>
          <Text style={styles.stepSubheading}>Camera only — tap each to take a photo</Text>

          <View style={[styles.card, { backgroundColor: PRIMARY_L, marginBottom: 16 }]}>
            <Text style={{ fontSize: 13, color: PRIMARY, fontFamily: 'Inter_600SemiBold' }}>
              📸 Capture clear photos using your device camera
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { textAlign: 'center' }]}>Front *</Text>
              <TouchableOpacity style={styles.imgPlaceholder} onPress={() => captureImage('front')}>
                {frontImage
                  ? <Image source={{ uri: frontImage }} style={{ width: '100%', height: '100%', borderRadius: 12 }} resizeMode="cover" />
                  : <View style={{ alignItems: 'center', gap: 8 }}>
                      <Ionicons name="camera" size={32} color={MUTED} />
                      <Text style={{ color: MUTED, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>Tap to Capture</Text>
                    </View>
                }
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { textAlign: 'center' }]}>Back *</Text>
              <TouchableOpacity style={styles.imgPlaceholder} onPress={() => captureImage('back')}>
                {backImage
                  ? <Image source={{ uri: backImage }} style={{ width: '100%', height: '100%', borderRadius: 12 }} resizeMode="cover" />
                  : <View style={{ alignItems: 'center', gap: 8 }}>
                      <Ionicons name="camera" size={32} color={MUTED} />
                      <Text style={{ color: MUTED, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>Tap to Capture</Text>
                    </View>
                }
              </TouchableOpacity>
            </View>
          </View>

          <Text style={{ fontSize: 12, color: MUTED, textAlign: 'center' }}>
            Make sure the device screen and back panel are clearly visible. No damage should be present.
          </Text>

          {/* Additional devices */}
          {devices.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 24, marginBottom: 12 }]}>Additional Devices</Text>
              {devices.map((device, idx) => (
                <View key={device.id} style={[styles.card, { marginBottom: 16, borderColor: LIGHT, borderWidth: 1 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 14, color: DARK }}>Device {idx + 2}</Text>
                    <TouchableOpacity onPress={() => removeDevice(device.id)}>
                      <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
                    </TouchableOpacity>
                  </View>

                  {/* Device fields */}
                  <View style={{ gap: 10, marginBottom: 12 }}>
                    <View>
                      <Text style={styles.label}>Brand</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g., Samsung, iPhone"
                        value={device.brand}
                        onChangeText={(val) => updateDevice(device.id, { brand: val })}
                      />
                    </View>
                    <View>
                      <Text style={styles.label}>Model</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g., Galaxy S24"
                        value={device.model}
                        onChangeText={(val) => updateDevice(device.id, { model: val })}
                      />
                    </View>
                    <View>
                      <Text style={styles.label}>Model Number</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g., SM-S911B"
                        value={device.modelNumber}
                        onChangeText={(val) => updateDevice(device.id, { modelNumber: val })}
                      />
                    </View>
                    <View>
                      <Text style={styles.label}>IMEI (15 digits)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="15-digit number"
                        value={device.imei}
                        onChangeText={(val) => updateDevice(device.id, { imei: val.replace(/\D/g, '').slice(0, 15) })}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>

                  {/* Device images */}
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.label, { textAlign: 'center' }]}>Front</Text>
                      <TouchableOpacity
                        style={styles.imgPlaceholder}
                        onPress={() => {
                          // Capture and store image for this device
                          const captureForDevice = async () => {
                            const isWeb = typeof window !== 'undefined';
                            try {
                              if (isWeb) {
                                const hiddenInput = document.createElement('input');
                                hiddenInput.type = 'file';
                                hiddenInput.accept = 'image/*';
                                hiddenInput.onchange = (e: any) => {
                                  const file = e.target.files[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onload = (evt: any) => {
                                      const b64 = evt.target.result.split(',')[1];
                                      const mimeType = file.type || 'image/jpeg';
                                      updateDevice(device.id, {
                                        frontImage: `data:${mimeType};base64,${b64}`,
                                        frontImageBase64: b64,
                                      });
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                };
                                hiddenInput.click();
                              }
                            } catch (e) {
                              Alert.alert('Error', 'Failed to capture image');
                            }
                          };
                          captureForDevice();
                        }}
                      >
                        {device.frontImage
                          ? <Image source={{ uri: device.frontImage }} style={{ width: '100%', height: '100%', borderRadius: 8 }} resizeMode="cover" />
                          : <View style={{ alignItems: 'center', gap: 4 }}>
                              <Ionicons name="camera" size={20} color={MUTED} />
                              <Text style={{ color: MUTED, fontSize: 10, fontFamily: 'Inter_600SemiBold' }}>Tap</Text>
                            </View>
                        }
                      </TouchableOpacity>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.label, { textAlign: 'center' }]}>Back</Text>
                      <TouchableOpacity
                        style={styles.imgPlaceholder}
                        onPress={() => {
                          const captureForDevice = async () => {
                            const isWeb = typeof window !== 'undefined';
                            try {
                              if (isWeb) {
                                const hiddenInput = document.createElement('input');
                                hiddenInput.type = 'file';
                                hiddenInput.accept = 'image/*';
                                hiddenInput.onchange = (e: any) => {
                                  const file = e.target.files[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onload = (evt: any) => {
                                      const b64 = evt.target.result.split(',')[1];
                                      const mimeType = file.type || 'image/jpeg';
                                      updateDevice(device.id, {
                                        backImage: `data:${mimeType};base64,${b64}`,
                                        backImageBase64: b64,
                                      });
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                };
                                hiddenInput.click();
                              }
                            } catch (e) {
                              Alert.alert('Error', 'Failed to capture image');
                            }
                          };
                          captureForDevice();
                        }}
                      >
                        {device.backImage
                          ? <Image source={{ uri: device.backImage }} style={{ width: '100%', height: '100%', borderRadius: 8 }} resizeMode="cover" />
                          : <View style={{ alignItems: 'center', gap: 4 }}>
                              <Ionicons name="camera" size={20} color={MUTED} />
                              <Text style={{ color: MUTED, fontSize: 10, fontFamily: 'Inter_600SemiBold' }}>Tap</Text>
                            </View>
                        }
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}

          {/* Add device button */}
          <TouchableOpacity
            style={[styles.card, { borderStyle: 'dashed', borderWidth: 2, borderColor: PRIMARY, backgroundColor: PRIMARY_L, alignItems: 'center', padding: 16, marginBottom: 12 }]}
            onPress={addDevice}
          >
            <Ionicons name="add-circle-outline" size={24} color={PRIMARY} />
            <Text style={{ fontFamily: 'Inter_600SemiBold', color: PRIMARY, marginTop: 6 }}>+ Add Another Device</Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: botPad + 8 }]}>
          <TouchableOpacity style={styles.btn} onPress={() => {
            if (!frontImage || !backImage) {
              Alert.alert('Photos Required', 'Please capture both front and back photos of your device');
              return;
            }
            setStep('consent');
          }}>
            <Text style={styles.btnText}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // STEP: CONSENT
  // ════════════════════════════════════════════════════════════════════════════
  if (step === 'consent') {
    return (
      <View style={{ flex: 1, backgroundColor: BG }}>
        <Header />
        <ProgressBar step={5} total={5} />
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: botPad + 100 }}>
          <Text style={styles.stepHeading}>Review & Submit</Text>

          {/* Summary */}
          <View style={[styles.card, { marginBottom: 16 }]}>
            <Text style={styles.sectionTitle}>Application Summary</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Plan</Text>
              <Text style={styles.detailValue}>{planType === 'yearly' ? 'Yearly — ₹1499' : 'Monthly — ₹447 (3 months)'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Brand</Text>
              <Text style={styles.detailValue}>{brand}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Model</Text>
              <Text style={styles.detailValue}>{model}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Model Number</Text>
              <Text style={styles.detailValue}>{modelNumber}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>IMEI</Text>
              <Text style={styles.detailValue}>{imei}</Text>
            </View>

            {devices.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 12, marginBottom: 8 }]}>Additional Devices</Text>
                {devices.map((device, idx) => (
                  <View key={device.id} style={{ marginBottom: 8 }}>
                    <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: DARK }}>Device {idx + 2}</Text>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Brand</Text>
                      <Text style={styles.detailValue}>{device.brand || '—'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>IMEI</Text>
                      <Text style={styles.detailValue}>{device.imei || '—'}</Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </View>

          {/* Consent */}
          <View style={[styles.card, { marginBottom: 16 }]}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <TouchableOpacity onPress={() => setAgreed(!agreed)}>
                <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
                  {agreed && <Ionicons name="checkmark" size={14} color="#FFF" />}
                </View>
              </TouchableOpacity>
              <Text style={{ flex: 1, fontSize: 13, color: DARK, lineHeight: 20 }}>
                By continuing, I agree to share my device IMEI, model details, and images for verification. I confirm that my device is not damaged and is priced under ₹20,000.
              </Text>
            </View>
          </View>

          {/* Legal */}
          <View style={[styles.card, { backgroundColor: '#F8F9FA', marginBottom: 16 }]}>
            <Text style={{ fontSize: 12, color: MUTED, lineHeight: 18 }}>
              This is a <Text style={{ fontFamily: 'Inter_600SemiBold' }}>Mobile Protection Plan</Text> — not insurance.
              Coverage is limited to 1 screen damage claim per plan period. Service fees apply.
              Fraud protection measures include IMEI verification, model number matching, camera-only image capture, and timestamp validation.
            </Text>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: botPad + 8 }]}>
          <TouchableOpacity style={[styles.btn, (!agreed || submitting) && { opacity: 0.6 }]} onPress={handleSubmit} disabled={!agreed || submitting}>
            {submitting
              ? <ActivityIndicator color="#FFF" size="small" />
              : <><Ionicons name="shield-checkmark-outline" size={18} color="#FFF" /><Text style={styles.btnText}>Submit Application</Text></>
            }
          </TouchableOpacity>
        </View>

        {/* Submission Status Modal */}
        {submitting && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 999 }]}>
            <View style={[styles.card, { width: '80%', maxWidth: 320, alignItems: 'center' }]}>
              {submissionStatus === 'success' ? (
                <>
                  <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: GREEN_L, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                    <Ionicons name="checkmark" size={48} color={GREEN} />
                  </View>
                  <Text style={{ fontSize: 18, fontFamily: 'Inter_700Bold', color: DARK, marginBottom: 8, textAlign: 'center' }}>
                    {submissionMessage}
                  </Text>
                  <Text style={{ fontSize: 13, color: MUTED, textAlign: 'center', lineHeight: 18 }}>
                    Your application has been submitted successfully. You will be redirected shortly.
                  </Text>
                </>
              ) : submissionStatus === 'error' ? (
                <>
                  <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#FFEEEE', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                    <Ionicons name="close-circle" size={48} color={RED} />
                  </View>
                  <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: RED, marginBottom: 8, textAlign: 'center' }}>
                    Submission Failed
                  </Text>
                  <Text style={{ fontSize: 13, color: MUTED, textAlign: 'center', lineHeight: 18, marginBottom: 16 }}>
                    {submissionMessage}
                  </Text>
                  <TouchableOpacity 
                    onPress={() => {
                      setSubmissionStatus('idle');
                      setSubmitting(false);
                    }}
                    style={{ backgroundColor: PRIMARY, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}
                  >
                    <Text style={{ color: '#FFF', fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>Try Again</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <ActivityIndicator size="large" color={PRIMARY} style={{ marginBottom: 16 }} />
                  <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: DARK, marginBottom: 8, textAlign: 'center' }}>
                    {submissionMessage}
                  </Text>
                  <Text style={{ fontSize: 12, color: MUTED, textAlign: 'center' }}>
                    Please wait while we process your application...
                  </Text>
                </>
              )}
            </View>
          </View>
        )}
      </View>
    );
  }

  return null;
}

function ProgressBar({ step, total }: { step: number; total: number }) {
  const pct = (step / total) * 100;
  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: CARD }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontSize: 12, color: MUTED }}>Step {step} of {total}</Text>
        <Text style={{ fontSize: 12, color: PRIMARY, fontFamily: 'Inter_600SemiBold' }}>{Math.round(pct)}%</Text>
      </View>
      <View style={{ height: 4, backgroundColor: '#E5E7EB', borderRadius: 2 }}>
        <View style={{ height: 4, width: `${pct}%`, backgroundColor: PRIMARY, borderRadius: 2 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, backgroundColor: BG,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: CARD,
    alignItems: 'center', justifyContent: 'center', ...SHADOW,
  },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: DARK },

  heroBanner: {
    borderRadius: 20, padding: 20,
    backgroundColor: PRIMARY,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },

  sectionTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', color: DARK, marginBottom: 12 },
  stepHeading: { fontSize: 22, fontFamily: 'Inter_700Bold', color: DARK, marginBottom: 4 },
  stepSubheading: { fontSize: 14, color: MUTED, marginBottom: 20 },

  card: { backgroundColor: CARD, borderRadius: 16, padding: 16, ...SHADOW },

  planCard: {
    backgroundColor: CARD, borderRadius: 16, padding: 16, borderWidth: 2,
    borderColor: '#E5E7EB', ...SHADOW, marginBottom: 12,
  },
  planCardSelected: { borderColor: PRIMARY, backgroundColor: PRIMARY_L },
  planTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: DARK },
  planPrice: { fontSize: 28, fontFamily: 'Inter_700Bold', color: DARK },
  planPriceSub: { fontSize: 14, fontFamily: 'Inter_400Regular', color: MUTED },
  planRadio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#CCC',
    alignItems: 'center', justifyContent: 'center',
  },
  planRadioSelected: { borderColor: PRIMARY },
  planRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: PRIMARY },

  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: DARK, marginBottom: 8 },
  input: {
    backgroundColor: '#F9F9F9', borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E5E5',
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: DARK,
  },

  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: CARD, borderWidth: 1.5, borderColor: '#E5E5E5',
  },
  chipSelected: { backgroundColor: PRIMARY_L, borderColor: PRIMARY },
  chipText: { fontSize: 13, color: DARK, fontFamily: 'Inter_500Medium' },
  chipTextSelected: { color: PRIMARY, fontFamily: 'Inter_600SemiBold' },

  imgPlaceholder: {
    height: 150, borderRadius: 12, backgroundColor: '#F5F5F5',
    borderWidth: 2, borderColor: '#E5E5E5', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },

  radioRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#E5E5E5',
    marginBottom: 8,
  },
  radioRowSelected: { borderColor: PRIMARY, backgroundColor: PRIMARY_L },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#CCC',
    alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: PRIMARY },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: PRIMARY },
  radioLabel: { fontSize: 14, color: DARK, flex: 1 },

  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  detailLabel: { fontSize: 13, color: MUTED },
  detailValue: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: DARK, maxWidth: '60%', textAlign: 'right' },

  coverageRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  coverageText: { flex: 1, fontSize: 13, color: DARK },

  pill: {
    flexDirection: 'row', gap: 4, alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
  },

  shieldBig: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
  },
  planName: { fontSize: 16, fontFamily: 'Inter_700Bold', color: DARK, marginBottom: 2 },

  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#CCC',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: PRIMARY, borderColor: PRIMARY },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: CARD, paddingHorizontal: 16, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: '#F0F0F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 4,
  },
  btn: {
    backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  btnText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#FFF' },
});
