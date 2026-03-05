import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform, Animated,
  ScrollView, TextInput, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useApp } from '@/lib/context';
import { apiRequest } from '@/lib/query-client';

const { width: SW } = Dimensions.get('window');

const BG      = '#F2F4F7';
const CARD    = '#FFFFFF';
const DARK    = '#0F172A';
const GRAY    = '#64748B';
const LGRAY   = '#94A3B8';
const PRIMARY = '#FF6B2C';
const BLUE    = '#3B82F6';

const BRANDS = [
  { name: 'Apple',   emoji: '🍎', bg: '#F5F5F7', color: '#1C1C1E' },
  { name: 'Samsung', emoji: '🔵', bg: '#EAF0FF', color: '#1428A0' },
  { name: 'Xiaomi',  emoji: '🟠', bg: '#FFF0E8', color: '#FF6900' },
  { name: 'Vivo',    emoji: '🔷', bg: '#EAEDFF', color: '#415FFF' },
  { name: 'Oppo',    emoji: '🔹', bg: '#E8F4FF', color: '#1F8EF1' },
  { name: 'Realme',  emoji: '🟡', bg: '#FFF8E8', color: '#E8A100' },
  { name: 'OnePlus', emoji: '🔴', bg: '#FFEBEB', color: '#F5010C' },
  { name: 'More',    emoji: '⊕',  bg: '#F2F4F7', color: PRIMARY  },
];

const QUICK_ACTIONS = [
  { icon: 'pulse',            label: 'Diagnose',  sub: 'Check health',  color: BLUE,    bg: '#EFF6FF', route: '/diagnose'     },
  { icon: 'construct',        label: 'Repair',    sub: 'Fix my phone',  color: PRIMARY, bg: '#FFF7F3', route: '/select-brand' },
  { icon: 'cash',             label: 'Sell Phone',sub: 'Best price',    color: '#16A34A',bg: '#F0FDF4', route: '/sell-item'    },
  { icon: 'shield-checkmark', label: 'Insurance', sub: 'Protect it',   color: '#9333EA',bg: '#FAF5FF', route: '/insurance'    },
];

const BANNERS = [
  { title: '30% Off Screen Repair', sub: 'Valid till 31 March 2026',  color: '#FF6B2C', icon: 'phone-portrait' },
  { title: 'Free Pickup & Drop',    sub: 'On orders above ₹500',      color: '#3B82F6', icon: 'car'            },
  { title: 'Battery Check Free',    sub: 'For all new customers',     color: '#16A34A', icon: 'battery-charging'},
];

