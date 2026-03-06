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
import { apiRequest, getApiUrl } from '@/lib/query-client';

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

// Asset Constants (Adjust paths based on actual extracted folder structure)
const ASSETS_PATH = '/public/customer_assets'; 
const DEVICE_IMG = `${ASSETS_PATH}/iphone_hero.png`;
const BANNER_IMG = `${ASSETS_PATH}/shield_banner.png`;

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

  const topInset  = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 84 + 34 : 104;
  const firstName = profile?.name?.split(' ')[0] || 'there';

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0, duration: 1000, useNativeDriver: true }),
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
                source={{ uri: profile?.avatar || "https://lh3.googleusercontent.com/aida-public/AB6AXuCMpOKrRB5AaApxTvKi1T3Au_7jDAsGIjstWXNrQNsc47quhFR2byJ1I9oHc2NnFk2h_h5E20_3woQFxPrjuXjKjTMZ7EK54XEOs01CN7WJHJB84dxcVsWqBWRo7_inTrPvoQyBXL7TQtzWX7xv0dFkHmJ6QJnq5IUw-DGC87wNOM766bK1LpGnr5nksnotGNgWVZUYjfgmM68JXaB2G832mR58eOwvJZiQD5Je4y7ZLfiie8IaCS1a51JhpKbRMddZw5P2D8R1YUA" }} 
                style={styles.avatar} 
                contentFit="cover" 
              />
            </Pressable>
          </View>
        </View>

        {/* ── Premium Dark Hero Card ────────────────────────────── */}
        <View style={styles.heroCard}>
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
          
          {/* Optional: Add device image if exists */}
          <Image 
            source={{ uri: DEVICE_IMG }} 
            style={styles.heroImage} 
            contentFit="contain"
          />

          <View style={styles.heroDivider} />
          <View style={styles.heroFooter}>
            <Ionicons name="shield-checkmark" size={16} color={GREEN} />
            <Text style={styles.heroFooterText}>Protected by Mobix Shield</Text>
          </View>
        </View>

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
          <View style={styles.bannerContent}>
            <Text style={styles.bannerOverline}>MOBIX SHIELD</Text>
            <Text style={styles.bannerTitle}>Protection Plan</Text>
            <Text style={styles.bannerDesc}>Covers screen & liquid damage</Text>
            <View style={styles.bannerBtn}>
              <Text style={styles.bannerBtnText}>View Plans</Text>
            </View>
          </View>
          <View style={styles.bannerImageWrap}>
             <Ionicons name="shield-half" size={80} color="rgba(0,230,118,0.2)" />
          </View>
        </Pressable>

        {/* ── Nearby Technicians ──────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Book Technician</Text>
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
              <Text style={styles.techEmptyText}>Finding technicians...</Text>
            </View>
          )}
        </ScrollView>

        {/* ── Referral & Wallet ───────────────────────────────────── */}
        <View style={styles.earnRow}>
          <Pressable style={styles.earnCard} onPress={() => press('/referral')}>
            <View style={[styles.earnIcon, { backgroundColor: '#FFFBEB' }]}>
              <Ionicons name="gift-outline" size={20} color="#F59E0B" />
            </View>
            <View>
              <Text style={styles.earnTitle}>Refer & Earn</Text>
              <Text style={styles.earnDesc}>Get ₹100 Reward</Text>
            </View>
          </Pressable>
          <Pressable style={styles.earnCard} onPress={() => press('/wallet')}>
            <View style={[styles.earnIcon, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="wallet-outline" size={20} color="#3B82F6" />
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
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 12 },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN },
  badgeText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#CBD5E1', letterSpacing: 1 },
  heroDevice: { fontSize: 26, fontFamily: 'Inter_700Bold', color: '#FFF', marginBottom: 4 },
  heroStatus: { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#94A3B8' },
  heroImage: { width: '100%', height: 120, marginTop: 10 },
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
  banner: { backgroundColor: '#1E293B', borderRadius: 32, padding: 24, marginBottom: 24, flexDirection: 'row', overflow: 'hidden', position: 'relative' },
  bannerContent: { flex: 1, zIndex: 1 },
  bannerOverline: { fontSize: 11, fontFamily: 'Inter_800ExtraBold', color: GREEN, letterSpacing: 1.5, marginBottom: 6 },
  bannerTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#FFF', marginBottom: 6 },
  bannerDesc: { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#94A3B8', marginBottom: 16 },
  bannerBtn: { backgroundColor: '#FFF', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24, alignSelf: 'flex-start' },
  bannerBtnText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: PRIMARY },
  bannerImageWrap: { position: 'absolute', right: -10, bottom: -10 },

  // Technicians
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: PRIMARY },
  seeAll: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: GRAY },
  techScroll: { gap: 16, paddingRight: 20, marginBottom: 24 },
  techCard: { width: 100, backgroundColor: CARD, borderRadius: 24, padding: 16, alignItems: 'center', position: 'relative', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  techAvatar: { width: 60, height: 60, borderRadius: 30, marginBottom: 8 },
  techOnline: { position: 'absolute', top: 55, right: 30, width: 12, height: 12, borderRadius: 6, backgroundColor: GREEN, borderWidth: 2, borderColor: CARD },
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
