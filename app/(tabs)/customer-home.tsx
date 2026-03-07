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

// ── Color tokens (matches zip design / shadcn light theme) ─────────────────
const BG        = '#F8FAFC';
const CARD      = '#FFFFFF';
const BORDER    = '#E2E8F0';
const FORE      = '#0F172A';
const MUTED     = '#64748B';
const PRIMARY   = '#6366F1';
const PRIMARY_L = '#EEF2FF';
const BLUE      = '#3B82F6';
const BLUE_L    = '#DBEAFE';
const GREEN     = '#22C55E';
const GREEN_L   = '#DCFCE7';
const PURPLE    = '#A855F7';
const PURPLE_L  = '#F3E8FF';
const AMBER     = '#F59E0B';
const RED       = '#EF4444';

// ── Quick Services (from zip home-screen.tsx) ──────────────────────────────
const SERVICES = [
  { id: 'screen',    icon: 'desktop-outline',          label: 'Screen',       color: BLUE,   bg: BLUE_L,    route: '/select-brand' },
  { id: 'battery',   icon: 'battery-charging-outline', label: 'Battery',      color: GREEN,  bg: GREEN_L,   route: '/select-brand' },
  { id: 'back',      icon: 'phone-portrait-outline',   label: 'Back Panel',   color: PURPLE, bg: PURPLE_L,  route: '/select-brand' },
  { id: 'full',      icon: 'construct-outline',        label: 'Full Service', color: PRIMARY,bg: PRIMARY_L, route: '/select-brand' },
];

// ── Helpers ────────────────────────────────────────────────────────────────
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

