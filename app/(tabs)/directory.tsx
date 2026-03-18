import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, Pressable, Platform,
  RefreshControl, ScrollView, Animated, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { useApp } from '@/lib/context';
import { UserRole, ROLE_LABELS } from '@/lib/types';
import DirectoryMap from '@/components/DirectoryMap';
import { apiRequest, getApiUrl } from '@/lib/query-client';

// Light Theme Design Tokens
const PRIMARY   = '#10B981';
const PRIMARY_L = '#D1FAE5';
const BG        = '#FFFFFF';
const CARD      = '#F9FAFB';
const BORDER    = '#E5E7EB';
const DARK      = '#111827';
const GRAY      = '#6B7280';
const SUCCESS   = '#10B981';


const ROLE_FILTERS_ALL: { key: UserRole | 'all'; label: string }[] = [
  { key: 'all',          label: 'All' },
  { key: 'technician',   label: 'Technicians' },
  { key: 'teacher',      label: 'Teachers' },
  { key: 'supplier',     label: 'Suppliers' },
  { key: 'shopkeeper',   label: 'Shopkeepers' },
  { key: 'job_provider', label: 'Jobs' },
];

const ROLE_FILTERS_CUSTOMER: { key: UserRole | 'all'; label: string }[] = [
  { key: 'technician',   label: 'Technicians' },
  { key: 'shopkeeper',   label: 'Shopkeepers' },
];

type OnlineStats = Record<string, { registered: number; online: number }>;

const STAT_CONFIG: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; iconColor: string; iconBg: string; cornerBg: string }[] = [
  { key: 'technician', label: 'Technicians',  icon: 'construct',  iconColor: '#2563EB', iconBg: '#DBEAFE', cornerBg: '#EFF6FF' },
  { key: 'customer',   label: 'Customers',    icon: 'people',     iconColor: '#7C3AED', iconBg: '#EDE9FE', cornerBg: '#F5F3FF' },
  { key: 'teacher',    label: 'Teachers',     icon: 'school',     iconColor: '#EA580C', iconBg: '#FFEDD5', cornerBg: '#FFF7ED' },
  { key: 'supplier',   label: 'Suppliers',    icon: 'cube',       iconColor: '#0D9488', iconBg: '#CCFBF1', cornerBg: '#F0FDFA' },
  { key: 'shopkeeper', label: 'Shopkeepers',  icon: 'storefront',  iconColor: '#8B5CF6', iconBg: '#F5F3FF', cornerBg: '#F5F3FF' },
];

const ROLE_MAP_COLORS: Record<string, string> = {
  technician: '#34C759',
  teacher: '#FFD60A',
  supplier: '#FF6B2C',
  shopkeeper: '#8B5CF6',
  customer: '#FF2D55',
  job_provider: '#5E8BFF',
};

const ROLE_BADGE: Record<string, { bg: string; text: string }> = {
  technician:   { bg: '#DBEAFE', text: '#1D4ED8' },
  teacher:      { bg: '#EDE9FE', text: '#7C3AED' },
  supplier:     { bg: '#CCFBF1', text: '#0D9488' },
  shopkeeper:   { bg: '#F5F3FF', text: '#8B5CF6' },
  job_provider: { bg: '#DBEAFE', text: '#1D4ED8' },
  customer:     { bg: '#FEE2E2', text: '#DC2626' },
};

function getInitials(name: string) {
  if (!name) return '??';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function LivePing() {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.2, duration: 750, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 750, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <View style={{ width: 8, height: 8, position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: SUCCESS, opacity: anim }} />
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: SUCCESS }} />
    </View>
  );
}

