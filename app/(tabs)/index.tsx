import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  Pressable, Platform, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, {
  FadeInDown, useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming, withDelay, Easing,
} from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { T, CATEGORY_COLORS } from '@/constants/techTheme';
import { useApp } from '@/lib/context';
import { openLink } from '@/lib/open-link';
import { PostCategory } from '@/lib/types';
import PostCard from '@/components/PostCard';
import { apiRequest } from '@/lib/query-client';

const CL = Colors.light;

// ─── Skeleton ────────────────────────────────────────────────────────────────
function SkeletonBox({
  width, height, borderRadius = 8, bgColor, style,
}: {
  width: number | string; height: number; borderRadius?: number; bgColor?: string; style?: any;
}) {
  const opacity = useSharedValue(0.4);
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700, easing: Easing.ease }),
        withTiming(0.4, { duration: 700, easing: Easing.ease }),
      ),
      -1,
    );
  }, []);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[{ width: width as any, height, borderRadius, backgroundColor: bgColor || T.card }, animStyle, style]}
    />
  );
}

function PostSkeleton({ dark }: { dark: boolean }) {
  const bg = dark ? T.cardSurface : '#E8E8E8';
  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <SkeletonBox width={44} height={44} borderRadius={22} bgColor={bg} />
        <View style={{ gap: 6, flex: 1 }}>
          <SkeletonBox width="60%" height={14} bgColor={bg} />
          <SkeletonBox width="40%" height={12} bgColor={bg} />
        </View>
      </View>
      <SkeletonBox width="100%" height={180} borderRadius={12} bgColor={bg} />
      <SkeletonBox width="80%" height={14} bgColor={bg} />
      <SkeletonBox width="50%" height={12} bgColor={bg} />
    </View>
  );
}

