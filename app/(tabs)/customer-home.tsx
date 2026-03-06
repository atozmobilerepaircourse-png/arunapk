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
import { ProgressRing } from '@/components/ProgressRing';

const { width: SW } = Dimensions.get('window');

// ── Mobix Design System ──────────────────────────────────────────────────────
const BG      = '#F8FAFC';
const CARD    = '#FFFFFF';
const NAVY    = '#0F172A';
const NAVY2   = '#1E293B';
const GREEN   = '#00E676';
const GRAY    = '#64748B';
const RED     = '#FF3B30';
const INDIGO  = '#4F46E5';
const PURPLE  = '#8B5CF6';
const TEAL    = '#0D9488';
const EMERALD = '#10B981';
const AMBER   = '#F59E0B';
const BLUE    = '#3B82F6';

const HEALTH_SCORE = 92;

const QUICK_ACTIONS = [
  { id: 'repair',    label: 'Repair',      icon: 'construct-outline',          color: INDIGO,  bg: '#EEF2FF',  route: '/select-brand'  },
  { id: 'sell',      label: 'Sell Phone',  icon: 'phone-portrait-outline',     color: PURPLE,  bg: '#F5F3FF',  route: '/buy-sell'      },
  { id: 'shop',      label: 'Shop',        icon: 'cart-outline',               color: TEAL,    bg: '#F0FDFA',  route: '/marketplace'   },
  { id: 'insurance', label: 'Insurance',   icon: 'shield-checkmark-outline',   color: EMERALD, bg: '#ECFDF5',  route: '/insurance'     },
];

const DIAGNOSE_STATS = [
  { icon: 'battery-charging-outline', label: 'Battery',  val: '98%',   color: GREEN    },
  { icon: 'speedometer-outline',      label: 'CPU',      val: 'Good',  color: '#4F8CFF' },
  { icon: 'cellular-outline',         label: 'Network',  val: '5G',    color: TEAL     },
  { icon: 'thermometer-outline',      label: 'Temp',     val: '37°C',  color: AMBER    },
];

