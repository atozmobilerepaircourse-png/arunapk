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
const BG        = '#F8FAFC';   // light background
const CARD      = '#FFFFFF';
const GRAY      = '#64748B';
const LGRAY     = '#94A3B8';
const RED       = '#FF3B30';
const INDIGO    = '#4F46E5';
const TEAL      = '#0D9488';
const NAVY_DARK = '#1E293B';

// Asset Constants (Adjusted for zip structure)
const ASSETS_BASE = '/public/customer_assets/ccccccc'; 
const DEVICE_IMG = `${ASSETS_BASE}/device_hero.png`;
const BANNER_IMG = `${ASSETS_BASE}/shield_banner.png`;
const CHIP_ICON = `${ASSETS_BASE}/chip.png`;

const QUICK_ACTIONS = [
  { id: 'repair', label: 'Repair', icon: 'construct-outline', color: '#4F46E5', bg: '#EEF2FF', route: '/select-brand' },
  { id: 'sell',   label: 'Sell Phone', icon: 'phone-portrait-outline', color: '#8B5CF6', bg: '#F5F3FF', route: '/select-brand' },
  { id: 'acc',    label: 'Shop', icon: 'cart-outline', color: '#0D9488', bg: '#F0FDFA', route: '/marketplace' },
  { id: 'ins',    label: 'Insurance', icon: 'shield-checkmark-outline', color: '#10B981', bg: '#ECFDF5', route: '/insurance' },
];

const HEALTH_SCORE = 92;

