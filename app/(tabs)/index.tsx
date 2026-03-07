import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  Pressable, Platform, ActivityIndicator, Linking, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, withDelay, Easing } from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { useApp } from '@/lib/context';
import { openLink } from '@/lib/open-link';
import { PostCategory } from '@/lib/types';
import PostCard from '@/components/PostCard';
import { apiRequest } from '@/lib/query-client';

const C2 = Colors.light;

function SkeletonBox({ width, height, borderRadius = 8, style }: { width: number | string; height: number; borderRadius?: number; style?: any }) {
  const opacity = useSharedValue(0.4);
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700, easing: Easing.ease }),
        withTiming(0.4, { duration: 700, easing: Easing.ease })
      ),
      -1
    );
  }, []);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[{ width: width as any, height, borderRadius, backgroundColor: C2.surface }, animStyle, style]} />
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
      <SkeletonBox width="100%" height={180} borderRadius={12} />
      <SkeletonBox width="80%" height={14} />
      <SkeletonBox width="50%" height={12} />
    </View>
  );
}

const C = Colors.light;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function HeaderButton({ children, onPress, delay = 0, style }: { children: React.ReactNode; onPress: () => void; delay?: number; style?: any }) {
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(delay, withSequence(
      withTiming(1.15, { duration: 300, easing: Easing.out(Easing.back(2)) }),
      withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) })
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
      withTiming(1, { duration: 100 })
    );
    onPress();
  };

  return (
    <AnimatedPressable hitSlop={12} onPress={handlePress} style={[styles.chatBtn, style, animStyle]}>
      {children}
    </AnimatedPressable>
  );
}

const FILTERS: { key: PostCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'repair', label: 'Repairs' },
  { key: 'job', label: 'Jobs' },
  { key: 'training', label: 'Training' },
  { key: 'supplier', label: 'Suppliers' },
  { key: 'sell', label: 'For Sale' },
];

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const { posts, profile, isLoading, isOnboarded, toggleLike, addComment, deletePost, updatePost, refreshData, totalUnread, liveChatUnread } = useApp();

  useEffect(() => {
    if (!isLoading && !isOnboarded) {
      router.replace('/onboarding');
    }
  }, [isLoading, isOnboarded]);

  // Customers can visit the feed when explicitly navigating there (e.g. from Watch Live Help button)

  const [filter, setFilter] = useState<PostCategory | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [liveUrl, setLiveUrl] = useState('');
  const [schematicsUrl, setSchematicsUrl] = useState('');
  const [webToolsUrl, setWebToolsUrl] = useState('');

  const loadSettings = useCallback(() => {
    apiRequest('GET', '/api/app-settings').then(r => r.json()).then(data => {
      if (data.live_url) setLiveUrl(data.live_url);
      if (data.schematics_url) setSchematicsUrl(data.schematics_url);
      if (data.web_tools_url) setWebToolsUrl(data.web_tools_url);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [loadSettings])
  );

  const filtered = filter === 'all' ? posts : posts.filter(p => p.category === filter);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: (Platform.OS === 'web' ? 67 : insets.top) + 12 }]}>
          <View style={styles.headerLeft}>
            <Ionicons name="construct" size={26} color={C.primary} />
            <Text style={styles.headerTitle}>Mobi</Text>
          </View>
        </View>
        {[1, 2, 3].map(i => <PostSkeleton key={i} />)}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 12 }]}>
        <View style={styles.headerLeft}>
          <Ionicons name="construct" size={26} color={C.primary} />
          <Text style={styles.headerTitle}>Mobi</Text>
        </View>
        <View style={styles.headerActions}>
          <HeaderButton delay={0} onPress={() => {
            if (schematicsUrl) {
              if (profile?.role === 'technician' && profile?.subscriptionEnd && profile.subscriptionEnd < Date.now()) {
                Alert.alert('Subscription Required', 'To access Schematics, please subscribe to our professional plan.');
                return;
              }
              router.push({ pathname: '/webview', params: { url: schematicsUrl, title: 'Schematics' } });
            } else {
              Alert.alert('Coming Soon', 'Schematics link has not been configured by the admin yet.');
            }
          }} style={{ 
            alignItems: 'center', 
            backgroundColor: '#FFD60A', 
            paddingHorizontal: 8, 
            paddingVertical: 4, 
            borderRadius: 12,
            shadowColor: '#FFD60A',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.5,
            shadowRadius: 4,
            elevation: 5
          }}>
            <Ionicons name="document-text" size={20} color="#000" />
            <Text style={{ fontSize: 8, color: '#000', marginTop: 1, fontWeight: '900' as const }}>SCHEMATICS</Text>
          </HeaderButton>
          {liveUrl ? (
            <HeaderButton delay={80} onPress={() => {
              openLink(liveUrl, 'Live');
            }} style={{ alignItems: 'center' }}>
              <Ionicons name="radio" size={24} color="#FF3B30" />
              <Text style={{ fontSize: 7, color: '#FF3B30', marginTop: 1, fontWeight: '700' as const }}>Live</Text>
            </HeaderButton>
          ) : null}
          {webToolsUrl ? (
            <HeaderButton delay={240} onPress={() => router.push({ pathname: '/webview', params: { url: webToolsUrl, title: 'Web Tools' } })} style={{ alignItems: 'center' }}>
              <Ionicons name="globe" size={24} color="#5E8BFF" />
              <Text style={{ fontSize: 7, color: '#5E8BFF', marginTop: 1, fontWeight: '700' as const }}>Tools</Text>
            </HeaderButton>
          ) : null}
          <HeaderButton delay={400} onPress={() => router.push('/chats')}>
            <Ionicons name="chatbubbles" size={24} color="#34C759" />
            {totalUnread > 0 && (
              <View style={[styles.unreadDot, { backgroundColor: '#34C759' }]}>
                <Text style={styles.unreadDotText}>{totalUnread}</Text>
              </View>
            )}
          </HeaderButton>
        </View>
      </View>

      <View style={styles.filtersContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTERS}
          contentContainerStyle={styles.filtersContent}
          keyExtractor={item => item.key}
          renderItem={({ item }) => (
            <Pressable
              style={[
                styles.filterChip,
                filter === item.key && styles.filterChipActive,
              ]}
              onPress={() => setFilter(item.key)}
            >
              <Text
                style={[
                  styles.filterText,
                  filter === item.key && styles.filterTextActive,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          )}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(Math.min(index * 50, 300)).duration(400).springify()}>
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
            <Ionicons name="newspaper-outline" size={48} color={C.textTertiary} />
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
    backgroundColor: C.background,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: C.background,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerTitle: {
    color: C.text,
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
  },
  filtersContainer: {
    marginBottom: 8,
  },
  filtersContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
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
  listContent: {
    paddingTop: 8,
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
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  chatBtn: {
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FF3B30',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDotText: {
    color: '#FFF',
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
  },
});
