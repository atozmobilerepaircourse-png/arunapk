import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useApp } from '@/lib/context';
import { apiRequest, getApiUrl } from '@/lib/query-client';

const PRIMARY   = '#E8704A';
const PRIMARY_L = '#FFF1EC';
const BG        = '#F5F5F5';
const CARD      = '#FFFFFF';
const DARK      = '#1A1A1A';
const MUTED     = '#888888';
const GREEN     = '#34C759';
const GREEN_L   = '#E8F5ED';
const BLUE      = '#4A90D9';
const BLUE_L    = '#E8F2FB';
const AMBER     = '#F59E0B';
const AMBER_L   = '#FFFBEB';

const SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.07,
  shadowRadius: 8,
  elevation: 2,
};

const COVERAGE_ITEMS = [
  { id: 'screen',    icon: 'phone-portrait-outline',  label: 'Screen Damage',             sub: '(1 Free)',   color: BLUE,  bg: BLUE_L  },
  { id: 'liquid',    icon: 'water-outline',            label: 'Accidental Liquid Damage',  sub: '',           color: PRIMARY, bg: PRIMARY_L },
  { id: 'hardware',  icon: 'hardware-chip-outline',    label: 'Hardware Malfunctions',     sub: '',           color: AMBER, bg: AMBER_L },
  { id: 'pickup',    icon: 'car-outline',              label: 'Free Pickup & Drop',        sub: '',           color: GREEN, bg: GREEN_L },
];

const BENEFITS = [
  { icon: 'shield-checkmark-outline', label: 'Full Coverage',    sub: 'Screen, liquid & hardware', color: PRIMARY, bg: PRIMARY_L },
  { icon: 'people-outline',           label: 'Certified Techs',  sub: 'Verified experts only',     color: BLUE,    bg: BLUE_L   },
  { icon: 'hardware-chip-outline',    label: 'Genuine Parts',    sub: 'OEM quality guaranteed',    color: AMBER,   bg: AMBER_L  },
  { icon: 'car-outline',              label: 'Free Pickup',      sub: 'We come to you',            color: GREEN,   bg: GREEN_L  },
];

