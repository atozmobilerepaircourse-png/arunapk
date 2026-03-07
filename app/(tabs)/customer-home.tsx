import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput,
  ScrollView, Dimensions, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useApp } from '@/lib/context';
import { apiRequest } from '@/lib/query-client';

const { width: SW } = Dimensions.get('window');

const BG       = '#F5F5F5';
const CARD     = '#FFFFFF';
const BORDER   = '#EBEBEB';
const FORE     = '#1A1A1A';
const MUTED    = '#888888';
const PRIMARY  = '#E8704A';
const PRIMARY_L = '#FFF1EC';
const BLUE     = '#4A90D9';
const BLUE_L   = '#E8F2FB';
const GREEN    = '#27AE60';
const GREEN_L  = '#E8F5ED';
const PURPLE   = '#9B6DD4';
const PURPLE_L = '#F3ECFC';
const AMBER    = '#F59E0B';

const SERVICES = [
  { id: 'screen',  icon: 'phone-portrait-outline',   label: 'Screen',       color: BLUE,   bg: BLUE_L    },
  { id: 'battery', icon: 'battery-charging-outline', label: 'Battery',      color: GREEN,  bg: GREEN_L   },
  { id: 'back',    icon: 'shield-outline',            label: 'Back Panel',   color: PURPLE, bg: PURPLE_L  },
  { id: 'full',    icon: 'construct-outline',         label: 'Full Service', color: PRIMARY, bg: PRIMARY_L },
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

function etaFromDist(km: number): string {
  const mins = Math.max(5, Math.round(km * 8 + 4));
  return `${mins} mins`;
}

function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  const x = Math.sin(Math.abs(h)) * 10000;
  return x - Math.floor(x);
}

function techRating(id: string) {
  const r = seededRandom(id + 'rating');
  return (4.3 + r * 0.7).toFixed(1);
}

function techReviews(id: string) {
  const r = seededRandom(id + 'reviews');
  return String(Math.floor(200 + r * 800));
}

export default function CustomerHomeScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useApp();
  const [techs, setTechs]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [search, setSearch]   = useState('');
  const locationFetched = useRef(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom + 16;

  const firstName = profile?.name?.split(' ')[0] ?? 'User';
  const city = profile?.city
    ? `${profile.city}${profile.state ? `, ${profile.state}` : ''}`
    : 'Detecting location...';

  const fetchTechs = useCallback(async (lat?: number, lng?: number) => {
    try {
      setLoading(true);
      let url: string;
      if (lat != null && lng != null) {
        url = `/api/technicians/nearby?lat=${lat}&lng=${lng}&radius=50`;
      } else {
        url = '/api/technicians/nearby?lat=17.3850&lng=78.4867&radius=50';
      }
      const res  = await apiRequest('GET', url);
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.technicians ?? []);
      setTechs(list.slice(0, 6));
    } catch {
      setTechs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (locationFetched.current) return;
    locationFetched.current = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setUserLat(loc.coords.latitude);
          setUserLng(loc.coords.longitude);
          fetchTechs(loc.coords.latitude, loc.coords.longitude);
        } else {
          fetchTechs();
        }
      } catch {
        fetchTechs();
      }
    })();
  }, [fetchTechs]);

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
      {/* ── Header ────────────────────────────────────────────────────────── */}
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

      {/* ── Location ──────────────────────────────────────────────────────── */}
      <Pressable style={styles.locationRow}>
        <Ionicons name="location-outline" size={15} color={PRIMARY} />
        <Text style={styles.locationText} numberOfLines={1}>{city}</Text>
        <Ionicons name="chevron-forward" size={14} color={MUTED} />
      </Pressable>

      {/* ── Search ────────────────────────────────────────────────────────── */}
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

      {/* ── Promo Banner ──────────────────────────────────────────────────── */}
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

      {/* ── Quick Services ────────────────────────────────────────────────── */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Quick Services</Text>
        <Pressable onPress={() => go('/technician-map')}>
          <Text style={styles.seeAll}>Find Technician</Text>
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

      {/* ── Nearby Technicians ────────────────────────────────────────────── */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Nearby Technicians</Text>
        <Pressable onPress={() => go('/technician-map')}>
          <Text style={styles.seeAll}>View All</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={PRIMARY} style={{ marginVertical: 28 }} />
      ) : techs.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="people-outline" size={36} color={MUTED} />
          <Text style={styles.emptyTxt}>No technicians found nearby</Text>
          <Text style={styles.emptySubTxt}>Try expanding your search area</Text>
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

// ── Tech Card ───────────────────────────────────────────────────────────────
function TechCard({ tech }: { tech: any }) {
  const { profile, startConversation } = useApp();
  const distNum  = typeof tech.distance === 'number' ? tech.distance : null;
  const distStr  = distNum != null ? `${distNum.toFixed(1)} km` : null;
  const eta      = distNum != null ? etaFromDist(distNum) : `${15 + Math.floor(seededRandom(tech.id + 'eta') * 20)} mins`;
  const rating   = techRating(tech.id ?? '0');
  const reviews  = techReviews(tech.id ?? '0');
  const isVerified = tech.blocked !== 1;

  const handleChat = async () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (tech.id) {
      // Open technician's profile where user can see details and chat option
      router.push({ pathname: '/user-profile', params: { id: tech.id } });
    }
  };

  return (
    <View style={styles.techCard}>
      {/* Avatar */}
      <View style={styles.avatarWrap}>
        {tech.avatar ? (
          <Image
            source={{ uri: tech.avatar }}
            style={styles.avatar}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitials}>{initials(tech.name)}</Text>
          </View>
        )}
        {tech.availableForJobs !== 'false' && <View style={styles.onlineDot} />}
      </View>

      {/* Info */}
      <View style={styles.techInfo}>
        {/* Name + Verified */}
        <View style={styles.techNameRow}>
          <Text style={styles.techName} numberOfLines={1}>{tech.name ?? 'Technician'}</Text>
          {isVerified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={11} color="#27AE60" />
              <Text style={styles.verifiedTxt}>Verified</Text>
            </View>
          )}
        </View>

        {/* Title */}
        <Text style={styles.techTitle}>Mobile Repair Expert</Text>

        {/* Rating + Distance */}
        <View style={styles.techMeta}>
          <Ionicons name="star" size={12} color={AMBER} />
          <Text style={styles.ratingTxt}>{rating}</Text>
          <Text style={styles.reviewsTxt}>({reviews})</Text>
          {distStr && (
            <>
              <View style={styles.metaDivider} />
              <Ionicons name="location-outline" size={12} color={MUTED} />
              <Text style={styles.distTxt}>{distStr}</Text>
            </>
          )}
        </View>
      </View>

      {/* Right side */}
      <View style={styles.techRight}>
        <View style={styles.etaRow}>
          <Ionicons name="time-outline" size={12} color={GREEN} />
          <Text style={styles.etaTxt}>{eta}</Text>
        </View>
        <Pressable style={styles.chatBtn} onPress={handleChat}>
          <Ionicons name="chatbubble-outline" size={16} color="#FFF" />
        </Pressable>
      </View>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const SHADOW = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 },
  android: { elevation: 3 },
  default: { boxShadow: '0 2px 8px rgba(0,0,0,0.07)' },
});