function LiveCountPills({ stats, isCustomer }: { stats: OnlineStats | null; isCustomer?: boolean }) {
  const roles = isCustomer ? [
    { key: 'technician', label: 'Technicians', icon: 'construct' as const, color: '#2563EB' },
    { key: 'shopkeeper', label: 'Shopkeepers', icon: 'storefront' as const, color: '#8B5CF6' },
  ] : [
    { key: 'technician', label: 'Technicians', icon: 'construct' as const, color: '#2563EB' },
    { key: 'teacher', label: 'Teachers', icon: 'school' as const, color: '#EA580C' },
    { key: 'supplier', label: 'Suppliers', icon: 'cube' as const, color: '#0D9488' },
    { key: 'shopkeeper', label: 'Shopkeepers', icon: 'storefront' as const, color: '#8B5CF6' },
    { key: 'customer', label: 'Customers', icon: 'people' as const, color: '#7C3AED' },
  ];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.liveCountsContainer} style={{ backgroundColor: CARD, paddingVertical: 6, marginBottom: 0 }}>
      {roles.map(role => {
        const online = stats?.[role.key]?.online || 0;
        const registered = stats?.[role.key]?.registered || 0;
        return (
          <View key={role.key} style={[styles.liveCountPill, { borderLeftColor: role.color }]}>
            <Ionicons name={role.icon} size={13} color={role.color} />
            <Text style={styles.liveCountLabel}>{role.label}</Text>
            <View style={styles.liveCountDot} />
            <Text style={styles.liveCountNumber}>{online}/{registered}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

interface ProfCardProps {
  item: {
    id: string; name: string; role: UserRole; city: string;
    skills: string[]; avatar: string; isOnline: boolean; distance?: number;
  };
  onChat?: () => void;
  onCall?: () => void;
  onPress?: () => void;
}

function ProfCard({ item, onChat, onCall, onPress }: ProfCardProps) {
  const badge = ROLE_BADGE[item.role] ?? { bg: '#F3F4F6', text: '#374151' };
  const skillLabel = item.skills[0] || ROLE_LABELS[item.role] || item.role;
  const avatarUri = item.avatar
    ? (item.avatar.startsWith('http') ? item.avatar : `${getApiUrl()}${item.avatar}`)
    : null;
  
  // Show Chat/Call buttons for Supplier, Teacher, and Shopkeeper; others click to profile
  const showButtons = item.role === 'supplier' || item.role === 'teacher' || item.role === 'shopkeeper';

  return (
    <Pressable style={styles.card} onPress={onPress}>
      {/* Top row */}
      <View style={styles.cardTop}>
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitials}>{getInitials(item.name)}</Text>
            </View>
          )}
          <View style={[styles.onlineDot, { backgroundColor: item.isOnline ? SUCCESS : '#D1D5DB' }]} />
        </View>

        {/* Info */}
        <View style={styles.cardInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
            <Ionicons name="checkmark-circle" size={14} color={PRIMARY} />
          </View>

          <View style={styles.badgeRow}>
            <View style={[styles.roleBadge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.roleBadgeText, { color: badge.text }]}>{skillLabel}</Text>
            </View>
            {item.distance !== undefined && item.distance !== null ? (
              <View style={[styles.ratingRow, { backgroundColor: '#FEE2E2', paddingHorizontal: 8, borderRadius: 4 }]}>
                <Ionicons name="location" size={10} color="#DC2626" />
                <Text style={[styles.ratingText, { color: '#DC2626' }]}>{item.distance.toFixed(1)} km</Text>
              </View>
            ) : item.city ? (
              <View style={[styles.ratingRow, { backgroundColor: '#DBEAFE', paddingHorizontal: 8, borderRadius: 4 }]}>
                <Ionicons name="location" size={10} color="#2563EB" />
                <Text style={[styles.ratingText, { color: '#2563EB' }]}>{item.city}</Text>
              </View>
            ) : (
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={10} color="#FBBF24" />
                <Text style={styles.ratingText}>4.8 (120)</Text>
              </View>
            )}
          </View>

          {item.skills.length > 0 ? (
            <Text style={styles.locationText} numberOfLines={1}>{item.skills.slice(0, 2).join(' · ')}</Text>
          ) : null}
        </View>
      </View>

      {/* Footer buttons - Only show for Supplier and Teacher */}
      {showButtons ? (
        <View style={styles.cardFooter}>
          <Pressable style={styles.chatBtn} onPress={onChat}>
            <Ionicons name="chatbubble-outline" size={13} color={DARK} />
            <Text style={styles.chatBtnText}>Chat</Text>
          </Pressable>
          <Pressable style={styles.callBtn} onPress={onCall}>
            <Ionicons name="call" size={13} color="#FFF" />
            <Text style={styles.callBtnText}>Call</Text>
          </Pressable>
          <Pressable style={styles.chevronBtn} onPress={onPress}>
            <Ionicons name="chevron-forward" size={13} color={GRAY} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.cardFooter}>
          <Pressable style={[styles.chatBtn, { flex: 1 }]} onPress={onPress}>
            <Ionicons name="chatbubble-outline" size={13} color={DARK} />
            <Text style={styles.chatBtnText}>View Profile</Text>
          </Pressable>
          <Pressable style={styles.chevronBtn} onPress={onPress}>
            <Ionicons name="chevron-forward" size={13} color={GRAY} />
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

export default function DirectoryScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ view?: string }>();
  const { allProfiles, profile, startConversation, refreshData } = useApp();
  const isCustomer = profile?.role === 'customer';
  const [search, setSearch]         = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>(isCustomer ? 'technician' : 'all');
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats]           = useState<OnlineStats | null>(null);
  const [viewMode, setViewMode]     = useState<'list' | 'map'>(params.view === 'map' ? 'map' : 'list');
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const topPad = (Platform.OS === 'web' ? 67 : insets.top) + 12;

  useEffect(() => { if (params.view === 'map') setViewMode('map'); }, [params.view]);

  // Start continuous location tracking
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          unsubscribe = Location.watchPositionAsync(
            { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
            (location) => {
              setUserLocation({ latitude: location.coords.latitude, longitude: location.coords.longitude });
              setLocationError(null);
            }
          ).then(sub => sub.remove);
        } else {
          setLocationError('Location permission denied');
        }
      } catch (error) {
        setLocationError('Unable to get location');
      }
    })();
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  const fetchStats = useCallback(async () => {
    try { const res = await apiRequest('GET', '/api/stats/online'); setStats(await res.json()); } catch {}
  }, []);

  useEffect(() => {
    fetchStats();
    const iv = setInterval(fetchStats, 10000);
    return () => clearInterval(iv);
  }, [fetchStats]);

  const directory = useMemo(() => {
    const now = Date.now();
    const THR = 5 * 60 * 1000;
    return allProfiles.map(p => ({
      id: p.id, name: p.name, role: p.role as UserRole,
      city: p.city || '', skills: Array.isArray(p.skills) ? p.skills : [],
      avatar: p.avatar || '',
      isOnline: !!(p as any).lastSeen && now - (p as any).lastSeen < THR,
      latitude:  (p as any).latitude  ? parseFloat((p as any).latitude)  : null,
      longitude: (p as any).longitude ? parseFloat((p as any).longitude) : null,
      locationSharing: (p as any).locationSharing,
    }));
  }, [allProfiles]);

  const filtered = useMemo(() => {
    let list = directory;
    // For customers, exclude teachers and suppliers (only show technicians and shopkeepers)
    if (isCustomer) {
      list = list.filter(e => e.role !== 'teacher' && e.role !== 'supplier');
    }
    if (roleFilter !== 'all') list = list.filter(e => e.role === roleFilter);
    if (search.trim()) { const q = search.toLowerCase(); list = list.filter(e => e.name.toLowerCase().includes(q) || e.city.toLowerCase().includes(q) || e.skills.some(s => s.toLowerCase().includes(q))); }
    
    // Add distance calculations if user location is available
    if (userLocation) {
      list = list.map(item => {
        if (item.latitude && item.longitude && !isNaN(item.latitude) && !isNaN(item.longitude)) {
          const distance = calculateDistance(userLocation.latitude, userLocation.longitude, item.latitude, item.longitude);
          return { ...item, distance };
        }
        return item;
      });
      // Sort by distance (nearest first)
      list.sort((a, b) => {
        const distA = a.distance ?? Infinity;
        const distB = b.distance ?? Infinity;
        return distA - distB;
      });
    }
    return list;
  }, [directory, roleFilter, search, userLocation, isCustomer]);

  const mapProfiles = useMemo(() => filtered.filter(p => p.latitude && p.longitude && !isNaN(p.latitude!) && !isNaN(p.longitude!) && (p.role !== 'customer' || p.locationSharing === 'true')).map(p => ({ id: p.id, latitude: p.latitude!, longitude: p.longitude!, name: p.name, role: ROLE_LABELS[p.role] || p.role, roleKey: p.role, city: p.city, skills: p.skills, color: ROLE_MAP_COLORS[p.role] || '#1D4ED8', avatar: p.avatar, isOnline: p.isOnline, lastSeen: 0 })), [filtered]);

  const handleMapChat = useCallback(async (id: string) => {
    const p = allProfiles.find(p => p.id === id);
    if (p) { const c = await startConversation(p.id, p.name, p.role); if (c) router.push({ pathname: '/chat/[id]', params: { id: c } }); }
  }, [allProfiles, startConversation]);

  const onRefresh = async () => { setRefreshing(true); await Promise.all([refreshData(), fetchStats()]); setRefreshing(false); };

  if (viewMode === 'map') {
    return (
      <View style={{ flex: 1, backgroundColor: BG }}>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, paddingTop: topPad, paddingHorizontal: 12, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.95)' }}>
          <Pressable style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center' }} onPress={() => setViewMode('list')}>
            <Ionicons name="list" size={18} color="#FFF" />
          </Pressable>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, gap: 8 }}>
            <Ionicons name="search" size={16} color={GRAY} />
            <TextInput style={{ flex: 1, fontSize: 14, color: DARK, padding: 0 }} placeholder="Search..." placeholderTextColor={GRAY} value={search} onChangeText={setSearch} />
          </View>
        </View>
        <DirectoryMap markers={mapProfiles} onMarkerPress={(id) => router.push({ pathname: '/user-profile', params: { id } })} onChatPress={handleMapChat} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Fixed Header Section */}
      <View style={[styles.fixedHeader, { paddingTop: topPad }]}>
        {/* Search bar + Map button */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color={GRAY} style={{ marginLeft: 4 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by skill, repair type, name or city..."
              placeholderTextColor={GRAY}
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <Pressable style={styles.mapBtn} onPress={() => setViewMode('map')}>
            <Ionicons name="map-outline" size={16} color={PRIMARY} />
          </Pressable>
        </View>

        {/* Live Count Pills */}
        <LiveCountPills stats={stats} isCustomer={profile?.role === 'customer'} />

        {/* Role Filter Tabs - Fixed */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} style={{ backgroundColor: BG, paddingVertical: 6 }}>
          {(profile?.role === 'customer' ? ROLE_FILTERS_CUSTOMER : ROLE_FILTERS_ALL).map(f => (
            <Pressable
              key={f.key}
              style={[styles.tab, roleFilter === f.key && styles.tabActive]}
              onPress={() => setRoleFilter(f.key)}
            >
              <Text style={[styles.tabText, roleFilter === f.key && styles.tabTextActive]}>{f.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Scrollable Profile List */}
      <FlatList style={{ flex: 1 }}
        data={filtered}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} colors={[PRIMARY]} />}
        contentContainerStyle={{ paddingBottom: Platform.OS === 'web' ? 118 : 100 }}
        renderItem={({ item }) => {
          const prof = allProfiles.find(p => p.id === item.id);
          const phone = prof?.phone;
          const showCall = (item.role === 'supplier' || item.role === 'teacher' || item.role === 'shopkeeper') && phone;
          return (
          <ProfCard
            item={item}
            onPress={() => {
              // Route suppliers/teachers/shopkeepers to shop, others to profile
              if (item.role === 'supplier' || item.role === 'teacher' || item.role === 'shopkeeper') {
                router.push({ pathname: '/shop/[supplierId]', params: { supplierId: item.id, supplierName: item.name } } as any);
              } else {
                router.push({ pathname: '/user-profile', params: { id: item.id } });
              }
            }}
            onChat={item.id !== profile?.id && item.role !== 'customer' ? async () => {
              const c = await startConversation(item.id, item.name, item.role);
              if (c) router.push({ pathname: '/chat/[id]', params: { id: c } });
            } : undefined}
            onCall={showCall ? () => Linking.openURL(`tel:+91${phone}`) : undefined}
          />);
        }}
        ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={48} color={GRAY} />
            <Text style={styles.emptyTitle}>No professionals found</Text>
            <Text style={styles.emptyText}>Try changing your filters or search term</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  // Fixed Header
  fixedHeader: {
    backgroundColor: CARD,
    paddingHorizontal: 16,
    paddingBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    zIndex: 100,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 8 },
  searchContainer: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 },

  // Header
  header: {
    backgroundColor: CARD,
    paddingHorizontal: 16,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 16,
  },
  locationSelector: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  locationCity: { fontSize: 13, color: GRAY, fontFamily: 'Inter_500Medium' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, gap: 12 },
  headerTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', color: DARK, lineHeight: 30 },
  headerSub: { fontSize: 12, color: GRAY, fontFamily: 'Inter_400Regular', marginTop: 4, maxWidth: 220 },
  headerBtns: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingTop: 4 },
  mapBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: PRIMARY_L, alignItems: 'center', justifyContent: 'center',
  },
  mapBtnText: { fontSize: 13, color: PRIMARY, fontFamily: 'Inter_600SemiBold' },
  menuBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  searchBar: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F3F4F6', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 13, color: DARK, fontFamily: 'Inter_400Regular', padding: 0 },
  filterBtn: { width: 30, height: 30, borderRadius: 10, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center' },
  chipsScroll: { marginBottom: 4 },
  chips: { gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, backgroundColor: '#F3F4F6',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  chipActive: { backgroundColor: PRIMARY_L, borderColor: PRIMARY },
  chipText: { fontSize: 11, color: GRAY, fontFamily: 'Inter_500Medium' },
  chipTextActive: { color: PRIMARY },

  // Stats
  statsScroll: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  statCard: {
    width: 168, backgroundColor: CARD, borderRadius: 20,
    padding: 10, marginVertical: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2,
    borderWidth: 1, borderColor: '#F3F4F6', overflow: 'hidden', position: 'relative',
  },
  statCorner: { position: 'absolute', top: -20, right: -20, width: 60, height: 60, borderRadius: 30 },
  statInner: { position: 'relative', zIndex: 1 },
  statTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  statIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  liveChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ECFDF5', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  liveText: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: '#065F46' },
  statLabel: { fontSize: 12, color: GRAY, fontFamily: 'Inter_500Medium' },
  statCount: { fontSize: 24, fontFamily: 'Inter_700Bold', color: DARK, marginTop: 2 },

  // Tabs
  tabs: { paddingHorizontal: 16, gap: 6 },
  tab: {
    paddingHorizontal: 18, paddingVertical: 8,
    borderRadius: 20, backgroundColor: CARD,
    borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1,
  },
  tabActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  tabText: { fontSize: 13, color: GRAY, fontFamily: 'Inter_500Medium' },
  tabTextActive: { color: '#FFF', fontFamily: 'Inter_600SemiBold' },

  // Card
  card: {
    marginHorizontal: 12,
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 3,
    marginBottom: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 1,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  cardTop: { flexDirection: 'row', gap: 6 },
  avatarWrap: { position: 'relative', flexShrink: 0 },
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: '#FFF' },
  avatarFallback: { backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 13, fontFamily: 'Inter_700Bold', color: PRIMARY },
  onlineDot: { position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: CARD },
  cardInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 1 },
  cardName: { fontSize: 12, fontFamily: 'Inter_700Bold', color: DARK, flex: 1 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 1 },
  roleBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  roleBadgeText: { fontSize: 9, fontFamily: 'Inter_600SemiBold' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingText: { fontSize: 9, color: GRAY, fontFamily: 'Inter_400Regular' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  locationText: { fontSize: 9, color: GRAY, fontFamily: 'Inter_400Regular', flex: 1 },
  distancePill: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: PRIMARY_L, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  distanceText: { fontSize: 9, color: PRIMARY, fontFamily: 'Inter_600SemiBold' },

  // Card footer
  cardFooter: { flexDirection: 'row', gap: 3, marginTop: 2, paddingTop: 2, borderTopWidth: 1, borderTopColor: '#F9FAFB' },
  chatBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2,
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8,
    paddingVertical: 4, backgroundColor: CARD,
  },
  chatBtnText: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: '#374151' },
  callBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2,
    backgroundColor: PRIMARY, borderRadius: 8, paddingVertical: 4,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2,
  },
  callBtnText: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: '#FFF' },
  chevronBtn: { width: 30, backgroundColor: '#F3F4F6', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  // Live Count Pills
  liveCountsContainer: { paddingHorizontal: 16, gap: 6 },
  liveCountPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    height: 32, paddingHorizontal: 10, paddingVertical: 0,
    backgroundColor: '#F9FAFB', borderRadius: 16,
    borderWidth: 1, borderColor: '#E5E7EB', borderLeftWidth: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1,
  },
  liveCountLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: DARK },
  liveCountDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: SUCCESS, marginHorizontal: 2 },
  liveCountNumber: { fontSize: 11, fontFamily: 'Inter_700Bold', color: SUCCESS, minWidth: 18 },

  // Empty
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: DARK },
  emptyText: { fontSize: 13, color: GRAY, fontFamily: 'Inter_400Regular', textAlign: 'center', paddingHorizontal: 32 },
});
