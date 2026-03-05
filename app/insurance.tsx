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

const PRIMARY = '#FF6B2C';
const BG      = '#F5F7FA';
const CARD    = '#FFFFFF';
const DARK    = '#1A1A2E';
const GRAY    = '#8E8E93';
const PURPLE  = '#AF52DE';

const PLANS = [
  {
    id: 'basic',
    name: 'Basic Shield',
    price: 99,
    period: 'month',
    color: '#4F8EF7',
    gradient: ['#4F8EF7', '#3B7DEA'],
    features: [
      'Screen damage coverage',
      'Up to ₹2,000 repair discount',
      '1 claim per month',
      'Standard support',
    ],
  },
  {
    id: 'premium',
    name: 'Premium Guard',
    price: 199,
    period: 'month',
    color: PRIMARY,
    gradient: [PRIMARY, '#E85A1A'],
    popular: true,
    features: [
      'All hardware damage coverage',
      'Up to ₹5,000 repair discount',
      '3 claims per month',
      'Priority support',
      'Free pickup & drop',
    ],
  },
  {
    id: 'ultra',
    name: 'Ultra Protect',
    price: 399,
    period: 'month',
    color: PURPLE,
    gradient: [PURPLE, '#9B3BC8'],
    features: [
      'Complete device coverage',
      'Up to ₹15,000 repair discount',
      'Unlimited claims',
      '24/7 priority support',
      'Free pickup & drop',
      'Water damage included',
    ],
  },
];

const FAQS = [
  { q: 'When does coverage start?', a: 'Coverage begins immediately after payment confirmation.' },
  { q: 'Can I cancel anytime?', a: 'Yes, you can cancel before next billing cycle. No refunds for current month.' },
  { q: 'How do I file a claim?', a: 'Go to Orders → Active Insurance → File Claim, or call our support.' },
  { q: 'Are refurbished phones covered?', a: 'Yes, all phones regardless of condition are covered under our plans.' },
];

