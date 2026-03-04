import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, Pressable, Platform,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import Colors from '@/constants/colors';
import { useApp } from '@/lib/context';
import { UserRole, ROLE_LABELS } from '@/lib/types';
import DirectoryCard from '@/components/DirectoryCard';
import DirectoryMap from '@/components/DirectoryMap';
import { apiRequest } from '@/lib/query-client';

const C = Colors.light;

const ROLE_FILTERS: { key: UserRole | 'all'; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', label: 'All', icon: 'grid' },
  { key: 'technician', label: 'Technicians', icon: 'construct' },
  { key: 'teacher', label: 'Teachers', icon: 'school' },
  { key: 'supplier', label: 'Suppliers', icon: 'cube' },
  { key: 'job_provider', label: 'Jobs', icon: 'briefcase' },
  { key: 'customer', label: 'Customers', icon: 'person' },
];

const ROLE_COLORS: Record<string, string> = {
  technician: '#34C759',
  teacher: '#FFD60A',
  supplier: '#FF6B2C',
  job_provider: '#5856D6',
  customer: '#FF2D55',
};

type OnlineStats = Record<string, { registered: number; online: number }>;

const STAT_ROLES: { key: string; label: string; color: string }[] = [
  { key: 'technician', label: 'Technicians', color: '#34C759' },
  { key: 'teacher', label: 'Teachers', color: '#FFD60A' },
  { key: 'supplier', label: 'Suppliers', color: '#FF6B2C' },
  { key: 'customer', label: 'Customers', color: '#FF2D55' },
];

const SORT_OPTIONS: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'recent', label: 'Recent', icon: 'time-outline' },
  { key: 'rated', label: 'Top Rated', icon: 'star-outline' },
  { key: 'trusted', label: 'Trusted', icon: 'shield-checkmark-outline' },
  { key: 'nearest', label: 'Nearest', icon: 'navigate-outline' },
];

const TRUST_BADGE_COLORS: Record<string, string> = {
  'New Member': '#999',
  'Trusted': '#007AFF',
  'Pro': '#FF9500',
  'Verified Expert': '#34C759',
};

