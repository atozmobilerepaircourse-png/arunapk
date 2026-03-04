import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform,
  Alert, ActivityIndicator, TextInput, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useApp } from '@/lib/context';
import { apiRequest } from '@/lib/query-client';
import * as Haptics from 'expo-haptics';

const CLAIM_STEPS = [
  { icon: 'phone-portrait-outline', text: 'Phone is damaged' },
  { icon: 'phone-portrait', text: 'Open app → Claim Insurance' },
  { icon: 'camera-outline', text: 'Upload damage photo' },
  { icon: 'construct-outline', text: 'Technician is assigned' },
  { icon: 'pricetag-outline', text: 'Get repair discount applied' },
];

const PAYMENT_METHODS = [
  { icon: 'phone-portrait-outline', label: 'UPI', color: '#FF6B35' },
  { icon: 'card-outline', label: 'Card', color: '#007AFF' },
  { icon: 'wallet-outline', label: 'Wallet', color: '#34C759' },
];

interface InsurancePlan {
  id: string;
  name: string;
  price: number;
  repairDiscount: number;
  coverage: string;
  isActive: number;
  sortOrder: number;
}

interface InsurancePolicy {
  id: string;
  planId: string;
  planName: string;
  planPrice: number;
  status: string;
  startDate: number;
  endDate: number;
  claimStatus: string | null;
  claimDescription: string | null;
}

