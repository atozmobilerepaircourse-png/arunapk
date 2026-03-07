import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput,
  ScrollView, Dimensions, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useApp } from '@/lib/context';
import { apiRequest } from '@/lib/query-client';

const { width: SW } = Dimensions.get('window');

// ── Mobix color tokens (orange primary matching the design) ────────────────
const BG       = '#F5F5F5';
const CARD     = '#FFFFFF';
const BORDER   = '#E8E8E8';
const FORE     = '#1A1A1A';
const MUTED    = '#888888';
const PRIMARY  = '#E8704A';   // Mobix orange
const PRIMARY_L = '#FFF1EC';
const BLUE     = '#4A90D9';
const BLUE_L   = '#E8F2FB';
const GREEN    = '#4CAF78';
const GREEN_L  = '#E8F5ED';
const PURPLE   = '#9B6DD4';
const PURPLE_L = '#F3ECFC';
const AMBER    = '#F59E0B';

// ── Quick Services ─────────────────────────────────────────────────────────
const SERVICES = [
  { id: 'screen',  icon: 'desktop-outline',          label: 'Screen',       color: BLUE,   bg: BLUE_L    },
  { id: 'battery', icon: 'battery-charging-outline', label: 'Battery',      color: GREEN,  bg: GREEN_L   },
  { id: 'back',    icon: 'phone-portrait-outline',   label: 'Back Panel',   color: PURPLE, bg: PURPLE_L  },
  { id: 'full',    icon: 'construct-outline',        label: 'Full Service', color: PRIMARY, bg: PRIMARY_L },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function initials(name?: string) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function go(route: string) {
  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  router.push(route as any);
}

export default function CustomerHomeScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useApp();
  const [techs, setTechs]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom + 16;

  const firstName = profile?.name?.split(' ')[0] ?? 'User';
  const city = profile?.city
    ? `${profile.city}${profile.state ? `, ${profile.state}` : ''}`
    : 'Koramangala, Bangalore';

  const fetchTechs = useCallback(async () => {
    try {
      setLoading(true);
      const res  = await apiRequest('GET', '/api/profiles?role=technician&limit=10');
      const data = await res.json();
      setTechs((data.profiles ?? data ?? []).slice(0, 6));
    } catch {
      setTechs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTechs(); }, [fetchTechs]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: BG }}
      contentContainerStyle={{
        paddingTop: topPad + 16,
        paddingBottom: botPad + 100,
        paddingHorizontal: 16,
      }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greetText}>{getGreeting()}</Text>
          <Text style={styles.nameText}>Hello, {firstName}!</Text>
        </View>
        <Pressable style={styles.bellBtn} onPress={() => go('/notification-preferences')}>
          <Ionicons name="notifications-outline" size={22} color={FORE} />
          <View style={styles.bellDot} />
        </Pressable>
      </View>

      {/* ── Location ────────────────────────────────────────────────────── */}
      <Pressable style={styles.locationRow}>
        <Ionicons name="location-outline" size={15} color={PRIMARY} />
        <Text style={styles.locationText} numberOfLines={1}>{city}</Text>
        <Ionicons name="chevron-forward" size={14} color={MUTED} />
      </Pressable>

      {/* ── Search ──────────────────────────────────────────────────────── */}
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color={MUTED} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search for phone repair services..."
          placeholderTextColor={MUTED}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
      </View>

      {/* ── Promo Banner ────────────────────────────────────────────────── */}
      <Pressable style={styles.banner} onPress={() => go('/insurance')}>
        <View style={styles.bannerContent}>
          <View style={styles.bannerBadge}>
            <Text style={styles.bannerBadgeTxt}>Limited Offer</Text>
          </View>
          <Text style={styles.bannerTitle}>Mobile Protection Plan</Text>
          <Text style={styles.bannerDesc}>Just ₹99/month + ₹500 off on repairs</Text>
          <View style={styles.bannerBtn}>
            <Text style={styles.bannerBtnTxt}>Subscribe Now</Text>
          </View>
        </View>
        <View style={styles.bannerShield}>
          <Ionicons name="shield-outline" size={72} color="rgba(255,255,255,0.35)" />
        </View>
      </Pressable>

      {/* ── Quick Services ──────────────────────────────────────────────── */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Quick Services</Text>
        <Pressable onPress={() => go('/select-brand')}>
          <Text style={styles.seeAll}>See All</Text>
        </Pressable>
      </View>
      <View style={styles.servicesGrid}>
        {SERVICES.map(s => (
          <Pressable key={s.id} style={styles.serviceCard} onPress={() => go('/select-brand')}>
            <View style={[styles.serviceIcon, { backgroundColor: s.bg }]}>
              <Ionicons name={s.icon as any} size={22} color={s.color} />
            </View>
            <Text style={styles.serviceLabel}>{s.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* ── Nearby Technicians ──────────────────────────────────────────── */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Nearby Technicians</Text>
        <Pressable onPress={() => go('/(tabs)/directory')}>
          <Text style={styles.seeAll}>View All</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={PRIMARY} style={{ marginVertical: 24 }} />
      ) : techs.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="people-outline" size={32} color={MUTED} />
          <Text style={styles.emptyTxt}>No technicians found nearby</Text>
        </View>
      ) : (
        <View style={styles.techList}>
          {techs.map((tech, i) => (
            <TechCard key={tech.id ?? i} tech={tech} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// ── Tech Card ──────────────────────────────────────────────────────────────
function TechCard({ tech }: { tech: any }) {
  const rating  = tech.rating ?? (4.5 + Math.random() * 0.5).toFixed(1);
  const reviews = tech.reviewCount ?? Math.floor(200 + Math.random() * 700);
  const dist    = tech.distance ?? `${(0.5 + Math.random() * 2).toFixed(1)} km`;
  const resp    = tech.responseTime ?? `${10 + Math.floor(Math.random() * 20)} mins`;
  const isVerified = tech.verified !== false;

  return (
    <Pressable
      style={styles.techCard}
      onPress={() => router.push({ pathname: '/user-profile', params: { id: tech.id } } as any)}
    >
      {/* Avatar */}
      <View style={styles.techAvatarWrap}>
        {tech.avatar ? (
          <Image source={{ uri: tech.avatar }} style={styles.techAvatar} contentFit="cover" />
        ) : (
          <View style={[styles.techAvatar, styles.techAvatarFb]}>
            <Text style={styles.techInitials}>{initials(tech.name)}</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.techInfo}>
        <View style={styles.techNameRow}>
          <Text style={styles.techName} numberOfLines={1}>{tech.name ?? 'Technician'}</Text>
          {isVerified && (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedTxt}>Verified</Text>
            </View>
          )}
        </View>
        <Text style={styles.techSpecialty} numberOfLines={1}>
          {tech.skills?.[0] ?? tech.specialty ?? 'Mobile Repair Expert'}
        </Text>
        <View style={styles.techMeta}>
          <Ionicons name="star" size={12} color={AMBER} />
          <Text style={styles.techRating}>{Number(rating).toFixed(1)}</Text>
          <Text style={styles.techReviews}>({reviews})</Text>
          <Ionicons name="location-outline" size={12} color={MUTED} style={{ marginLeft: 6 }} />
          <Text style={styles.techMetaTxt}>{dist}</Text>
        </View>
      </View>

      {/* Right */}
      <View style={styles.techRight}>
        <View style={styles.techTimeRow}>
          <Ionicons name="time-outline" size={12} color={GREEN} />
          <Text style={styles.techTimeTxt}>{resp}</Text>
        </View>
        <Pressable
          style={styles.bookBtn}
          onPress={() => router.push({ pathname: '/user-profile', params: { id: tech.id } } as any)}
        >
          <Text style={styles.bookBtnTxt}>Book</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.06,
  shadowRadius: 6,
  elevation: 2,
};

const styles = StyleSheet.create({
  // Header
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  greetText:    { fontSize: 13, color: MUTED },
  nameText:     { fontSize: 22, fontWeight: '700', color: FORE, marginTop: 1 },
  bellBtn:      { width: 42, height: 42, borderRadius: 21, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center', ...SHADOW },
  bellDot:      { position: 'absolute', top: 9, right: 9, width: 9, height: 9, borderRadius: 5, backgroundColor: PRIMARY, borderWidth: 2, borderColor: CARD },

  // Location
  locationRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 14 },
  locationText: { fontSize: 13, color: MUTED, flex: 1 },

  // Search
  searchBox:    { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 12, paddingHorizontal: 14, height: 48, marginBottom: 18, ...SHADOW },
  searchInput:  { flex: 1, fontSize: 14, color: FORE },

  // Banner
  banner:        { borderRadius: 16, marginBottom: 24, overflow: 'hidden', backgroundColor: PRIMARY, flexDirection: 'row', alignItems: 'center', minHeight: 152, ...SHADOW },
  bannerContent: { flex: 1, padding: 18, zIndex: 1 },
  bannerBadge:   { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10 },
  bannerBadgeTxt:{ fontSize: 11, fontWeight: '700', color: '#FFF' },
  bannerTitle:   { fontSize: 18, fontWeight: '700', color: '#FFF', marginBottom: 6 },
  bannerDesc:    { fontSize: 13, color: 'rgba(255,255,255,0.88)', marginBottom: 14 },
  bannerBtn:     { alignSelf: 'flex-start', backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 22 },
  bannerBtnTxt:  { fontSize: 13, fontWeight: '700', color: PRIMARY },
  bannerShield:  { paddingRight: 14, alignItems: 'center', justifyContent: 'center' },

  // Section
  sectionRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: FORE },
  seeAll:       { fontSize: 13, fontWeight: '600', color: PRIMARY },

  // Services
  servicesGrid: { flexDirection: 'row', gap: 10, marginBottom: 22 },
  serviceCard:  { flex: 1, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 14, paddingVertical: 14, alignItems: 'center', gap: 8, ...SHADOW },
  serviceIcon:  { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  serviceLabel: { fontSize: 11, fontWeight: '600', color: FORE, textAlign: 'center' },

  // Techs
  techList:     { gap: 10, marginBottom: 16 },
  emptyBox:     { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyTxt:     { color: MUTED, fontSize: 14 },

  // Tech card
  techCard:        { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, ...SHADOW },
  techAvatarWrap:  {},
  techAvatar:      { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: BORDER },
  techAvatarFb:    { backgroundColor: '#FFF1EC', alignItems: 'center', justifyContent: 'center' },
  techInitials:    { fontSize: 16, fontWeight: '700', color: PRIMARY },
  techInfo:        { flex: 1, minWidth: 0 },
  techNameRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  techName:        { fontSize: 14, fontWeight: '700', color: FORE, flexShrink: 1 },
  verifiedBadge:   { backgroundColor: '#E8F5ED', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  verifiedTxt:     { fontSize: 10, fontWeight: '700', color: '#2E7D52' },
  techSpecialty:   { fontSize: 12, color: MUTED, marginBottom: 4 },
  techMeta:        { flexDirection: 'row', alignItems: 'center', gap: 3 },
  techRating:      { fontSize: 12, fontWeight: '700', color: FORE },
  techReviews:     { fontSize: 11, color: MUTED },
  techMetaTxt:     { fontSize: 11, color: MUTED },
  techRight:       { alignItems: 'flex-end', gap: 8 },
  techTimeRow:     { flexDirection: 'row', alignItems: 'center', gap: 3 },
  techTimeTxt:     { fontSize: 12, fontWeight: '600', color: GREEN },
  bookBtn:         { backgroundColor: PRIMARY, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  bookBtnTxt:      { fontSize: 13, fontWeight: '700', color: '#FFF' },
});
