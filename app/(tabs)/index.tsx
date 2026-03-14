import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  Pressable, Platform, Alert, ScrollView,
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

// ─── Filter type ─────────────────────────────────────────────────────────────
type FilterKey = PostCategory | 'all' | 'technician' | 'customer' | 'teacher' | 'supplier';

const FILTERS: { key: FilterKey; label: string; icon: keyof typeof Ionicons.glyphMap; color?: string }[] = [
  { key: 'all',        label: 'All Posts',        icon: 'layers-outline' },
  { key: 'technician', label: 'Technician Posts',  icon: 'construct-outline', color: GREEN },
  { key: 'customer',   label: 'Customer Posts',    icon: 'person-outline',    color: AMBER },
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

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const {
    posts, profile, isLoading, isOnboarded,
    toggleLike, addComment, deletePost, updatePost,
    refreshData, totalUnread,
  } = useApp();

  const isTech = profile?.role === 'technician';

  useEffect(() => {
    if (!isLoading && !isOnboarded) {
      router.replace('/onboarding');
    }
  }, [isLoading, isOnboarded]);

  const [filter, setFilter]       = useState<FilterKey>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [liveUrl, setLiveUrl]       = useState('');
  const [schematicsUrl, setSchematicsUrl] = useState('');
  const [webToolsUrl, setWebToolsUrl]     = useState('');

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
    return posts.filter(p => p.category === filter);
  })();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

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
        {/* App icon - yellow gradient */}
        <View style={styles.logoBox}>
          <Ionicons name="phone-portrait" size={22} color="#FFF" />
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

          {/* Chat / Bell */}
          <HeaderButton delay={240} onPress={() => router.push('/chats')}>
            <View style={styles.bellBtn}>
              <Ionicons name="notifications-outline" size={18} color={TEXT} />
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

      {/* ── Feed ── */}
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
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={PRIMARY}
            colors={[PRIMARY]}
          />
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
    paddingVertical: 10,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    borderWidth: 1,
    minHeight: 36,
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
    paddingVertical: 8,
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
    paddingTop: 4,
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
