import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, Pressable, Platform, 
  Image, ActivityIndicator, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, {
  FadeInDown, useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming, Easing,
} from 'react-native-reanimated';
import { useApp } from '@/lib/context';
import { apiRequest } from '@/lib/query-client';

const BG      = '#F9FAFB';
const CARD    = '#FFFFFF';
const SURFACE = '#FFFFFF';
const BORDER  = '#E5E7EB';
const TEXT    = '#111827';
const MUTED   = '#9CA3AF';
const RED     = '#EF4444';

interface LiveSession {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherAvatar?: string;
  title: string;
  platform: string;
  link: string;
  isLive: boolean;
  startedAt: number;
  viewerCount?: number;
}

const PLATFORM_COLORS: Record<string, string> = {
  youtube: '#FF0000', zoom: '#2D8CFF', meet: '#00897B', other: '#EF4444',
};
const PLATFORM_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  youtube: 'logo-youtube', zoom: 'videocam', meet: 'videocam', other: 'radio',
};

function LiveDotPulse() {
  const scale   = useSharedValue(1);
  const opacity = useSharedValue(0.8);
  useEffect(() => {
    scale.value   = withRepeat(withSequence(withTiming(1.8, { duration: 700 }), withTiming(1, { duration: 300 })), -1);
    opacity.value = withRepeat(withSequence(withTiming(0, { duration: 700 }), withTiming(0.8, { duration: 300 })), -1);
  }, []);
  const ring = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));
  return (
    <View style={{ width: 10, height: 10 }}>
      <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 5, backgroundColor: RED }, ring]} />
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: RED }} />
    </View>
  );
}

function LiveCard({ session, onJoin }: { session: LiveSession; onJoin: (s: LiveSession) => void }) {
  const pColor = PLATFORM_COLORS[session.platform] || RED;
  const pIcon  = PLATFORM_ICONS[session.platform] || 'radio';
  const elapsed = Math.floor((Date.now() - session.startedAt) / 60000);
  const timeStr = elapsed < 1 ? 'Just started' : elapsed < 60 ? `${elapsed}m ago` : `${Math.floor(elapsed / 60)}h`;
  return (
    <Animated.View entering={FadeInDown.duration(400).springify()}>
      <Pressable style={liveStyles.card} onPress={() => onJoin(session)}>
        <View style={[liveStyles.banner, { backgroundColor: pColor + '18' }]}>
          <Ionicons name={pIcon} size={36} color={pColor} />
          <View style={liveStyles.liveBadge}>
            <LiveDotPulse />
            <Text style={liveStyles.liveBadgeText}>LIVE</Text>
          </View>
        </View>
        <View style={liveStyles.info}>
          <View style={[liveStyles.avatarFallback, { backgroundColor: pColor + '22' }]}>
            <Text style={[liveStyles.avatarInitial, { color: pColor }]}>
              {(session.teacherName || 'T')[0].toUpperCase()}
            </Text>
          </View>
          <View style={liveStyles.textBlock}>
            <Text style={liveStyles.title} numberOfLines={2}>{session.title}</Text>
            <Text style={liveStyles.teacher}>{session.teacherName}</Text>
            <View style={liveStyles.meta}>
              <Ionicons name={pIcon} size={12} color={pColor} />
              <Text style={[liveStyles.metaText, { color: pColor }]}>{session.platform.charAt(0).toUpperCase() + session.platform.slice(1)}</Text>
              <Text style={liveStyles.dot}>·</Text>
              <Text style={liveStyles.metaText}>{timeStr}</Text>
            </View>
          </View>
          <Pressable style={[liveStyles.joinBtn, { backgroundColor: pColor }]} onPress={() => onJoin(session)}>
            <Ionicons name="play" size={12} color="#FFF" />
            <Text style={liveStyles.joinText}>Join</Text>
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const liveStyles = StyleSheet.create({
  card: { backgroundColor: CARD, borderRadius: 16, marginHorizontal: 16, marginVertical: 8, overflow: 'hidden', borderWidth: 1, borderColor: BORDER + '60' },
  banner: { height: 140, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  liveBadge: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  liveBadgeText: { color: '#FFF', fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1.2 },
  info: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  avatarFallback: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  textBlock: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: TEXT, lineHeight: 19 },
  teacher: { fontSize: 12, color: MUTED, fontFamily: 'Inter_500Medium' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  metaText: { fontSize: 11, color: MUTED, fontFamily: 'Inter_400Regular' },
  dot: { fontSize: 11, color: MUTED },
  joinBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  joinText: { color: '#FFF', fontSize: 13, fontFamily: 'Inter_700Bold' },
});

export default function LiveContentScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useApp();
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLiveSessions = useCallback(async () => {
    try {
      const res = await apiRequest('GET', '/api/teacher/live-sessions');
      const data = await res.json();
      if (data.sessions) setLiveSessions(data.sessions as LiveSession[]);
    } catch (e) {
      console.error('Failed to fetch live sessions:', e);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchLiveSessions().finally(() => setLoading(false));
    liveIntervalRef.current = setInterval(fetchLiveSessions, 30000);
    return () => { if (liveIntervalRef.current) clearInterval(liveIntervalRef.current); };
  }, [fetchLiveSessions]);

  useFocusEffect(useCallback(() => {
    fetchLiveSessions();
  }, [fetchLiveSessions]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLiveSessions();
    setRefreshing(false);
  }, [fetchLiveSessions]);

  const handleJoinLive = useCallback((session: LiveSession) => {
    router.push({
      pathname: '/live-session',
      params: { url: session.link, title: session.title },
    } as any);
  }, []);

  const topPad = (Platform.OS === 'web' ? 67 : insets.top) + 10;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <LiveDotPulse />
          <Text style={styles.title}>Live Sessions</Text>
        </View>
        <Pressable onPress={() => router.push('/go-live' as any)}>
          <Ionicons name="radio" size={24} color={RED} />
        </Pressable>
      </View>

      <FlatList
        data={liveSessions}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <LiveCard session={item} onJoin={handleJoinLive} />}
        contentContainerStyle={{ paddingVertical: 12, paddingBottom: Platform.OS === 'web' ? 100 : 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={RED} colors={[RED]} />}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
            <Pressable style={styles.goLiveBtn} onPress={() => router.push('/go-live' as any)}>
              <View style={styles.goLiveDot} />
              <Text style={styles.goLiveBtnText}>Go Live Now</Text>
              <Ionicons name="chevron-forward" size={16} color="#FFF" style={{ marginLeft: 'auto' }} />
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ paddingTop: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={RED} />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconBg, { backgroundColor: RED + '15' }]}>
                <Ionicons name="radio-outline" size={32} color={RED} />
              </View>
              <Text style={styles.emptyTitle}>No live sessions</Text>
              <Text style={styles.emptyText}>Start streaming to share with your audience</Text>
              <Pressable style={styles.goLiveBtn} onPress={() => router.push('/go-live' as any)}>
                <View style={styles.goLiveDot} />
                <Text style={styles.goLiveBtnText}>Start Streaming</Text>
              </Pressable>
            </View>
          )
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: BORDER + '40' },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 22, fontFamily: 'Inter_700Bold', color: TEXT },
  goLiveBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: RED, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 12, shadowColor: RED, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6 },
  goLiveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFF' },
  goLiveBtnText: { color: '#FFF', fontSize: 16, fontFamily: 'Inter_700Bold', flex: 1 },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 14, paddingHorizontal: 40 },
  emptyIconBg: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { color: TEXT, fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  emptyText: { color: MUTED, fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});
