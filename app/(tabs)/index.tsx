import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  Pressable, Platform, Alert, ScrollView, Image, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, {
  FadeInDown, useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming, withDelay, Easing,
} from 'react-native-reanimated';
import { T } from '@/constants/techTheme';
import { useApp } from '@/lib/context';
import { openLink } from '@/lib/open-link';
import { PostCategory } from '@/lib/types';
import PostCard from '@/components/PostCard';
import { apiRequest } from '@/lib/query-client';

// ─── MarketHub Light Theme ───────────────────────────────────────────────────
const BG        = '#F9FAFB';
const CARD      = '#FFFFFF';
const SURFACE   = '#FFFFFF';
const BORDER    = '#E5E7EB';
const TEXT      = '#111827';
const MUTED     = '#9CA3AF';
const PRIMARY   = '#1B4D3E';
const BLUE      = '#3B82F6';
const GREEN     = '#10B981';
const AMBER     = '#F59E0B';
const RED       = '#EF4444';

// ─── Live Session type ────────────────────────────────────────────────────────
interface LiveSession {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherAvatar?: string;
  title: string;
  description?: string;
  platform: string;
  link: string;
  thumbnailUrl?: string;
  isLive: boolean;
  startedAt: number;
  viewerCount?: number;
}

// ─── Filter type ─────────────────────────────────────────────────────────────
type FilterKey = PostCategory | 'all' | 'technician' | 'customer' | 'teacher' | 'supplier' | 'live';

const FILTERS: { key: FilterKey; label: string; icon: keyof typeof Ionicons.glyphMap; color?: string }[] = [
  { key: 'all',        label: 'All Posts',        icon: 'layers-outline' },
  { key: 'technician', label: 'Technician Posts',  icon: 'construct-outline', color: GREEN },
  { key: 'customer',   label: 'Customer Posts',    icon: 'person-outline',    color: AMBER },
  { key: 'live',       label: 'Live',              icon: 'radio',             color: RED },
  { key: 'job',        label: 'Jobs',             icon: 'briefcase-outline' },
  { key: 'training',   label: 'Training',         icon: 'school-outline' },
  { key: 'supplier',   label: 'Suppliers',        icon: 'cube-outline' },
];

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonBox({ width, height, borderRadius = 8, style }: {
  width: number | string; height: number; borderRadius?: number; style?: any;
}) {
  const opacity = useSharedValue(0.4);
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700, easing: Easing.ease }),
        withTiming(0.4, { duration: 700, easing: Easing.ease }),
      ), -1,
    );
  }, []);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[{ width: width as any, height, borderRadius, backgroundColor: SURFACE }, animStyle, style]} />
  );
}

function PostSkeleton() {
  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <SkeletonBox width={44} height={44} borderRadius={22} />
        <View style={{ gap: 6, flex: 1 }}>
          <SkeletonBox width="60%" height={14} />
          <SkeletonBox width="40%" height={12} />
        </View>
      </View>
      <SkeletonBox width="100%" height={160} borderRadius={12} />
      <SkeletonBox width="80%" height={14} />
      <SkeletonBox width="50%" height={12} />
    </View>
  );
}

// ─── Animated header button ───────────────────────────────────────────────────
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function HeaderButton({ children, onPress, delay = 0 }: {
  children: React.ReactNode; onPress: () => void; delay?: number;
}) {
  const scale   = useSharedValue(0.5);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value   = withDelay(delay, withSequence(
      withTiming(1.15, { duration: 300, easing: Easing.out(Easing.back(2)) }),
      withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) }),
    ));
    opacity.value = withDelay(delay, withTiming(1, { duration: 250 }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePress = () => {
    scale.value = withSequence(
      withTiming(0.85, { duration: 80 }),
      withTiming(1.1, { duration: 120, easing: Easing.out(Easing.back(2)) }),
      withTiming(1, { duration: 100 }),
    );
    onPress();
  };

  return (
    <AnimatedPressable hitSlop={12} onPress={handlePress} style={[{ position: 'relative' }, animStyle]}>
      {children}
    </AnimatedPressable>
  );
}

// ─── Live ping dot ────────────────────────────────────────────────────────────
function PingDot({ color }: { color: string }) {
  const scale   = useSharedValue(1);
  const opacity = useSharedValue(1);
  useEffect(() => {
    scale.value   = withRepeat(withSequence(withTiming(2, { duration: 900 }), withTiming(1, { duration: 0 })), -1);
    opacity.value = withRepeat(withSequence(withTiming(0, { duration: 900 }), withTiming(1, { duration: 0 })), -1);
  }, []);
  const ring = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));
  return (
    <View style={{ width: 8, height: 8 }}>
      <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 4, backgroundColor: color }, ring]} />
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
    </View>
  );
}

