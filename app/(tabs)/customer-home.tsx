import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, Pressable, Platform,
  RefreshControl, ActivityIndicator, Alert, Dimensions,
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
import ErrorState from '@/components/ErrorState';
import SubscriptionLockScreen from '@/components/SubscriptionLockScreen';

const C = Colors.light;
const { width } = Dimensions.get('window');
const ONLINE_THRESHOLD = 5 * 60 * 1000;

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function isUserOnline(lastSeen: any): boolean {
  if (!lastSeen) return false;
  return (Date.now() - lastSeen) < ONLINE_THRESHOLD;
}

const QUICK_ACTIONS: { icon: keyof typeof Ionicons.glyphMap; label: string; color: string; bg: string; action: string }[] = [
  { icon: 'videocam', label: 'Live\nHelp', color: '#FF2D55', bg: '#FFE8ED', action: 'live' },
  { icon: 'location', label: 'Snap\nMap', color: '#007AFF', bg: '#E8F2FF', action: 'map' },
  { icon: 'chatbubbles', label: 'Live\nChat', color: '#34C759', bg: '#E8FAF0', action: 'chat' },
  { icon: 'notifications', label: 'My\nAlerts', color: '#FF9500', bg: '#FFF4E8', action: 'alerts' },
];

export default function CustomerHomeScreen() {
  const insets = useSafeAreaInsets();
  const { allProfiles, profile, isLoading, dataError, refreshData, startConversation, setProfile, totalUnread } = useApp();
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [liveSessions, setLiveSessions] = useState<any[]>([]);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const tabBarPadding = Platform.OS === 'web' ? 84 + 34 : 100;

  const handleRoleSwitch = async () => {
    if (!profile) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Switch to Technician',
      'You will see the technician view with all repair tools and features.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          onPress: async () => {
            setIsSwitching(true);
            try {
              const res = await apiRequest('POST', '/api/profile/change-role', { userId: profile.id, newRole: 'technician' });
              if (res.ok) {
                await setProfile({ ...profile, role: 'technician' as UserRole });
                router.replace('/(tabs)/index');
              } else {
                Alert.alert('Error', 'Failed to switch role');
              }
            } catch {
              Alert.alert('Error', 'Connection failed');
            } finally {
              setIsSwitching(false);
            }
          },
        },
      ]
    );
  };

  const handleChat = async (tech: any) => {
    if (!profile) return;
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

  const fetchLiveSessions = useCallback(async () => {
    try {
      const res = await apiRequest('GET', '/api/teacher/live-sessions');
      const data = await res.json();
      if (data.sessions) setLiveSessions(data.sessions);
    } catch {}
  }, []);

  useEffect(() => {
    fetchLiveSessions();
  }, []);

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
    return list.slice(0, 10);
  }, [allProfiles, search]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshData(), fetchLiveSessions()]);
    setRefreshing(false);
  }, [refreshData, fetchLiveSessions]);

  const handleQuickAction = (action: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    switch (action) {
      case 'live':
        if (liveSessions.length > 0) {
          router.push('/(tabs)/marketplace');
        } else {
          Alert.alert('No Live Sessions', 'No technicians are live right now. Check back later.');
        }
        break;
      case 'map':
        router.push('/snap-map');
        break;
      case 'chat':
        router.push('/chats');
        break;
      case 'alerts':
        router.push('/(tabs)/profile');
        break;
    }
  };

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
      <View style={s.loadingContainer}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  if (dataError && allProfiles.length === 0) {
    return (
      <View style={s.loadingContainer}>
        <ErrorState message={dataError} onRetry={refreshData} />
      </View>
    );
  }

  const onlineCount = allProfiles.filter(p => p.role === 'technician' && isUserOnline((p as any).lastSeen)).length;

  return (
    <SubscriptionLockScreen>
    <View style={s.container}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={{ paddingBottom: tabBarPadding }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} colors={[C.primary]} />
        }
      >
        <View style={[s.header, { paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 16 }]}>
          <View style={s.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.greeting}>Hi, {profile?.name?.split(' ')[0] || 'there'} 👋</Text>
              <Text style={s.subGreeting}>What do you need help with?</Text>
            </View>
            <View style={s.headerActions}>
              <Pressable style={s.headerIconBtn} onPress={() => router.push('/chats')}>
                <Ionicons name="chatbubble-ellipses" size={22} color="#34C759" />
                {totalUnread > 0 && (
                  <View style={s.unreadBadge}>
                    <Text style={s.unreadText}>{totalUnread > 9 ? '9+' : totalUnread}</Text>
                  </View>
                )}
              </Pressable>
              <Pressable
                style={[s.switchBtn, isSwitching && { opacity: 0.5 }]}
                onPress={handleRoleSwitch}
                disabled={isSwitching}
              >
                <Ionicons name="construct" size={14} color="#FFF" />
                <Text style={s.switchText}>Technician</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={s.searchWrap}>
          <View style={s.searchBar}>
            <Ionicons name="search-outline" size={18} color="#999" />
            <TextInput
              style={s.searchInput}
              placeholder="Search repair, technician, parts..."
              placeholderTextColor="#999"
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={18} color="#999" />
              </Pressable>
            )}
          </View>
        </View>

        {!search.trim() && (
          <>
            <View style={s.actionsGrid}>
              {QUICK_ACTIONS.map((a, i) => (
                <Pressable
                  key={i}
                  style={({ pressed }) => [s.actionCard, { backgroundColor: a.bg }, pressed && { opacity: 0.8, transform: [{ scale: 0.96 }] }]}
                  onPress={() => handleQuickAction(a.action)}
                >
                  <View style={[s.actionIconCircle, { backgroundColor: a.color + '20' }]}>
                    <Ionicons name={a.icon} size={24} color={a.color} />
                  </View>
                  <Text style={[s.actionLabel, { color: a.color }]}>{a.label}</Text>
                  {a.action === 'live' && liveSessions.length > 0 && (
                    <View style={s.liveDot} />
                  )}
                </Pressable>
              ))}
            </View>

            {onlineCount > 0 && (
              <View style={s.onlineBanner}>
                <View style={s.pulseDot} />
                <Text style={s.onlineBannerText}>
                  {onlineCount} technician{onlineCount !== 1 ? 's' : ''} online now
                </Text>
              </View>
            )}
          </>
        )}

        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>
            {search.trim() ? 'Search Results' : 'Nearby Technicians'}
          </Text>
          {!search.trim() && (
            <Pressable onPress={() => router.push('/(tabs)/directory')}>
              <Text style={s.seeAll}>See all</Text>
            </Pressable>
          )}
        </View>

        {technicians.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="people-outline" size={40} color="#CCC" />
            <Text style={s.emptyText}>
              {search.trim() ? 'No technicians match your search' : 'No technicians found'}
            </Text>
          </View>
        ) : (
          technicians.map(item => {
            const skills = Array.isArray(item.skills) ? item.skills : [];
            const online = isUserOnline((item as any).lastSeen);

            return (
              <Pressable
                key={item.id}
                style={({ pressed }) => [s.techCard, pressed && { opacity: 0.9 }]}
                onPress={() => router.push({ pathname: '/user-profile', params: { id: item.id } })}
              >
                <View style={s.techRow}>
                  <View style={s.avatarWrap}>
                    {item.avatar ? (
                      <Image source={{ uri: item.avatar }} style={s.avatar} contentFit="cover" />
                    ) : (
                      <View style={s.avatarFallback}>
                        <Text style={s.avatarText}>{getInitials(item.name)}</Text>
                      </View>
                    )}
                    <View style={[s.statusDot, { backgroundColor: online ? '#34C759' : '#CCC' }]} />
                  </View>

                  <View style={s.techInfo}>
                    <Text style={s.techName} numberOfLines={1}>{item.name}</Text>
                    {(item.city || item.state) && (
                      <View style={s.locationRow}>
                        <Ionicons name="location-outline" size={12} color="#999" />
                        <Text style={s.locationText} numberOfLines={1}>
                          {[item.city, item.state].filter(Boolean).join(', ')}
                        </Text>
                      </View>
                    )}
                    {skills.length > 0 && (
                      <Text style={s.skillsPreview} numberOfLines={1}>
                        {skills.slice(0, 3).join(' · ')}
                      </Text>
                    )}
                  </View>

                  <Pressable
                    style={({ pressed }) => [s.chatBtn, pressed && { opacity: 0.7 }]}
                    onPress={() => handleChat(item)}
                  >
                    <Ionicons name="chatbubble-ellipses" size={18} color="#007AFF" />
                  </Pressable>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
    </SubscriptionLockScreen>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  loadingContainer: { flex: 1, backgroundColor: '#F8F9FA', justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },

  header: { paddingHorizontal: 20, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  greeting: { fontSize: 26, fontFamily: 'Inter_700Bold', color: '#000' },
  subGreeting: { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#666', marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  headerIconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  unreadBadge: { position: 'absolute', top: -2, right: -2, backgroundColor: '#FF3B30', borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  unreadText: { fontSize: 9, fontWeight: '700', color: '#FFF' },
  switchBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#34C759', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  switchText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#FFF' },

  searchWrap: { paddingHorizontal: 16, marginBottom: 16 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 14, height: 46, borderWidth: 1, borderColor: '#E8E8E8' },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 15, fontFamily: 'Inter_400Regular', color: '#000' },

  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10, marginBottom: 16 },
  actionCard: { width: (width - 42) / 2, borderRadius: 14, padding: 16, alignItems: 'flex-start' },
  actionIconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  actionLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold', lineHeight: 18 },
  liveDot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF2D55' },

  onlineBanner: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, backgroundColor: '#E8FAF0', borderRadius: 10, padding: 10, marginBottom: 16, gap: 8 },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#34C759' },
  onlineBannerText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: '#34C759' },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#000' },
  seeAll: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#007AFF' },

  techCard: { backgroundColor: '#FFF', marginHorizontal: 16, marginBottom: 8, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#F0F0F0' },
  techRow: { flexDirection: 'row', alignItems: 'center' },
  avatarWrap: { position: 'relative', marginRight: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E8F2FF', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#007AFF' },
  statusDot: { position: 'absolute', bottom: 1, right: 1, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#FFF' },
  techInfo: { flex: 1, gap: 2 },
  techName: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#000' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  locationText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#666', maxWidth: 160 },
  skillsPreview: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#999', marginTop: 1 },
  chatBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E8F2FF', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },

  emptyBox: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 32 },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#999', marginTop: 10, textAlign: 'center' },
});
