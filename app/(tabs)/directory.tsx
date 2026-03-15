import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, Pressable, Platform,
  RefreshControl, ScrollView, Animated, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useApp } from '@/lib/context';
import { UserRole, ROLE_LABELS } from '@/lib/types';
import DirectoryMap from '@/components/DirectoryMap';
import { apiRequest, getApiUrl } from '@/lib/query-client';

// UX Pilot exact design tokens
const PRIMARY   = '#1D4ED8';
const PRIMARY_L = '#E0E7FF';
const BG        = '#F9FAFB';
const CARD      = '#FFFFFF';
const BORDER    = '#F3F4F6';
const DARK      = '#111827';
const GRAY      = '#6B7280';
const SUCCESS   = '#10B981';

const CATEGORY_CHIPS = ['Mobile repair', 'AC technician', 'Plumbing', 'Electrician', 'Carpentry'];

const ROLE_FILTERS: { key: UserRole | 'all'; label: string }[] = [
  { key: 'all',          label: 'All' },
  { key: 'technician',   label: 'Technicians' },
  { key: 'teacher',      label: 'Teachers' },
  { key: 'supplier',     label: 'Suppliers' },
  { key: 'job_provider', label: 'Jobs' },
];

type OnlineStats = Record<string, { registered: number; online: number }>;

const STAT_CONFIG: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; iconColor: string; iconBg: string; cornerBg: string }[] = [
  { key: 'technician', label: 'Technicians',  icon: 'construct',  iconColor: '#2563EB', iconBg: '#DBEAFE', cornerBg: '#EFF6FF' },
  { key: 'customer',   label: 'Customers',    icon: 'people',     iconColor: '#7C3AED', iconBg: '#EDE9FE', cornerBg: '#F5F3FF' },
  { key: 'teacher',    label: 'Teachers',     icon: 'school',     iconColor: '#EA580C', iconBg: '#FFEDD5', cornerBg: '#FFF7ED' },
  { key: 'supplier',   label: 'Suppliers',    icon: 'cube',       iconColor: '#0D9488', iconBg: '#CCFBF1', cornerBg: '#F0FDFA' },
];

const ROLE_MAP_COLORS: Record<string, string> = {
  technician: '#34C759',
  teacher: '#FFD60A',
  supplier: '#FF6B2C',
  customer: '#FF2D55',
  job_provider: '#5E8BFF',
};

const ROLE_BADGE: Record<string, { bg: string; text: string }> = {
  technician:   { bg: '#DBEAFE', text: '#1D4ED8' },
  teacher:      { bg: '#EDE9FE', text: '#7C3AED' },
  supplier:     { bg: '#CCFBF1', text: '#0D9488' },
  job_provider: { bg: '#DBEAFE', text: '#1D4ED8' },
  customer:     { bg: '#FEE2E2', text: '#DC2626' },
};