export default function InsuranceScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useApp();
  const [selected, setSelected] = useState('premium');
  const [subActive, setSubActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  const topInset  = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom + 20;

  const checkSub = useCallback(async () => {
    if (!profile?.id) { setChecking(false); return; }
    try {
      const res = await apiRequest('GET', `/api/subscription/status/${profile.id}`);
      const data = await res.json();
      setSubActive(data.active === true);
    } catch { setSubActive(false); }
    finally { setChecking(false); }
  }, [profile?.id]);

  useEffect(() => { checkSub(); }, [checkSub]);

  const handleSubscribe = async () => {
    if (!profile?.id) { router.push('/onboarding'); return; }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      const plan = PLANS.find(p => p.id === selected)!;
      const res = await apiRequest('POST', '/api/customer/subscription/create-order', {
        userId: profile.id,
        planId: selected,
        amount: plan.price * 100,
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
      url.searchParams.set('displayAmount', String(plan.price));
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

  const selectedPlan = PLANS.find(p => p.id === selected)!;

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.navBar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={DARK} />
        </Pressable>
        <Text style={styles.navTitle}>Phone Insurance</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 100 }]}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="shield-checkmark" size={40} color={PRIMARY} />
          </View>
          <Text style={styles.heroTitle}>Protect Your Phone</Text>
          <Text style={styles.heroSub}>Comprehensive coverage against damage, breakdowns & more</Text>
        </View>

        {/* Active badge */}
        {subActive && (
          <View style={styles.activeBanner}>
            <Ionicons name="checkmark-circle" size={20} color="#34C759" />
            <Text style={styles.activeBannerText}>You have an active insurance plan!</Text>
          </View>
        )}

        {/* Plans */}
        <Text style={styles.sectionTitle}>Choose Your Plan</Text>
        {PLANS.map(plan => (
          <Pressable
            key={plan.id}
            style={[styles.planCard, selected === plan.id && { borderColor: plan.color, borderWidth: 2 }]}
            onPress={() => setSelected(plan.id)}
          >
            {plan.popular && (
              <View style={[styles.popularBadge, { backgroundColor: plan.color }]}>
                <Text style={styles.popularText}>Most Popular</Text>
              </View>
            )}
            <View style={styles.planHeader}>
              <View style={[styles.planIconWrap, { backgroundColor: plan.color + '18' }]}>
                <Ionicons name="shield" size={22} color={plan.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.planName}>{plan.name}</Text>
                <View style={styles.planPriceRow}>
                  <Text style={[styles.planPrice, { color: plan.color }]}>₹{plan.price}</Text>
                  <Text style={styles.planPeriod}>/{plan.period}</Text>
                </View>
              </View>
              <View style={[styles.radioOuter, selected === plan.id && { borderColor: plan.color }]}>
                {selected === plan.id && <View style={[styles.radioInner, { backgroundColor: plan.color }]} />}
              </View>
            </View>
            <View style={styles.planFeatures}>
              {plan.features.map(f => (
                <View key={f} style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={15} color={plan.color} />
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}
            </View>
          </Pressable>
        ))}

        {/* Trust badges */}
        <Text style={styles.sectionTitle}>Why Choose Us?</Text>
        <View style={styles.trustGrid}>
          {[
            { icon: 'shield-half', label: 'Trusted by 50K+', sub: 'customers across India' },
            { icon: 'flash',       label: 'Instant Claims', sub: 'processed in 24 hrs'     },
            { icon: 'wallet',      label: 'No Hidden Fees', sub: 'transparent pricing'     },
            { icon: 'headset',     label: '24/7 Support',   sub: 'always here to help'     },
          ].map(t => (
            <View key={t.label} style={styles.trustCard}>
              <View style={styles.trustIcon}>
                <Ionicons name={t.icon as any} size={22} color={PRIMARY} />
              </View>
              <Text style={styles.trustLabel}>{t.label}</Text>
              <Text style={styles.trustSub}>{t.sub}</Text>
            </View>
          ))}
        </View>

        {/* FAQ */}
        <Text style={styles.sectionTitle}>FAQs</Text>
        <View style={styles.faqCard}>
          {FAQS.map((faq, i) => (
            <View key={faq.q} style={[styles.faqItem, i < FAQS.length - 1 && styles.faqItemBorder]}>
              <Pressable style={styles.faqQuestion} onPress={() => setExpandedFaq(expandedFaq === faq.q ? null : faq.q)}>
                <Text style={styles.faqQ}>{faq.q}</Text>
                <Ionicons name={expandedFaq === faq.q ? 'chevron-up' : 'chevron-down'} size={16} color={GRAY} />
              </Pressable>
              {expandedFaq === faq.q && (
                <Text style={styles.faqA}>{faq.a}</Text>
              )}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* CTA */}
      <View style={[styles.ctaBar, { paddingBottom: bottomPad }]}>
        <View>
          <Text style={styles.ctaLabel}>{selectedPlan.name}</Text>
          <Text style={styles.ctaPrice}>₹{selectedPlan.price}<Text style={styles.ctaPeriod}>/{selectedPlan.period}</Text></Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.ctaBtn, { backgroundColor: selectedPlan.color, opacity: pressed ? 0.9 : 1 }]}
          onPress={handleSubscribe}
          disabled={loading || checking}
        >
          {loading || checking
            ? <ActivityIndicator color="#FFF" size="small" />
            : <>
                <Text style={styles.ctaBtnText}>{subActive ? 'Upgrade Plan' : 'Get Protected'}</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFF" />
              </>
          }
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  navTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: DARK },
  content: { paddingHorizontal: 16, paddingTop: 4 },
  hero: { alignItems: 'center', paddingVertical: 20, marginBottom: 4 },
  heroIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: PRIMARY + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  heroTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', color: DARK, marginBottom: 6 },
  heroSub: { fontSize: 14, fontFamily: 'Inter_400Regular', color: GRAY, textAlign: 'center', paddingHorizontal: 24 },
  activeBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EAF7EE', borderRadius: 12, padding: 14, marginBottom: 20 },
  activeBannerText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#34C759' },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: DARK, marginBottom: 12, marginTop: 4 },
  planCard: { backgroundColor: CARD, borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1.5, borderColor: 'transparent', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2, position: 'relative', overflow: 'hidden' },
  popularBadge: { position: 'absolute', top: 0, right: 0, paddingHorizontal: 14, paddingVertical: 5, borderBottomLeftRadius: 12 },
  popularText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#FFF' },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  planIconWrap: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  planName: { fontSize: 16, fontFamily: 'Inter_700Bold', color: DARK, marginBottom: 2 },
  planPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  planPrice: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  planPeriod: { fontSize: 14, fontFamily: 'Inter_400Regular', color: GRAY },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#D1D1D6', alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 12, height: 12, borderRadius: 6 },
  planFeatures: { gap: 8 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: DARK },
  trustGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  trustCard: { width: '47%', backgroundColor: CARD, borderRadius: 14, padding: 14, alignItems: 'center', gap: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },
  trustIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: PRIMARY + '15', alignItems: 'center', justifyContent: 'center' },
  trustLabel: { fontSize: 13, fontFamily: 'Inter_700Bold', color: DARK },
  trustSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: GRAY, textAlign: 'center' },
  faqCard: { backgroundColor: CARD, borderRadius: 16, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, overflow: 'hidden' },
  faqItem: { padding: 16 },
  faqItemBorder: { borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  faqQuestion: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  faqQ: { flex: 1, fontSize: 14, fontFamily: 'Inter_600SemiBold', color: DARK, marginRight: 8 },
  faqA: { fontSize: 13, fontFamily: 'Inter_400Regular', color: GRAY, marginTop: 10, lineHeight: 20 },
  ctaBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: CARD, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F0F0F0', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 8 },
  ctaLabel: { fontSize: 12, fontFamily: 'Inter_400Regular', color: GRAY },
  ctaPrice: { fontSize: 20, fontFamily: 'Inter_700Bold', color: DARK },
  ctaPeriod: { fontSize: 13, fontFamily: 'Inter_400Regular', color: GRAY },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 20, paddingVertical: 14, gap: 8, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  ctaBtnText: { color: '#FFF', fontSize: 15, fontFamily: 'Inter_700Bold' },
});