// ─── Live Session Card ────────────────────────────────────────────────────────
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
  const timeStr = elapsed < 1 ? 'Just started' : elapsed < 60 ? `${elapsed}m ago` : `${Math.floor(elapsed / 60)}h ${elapsed % 60}m`;
  return (
    <Animated.View entering={FadeInDown.duration(400).springify()}>
      <Pressable style={liveStyles.card} onPress={() => onJoin(session)}>
        {/* Thumbnail or gradient banner */}
        <View style={[liveStyles.banner, { backgroundColor: pColor + '18' }]}>
          {session.thumbnailUrl ? (
            <Image source={{ uri: session.thumbnailUrl }} style={liveStyles.thumbnail} resizeMode="cover" />
          ) : (
            <Ionicons name={pIcon} size={36} color={pColor} />
          )}
          {/* LIVE badge */}
          <View style={liveStyles.liveBadge}>
            <LiveDotPulse />
            <Text style={liveStyles.liveBadgeText}>LIVE</Text>
          </View>
        </View>

        {/* Info row */}
        <View style={liveStyles.info}>
          {/* Avatar */}
          <View style={liveStyles.avatarWrap}>
            {session.teacherAvatar ? (
              <Image source={{ uri: session.teacherAvatar }} style={liveStyles.avatar} />
            ) : (
              <View style={[liveStyles.avatarFallback, { backgroundColor: pColor + '22' }]}>
                <Text style={[liveStyles.avatarInitial, { color: pColor }]}>
                  {(session.teacherName || 'T')[0].toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          {/* Text */}
          <View style={liveStyles.textBlock}>
            <Text style={liveStyles.title} numberOfLines={2}>{session.title}</Text>
            <Text style={liveStyles.teacher}>{session.teacherName}</Text>
            <View style={liveStyles.meta}>
              <Ionicons name={pIcon} size={12} color={pColor} />
              <Text style={[liveStyles.metaText, { color: pColor }]}>
                {session.platform.charAt(0).toUpperCase() + session.platform.slice(1)}
              </Text>
              <Text style={liveStyles.dot}>·</Text>
              <Text style={liveStyles.metaText}>{timeStr}</Text>
              {(session.viewerCount || 0) > 0 && (
                <>
                  <Text style={liveStyles.dot}>·</Text>
                  <Ionicons name="eye-outline" size={12} color={MUTED} />
                  <Text style={liveStyles.metaText}>{session.viewerCount}</Text>
                </>
              )}
            </View>
          </View>

          {/* Join button */}
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
  card: { backgroundColor: CARD, borderRadius: 16, marginHorizontal: 16, marginVertical: 8, overflow: 'hidden', borderWidth: 1, borderColor: BORDER + '60', elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  banner: { height: 140, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  thumbnail: { position: 'absolute', width: '100%', height: '100%' },
  liveBadge: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  liveBadgeText: { color: '#FFF', fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1.2 },
  info: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  avatarWrap: {},
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  textBlock: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: TEXT, lineHeight: 19 },
  teacher: { fontSize: 12, color: MUTED, fontFamily: 'Inter_500Medium' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, flexWrap: 'wrap' },
  metaText: { fontSize: 11, color: MUTED, fontFamily: 'Inter_400Regular' },
  dot: { fontSize: 11, color: MUTED },
  joinBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  joinText: { color: '#FFF', fontSize: 13, fontFamily: 'Inter_700Bold' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const {
    posts, profile, isLoading, isOnboarded,
    toggleLike, addComment, deletePost, updatePost,
    refreshData, totalUnread,
  } = useApp();

  const isTech    = profile?.role === 'technician';
  const isTeacher = profile?.role === 'teacher' || profile?.role === 'admin';

  useEffect(() => {
    if (!isLoading && !isOnboarded) {
      router.replace('/onboarding');
    }
  }, [isLoading, isOnboarded]);

  const [filter, setFilter]             = useState<FilterKey>('all');
  const [refreshing, setRefreshing]     = useState(false);
  const [liveUrl, setLiveUrl]           = useState('');
  const [schematicsUrl, setSchematicsUrl] = useState('');
  const [webToolsUrl, setWebToolsUrl]   = useState('');

  // ── Live sessions state ──
  const [liveSessions, setLiveSessions]       = useState<LiveSession[]>([]);
  const [liveLoading, setLiveLoading]         = useState(false);
  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLiveSessions = useCallback(async () => {
    try {
      const res  = await apiRequest('GET', '/api/teacher/live-sessions');
      const data = await res.json();
      if (data.sessions) setLiveSessions(data.sessions as LiveSession[]);
    } catch {}
  }, []);

  // Poll live sessions every 30s when on Live tab
  useEffect(() => {
    if (filter === 'live') {
      setLiveLoading(true);
      fetchLiveSessions().finally(() => setLiveLoading(false));
      liveIntervalRef.current = setInterval(fetchLiveSessions, 30000);
    } else {
      if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
    }
    return () => { if (liveIntervalRef.current) clearInterval(liveIntervalRef.current); };
  }, [filter, fetchLiveSessions]);

  const handleJoinLive = useCallback((session: LiveSession) => {
    router.push({
      pathname: '/live-session',
      params: { url: session.link, title: session.title },
    } as any);
  }, []);

  const loadSettings = useCallback(() => {
    apiRequest('GET', '/api/app-settings')
      .then(r => r.json())
      .then(data => {
        if (data.live_url)       setLiveUrl(data.live_url);
        if (data.schematics_url) setSchematicsUrl(data.schematics_url);
        if (data.web_tools_url)  setWebToolsUrl(data.web_tools_url);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);
  useFocusEffect(useCallback(() => { loadSettings(); }, [loadSettings]));

  const filtered = (() => {
    if (filter === 'all')        return posts;
    if (filter === 'technician') return posts.filter(p => p.userRole === 'technician');
    if (filter === 'customer')   return posts.filter(p => p.userRole === 'customer');
    if (filter === 'teacher')    return posts.filter(p => p.userRole === 'teacher');
    if (filter === 'supplier')   return posts.filter(p => p.userRole === 'supplier');
    if (filter === 'live')       return [];
    return posts.filter(p => p.category === filter);
  })();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (filter === 'live') {
      await fetchLiveSessions();
    } else {
      await refreshData();
    }
    setRefreshing(false);
  }, [refreshData, fetchLiveSessions, filter]);

  const topPad = (Platform.OS === 'web' ? 67 : insets.top) + 10;

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: topPad }]}>
          <View style={styles.logoBox}>
            <Ionicons name="phone-portrait" size={22} color="#FFF" />
          </View>
          <Text style={styles.headerTitle}>Mobi</Text>
        </View>
        {[1, 2, 3].map(i => <PostSkeleton key={i} />)}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: topPad }]}>
        {/* Profile avatar + App icon */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable onPress={() => router.push('/profile' as any)}>
            {profile?.avatar ? (
              <Image
                source={{ uri: profile.avatar }}
                style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: PRIMARY + '40' }}
              />
            ) : (
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: PRIMARY + '20', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="person" size={18} color={PRIMARY} />
              </View>
            )}
          </Pressable>
          <View style={styles.logoBox}>
            <Ionicons name="phone-portrait" size={22} color="#FFF" />
          </View>
        </View>

        <View style={styles.headerActions}>
          {/* AI Repair Assistant */}
          <HeaderButton delay={0} onPress={() => router.push('/ai-repair')}>
            <View style={styles.aiBtnHeader}>
              <Ionicons name="hardware-chip" size={14} color="#FFF" />
              <Text style={styles.aiBtnHeaderText}>AI</Text>
            </View>
          </HeaderButton>

          {/* Schematics */}
          <HeaderButton delay={100} onPress={() => {
            if (schematicsUrl) {
              if (isTech && profile?.subscriptionEnd && profile.subscriptionEnd < Date.now()) {
                Alert.alert('Subscription Required', 'Subscribe to access Schematics.');
                return;
              }
              router.push({ pathname: '/webview', params: { url: schematicsUrl, title: 'Schematics' } });
            } else {
              Alert.alert('Coming Soon', 'Schematics not configured yet.');
            }
          }}>
            <View style={styles.schBtn}>
              <Ionicons name="document-text" size={14} color="#000" />
              <Text style={styles.schBtnText}>SCH</Text>
            </View>
          </HeaderButton>

          {/* Live Chat - blue pill with ping */}
          <HeaderButton delay={80} onPress={() => router.push('/live-chat')}>
            <View style={styles.liveChatBtn}>
              <Ionicons name="chatbubble" size={13} color={BLUE} />
              <Text style={styles.liveChatText}>Live Chat</Text>
              <View style={styles.pingOuter}>
                <PingDot color={BLUE} />
              </View>
            </View>
          </HeaderButton>

          {/* Web Tools */}
          {webToolsUrl ? (
            <HeaderButton delay={160} onPress={() => router.push({ pathname: '/webview', params: { url: webToolsUrl, title: 'Web Tools' } })}>
              <View style={styles.iconBtn}>
                <Ionicons name="globe-outline" size={18} color={BLUE} />
              </View>
            </HeaderButton>
          ) : null}

          {/* Notifications → Chat */}
          <HeaderButton delay={240} onPress={() => router.push('/(tabs)/profile')}>
            <View style={styles.bellBtn}>
              <Ionicons name="notifications" size={18} color={TEXT} />
              {totalUnread > 0 && <View style={styles.redDot} />}
            </View>
          </HeaderButton>
        </View>
      </View>

      {/* ── Search bar ── */}
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={15} color={MUTED} />
          <Text style={styles.searchPlaceholder}>Search repairs, techs, or issues...</Text>
        </View>
      </View>

      {/* ── Category Filters — scrollable horizontal ── */}
      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContent}
          scrollEventThrottle={16}
        >
          {FILTERS.map((item) => {
            const isActive = filter === item.key;
            const chipColor = item.color;
            return (
              <Pressable
                key={item.key}
                style={[
                  styles.filterChip,
                  isActive
                    ? {
                        backgroundColor: chipColor || PRIMARY,
                        borderColor: chipColor || PRIMARY,
                      }
                    : {
                        backgroundColor: SURFACE,
                        borderColor: BORDER + '80',
                      },
                ]}
                onPress={() => setFilter(item.key)}
              >
                <Ionicons
                  name={item.icon}
                  size={13}
                  color={isActive ? '#FFF' : chipColor || MUTED}
                />
                <Text style={[
                  styles.filterText,
                  { color: isActive ? '#FFF' : chipColor || MUTED },
                ]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Live tab OR regular feed ── */}
      {filter === 'live' ? (
        <FlatList
          data={liveSessions}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <LiveCard session={item} onJoin={handleJoinLive} />
          )}
          contentContainerStyle={{ paddingVertical: 12, paddingBottom: Platform.OS === 'web' ? 118 : 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={RED} colors={[RED]} />
          }
          ListHeaderComponent={
            <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
              {/* Go Live button for teachers */}
              {isTeacher && (
                <Pressable
                  style={styles.goLiveBtn}
                  onPress={() => router.push('/go-live')}
                >
                  <View style={styles.goLiveDot} />
                  <Text style={styles.goLiveBtnText}>Go Live Now</Text>
                  <Ionicons name="chevron-forward" size={16} color="#FFF" style={{ marginLeft: 'auto' }} />
                </Pressable>
              )}
              <View style={styles.liveHeaderRow}>
                <LiveDotPulse />
                <Text style={styles.liveHeaderTitle}>Live Now</Text>
                {liveLoading && <ActivityIndicator size="small" color={RED} style={{ marginLeft: 6 }} />}
                <Text style={styles.liveHeaderCount}>{liveSessions.length} streaming</Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            liveLoading ? null : (
              <View style={styles.emptyState}>
                <View style={[styles.emptyIconBg, { backgroundColor: RED + '15' }]}>
                  <Ionicons name="radio-outline" size={32} color={RED} />
                </View>
                <Text style={styles.emptyTitle}>No live sessions right now</Text>
                <Text style={styles.emptyText}>
                  {isTeacher
                    ? 'Tap "Go Live Now" to start streaming to all technicians'
                    : 'Teachers will appear here when they go live'}
                </Text>
                {isTeacher && (
                  <Pressable style={[styles.goLiveBtn, { marginTop: 20, width: '80%' }]} onPress={() => router.push('/go-live')}>
                    <View style={styles.goLiveDot} />
                    <Text style={styles.goLiveBtnText}>Start Streaming</Text>
                  </Pressable>
                )}
              </View>
            )
          }
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index * 40, 300)).duration(400).springify()}>
              <PostCard
                post={item}
                currentUserId={profile?.id}
                onLike={toggleLike}
                onComment={addComment}
                onDelete={profile?.id === item.userId ? deletePost : undefined}
                onPostUpdated={(updated) => updatePost(updated.id, updated)}
              />
            </Animated.View>
          )}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Platform.OS === 'web' ? 118 : 100 },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} colors={[PRIMARY]} />
          }
          ListHeaderComponent={
            filtered.length > 0 ? (
              <View style={styles.feedHeader}>
                <Text style={styles.feedHeaderTitle}>Community Feed</Text>
                <Text style={styles.feedHeaderSub}>(India)</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconBg}>
                <Ionicons name="newspaper-outline" size={32} color={PRIMARY} />
              </View>
              <Text style={styles.emptyTitle}>No posts yet</Text>
              <Text style={styles.emptyText}>Be the first to share something with the community</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 12,
    backgroundColor: BG,
    borderBottomWidth: 1,
    borderBottomColor: BORDER + '40',
  },
  logoBox: {
    width: 50,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#CA8A04',
    shadowColor: '#EAB308',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: TEXT,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  schBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFD60A',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
  },
  schBtnText: {
    fontSize: 10,
    color: '#000',
    fontFamily: 'Inter_700Bold',
  },
  liveChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER + '80',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    position: 'relative',
  },
  liveChatText: {
    fontSize: 11,
    color: BLUE,
    fontFamily: 'Inter_600SemiBold',
  },
  pingOuter: {
    position: 'absolute',
    top: -2,
    right: -2,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER + '80',
  },
  bellBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER + '80',
    position: 'relative',
  },
  redDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  searchRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: BG,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: SURFACE,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: BORDER + '80',
  },
  searchPlaceholder: {
    color: MUTED,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  filterContainer: {
    backgroundColor: BG,
    borderBottomWidth: 1,
    borderBottomColor: BORDER + '40',
  },
  filtersContent: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 6,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 22,
    borderWidth: 1,
    minHeight: 34,
  },
  filterText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  feedHeaderTitle: {
    color: TEXT,
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },
  feedHeaderSub: {
    color: MUTED,
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  listContent: {
    paddingTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 14,
    paddingHorizontal: 40,
  },
  emptyIconBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY + '20',
    marginBottom: 4,
  },
  emptyTitle: {
    color: TEXT,
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
  },
  emptyText: {
    color: MUTED,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  goLiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: RED,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 16,
    shadowColor: RED,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  goLiveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFF',
  },
  goLiveBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    flex: 1,
  },
  liveHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  liveHeaderTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: TEXT,
    flex: 1,
  },
  liveHeaderCount: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: MUTED,
  },
  aiBtnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  aiBtnHeaderText: {
    fontSize: 11,
    color: '#FFF',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },
});