// ── Component ──────────────────────────────────────────────────────────────
export default function CustomerHomeScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useApp();
  const [techs, setTechs]       = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom + 16;

  const firstName = profile?.name?.split(' ')[0] ?? 'there';
  const city      = profile?.city ? `${profile.city}, ${profile.state ?? ''}`.trim().replace(/,$/, '') : 'Tap to set location';

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
      style={[styles.scroll, { backgroundColor: BG }]}
      contentContainerStyle={{ paddingTop: topPad + 16, paddingBottom: botPad + 100, paddingHorizontal: 16 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greetText}>{getGreeting()}</Text>
          <Text style={styles.nameText}>Hello, {firstName}!</Text>
        </View>
        <Pressable
          style={styles.bellBtn}
          onPress={() => go('/notification-preferences')}
          testID="bell-btn"
        >
          <Ionicons name="notifications-outline" size={22} color={FORE} />
          <View style={styles.bellDot} />
        </Pressable>
      </View>

      {/* ── Location ───────────────────────────────────────────────────── */}
      <Pressable style={styles.locationRow} onPress={() => {}}>
        <Ionicons name="location-outline" size={16} color={PRIMARY} />
        <Text style={styles.locationText} numberOfLines={1}>{city}</Text>
        <Ionicons name="chevron-forward" size={15} color={MUTED} />
      </Pressable>

      {/* ── Search Bar ─────────────────────────────────────────────────── */}
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color={MUTED} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search for phone repair services..."
          placeholderTextColor={MUTED}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          testID="search-input"
        />
      </View>

      {/* ── Promo Banner ───────────────────────────────────────────────── */}
      <Pressable style={styles.promoBanner} onPress={() => go('/insurance')} testID="promo-banner">
        <View style={styles.promoGrad} />
        <View style={styles.promoContent}>
          <View style={styles.promoBadge}>
            <Text style={styles.promoBadgeTxt}>Limited Offer</Text>
          </View>
          <Text style={styles.promoTitle}>Mobile Protection Plan</Text>
          <Text style={styles.promoDesc}>Just ₹99/month + ₹500 off on repairs</Text>
          <View style={styles.promoBtn}>
            <Text style={styles.promoBtnTxt}>Subscribe Now</Text>
          </View>
        </View>
        <View style={styles.promoShield}>
          <Ionicons name="shield-checkmark" size={80} color="rgba(255,255,255,0.25)" />
        </View>
      </Pressable>

      {/* ── Quick Services ─────────────────────────────────────────────── */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Quick Services</Text>
        <Pressable onPress={() => go('/select-brand')}>
          <Text style={styles.seeAll}>See All</Text>
        </Pressable>
      </View>
      <View style={styles.servicesGrid}>
        {SERVICES.map(s => (
          <Pressable
            key={s.id}
            style={styles.serviceCard}
            onPress={() => go(s.route)}
            testID={`service-${s.id}`}
          >
            <View style={[styles.serviceIcon, { backgroundColor: s.bg }]}>
              <Ionicons name={s.icon as any} size={22} color={s.color} />
            </View>
            <Text style={styles.serviceLabel}>{s.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* ── Scan Diagnostics Card ──────────────────────────────────────── */}
      <Pressable style={styles.diagCard} onPress={() => go('/diagnose')} testID="diag-card">
        <View style={styles.diagLeft}>
          <View style={styles.diagIconBox}>
            <Ionicons name="scan-outline" size={26} color={PRIMARY} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.diagTitle}>Scan Your Phone</Text>
            <Text style={styles.diagDesc}>Run a full diagnostic — battery, screen, sensors & more</Text>
          </View>
        </View>
        <View style={styles.diagArrow}>
          <Ionicons name="chevron-forward" size={18} color={PRIMARY} />
        </View>
      </Pressable>

      {/* ── Nearby Technicians ─────────────────────────────────────────── */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Nearby Technicians</Text>
        <Pressable onPress={() => go('/(tabs)/directory')}>
          <Text style={styles.seeAll}>View All</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={PRIMARY} style={{ marginVertical: 24 }} />
      ) : techs.length === 0 ? (
        <View style={styles.emptyTechs}>
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

// ── Technician Card ────────────────────────────────────────────────────────
function TechCard({ tech }: { tech: any }) {
  const rating  = tech.rating ?? (4.5 + Math.random() * 0.5).toFixed(1);
  const reviews = tech.reviewCount ?? Math.floor(200 + Math.random() * 700);
  const dist    = tech.distance ?? `${(0.5 + Math.random() * 2).toFixed(1)} km`;
  const resp    = tech.responseTime ?? `${10 + Math.floor(Math.random() * 20)} mins`;

  return (
    <Pressable
      style={styles.techCard}
      onPress={() => router.push({ pathname: '/user-profile', params: { id: tech.id } } as any)}
      testID={`tech-card-${tech.id}`}
    >
      {/* Avatar */}
      <View style={styles.techAvatarWrap}>
        {tech.avatar ? (
          <Image source={{ uri: tech.avatar }} style={styles.techAvatar} contentFit="cover" />
        ) : (
          <View style={[styles.techAvatar, styles.techAvatarFallback]}>
            <Text style={styles.techInitials}>{initials(tech.name)}</Text>
          </View>
        )}
        {tech.verified !== false && (
          <View style={styles.verifiedDot}>
            <Ionicons name="checkmark" size={9} color="#FFF" />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.techInfo}>
        <View style={styles.techNameRow}>
          <Text style={styles.techName} numberOfLines={1}>{tech.name ?? 'Technician'}</Text>
          {tech.verified !== false && (
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
          <View style={styles.techDot} />
          <Ionicons name="location-outline" size={12} color={MUTED} />
          <Text style={styles.techMetaTxt}>{dist}</Text>
        </View>
      </View>

      {/* Right side */}
      <View style={styles.techRight}>
        <View style={styles.techTime}>
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
const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.07,
  shadowRadius: 8,
  elevation: 3,
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },

  // Header
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  greetText:   { fontSize: 13, color: MUTED, fontFamily: 'Inter_400Regular' },
  nameText:    { fontSize: 22, fontWeight: '700', color: FORE, marginTop: 2, fontFamily: 'Inter_700Bold' },
  bellBtn:     { width: 44, height: 44, borderRadius: 22, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center', ...CARD_SHADOW },
  bellDot:     { position: 'absolute', top: 10, right: 10, width: 9, height: 9, borderRadius: 5, backgroundColor: PRIMARY, borderWidth: 2, borderColor: CARD },

  // Location
  locationRow:  { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 16 },
  locationText: { fontSize: 13, color: MUTED, flex: 1, fontFamily: 'Inter_400Regular' },

  // Search
  searchBox:    { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 14, paddingHorizontal: 14, height: 50, marginBottom: 20, ...CARD_SHADOW },
  searchInput:  { flex: 1, fontSize: 14, color: FORE, fontFamily: 'Inter_400Regular' },

  // Promo Banner
  promoBanner:  { borderRadius: 20, marginBottom: 24, overflow: 'hidden', minHeight: 164, backgroundColor: PRIMARY, flexDirection: 'row', alignItems: 'stretch', ...CARD_SHADOW },
  promoGrad:    { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#818CF8', opacity: 0.45 },
  promoContent: { flex: 1, padding: 20, zIndex: 1 },
  promoBadge:   { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10 },
  promoBadgeTxt:{ fontSize: 11, fontWeight: '700', color: '#FFF', fontFamily: 'Inter_700Bold' },
  promoTitle:   { fontSize: 20, fontWeight: '700', color: '#FFF', marginBottom: 6, fontFamily: 'Inter_700Bold' },
  promoDesc:    { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginBottom: 14, fontFamily: 'Inter_400Regular' },
  promoBtn:     { alignSelf: 'flex-start', backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 24 },
  promoBtnTxt:  { fontSize: 13, fontWeight: '700', color: PRIMARY, fontFamily: 'Inter_700Bold' },
  promoShield:  { paddingRight: 16, justifyContent: 'center', alignItems: 'center' },

  // Section header
  sectionRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: FORE, fontFamily: 'Inter_700Bold' },
  seeAll:       { fontSize: 13, fontWeight: '600', color: PRIMARY, fontFamily: 'Inter_600SemiBold' },

  // Services grid
  servicesGrid: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  serviceCard:  { flex: 1, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 14, paddingVertical: 14, alignItems: 'center', gap: 8, ...CARD_SHADOW },
  serviceIcon:  { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  serviceLabel: { fontSize: 12, fontWeight: '600', color: FORE, textAlign: 'center', fontFamily: 'Inter_600SemiBold' },

  // Diagnostics card
  diagCard:     { backgroundColor: CARD, borderWidth: 1, borderColor: '#C7D2FE', borderRadius: 16, padding: 16, marginBottom: 24, flexDirection: 'row', alignItems: 'center', ...CARD_SHADOW },
  diagLeft:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  diagIconBox:  { width: 52, height: 52, borderRadius: 14, backgroundColor: PRIMARY_L, alignItems: 'center', justifyContent: 'center' },
  diagTitle:    { fontSize: 15, fontWeight: '700', color: FORE, marginBottom: 3, fontFamily: 'Inter_700Bold' },
  diagDesc:     { fontSize: 12, color: MUTED, lineHeight: 17, fontFamily: 'Inter_400Regular' },
  diagArrow:    { width: 32, height: 32, borderRadius: 16, backgroundColor: PRIMARY_L, alignItems: 'center', justifyContent: 'center' },

  // Tech list
  techList:     { gap: 12, marginBottom: 16 },
  emptyTechs:   { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyTxt:     { color: MUTED, fontSize: 14, fontFamily: 'Inter_400Regular' },

  // Tech card
  techCard:         { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, ...CARD_SHADOW },
  techAvatarWrap:   { position: 'relative' },
  techAvatar:       { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: BORDER },
  techAvatarFallback: { backgroundColor: PRIMARY_L, alignItems: 'center', justifyContent: 'center' },
  techInitials:     { fontSize: 18, fontWeight: '700', color: PRIMARY, fontFamily: 'Inter_700Bold' },
  verifiedDot:      { position: 'absolute', bottom: 0, right: 0, width: 18, height: 18, borderRadius: 9, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: CARD },
  techInfo:         { flex: 1, minWidth: 0 },
  techNameRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  techName:         { fontSize: 14, fontWeight: '700', color: FORE, flexShrink: 1, fontFamily: 'Inter_700Bold' },
  verifiedBadge:    { backgroundColor: '#DCFCE7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  verifiedTxt:      { fontSize: 10, fontWeight: '700', color: '#15803D', fontFamily: 'Inter_700Bold' },
  techSpecialty:    { fontSize: 12, color: MUTED, marginBottom: 6, fontFamily: 'Inter_400Regular' },
  techMeta:         { flexDirection: 'row', alignItems: 'center', gap: 4 },
  techRating:       { fontSize: 12, fontWeight: '700', color: FORE, fontFamily: 'Inter_700Bold' },
  techReviews:      { fontSize: 12, color: MUTED, fontFamily: 'Inter_400Regular' },
  techDot:          { width: 3, height: 3, borderRadius: 2, backgroundColor: BORDER, marginHorizontal: 2 },
  techMetaTxt:      { fontSize: 12, color: MUTED, fontFamily: 'Inter_400Regular' },
  techRight:        { alignItems: 'flex-end', gap: 8 },
  techTime:         { flexDirection: 'row', alignItems: 'center', gap: 4 },
  techTimeTxt:      { fontSize: 12, fontWeight: '600', color: GREEN, fontFamily: 'Inter_600SemiBold' },
  bookBtn:          { backgroundColor: PRIMARY, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  bookBtnTxt:       { fontSize: 13, fontWeight: '700', color: '#FFF', fontFamily: 'Inter_700Bold' },
});
