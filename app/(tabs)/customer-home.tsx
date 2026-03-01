import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, Pressable, Platform,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import Colors from '@/constants/colors';
import { useApp } from '@/lib/context';
import { UserRole, ROLE_LABELS } from '@/lib/types';
import { apiRequest } from '@/lib/query-client';

const C = Colors.dark;

const ROLE_COLOR: Record<string, string> = {
  technician: '#34C759',
  teacher: '#FFD60A',
  supplier: '#FF6B2C',
  job_provider: '#5E8BFF',
  customer: '#FF2D55',
};

const STAT_ITEMS: { key: string; label: string; color: string }[] = [
  { key: 'technician', label: 'TECHNICIANS', color: '#34C759' },
  { key: 'customer', label: 'CUSTOMERS', color: '#FF2D55' },
];

type OnlineStats = Record<string, { registered: number; online: number }>;
const ONLINE_THRESHOLD = 5 * 60 * 1000;

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function isUserOnline(lastSeen: any): boolean {
  if (!lastSeen) return false;
  return (Date.now() - lastSeen) < ONLINE_THRESHOLD;
}

export default function CustomerHomeScreen() {
  const insets = useSafeAreaInsets();
  const { allProfiles, profile, isLoading, refreshData, startConversation } = useApp();
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<OnlineStats | null>(null);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const tabBarPadding = Platform.OS === 'web' ? 84 + 34 : 100;

  const handleChat = async (tech: any) => {
    if (!profile) {
      router.push('/onboarding');
      return;
    }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const convoId = await startConversation(tech.id, tech.name, tech.role);
      if (convoId) {
        router.push({ pathname: '/chat/[id]', params: { id: convoId } });
      }
    } catch (e) {
      console.error('[CustomerHome] Chat error:', e);
    }
  };

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

  const technicians = useMemo(() => {
    let list = allProfiles.filter(p => p.role === 'technician');
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.city || '').toLowerCase().includes(q) ||
        (p.state || '').toLowerCase().includes(q) ||
        (Array.isArray(p.skills) ? p.skills : []).some((s: string) => s.toLowerCase().includes(q))
      );
    }
    return list;
  }, [allProfiles, search]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshData(), fetchStats()]);
    setRefreshing(false);
  }, [refreshData, fetchStats]);


  const renderTechCard = ({ item }: { item: typeof allProfiles[0] }) => {
    const skills = Array.isArray(item.skills) ? item.skills : [];
    const color = ROLE_COLOR[item.role] || C.primary;
    const online = isUserOnline((item as any).lastSeen);

    return (
      <Pressable
        style={({ pressed }) => [st.proCard, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
        onPress={() => router.push({ pathname: '/user-profile', params: { id: item.id } })}
      >
        <View style={st.proCardTop}>
          <View style={st.avatarContainer}>
            {item.avatar ? (
              <Image source={{ uri: item.avatar }} style={st.proAvatar} contentFit="cover" />
            ) : (
              <View style={[st.proAvatarFallback, { backgroundColor: color + '20' }]}>
                <Text style={[st.proAvatarText, { color }]}>{getInitials(item.name)}</Text>
              </View>
            )}
            <View style={[st.onlineIndicator, { backgroundColor: online ? '#34C759' : '#FF3B30' }]} />
          </View>
          <View style={st.proInfo}>
            <Text style={st.proName} numberOfLines={1}>{item.name}</Text>
            <View style={st.proMeta}>
              <View style={[st.rolePill, { backgroundColor: color + '18' }]}>
                <Text style={[st.rolePillText, { color }]}>{ROLE_LABELS[item.role as UserRole] || item.role}</Text>
              </View>
              {(item.city || item.state) && (
                <>
                  <Text style={st.dotSep}>{'\u00B7'}</Text>
                  <Ionicons name="location-outline" size={12} color={C.textTertiary} />
                  <Text style={st.locationInline} numberOfLines={1}>
                    {[item.city, item.state].filter(Boolean).join(', ')}
                  </Text>
                </>
              )}
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [st.chatIconBtn, { backgroundColor: color + '15' }, pressed && { opacity: 0.7, scale: 0.95 }]}
            onPress={() => handleChat(item)}
          >
            <Ionicons name="chatbubble-ellipses" size={20} color={color} />
          </Pressable>
        </View>

        {skills.length > 0 && (
          <View style={st.skillsRow}>
            {skills.slice(0, 4).map((s, i) => (
              <View key={i} style={st.skillTag}>
                <Text style={st.skillText}>{s}</Text>
              </View>
            ))}
            {skills.length > 4 && (
              <Text style={st.moreSkills}>+{skills.length - 4}</Text>
            )}
          </View>
        )}
      </Pressable>
    );
  };

  const renderEmpty = () => (
    <View style={st.emptyContainer}>
      <Ionicons name="people-outline" size={48} color={C.textTertiary} />
      <Text style={st.emptyTitle}>No technicians found</Text>
      <Text style={st.emptySubtitle}>
        {search.trim() ? 'Try a different search term' : 'No technicians have registered yet'}
      </Text>
    </View>
  );

  const [initialLoaded, setInitialLoaded] = useState(false);

  useEffect(() => {
    if (allProfiles.length === 0 && !isLoading) {
      refreshData().finally(() => setInitialLoaded(true));
    } else {
      setInitialLoaded(true);
    }
  }, []);

  if (!initialLoaded && (isLoading || allProfiles.length === 0)) {
    return (
      <View style={st.loadingContainer}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  return (
    <View style={st.container}>
      <View style={[st.header, { paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 12 }]}>
        <View style={st.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={st.greeting}>Hi, {profile?.name?.split(' ')[0] || 'there'}</Text>
          </View>
        </View>
      </View>

      {stats && (
        <View style={st.statsBar}>
          {STAT_ITEMS.map(r => {
            const s = stats[r.key];
            if (!s) return null;
            return (
              <View key={r.key} style={st.statCard}>
                <View style={st.statHeader}>
                  <View style={[st.statDot, { backgroundColor: r.color }]} />
                  <Text style={[st.statLabel, { color: r.color }]}>{r.label}</Text>
                </View>
                <View style={st.statNumbers}>
                  <Text style={st.statRegistered}>{s.registered}</Text>
                  <Text style={st.statSep}>/</Text>
                  <View style={st.liveRow}>
                    <View style={[st.livePulse, { backgroundColor: '#34C759' }]} />
                    <Text style={st.statOnline}>{s.online}</Text>
                  </View>
                </View>
                <Text style={st.statFooterText}>Total / Live</Text>
              </View>
            );
          })}
        </View>
      )}

      <View style={st.searchContainer}>
        <View style={st.searchBar}>
          <Ionicons name="search-outline" size={18} color={C.textTertiary} />
          <TextInput
            style={st.searchInput}
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

      <FlatList
        data={technicians}
        keyExtractor={item => item.id}
        renderItem={renderTechCard}
        contentContainerStyle={[st.listContent, { paddingBottom: tabBarPadding }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.primary}
            colors={[C.primary]}
          />
        }
      />
    </View>
  );
}

const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: C.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    backgroundColor: C.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greeting: {
    fontSize: 26,
    fontFamily: 'Inter_700Bold',
    color: C.text,
  },
  chatsHeaderBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsBar: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 10 },
  statCard: {
    flex: 1, backgroundColor: C.surface, borderRadius: 12, padding: 10,
    borderWidth: 1, borderColor: C.border, alignItems: 'center',
  },
  statHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  statDot: { width: 6, height: 6, borderRadius: 3 },
  statLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.3 },
  statNumbers: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statRegistered: { color: C.text, fontSize: 20, fontFamily: 'Inter_700Bold' },
  statSep: { color: C.textTertiary, fontSize: 14, fontFamily: 'Inter_400Regular' },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  livePulse: { width: 6, height: 6, borderRadius: 3 },
  statOnline: { color: '#34C759', fontSize: 16, fontFamily: 'Inter_700Bold' },
  statFooterText: { color: C.textTertiary, fontSize: 9, fontFamily: 'Inter_400Regular', marginTop: 2 },

  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: C.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: C.text,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  proCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  proCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  proAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  proAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  proAvatarText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: C.surface,
  },
  proInfo: {
    flex: 1,
  },
  proName: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: C.text,
    marginBottom: 4,
  },
  proMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  chatIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  rolePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  rolePillText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  dotSep: {
    fontSize: 12,
    color: C.textTertiary,
    marginHorizontal: 2,
  },
  locationInline: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: C.textSecondary,
    maxWidth: 120,
  },
  chatIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  skillTag: {
    backgroundColor: C.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  skillText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: C.textSecondary,
  },
  moreSkills: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: C.textTertiary,
    alignSelf: 'center',
    marginLeft: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: C.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: C.textSecondary,
    marginTop: 6,
    textAlign: 'center',
  },
});
