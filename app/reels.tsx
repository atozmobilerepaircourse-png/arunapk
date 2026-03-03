import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, Platform,
  ActivityIndicator, Dimensions, Alert, ViewToken, Modal,
  TextInput, ScrollView, Keyboard,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { isBunnyUrl, getBunnyEmbedUrl, resolveBunnyPlaybackUrl } from '@/lib/bunny-cdn';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSequence,
  withDelay, runOnJS, withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import Colors from '@/constants/colors';
import { useApp } from '@/lib/context';
import { apiRequest, getApiUrl } from '@/lib/query-client';
import { Reel, Comment, UserRole } from '@/lib/types';

const C = Colors.light;
const { width: SW, height: SH } = Dimensions.get('window');

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

function CommentItem({ comment }: { comment: Comment }) {
  return (
    <View style={cs.commentItem}>
      <View style={cs.commentAvatar}>
        <Text style={cs.commentAvatarText}>{comment.userName.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={cs.commentContent}>
        <Text style={cs.commentLine}>
          <Text style={cs.commentName}>{comment.userName} </Text>
          <Text style={cs.commentBody}>{comment.text}</Text>
        </Text>
        <Text style={cs.commentTime}>{timeAgo(comment.createdAt)}</Text>
      </View>
    </View>
  );
}

function CommentsModal({
  visible, onClose, comments, reelId, userId, userName, onCommentAdded,
}: {
  visible: boolean;
  onClose: () => void;
  comments: Comment[];
  reelId: string;
  userId?: string;
  userName?: string;
  onCommentAdded: (reelId: string, comments: Comment[]) => void;
}) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleSend = async () => {
    if (!text.trim() || !userId || !userName || sending) return;
    setSending(true);
    try {
      const res = await apiRequest('POST', `/api/reels/${reelId}/comment`, {
        userId, userName, text: text.trim(),
      });
      const data = await res.json();
      if (data.success) {
        onCommentAdded(reelId, data.comments);
        setText('');
      }
    } catch (e) {
      console.error('[Reels] Comment error:', e);
    } finally {
      setSending(false);
    }
  };

  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e: any) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => { showSub.remove(); hideSub.remove(); };
  }, [visible]);

  const sheetBottom = keyboardHeight > 0 ? keyboardHeight : 0;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={cs.modalOverlay}>
        <Pressable style={cs.backdrop} onPress={onClose} />
        <View style={[cs.sheet, { bottom: sheetBottom, paddingBottom: keyboardHeight > 0 ? 8 : Math.max(insets.bottom, 8) }]}>  
          <View style={cs.handle} />
          <Text style={cs.sheetTitle}>Comments</Text>

          <ScrollView
            style={cs.listWrap}
            contentContainerStyle={comments.length === 0 ? cs.emptyWrap : { paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {comments.length === 0 ? (
              <>
                <Text style={cs.emptyText}>No comments yet</Text>
                <Text style={cs.emptySub}>Start the conversation.</Text>
              </>
            ) : (
              comments.map(item => <CommentItem key={item.id} comment={item} />)
            )}
          </ScrollView>

          {userId && (
            <View style={cs.inputRow}>
              <View style={cs.inputAvatar}>
                <Text style={cs.inputAvatarText}>{(userName || 'U').charAt(0).toUpperCase()}</Text>
              </View>
              <View style={cs.inputWrap}>
                <TextInput
                  ref={inputRef}
                  style={cs.input}
                  placeholder="Add a comment..."
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={text}
                  onChangeText={setText}
                  multiline
                  maxLength={500}
                />
              </View>
              <Pressable
                onPress={handleSend}
                disabled={!text.trim() || sending}
                hitSlop={8}
              >
                <Text style={[cs.postBtn, (!text.trim() || sending) && cs.postBtnOff]}>Post</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function ReelItem({ reel, isActive, currentUserId, onLike, onDelete, onOpenComments }: {
  reel: Reel;
  isActive: boolean;
  currentUserId?: string;
  onLike: (id: string) => void;
  onDelete?: (id: string) => void;
  onOpenComments: (reel: Reel) => void;
}) {
  const insets = useSafeAreaInsets();
  const isLiked = currentUserId ? reel.likes.includes(currentUserId) : false;
  const baseUrl = getApiUrl();
  const rawVideoUrl = (reel.videoUrl.startsWith('http') || reel.videoUrl.includes('b-cdn.net'))
    ? reel.videoUrl
    : `${baseUrl}${reel.videoUrl}`;
  const videoSource = isBunnyUrl(rawVideoUrl)
    ? resolveBunnyPlaybackUrl(rawVideoUrl)
    : rawVideoUrl;
  const bunnyEmbedUrl = isBunnyUrl(rawVideoUrl) ? getBunnyEmbedUrl(rawVideoUrl, isActive) : null;
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const lastTap = useRef(0);

  const heartScale = useSharedValue(0);
  const heartOpacity = useSharedValue(0);
  const muteIconOpacity = useSharedValue(0);
  const pauseIconOpacity = useSharedValue(0);

  const useIframe = Platform.OS === 'web' && !!bunnyEmbedUrl;

  const player = useVideoPlayer(useIframe ? '' : videoSource, (p) => {
    p.loop = true;
    p.volume = 1;
  });

  useEffect(() => {
    if (useIframe) return;
    if (isActive && !paused) {
      player.play();
    } else {
      player.pause();
      if (!isActive) {
        player.currentTime = 0;
        setPaused(false);
      }
    }
  }, [isActive, paused, player, useIframe]);

  useEffect(() => {
    if (useIframe) return;
    player.muted = muted;
  }, [muted, player, useIframe]);

  const triggerDoubleTapLike = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!isLiked) onLike(reel.id);
    heartOpacity.value = 1;
    heartScale.value = withSequence(
      withSpring(1.2, { damping: 6, stiffness: 200 }),
      withDelay(600, withTiming(0, { duration: 300 }))
    );
    heartOpacity.value = withDelay(600, withTiming(0, { duration: 300 }));
  };

  const showMuteIcon = () => {
    muteIconOpacity.value = withSequence(
      withTiming(1, { duration: 100 }),
      withDelay(700, withTiming(0, { duration: 300 }))
    );
  };

  const showPauseIcon = () => {
    pauseIconOpacity.value = withSequence(
      withTiming(1, { duration: 100 }),
      withDelay(500, withTiming(0, { duration: 300 }))
    );
  };

  const handleTap = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTap.current < DOUBLE_TAP_DELAY) {
      lastTap.current = 0;
      triggerDoubleTapLike();
    } else {
      lastTap.current = now;
      setTimeout(() => {
        if (lastTap.current !== 0) {
          lastTap.current = 0;
          setPaused(p => {
            const next = !p;
            runOnJS(showPauseIcon)();
            return next;
          });
        }
      }, DOUBLE_TAP_DELAY);
    }
  };

  const handleLongPress = () => {
    setMuted(m => !m);
    showMuteIcon();
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
    opacity: heartOpacity.value,
  }));
  const muteStyle = useAnimatedStyle(() => ({ opacity: muteIconOpacity.value }));
  const pauseStyle = useAnimatedStyle(() => ({ opacity: pauseIconOpacity.value }));

  const handleSideLike = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onLike(reel.id);
  };

  return (
    <View style={[s.reelWrap, { height: SH }]}>
      {Platform.OS === 'web' && bunnyEmbedUrl ? (
        <iframe
          src={bunnyEmbedUrl}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' } as any}
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <VideoView player={player} style={s.video} contentFit="cover" nativeControls={false} />
      )}

      <Pressable style={s.tapZone} onPress={handleTap} onLongPress={handleLongPress} delayLongPress={400} />

      <Animated.View style={[s.centerIcon, heartStyle]} pointerEvents="none">
        <Ionicons name="heart" size={90} color="#fff" />
      </Animated.View>

      <Animated.View style={[s.centerIcon, muteStyle]} pointerEvents="none">
        <View style={s.muteCircle}>
          <Ionicons name={muted ? "volume-mute" : "volume-high"} size={28} color="#fff" />
        </View>
      </Animated.View>

      <Animated.View style={[s.centerIcon, pauseStyle]} pointerEvents="none">
        <View style={s.muteCircle}>
          <Ionicons name={paused ? "pause" : "play"} size={28} color="#fff" />
        </View>
      </Animated.View>

      <View style={[s.topBar, { paddingTop: insets.top + 6 }]}>
        <Pressable hitSlop={14} onPress={() => router.back()} style={s.topBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <Text style={s.topLabel}>Reels</Text>
        <View style={{ width: 34 }} />
      </View>

      <View style={[s.bottom, { paddingBottom: insets.bottom + 12 }]}>
        <View style={s.bottomLeft}>
          <Pressable
            style={s.authorRow}
            onPress={() => router.push({ pathname: '/user-profile', params: { id: reel.userId } })}
          >
            {reel.userAvatar ? (
              <Image
                source={{ uri: (reel.userAvatar.startsWith('http') || reel.userAvatar.includes('b-cdn.net')) ? reel.userAvatar : `${baseUrl}${reel.userAvatar}` }}
                style={s.authorAv}
              />
            ) : (
              <View style={[s.authorAv, s.authorAvPlaceholder]}>
                <Text style={s.authorAvText}>{reel.userName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <Text style={s.authorName}>{reel.userName}</Text>
          </Pressable>
          {reel.title ? <Text style={s.desc} numberOfLines={1}>{reel.title}</Text> : null}
          {reel.description ? <Text style={s.desc} numberOfLines={2}>{reel.description}</Text> : null}
        </View>

        <View style={s.sideBar}>
          <Pressable style={s.sideItem} onPress={handleSideLike}>
            <Ionicons name={isLiked ? "heart" : "heart-outline"} size={28} color={isLiked ? "#FF3040" : "#fff"} />
            <Text style={s.sideCount}>{reel.likes.length}</Text>
          </Pressable>

          <Pressable style={s.sideItem} onPress={() => onOpenComments(reel)}>
            <Ionicons name="chatbubble-outline" size={25} color="#fff" />
            <Text style={s.sideCount}>{reel.comments.length}</Text>
          </Pressable>

          <Pressable style={s.sideItem} onPress={() => {
            setMuted(m => !m);
            showMuteIcon();
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}>
            <Ionicons name={muted ? "volume-mute-outline" : "volume-high-outline"} size={25} color="#fff" />
          </Pressable>

          {onDelete && (
            <Pressable style={s.sideItem} onPress={() => {
              Alert.alert('Delete Reel', 'Are you sure you want to delete this reel?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => onDelete(reel.id) },
              ]);
            }}>
              <Ionicons name="trash-outline" size={23} color="#fff" />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

export default function ReelsScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useApp();
  const [reelsList, setReelsList] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [commentReelId, setCommentReelId] = useState<string | null>(null);

  const fetchReels = useCallback(async () => {
    try {
      const res = await apiRequest('GET', '/api/reels');
      const data = await res.json();
      if (Array.isArray(data)) setReelsList(data);
    } catch (e) {
      console.error('[Reels] Fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReels(); }, [fetchReels]);

  const handleLike = useCallback(async (reelId: string) => {
    if (!profile) return;
    try {
      const res = await apiRequest('POST', `/api/reels/${reelId}/like`, { userId: profile.id });
      const data = await res.json();
      if (data.success) {
        setReelsList(prev => prev.map(r => r.id === reelId ? { ...r, likes: data.likes } : r));
      }
    } catch (e) {
      console.error('[Reels] Like error:', e);
    }
  }, [profile]);

  const handleDelete = useCallback(async (reelId: string) => {
    try {
      await apiRequest('DELETE', `/api/reels/${reelId}`);
      setReelsList(prev => prev.filter(r => r.id !== reelId));
    } catch (e) {
      console.error('[Reels] Delete error:', e);
    }
  }, []);

  const handleCommentAdded = useCallback((reelId: string, comments: Comment[]) => {
    setReelsList(prev => prev.map(r => r.id === reelId ? { ...r, comments } : r));
  }, []);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setActiveIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 70 }).current;

  if (loading) {
    return (
      <View style={[s.container, s.center]}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (reelsList.length === 0) {
    return (
      <View style={[s.container, s.center]}>
        <View style={[s.topBar, { paddingTop: (Platform.OS === 'web' ? 67 : insets.top) + 6, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }]}>
          <Pressable hitSlop={14} onPress={() => router.back()} style={s.topBtn}>
            <Ionicons name="arrow-back" size={24} color={C.text} />
          </Pressable>
          <Text style={s.topLabel}>Reels</Text>
          <View style={{ width: 34 }} />
        </View>
        <MaterialCommunityIcons name="video-off-outline" size={48} color={C.textTertiary} />
        <Text style={s.emptyTitle}>No reels yet</Text>
        <Text style={s.emptyDesc}>Technicians, teachers and suppliers can upload videos here</Text>
        {(profile?.role === 'teacher' || profile?.role === 'supplier' || profile?.role === 'technician') && (
          <Pressable style={s.emptyBtn} onPress={() => router.push('/upload-reel')}>
            <Ionicons name="add-circle" size={20} color="#fff" />
            <Text style={s.emptyBtnText}>Upload Reel</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={s.container}>
      <FlatList
        data={reelsList}
        keyExtractor={item => item.id}
        renderItem={({ item, index }) => (
          <ReelItem
            reel={item}
            isActive={index === activeIndex}
            currentUserId={profile?.id}
            onLike={handleLike}
            onDelete={profile?.id === item.userId ? handleDelete : undefined}
            onOpenComments={(r) => setCommentReelId(r.id)}
          />
        )}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={SH}
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({ length: SH, offset: SH * index, index })}
      />

      {(profile?.role === 'teacher' || profile?.role === 'supplier' || profile?.role === 'technician') && (
        <Pressable
          style={[s.fab, { bottom: insets.bottom + 16 }]}
          onPress={() => router.push('/upload-reel')}
        >
          <Ionicons name="add" size={26} color="#fff" />
        </Pressable>
      )}

      {commentReelId && (
        <CommentsModal
          visible={!!commentReelId}
          onClose={() => setCommentReelId(null)}
          comments={reelsList.find(r => r.id === commentReelId)?.comments || []}
          reelId={commentReelId}
          userId={profile?.id}
          userName={profile?.name}
          onCommentAdded={handleCommentAdded}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { justifyContent: 'center', alignItems: 'center' },
  reelWrap: { width: SW, backgroundColor: '#000' },
  video: { ...StyleSheet.absoluteFillObject },
  tapZone: { ...StyleSheet.absoluteFillObject, zIndex: 5 },

  centerIcon: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 8,
  },
  muteCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center',
  },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, zIndex: 12,
  },
  topBtn: {
    width: 34, height: 34, borderRadius: 17,
    justifyContent: 'center', alignItems: 'center',
  },
  topLabel: {
    color: '#fff', fontSize: 17, fontFamily: 'Inter_700Bold',
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },

  bottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 14, zIndex: 12,
  },
  bottomLeft: { flex: 1, marginRight: 8, marginBottom: 4 },
  authorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  authorAv: {
    width: 32, height: 32, borderRadius: 16,
    marginRight: 8, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)',
  },
  authorAvPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  authorAvText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 13 },
  authorName: {
    color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 14,
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  desc: {
    color: 'rgba(255,255,255,0.9)', fontFamily: 'Inter_400Regular', fontSize: 13,
    marginBottom: 2, lineHeight: 18,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },

  sideBar: { alignItems: 'center', gap: 18, paddingBottom: 4 },
  sideItem: { alignItems: 'center' },
  sideCount: {
    color: '#fff', fontSize: 12, fontFamily: 'Inter_600SemiBold', marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },

  fab: {
    position: 'absolute', alignSelf: 'center', left: SW / 2 - 24,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: C.primary,
    justifyContent: 'center', alignItems: 'center',
    elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 5, zIndex: 20,
  },

  emptyTitle: { color: C.text, fontSize: 17, fontFamily: 'Inter_600SemiBold', marginTop: 14 },
  emptyDesc: { color: C.textSecondary, fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 4, textAlign: 'center', paddingHorizontal: 40 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.primary, paddingHorizontal: 18, paddingVertical: 11,
    borderRadius: 22, marginTop: 20, gap: 6,
  },
  emptyBtnText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 14 },
});

const cs = StyleSheet.create({
  modalOverlay: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute', left: 0, right: 0,
    height: SH * 0.55,
    backgroundColor: '#1C1C1E', borderTopLeftRadius: 18, borderTopRightRadius: 18,
    paddingHorizontal: 14,
  },
  listWrap: { flex: 1, marginTop: 4 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#555', alignSelf: 'center', marginTop: 10, marginBottom: 8 },
  sheetTitle: {
    color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 15,
    textAlign: 'center', paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyText: { color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  emptySub: { color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 4 },

  commentItem: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 2 },
  commentAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#3a3a3c', justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  commentAvatarText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 13 },
  commentContent: { flex: 1 },
  commentLine: { fontSize: 14, lineHeight: 20 },
  commentName: { color: '#fff', fontFamily: 'Inter_700Bold' },
  commentBody: { color: 'rgba(255,255,255,0.9)', fontFamily: 'Inter_400Regular' },
  commentTime: { color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 4 },

  inputRow: {
    flexDirection: 'row', alignItems: 'center', paddingTop: 10, paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.12)', gap: 10,
  },
  inputAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#3a3a3c', justifyContent: 'center', alignItems: 'center',
  },
  inputAvatarText: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  inputWrap: {
    flex: 1,
    backgroundColor: '#2C2C2E',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14,
    justifyContent: 'center',
    minHeight: 38,
  },
  input: {
    color: '#fff', fontFamily: 'Inter_400Regular', fontSize: 14,
    paddingVertical: Platform.OS === 'ios' ? 8 : 6, maxHeight: 80,
  },
  postBtn: { color: '#0095F6', fontFamily: 'Inter_700Bold', fontSize: 14 },
  postBtnOff: { opacity: 0.3 },
});
