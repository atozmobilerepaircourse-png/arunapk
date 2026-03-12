import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, Pressable, Platform,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useApp } from '@/lib/context';
import { UserRole, ROLE_LABELS } from '@/lib/types';
import DirectoryCard from '@/components/DirectoryCard';
import DirectoryMap from '@/components/DirectoryMap';
import { apiRequest } from '@/lib/query-client';
import { T } from '@/constants/techTheme';

// Light theme tokens
const PRIMARY  = '#E8704A';
const PRIMARY_L = '#FFF1EC';
const BG       = '#F5F5F5';
const CARD     = '#FFFFFF';
const DARK     = '#1A1A1A';
const MUTED    = '#888888';
const BORDER   = '#EEEEEE';

const ROLE_FILTERS: { key: UserRole | 'all'; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', label: 'All', icon: 'grid' },
  { key: 'customer', label: 'Customers', icon: 'person' },
  { key: 'teacher', label: 'Teachers', icon: 'school' },
  { key: 'supplier', label: 'Suppliers', icon: 'cube' },
  { key: 'job_provider', label: 'Jobs', icon: 'briefcase' },
  { key: 'technician', label: 'Technicians', icon: 'construct' },
];

const ROLE_COLORS: Record<string, string> = {
  technician: '#34C759',
  teacher: '#F59E0B',
  supplier: '#E8704A',
  job_provider: '#5E8BFF',
  customer: '#FF2D55',
};

type OnlineStats = Record<string, { registered: number; online: number }>;

const STAT_ROLES: { key: string; label: string; color: string }[] = [
  { key: 'technician', label: 'Technicians', color: '#34C759' },
  { key: 'teacher', label: 'Teachers', color: '#FFD60A' },
  { key: 'supplier', label: 'Suppliers', color: '#FF6B2C' },
  { key: 'customer', label: 'Customers', color: '#FF2D55' },
];

const CUSTOMER_STAT_ROLES = STAT_ROLES.filter(r => r.key === 'technician' || r.key === 'customer');
const CUSTOMER_ROLE_FILTERS = ROLE_FILTERS.filter(r => r.key === 'all' || r.key === 'customer' || r.key === 'technician');

const SKILL_CATEGORIES: { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { label: 'All', icon: 'apps', color: '#4F46E5' },
  { label: 'iPhone', icon: 'logo-apple', color: '#6B7280' },
  { label: 'Samsung', icon: 'phone-portrait', color: '#3B82F6' },
  { label: 'OnePlus', icon: 'phone-portrait', color: '#EF4444' },
  { label: 'Screen Fix', icon: 'tablet-portrait', color: '#F59E0B' },
  { label: 'Battery', icon: 'battery-charging', color: '#10B981' },
  { label: 'Software', icon: 'code-slash', color: '#8B5CF6' },
  { label: 'Water Damage', icon: 'water', color: '#0EA5E9' },
  { label: 'Motherboard', icon: 'hardware-chip', color: '#FF6B2C' },
];

