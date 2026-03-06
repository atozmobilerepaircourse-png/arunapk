import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform, Animated,
  ScrollView, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useApp } from '@/lib/context';
import { apiRequest } from '@/lib/query-client';

const { width: SW } = Dimensions.get('window');

// ── Mobix Design System ──────────────────────────────────────────────────────
const PRIMARY   = '#0F172A';   // dark navy
const GREEN     = '#00E676';   // electric green accent
const BG        = '#F8FAFC';   // very light blue-gray
const CARD      = '#FFFFFF';
const GRAY      = '#64748B';
const LGRAY     = '#94A3B8';
const RED       = '#FF3B30';   // SOS red
const INDIGO    = '#4F46E5';
const TEAL      = '#0D9488';
// ─────────────────────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { icon: 'scan-outline',  label: 'Quick\nScan',    color: PRIMARY, bg: '#EFF6FF', route: '/diagnose'     },
  { icon: 'construct',     label: 'Book\nRepair',   color: INDIGO,  bg: '#EEF2FF', route: '/select-brand' },
  { icon: 'flash-outline', label: 'SOS\nRepair',    color: RED,     bg: '#FFF5F5', route: '/select-brand', sos: true },
  { icon: 'cart-outline',  label: 'Buy\nAccessories', color: TEAL,    bg: '#F0FDFA', route: '/select-brand' },
];

const DIAGNOSTIC_ITEMS = [
  { icon: 'battery-full',   label: 'Battery',  status: 'Good',       color: '#22C55E' },
  { icon: 'volume-high',    label: 'Speaker',  status: 'Check',      color: '#F97316' },
  { icon: 'camera',         label: 'Camera',   status: 'Perfect',    color: '#22C55E' },
];