// ─── Header Button ────────────────────────────────────────────────────────────
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function HeaderButton({
  children, onPress, delay = 0, style,
}: {
  children: React.ReactNode; onPress: () => void; delay?: number; style?: any;
}) {
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(delay, withSequence(
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
    <AnimatedPressable hitSlop={12} onPress={handlePress} style={[{ position: 'relative' }, style, animStyle]}>
      {children}
    </AnimatedPressable>
  );
}

// ─── Filter Config ────────────────────────────────────────────────────────────
const FILTERS: { key: PostCategory | 'all'; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all',      label: 'All',       icon: 'grid-outline' },
  { key: 'repair',   label: 'Repairs',   icon: 'construct-outline' },
  { key: 'job',      label: 'Jobs',      icon: 'briefcase-outline' },
  { key: 'training', label: 'Training',  icon: 'school-outline' },
  { key: 'supplier', label: 'Suppliers', icon: 'cube-outline' },
  { key: 'sell',     label: 'For Sale',  icon: 'pricetag-outline' },
];

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

  const [filter, setFilter]           = useState<PostCategory | 'all'>('all');
  const [refreshing, setRefreshing]   = useState(false);
  const [liveUrl, setLiveUrl]         = useState('');
  const [schematicsUrl, setSchematicsUrl] = useState('');
  const [webToolsUrl, setWebToolsUrl] = useState('');

  const loadSettings = useCallback(() => {
    apiRequest('GET', '/api/app-settings')
      .then(r => r.json())
      .then(data => {
        if (data.live_url)        setLiveUrl(data.live_url);
        if (data.schematics_url)  setSchematicsUrl(data.schematics_url);
        if (data.web_tools_url)   setWebToolsUrl(data.web_tools_url);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);
  useFocusEffect(useCallback(() => { loadSettings(); }, [loadSettings]));

  const filtered = filter === 'all' ? posts : posts.filter(p => p.category === filter);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const topPad = (Platform.OS === 'web' ? webTopInset : insets.top) + 12;

  // ─── Dark/Light theme based on role ──────────────────────────────────────
  const bg       = isTech ? T.bg       : CL.background;
  const headerBg = isTech ? T.bg       : CL.background;
  const cardBg   = isTech ? T.card     : CL.surface;
  const txtMain  = isTech ? T.text     : CL.text;
  const txtMuted = isTech ? T.muted    : CL.textTertiary;
  const borderC  = isTech ? T.border   : CL.border;
  const primary  = CL.primary;

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: bg }]}>
        <View style={[styles.header, { paddingTop: topPad, backgroundColor: headerBg }]}>
          <View style={styles.headerLeft}>
            <View style={[styles.logoBox, { backgroundColor: isTech ? T.accentMuted : CL.primaryMuted }]}>
              <Ionicons name="construct" size={18} color={primary} />
            </View>
            <Text style={[styles.headerTitle, { color: txtMain }]}>Mobi</Text>
          </View>
        </View>
        {[1, 2, 3].map(i => <PostSkeleton key={i} dark={isTech} />)}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: headerBg, borderBottomColor: borderC }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.logoBox, { backgroundColor: isTech ? T.accentMuted : CL.primaryMuted }]}>
            <Ionicons name="construct" size={18} color={primary} />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: txtMain }]}>Mobi</Text>
            {isTech && (
              <Text style={styles.headerSub}>Community Feed</Text>
            )}
          </View>
        </View>

        <View style={styles.headerActions}>
          {/* Schematics */}
          <HeaderButton delay={0} onPress={() => {
            if (schematicsUrl) {
              if (profile?.role === 'technician' && profile?.subscriptionEnd && profile.subscriptionEnd < Date.now()) {
                Alert.alert('Subscription Required', 'Please subscribe to access Schematics.');
                return;
              }
              router.push({ pathname: '/webview', params: { url: schematicsUrl, title: 'Schematics' } });
            } else {
              Alert.alert('Coming Soon', 'Schematics not configured yet.');
            }
          }}>
            <View style={styles.schematicsBtn}>
              <Ionicons name="document-text" size={16} color="#000" />
              <Text style={styles.schematicsBtnText}>SCH</Text>
            </View>
          </HeaderButton>

          {/* Live */}
          {liveUrl ? (
            <HeaderButton delay={80} onPress={() => openLink(liveUrl, 'Live')}>
              <View style={styles.liveBtn}>
                <View style={styles.liveDot} />
                <Text style={styles.liveBtnText}>LIVE</Text>
              </View>
            </HeaderButton>
          ) : null}

          {/* Web Tools */}
          {webToolsUrl ? (
            <HeaderButton delay={160} onPress={() => router.push({ pathname: '/webview', params: { url: webToolsUrl, title: 'Web Tools' } })}>
              <View style={[styles.iconBtn, { backgroundColor: isTech ? T.blueMuted : 'rgba(94,139,255,0.1)' }]}>
                <Ionicons name="globe-outline" size={20} color="#5E8BFF" />
              </View>
            </HeaderButton>
          ) : null}

          {/* Chat */}
          <HeaderButton delay={240} onPress={() => router.push('/chats')}>
            <View style={[styles.iconBtn, { backgroundColor: isTech ? T.greenMuted : 'rgba(52,199,89,0.1)' }]}>
              <Ionicons name="chatbubbles-outline" size={20} color="#34C759" />
              {totalUnread > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{totalUnread > 99 ? '99+' : totalUnread}</Text>
                </View>
              )}
            </View>
          </HeaderButton>
        </View>
      </View>

      {/* ── Category Filters ── */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={FILTERS}
        style={{ flexGrow: 0, marginBottom: 4 }}
        contentContainerStyle={styles.filtersContent}
        keyExtractor={item => item.key}
        renderItem={({ item }) => {
          const isActive = filter === item.key;
          const cat = item.key !== 'all' ? CATEGORY_COLORS[item.key] : null;
          return (
            <Pressable
              style={[
                styles.filterChip,
                {
                  backgroundColor: isActive
                    ? (isTech && cat ? cat.bg : primary)
                    : (isTech ? T.card : CL.surfaceElevated),
                  borderColor: isActive
                    ? (isTech && cat ? cat.border : primary)
                    : (isTech ? T.border : CL.border),
                },
              ]}
              onPress={() => setFilter(item.key)}
            >
              <Ionicons
                name={item.icon}
                size={13}
                color={
                  isActive
                    ? (isTech && cat ? cat.text : '#FFF')
                    : (isTech ? T.muted : CL.textTertiary)
                }
              />
              <Text
                style={[
                  styles.filterText,
                  {
                    color: isActive
                      ? (isTech && cat ? cat.text : '#FFF')
                      : (isTech ? T.muted : CL.textTertiary),
                  },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        }}
      />

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
            tintColor={primary}
            colors={[primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconBg, { backgroundColor: isTech ? T.accentMuted : CL.primaryMuted }]}>
              <Ionicons name="newspaper-outline" size={32} color={primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: txtMain }]}>No posts yet</Text>
            <Text style={[styles.emptyText, { color: txtMuted }]}>
              Be the first to share something with the community
            </Text>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: T.muted,
    marginTop: -2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  schematicsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFD60A',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    shadowColor: '#FFD60A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  schematicsBtnText: {
    fontSize: 10,
    color: '#000',
    fontFamily: 'Inter_700Bold',
  },
  liveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(239,68,68,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  liveBtnText: {
    fontSize: 10,
    color: '#EF4444',
    fontFamily: 'Inter_700Bold',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
  },
  filtersContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
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
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
});