const styles = StyleSheet.create({
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  greetText:      { fontSize: 13, fontFamily: 'Inter_400Regular', color: MUTED },
  nameText:       { fontSize: 22, fontFamily: 'Inter_700Bold', color: FORE, marginTop: 1 },
  bellBtn:        { width: 42, height: 42, borderRadius: 21, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center', ...SHADOW },
  bellDot:        { position: 'absolute', top: 9, right: 9, width: 9, height: 9, borderRadius: 5, backgroundColor: PRIMARY, borderWidth: 2, borderColor: CARD },

  locationRow:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 14 },
  locationText:   { fontSize: 13, fontFamily: 'Inter_400Regular', color: MUTED, flex: 1 },

  searchBox:      { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 14, paddingHorizontal: 14, height: 50, marginBottom: 18, ...SHADOW },
  searchInput:    { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', color: FORE },

  banner:         { borderRadius: 18, marginBottom: 24, overflow: 'hidden', backgroundColor: PRIMARY, flexDirection: 'row', alignItems: 'center', minHeight: 152, ...SHADOW },
  bannerContent:  { flex: 1, padding: 18, zIndex: 1 },
  bannerBadge:    { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10 },
  bannerBadgeTxt: { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#FFF' },
  bannerTitle:    { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#FFF', marginBottom: 6 },
  bannerDesc:     { fontSize: 13, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.88)', marginBottom: 14 },
  bannerBtn:      { alignSelf: 'flex-start', backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 22 },
  bannerBtnTxt:   { fontSize: 13, fontFamily: 'Inter_700Bold', color: PRIMARY },
  bannerShield:   { paddingRight: 14, alignItems: 'center', justifyContent: 'center' },

  sectionRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle:   { fontSize: 17, fontFamily: 'Inter_700Bold', color: FORE },
  seeAll:         { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: PRIMARY },

  servicesGrid:   { flexDirection: 'row', gap: 10, marginBottom: 26 },
  serviceCard:    { flex: 1, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 14, paddingVertical: 14, alignItems: 'center', gap: 8, ...SHADOW },
  serviceIcon:    { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  serviceLabel:   { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: FORE, textAlign: 'center' },

  techList:       { gap: 12, marginBottom: 16 },
  emptyBox:       { alignItems: 'center', paddingVertical: 36, gap: 8 },
  emptyTxt:       { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: FORE },
  emptySubTxt:    { fontFamily: 'Inter_400Regular', fontSize: 13, color: MUTED },

  techCard: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...SHADOW,
  },

  avatarWrap: { position: 'relative' },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: '#EEE',
  },
  avatarFallback: {
    backgroundColor: PRIMARY_L,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#FFD5C2',
  },
  avatarInitials: { fontSize: 18, fontFamily: 'Inter_700Bold', color: PRIMARY },
  onlineDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: GREEN, borderWidth: 2, borderColor: CARD,
  },

  techInfo:     { flex: 1, minWidth: 0 },
  techNameRow:  { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2, flexWrap: 'wrap' },
  techName:     { fontSize: 15, fontFamily: 'Inter_700Bold', color: FORE, flexShrink: 1 },

  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#E8F5ED', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8,
  },
  verifiedTxt:  { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#27AE60' },

  techTitle:    { fontSize: 12, fontFamily: 'Inter_400Regular', color: MUTED, marginBottom: 5 },

  techMeta:     { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingTxt:    { fontSize: 12, fontFamily: 'Inter_700Bold', color: FORE },
  reviewsTxt:   { fontSize: 11, fontFamily: 'Inter_400Regular', color: MUTED },
  metaDivider:  { width: 3, height: 3, borderRadius: 2, backgroundColor: BORDER, marginHorizontal: 3 },
  distTxt:      { fontSize: 11, fontFamily: 'Inter_400Regular', color: MUTED },

  techRight:    { alignItems: 'flex-end', gap: 10 },
  etaRow:       { flexDirection: 'row', alignItems: 'center', gap: 3 },
  etaTxt:       { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: GREEN },

  chatBtn: {
    backgroundColor: PRIMARY,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