function getTrustBadgeLabel(score: number): string {
  if (score >= 80) return 'Verified Expert';
  if (score >= 60) return 'Pro';
  if (score >= 40) return 'Trusted';
  return 'New Member';
}

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function DirectoryScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ view?: string }>();
  const { allProfiles, profile, startConversation, refreshData } = useApp();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<OnlineStats | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>(params.view === 'map' ? 'map' : 'list');
  const [sortBy, setSortBy] = useState<string>('recent');
  const [trustScores, setTrustScores] = useState<Record<string, { score: number; rating: number }>>({});

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

  useEffect(() => {
    if (sortBy !== 'rated' && sortBy !== 'trusted') return;
    const idsToFetch = directory
      .filter(p => !trustScores[p.id])
      .slice(0, 20);
    if (idsToFetch.length === 0) return;
    idsToFetch.forEach(async (p) => {
      try {
        const res = await apiRequest('GET', `/api/trust-score/${p.id}`);
        const data = await res.json();
        setTrustScores(prev => ({
          ...prev,
          [p.id]: { score: data.trustScore ?? 0, rating: data.averageRating ?? 0 },
        }));
      } catch {}
    });
  }, [sortBy, directory]);

  const userLat = profile ? parseFloat((profile as any).latitude || '0') : 0;
  const userLng = profile ? parseFloat((profile as any).longitude || '0') : 0;
  const hasUserLocation = userLat !== 0 && userLng !== 0;

  const filtered = useMemo(() => {
    let list = directory;
    if (roleFilter !== 'all') {
      list = list.filter(e => e.role === roleFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.city.toLowerCase().includes(q) ||
        e.skills.some(s => s.toLowerCase().includes(q))
      );
    }
    const sorted = [...list];
    switch (sortBy) {
      case 'recent':
        sorted.sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
        break;
      case 'rated':
        sorted.sort((a, b) => (trustScores[b.id]?.rating ?? 0) - (trustScores[a.id]?.rating ?? 0));
        break;
      case 'trusted':
        sorted.sort((a, b) => (trustScores[b.id]?.score ?? 0) - (trustScores[a.id]?.score ?? 0));
        break;
      case 'nearest':
        if (hasUserLocation) {
          sorted.sort((a, b) => {
            const distA = (a.latitude && a.longitude) ? getDistanceKm(userLat, userLng, a.latitude, a.longitude) : 999999;
            const distB = (b.latitude && b.longitude) ? getDistanceKm(userLat, userLng, b.latitude, b.longitude) : 999999;
            return distA - distB;
          });
        }
        break;
    }
    return sorted;
  }, [directory, roleFilter, search, sortBy, trustScores, hasUserLocation, userLat, userLng]);

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
      <View style={styles.container}>
        <View style={[styles.mapHeader, { paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 8 }]}>
          <Pressable
            style={styles.mapBackBtn}
            onPress={() => setViewMode('list')}
          >
            <Ionicons name="list" size={20} color="#FFF" />
          </Pressable>

          <View style={styles.mapSearchBox}>
            <Ionicons name="search" size={16} color={C.textTertiary} />
            <TextInput
              style={styles.mapSearchInput}
              placeholder="Search..."
              placeholderTextColor={C.textTertiary}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={16} color={C.textTertiary} />
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.mapFilters}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={ROLE_FILTERS}
            contentContainerStyle={{ paddingHorizontal: 12, gap: 6 }}
            keyExtractor={item => item.key}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.mapFilterChip, roleFilter === item.key && styles.mapFilterChipActive]}
                onPress={() => setRoleFilter(item.key)}
              >
                <Ionicons
                  name={item.icon}
                  size={12}
                  color={roleFilter === item.key ? '#FFF' : C.textSecondary}
                />
                <Text style={[styles.mapFilterText, roleFilter === item.key && styles.mapFilterTextActive]}>
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
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 12 }]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Directory</Text>
            <Text style={styles.headerSubtitle}>Find professionals across India</Text>
          </View>
          <Pressable
            style={[styles.viewToggle, styles.viewToggleMap]}
            onPress={() => setViewMode('map')}
          >
            <Ionicons name="map" size={20} color="#FFF" />
          </Pressable>
        </View>
      </View>

      {stats && (
        <View style={styles.statsBar}>
          {STAT_ROLES.map(r => {
            const s = stats[r.key];
            if (!s) return null;
            return (
              <View key={r.key} style={styles.statCard}>
                <View style={styles.statHeader}>
                  <View style={[styles.statDot, { backgroundColor: r.color }]} />
                  <Text style={[styles.statLabel, { color: r.color }]}>{r.label}</Text>
                </View>
                <View style={styles.statNumbers}>
                  <Text style={styles.statRegistered}>{s.registered}</Text>
                  <Text style={styles.statSep}>/</Text>
                  <View style={styles.liveRow}>
                    <View style={[styles.livePulse, { backgroundColor: '#34C759' }]} />
                    <Text style={styles.statOnline}>{s.online}</Text>
                  </View>
                </View>
                <View style={styles.statFooter}>
                  <Text style={styles.statFooterText}>Total / Live</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={C.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, city, or skill..."
            placeholderTextColor={C.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={C.textTertiary} />
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.filtersContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={ROLE_FILTERS}
          contentContainerStyle={styles.filtersContent}
          keyExtractor={item => item.key}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.filterChip, roleFilter === item.key && styles.filterChipActive]}
              onPress={() => setRoleFilter(item.key)}
            >
              <Ionicons
                name={item.icon}
                size={14}
                color={roleFilter === item.key ? '#FFF' : C.textSecondary}
              />
              <Text style={[styles.filterText, roleFilter === item.key && styles.filterTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          )}
        />
      </View>

      <View style={styles.sortContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={SORT_OPTIONS}
          contentContainerStyle={styles.sortContent}
          keyExtractor={item => item.key}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.sortChip, sortBy === item.key && styles.sortChipActive]}
              onPress={() => setSortBy(item.key)}
            >
              <Ionicons
                name={item.icon}
                size={12}
                color={sortBy === item.key ? '#FFF' : C.textSecondary}
              />
              <Text style={[styles.sortText, sortBy === item.key && styles.sortTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          )}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const ts = trustScores[item.id];
          const badgeLabel = ts ? getTrustBadgeLabel(ts.score) : undefined;
          const badgeColor = badgeLabel ? TRUST_BADGE_COLORS[badgeLabel] : undefined;
          return (
            <DirectoryCard
              name={item.name}
              role={item.role}
              city={item.city}
              skills={item.skills}
              experience={item.experience}
              avatar={item.avatar}
              isOnline={item.isOnline}
              trustBadge={badgeLabel}
              trustBadgeColor={badgeColor}
              onPress={() => router.push({ pathname: '/user-profile', params: { id: item.id } })}
              onMessage={item.id !== profile?.id && item.role !== 'customer' ? async () => {
                const convoId = await startConversation(item.id, item.name, item.role);
                if (convoId) router.push({ pathname: '/chat/[id]', params: { id: convoId } });
              } : undefined}
            />
          );
        }}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Platform.OS === 'web' ? 84 + 34 : 100 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.primary}
            colors={[C.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={C.textTertiary} />
            <Text style={styles.emptyTitle}>No professionals yet</Text>
            <Text style={styles.emptyText}>Pull down to refresh or invite others to join</Text>
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
    backgroundColor: C.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: C.text,
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
  },
  headerSubtitle: {
    color: C.textTertiary,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    marginTop: 4,
  },
  viewToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  viewToggleMap: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
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
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: C.border,
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
    color: C.text,
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
  },
  statSep: {
    color: C.textTertiary,
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
    color: C.textTertiary,
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
    backgroundColor: C.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: C.border,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: C.text,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    padding: 0,
  },
  filtersContainer: {
    marginBottom: 4,
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
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  filterText: {
    color: C.textSecondary,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  sortContainer: {
    marginBottom: 8,
  },
  sortContent: {
    paddingHorizontal: 16,
    gap: 6,
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    gap: 4,
  },
  sortChipActive: {
    backgroundColor: '#5856D6',
    borderColor: '#5856D6',
  },
  sortText: {
    color: C.textSecondary,
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  sortTextActive: {
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
  emptyTitle: {
    color: C.text,
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
  },
  emptyText: {
    color: C.textTertiary,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
});