export default function InsuranceScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useApp();
  const [subActive, setSubActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [subEnd, setSubEnd] = useState<number | null>(null);

  const topInset  = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom + 20;

  const checkSub = useCallback(async () => {
    if (!profile?.id) { setChecking(false); return; }
    try {
      const res = await apiRequest('GET', `/api/subscription/status/${profile.id}`);
      const data = await res.json();
      setSubActive(data.active === true);
      if (data.subscriptionEnd) setSubEnd(data.subscriptionEnd);
    } catch { setSubActive(false); }
    finally { setChecking(false); }
  }, [profile?.id]);

  useEffect(() => { checkSub(); }, [checkSub]);

  const handleSubscribe = async () => {
    if (!profile?.id) { router.push('/onboarding'); return; }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      const res = await apiRequest('POST', '/api/customer/subscription/create-order', {
        userId: profile.id,
        planId: 'premium',
        amount: 50 * 100,
      });
      const data = await res.json();
      if (!data.success) {
        if (Platform.OS === 'web') window.alert(data.message || 'Failed to create order');
        else Alert.alert('Error', data.message || 'Failed to create order');
        return;
      }
      const { orderId, keyId, amount } = data;
      const url = new URL('/api/subscription/checkout', getApiUrl());
      url.searchParams.set('orderId', orderId);
      url.searchParams.set('amount', String(amount));
      url.searchParams.set('keyId', keyId);
      url.searchParams.set('role', 'customer');
      url.searchParams.set('displayAmount', '50');
      url.searchParams.set('userId', profile.id);
      url.searchParams.set('userName', profile.name || '');
      url.searchParams.set('userPhone', profile.phone || '');
      if (Platform.OS === 'web') {
        window.open(url.toString(), '_blank');
        setTimeout(checkSub, 5000);
      } else {
        router.push({ pathname: '/webview', params: { url: url.toString(), type: 'customer_sub' } } as any);
      }
    } catch {
      if (Platform.OS === 'web') window.alert('Failed. Please try again.');
      else Alert.alert('Error', 'Failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <View style={{ flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={PRIMARY} size="large" />
      </View>
    );
  }

  const validTill = subEnd
    ? new Date(subEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {/* Nav bar */}
      <View style={[styles.navBar, { paddingTop: topInset + 8 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={DARK} />
        </Pressable>
        <Text style={styles.navTitle}>Protection Plan</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomPad + 120, paddingHorizontal: 16 }}>

        {/* Hero Card */}
        <View style={[styles.heroCard, subActive && { borderColor: PRIMARY, borderWidth: 1.5 }]}>
          <View style={styles.heroTop}>
            <View style={styles.heroIconWrap}>
              <Ionicons name="shield-checkmark" size={36} color={subActive ? '#FFF' : DARK} />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.heroTitle}>Mobile Protection Plan</Text>
              <Text style={styles.heroSub}>Mobix Premium Device Coverage</Text>
            </View>
            {subActive && (
              <View style={styles.activeBadge}>
                <View style={styles.pulseDot} />
                <Text style={styles.activeText}>Active</Text>
              </View>
            )}
          </View>

          {subActive && validTill ? (
            <View style={styles.validRow}>
              <Ionicons name="calendar-outline" size={14} color={MUTED} />
              <Text style={styles.validText}>Valid till {validTill}</Text>
            </View>
          ) : (
            <View style={styles.priceRow}>
              <Text style={styles.price}>₹50</Text>
              <Text style={styles.pricePer}>/month</Text>
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>Save ₹500 on repairs</Text>
              </View>
            </View>
          )}
        </View>

        {/* Coverage */}
        <Text style={styles.sectionTitle}>What's Covered</Text>
        <View style={styles.coverageGrid}>
          {COVERAGE_ITEMS.map(item => (
            <View key={item.id} style={[styles.coverageItem, { backgroundColor: item.bg }]}>
              <View style={[styles.coverageIcon, { backgroundColor: item.color + '20' }]}>
                <Ionicons name={item.icon as any} size={20} color={item.color} />
              </View>
              <Text style={[styles.coverageLabel, { color: item.color }]} numberOfLines={2}>{item.label}</Text>
              {item.sub ? <Text style={styles.coverageSub}>{item.sub}</Text> : null}
            </View>
          ))}
        </View>

        {/* Benefits */}
        <Text style={styles.sectionTitle}>Why Choose Us</Text>
        <View style={styles.benefitsList}>
          {BENEFITS.map((b, i) => (
            <View key={i} style={styles.benefitRow}>
              <View style={[styles.benefitIcon, { backgroundColor: b.bg }]}>
                <Ionicons name={b.icon as any} size={18} color={b.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.benefitLabel}>{b.label}</Text>
                <Text style={styles.benefitSub}>{b.sub}</Text>
              </View>
              <Ionicons name="checkmark-circle" size={18} color={GREEN} />
            </View>
          ))}
        </View>

        {/* How it works */}
        <Text style={styles.sectionTitle}>How It Works</Text>
        <View style={styles.stepsCard}>
          {[
            { num: '1', label: 'Activate Plan', sub: 'Pay ₹50 to activate your protection' },
            { num: '2', label: 'Get Protected',  sub: 'Instant coverage for your device' },
            { num: '3', label: 'Book Repair',    sub: 'Get ₹500 off on any repair service' },
          ].map((s, i) => (
            <View key={i}>
              {i > 0 && <View style={{ height: 1, backgroundColor: '#F0F0F0', marginVertical: 12 }} />}
              <View style={styles.stepRow}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>{s.num}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepLabel}>{s.label}</Text>
                  <Text style={styles.stepSub}>{s.sub}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={[styles.bottomBar, { paddingBottom: bottomPad + 8 }]}>
        <Pressable
          style={({ pressed }) => [styles.ctaBtn, { opacity: pressed ? 0.9 : 1 }]}
          onPress={handleSubscribe}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <>
              <Ionicons name={subActive ? 'add-circle-outline' : 'shield-checkmark-outline'} size={20} color="#FFF" />
              <Text style={styles.ctaBtnText}>{subActive ? 'Extend Plan — ₹50/mo' : 'Activate Plan — ₹50/mo'}</Text>
            </>
          )}
        </Pressable>
        <Text style={styles.termsText}>Cancel anytime · No hidden charges</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  navBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, backgroundColor: BG,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: CARD, ...SHADOW,
    alignItems: 'center', justifyContent: 'center',
  },
  navTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: DARK },

  heroCard: {
    backgroundColor: CARD, borderRadius: 20, padding: 20, marginBottom: 24, ...SHADOW,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  heroIconWrap: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: PRIMARY,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
  },
  heroTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: DARK, marginBottom: 4 },
  heroSub:   { fontSize: 13, color: MUTED },
  activeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: GREEN_L, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  pulseDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: GREEN },
  activeText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: GREEN },
  validRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  validText: { fontSize: 13, color: MUTED },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  price: { fontSize: 28, fontFamily: 'Inter_700Bold', color: PRIMARY },
  pricePer: { fontSize: 14, color: MUTED, marginRight: 8 },
  discountBadge: { backgroundColor: PRIMARY_L, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  discountText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: PRIMARY },

  sectionTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: DARK, marginBottom: 12 },

  coverageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  coverageItem: {
    width: '47%', borderRadius: 14, padding: 14, gap: 8,
  },
  coverageIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  coverageLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', lineHeight: 18 },
  coverageSub: { fontSize: 11, color: MUTED },

  benefitsList: { backgroundColor: CARD, borderRadius: 16, marginBottom: 24, overflow: 'hidden', ...SHADOW },
  benefitRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  benefitIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  benefitLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: DARK, marginBottom: 2 },
  benefitSub:   { fontSize: 12, color: MUTED },

  stepsCard: { backgroundColor: CARD, borderRadius: 16, padding: 16, marginBottom: 24, ...SHADOW },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepNum: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: PRIMARY_L,
    alignItems: 'center', justifyContent: 'center',
  },
  stepNumText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: PRIMARY },
  stepLabel:   { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: DARK, marginBottom: 2 },
  stepSub:     { fontSize: 12, color: MUTED },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: CARD, paddingHorizontal: 16, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: '#F0F0F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 4,
    alignItems: 'center',
  },
  ctaBtn: {
    width: '100%', backgroundColor: PRIMARY, borderRadius: 16,
    paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
    marginBottom: 8,
  },
  ctaBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#FFF' },
  termsText: { fontSize: 12, color: MUTED },
});