export default function CustomerHomeScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useApp();
  const [search, setSearch] = useState('');
  const [onlineTechs, setOnlineTechs] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [bannerIdx, setBannerIdx] = useState(0);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const topInset  = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 84 + 34 : 100;
  const firstName = profile?.name?.split(' ')[0] || 'there';

  const fetchData = useCallback(async () => {
    try {
      const res = await apiRequest('GET', '/api/profiles?role=technician&limit=6');
      const data = await res.json();
      setOnlineTechs((data.profiles || data || []).slice(0, 5));
    } catch { setOnlineTechs([]); }
    try {
      if (profile?.id) {
        const res = await apiRequest('GET', `/api/orders?buyerId=${profile.id}`);
        const data = await res.json();
        setRecentOrders(Array.isArray(data) ? data.slice(0, 3) : []);
      }
    } catch { setRecentOrders([]); }
  }, [profile?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const t = setTimeout(() => setBannerIdx(i => (i + 1) % BANNERS.length), 3800);
    return () => clearTimeout(t);
  }, [bannerIdx]);

  const press = (route: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(route as any);
  };

  const banner = BANNERS[bannerIdx];

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: topInset + 8, paddingBottom: bottomPad }]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Top Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {firstName} 👋</Text>
          <Pressable style={styles.locationRow} onPress={() => {}}>
            <Ionicons name="location" size={13} color={PRIMARY} />
            <Text style={styles.locationText}>{profile?.city || 'Set your location'}</Text>
            <Ionicons name="chevron-down" size={12} color={GRAY} />
          </Pressable>
        </View>
        <Pressable onPress={() => router.push('/(tabs)/profile' as any)} style={styles.avatarWrap}>
          {profile?.avatar ? (
            <Image source={{ uri: profile.avatar }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarLetter}>{(profile?.name || 'U')[0].toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.onlineDot} />
        </Pressable>
      </View>

      {/* ── Search Bar ── */}
      <Pressable style={styles.searchBar} onPress={() => router.push('/select-brand' as any)}>
        <Ionicons name="search" size={18} color={LGRAY} />
        <Text style={styles.searchPlaceholder}>Search services, brands, repairs...</Text>
        <View style={styles.searchFilter}>
          <Ionicons name="options-outline" size={16} color={PRIMARY} />
        </View>
      </Pressable>

      {/* ── Quick Actions ── */}
      <View style={styles.quickGrid}>
        {QUICK_ACTIONS.map((a) => (
          <Pressable
            key={a.label}
            style={({ pressed }) => [styles.quickCard, { backgroundColor: a.bg, opacity: pressed ? 0.88 : 1 }]}
            onPress={() => press(a.route)}
          >
            <View style={[styles.quickIcon, { backgroundColor: a.color + '20' }]}>
              <Ionicons name={a.icon as any} size={24} color={a.color} />
            </View>
            <Text style={[styles.quickLabel, { color: DARK }]}>{a.label}</Text>
            <Text style={styles.quickSub}>{a.sub}</Text>
          </Pressable>
        ))}
      </View>

      {/* ── Promo Banner ── */}
      <Pressable style={[styles.banner, { backgroundColor: banner.color }]} onPress={() => press('/insurance')}>
        <View style={styles.bannerContent}>
          <View style={styles.bannerIconWrap}>
            <Ionicons name={banner.icon as any} size={28} color="#FFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>{banner.title}</Text>
            <Text style={styles.bannerSub}>{banner.sub}</Text>
          </View>
          <View style={styles.bannerArrow}>
            <Ionicons name="arrow-forward" size={16} color="#FFF" />
          </View>
        </View>
        <View style={styles.bannerDots}>
          {BANNERS.map((_, i) => (
            <View key={i} style={[styles.bannerDot, i === bannerIdx && styles.bannerDotActive]} />
          ))}
        </View>
      </Pressable>

      {/* ── Top Brands ── */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Repair by Brand</Text>
        <Pressable onPress={() => press('/select-brand')}>
          <Text style={styles.seeAll}>View All</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.brandScroll}>
        {BRANDS.map((b) => (
          <Pressable
            key={b.name}
            style={({ pressed }) => [styles.brandChip, { opacity: pressed ? 0.8 : 1 }]}
            onPress={() => b.name === 'More' ? press('/select-brand') : router.push({ pathname: '/select-model', params: { brand: b.name } } as any)}
          >
            <View style={[styles.brandIcon, { backgroundColor: b.bg }]}>
              <Text style={{ fontSize: 20 }}>{b.emoji}</Text>
            </View>
            <Text style={styles.brandLabel}>{b.name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* ── Common Repairs ── */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Common Repairs</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.repairScroll}>
        {[
          { label: 'Screen\nReplacement', icon: 'phone-portrait', color: BLUE,     bg: '#EFF6FF', from: '₹999'  },
          { label: 'Battery\nReplacement',icon: 'battery-charging',color: '#16A34A',bg: '#F0FDF4', from: '₹499'  },
          { label: 'Charging\nPort',      icon: 'flash',          color: '#F59E0B', bg: '#FFFBEB', from: '₹399'  },
          { label: 'Camera\nRepair',      icon: 'camera',         color: PRIMARY,   bg: '#FFF7F3', from: '₹699'  },
          { label: 'Back Panel',          icon: 'phone-portrait-outline', color: '#9333EA', bg: '#FAF5FF', from: '₹599' },
        ].map(r => (
          <Pressable
            key={r.label}
            style={({ pressed }) => [styles.repairCard, { opacity: pressed ? 0.88 : 1 }]}
            onPress={() => press('/select-brand')}
          >
            <View style={[styles.repairIcon, { backgroundColor: r.bg }]}>
              <Ionicons name={r.icon as any} size={22} color={r.color} />
            </View>
            <Text style={styles.repairLabel}>{r.label}</Text>
            <Text style={styles.repairFrom}>From {r.from}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* ── Nearby Technicians ── */}
      {onlineTechs.length > 0 && (
        <>
          <View style={styles.sectionRow}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.onlinePulse} />
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
                <View style={styles.techStars}>
                  <Ionicons name="star" size={9} color="#F59E0B" />
                  <Text style={styles.techRating}>4.8</Text>
                </View>
                <Text style={styles.techSpecialty} numberOfLines={1}>
                  {Array.isArray(t.skills) && t.skills[0] ? t.skills[0] : 'Repair Expert'}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}

      {/* ── Recent Orders ── */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Recent Repairs</Text>
        <Pressable onPress={() => router.push('/(tabs)/orders' as any)}>
          <Text style={styles.seeAll}>See All</Text>
        </Pressable>
      </View>

      {recentOrders.length === 0 ? (
        <View style={styles.emptyOrders}>
          <View style={styles.emptyOrdersIcon}>
            <Ionicons name="construct-outline" size={32} color={LGRAY} />
          </View>
          <Text style={styles.emptyOrdersTitle}>No repairs yet</Text>
          <Text style={styles.emptyOrdersSub}>Get your phone fixed by expert technicians</Text>
          <Pressable style={styles.emptyOrdersBtn} onPress={() => press('/select-brand')}>
            <Ionicons name="add" size={16} color="#FFF" />
            <Text style={styles.emptyOrdersBtnText}>Book a Repair</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.ordersCard}>
          {recentOrders.map((o, i) => (
            <View key={o.id} style={[styles.orderRow, i < recentOrders.length - 1 && styles.orderRowBorder]}>
              <View style={[styles.orderStatusBar, { backgroundColor: o.status === 'completed' ? '#16A34A' : PRIMARY }]} />
              <View style={styles.orderLeft}>
                <Text style={styles.orderTitle} numberOfLines={1}>{o.productTitle || 'Repair Order'}</Text>
                <Text style={styles.orderStatus}>{o.status || 'Pending'}</Text>
              </View>
              <Text style={styles.orderPrice}>₹{o.productPrice || '--'}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Bottom CTA ── */}
      <Pressable style={styles.ctaBanner} onPress={() => press('/select-brand')}>
        <View>
          <Text style={styles.ctaTitle}>Doorstep Repair Service</Text>
          <Text style={styles.ctaSub}>Certified technicians come to you</Text>
        </View>
        <View style={styles.ctaBtn}>
          <Text style={styles.ctaBtnText}>Book Now</Text>
          <Ionicons name="arrow-forward" size={14} color="#FFF" />
        </View>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  content: { paddingHorizontal: 16 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  greeting: { fontSize: 22, fontFamily: 'Inter_700Bold', color: DARK },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  locationText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: GRAY },
  avatarWrap: { position: 'relative' },
  avatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: '#E2E8F0' },
  avatarFallback: { backgroundColor: PRIMARY + '20', alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 18, fontFamily: 'Inter_700Bold', color: PRIMARY },
  onlineDot: { position: 'absolute', bottom: 2, right: 2, width: 11, height: 11, borderRadius: 6, backgroundColor: '#22C55E', borderWidth: 2, borderColor: BG },

  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, gap: 10, marginBottom: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3 },
  searchPlaceholder: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', color: LGRAY },
  searchFilter: { width: 32, height: 32, borderRadius: 10, backgroundColor: PRIMARY + '12', alignItems: 'center', justifyContent: 'center' },

  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  quickCard: { width: (SW - 42) / 2, borderRadius: 16, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },
  quickIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  quickLabel: { fontSize: 15, fontFamily: 'Inter_700Bold', marginBottom: 2 },
  quickSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: GRAY },

  banner: { borderRadius: 18, padding: 18, marginBottom: 20 },
  bannerContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bannerIconWrap: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { color: '#FFF', fontSize: 16, fontFamily: 'Inter_700Bold', marginBottom: 3 },
  bannerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontFamily: 'Inter_400Regular' },
  bannerArrow: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  bannerDots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 14 },
  bannerDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(255,255,255,0.4)' },
  bannerDotActive: { width: 18, backgroundColor: '#FFF' },

  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: DARK },
  seeAll: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: PRIMARY },
  onlinePulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },

  brandScroll: { gap: 12, paddingRight: 4, paddingBottom: 4, marginBottom: 20 },
  brandChip: { alignItems: 'center', width: 62 },
  brandIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  brandLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: DARK, textAlign: 'center' },

  repairScroll: { gap: 10, paddingRight: 4, paddingBottom: 4, marginBottom: 20 },
  repairCard: { width: 110, backgroundColor: CARD, borderRadius: 14, padding: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 1 },
  repairIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  repairLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: DARK, textAlign: 'center', marginBottom: 4, lineHeight: 16 },
  repairFrom: { fontSize: 11, fontFamily: 'Inter_500Medium', color: PRIMARY },

  techScroll: { gap: 12, paddingRight: 4, paddingBottom: 4, marginBottom: 20 },
  techCard: { width: 100, backgroundColor: CARD, borderRadius: 16, padding: 12, alignItems: 'center', position: 'relative', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 },
  techAvatar: { width: 52, height: 52, borderRadius: 26, marginBottom: 6 },
  techAvatarFallback: { backgroundColor: PRIMARY + '20', alignItems: 'center', justifyContent: 'center' },
  techAvatarLetter: { fontSize: 20, fontFamily: 'Inter_700Bold', color: PRIMARY },
  techOnlineBadge: { position: 'absolute', top: 36, right: 24, width: 11, height: 11, borderRadius: 6, backgroundColor: '#22C55E', borderWidth: 2, borderColor: CARD },
  techName: { fontSize: 13, fontFamily: 'Inter_700Bold', color: DARK, marginBottom: 3 },
  techStars: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 3 },
  techRating: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#F59E0B' },
  techSpecialty: { fontSize: 10, fontFamily: 'Inter_400Regular', color: GRAY, textAlign: 'center' },

  emptyOrders: { backgroundColor: CARD, borderRadius: 18, padding: 24, alignItems: 'center', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  emptyOrdersIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyOrdersTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: DARK, marginBottom: 4 },
  emptyOrdersSub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: GRAY, textAlign: 'center', marginBottom: 16, paddingHorizontal: 8 },
  emptyOrdersBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: PRIMARY, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 14, shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  emptyOrdersBtnText: { color: '#FFF', fontSize: 14, fontFamily: 'Inter_600SemiBold' },

  ordersCard: { backgroundColor: CARD, borderRadius: 16, overflow: 'hidden', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  orderRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  orderRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  orderStatusBar: { width: 4, height: 36, borderRadius: 2 },
  orderLeft: { flex: 1 },
  orderTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: DARK },
  orderStatus: { fontSize: 12, fontFamily: 'Inter_400Regular', color: GRAY, marginTop: 2, textTransform: 'capitalize' as const },
  orderPrice: { fontSize: 16, fontFamily: 'Inter_700Bold', color: DARK },

  ctaBanner: { backgroundColor: DARK, borderRadius: 18, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  ctaTitle: { color: '#FFF', fontSize: 16, fontFamily: 'Inter_700Bold', marginBottom: 3 },
  ctaSub: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontFamily: 'Inter_400Regular' },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: PRIMARY, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  ctaBtnText: { color: '#FFF', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
});
