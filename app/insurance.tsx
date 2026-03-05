import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform, ScrollView, ActivityIndicator, Alert, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useApp } from '@/lib/context';
import { apiRequest, getApiUrl } from '@/lib/query-client';

const { width: SW } = Dimensions.get('window');

// ── Mobix Design System (Matching Home Screen) ──────────────────────────────
const PRIMARY_DARK = '#0F230F'; // Dark background-dark from HTML
const ACCENT_GREEN = '#06F906'; // Primary green from HTML
const LIGHT_BG     = '#F5F8F5'; // Background-light from HTML
const WHITE        = '#FFFFFF';
const SLATE_500    = '#64748B';
const SLATE_900    = '#0F172A';
// ─────────────────────────────────────────────────────────────────────────────

const COVERAGE_ITEMS = [
  { id: 'screen', label: 'Screen Damage', sub: '(1 Free)' },
  { id: 'liquid', label: 'Accidental Liquid Damage' },
  { id: 'hardware', label: 'Hardware Malfunctions' },
  { id: 'pickup', label: 'Free Pickup & Drop' },
];

const BENEFITS = [
  { icon: 'people', label: 'Certified Techs', color: '#3B82F6', bg: '#EFF6FF' },
  { icon: 'hardware-chip', label: 'Genuine Parts', color: '#F59E0B', bg: '#FFFBEB' },
];

