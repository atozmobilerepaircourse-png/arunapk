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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const PRIMARY = '#FF6B2C';
const BG = '#F5F7FA';
const CARD = '#FFFFFF';
const DARK = '#1A1A2E';
const GRAY = '#8E8E93';
const BLUE = '#4F8EF7';

const BRANDS = [
  { name: 'Apple',   icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Apple_logo_black.svg/120px-Apple_logo_black.svg.png',   color: '#1C1C1E' },
  { name: 'Samsung', icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Samsung_Logo.svg/320px-Samsung_Logo.svg.png', color: '#1428A0' },
  { name: 'Xiaomi',  icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Xiaomi_logo_%282021-%29.svg/320px-Xiaomi_logo_%282021-%29.svg.png', color: '#FF6900' },
  { name: 'Vivo',    icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Vivo_logo_2019.svg/320px-Vivo_logo_2019.svg.png',  color: '#415FFF' },
  { name: 'Oppo',    icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Oppo_logo.svg/320px-Oppo_logo.svg.png',   color: '#1F8EF1' },
  { name: 'Realme',  icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Realme_logo.svg/320px-Realme_logo.svg.png', color: '#FFD700' },
  { name: 'OnePlus', icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/OnePlus_Logo.svg/320px-OnePlus_Logo.svg.png', color: '#F5010C' },
  { name: 'More',    icon: '',                        color: PRIMARY },
];

const QUICK_ACTIONS = [
  { icon: 'pulse',           label: 'Diagnose\nPhone',   color: '#4F8EF7', bg: '#EAF1FF', route: '/diagnose'     },
  { icon: 'construct',       label: 'Repair\nPhone',     color: PRIMARY,   bg: '#FFF0EA', route: '/select-brand' },
  { icon: 'phone-portrait',  label: 'Sell\nPhone',       color: '#34C759', bg: '#EAFAF1', route: '/sell-item'    },
  { icon: 'shield-checkmark',label: 'Phone\nInsurance',  color: '#AF52DE', bg: '#F5EAFF', route: '/insurance'    },
];

const OFFERS = [
  { title: '30% Off Screen Repair', sub: 'Valid till 31 March', color: PRIMARY, icon: 'phone-portrait' },
  { title: 'Free Pickup & Drop',    sub: 'On orders above ₹500', color: BLUE,   icon: 'car'            },
  { title: 'Battery Check Free',    sub: 'For all customers',    color: '#34C759', icon: 'battery-charging' },
];

export default function CustomerHomeScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useApp();
  const [search, setSearch] = useState('');
  const [onlineTechs, setOnlineTechs] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [offerIdx, setOfferIdx] = useState(0);
  const offerAnim = useRef(new Animated.Value(0)).current;

  const topInset  = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 84 + 34 : 100;
  const firstName = profile?.name?.split(' ')[0] || 'there';

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
        setRecentOrders(Array.isArray(data) ? data.slice(0, 3) : []);
      }
    } catch { setRecentOrders([]); }
  }, [profile?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const t = setTimeout(() => {
      setOfferIdx(i => (i + 1) % OFFERS.length);
    }, 3500);
    return () => clearTimeout(t);
  }, [offerIdx]);

  const handleBrandPress = (brand: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (brand === 'More') { router.push('/select-brand'); return; }
    router.push({ pathname: '/select-model', params: { brand } });
  };

  const handleQuickAction = (route: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(route as any);
  };

  const offer = OFFERS[offerIdx];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: topInset + 12, paddingBottom: bottomPad }]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>Hello, {firstName} 👋</Text>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={13} color={PRIMARY} />
            <Text style={styles.location}>{profile?.city || 'Set Location'}</Text>
          </View>
        </View>
        <Pressable
          style={styles.avatarBtn}
          onPress={() => router.push('/(tabs)/profile')}
        >
          {profile?.avatar ? (
            <Image source={{ uri: profile.avatar }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarLetter}>{(profile?.name || 'U')[0].toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.avatarOnlineDot} />
        </Pressable>
      </View>

      {/* ── Search Bar ── */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={GRAY} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search services, brands, technicians..."
          placeholderTextColor={GRAY}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => { if (search.trim()) router.push('/select-brand' as any); }}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={GRAY} />
          </Pressable>
        )}
      </View>

      {/* ── Quick Actions ── */}
      <Text style={styles.sectionTitle}>What do you need?</Text>
      <View style={styles.quickGrid}>
        {QUICK_ACTIONS.map((a) => (
          <Pressable
            key={a.label}
            style={({ pressed }) => [styles.quickCard, { opacity: pressed ? 0.85 : 1 }]}
            onPress={() => handleQuickAction(a.route)}
          >
            <View style={[styles.quickIcon, { backgroundColor: a.bg }]}>
              <Ionicons name={a.icon as any} size={26} color={a.color} />
            </View>
            <Text style={styles.quickLabel}>{a.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* ── Offer Banner ── */}
      <Pressable
        style={[styles.offerBanner, { backgroundColor: offer.color }]}
        onPress={() => router.push('/insurance' as any)}
      >
        <View style={styles.offerLeft}>
          <Ionicons name={offer.icon as any} size={28} color="#FFF" />
          <View style={{ marginLeft: 12 }}>
            <Text style={styles.offerTitle}>{offer.title}</Text>
            <Text style={styles.offerSub}>{offer.sub}</Text>
          </View>
        </View>
        <View style={styles.offerArrow}>
          <Ionicons name="chevron-forward" size={18} color="#FFF" />
        </View>
      </Pressable>
      <View style={styles.offerDots}>
        {OFFERS.map((_, i) => (
          <View key={i} style={[styles.dot, i === offerIdx && styles.dotActive]} />
        ))}
      </View>

      {/* ── Top Brands ── */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Top Brands</Text>
        <Pressable onPress={() => router.push('/select-brand' as any)}>
          <Text style={styles.seeAll}>See All</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.brandRow} contentContainerStyle={{ paddingHorizontal: 4, gap: 10 }}>
        {BRANDS.map((b) => (
          <Pressable
            key={b.name}
            style={({ pressed }) => [styles.brandChip, { opacity: pressed ? 0.8 : 1 }]}
            onPress={() => handleBrandPress(b.name)}
          >
            {b.name === 'More' ? (
              <View style={[styles.brandIconWrap, { backgroundColor: '#FFF0EA' }]}>
                <Ionicons name="grid" size={22} color={PRIMARY} />
              </View>
            ) : b.icon ? (
              <View style={styles.brandIconWrap}>
                <Image
                  source={{ uri: b.icon }}
                  style={styles.brandImg}
                  contentFit="contain"
                />
              </View>
            ) : null}
            <Text style={styles.brandName}>{b.name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* ── Nearby Technicians ── */}
      {onlineTechs.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Nearby Technicians</Text>
            <Pressable onPress={() => router.push('/(tabs)/directory' as any)}>
              <Text style={styles.seeAll}>See All</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 4, gap: 12 }}>
            {onlineTechs.map((t) => (
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
                  <Ionicons name="star" size={10} color="#FFD700" />
                  <Text style={styles.techRating}>4.8</Text>
                </View>
                <Text style={styles.techSpec} numberOfLines={1}>
                  {Array.isArray(t.skills) && t.skills.length > 0 ? t.skills[0] : 'Mobile Repair'}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}

      {/* ── Recent Orders ── */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Repairs</Text>
        <Pressable onPress={() => router.push('/(tabs)/orders' as any)}>
          <Text style={styles.seeAll}>See All</Text>
        </Pressable>
      </View>
      {recentOrders.length === 0 ? (
        <View style={styles.emptyOrders}>
          <Ionicons name="construct-outline" size={36} color={GRAY} />
          <Text style={styles.emptyOrdersText}>No repairs yet</Text>
          <Pressable
            style={styles.bookNowBtn}
            onPress={() => router.push('/select-brand' as any)}
          >
            <Text style={styles.bookNowText}>Book a Repair</Text>
          </Pressable>
        </View>
      ) : (
        recentOrders.map((o) => (
          <View key={o.id} style={styles.orderCard}>
            <View style={styles.orderLeft}>
              <View style={[styles.orderStatusDot, { backgroundColor: o.status === 'completed' ? '#34C759' : PRIMARY }]} />
              <View>
                <Text style={styles.orderTitle} numberOfLines={1}>{o.productTitle || 'Repair Order'}</Text>
                <Text style={styles.orderStatus}>{o.status || 'Pending'}</Text>
              </View>
            </View>
            <Text style={styles.orderPrice}>₹{o.productPrice || '--'}</Text>
          </View>
        ))
      )}

      {/* ── Services Banner ── */}
      <Pressable style={styles.promoCard} onPress={() => router.push('/select-brand' as any)}>
        <View>
          <Text style={styles.promoTitle}>Get Your Phone Fixed Today</Text>
          <Text style={styles.promoSub}>Expert technicians at your doorstep</Text>
        </View>
        <View style={styles.promoBtn}>
          <Text style={styles.promoBtnText}>Book Now</Text>
        </View>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  content: { paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  headerLeft: { flex: 1 },
  greeting: { fontSize: 22, fontFamily: 'Inter_700Bold', color: DARK },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  location: { fontSize: 13, fontFamily: 'Inter_400Regular', color: GRAY },
  avatarBtn: { position: 'relative' },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { backgroundColor: PRIMARY + '20', alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 18, fontFamily: 'Inter_700Bold', color: PRIMARY },
  avatarOnlineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#34C759', position: 'absolute', bottom: 1, right: 1, borderWidth: 2, borderColor: BG },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 10, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', color: DARK, padding: 0 },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: DARK, marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  seeAll: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: PRIMARY },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  quickCard: { width: (SCREEN_WIDTH - 56) / 2, backgroundColor: CARD, borderRadius: 16, padding: 16, alignItems: 'flex-start', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  quickIcon: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  quickLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: DARK, lineHeight: 20 },
  offerBanner: { borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  offerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  offerTitle: { color: '#FFF', fontSize: 15, fontFamily: 'Inter_700Bold' },
  offerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  offerArrow: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  offerDots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 20 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D1D1D6' },
  dotActive: { backgroundColor: PRIMARY, width: 20 },
  brandRow: { marginBottom: 20, marginHorizontal: -4 },
  brandChip: { alignItems: 'center', width: 68 },
  brandIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center', marginBottom: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  brandImg: { width: 34, height: 34 },
  brandName: { fontSize: 11, fontFamily: 'Inter_500Medium', color: DARK, textAlign: 'center' },
  techCard: { width: 110, backgroundColor: CARD, borderRadius: 16, padding: 12, alignItems: 'center', position: 'relative', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 },
  techAvatar: { width: 56, height: 56, borderRadius: 28, marginBottom: 8 },
  techAvatarFallback: { backgroundColor: PRIMARY + '20', alignItems: 'center', justifyContent: 'center' },
  techAvatarLetter: { fontSize: 22, fontFamily: 'Inter_700Bold', color: PRIMARY },
  techOnlineBadge: { position: 'absolute', top: 38, right: 26, width: 12, height: 12, borderRadius: 6, backgroundColor: '#34C759', borderWidth: 2, borderColor: CARD },
  techName: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: DARK, marginBottom: 2 },
  techRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 4 },
  techRating: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#FFD700' },
  techSpec: { fontSize: 10, fontFamily: 'Inter_400Regular', color: GRAY, textAlign: 'center' },
  emptyOrders: { backgroundColor: CARD, borderRadius: 16, padding: 24, alignItems: 'center', gap: 8, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  emptyOrdersText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: GRAY },
  bookNowBtn: { marginTop: 4, backgroundColor: PRIMARY, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  bookNowText: { color: '#FFF', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  orderCard: { backgroundColor: CARD, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  orderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  orderStatusDot: { width: 10, height: 10, borderRadius: 5 },
  orderTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: DARK },
  orderStatus: { fontSize: 12, fontFamily: 'Inter_400Regular', color: GRAY, marginTop: 2, textTransform: 'capitalize' },
  orderPrice: { fontSize: 15, fontFamily: 'Inter_700Bold', color: DARK },
  promoCard: { backgroundColor: DARK, borderRadius: 16, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  promoTitle: { color: '#FFF', fontSize: 16, fontFamily: 'Inter_700Bold' },
  promoSub: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 4 },
  promoBtn: { backgroundColor: PRIMARY, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  promoBtnText: { color: '#FFF', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
});