export default function DirectoryScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ view?: string }>();
  const { allProfiles, profile, startConversation, refreshData } = useApp();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<OnlineStats | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>(params.view === 'map' ? 'map' : 'list');
  const [skillFilter, setSkillFilter] = useState<string>('All');

  const isCustomer = profile?.role === 'customer';
  const isTechnician = profile?.role === 'technician';
  const visibleStatRoles = isCustomer ? CUSTOMER_STAT_ROLES : STAT_ROLES;
  const visibleFilters = isCustomer ? CUSTOMER_ROLE_FILTERS : ROLE_FILTERS;

  const D = useMemo(() => isTechnician ? {
    bg: T.bg,
    card: T.card,
    surface: T.cardSurface,
    text: T.text,
    textSub: T.textSub,
    muted: T.muted,
    border: T.border,
    accent: T.accent,
    iconBtn: T.cardSurface,
  } : {
    bg: BG,
    card: CARD,
    surface: '#FAFAFA',
    text: DARK,
    textSub: '#4B5563',
    muted: MUTED,
    border: BORDER,
    accent: PRIMARY,
    iconBtn: CARD,
  }, [isTechnician]);

  useEffect(() => {
    if (params.view === 'map') setViewMode('map');
  }, [params.view]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await apiRequest('GET', '/api/stats/online');
      const data = await res.json();
      setStats(data);
    } catch (e) {}
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const directory = useMemo(() => {
    const now = Date.now();
    const THRESHOLD = 5 * 60 * 1000;
    return allProfiles.map(p => ({
      id: p.id,
      name: p.name,
      role: p.role as UserRole,
      city: p.city || '',
      skills: Array.isArray(p.skills) ? p.skills : [],
      experience: p.experience,
      avatar: p.avatar || '',
      isOnline: !!(p as any).lastSeen && (now - (p as any).lastSeen) < THRESHOLD,
      lastSeen: (p as any).lastSeen || 0,
      latitude: (p as any).latitude ? parseFloat((p as any).latitude) : null,
      longitude: (p as any).longitude ? parseFloat((p as any).longitude) : null,
      locationSharing: (p as any).locationSharing,
    }));
  }, [allProfiles]);

  const filtered = useMemo(() => {
    let list = directory;
    if (roleFilter !== 'all') {
      list = list.filter(e => e.role === roleFilter);
    }
    if (skillFilter && skillFilter !== 'All') {
      const q = skillFilter.toLowerCase();
      list = list.filter(e => e.skills.some(s => s.toLowerCase().includes(q)));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.city.toLowerCase().includes(q) ||
        e.skills.some(s => s.toLowerCase().includes(q))
      );
    }
    return list;
  }, [directory, roleFilter, skillFilter, search]);

  const mapProfiles = useMemo(() => {
    return filtered.filter(p => {
      if (!p.latitude || !p.longitude) return false;
      if (isNaN(p.latitude) || isNaN(p.longitude)) return false;
      if (p.role === 'customer' && p.locationSharing !== 'true') return false;
      return true;
    }).map(p => ({
      id: p.id,
      latitude: p.latitude!,
      longitude: p.longitude!,
      name: p.name,
      role: ROLE_LABELS[p.role] || p.role,
      roleKey: p.role,
      city: p.city,
      skills: p.skills,
      color: ROLE_COLORS[p.role] || '#007AFF',
      avatar: p.avatar,
      isOnline: p.isOnline,
      lastSeen: p.lastSeen,
    }));
  }, [filtered]);

  const handleMapChat = useCallback(async (id: string) => {
    const p = allProfiles.find(p => p.id === id);
    if (p) {
      const convoId = await startConversation(p.id, p.name, p.role);
      if (convoId) router.push({ pathname: '/chat/[id]', params: { id: convoId } });
    }
  }, [allProfiles, startConversation]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshData(), fetchStats()]);
    setRefreshing(false);
  };

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  if (viewMode === 'map') {
    return (
      <View style={[styles.container, { backgroundColor: D.bg }]}>
        <View style={[styles.mapHeader, { paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 8, backgroundColor: D.bg }]}>
          <Pressable
            style={[styles.mapBackBtn, { backgroundColor: D.accent }]}
            onPress={() => setViewMode('list')}
          >
            <Ionicons name="list" size={20} color="#FFF" />
          </Pressable>

          <View style={[styles.mapSearchBox, { backgroundColor: D.card, borderColor: D.border }]}>
            <Ionicons name="search" size={16} color={D.muted} />
            <TextInput
              style={[styles.mapSearchInput, { color: D.text }]}
              placeholder="Search..."
              placeholderTextColor={D.muted}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={16} color={D.muted} />
              </Pressable>
            )}
          </View>
        </View>

        <View style={[styles.mapFilters, { backgroundColor: D.bg }]}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={visibleFilters}
            contentContainerStyle={{ paddingHorizontal: 12, gap: 6 }}
            keyExtractor={item => item.key}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.mapFilterChip, { backgroundColor: D.card, borderColor: D.border }, roleFilter === item.key && { backgroundColor: D.accent, borderColor: D.accent }]}
                onPress={() => setRoleFilter(item.key)}
              >
                <Ionicons
                  name={item.icon}
                  size={12}
                  color={roleFilter === item.key ? '#FFF' : D.muted}
                />
                <Text style={[styles.mapFilterText, { color: D.muted }, roleFilter === item.key && styles.mapFilterTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            )}
          />
        </View>

        <View style={styles.mapFull}>
          <DirectoryMap
            markers={mapProfiles}
            onMarkerPress={(id: string) => router.push({ pathname: '/user-profile', params: { id } })}
            onChatPress={handleMapChat}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: D.bg }]}>
      <View style={[styles.header, { paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 12, backgroundColor: D.bg }]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: D.text }]}>{isCustomer ? 'Find Technicians' : 'Directory'}</Text>
            <Text style={[styles.headerSubtitle, { color: D.muted }]}>{isCustomer ? 'Certified repair experts near you' : 'Find professionals across India'}</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              style={[styles.headerIconBtn, { backgroundColor: D.iconBtn, borderColor: D.border }]}
              onPress={() => router.push('/chats')}
            >
              <Ionicons name="chatbubble-ellipses" size={20} color={D.text} />
            </Pressable>
            <Pressable
              style={[styles.headerIconBtn, { backgroundColor: D.accent, borderColor: D.accent }]}
              onPress={() => setViewMode('map')}
            >
              <Ionicons name="map" size={20} color="#FFF" />
            </Pressable>
          </View>
        </View>
      </View>

      {stats && (
        <View style={[styles.statsBar, { backgroundColor: D.bg }]}>
          {visibleStatRoles.map(r => {
            const s = stats[r.key];
            if (!s) return null;
            return (
              <View key={r.key} style={[styles.statCard, { backgroundColor: D.card, borderColor: D.border }]}>
                <View style={styles.statHeader}>
                  <View style={[styles.statDot, { backgroundColor: r.color }]} />
                  <Text style={[styles.statLabel, { color: r.color }]}>{r.label}</Text>
                </View>
                <View style={styles.statNumbers}>
                  <Text style={[styles.statRegistered, { color: D.text }]}>{s.registered}</Text>
                  <Text style={[styles.statSep, { color: D.muted }]}>/</Text>
                  <View style={styles.liveRow}>
                    <View style={[styles.livePulse, { backgroundColor: '#34C759' }]} />
                    <Text style={[styles.statOnline, { color: '#34C759' }]}>{s.online}</Text>
                  </View>
                </View>
                <View style={styles.statFooter}>
                  <Text style={[styles.statFooterText, { color: D.muted }]}>Total / Live</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <View style={[styles.searchContainer, { backgroundColor: D.bg }]}>
        <View style={[styles.searchBox, { backgroundColor: D.card, borderColor: D.border }]}>
          <Ionicons name="search" size={18} color={D.muted} />
          <TextInput
            style={[styles.searchInput, { color: D.text }]}
            placeholder="Search by name, city, or skill..."
            placeholderTextColor={D.muted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={D.muted} />
            </Pressable>
          )}
        </View>
      </View>

      <View style={[styles.filtersContainer, { backgroundColor: D.bg }]}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={visibleFilters}
          contentContainerStyle={styles.filtersContent}
          keyExtractor={item => item.key}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.filterChip, { backgroundColor: D.card, borderColor: D.border }, roleFilter === item.key && { backgroundColor: D.accent, borderColor: D.accent }]}
              onPress={() => setRoleFilter(item.key)}
            >
              <Ionicons
                name={item.icon}
                size={14}
                color={roleFilter === item.key ? '#FFF' : D.muted}
              />
              <Text style={[styles.filterText, { color: D.muted }, roleFilter === item.key && styles.filterTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          )}
        />
      </View>

      {/* UX Pilot skill category tiles — technician dark theme only */}
      {isTechnician && (
        <View style={[styles.skillCatWrap, { backgroundColor: D.bg }]}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={SKILL_CATEGORIES}
            keyExtractor={item => item.label}
            contentContainerStyle={styles.skillCatRow}
            renderItem={({ item: cat }) => {
              const active = skillFilter === cat.label;
              return (
                <Pressable
                  style={[styles.skillCatTile, { backgroundColor: active ? cat.color : D.card, borderColor: active ? cat.color : D.border }]}
                  onPress={() => setSkillFilter(cat.label)}
                >
                  <View style={[styles.skillCatIcon, { backgroundColor: active ? 'rgba(255,255,255,0.2)' : cat.color + '18' }]}>
                    <Ionicons name={cat.icon} size={16} color={active ? '#FFF' : cat.color} />
                  </View>
                  <Text style={[styles.skillCatLabel, { color: active ? '#FFF' : D.text }]}>{cat.label}</Text>
                </Pressable>
              );
            }}
          />
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <DirectoryCard
            name={item.name}
            role={item.role}
            city={item.city}
            skills={item.skills}
            experience={item.experience}
            avatar={item.avatar}
            isOnline={item.isOnline}
            onPress={() => router.push({ pathname: '/user-profile', params: { id: item.id } })}
            onMessage={item.id !== profile?.id && item.role !== 'customer' ? async () => {
              const convoId = await startConversation(item.id, item.name, item.role);
              if (convoId) router.push({ pathname: '/chat/[id]', params: { id: convoId } });
            } : undefined}
            darkMode={isTechnician}
          />
        )}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Platform.OS === 'web' ? 84 + 34 : 100 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={D.accent}
            colors={[D.accent]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconBg, { backgroundColor: D.card }]}>
              <Ionicons name="people-outline" size={36} color={D.accent} />
            </View>
            <Text style={[styles.emptyTitle, { color: D.text }]}>No professionals yet</Text>
            <Text style={[styles.emptyText, { color: D.muted }]}>Pull down to refresh or invite others to join</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 4,
    backgroundColor: BG,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: DARK,
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
  },
  headerSubtitle: {
    color: MUTED,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    marginTop: 3,
  },
  viewToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  viewToggleMap: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  headerIconBtnMap: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  mapHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
  },
  mapBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(28,28,30,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapSearchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(28,28,30,0.85)',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  mapSearchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    padding: 0,
  },
  mapFilters: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 99,
    marginTop: Platform.OS === 'web' ? 67 + 8 + 36 + 12 : 0,
  },
  mapFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(28,28,30,0.85)',
    gap: 4,
  },
  mapFilterChipActive: {
    backgroundColor: '#007AFF',
  },
  mapFilterText: {
    color: '#AAA',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  mapFilterTextActive: {
    color: '#FFF',
  },
  mapFull: {
    flex: 1,
  },
  statsBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 6,
    marginBottom: 6,
  },
  statCard: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  statDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },
  statNumbers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statRegistered: {
    color: DARK,
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
  },
  statSep: {
    color: MUTED,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  livePulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statOnline: {
    color: '#34C759',
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  statFooter: {
    marginTop: 2,
  },
  statFooterText: {
    color: MUTED,
    fontSize: 9,
    fontFamily: 'Inter_400Regular',
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: DARK,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    padding: 0,
  },
  mapPreviewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: 'rgba(255,45,85,0.08)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,45,85,0.2)',
  },
  mapPreviewLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mapPreviewTitle: {
    color: '#FF2D55',
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  mapPreviewSub: {
    color: MUTED,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
  },
  mapPreviewRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mapPreviewOpen: {
    color: '#FF2D55',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  filtersContainer: {
    marginBottom: 8,
  },
  filtersContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  filterText: {
    color: MUTED,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyIconBg: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: DARK,
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
  },
  emptyText: {
    color: MUTED,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  skillCatWrap: { paddingVertical: 8 },
  skillCatRow: { paddingHorizontal: 12, gap: 8 },
  skillCatTile: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 68,
  },
  skillCatIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skillCatLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center' as const,
  },
});
