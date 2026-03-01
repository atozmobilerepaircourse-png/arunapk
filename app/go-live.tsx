import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView,
  Alert, ActivityIndicator, Platform, Linking,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/lib/context';
import { apiRequest, getApiUrl } from '@/lib/query-client';
import * as ImagePicker from 'expo-image-picker';

const RED = '#FF3B30';
const GRAY = '#999';

interface LiveSession {
  id: string;
  title: string;
  platform: string;
  link: string;
  startedAt: number;
}

const PLATFORMS = [
  { key: 'youtube', label: 'YouTube', icon: 'logo-youtube', color: '#FF0000' },
  { key: 'zoom', label: 'Zoom', icon: 'videocam', color: '#2D8CFF' },
  { key: 'meet', label: 'Google Meet', icon: 'videocam', color: '#00897B' },
  { key: 'other', label: 'Other', icon: 'radio', color: '#FF3B30' },
];

export default function GoLiveScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useApp();
  const isTeacher = profile?.role === 'teacher' || profile?.role === 'admin';

  const [platform, setPlatform] = useState<'youtube' | 'zoom' | 'meet' | 'other'>('youtube');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeSession, setActiveSession] = useState<LiveSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const handleShareImage = async () => {
    if (!activeSession) return;
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });

    if (result.canceled || !result.assets?.[0]?.uri) return;

    setIsUploading(true);
    try {
      const uri = result.assets[0].uri;
      const formData = new FormData();
      if (Platform.OS === 'web') {
        const response = await globalThis.fetch(uri);
        const blob = await response.blob();
        formData.append('image', blob, 'live-session.jpg');
      } else {
        const name = uri.split('/').pop() || 'live-session.jpg';
        const type = result.assets[0].mimeType || 'image/jpeg';
        formData.append('image', { uri, name, type } as any);
      }
      formData.append('sessionId', activeSession.id);
      formData.append('sessionLink', activeSession.link);
      formData.append('teacherName', profile?.name || 'Teacher');

      const baseUrl = getApiUrl();
      const uploadUrl = new URL('/api/teacher/live-session/upload-image', baseUrl).toString();
      
      // Use globalThis.fetch (native fetch) not expo/fetch — expo/fetch doesn't support FormData file uploads
      const res = await globalThis.fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert('Success', 'Photo shared with all technicians and suppliers!');
      } else {
        Alert.alert('Error', data.message || 'Upload failed');
      }
    } catch (e) {
      console.error('[GoLive] Upload error:', e);
      Alert.alert('Error', 'Failed to upload photo');
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    if (isTeacher && profile?.id) {
      fetchMySession();
    } else {
      setLoadingSession(false);
    }
  }, [profile?.id]);

  const fetchMySession = async () => {
    try {
      const res = await apiRequest('GET', '/api/teacher/live-sessions');
      const data = await res.json();
      if (data.sessions) {
        const mine = data.sessions.find((s: any) => s.teacherId === profile?.id);
        setActiveSession(mine || null);
      }
    } catch (e) {
      console.warn('[GoLive] fetch error:', e);
    } finally {
      setLoadingSession(false);
    }
  };

  const handleGoLive = async () => {
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a session title.');
      return;
    }
    if (!link.trim()) {
      Alert.alert('Missing Link', 'Please enter your stream link.');
      return;
    }
    const urlPattern = /^https?:\/\/.+/i;
    if (!urlPattern.test(link.trim())) {
      Alert.alert('Invalid Link', 'Please enter a valid URL starting with https://');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiRequest('POST', '/api/teacher/go-live', {
        teacherId: profile?.id,
        teacherName: profile?.name,
        teacherAvatar: profile?.avatar,
        title: title.trim(),
        description: description.trim(),
        platform,
        link: link.trim(),
      });
      const data = await res.json();
      if (data.success) {
        setActiveSession(data.session);
        setTitle('');
        setDescription('');
        setLink('');
        Alert.alert('You are LIVE!', 'All users have been notified. Tap "Open Link" to join your stream.');
      } else {
        Alert.alert('Error', data.message || 'Failed to go live');
      }
    } catch (e) {
      Alert.alert('Error', 'Connection failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEndLive = async () => {
    Alert.alert('End Session?', 'This will remove your session from the Live tab.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Session', style: 'destructive', onPress: async () => {
          try {
            await apiRequest('POST', '/api/teacher/end-live', {
              teacherId: profile?.id,
              sessionId: activeSession?.id,
            });
            setActiveSession(null);
          } catch (e) {
            Alert.alert('Error', 'Failed to end session');
          }
        }
      }
    ]);
  };

  if (!isTeacher) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </Pressable>
          <Text style={styles.headerTitle}>Live Session</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerContent}>
          <Ionicons name="lock-closed-outline" size={48} color="#CCC" />
          <Text style={styles.restrictedText}>Only teachers can go live</Text>
        </View>
      </View>
    );
  }

  if (loadingSession) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </Pressable>
          <Text style={styles.headerTitle}>Go Live</Text>
          <View style={{ width: 40 }} />
        </View>
        <ActivityIndicator size="large" color={RED} style={{ marginTop: 60 }} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </Pressable>
        <Text style={styles.headerTitle}>Go Live</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}>
        {activeSession ? (
          <View style={styles.activeCard}>
            <View style={styles.activeHeader}>
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
              <Text style={styles.activeTitle} numberOfLines={2}>{activeSession.title}</Text>
            </View>
            <Text style={styles.activeDesc}>
              You are currently live. All users can see your session in the Live tab.
            </Text>
            <View style={styles.activeActions}>
              <Pressable
                style={styles.sharePhotoBtn}
                onPress={handleShareImage}
                disabled={isUploading}
              >
                {isUploading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="camera" size={18} color="#FFF" />
                    <Text style={styles.sharePhotoBtnText}>Share Photo with All</Text>
                  </>
                )}
              </Pressable>
              <Pressable
                style={styles.openLinkBtn}
                onPress={() => router.push({ pathname: '/live-session', params: { url: activeSession.link, title: activeSession.title } } as any)}
              >
                <Ionicons name="play" size={16} color="#FFF" />
                <Text style={styles.openLinkBtnText}>Open My Stream</Text>
              </Pressable>
              <Pressable style={styles.endLiveBtn} onPress={handleEndLive}>
                <Ionicons name="stop-circle" size={16} color={RED} />
                <Text style={styles.endLiveBtnText}>End Session</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.introCard}>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveBadgeText}>START STREAMING</Text>
              </View>
              <Text style={styles.introTitle}>Share your live class</Text>
              <Text style={styles.introDesc}>
                Post your YouTube, Zoom, or Google Meet link. Students will receive a push notification instantly.
              </Text>
            </View>

            <Text style={styles.sectionLabel}>Platform</Text>
            <View style={styles.platformRow}>
              {PLATFORMS.map(p => (
                <Pressable
                  key={p.key}
                  style={[styles.platformBtn, platform === p.key && { borderColor: p.color, backgroundColor: p.color + '12' }]}
                  onPress={() => setPlatform(p.key as any)}
                >
                  <Ionicons name={p.icon as any} size={20} color={platform === p.key ? p.color : '#999'} />
                  <Text style={[styles.platformLabel, platform === p.key && { color: p.color }]}>{p.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionLabel}>Session Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Live AC Repair Workshop"
              placeholderTextColor="#BBB"
              maxLength={80}
            />

            <Text style={styles.sectionLabel}>Description (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="What will you cover today?"
              placeholderTextColor="#BBB"
              multiline
              numberOfLines={3}
              maxLength={200}
            />

            <Text style={styles.sectionLabel}>Stream Link</Text>
            <TextInput
              style={styles.input}
              value={link}
              onChangeText={setLink}
              placeholder={
                platform === 'youtube' ? 'https://youtube.com/live/...' :
                platform === 'zoom' ? 'https://zoom.us/j/...' :
                platform === 'meet' ? 'https://meet.google.com/...' :
                'https://...'
              }
              placeholderTextColor="#BBB"
              autoCapitalize="none"
              keyboardType="url"
            />

            <Pressable
              style={[styles.goLiveBtn, submitting && { opacity: 0.6 }]}
              onPress={handleGoLive}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <View style={styles.goLiveDot} />
                  <Text style={styles.goLiveBtnText}>Go Live Now</Text>
                  <Text style={styles.goLiveSubtext}>Notifies all students</Text>
                </>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F2F2F2', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' as const, color: '#000' },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  restrictedText: { fontSize: 15, color: GRAY, fontWeight: '500' as const },
  introCard: { backgroundColor: '#FFF5F5', borderRadius: 20, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: '#FFD5D5' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: RED },
  liveBadgeText: { fontSize: 11, fontWeight: '800' as const, color: RED, letterSpacing: 1 },
  introTitle: { fontSize: 22, fontWeight: '800' as const, color: '#000', marginBottom: 8 },
  introDesc: { fontSize: 14, color: '#666', lineHeight: 20 },
  sectionLabel: { fontSize: 14, fontWeight: '700' as const, color: '#333', marginBottom: 10, marginTop: 4 },
  platformRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  platformBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: '#E0E0E0', backgroundColor: '#F8F8F8' },
  platformLabel: { fontSize: 13, fontWeight: '600' as const, color: '#999' },
  input: { backgroundColor: '#F8F8F8', borderRadius: 14, borderWidth: 1.5, borderColor: '#E8E8E8', paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#000', marginBottom: 18 },
  textArea: { height: 88, textAlignVertical: 'top' },
  goLiveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: RED, borderRadius: 18, paddingVertical: 18, marginTop: 8 },
  goLiveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFF' },
  goLiveBtnText: { fontSize: 17, fontWeight: '800' as const, color: '#FFF' },
  goLiveSubtext: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '500' as const },
  activeCard: { backgroundColor: '#FFF5F5', borderRadius: 20, padding: 20, borderWidth: 1.5, borderColor: '#FFCECE' },
  activeHeader: { marginBottom: 12 },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  liveText: { fontSize: 11, fontWeight: '800' as const, color: RED, letterSpacing: 1.5 },
  activeTitle: { fontSize: 22, fontWeight: '800' as const, color: '#000', lineHeight: 28 },
  activeDesc: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 20 },
  activeActions: { gap: 10 },
  sharePhotoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#34C759', borderRadius: 14, paddingVertical: 14 },
  sharePhotoBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' as const },
  openLinkBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: RED, borderRadius: 14, paddingVertical: 14 },
  openLinkBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' as const },
  endLiveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FFF', borderRadius: 14, paddingVertical: 14, borderWidth: 1.5, borderColor: '#FFCECE' },
  endLiveBtnText: { color: RED, fontSize: 15, fontWeight: '700' as const },
});
