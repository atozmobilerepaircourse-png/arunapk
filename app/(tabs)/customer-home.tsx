import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform,
  RefreshControl, ActivityIndicator, Alert, Dimensions,
} from 'react-native';
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
const QUICK_ACTIONS: { icon: keyof typeof Ionicons.glyphMap; label: string; color: string; bg: string; action: string }[] = [
  { icon: 'videocam', label: 'Live\nHelp', color: '#FF2D55', bg: '#FFE8ED', action: 'live' },
  { icon: 'location', label: 'Snap\nMap', color: '#007AFF', bg: '#E8F2FF', action: 'map' },
  { icon: 'chatbubbles', label: 'Live\nChat', color: '#34C759', bg: '#E8FAF0', action: 'chat' },
  { icon: 'notifications', label: 'My\nAlerts', color: '#FF9500', bg: '#FFF4E8', action: 'alerts' },
];

export default function CustomerHomeScreen() {
  const insets = useSafeAreaInsets();
  const { allProfiles, profile, isLoading, dataError, refreshData, setProfile, totalUnread } = useApp();
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
                <Text style={{ fontSize: 7, color: '#34C759', marginTop: 1, fontWeight: '700' as const }}>Live Chat</Text>
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

            <Pressable
              style={({ pressed }) => [s.insuranceCard, pressed && { opacity: 0.9 }]}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/insurance');
              }}
            >
              <View style={s.insuranceLeft}>
                <View style={s.insuranceIconCircle}>
                  <Ionicons name="shield-checkmark" size={28} color="#5856D6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.insuranceTitle}>Mobile Insurance</Text>
                  <Text style={s.insuranceSub}>Protect your phone from damage</Text>
                  <Text style={s.insurancePrice}>Starting ₹30 / month</Text>
                </View>
              </View>
              <Pressable
                style={s.insuranceBtn}
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/insurance');
                }}
              >
                <Text style={s.insuranceBtnText}>Get Insurance</Text>
              </Pressable>
            </Pressable>

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
  headerIconBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  unreadBadge: { position: 'absolute', top: -2, right: -2, backgroundColor: '#FF3B30', borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  unreadText: { fontSize: 9, fontWeight: '700', color: '#FFF' },
  switchBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#34C759', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  switchText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#FFF' },

  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10, marginBottom: 16 },
  actionCard: { width: (width - 42) / 2, borderRadius: 14, padding: 16, alignItems: 'flex-start' },
  actionIconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  actionLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold', lineHeight: 18 },
  liveDot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF2D55' },

  insuranceCard: {
    marginHorizontal: 16, marginBottom: 16, backgroundColor: '#F0EFFE',
    borderRadius: 18, padding: 16, borderWidth: 1.5, borderColor: '#D4D0FA',
  },
  insuranceLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  insuranceIconCircle: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#5856D620',
    justifyContent: 'center', alignItems: 'center',
  },
  insuranceTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#1A1A2E' },
  insuranceSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#555', marginTop: 2 },
  insurancePrice: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#5856D6', marginTop: 4 },
  insuranceBtn: {
    backgroundColor: '#5856D6', borderRadius: 12, paddingVertical: 10,
    alignItems: 'center',
  },
  insuranceBtnText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#fff' },
});