export default function CustomerHomeScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useApp();
  const [onlineTechs, setOnlineTechs] = useState<any[]>([]);
  const pulse = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  const topInset  = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 84 + 34 : 104;
  const firstName = profile?.name?.split(' ')[0] || 'there';

  useEffect(() => {
    Animated.parallel([
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.1, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1.0, duration: 1000, useNativeDriver: true }),
        ])
      ),
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 7, useNativeDriver: true })
    ]).start();
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await apiRequest('GET', '/api/profiles?role=technician&limit=6');
      const data = await res.json();
      setOnlineTechs((data.profiles || data || []).slice(0, 4));
    } catch { setOnlineTechs([]); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const press = (route: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(route as any);
  };

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: topInset + 10, paddingBottom: bottomPad }]}
      >
        {/* ── Header ──────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.nameText}>{firstName}!</Text>
          </View>
          <View style={styles.headerRight}>
            <Pressable style={styles.iconBtn} onPress={() => {}}>
              <Ionicons name="notifications-outline" size={22} color={PRIMARY} />
              <View style={styles.notifDot} />
            </Pressable>
            <Pressable onPress={() => router.push('/(tabs)/profile' as any)}>
              <Image 
                source={{ uri: profile?.avatar || "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=100&h=100&fit=crop" }} 
                style={styles.avatar} 
                contentFit="cover" 
              />
            </Pressable>
          </View>
        </View>

        {/* ── Premium Dark Hero Card ────────────────────────────── */}
        <Animated.View style={[styles.heroCard, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.heroGlow} />
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <View style={styles.badge}>
                <Animated.View style={[styles.pulseDot, { transform: [{ scale: pulse }] }]} />
                <Text style={styles.badgeText}>AUTO-DETECTED</Text>
              </View>
              <Text style={styles.heroDevice}>{profile?.device || 'iPhone 15 Pro'}</Text>
              <Text style={styles.heroStatus}>Excellent Condition</Text>
            </View>
            <View style={styles.scoreBox}>
              <View style={styles.scoreCircle}>
                <Text style={styles.scoreNum}>{HEALTH_SCORE}</Text>
              </View>
              <Text style={styles.scoreLabel}>Health</Text>
            </View>
          </View>
          
          <View style={styles.heroVisuals}>
            <Image 
              source={{ uri: DEVICE_IMG }} 
              style={styles.heroDeviceImg} 
              contentFit="contain"
            />
            <View style={styles.techStats}>
              <View style={styles.statItem}>
                <Ionicons name="battery-charging" size={14} color={GREEN} />
                <Text style={styles.statText}>98%</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="cellular" size={14} color={GREEN} />
                <Text style={styles.statText}>5G</Text>
              </View>
            </View>
          </View>

          <View style={styles.heroDivider} />
          <View style={styles.heroFooter}>
            <Ionicons name="shield-checkmark" size={16} color={GREEN} />
            <Text style={styles.heroFooterText}>Protected by Mobix Shield</Text>
          </View>
        </Animated.View>

        {/* ── Quick Actions ───────────────────────────────────────── */}
        <View style={styles.quickGrid}>
          {QUICK_ACTIONS.map(a => (
            <Pressable key={a.id} style={styles.quickItem} onPress={() => press(a.route)}>
              <View style={[styles.quickIcon, { backgroundColor: a.bg }]}>
                <Ionicons name={a.icon as any} size={26} color={a.color} />
              </View>
              <Text style={styles.quickLabel}>{a.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* ── Mobix Shield Banner ─────────────────────────────────── */}
        <Pressable style={styles.banner} onPress={() => press('/insurance')}>
          <Image source={{ uri: BANNER_IMG }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <View style={styles.bannerOverlay} />
          <View style={styles.bannerContent}>
            <Text style={styles.bannerOverline}>MOBIX SHIELD</Text>
            <Text style={styles.bannerTitle}>Total Device Protection</Text>
            <Text style={styles.bannerDesc}>Covers screen, liquid & accidental damage</Text>
            <View style={styles.bannerBtn}>
              <Text style={styles.bannerBtnText}>View Plans</Text>
              <Ionicons name="arrow-forward" size={14} color={PRIMARY} />
            </View>
          </View>
        </Pressable>

        {/* ── Nearby Technicians ──────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Certified Technicians</Text>
          <Pressable onPress={() => router.push('/(tabs)/directory' as any)}>
            <Text style={styles.seeAll}>See All</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.techScroll}>
          {onlineTechs.length > 0 ? onlineTechs.map(t => (
            <Pressable key={t.id} style={styles.techCard} onPress={() => router.push({ pathname: '/user-profile', params: { id: t.id } } as any)}>
              <Image source={{ uri: t.avatar || 'https://i.pravatar.cc/150?u=' + t.id }} style={styles.techAvatar} />
              <View style={styles.techOnline} />
              <Text style={styles.techName} numberOfLines={1}>{t.name?.split(' ')[0]}</Text>
              <View style={styles.techRating}>
                <Ionicons name="star" size={10} color="#F59E0B" />
                <Text style={styles.techRatingText}>4.9</Text>
              </View>
            </Pressable>
          )) : (
            <View style={styles.techEmpty}>
              <Text style={styles.techEmptyText}>Finding expert technicians...</Text>
            </View>
          )}
        </ScrollView>

        {/* ── Referral & Wallet ───────────────────────────────────── */}
        <View style={styles.earnRow}>
          <Pressable style={styles.earnCard} onPress={() => press('/referral')}>
            <View style={[styles.earnIcon, { backgroundColor: '#FFFBEB' }]}>
              <Ionicons name="gift" size={20} color="#F59E0B" />
            </View>
            <View>
              <Text style={styles.earnTitle}>Refer & Earn</Text>
              <Text style={styles.earnDesc}>Get ₹100 Reward</Text>
            </View>
          </Pressable>
          <Pressable style={styles.earnCard} onPress={() => press('/wallet')}>
            <View style={[styles.earnIcon, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="wallet" size={20} color="#3B82F6" />
            </View>
            <View>
              <Text style={styles.earnTitle}>Mobi Wallet</Text>
              <Text style={styles.earnDesc}>Bal: ₹250.00</Text>
            </View>
          </Pressable>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  content: { paddingHorizontal: 20 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  welcomeText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: GRAY },
  nameText: { fontSize: 24, fontFamily: 'Inter_700Bold', color: PRIMARY, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, position: 'relative' },
  notifDot: { position: 'absolute', top: 12, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: RED, borderWidth: 2, borderColor: CARD },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#FFF' },

  // Hero Card
  heroCard: { backgroundColor: '#1E293B', borderRadius: 32, padding: 24, marginBottom: 24, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 12 },
  heroGlow: { position: 'absolute', right: -40, top: -40, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(0,230,118,0.1)' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 12, alignSelf: 'flex-start' },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN },
  badgeText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#CBD5E1', letterSpacing: 1 },
  heroDevice: { fontSize: 26, fontFamily: 'Inter_700Bold', color: '#FFF', marginBottom: 4 },
  heroStatus: { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#94A3B8' },
  heroVisuals: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 },
  heroDeviceImg: { width: 120, height: 120 },
  techStats: { gap: 10 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  statText: { color: '#FFF', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  scoreBox: { alignItems: 'center', gap: 6 },
  scoreCircle: { width: 72, height: 72, borderRadius: 36, borderWidth: 5, borderColor: GREEN, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,230,118,0.1)' },
  scoreNum: { fontSize: 24, fontFamily: 'Inter_700Bold', color: GREEN },
  scoreLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#64748B' },
  heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 20 },
  heroFooter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroFooterText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: '#FFF' },

  // Quick Actions
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  quickItem: { width: (SW - 52) / 2, backgroundColor: CARD, padding: 16, borderRadius: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },
  quickIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  quickLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: PRIMARY },

  // Banner
  banner: { backgroundColor: '#1E293B', borderRadius: 32, padding: 24, marginBottom: 24, overflow: 'hidden', position: 'relative', minHeight: 160, justifyContent: 'center' },
  bannerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(30, 41, 59, 0.7)' },
  bannerContent: { zIndex: 1 },
  bannerOverline: { fontSize: 11, fontFamily: 'Inter_800ExtraBold', color: GREEN, letterSpacing: 1.5, marginBottom: 6 },
  bannerTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', color: '#FFF', marginBottom: 6 },
  bannerDesc: { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#CBD5E1', marginBottom: 16, maxWidth: '80%' },
  bannerBtn: { backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6 },
  bannerBtnText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: PRIMARY },

  // Technicians
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: PRIMARY },
  seeAll: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: GRAY },
  techScroll: { gap: 16, paddingRight: 20, marginBottom: 24 },
  techCard: { width: 110, backgroundColor: CARD, borderRadius: 24, padding: 16, alignItems: 'center', position: 'relative', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  techAvatar: { width: 64, height: 64, borderRadius: 32, marginBottom: 8 },
  techOnline: { position: 'absolute', top: 60, right: 30, width: 14, height: 14, borderRadius: 7, backgroundColor: GREEN, borderWidth: 3, borderColor: CARD },
  techName: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: PRIMARY },
  techRating: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4 },
  techRatingText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#F59E0B' },
  techEmpty: { width: SW - 40, height: 100, alignItems: 'center', justifyContent: 'center' },
  techEmptyText: { color: GRAY, fontFamily: 'Inter_400Regular' },

  // Referral / Wallet
  earnRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  earnCard: { flex: 1, backgroundColor: CARD, borderRadius: 24, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },
  earnIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  earnTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', color: PRIMARY },
  earnDesc: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: GREEN },
});