const ACCESSORIES = [
  { name: 'Pro Wireless\nEarbuds', price: '₹1,299', badge: '20% OFF', image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAIVVPtzwdulVXPy7yzJlXqFzlPCaBN2pU5AifrL2mPbxKcbU9cs4bxFL6bH0Gm8Cc_jAGR1eIEEBfMV5w80ziW-BSe21THSjQYYarALROQZrL6z8LlRIGNQ0FYN47Nf2T-UiDmfs6D4pAHFHOJpI5A5jBTR-gFZaHVFyQEy5L2dx2_VpD9mWyMbiwuqAT_jlhenClSfyH4TLMIH4-I5GE2qxilyMn8aFtCAHIPxoBVkFSS79gkAhg6zM4aVyg31OQYOpw0B2XocHQ' },
  { name: '20W Fast\nCharger',     price: '₹499',   badge: null,       image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB8QAuHcipFUyWkPruHXlMR-p-n72uSUX3l8Cgtqg86qxKn0OOnQvfAnwahEcpa-qZT_qW-f23tQqCC7AG8gk90N9_eWWbDbyLadC-Py9zgqyHGKS-qnKjd3c-8kHkKXU0zPbVOHff3taum--zarN-D6JFdQSOcTuFr0UDYcNvejc46xPt_PWySWeBPZuEQywNWu--M9cLFVxvldYtOwQPVrHTcAxSl9MQPe7gk826K2LUE0S-Nc0K1mfwGDJerOrLx6qufZZpByvQ'   },
  { name: 'Silicone\nCase',        price: '₹299',   badge: 'Trending', image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBo_29p3nC8Px555oTL_usbZvHcG1jNLRhCbZGpsHICxUEcNkbZmshzBsnQ3FdZUpYucMCEm4GixZP1Qqffo7p7zwR-6ch9cfJJvg2RmoKK2ycAJqqK5TwL2UUucCFv-AM1bo73f7QxyFQZ0n_wBCWlZ656vj_LAMPU75u2lMMzFFD1Nn0yoqVTgmvfdhtU3Jm3X1-hpVw7bJAOYVFeoLLUs4CqZ6y60lhi5N9knV894GgVG_R-chmXF57HKgih4-cHXEyEYofv9kY' },
];

const HEALTH_SCORE = 92;

export default function CustomerHomeScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useApp();
  const [onlineTechs, setOnlineTechs] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const pulse = useRef(new Animated.Value(1)).current;

  const topInset  = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 84 + 34 : 104;
  const firstName = profile?.name?.split(' ')[0] || 'there';

  // Pulse animation for SOS badge
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.2, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await apiRequest('GET', '/api/profiles?role=technician&limit=6');
      const data = await res.json();
      setOnlineTechs((data.profiles || data || []).slice(0, 4));
    } catch { setOnlineTechs([]); }
    try {
      if (profile?.id) {
        const res = await apiRequest('GET', `/api/orders?buyerId=${profile.id}`);
        const data = await res.json();
        setRecentOrders(Array.isArray(data) ? data.slice(0, 2) : []);
      }
    } catch { setRecentOrders([]); }
  }, [profile?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const press = (route: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(route as any);
  };

  // Health score ring percentage
  const circumference = 2 * Math.PI * 32;
  const strokeOffset = circumference - (HEALTH_SCORE / 100) * circumference;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: topInset + 8, paddingBottom: bottomPad }]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ──────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Welcome back,</Text>
          <Text style={styles.nameText}>{firstName}</Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable style={styles.notifBtn} onPress={() => {}}>
            <Ionicons name="notifications-outline" size={22} color={PRIMARY} />
            <View style={styles.notifDot} />
          </Pressable>
          <Pressable onPress={() => router.push('/(tabs)/profile' as any)}>
            <Image 
              source={{ uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuCMpOKrRB5AaApxTvKi1T3Au_7jDAsGIjstWXNrQNsc47quhFR2byJ1I9oHc2NnFk2h_h5E20_3woQFxPrjuXjKjTMZ7EK54XEOs01CN7WJHJB84dxcVsWqBWRo7_inTrPvoQyBXL7TQtzWX7xv0dFkHmJ6QJnq5IUw-DGC87wNOM766bK1LpGnr5nksnotGNgWVZUYjfgmM68JXaB2G832mR58eOwvJZiQD5Je4y7ZLfiie8IaCS1a51JhpKbRMddZw5P2D8R1YUA" }} 
              style={styles.avatar} 
              contentFit="cover" 
            />
          </Pressable>
        </View>
      </View>

      {/* ── Device Health Card ───────────────────────────────────── */}
      <View style={styles.deviceCard}>
        {/* Glow circles */}
        <View style={styles.glowTopRight} />
        <View style={styles.glowBottomLeft} />

        <View style={styles.deviceCardTop}>
          <View style={{ flex: 1 }}>
            <View style={styles.autoDetectBadge}>
              <Animated.View style={[styles.pulseDot, { transform: [{ scale: pulse }] }]} />
              <Text style={styles.autoDetectText}>AUTO-DETECTED</Text>
            </View>
            <Text style={styles.deviceName}>
              {profile?.device || 'Your Device'}
            </Text>
            <Text style={styles.deviceSub}>
              {profile?.city ? `${profile.city} · ` : ''}Active Plan
            </Text>
          </View>
          {/* Health Score Ring */}
          <View style={styles.scoreWrap}>
            <View style={styles.scoreRingOuter}>
              <Text style={styles.scoreNumber}>{HEALTH_SCORE}</Text>
            </View>
            <Text style={styles.scoreLabel}>Health</Text>
          </View>
        </View>

        <View style={styles.deviceCardBottom}>
          <View style={styles.greenDotIcon}>
            <Ionicons name="shield-checkmark" size={16} color={GREEN} />
          </View>
          <View>
            <Text style={styles.conditionTitle}>Excellent Condition</Text>
            <Text style={styles.conditionSub}>Battery health at 98%</Text>
          </View>
        </View>
      </View>

      {/* ── Quick Actions (4-column) ─────────────────────────────── */}
      <View style={styles.quickRow}>
        {QUICK_ACTIONS.map((a) => (
          <Pressable
            key={a.label}
            style={({ pressed }) => [styles.quickItem, { opacity: pressed ? 0.8 : 1 }]}
            onPress={() => press(a.route)}
          >
            <View style={[styles.quickIconBox, { backgroundColor: a.bg }]}>
              <Ionicons name={a.icon as any} size={24} color={a.color} />
              {a.sos && (
                <Animated.View style={[styles.sosBadge, { transform: [{ scale: pulse }] }]} />
              )}
            </View>
            <Text style={[styles.quickLabel, a.sos && { color: RED, fontFamily: 'Inter_700Bold' }]}>
              {a.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── Diagnostic Health Card ───────────────────────────────── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Diagnostic Health</Text>
          <Pressable onPress={() => press('/diagnose')} style={styles.detailsBtn}>
            <Text style={styles.detailsBtnText}>Details</Text>
            <Ionicons name="chevron-forward" size={14} color={PRIMARY} />
          </Pressable>
        </View>
        <View style={styles.diagGrid}>
          {DIAGNOSTIC_ITEMS.map(d => (
            <View key={d.label} style={styles.diagItem}>
              <Ionicons name={d.icon as any} size={20} color={d.color} />
              <Text style={styles.diagLabel}>{d.label}</Text>
              <Text style={[styles.diagStatus, { color: d.color }]}>{d.status}</Text>
            </View>
          ))}
        </View>
        <Pressable
          style={({ pressed }) => [styles.diagBtn, { opacity: pressed ? 0.9 : 1 }]}
          onPress={() => press('/diagnose')}
        >
          <Ionicons name="analytics" size={18} color={GREEN} />
          <Text style={styles.diagBtnText}>Run Full Diagnostics</Text>
        </Pressable>
      </View>

      {/* ── Mobix Shield Banner ──────────────────────────────────── */}
      <Pressable
        style={({ pressed }) => [styles.shieldBanner, { opacity: pressed ? 0.95 : 1 }]}
        onPress={() => press('/insurance')}
      >
        <View style={styles.shieldGlow} />
        <View style={styles.shieldLeft}>
          <Text style={styles.shieldSubtitle}>MOBIX SHIELD</Text>
          <Text style={styles.shieldTitle}>Protection Plan</Text>
          <Text style={styles.shieldDesc}>Cover accidental damages from ₹199/yr</Text>
          <View style={styles.shieldBtn}>
            <Text style={styles.shieldBtnText}>View Plans</Text>
          </View>
        </View>
        <View style={styles.shieldIconWrap}>
          <Ionicons name="shield" size={64} color={GREEN + 'CC'} />
        </View>
      </Pressable>

      {/* ── Nearby Technicians ───────────────────────────────────── */}
      {onlineTechs.length > 0 && (
        <>
          <View style={styles.sectionRow}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.sectionTitle}>Technicians Online</Text>
            </View>
            <Pressable onPress={() => router.push('/(tabs)/directory' as any)}>
              <Text style={styles.seeAll}>See All</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.techScroll}>
            {onlineTechs.map(t => (
              <Pressable
                key={t.id}
                style={({ pressed }) => [styles.techCard, { opacity: pressed ? 0.9 : 1 }]}
                onPress={() => router.push({ pathname: '/user-profile', params: { id: t.id } } as any)}
              >
                {t.avatar ? (
                  <Image source={{ uri: t.avatar }} style={styles.techAvatar} contentFit="cover" />
                ) : (
                  <View style={[styles.techAvatar, styles.techAvatarFallback]}>
                    <Text style={styles.techAvatarLetter}>{(t.name || 'T')[0].toUpperCase()}</Text>
                  </View>
                )}
                <View style={styles.techOnlineBadge} />
                <Text style={styles.techName} numberOfLines={1}>{(t.name || '').split(' ')[0]}</Text>
                <View style={styles.techRatingRow}>
                  <Ionicons name="star" size={10} color="#F59E0B" />
                  <Text style={styles.techRating}>4.9</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}

      {/* ── Trending Accessories ─────────────────────────────────── */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Trending Accessories</Text>
        <Pressable onPress={() => {}}>
          <Text style={styles.seeAll}>See All</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accScroll}>
        {ACCESSORIES.map(a => (
          <Pressable
            key={a.name}
            style={({ pressed }) => [styles.accCard, { opacity: pressed ? 0.88 : 1 }]}
            onPress={() => {}}
          >
            <View style={styles.accImgBox}>
              {a.badge && (
                <View style={styles.accBadge}>
                  <Text style={styles.accBadgeText}>{a.badge}</Text>
                </View>
              )}
              {a.image ? (
                <Image source={{ uri: a.image }} style={styles.accImage} contentFit="contain" />
              ) : (
                <View style={styles.accIconWrap}>
                  <Ionicons name="cube-outline" size={36} color={LGRAY} />
                </View>
              )}
            </View>
            <Text style={styles.accName}>{a.name}</Text>
            <View style={styles.accBottom}>
              <Text style={styles.accPrice}>{a.price}</Text>
              <View style={styles.accAddBtn}>
                <Ionicons name="add" size={14} color={GRAY} />
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      {/* ── Recent Orders ────────────────────────────────────────── */}
      {recentOrders.length > 0 && (
        <>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Recent Repairs</Text>
            <Pressable onPress={() => router.push('/(tabs)/orders' as any)}>
              <Text style={styles.seeAll}>See All</Text>
            </Pressable>
          </View>
          <View style={styles.ordersCard}>
            {recentOrders.map((o, i) => (
              <View key={o.id} style={[styles.orderRow, i < recentOrders.length - 1 && styles.orderRowBorder]}>
                <View style={[styles.orderDot, { backgroundColor: o.status === 'completed' ? '#22C55E' : GREEN }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderTitle} numberOfLines={1}>{o.productTitle || 'Repair Order'}</Text>
                  <Text style={styles.orderStatus}>{o.status || 'Pending'}</Text>
                </View>
                <Text style={styles.orderPrice}>₹{o.productPrice || '--'}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* ── Book CTA strip ───────────────────────────────────────── */}
      <Pressable
        style={({ pressed }) => [styles.ctaStrip, { opacity: pressed ? 0.92 : 1 }]}
        onPress={() => press('/select-brand')}
      >
        <View>
          <Text style={styles.ctaTitle}>Doorstep Repair</Text>
          <Text style={styles.ctaSub}>Certified experts come to you</Text>
        </View>
        <View style={styles.ctaBtn}>
          <Text style={styles.ctaBtnText}>Book Now</Text>
          <Ionicons name="arrow-forward" size={14} color={PRIMARY} />
        </View>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  content: { paddingHorizontal: 16 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  welcomeText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: GRAY },
  nameText: { fontSize: 22, fontFamily: 'Inter_700Bold', color: PRIMARY, marginTop: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  notifBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2, position: 'relative' },
  notifDot: { position: 'absolute', top: 9, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: RED, borderWidth: 1.5, borderColor: CARD },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#E2E8F0' },
  avatarFallback: { backgroundColor: PRIMARY + '18', alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 16, fontFamily: 'Inter_700Bold', color: PRIMARY },

  // Device Card
  deviceCard: { backgroundColor: '#1E293B', borderRadius: 28, padding: 24, marginBottom: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },
  glowTopRight: { position: 'absolute', top: -40, right: -40, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.05)' },
  glowBottomLeft: { position: 'absolute', bottom: -40, left: -40, width: 120, height: 120, borderRadius: 60, backgroundColor: GREEN + '10' },
  deviceCardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
  autoDetectBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 12, alignSelf: 'flex-start' },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN },
  autoDetectText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#CBD5E1', letterSpacing: 1.2 },
  deviceName: { fontSize: 24, fontFamily: 'Inter_700Bold', color: CARD, marginBottom: 4 },
  deviceSub: { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#94A3B8' },
  scoreWrap: { alignItems: 'center', gap: 6 },
  scoreRingOuter: { width: 72, height: 72, borderRadius: 36, borderWidth: 5, borderColor: GREEN, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,230,118,0.1)' },
  scoreNumber: { fontSize: 24, fontFamily: 'Inter_700Bold', color: GREEN },
  scoreLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#64748B' },
  deviceCardBottom: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  greenDotIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,230,118,0.15)', alignItems: 'center', justifyContent: 'center' },
  conditionTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: CARD },
  conditionSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#94A3B8', marginTop: 2 },

  // Quick Actions
  quickRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, paddingHorizontal: 4 },
  quickItem: { alignItems: 'center', width: (SW - 48) / 4 },
  quickIconBox: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 8, position: 'relative', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  sosBadge: { position: 'absolute', top: -4, right: -4, width: 12, height: 12, borderRadius: 6, backgroundColor: RED, borderWidth: 2, borderColor: BG },
  quickLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#475569', textAlign: 'center', lineHeight: 16 },

  // Diagnostic Health Card
  card: { backgroundColor: CARD, borderRadius: 24, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 4 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  cardTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: PRIMARY },
  detailsBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailsBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: PRIMARY },
  diagGrid: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  diagItem: { flex: 1, backgroundColor: '#F1F5F9', borderRadius: 16, padding: 16, alignItems: 'center', gap: 6 },
  diagLabel: { fontSize: 13, fontFamily: 'Inter_700Bold', color: PRIMARY },
  diagStatus: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  diagBtn: { backgroundColor: PRIMARY, borderRadius: 18, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 6 },
  diagBtnText: { color: CARD, fontSize: 15, fontFamily: 'Inter_700Bold' },

  // Shield Banner
  shieldBanner: { backgroundColor: '#1E293B', borderRadius: 28, padding: 24, marginBottom: 24, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },
  shieldGlow: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '60%', backgroundColor: 'rgba(0,230,118,0.08)' },
  shieldLeft: { flex: 1, zIndex: 1 },
  shieldSubtitle: { fontSize: 11, fontFamily: 'Inter_800ExtraBold', color: GREEN, letterSpacing: 1.5, marginBottom: 6, textTransform: 'uppercase' },
  shieldTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: CARD, marginBottom: 6 },
  shieldDesc: { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#94A3B8', marginBottom: 16 },
  shieldBtn: { backgroundColor: CARD, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24, alignSelf: 'flex-start', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  shieldBtnText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: PRIMARY },
  shieldIconWrap: { zIndex: 1, marginLeft: 10 },

  // Section
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: PRIMARY },
  seeAll: { fontSize: 13, fontFamily: 'Inter_500Medium', color: GRAY },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN },

  // Technicians
  techScroll: { gap: 12, paddingRight: 4, paddingBottom: 4, marginBottom: 20 },
  techCard: { width: 90, backgroundColor: CARD, borderRadius: 16, padding: 12, alignItems: 'center', position: 'relative', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  techAvatar: { width: 50, height: 50, borderRadius: 25, marginBottom: 6 },
  techAvatarFallback: { backgroundColor: PRIMARY + '18', alignItems: 'center', justifyContent: 'center' },
  techAvatarLetter: { fontSize: 18, fontFamily: 'Inter_700Bold', color: PRIMARY },
  techOnlineBadge: { position: 'absolute', top: 34, right: 22, width: 10, height: 10, borderRadius: 5, backgroundColor: GREEN, borderWidth: 2, borderColor: CARD },
  techName: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: PRIMARY },
  techRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 3 },
  techRating: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#F59E0B' },

  // Accessories
  accScroll: { gap: 10, paddingRight: 4, paddingBottom: 4, marginBottom: 20 },
  accCard: { width: 140, backgroundColor: CARD, borderRadius: 16, padding: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 1 },
  accImgBox: { height: 90, backgroundColor: BG, borderRadius: 12, marginBottom: 10, alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' },
  accImage: { width: '80%', height: '80%' },
  accBadge: { position: 'absolute', top: 6, left: 6, backgroundColor: GREEN, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, zIndex: 1 },
  accBadgeText: { fontSize: 9, fontFamily: 'Inter_700Bold', color: PRIMARY },
  accIconWrap: { opacity: 0.4 },
  accName: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: PRIMARY, marginBottom: 6, lineHeight: 16 },
  accBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  accPrice: { fontSize: 15, fontFamily: 'Inter_700Bold', color: PRIMARY },
  accAddBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },

  // Orders
  ordersCard: { backgroundColor: CARD, borderRadius: 16, overflow: 'hidden', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  orderRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  orderRowBorder: { borderBottomWidth: 1, borderBottomColor: BG },
  orderDot: { width: 8, height: 8, borderRadius: 4 },
  orderTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: PRIMARY },
  orderStatus: { fontSize: 12, fontFamily: 'Inter_400Regular', color: GRAY, marginTop: 2, textTransform: 'capitalize' as const },
  orderPrice: { fontSize: 15, fontFamily: 'Inter_700Bold', color: PRIMARY },

  // CTA Strip
  ctaStrip: { backgroundColor: GREEN, borderRadius: 20, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ctaTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: PRIMARY, marginBottom: 2 },
  ctaSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: PRIMARY + 'AA' },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: CARD, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  ctaBtnText: { color: PRIMARY, fontSize: 13, fontFamily: 'Inter_700Bold' },
});
