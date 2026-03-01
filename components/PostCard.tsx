import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Platform, Dimensions, Alert, Modal } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withSequence } from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { Post, ROLE_LABELS, CATEGORY_LABELS } from '@/lib/types';
import MediaViewer from '@/components/MediaViewer';
import { apiRequest } from '@/lib/query-client';

const C = Colors.dark;
const SCREEN_WIDTH = Dimensions.get('window').width;

const CATEGORY_COLORS: Record<string, string> = {
  repair: '#34C759',
  job: '#5E8BFF',
  training: '#FFD60A',
  supplier: '#FF6B2C',
  sell: '#FF2D55',
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

interface PostCardProps {
  post: Post;
  currentUserId?: string;
  onLike: (postId: string) => void;
  onComment: (postId: string, text: string) => void;
  onDelete?: (postId: string) => void;
  onPostUpdated?: (updatedPost: Partial<Post> & { id: string }) => void;
}

export default function PostCard({ post, currentUserId, onLike, onComment, onDelete, onPostUpdated }: PostCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [viewerMedia, setViewerMedia] = useState<{type: 'image' | 'video', url: string} | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editText, setEditText] = useState(post.text);
  const [editSaving, setEditSaving] = useState(false);
  const isLiked = currentUserId ? post.likes.includes(currentUserId) : false;
  const isOwn = currentUserId === post.userId;
  const catColor = CATEGORY_COLORS[post.category] || C.primary;

  const handleShowOptions = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Post Options',
      '',
      [
        { text: 'Edit Post', onPress: () => { setEditText(post.text); setShowEditModal(true); } },
        onDelete ? { text: 'Delete Post', style: 'destructive', onPress: () => onDelete(post.id) } : null,
        { text: 'Cancel', style: 'cancel' },
      ].filter(Boolean) as any[]
    );
  };

  const handleSaveEdit = async () => {
    if (!editText.trim()) return;
    setEditSaving(true);
    try {
      await apiRequest('PATCH', `/api/posts/${post.id}`, { userId: currentUserId, text: editText.trim() });
      setShowEditModal(false);
      onPostUpdated?.({ id: post.id, text: editText.trim() });
    } catch (err) {
      Alert.alert('Error', 'Failed to update post');
    } finally {
      setEditSaving(false);
    }
  };

  const likeScale = useSharedValue(1);
  const likeAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: likeScale.value }],
  }));

  const handleLike = () => {
    likeScale.value = withSequence(withSpring(1.4, { damping: 4 }), withSpring(1, { damping: 6 }));
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onLike(post.id);
  };

  const handleComment = () => {
    if (!commentText.trim()) return;
    onComment(post.id, commentText.trim());
    setCommentText('');
  };

  const imageWidth = SCREEN_WIDTH - 64;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Pressable onPress={() => router.push({ pathname: '/user-profile', params: { id: post.userId } })}>
          {post.userAvatar ? (
            <Image source={{ uri: post.userAvatar }} style={styles.avatarImg} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, { backgroundColor: catColor + '30' }]}>
              <Text style={[styles.avatarText, { color: catColor }]}>{getInitials(post.userName)}</Text>
            </View>
          )}
        </Pressable>
        <View style={styles.headerInfo}>
          <Pressable onPress={() => router.push({ pathname: '/user-profile', params: { id: post.userId } })}>
            <Text style={styles.userName}>{post.userName}</Text>
          </Pressable>
          <View style={styles.metaRow}>
            <View style={[styles.roleBadge, { backgroundColor: catColor + '20' }]}>
              <Text style={[styles.roleText, { color: catColor }]}>{ROLE_LABELS[post.userRole]}</Text>
            </View>
            <Text style={styles.timeText}>{timeAgo(post.createdAt)}</Text>
          </View>
        </View>
        {isOwn && (
          <Pressable onPress={handleShowOptions} hitSlop={12}>
            <Feather name="more-vertical" size={18} color={C.textTertiary} />
          </Pressable>
        )}
      </View>

      <View style={[styles.categoryTag, { backgroundColor: catColor + '15' }]}>
        <View style={[styles.categoryDot, { backgroundColor: catColor }]} />
        <Text style={[styles.categoryText, { color: catColor }]}>{CATEGORY_LABELS[post.category]}</Text>
      </View>

      {post.text.length > 0 && (
        post.category === 'sell' && post.text.startsWith('SELL_TITLE:') ? (
          <View style={styles.sellTextBlock}>
            {(() => {
              const lines = post.text.split('\n');
              let title = '', price = '', condition = '', desc = '';
              for (const l of lines) {
                if (l.startsWith('SELL_TITLE:')) title = l.replace('SELL_TITLE:', '').trim();
                else if (l.startsWith('SELL_PRICE:')) price = l.replace('SELL_PRICE:', '').trim();
                else if (l.startsWith('SELL_CONDITION:')) condition = l.replace('SELL_CONDITION:', '').trim();
                else if (l.startsWith('SELL_DESC:')) desc = l.replace('SELL_DESC:', '').trim();
              }
              return (
                <>
                  {price ? <Text style={styles.sellPrice}>{price.startsWith('₹') ? price : `₹${price}`}</Text> : null}
                  <Text style={styles.sellTitle}>{title}</Text>
                  {condition ? (
                    <View style={styles.sellConditionPill}>
                      <Text style={styles.sellConditionText}>{condition}</Text>
                    </View>
                  ) : null}
                  {desc ? <Text style={styles.postText}>{desc}</Text> : null}
                </>
              );
            })()}
          </View>
        ) : (
          <Text style={styles.postText}>{post.text}</Text>
        )
      )}

      {post.images.length > 0 && (
        <View style={styles.imagesContainer}>
          {post.images.length === 1 ? (
            <Pressable onPress={() => setViewerMedia({type: 'image', url: post.images[0]})}>
              <Image
                source={{ uri: post.images[0] }}
                style={[styles.singleImage, { width: imageWidth }]}
                contentFit="cover"
                transition={200}
              />
            </Pressable>
          ) : (
            <View style={styles.imageGrid}>
              {post.images.slice(0, 4).map((uri, idx) => (
                <Pressable key={idx} onPress={() => setViewerMedia({type: 'image', url: uri})}>
                  <View style={styles.gridImageWrapper}>
                    <Image
                      source={{ uri }}
                      style={styles.gridImage}
                      contentFit="cover"
                      transition={200}
                    />
                    {idx === 3 && post.images.length > 4 && (
                      <View style={styles.moreOverlay}>
                        <Text style={styles.moreText}>+{post.images.length - 4}</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}

      {!!post.videoUrl && post.videoUrl.length > 0 && (
        <Pressable
          style={styles.videoContainer}
          onPress={() => setViewerMedia({type: 'video', url: post.videoUrl!})}
        >
          <View style={styles.videoPlaceholder}>
            <Ionicons name="play-circle" size={56} color="rgba(255,255,255,0.9)" />
          </View>
        </Pressable>
      )}

      <View style={styles.actions}>
        <Pressable style={styles.actionBtn} onPress={handleLike}>
          <Animated.View style={likeAnimStyle}>
            <Ionicons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={22}
              color={isLiked ? '#FF3B30' : C.textSecondary}
            />
          </Animated.View>
          {post.likes.length > 0 && (
            <Text style={[styles.actionCount, isLiked && { color: '#FF3B30' }]}>
              {post.likes.length}
            </Text>
          )}
        </Pressable>

        <Pressable style={styles.actionBtn} onPress={() => setShowComments(!showComments)}>
          <Ionicons name="chatbubble-outline" size={20} color={C.textSecondary} />
          {post.comments.length > 0 && (
            <Text style={styles.actionCount}>{post.comments.length}</Text>
          )}
        </Pressable>

        <Pressable style={styles.actionBtn}>
          <Ionicons name="share-outline" size={20} color={C.textSecondary} />
        </Pressable>
      </View>

      {showComments && (
        <View style={styles.commentsSection}>
          {post.comments.map(c => (
            <View key={c.id} style={styles.commentItem}>
              <Text style={styles.commentUser}>{c.userName}</Text>
              <Text style={styles.commentText}>{c.text}</Text>
            </View>
          ))}
          <View style={styles.commentInput}>
            <TextInput
              style={styles.commentTextInput}
              placeholder="Add a comment..."
              placeholderTextColor={C.textTertiary}
              value={commentText}
              onChangeText={setCommentText}
              onSubmitEditing={handleComment}
              returnKeyType="send"
            />
            <Pressable onPress={handleComment} disabled={!commentText.trim()}>
              <Ionicons
                name="send"
                size={20}
                color={commentText.trim() ? C.primary : C.textTertiary}
              />
            </Pressable>
          </View>
        </View>
      )}
      <MediaViewer
        visible={!!viewerMedia}
        onClose={() => setViewerMedia(null)}
        imageUrl={viewerMedia?.type === 'image' ? viewerMedia.url : undefined}
        videoUrl={viewerMedia?.type === 'video' ? viewerMedia.url : undefined}
      />

      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editModal}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Edit Post</Text>
              <Pressable onPress={() => setShowEditModal(false)} hitSlop={12}>
                <Ionicons name="close" size={22} color={C.textSecondary} />
              </Pressable>
            </View>
            <TextInput
              style={styles.editTextInput}
              value={editText}
              onChangeText={setEditText}
              multiline
              numberOfLines={6}
              placeholder="Edit your post..."
              placeholderTextColor={C.textTertiary}
              autoFocus
            />
            <Pressable
              style={[styles.editSaveBtn, (!editText.trim() || editSaving) && { opacity: 0.5 }]}
              onPress={handleSaveEdit}
              disabled={!editText.trim() || editSaving}
            >
              <Text style={styles.editSaveBtnText}>{editSaving ? 'Saving...' : 'Save Changes'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#E5E5E5',
  },
  avatarText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    color: C.text,
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 8,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  timeText: {
    color: C.textTertiary,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 10,
    gap: 6,
  },
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  categoryText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  postText: {
    color: C.text,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'Inter_400Regular',
    marginBottom: 14,
  },
  imagesContainer: {
    marginBottom: 14,
    borderRadius: 12,
    overflow: 'hidden',
  },
  singleImage: {
    height: 220,
    borderRadius: 12,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  gridImageWrapper: {
    width: '49%' as any,
    height: 140,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  moreOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: {
    color: '#FFF',
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
  },
  videoContainer: {
    marginBottom: 14,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  videoPlayer: {
    width: '100%',
    height: 220,
  },
  videoPlaceholder: {
    width: '100%',
    height: 220,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: C.borderLight,
    paddingTop: 12,
    gap: 24,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionCount: {
    color: C.textSecondary,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  commentsSection: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.borderLight,
    paddingTop: 12,
  },
  commentItem: {
    marginBottom: 10,
  },
  commentUser: {
    color: C.text,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 2,
  },
  commentText: {
    color: C.textSecondary,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
  commentInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surfaceElevated,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
  },
  commentTextInput: {
    flex: 1,
    color: C.text,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    marginRight: 8,
    padding: 0,
  },
  sellTextBlock: {
    marginBottom: 12,
  },
  sellPrice: {
    color: C.text,
    fontSize: 22,
    fontFamily: 'Inter_800ExtraBold',
    marginBottom: 2,
  },
  sellTitle: {
    color: C.text,
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 4,
  },
  sellConditionPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#34C75915',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
    marginBottom: 4,
  },
  sellConditionText: {
    color: '#34C759',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  editModal: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  editModalTitle: {
    color: C.text,
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  editTextInput: {
    backgroundColor: C.surfaceElevated,
    borderRadius: 12,
    padding: 14,
    color: C.text,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
    minHeight: 120,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 16,
  },
  editSaveBtn: {
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  editSaveBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
});
