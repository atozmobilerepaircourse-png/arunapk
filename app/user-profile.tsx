import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform,
  ActivityIndicator, Linking, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import Colors from '@/constants/colors';
import { useApp } from '@/lib/context';
import { apiRequest, getApiUrl } from '@/lib/query-client';
import { openLink } from '@/lib/open-link';
import { Post, UserProfile, ROLE_LABELS, UserRole, CATEGORY_LABELS } from '@/lib/types';
import PostCard from '@/components/PostCard';

const C = Colors.light;

const ROLE_COLORS: Record<UserRole, string> = {
  technician: '#34C759',
  teacher: '#FFD60A',
  supplier: '#FF6B2C',
  job_provider: '#5E8BFF',
  customer: '#FF2D55',
};

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function UserProfileScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile: myProfile, startConversation, posts } = useApp();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPosts, setShowPosts] = useState(false);

  const fetchUser = useCallback(async () => {
    try {
      const res = await apiRequest('GET', `/api/profiles/${id}`);
      const data = await res.json();
      if (data && data.id) setUser(data);
    } catch (e) {
      console.error('[UserProfile] fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const handleChat = async () => {
    if (!myProfile || !user) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const convoId = await startConversation(user.id, user.name, user.role);
    if (convoId) router.push({ pathname: '/chat/[id]', params: { id: convoId } });
  };

  const handleLike = async (postId: string) => {
    if (!myProfile) return;
    try {
      await apiRequest('POST', `/api/posts/${postId}/like`, { userId: myProfile.id });
    } catch (e) {
      console.error('[UserProfile] like error:', e);
    }
  };

  const handleComment = async (postId: string, text: string) => {
    if (!myProfile) return;
    try {
      await apiRequest('POST', `/api/posts/${postId}/comment`, {
        userId: myProfile.id,
        userName: myProfile.name,
        text,
      });
    } catch (e) {
      console.error('[UserProfile] comment error:', e);
    }
  };

  const userPosts = posts.filter(p => p.userId === id);
  const totalLikes = userPosts.reduce((sum, p) => sum + p.likes.length, 0);
  const isMe = myProfile?.id === id;

  if (loading) {
    return (
      <View style={[s.container, s.center]}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[s.container, s.center]}>
        <Ionicons name="person-outline" size={48} color={C.textTertiary} />
        <Text style={s.emptyTitle}>Profile not found</Text>
        <Pressable onPress={() => router.back()} style={s.backBtnAlt}>
          <Text style={s.backBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const roleColor = ROLE_COLORS[user.role] || C.primary;

  return (
    <View style={s.container}>
      <View style={[s.topBar, { paddingTop: (Platform.OS === 'web' ? 67 : insets.top) + 8 }]}>
        <Pressable hitSlop={14} onPress={() => router.back()} style={s.topBtn}>
          <Ionicons name="arrow-back" size={24} color={C.text} />
        </Pressable>
        <Text style={s.topTitle} numberOfLines={1}>{user.name}</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView
        contentContainerStyle={[s.content, { paddingTop: (Platform.OS === 'web' ? 67 : insets.top) + 56 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.profileHeader}>
          {user.avatar ? (
            <Image source={{ uri: user.avatar }} style={s.avatarImg} contentFit="cover" />
          ) : (
            <View style={[s.avatar, { backgroundColor: roleColor + '20' }]}>
              <Text style={[s.avatarText, { color: roleColor }]}>
                {getInitials(user.name)}
              </Text>
            </View>
          )}
          <Text style={s.profileName}>{user.name}</Text>
          <View style={[s.roleBadge, { backgroundColor: roleColor + '20' }]}>
            <Text style={[s.roleBadgeText, { color: roleColor }]}>
              {ROLE_LABELS[user.role]}
            </Text>
          </View>
        </View>

        <View style={s.statsRow}>
          <Pressable style={s.statItem} onPress={() => setShowPosts(!showPosts)}>
            <Text style={s.statValue}>{userPosts.length}</Text>
            <Text style={s.statLabel}>Posts</Text>
          </Pressable>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statValue}>{totalLikes}</Text>
            <Text style={s.statLabel}>Likes</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statValue}>{user.skills.length}</Text>
            <Text style={s.statLabel}>Skills</Text>
          </View>
        </View>

        {showPosts && userPosts.length > 0 && (
          <View style={s.postsSection}>
            <Text style={s.postsSectionTitle}>Posts by {user.name}</Text>
            {userPosts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={myProfile?.id}
                onLike={handleLike}
                onComment={handleComment}
              />
            ))}
          </View>
        )}

        {!isMe && (user.role === 'teacher' || user.role === 'supplier') && (
          <Pressable style={s.chatBtn} onPress={handleChat}>
            <Ionicons name="chatbubble-outline" size={18} color="#fff" />
            <Text style={s.chatBtnText}>Message</Text>
          </Pressable>
        )}

        {user.bio ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>About</Text>
            <Text style={s.bioText}>{user.bio}</Text>
          </View>
        ) : null}

        <View style={s.section}>
          <Text style={s.sectionTitle}>Details</Text>
          <View style={s.detailRow}>
            <Ionicons name="location-outline" size={18} color={C.textSecondary} />
            <Text style={s.detailText}>{user.city}{user.state ? `, ${user.state}` : ''}</Text>
          </View>
          {user.experience ? (
            <View style={s.detailRow}>
              <Ionicons name="time-outline" size={18} color={C.textSecondary} />
              <Text style={s.detailText}>{user.experience}</Text>
            </View>
          ) : null}
          {user.shopName ? (
            <View style={s.detailRow}>
              <Ionicons name="storefront-outline" size={18} color={C.textSecondary} />
              <Text style={s.detailText}>{user.shopName}</Text>
            </View>
          ) : null}
          {(user.id === myProfile?.id) && (
            <View style={s.detailRow}>
              <Ionicons name="call-outline" size={18} color={C.textSecondary} />
              <Text style={s.detailText}>{user.phone}</Text>
            </View>
          )}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Support</Text>
          <Pressable 
            style={s.supportRow} 
            onPress={async () => {
              try {
                const res = await apiRequest('GET', '/api/settings/whatsapp_support_link');
                const { value } = await res.json();
                const url = value || 'https://wa.link/ar3932';
                openLink(url, 'Support');
              } catch (e) {
                console.error('[Support] Link error:', e);
                openLink('https://wa.link/ar3932', 'Support');
              }
            }}
          >
            <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
            <Text style={s.detailText}>Contact Support</Text>
          </Pressable>
        </View>

        {user.skills.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Skills</Text>
            <View style={s.skillsWrap}>
              {user.skills.map((skill, i) => (
                <View key={i} style={[s.skillChip, { backgroundColor: roleColor + '15' }]}>
                  <Text style={[s.skillText, { color: roleColor }]}>{skill}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingBottom: 10,
    backgroundColor: C.background, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
  },
  topBtn: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  topTitle: { color: C.text, fontSize: 17, fontFamily: 'Inter_700Bold', flex: 1, textAlign: 'center' },
  content: { paddingHorizontal: 16, paddingBottom: 40 },

  profileHeader: { alignItems: 'center', marginBottom: 20 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  avatarImg: {
    width: 80, height: 80, borderRadius: 40, marginBottom: 12,
    borderWidth: 2, borderColor: C.border,
  },
  avatarText: { fontSize: 28, fontFamily: 'Inter_700Bold' },
  profileName: { color: C.text, fontSize: 22, fontFamily: 'Inter_700Bold', marginBottom: 6 },
  roleBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  roleBadgeText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },

  statsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.surface, borderRadius: 14, paddingVertical: 16,
    marginBottom: 16,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { color: C.text, fontSize: 20, fontFamily: 'Inter_700Bold' },
  statLabel: { color: C.textSecondary, fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: C.border },

  postsSection: { marginBottom: 16 },
  postsSectionTitle: { color: C.textSecondary, fontSize: 13, fontFamily: 'Inter_600SemiBold', marginBottom: 12, textTransform: 'uppercase' as const, letterSpacing: 0.5 },

  chatBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0095F6', borderRadius: 10,
    paddingVertical: 12, marginBottom: 20, gap: 8,
  },
  chatBtnText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 15 },

  section: { marginBottom: 20 },
  sectionTitle: { color: C.textSecondary, fontSize: 13, fontFamily: 'Inter_600SemiBold', marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  bioText: { color: C.text, fontSize: 15, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  detailText: { color: C.text, fontSize: 15, fontFamily: 'Inter_400Regular' },
  supportRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10, 
    padding: 12, 
    backgroundColor: C.surface, 
    borderRadius: 10,
    marginTop: 8
  },
  editLinkBtn: { marginLeft: 'auto', padding: 4 },
  skillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skillChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  skillText: { fontSize: 13, fontFamily: 'Inter_500Medium' },

  emptyTitle: { color: C.text, fontSize: 17, fontFamily: 'Inter_600SemiBold', marginTop: 12 },
  backBtnAlt: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: C.surface, borderRadius: 10 },
  backBtnText: { color: C.text, fontFamily: 'Inter_600SemiBold', fontSize: 14 },
});