export default function InsuranceScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useApp();
  const [subActive, setSubActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

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
      const res = await apiRequest('POST', '/api/customer/subscription/create-order', {
        userId: profile.id,
        planId: 'premium', // Defaulting to the one in design
        amount: 199 * 100, // Matching the ₹199 from design
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
      url.searchParams.set('displayAmount', '199');
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
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={ACCENT_GREEN} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: subActive ? PRIMARY_DARK : LIGHT_BG }]}>
      {/* ── Top Bar ────────────────────────────────────────────── */}
      <View style={[styles.navBar, { paddingTop: topInset, backgroundColor: subActive ? PRIMARY_DARK : WHITE }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={subActive ? WHITE : SLATE_900} />
        </Pressable>
        <Text style={[styles.navTitle, { color: subActive ? WHITE : SLATE_900 }]}>Protection Plan</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomPad + 120 }}>
        {/* ── Header Card ───────────────────────────────────────── */}
        <View style={styles.headerSection}>
          <View style={[styles.mainCard, { backgroundColor: subActive ? '#1D401D' : WHITE }]}>
            {/* Active Badge */}
            {subActive && (
              <View style={styles.activeBadge}>
                <View style={styles.pulseDot} />
                <Text style={styles.activeText}>Active</Text>
              </View>
            )}

            {/* Visual Hero */}
            <View style={styles.heroWrap}>
              <Image 
                source={{ uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuAJohRWnQFyaBgFCNED57sA9-r3mghsT0kDgjH2asGNPfSIsMw0ECB4VN5nvxMSRKf5JjQ8pex0eH24VzIpq8VZmdddxCx2IObrTl2Ef0ve5O6oWr22s-xQ47k-eDGSnrqWbEXWDLauXMwgkLS6M02tEM00ub2OsuGTYrkh_CZ7T7-_0My3SbtaHqQA1R735aw83V7jbSywlw3tv6XMgOShue1i_Fprz2N-TbFDQR8jYkiGMeBnzM_7kAXttRrTgSWf-qU45rjfv4g" }} 
                style={styles.heroImg}
                contentFit="cover"
              />
              <View style={styles.heroOverlay} />
              <View style={styles.shieldWrap}>
                <Ionicons name="shield-checkmark" size={32} color={ACCENT_GREEN} />
              </View>
            </View>

            <View style={styles.cardContent}>
              <Text style={[styles.planTitle, { color: subActive ? WHITE : SLATE_900 }]}>All-Round Protection</Text>
              <Text style={[styles.planSub, { color: subActive ? '#8ECC8E' : SLATE_500 }]}>
                Mobix Premium Device Coverage
              </Text>
            </View>
          </View>
        </View>

        {/* ── Coverage Items ────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: subActive ? WHITE : SLATE_900 }]}>Coverage Items</Text>
          <View style={styles.itemList}>
            {COVERAGE_ITEMS.map(item => (
              <View key={item.id} style={styles.itemRow}>
                <View style={styles.checkWrap}>
                  <Ionicons name="checkmark" size={14} color={ACCENT_GREEN} strokeWidth={4} />
                </View>
                <Text style={[styles.itemLabel, { color: subActive ? WHITE : SLATE_900 }]}>
                  {item.label} {item.sub && <Text style={styles.itemSubLabel}>{item.sub}</Text>}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Plan Benefits ─────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: subActive ? WHITE : SLATE_900 }]}>Plan Benefits</Text>
          <View style={styles.benefitGrid}>
            {BENEFITS.map(b => (
              <View key={b.label} style={[styles.benefitCard, { backgroundColor: subActive ? '#1D401D' : '#F8FAFC' }]}>
                <View style={[styles.benefitIcon, { backgroundColor: subActive ? 'rgba(59,130,246,0.1)' : b.bg }]}>
                  <Ionicons name={b.icon as any} size={20} color={b.color} />
                </View>
                <Text style={[styles.benefitLabel, { color: subActive ? WHITE : SLATE_900 }]}>{b.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Footer Link ───────────────────────────────────────── */}
        {!subActive && (
          <View style={styles.termsWrap}>
             <Text style={styles.termsText}>Pay ₹199 Get complete coverage on repair</Text>
          </View>
        )}
      </ScrollView>

      {/* ── Sticky Bottom Bar ──────────────────────────────────── */}
      <View style={[styles.bottomBar, { paddingBottom: bottomPad, backgroundColor: subActive ? 'rgba(21,46,21,0.9)' : 'rgba(255,255,255,0.9)' }]}>
        <Pressable
          style={({ pressed }) => [styles.mainBtn, { opacity: pressed ? 0.9 : 1 }]}
          onPress={handleSubscribe}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={PRIMARY_DARK} size="small" />
          ) : (
            <>
              <Ionicons name={subActive ? "add-circle" : "shield-checkmark"} size={22} color={PRIMARY_DARK} />
              <Text style={styles.mainBtnText}>{subActive ? 'Extend Plan' : 'Activate Plan'}</Text>
            </>
          )}
        </Pressable>
        <Pressable onPress={() => {}}>
          <Text style={styles.termsLink}>View Terms & Conditions</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
  backBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', flex: 1, textAlign: 'center' },

  headerSection: { padding: 16 },
  mainCard: { borderRadius: 24, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  activeBadge: { position: 'absolute', top: 16, right: 16, zIndex: 10, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(6,249,6,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(6,249,6,0.3)' },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT_GREEN },
  activeText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: ACCENT_GREEN },

  heroWrap: { width: '100%', height: 200, position: 'relative' },
  heroImg: { width: '100%', height: '100%' },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  shieldWrap: { position: 'absolute', bottom: 20, alignSelf: 'center', width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(6,249,6,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: ACCENT_GREEN },

  cardContent: { padding: 20, alignItems: 'center' },
  planTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  planSub: { fontSize: 14, fontFamily: 'Inter_500Medium' },

  section: { paddingHorizontal: 20, paddingTop: 24 },
  sectionTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)', paddingBottom: 8 },
  itemList: { gap: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  checkWrap: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(6,249,6,0.2)', alignItems: 'center', justifyContent: 'center' },
  itemLabel: { fontSize: 16, fontFamily: 'Inter_500Medium' },
  itemSubLabel: { color: SLATE_500, fontSize: 14 },

  benefitGrid: { flexDirection: 'row', gap: 16 },
  benefitCard: { flex: 1, padding: 20, borderRadius: 20, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  benefitIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  benefitLabel: { fontSize: 14, fontFamily: 'Inter_700Bold' },

  termsWrap: { padding: 20, alignItems: 'center' },
  termsText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: SLATE_500 },

  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 16, paddingHorizontal: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', alignItems: 'center', width: '100%' },
  mainBtn: { width: '100%', backgroundColor: ACCENT_GREEN, borderRadius: 30, paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, shadowColor: ACCENT_GREEN, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 8 },
  mainBtnText: { color: PRIMARY_DARK, fontSize: 18, fontFamily: 'Inter_700Bold' },
  termsLink: { fontSize: 12, color: SLATE_500, marginTop: 12, textDecorationLine: 'underline' },
});