export default function CustomerHomeScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useApp();
  const [techs, setTechs] = useState<any[]>([]);
  const pulse = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 84 + 34 : 104;
  const firstName = profile?.name?.split(' ')[0] || 'there';

  useEffect(() => {
    Animated.parallel([
      Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 1100, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0,  duration: 1100, useNativeDriver: true }),
      ])),
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  const fetchTechs = useCallback(async () => {
    try {
      const r = await apiRequest('GET', '/api/profiles?role=technician&limit=8');
      const data = await r.json();
      setTechs((data.profiles || data || []).slice(0, 5));
    } catch { setTechs([]); }
  }, []);
  useEffect(() => { fetchTechs(); }, [fetchTechs]);

  const go = (route: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(route as any);
  };

  return (
    <View style={s.root}>
      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingTop: topPad + 12, paddingBottom: botPad }]}>

        {/* ─ Header ─────────────────────────────────────────────── */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>Good day,</Text>
            <Text style={s.name}>{firstName} 👋</Text>
          </View>
          <View style={s.hRight}>
            <Pressable style={s.iconBtn} onPress={() => go('/notification-preferences')}>
              <Ionicons name="notifications-outline" size={21} color={NAVY} />
              <View style={s.badge} />
            </Pressable>
            <Pressable onPress={() => go('/(tabs)/profile')}>
              <Image
                source={{ uri: profile?.avatar || 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=100&h=100&fit=crop' }}
                style={s.avatar} contentFit="cover"
              />
            </Pressable>
          </View>
        </View>

        {/* ─ Hero Card — Device Health ──────────────────────────── */}
        <Animated.View style={[s.hero, { transform: [{ translateY: slideAnim }] }]}>
          {/* Glow blobs */}
          <View style={[s.blob, { right: -20, top: -20, backgroundColor: 'rgba(0,230,118,0.12)' }]} />
          <View style={[s.blob, { left: -30, bottom: -30, backgroundColor: 'rgba(79,140,255,0.08)', width: 120, height: 120, borderRadius: 60 }]} />

          <View style={s.heroTop}>
            <View style={{ flex: 1 }}>
              <View style={s.chip}>
                <Animated.View style={[s.chipDot, { transform: [{ scale: pulse }] }]} />
                <Text style={s.chipText}>AUTO-DETECTED</Text>
              </View>
              <Text style={s.deviceName} numberOfLines={1}>{profile?.device || 'iPhone 15 Pro'}</Text>
              <Text style={s.deviceSub}>Excellent Condition</Text>
            </View>

            {/* SVG ProgressRing */}
            <ProgressRing
              size={88}
              strokeWidth={9}
              progress={HEALTH_SCORE / 100}
              valueText={`${HEALTH_SCORE}`}
              label="Health"
              color={GREEN}
            />
          </View>

          {/* Diagnose stats row */}
          <View style={s.statsRow}>
            {DIAGNOSE_STATS.map(st => (
              <View key={st.label} style={s.statItem}>
                <Ionicons name={st.icon as any} size={14} color={st.color} />
                <Text style={s.statVal}>{st.val}</Text>
                <Text style={s.statLabel}>{st.label}</Text>
              </View>
            ))}
          </View>

          <View style={s.heroDivider} />
          <Pressable style={s.heroFooter} onPress={() => go('/diagnose')}>
            <Ionicons name="shield-checkmark" size={15} color={GREEN} />
            <Text style={s.heroFooterTxt}>Protected by Mobix Shield</Text>
            <Ionicons name="chevron-forward" size={13} color={GREEN} style={{ marginLeft: 'auto' }} />
          </Pressable>
        </Animated.View>

        {/* ─ Quick Actions ──────────────────────────────────────── */}
        <View style={s.qGrid}>
          {QUICK_ACTIONS.map(a => (
            <Pressable key={a.id} style={s.qCard} onPress={() => go(a.route)}>
              <View style={[s.qIcon, { backgroundColor: a.bg }]}>
                <Ionicons name={a.icon as any} size={26} color={a.color} />
              </View>
              <Text style={s.qLabel}>{a.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* ─ Mobix Shield Banner ────────────────────────────────── */}
        <Pressable style={s.banner} onPress={() => go('/insurance')}>
          <View style={s.bannerLeft}>
            <Text style={s.bannerEye}>MOBIX SHIELD</Text>
            <Text style={s.bannerTitle}>Total Device{'\n'}Protection</Text>
            <Text style={s.bannerDesc}>Screen, liquid & accidental damage covered</Text>
            <View style={s.bannerCTA}>
              <Text style={s.bannerCTAText}>View Plans</Text>
              <Ionicons name="arrow-forward" size={13} color={NAVY} />
            </View>
          </View>
          <View style={s.bannerRight}>
            <Ionicons name="shield-half" size={100} color="rgba(0,230,118,0.18)" />
          </View>
        </Pressable>

        {/* ─ Certified Technicians ──────────────────────────────── */}
        <View style={s.secRow}>
          <Text style={s.secTitle}>Certified Technicians</Text>
          <Pressable onPress={() => go('/(tabs)/directory')}>
            <Text style={s.seeAll}>See All</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.techScroll}>
          {techs.length > 0 ? techs.map(t => (
            <Pressable key={t.id} style={s.techCard}
              onPress={() => router.push({ pathname: '/user-profile', params: { id: t.id } } as any)}>
              <Image source={{ uri: t.avatar || 'https://i.pravatar.cc/150?u=' + t.id }} style={s.techAv} />
              <View style={s.onlineDot} />
              <Text style={s.techName} numberOfLines={1}>{t.name?.split(' ')[0]}</Text>
              <View style={s.ratingRow}>
                <Ionicons name="star" size={10} color={AMBER} />
                <Text style={s.ratingTxt}>4.9</Text>
              </View>
            </Pressable>
          )) : (
            <View style={s.emptyTech}>
              <Text style={s.emptyTxt}>Finding expert technicians…</Text>
            </View>
          )}
        </ScrollView>

        {/* ─ Diagnose My Device ─────────────────────────────────── */}
        <Pressable style={s.diagCard} onPress={() => go('/diagnose')}>
          <View style={s.diagLeft}>
            <Text style={s.diagTitle}>Run Full Diagnostics</Text>
            <Text style={s.diagDesc}>Check battery, screen, sensors & more</Text>
          </View>
          <View style={s.diagIcon}>
            <Ionicons name="medkit" size={28} color={INDIGO} />
          </View>
        </Pressable>

        {/* ─ Refer & Wallet ─────────────────────────────────────── */}
        <View style={s.earnRow}>
          <Pressable style={s.earnCard} onPress={() => go('/onboarding')}>
            <View style={[s.earnIcon, { backgroundColor: '#FFFBEB' }]}>
              <Ionicons name="gift" size={20} color={AMBER} />
            </View>
            <View>
              <Text style={s.earnTitle}>Refer & Earn</Text>
              <Text style={s.earnVal}>Get ₹100</Text>
            </View>
          </Pressable>
          <Pressable style={s.earnCard} onPress={() => go('/(tabs)/orders')}>
            <View style={[s.earnIcon, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="wallet" size={20} color={BLUE} />
            </View>
            <View>
              <Text style={s.earnTitle}>Mobi Wallet</Text>
              <Text style={s.earnVal}>₹250.00</Text>
            </View>
          </Pressable>
        </View>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: BG },
  scroll: { paddingHorizontal: 20 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  greeting: { fontSize: 13, fontFamily: 'Inter_400Regular', color: GRAY },
  name:     { fontSize: 26, fontFamily: 'Inter_700Bold',   color: NAVY,  marginTop: 2  },
  hRight:   { flexDirection: 'row', alignItems: 'center',  gap: 12 },
  iconBtn:  { width: 44, height: 44, borderRadius: 22, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2, position: 'relative' },
  badge:    { position: 'absolute', top: 11, right: 11, width: 9, height: 9, borderRadius: 5, backgroundColor: RED, borderWidth: 2, borderColor: CARD },
  avatar:   { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#FFF' },

  // Hero Card
  hero:     { backgroundColor: NAVY2, borderRadius: 32, padding: 24, marginBottom: 24, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.22, shadowRadius: 28, elevation: 14 },
  blob:     { position: 'absolute', width: 140, height: 140, borderRadius: 70 },
  heroTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  chip:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, alignSelf: 'flex-start', marginBottom: 12 },
  chipDot:  { width: 7, height: 7, borderRadius: 4, backgroundColor: GREEN },
  chipText: { fontSize: 9, fontFamily: 'Inter_700Bold', color: '#CBD5E1', letterSpacing: 1.2 },
  deviceName: { fontSize: 24, fontFamily: 'Inter_700Bold', color: '#FFF', marginBottom: 4, maxWidth: SW * 0.55 },
  deviceSub:  { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#94A3B8' },

  // Stats row
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  statItem: { alignItems: 'center', gap: 3, flex: 1 },
  statVal:  { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#FFF' },
  statLabel:{ fontSize: 10, fontFamily: 'Inter_400Regular', color: '#64748B' },

  heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 16 },
  heroFooter:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroFooterTxt: { fontSize: 13, fontFamily: 'Inter_500Medium', color: '#FFF' },

  // Quick Actions
  qGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  qCard: { width: (SW - 52) / 2, backgroundColor: CARD, padding: 18, borderRadius: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
  qIcon: { width: 58, height: 58, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  qLabel:{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: NAVY },

  // Banner
  banner:     { backgroundColor: NAVY2, borderRadius: 32, padding: 24, marginBottom: 24, flexDirection: 'row', overflow: 'hidden', minHeight: 170 },
  bannerLeft: { flex: 1, zIndex: 1 },
  bannerEye:  { fontSize: 10, fontFamily: 'Inter_700Bold', color: GREEN, letterSpacing: 1.5, marginBottom: 8 },
  bannerTitle:{ fontSize: 22, fontFamily: 'Inter_700Bold', color: '#FFF', lineHeight: 28, marginBottom: 8 },
  bannerDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#94A3B8', marginBottom: 16 },
  bannerCTA:  { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24, alignSelf: 'flex-start' },
  bannerCTAText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: NAVY },
  bannerRight:{ position: 'absolute', right: -14, bottom: -14 },

  // Technicians
  secRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  secTitle:  { fontSize: 18, fontFamily: 'Inter_700Bold', color: NAVY },
  seeAll:    { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: GRAY },
  techScroll:{ gap: 14, paddingRight: 20, marginBottom: 24 },
  techCard:  { width: 110, backgroundColor: CARD, borderRadius: 24, padding: 16, alignItems: 'center', position: 'relative', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  techAv:    { width: 64, height: 64, borderRadius: 32, marginBottom: 8 },
  onlineDot: { position: 'absolute', top: 62, right: 30, width: 14, height: 14, borderRadius: 7, backgroundColor: GREEN, borderWidth: 3, borderColor: CARD },
  techName:  { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: NAVY },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  ratingTxt: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: AMBER },
  emptyTech: { width: SW - 40, height: 100, alignItems: 'center', justifyContent: 'center' },
  emptyTxt:  { color: GRAY, fontFamily: 'Inter_400Regular', fontSize: 14 },

  // Diagnose Card
  diagCard:  { backgroundColor: CARD, borderRadius: 24, padding: 20, marginBottom: 24, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 },
  diagLeft:  { flex: 1 },
  diagTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: NAVY, marginBottom: 4 },
  diagDesc:  { fontSize: 13, fontFamily: 'Inter_400Regular', color: GRAY },
  diagIcon:  { width: 56, height: 56, borderRadius: 18, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },

  // Earn Row
  earnRow:  { flexDirection: 'row', gap: 12, marginBottom: 12 },
  earnCard: { flex: 1, backgroundColor: CARD, borderRadius: 24, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 },
  earnIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  earnTitle:{ fontSize: 13, fontFamily: 'Inter_700Bold', color: NAVY },
  earnVal:  { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: GREEN },
});
