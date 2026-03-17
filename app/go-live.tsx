import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView,
  Alert, ActivityIndicator, Platform, Linking, Share,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/lib/context';
import { apiRequest, getApiUrl } from '@/lib/query-client';
import * as ImagePicker from 'expo-image-picker';

const RED  = '#EF4444';
const GRAY = '#9CA3AF';
const DARK = '#111827';
const BUNNY_COLOR = '#FF6B35';

interface LiveSession {
  id: string;
  title: string;
  platform: string;
  link: string;
  thumbnailUrl?: string;
  startedAt: number;
  streamKey?: string;
}

type StreamMode = 'bunny' | 'link';
type LinkPlatform = 'youtube' | 'zoom' | 'meet' | 'other';

const LINK_PLATFORMS: { key: LinkPlatform; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { key: 'youtube', label: 'YouTube', icon: 'logo-youtube', color: '#FF0000' },
  { key: 'zoom',    label: 'Zoom',    icon: 'videocam',     color: '#2D8CFF' },
  { key: 'meet',    label: 'Meet',    icon: 'videocam',     color: '#00897B' },
  { key: 'other',   label: 'Other',   icon: 'radio',        color: '#EF4444' },
];

export default function GoLiveScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useApp();
  const isTeacher = profile?.role === 'teacher' || profile?.role === 'admin';

  const [mode, setMode] = useState<StreamMode>('bunny');
  const [linkPlatform, setLinkPlatform] = useState<LinkPlatform>('youtube');
  const [title, setTitle]               = useState('');
  const [description, setDescription]   = useState('');
  const [link, setLink]                 = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [activeSession, setActiveSession] = useState<LiveSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [isUploading, setIsUploading]   = useState(false);
  const [streamKeyInfo, setStreamKeyInfo] = useState<{ rtmpUrl: string; streamKey: string } | null>(null);
  const [thumbnailUri, setThumbnailUri]   = useState<string | null>(null);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  useEffect(() => {
    if (isTeacher && profile?.id) {
      fetchMySession();
    } else {
      setLoadingSession(false);
    }
  }, [profile?.id]);

  const fetchMySession = async () => {
    try {
      const res  = await apiRequest('GET', '/api/teacher/live-sessions');
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

  // Start a Bunny Live stream (RTMP)
  const handleStartBunnyStream = async () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Please enter a session title.');
      return;
    }
    setSubmitting(true);
    let thumbnailUrl = '';
    try {
      if (thumbnailUri) {
        setUploadingThumbnail(true);
        thumbnailUrl = await uploadThumbnail(thumbnailUri) || '';
        setUploadingThumbnail(false);
      }
      const res  = await apiRequest('POST', '/api/teacher/bunny-live/start', {
        teacherId:    profile?.id,
        teacherName:  profile?.name,
        teacherAvatar: profile?.avatar,
        title:        title.trim(),
        description:  description.trim(),
        thumbnailUrl,
      });
      const data = await res.json();
      if (data.success) {
        setActiveSession(data.session);
        setStreamKeyInfo({ rtmpUrl: data.rtmpUrl, streamKey: data.streamKey });
        setTitle('');
        setDescription('');
        setThumbnailUri(null);
      } else {
        Alert.alert('Error', data.message || 'Failed to start stream');
      }
    } catch (e) {
      Alert.alert('Error', 'Connection failed. Please try again.');
    } finally {
      setSubmitting(false);
      setUploadingThumbnail(false);
    }
  };

  // Share an external link (YouTube / Zoom / Meet)
  const handleShareLink = async () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Please enter a session title.');
      return;
    }
    if (!link.trim() || !/^https?:\/\/.+/i.test(link.trim())) {
      Alert.alert('Invalid link', 'Please enter a valid URL starting with https://');
      return;
    }
    setSubmitting(true);
    let thumbnailUrl = '';
    try {
      if (thumbnailUri) {
        setUploadingThumbnail(true);
        thumbnailUrl = await uploadThumbnail(thumbnailUri) || '';
        setUploadingThumbnail(false);
      }
      const res  = await apiRequest('POST', '/api/teacher/go-live', {
        teacherId:    profile?.id,
        teacherName:  profile?.name,
        teacherAvatar: profile?.avatar,
        title:        title.trim(),
        description:  description.trim(),
        platform:     linkPlatform,
        link:         link.trim(),
        thumbnailUrl,
      });
      const data = await res.json();
      if (data.success) {
        setActiveSession(data.session);
        setTitle('');
        setDescription('');
        setLink('');
        setThumbnailUri(null);
        Alert.alert('You are LIVE!', 'All users have been notified.');
      } else {
        Alert.alert('Error', data.message || 'Failed to go live');
      }
    } catch (e) {
      Alert.alert('Error', 'Connection failed. Please try again.');
    } finally {
      setSubmitting(false);
      setUploadingThumbnail(false);
    }
  };

  const handleEndLive = async () => {
    try {
      console.log('[EndLive] Button clicked! activeSession:', activeSession?.id, 'teacherId:', profile?.id);
      
      if (!activeSession?.id || !profile?.id) {
        Alert.alert('Error', 'Missing session or teacher info');
        return;
      }
      
      // Show confirmation
      Alert.alert('End Session?', 'This will remove your session from the Live tab.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End', style: 'destructive', onPress: async () => {
            try {
              console.log('[EndLive] User confirmed. Sending request...');
              
              // Make API call
              const res = await apiRequest('POST', '/api/teacher/end-live', {
                teacherId: profile.id,
                sessionId: activeSession.id,
              });
              
              console.log('[EndLive] Got response:', res.status, res.ok);
              
              // Always clear session on 200 response
              if (res.ok) {
                console.log('[EndLive] Success!');
                setActiveSession(null);
                setStreamKeyInfo(null);
                Alert.alert('Done', 'Your live session has been ended.');
              } else {
                Alert.alert('Error', 'Failed to end session');
              }
            } catch (error: any) {
              console.error('[EndLive] Error:', error?.message);
              Alert.alert('Error', error?.message || 'Connection failed');
            }
          },
        },
      ]);
    } catch (error: any) {
      console.error('[EndLive] Exception:', error?.message);
      Alert.alert('Error', 'Something went wrong');
    }
  };

  const pickThumbnail = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setThumbnailUri(result.assets[0].uri);
    }
  };

  const uploadThumbnail = async (uri: string): Promise<string | null> => {
    try {
      const formData = new FormData();
      if (Platform.OS === 'web') {
        const blob = await (await globalThis.fetch(uri)).blob();
        formData.append('image', blob, 'thumbnail.jpg');
      } else {
        const name = uri.split('/').pop() || 'thumbnail.jpg';
        formData.append('image', { uri, name, type: 'image/jpeg' } as any);
      }
      const res = await globalThis.fetch(new URL('/api/upload', getApiUrl()).toString(), { method: 'POST', body: formData });
      const data = await res.json();
      return data.success && data.url ? data.url : null;
    } catch {
      return null;
    }
  };

  const handleShareImage = async () => {
    if (!activeSession) {
      Alert.alert('Error', 'No active session');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setIsUploading(true);
    try {
      const uri      = result.assets[0].uri;
      const formData = new FormData();
      console.log('[ShareImage] Starting upload... sessionId:', activeSession.id);
      if (Platform.OS === 'web') {
        const blob = await (await globalThis.fetch(uri)).blob();
        formData.append('image', blob, 'live-session.jpg');
      } else {
        const name = uri.split('/').pop() || 'live-session.jpg';
        formData.append('image', { uri, name, type: result.assets[0].mimeType || 'image/jpeg' } as any);
      }
      formData.append('sessionId', activeSession.id);
      formData.append('sessionLink', activeSession.link);
      formData.append('teacherName', profile?.name || 'Teacher');
      const uploadUrl = new URL('/api/teacher/live-session/upload-image', getApiUrl()).toString();
      console.log('[ShareImage] Uploading to:', uploadUrl);
      const res  = await globalThis.fetch(uploadUrl, { method: 'POST', body: formData });
      console.log('[ShareImage] Response status:', res.status, 'ok:', res.ok);
      
      try {
        const cloned = res.clone();
        const data = await cloned.json();
        console.log('[ShareImage] Response data:', data);
        
        if (data.success) {
          Alert.alert('Shared!', 'Photo shared with all technicians.');
        } else {
          Alert.alert('Error', data.message || 'Upload failed');
        }
      } catch (parseErr: any) {
        console.log('[ShareImage] Could not parse response, but request succeeded (status:', res.status + ')');
        if (res.ok) {
          Alert.alert('Shared!', 'Photo shared with all technicians.');
        } else {
          Alert.alert('Error', 'Upload failed (no response data)');
        }
      }
    } catch (e: any) {
      console.error('[ShareImage] Exception:', e.message || e);
      Alert.alert('Error', e.message || 'Failed to upload photo. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    if (Platform.OS === 'web' && navigator?.clipboard) {
      await navigator.clipboard.writeText(text);
    }
    Alert.alert('Copied!', 'RTMP URL copied to clipboard');
  };

  // ── Not a teacher ────────────────────────────────────────────────────────
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

  // ── Loading ───────────────────────────────────────────────────────────────
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

  // ── Main Screen ──────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </Pressable>
        <Text style={styles.headerTitle}>{activeSession ? 'You are LIVE' : 'Go Live'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {activeSession ? (
          // ── Active session card ─────────────────────────────────────────
          <View>
            <View style={styles.activeBanner}>
              <View style={styles.liveRow}>
                <View style={styles.liveDotRed} />
                <Text style={styles.liveLabel}>LIVE NOW</Text>
              </View>
              <Text style={styles.activeTitle} numberOfLines={2}>{activeSession.title}</Text>
              <Text style={styles.activeSubtext}>
                Your session is visible in the Live tab. All users have been notified.
              </Text>
            </View>

            {/* RTMP info for Bunny streams */}
            {streamKeyInfo && (
              <View style={styles.rtmpCard}>
                <Text style={styles.rtmpLabel}>Stream with OBS / Streamlabs</Text>
                <View style={styles.rtmpRow}>
                  <View style={styles.rtmpInfo}>
                    <Text style={styles.rtmpKey}>RTMP URL</Text>
                    <Text style={styles.rtmpValue} numberOfLines={2}>{streamKeyInfo.rtmpUrl}</Text>
                  </View>
                  <Pressable style={styles.copyBtn} onPress={() => copyToClipboard(streamKeyInfo.rtmpUrl)}>
                    <Ionicons name="copy-outline" size={16} color={BUNNY_COLOR} />
                  </Pressable>
                </View>
                <View style={styles.divider} />
                <View style={styles.rtmpRow}>
                  <View style={styles.rtmpInfo}>
                    <Text style={styles.rtmpKey}>Stream Key</Text>
                    <Text style={styles.rtmpValue}>{streamKeyInfo.streamKey}</Text>
                  </View>
                  <Pressable style={styles.copyBtn} onPress={() => copyToClipboard(streamKeyInfo.streamKey)}>
                    <Ionicons name="copy-outline" size={16} color={BUNNY_COLOR} />
                  </Pressable>
                </View>
              </View>
            )}

            <View style={styles.actionStack}>
              <Pressable style={styles.sharePhotoBtn} onPress={handleShareImage} disabled={isUploading}>
                {isUploading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="camera" size={18} color="#FFF" />
                    <Text style={styles.sharePhotoBtnText}>Share Photo</Text>
                  </>
                )}
              </Pressable>

              <Pressable
                style={styles.watchBtn}
                onPress={() => router.push({
                  pathname: '/live-session',
                  params: { url: activeSession.link, title: activeSession.title, platform: activeSession.platform, sessionId: activeSession.id },
                } as any)}
              >
                <Ionicons name="play-circle" size={18} color="#FFF" />
                <Text style={styles.watchBtnText}>Watch My Stream</Text>
              </Pressable>

              <Pressable style={styles.endBtn} onPress={handleEndLive}>
                <Ionicons name="stop-circle" size={16} color={RED} />
                <Text style={styles.endBtnText}>End Session</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          // ── Setup form ─────────────────────────────────────────────────
          <>
            {/* Mode selector */}
            <View style={styles.modeRow}>
              <Pressable
                style={[styles.modeTab, mode === 'bunny' && styles.modeTabActive]}
                onPress={() => setMode('bunny')}
              >
                <Ionicons name="videocam" size={16} color={mode === 'bunny' ? '#FFF' : GRAY} />
                <Text style={[styles.modeTabText, mode === 'bunny' && styles.modeTabTextActive]}>
                  Bunny Live
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modeTab, mode === 'link' && styles.modeTabActive]}
                onPress={() => setMode('link')}
              >
                <Ionicons name="link" size={16} color={mode === 'link' ? '#FFF' : GRAY} />
                <Text style={[styles.modeTabText, mode === 'link' && styles.modeTabTextActive]}>
                  Share Link
                </Text>
              </Pressable>
            </View>

            {mode === 'bunny' ? (
              // ── Bunny Live Stream ────────────────────────────────────────
              <>
                <View style={[styles.introCard, { backgroundColor: BUNNY_COLOR + '10', borderColor: BUNNY_COLOR + '30' }]}>
                  <View style={styles.introBadge}>
                    <View style={[styles.liveDotRed, { backgroundColor: BUNNY_COLOR }]} />
                    <Text style={[styles.introBadgeText, { color: BUNNY_COLOR }]}>BUNNY STREAM</Text>
                  </View>
                  <Text style={styles.introHeading}>Stream directly in-app</Text>
                  <Text style={styles.introSub}>
                    A live stream channel is created for you instantly. Get your RTMP key and stream from OBS, Streamlabs, or any mobile streaming app. Viewers watch inside Mobi.
                  </Text>
                </View>

                <Text style={styles.fieldLabel}>Session Title</Text>
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="e.g. Live AC Repair Workshop"
                  placeholderTextColor="#BBB"
                  maxLength={80}
                />

                <Text style={styles.fieldLabel}>Description (optional)</Text>
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

                <Text style={styles.fieldLabel}>Thumbnail (optional)</Text>
                <Pressable style={styles.pickerBtn} onPress={pickThumbnail} disabled={uploadingThumbnail}>
                  <Ionicons name="image-outline" size={18} color={BUNNY_COLOR} />
                  <Text style={styles.pickerBtnText}>{thumbnailUri ? 'Change thumbnail' : 'Pick thumbnail'}</Text>
                </Pressable>

                <Pressable
                  style={[styles.goLiveBtn, { backgroundColor: BUNNY_COLOR }, submitting && { opacity: 0.6 }]}
                  onPress={handleStartBunnyStream}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <View style={styles.goLiveDot} />
                      <Text style={styles.goLiveBtnText}>Start Bunny Stream</Text>
                    </>
                  )}
                </Pressable>
              </>
            ) : (
              // ── External link ─────────────────────────────────────────────
              <>
                <View style={[styles.introCard, { backgroundColor: '#FFF5F5', borderColor: '#FFCECE' }]}>
                  <View style={styles.introBadge}>
                    <View style={styles.liveDotRed} />
                    <Text style={styles.introBadgeText}>SHARE LINK</Text>
                  </View>
                  <Text style={styles.introHeading}>Share your live class link</Text>
                  <Text style={styles.introSub}>
                    Post your YouTube, Zoom, or Google Meet link. Students get a push notification instantly.
                  </Text>
                </View>

                <Text style={styles.fieldLabel}>Platform</Text>
                <View style={styles.platformRow}>
                  {LINK_PLATFORMS.map(p => (
                    <Pressable
                      key={p.key}
                      style={[
                        styles.platformBtn,
                        linkPlatform === p.key && { backgroundColor: p.color, borderColor: p.color },
                      ]}
                      onPress={() => setLinkPlatform(p.key)}
                    >
                      <Ionicons name={p.icon} size={14} color={linkPlatform === p.key ? '#FFF' : p.color} />
                      <Text style={[styles.platformBtnText, linkPlatform === p.key && { color: '#FFF' }]}>
                        {p.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Session Title</Text>
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="e.g. Live AC Repair Workshop"
                  placeholderTextColor="#BBB"
                  maxLength={80}
                />

                <Text style={styles.fieldLabel}>Stream Link</Text>
                <Text style={styles.fieldLabel}>Thumbnail (optional)</Text>
                <Pressable style={styles.pickerBtn} onPress={pickThumbnail} disabled={uploadingThumbnail}>
                  <Ionicons name="image-outline" size={18} color={RED} />
                  <Text style={styles.pickerBtnText}>{thumbnailUri ? "Change thumbnail" : "Pick thumbnail"}</Text>
                </Pressable>
                <TextInput
                  style={styles.input}
                  value={link}
                  onChangeText={setLink}
                  placeholder="https://youtube.com/live/..."
                  placeholderTextColor="#BBB"
                  autoCapitalize="none"
                  keyboardType="url"
                  maxLength={300}
                />

                <Text style={styles.fieldLabel}>Description (optional)</Text>
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

                <Pressable
                  style={[styles.goLiveBtn, submitting && { opacity: 0.6 }]}
                  onPress={handleShareLink}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <View style={styles.goLiveDot} />
                      <Text style={styles.goLiveBtnText}>Go Live Now</Text>
                      <Text style={styles.goLiveSubNote}>Notifies all users</Text>
                    </>
                  )}
                </Pressable>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F2F2F2', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#000' },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  restrictedText: { fontSize: 15, color: GRAY, fontFamily: 'Inter_500Medium' },

  // Mode tabs
  modeRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  modeTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, borderColor: '#E0E0E0', backgroundColor: '#F8F8F8',
  },
  modeTabActive: { backgroundColor: RED, borderColor: RED },
  modeTabText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: GRAY },
  modeTabTextActive: { color: '#FFF' },

  // Intro card
  introCard: {
    borderRadius: 18, padding: 18, marginBottom: 22, borderWidth: 1,
  },
  introBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  liveDotRed: { width: 8, height: 8, borderRadius: 4, backgroundColor: RED },
  introBadgeText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: RED, letterSpacing: 1 },
  introHeading: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#000', marginBottom: 6 },
  introSub: { fontSize: 13, color: '#666', lineHeight: 19 },

  // Form fields
  fieldLabel: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#333', marginBottom: 8, marginTop: 2 },
  input: {
    backgroundColor: '#F8F8F8', borderRadius: 14, borderWidth: 1.5, borderColor: '#E8E8E8',
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#000', marginBottom: 16,
    fontFamily: 'Inter_400Regular',
  },
  textArea: { height: 80, textAlignVertical: 'top' },

  // Platform selector
  platformRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  platformBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E0E0E0', backgroundColor: '#F8F8F8',
  },
  platformBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#666' },

  // Go Live button
  goLiveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: RED, borderRadius: 18, paddingVertical: 17, marginTop: 6,
    shadowColor: RED, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  goLiveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFF' },
  goLiveBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#FFF' },
  goLiveSubNote: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontFamily: 'Inter_400Regular' },
  pickerBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#F3F4F6", borderRadius: 12, paddingVertical: 14, marginBottom: 16, borderWidth: 1, borderColor: "#E5E7EB" },
  pickerBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: DARK },

  // Active session
  activeBanner: {
    backgroundColor: '#FFF5F5', borderRadius: 20, padding: 20, marginBottom: 18,
    borderWidth: 1.5, borderColor: '#FFCECE',
  },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  liveLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', color: RED, letterSpacing: 1.5 },
  activeTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#000', lineHeight: 26, marginBottom: 6 },
  activeSubtext: { fontSize: 13, color: '#666', lineHeight: 18 },

  // RTMP card
  rtmpCard: {
    backgroundColor: '#FFF8F4', borderRadius: 16, padding: 16, marginBottom: 18,
    borderWidth: 1, borderColor: BUNNY_COLOR + '30',
  },
  rtmpLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: BUNNY_COLOR, marginBottom: 12 },
  rtmpRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rtmpInfo: { flex: 1 },
  rtmpKey: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: GRAY, letterSpacing: 0.5, marginBottom: 3 },
  rtmpValue: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#333', lineHeight: 16 },
  copyBtn: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: BUNNY_COLOR + '15',
    alignItems: 'center', justifyContent: 'center',
  },
  divider: { height: 1, backgroundColor: '#F0E0D8', marginVertical: 12 },

  // Action stack
  actionStack: { gap: 10 },
  sharePhotoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#10B981', borderRadius: 14, paddingVertical: 14,
  },
  sharePhotoBtnText: { color: '#FFF', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  watchBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: RED, borderRadius: 14, paddingVertical: 14,
  },
  watchBtnText: { color: '#FFF', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  endBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FFF', borderRadius: 14, paddingVertical: 14,
    borderWidth: 1.5, borderColor: '#FFCECE',
  },
  endBtnText: { color: RED, fontSize: 15, fontFamily: 'Inter_600SemiBold' },
});

// Adding styles (appending to end)