function getInitials(name: string) {
  if (!name) return '??';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
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

interface ProfCardProps {
  item: {
    id: string; name: string; role: UserRole; city: string;
    skills: string[]; avatar: string; isOnline: boolean;
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
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={10} color="#FBBF24" />
              <Text style={styles.ratingText}>4.8 (120)</Text>
            </View>
          </View>

          {item.skills.length > 0 ? (
            <Text style={styles.locationText} numberOfLines={1}>{item.skills.slice(0, 2).join(' · ')}</Text>
          ) : null}
        </View>
      </View>

      {/* Footer buttons */}
      <View style={styles.cardFooter}>
        <Pressable style={styles.chatBtn} onPress={onChat}>
          <Ionicons name="chatbubble-outline" size={13} color="#374151" />
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
    </Pressable>
  );
}

export default function DirectoryScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ view?: string }>();
  const { allProfiles, profile, startConversation, refreshData } = useApp();
  const [search, setSearch]         = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [chipFilter, setChipFilter] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats]           = useState<OnlineStats | null>(null);
  const [viewMode, setViewMode]     = useState<'list' | 'map'>(params.view === 'map' ? 'map' : 'list');

  const topPad = (Platform.OS === 'web' ? 67 : insets.top) + 12;

  useEffect(() => { if (params.view === 'map') setViewMode('map'); }, [params.view]);

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
    if (roleFilter !== 'all') list = list.filter(e => e.role === roleFilter);
    if (chipFilter) { const q = chipFilter.toLowerCase(); list = list.filter(e => e.skills.some(s => s.toLowerCase().includes(q))); }
    if (search.trim()) { const q = search.toLowerCase(); list = list.filter(e => e.name.toLowerCase().includes(q) || e.city.toLowerCase().includes(q) || e.skills.some(s => s.toLowerCase().includes(q))); }
    return list;
  }, [directory, roleFilter, chipFilter, search]);

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
        {/* Menu button */}
        <View style={styles.headerRow}>
          <Pressable style={styles.menuBtn} onPress={() => {}}>
            <Ionicons name="menu" size={18} color={GRAY} />
          </Pressable>
        </View>

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

        {/* Category chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipsScroll}>
          {CATEGORY_CHIPS.map(chip => (
            <Pressable key={chip} style={[styles.chip, chipFilter === chip && styles.chipActive]} onPress={() => setChipFilter(chipFilter === chip ? '' : chip)}>
              <Text style={[styles.chipText, chipFilter === chip && styles.chipTextActive]}>{chip}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Stats Cards - Fixed */}
        {stats && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsScroll} style={{ backgroundColor: BG }}>
            {STAT_CONFIG.map(cfg => {
                  const s = stats[cfg.key];
                  if (!s) return null;
                  return (
                    <View key={cfg.key} style={styles.statCard}>
                      {/* Corner decoration */}
                      <View style={[styles.statCorner, { backgroundColor: cfg.cornerBg }]} />
                      <View style={styles.statInner}>
                        <View style={styles.statTopRow}>
                          <View style={[styles.statIcon, { backgroundColor: cfg.iconBg }]}>
                            <Ionicons name={cfg.icon} size={18} color={cfg.iconColor} />
                          </View>
                          <View style={styles.liveChip}>
                            <LivePing />
                            <Text style={styles.liveText}>{s.online} Live</Text>
                          </View>
                        </View>
                        <Text style={styles.statLabel}>{cfg.label}</Text>
                        <Text style={styles.statCount}>{s.registered.toLocaleString()}</Text>
                      </View>
                    </View>
                  );
            })}
          </ScrollView>
        )}

        {/* Role Filter Tabs - Fixed */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} style={{ backgroundColor: BG, paddingVertical: 8 }}>
          {ROLE_FILTERS.map(f => (
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
          return (
          <ProfCard
            item={item}
            onPress={() => router.push({ pathname: '/user-profile', params: { id: item.id } })}
            onChat={item.id !== profile?.id && item.role !== 'customer' ? async () => {
              const c = await startConversation(item.id, item.name, item.role);
              if (c) router.push({ pathname: '/chat/[id]', params: { id: c } });
            } : undefined}
            onCall={phone ? () => Linking.openURL(`tel:${phone}`) : undefined}
          />);
        }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={48} color={GRAY} />
            <Text style={styles.emptyTitle}>No professionals found</Text>
            <Text style={styles.emptyText}>Try changing your filters or search term</Text>
          </View>
        }
        ListFooterComponent={
          filtered.length > 0 ? (
            <Pressable style={styles.loadMore}>
              <Text style={styles.loadMoreText}>Load More</Text>
              <Ionicons name="chevron-down" size={12} color={PRIMARY} />
            </Pressable>
          ) : null
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
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    zIndex: 100,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 12 },
  searchContainer: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 12 },

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
  tabs: { paddingHorizontal: 16, gap: 8 },
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
    padding: 6,
    marginBottom: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 1,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  cardTop: { flexDirection: 'row', gap: 8 },
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
  cardFooter: { flexDirection: 'row', gap: 5, marginTop: 5, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#F9FAFB' },
  chatBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3,
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingVertical: 5, backgroundColor: CARD,
  },
  chatBtnText: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: '#374151' },
  callBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3,
    backgroundColor: PRIMARY, borderRadius: 10, paddingVertical: 5,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2,
  },
  callBtnText: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: '#FFF' },
  chevronBtn: { width: 30, backgroundColor: '#F3F4F6', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  // Empty + load more
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: DARK },
  emptyText: { fontSize: 13, color: GRAY, fontFamily: 'Inter_400Regular', textAlign: 'center', paddingHorizontal: 32 },
  loadMore: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginHorizontal: 16, marginTop: 8, marginBottom: 8,
    paddingVertical: 12, borderRadius: 24,
    borderWidth: 1, borderColor: `${PRIMARY}33`,
  },
  loadMoreText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: PRIMARY },
});