export default function InsuranceScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useApp();
  const [plans, setPlans] = useState<InsurancePlan[]>([]);
  const [policy, setPolicy] = useState<InsurancePolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [showClaim, setShowClaim] = useState(false);
  const [claimDesc, setClaimDesc] = useState('');
  const [submittingClaim, setSubmittingClaim] = useState(false);

  const webTop = Platform.OS === 'web' ? 67 : 0;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [plansRes, policyRes] = await Promise.all([
        apiRequest('GET', '/api/insurance/plans'),
        profile ? apiRequest('GET', `/api/insurance/policy/${profile.id}`) : Promise.resolve(null),
      ]);
      const plansData = await plansRes.json();
      if (plansData.plans) setPlans(plansData.plans);
      if (policyRes) {
        const policyData = await policyRes.json();
        setPolicy(policyData.policy || null);
      }
    } catch {}
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubscribe = async (plan: InsurancePlan) => {
    if (!profile) { Alert.alert('Login Required', 'Please log in to subscribe.'); return; }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      `Subscribe to ${plan.name}`,
      `₹${plan.price}/month\n\nContact admin on WhatsApp to complete payment.\n\nAdmin: +91 8179142535`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'WhatsApp Admin',
          onPress: () => {
            const msg = encodeURIComponent(`Hi, I want to subscribe to ${plan.name} insurance plan (₹${plan.price}/month) for the Mobi app. My name is ${profile.name}, phone: ${profile.phone}`);
            Linking.openURL(`https://wa.me/918179142535?text=${msg}`);
          },
        },
      ]
    );
  };

  const handleClaim = async () => {
    if (!profile || !policy) return;
    if (!claimDesc.trim()) { Alert.alert('Error', 'Please describe the damage.'); return; }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubmittingClaim(true);
    try {
      const res = await apiRequest('POST', '/api/insurance/claim', {
        userId: profile.id,
        description: claimDesc,
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert('Claim Submitted', 'Your claim has been submitted. A technician will be assigned shortly.');
        setShowClaim(false);
        setClaimDesc('');
        await loadData();
      } else {
        Alert.alert('Error', data.message || 'Failed to submit claim');
      }
    } catch {
      Alert.alert('Error', 'Connection failed');
    }
    setSubmittingClaim(false);
  };

  const formatDate = (ts: number) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getCoverageList = (coverageStr: string): string[] => {
    try {
      const parsed = JSON.parse(coverageStr);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    if (!coverageStr) return [];
    return coverageStr.split(',').map(s => s.trim()).filter(Boolean);
  };

  const claimStatusColor = (s: string | null) => {
    if (s === 'approved') return '#34C759';
    if (s === 'rejected') return '#FF3B30';
    if (s === 'pending') return '#FF9500';
    return '#999';
  };

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color="#5856D6" />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={[s.topBar, { paddingTop: (Platform.OS === 'web' ? webTop : insets.top) + 12 }]}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </Pressable>
        <Text style={s.topTitle}>Mobile Protection</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={{ paddingBottom: Platform.OS === 'web' ? 100 : insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {policy ? (
          <View style={s.activePolicyCard}>
            <View style={s.activePolicyHeader}>
              <View style={s.shieldCircle}>
                <Ionicons name="shield-checkmark" size={32} color="#fff" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.activePolicyTitle}>Active Plan</Text>
                <Text style={s.activePolicyName}>{policy.planName}</Text>
                <Text style={s.activePolicyPrice}>₹{policy.planPrice}/month</Text>
              </View>
            </View>
            <View style={s.policyDates}>
              <View style={s.dateItem}>
                <Text style={s.dateLabel}>Start Date</Text>
                <Text style={s.dateValue}>{formatDate(policy.startDate)}</Text>
              </View>
              <View style={s.dateDivider} />
              <View style={s.dateItem}>
                <Text style={s.dateLabel}>Renewal</Text>
                <Text style={s.dateValue}>{formatDate(policy.endDate)}</Text>
              </View>
            </View>
            {policy.claimStatus && policy.claimStatus !== 'none' ? (
              <View style={[s.claimStatusBadge, { backgroundColor: claimStatusColor(policy.claimStatus) + '20' }]}>
                <Ionicons name="document-text-outline" size={16} color={claimStatusColor(policy.claimStatus)} />
                <Text style={[s.claimStatusText, { color: claimStatusColor(policy.claimStatus) }]}>
                  Claim: {policy.claimStatus.charAt(0).toUpperCase() + policy.claimStatus.slice(1)}
                </Text>
              </View>
            ) : (
              <Pressable
                style={({ pressed }) => [s.claimBtn, pressed && { opacity: 0.85 }]}
                onPress={() => setShowClaim(true)}
              >
                <Ionicons name="shield-outline" size={18} color="#fff" />
                <Text style={s.claimBtnText}>Claim Insurance</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={s.heroBanner}>
            <Ionicons name="shield" size={52} color="#5856D6" />
            <Text style={s.heroTitle}>Protect Your Phone</Text>
            <Text style={s.heroSub}>Accidental damage, screen breaks, water damage — covered.</Text>
          </View>
        )}

        {showClaim && (
          <View style={s.claimForm}>
            <Text style={s.claimFormTitle}>Describe the Damage</Text>
            <TextInput
              style={s.claimInput}
              placeholder="What happened to your phone?"
              placeholderTextColor="#999"
              value={claimDesc}
              onChangeText={setClaimDesc}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={s.claimFormBtns}>
              <Pressable style={s.claimCancelBtn} onPress={() => { setShowClaim(false); setClaimDesc(''); }}>
                <Text style={s.claimCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [s.claimSubmitBtn, pressed && { opacity: 0.85 }]}
                onPress={handleClaim}
                disabled={submittingClaim}
              >
                {submittingClaim ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.claimSubmitText}>Submit Claim</Text>
                )}
              </Pressable>
            </View>
          </View>
        )}

        {!policy && (
          <>
            <Text style={s.sectionTitle}>Choose a Plan</Text>
            {plans.length === 0 ? (
              <View style={s.noPlans}>
                <Ionicons name="shield-outline" size={40} color="#CCC" />
                <Text style={s.noPlansText}>No plans available right now.</Text>
                <Text style={s.noPlansContact}>Contact admin: +91 8179142535</Text>
              </View>
            ) : (
              plans.map((plan, idx) => {
                const coverage = getCoverageList(plan.coverage);
                const isPopular = idx === 1;
                return (
                  <View key={plan.id} style={[s.planCard, isPopular && s.planCardPopular]}>
                    {isPopular && (
                      <View style={s.popularBadge}>
                        <Text style={s.popularBadgeText}>Most Popular</Text>
                      </View>
                    )}
                    <View style={s.planHeader}>
                      <Text style={[s.planName, isPopular && { color: '#5856D6' }]}>{plan.name}</Text>
                      <View style={s.planPriceRow}>
                        <Text style={s.planPrice}>₹{plan.price}</Text>
                        <Text style={s.planPricePer}>/month</Text>
                      </View>
                    </View>
                    <View style={s.planDiscount}>
                      <Ionicons name="pricetag" size={14} color="#34C759" />
                      <Text style={s.planDiscountText}>₹{plan.repairDiscount} repair discount</Text>
                    </View>
                    {coverage.length > 0 && (
                      <View style={s.coverageList}>
                        {coverage.map((item, i) => (
                          <View key={i} style={s.coverageItem}>
                            <Ionicons name="checkmark-circle" size={16} color="#34C759" />
                            <Text style={s.coverageText}>{item}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    <Pressable
                      style={({ pressed }) => [
                        s.subscribeBtn,
                        isPopular && s.subscribeBtnPopular,
                        pressed && { opacity: 0.85 },
                        subscribing === plan.id && { opacity: 0.6 },
                      ]}
                      onPress={() => handleSubscribe(plan)}
                      disabled={subscribing === plan.id}
                    >
                      <Text style={[s.subscribeBtnText, isPopular && { color: '#fff' }]}>
                        Get {plan.name}
                      </Text>
                    </Pressable>
                  </View>
                );
              })
            )}
          </>
        )}

        <Text style={s.sectionTitle}>Payment Methods</Text>
        <View style={s.paymentRow}>
          {PAYMENT_METHODS.map((m, i) => (
            <View key={i} style={s.paymentMethod}>
              <View style={[s.paymentIcon, { backgroundColor: m.color + '15' }]}>
                <Ionicons name={m.icon as any} size={22} color={m.color} />
              </View>
              <Text style={s.paymentLabel}>{m.label}</Text>
            </View>
          ))}
        </View>

        <Text style={s.sectionTitle}>How Claims Work</Text>
        <View style={s.stepsCard}>
          {CLAIM_STEPS.map((step, i) => (
            <View key={i} style={s.stepRow}>
              <View style={s.stepNumCircle}>
                <Text style={s.stepNum}>{i + 1}</Text>
              </View>
              <View style={s.stepIconCircle}>
                <Ionicons name={step.icon as any} size={18} color="#5856D6" />
              </View>
              <Text style={s.stepText}>{step.text}</Text>
              {i < CLAIM_STEPS.length - 1 && <View style={s.stepConnector} />}
            </View>
          ))}
        </View>

        <View style={s.contactCard}>
          <Ionicons name="headset-outline" size={24} color="#5856D6" />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.contactTitle}>Need Help?</Text>
            <Text style={s.contactSub}>Chat with our support team</Text>
          </View>
          <Pressable
            style={s.whatsappBtn}
            onPress={() => Linking.openURL('https://wa.me/918179142535?text=Hi, I need help with my insurance')}
          >
            <Ionicons name="logo-whatsapp" size={18} color="#fff" />
            <Text style={s.whatsappText}>WhatsApp</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F4F8' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F4F8' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 16,
    backgroundColor: '#5856D6',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  topTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#fff' },
  scroll: { flex: 1 },
  heroBanner: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24, backgroundColor: '#fff', margin: 16, borderRadius: 20 },
  heroTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', color: '#1A1A2E', marginTop: 12 },
  heroSub: { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#666', textAlign: 'center', marginTop: 6, lineHeight: 20 },
  activePolicyCard: {
    margin: 16, backgroundColor: '#5856D6', borderRadius: 20, padding: 20,
    shadowColor: '#5856D6', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
  },
  activePolicyHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  shieldCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  activePolicyTitle: { fontSize: 12, fontFamily: 'Inter_500Medium', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 1 },
  activePolicyName: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#fff', marginTop: 2 },
  activePolicyPrice: { fontSize: 14, fontFamily: 'Inter_500Medium', color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  policyDates: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 12, marginBottom: 16 },
  dateItem: { flex: 1, alignItems: 'center' },
  dateLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.7)' },
  dateValue: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#fff', marginTop: 2 },
  dateDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  claimBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: 12 },
  claimBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  claimStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12 },
  claimStatusText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  claimForm: { margin: 16, backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  claimFormTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#1A1A2E', marginBottom: 12 },
  claimInput: { borderWidth: 1, borderColor: '#E8E8E8', borderRadius: 12, padding: 12, fontSize: 14, fontFamily: 'Inter_400Regular', color: '#000', minHeight: 100 },
  claimFormBtns: { flexDirection: 'row', gap: 10, marginTop: 12 },
  claimCancelBtn: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E8E8E8', alignItems: 'center' },
  claimCancelText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#666' },
  claimSubmitBtn: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: '#5856D6', alignItems: 'center' },
  claimSubmitText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  sectionTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#1A1A2E', marginHorizontal: 16, marginTop: 20, marginBottom: 12 },
  noPlans: { alignItems: 'center', paddingVertical: 32, backgroundColor: '#fff', margin: 16, borderRadius: 16 },
  noPlansText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#999', marginTop: 10 },
  noPlansContact: { fontSize: 13, fontFamily: 'Inter_500Medium', color: '#5856D6', marginTop: 4 },
  planCard: { marginHorizontal: 16, marginBottom: 12, backgroundColor: '#fff', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#E8E8E8' },
  planCardPopular: { borderColor: '#5856D6', borderWidth: 2 },
  popularBadge: { alignSelf: 'flex-start', backgroundColor: '#5856D6', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10 },
  popularBadgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  planName: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#1A1A2E' },
  planPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  planPrice: { fontSize: 24, fontFamily: 'Inter_700Bold', color: '#5856D6' },
  planPricePer: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#666' },
  planDiscount: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  planDiscountText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: '#34C759' },
  coverageList: { gap: 8, marginBottom: 16 },
  coverageItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  coverageText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#444' },
  subscribeBtn: { backgroundColor: '#F0EFFE', borderRadius: 12, padding: 14, alignItems: 'center' },
  subscribeBtnPopular: { backgroundColor: '#5856D6' },
  subscribeBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#5856D6' },
  paymentRow: { flexDirection: 'row', gap: 12, marginHorizontal: 16, marginBottom: 8 },
  paymentMethod: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#F0F0F0' },
  paymentIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  paymentLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#333' },
  stepsCard: { marginHorizontal: 16, marginBottom: 8, backgroundColor: '#fff', borderRadius: 20, padding: 20 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  stepNumCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#5856D6', justifyContent: 'center', alignItems: 'center' },
  stepNum: { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#fff' },
  stepIconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F0EFFE', justifyContent: 'center', alignItems: 'center' },
  stepText: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', color: '#333' },
  stepConnector: { display: 'none' },
  contactCard: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8,
    backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E8E8E8',
  },
  contactTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#1A1A2E' },
  contactSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#999', marginTop: 2 },
  whatsappBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#25D366', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  whatsappText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#fff' },
});
