import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, Platform,
  Alert, ActivityIndicator, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { router } from 'expo-router';
import Colors from '@/constants/colors';
import { useApp } from '@/lib/context';
import { apiRequest } from '@/lib/query-client';

const MAX_VIDEO_SIZE_MB = 500;
const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;

const C = Colors.light;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function UploadReelScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useApp();
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadPercent, setUploadPercent] = useState(0);

  const player = useVideoPlayer(videoUri || '', (p) => {
    p.loop = true;
  });

  const pickVideo = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      const asset = result.assets[0];

      if (Platform.OS !== 'web' && asset.fileSize && asset.fileSize > MAX_VIDEO_SIZE_BYTES) {
        const sizeMB = (asset.fileSize / (1024 * 1024)).toFixed(1);
        Alert.alert(
          'Video Too Large',
          `This video is ${sizeMB}MB. Please select a shorter video (max ${MAX_VIDEO_SIZE_MB}MB).`
        );
        return;
      }

      setVideoUri(asset.uri);
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const uploadVideo = async (uri: string): Promise<string | null> => {
    try {
      const { uploadVideoToBunnyStream } = await import('@/lib/bunny-stream');
      const result = await uploadVideoToBunnyStream(
        uri,
        title.trim() || 'Reel',
        (p) => {
          setUploadPercent(p.percent);
          setUploadProgress(p.message);
        }
      );
      return result.directUrl;
    } catch (e: any) {
      console.error('[Upload] Video failed:', e);
      Alert.alert('Upload Failed', e?.message || 'Could not upload video. Please check your connection and try again.');
      return null;
    }
  };

  const handleSubmit = useCallback(async () => {
    if (!videoUri) {
      Alert.alert('No video', 'Please select a video first.');
      return;
    }
    if (!profile) return;

    setIsUploading(true);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      setUploadPercent(0);
      setUploadProgress('Uploading video... 0%');
      const serverUrl = await uploadVideo(videoUri);
      setUploadProgress('');
      setUploadPercent(0);
      if (!serverUrl) {
        Alert.alert('Upload Failed', 'Could not upload video. Please try again.');
        setIsUploading(false);
        return;
      }

      const res = await apiRequest('POST', '/api/reels', {
        userId: profile.id,
        userName: profile.name,
        userAvatar: profile.avatar || '',
        title: title.trim(),
        description: description.trim(),
        videoUrl: serverUrl,
      });

      const data = await res.json();
      if (data.success) {
        router.back();
      } else {
        Alert.alert('Error', 'Failed to create reel.');
      }
    } catch (e) {
      console.error('[Reel] Create error:', e);
      Alert.alert('Error', 'Something went wrong.');
    } finally {
      setIsUploading(false);
    }
  }, [videoUri, title, description, profile]);

  if (profile?.role !== 'teacher' && profile?.role !== 'supplier' && profile?.role !== 'technician') {
    return (
      <View style={[styles.container, styles.center]}>
        <View style={[styles.header, { paddingTop: (Platform.OS === 'web' ? 67 : insets.top) + 10 }]}>
          <Pressable hitSlop={12} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={26} color={C.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Upload Reel</Text>
          <View style={{ width: 40 }} />
        </View>
        <Ionicons name="lock-closed-outline" size={56} color={C.textTertiary} />
        <Text style={styles.restrictedTitle}>Restricted Access</Text>
        <Text style={styles.restrictedText}>Only technicians, teachers and suppliers can upload reels</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: (Platform.OS === 'web' ? 67 : insets.top) + 10 }]}>
        <Pressable hitSlop={12} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={C.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Upload Reel</Text>
        <Pressable
          style={[styles.postBtn, (!videoUri || isUploading) && styles.postBtnDisabled]}
          disabled={!videoUri || isUploading}
          onPress={handleSubmit}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.postBtnText}>Post</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.content}>
        {videoUri ? (
          <View style={styles.previewContainer}>
            <VideoView
              player={player}
              style={styles.videoPreview}
              contentFit="cover"
              nativeControls
            />
            <Pressable style={styles.changeVideoBtn} onPress={pickVideo}>
              <Ionicons name="refresh" size={18} color="#fff" />
              <Text style={styles.changeVideoText}>Change</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.pickVideoArea} onPress={pickVideo}>
            <View style={styles.pickVideoIcon}>
              <Ionicons name="videocam" size={40} color={C.primary} />
            </View>
            <Text style={styles.pickVideoTitle}>Select Video</Text>
            <Text style={styles.pickVideoSubtitle}>From your gallery</Text>
          </Pressable>
        )}

        <TextInput
          style={styles.input}
          placeholder="Title (optional)"
          placeholderTextColor={C.textTertiary}
          value={title}
          onChangeText={setTitle}
          maxLength={100}
        />

        <TextInput
          style={[styles.input, styles.inputMultiline]}
          placeholder="Description (optional)"
          placeholderTextColor={C.textTertiary}
          value={description}
          onChangeText={setDescription}
          maxLength={500}
          multiline
          numberOfLines={3}
        />

        {isUploading && (
          <View style={styles.uploadingOverlay}>
            {uploadProgress ? (
              <View style={styles.progressContainer}>
                <View style={styles.progressTopRow}>
                  <ActivityIndicator size="small" color={C.primary} />
                  <Text style={styles.progressText}>{uploadProgress}</Text>
                </View>
                {uploadPercent > 0 && (
                  <>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${uploadPercent}%` as any }]} />
                    </View>
                    <Text style={styles.progressPercentBig}>{uploadPercent}%</Text>
                  </>
                )}
              </View>
            ) : (
              <>
                <ActivityIndicator size="large" color={C.primary} />
                <Text style={styles.uploadingText}>Uploading video...</Text>
              </>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.background,
    zIndex: 10,
  },
  headerTitle: {
    color: C.text,
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  postBtn: {
    backgroundColor: C.primary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
  },
  postBtnDisabled: {
    opacity: 0.5,
  },
  postBtnText: {
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  pickVideoArea: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: C.border,
    borderStyle: 'dashed',
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  pickVideoIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  pickVideoTitle: {
    color: C.text,
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 4,
  },
  pickVideoSubtitle: {
    color: C.textSecondary,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  previewContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    height: 300,
    backgroundColor: '#000',
  },
  videoPreview: {
    width: '100%',
    height: '100%',
  },
  changeVideoBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  changeVideoText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  input: {
    backgroundColor: C.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: C.text,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  inputMultiline: {
    height: 90,
    textAlignVertical: 'top',
  },
  uploadingOverlay: {
    alignItems: 'center',
    paddingTop: 20,
  },
  uploadingText: {
    color: C.textSecondary,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    marginTop: 12,
  },
  restrictedTitle: {
    color: C.text,
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 16,
  },
  restrictedText: {
    color: C.textSecondary,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    marginTop: 6,
  },
  progressContainer: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  progressTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  progressText: {
    color: C.text,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: C.surfaceElevated,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: C.primary,
    borderRadius: 4,
  },
  progressPercentBig: {
    color: C.primary,
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
    marginTop: 4,
  },
});
