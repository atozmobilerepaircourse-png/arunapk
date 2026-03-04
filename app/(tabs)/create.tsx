import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, Platform,
  ScrollView, Alert, Dimensions, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { fetch as expoFetch } from 'expo/fetch';
import { router } from 'expo-router';
import Colors from '@/constants/colors';
import { useApp } from '@/lib/context';
import { apiRequest, getApiUrl } from '@/lib/query-client';
import { PostCategory } from '@/lib/types';

const C = Colors.light;

const CATEGORIES: { key: PostCategory; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { key: 'repair', label: 'Repair Work', icon: 'construct', color: '#34C759' },
  { key: 'job', label: 'Job', icon: 'briefcase', color: '#5E8BFF' },
  { key: 'training', label: 'Training', icon: 'school', color: '#FFD60A' },
  { key: 'supplier', label: 'Supplier', icon: 'cube', color: '#FF6B2C' },
];

export default function CreatePostScreen() {
  const insets = useSafeAreaInsets();
  const { profile, addPost } = useApp();
  const [text, setText] = useState('');
  const [category, setCategory] = useState<PostCategory>('repair');
  const [images, setImages] = useState<string[]>([]);
  const [video, setVideo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadPercent, setUploadPercent] = useState(0);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.7,
      selectionLimit: 4,
    });

    if (!result.canceled && result.assets) {
      const newUris = result.assets.map(a => a.uri);
      setImages(prev => [...prev, ...newUris].slice(0, 4));
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
    });
    if (!result.canceled && result.assets) {
      setImages(prev => [...prev, result.assets[0].uri].slice(0, 4));
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsMultipleSelection: false,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setVideo(result.assets[0].uri);
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  const removeVideo = () => {
    setVideo(null);
  };

  const uploadImage = useCallback(async (uri: string): Promise<string | null> => {
    try {
      const baseUrl = getApiUrl();

      if (Platform.OS === 'web') {
        const uploadUrl = new URL('/api/upload', baseUrl).toString();
        const formData = new FormData();
        const response = await window.fetch(uri);
        const blob = await response.blob();
        formData.append('image', blob, 'photo.jpg');
        const uploadRes = await window.fetch(uploadUrl, { method: 'POST', body: formData });
        const data = await uploadRes.json();
        if (data.success && data.url) return new URL(data.url, baseUrl).toString();
        return null;
      } else {
        const uploadUrl = new URL('/api/upload', baseUrl).toString();
        const formData = new FormData();
        formData.append('image', {
          uri: uri,
          name: 'photo.jpg',
          type: 'image/jpeg',
        } as any);
        const uploadRes = await expoFetch(uploadUrl, { method: 'POST', body: formData });
        const data = await uploadRes.json();
        if (data.success && data.url) return new URL(data.url, baseUrl).toString();
        return null;
      }
    } catch (e) {
      console.error('[Upload] Failed:', e);
      Alert.alert('Upload Error', 'Could not upload image. Please check your connection and try again.');
      return null;
    }
  }, []);

  const uploadVideo = async (uri: string): Promise<string | null> => {
    try {
      const baseUrl = getApiUrl();
      const uploadUrl = new URL('/api/upload-video', baseUrl).toString();
      const formData = new FormData();

      if (Platform.OS === 'web') {
        const response = await window.fetch(uri);
        const blob = await response.blob();
        formData.append('video', blob, 'video.mp4');
      } else {
        formData.append('video', {
          uri: uri,
          type: 'video/mp4',
          name: 'video.mp4',
        } as any);
      }

      return new Promise<string | null>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', uploadUrl);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.min(99, Math.round((e.loaded / e.total) * 100));
            setUploadPercent(pct);
            setUploadProgress(`Uploading video... ${pct}%`);
          }
        };
        xhr.onload = () => {
          setUploadPercent(100);
          setUploadProgress('Processing video...');
          try {
            const data = JSON.parse(xhr.responseText);
            if (data.success && data.url) resolve(new URL(data.url, baseUrl).toString());
            else reject(new Error(data.message || 'Video upload failed'));
          } catch { reject(new Error('Upload response parse error')); }
        };
        xhr.onerror = () => reject(new Error('Video upload failed'));
        xhr.send(formData);
      });
    } catch (e) {
      console.error('[Upload] Video failed:', e);
      Alert.alert('Upload Error', 'Could not upload video. Please check your connection and try again.');
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!text.trim() && images.length === 0 && !video) {
      Alert.alert('Missing content', 'Please write something or add media before posting.');
      return;
    }
    if (!profile) {
      Alert.alert('Profile required', 'Please complete your profile first.');
      return;
    }

    setIsSubmitting(true);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    let uploadedImages: string[] = [];
    if (images.length > 0) {
      const results = await Promise.all(images.map(uri => uploadImage(uri)));
      uploadedImages = results.filter((url): url is string => url !== null);
      if (uploadedImages.length === 0 && images.length > 0) {
        Alert.alert('Upload Failed', 'Could not upload images. Please try again.');
        setIsSubmitting(false);
        return;
      }
    }

    let uploadedVideoUrl = '';
    if (video) {
      setUploadPercent(0);
      setUploadProgress('Uploading video... 0%');
      const result = await uploadVideo(video);
      setUploadProgress('');
      setUploadPercent(0);
      if (!result) {
        Alert.alert('Upload Failed', 'Could not upload video. Please try again.');
        setIsSubmitting(false);
        return;
      }
      uploadedVideoUrl = result;
    }

    await addPost({
      userId: profile.id,
      userName: profile.name,
      userRole: profile.role,
      text: text.trim(),
      images: uploadedImages,
      videoUrl: uploadedVideoUrl,
      category,
    } as any);

    setText('');
    setImages([]);
    setVideo(null);
    setCategory('repair');
    setIsSubmitting(false);
    router.navigate('/(tabs)');
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 16,
          paddingBottom: Platform.OS === 'web' ? 84 + 34 : 100,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Create Post</Text>
      <Text style={styles.subtitle}>Share with the repair community</Text>

      <Text style={styles.label}>Category</Text>
      <View style={styles.categoryGrid}>
        {CATEGORIES.map(cat => (
          <Pressable
            key={cat.key}
            style={[
              styles.categoryCard,
              category === cat.key && { borderColor: cat.color, backgroundColor: cat.color + '12' },
            ]}
            onPress={() => {
              setCategory(cat.key);
              if (Platform.OS !== 'web') Haptics.selectionAsync();
            }}
          >
            <View style={[styles.categoryIcon, { backgroundColor: cat.color + '20' }]}>
              <Ionicons name={cat.icon} size={22} color={cat.color} />
            </View>
            <Text style={[
              styles.categoryLabel,
              category === cat.key && { color: cat.color },
            ]}>{cat.label}</Text>
            {category === cat.key && (
              <View style={[styles.checkCircle, { backgroundColor: cat.color }]}>
                <Ionicons name="checkmark" size={14} color="#FFF" />
              </View>
            )}
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Content</Text>
      <View style={styles.textInputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder="Share your repair experience, tip, job opening, or supply update..."
          placeholderTextColor={C.textTertiary}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1000}
          textAlignVertical="top"
        />
        <Text style={styles.charCount}>{text.length}/1000</Text>
      </View>

      <Text style={styles.label}>Media</Text>
      <View style={styles.imageSection}>
        {images.length > 0 && (
          <View style={styles.imagePreviewRow}>
            {images.map((uri, idx) => (
              <View key={idx} style={styles.imagePreview}>
                <Image source={{ uri }} style={styles.previewImage} contentFit="cover" />
                <Pressable style={styles.removeImageBtn} onPress={() => removeImage(idx)}>
                  <Ionicons name="close-circle" size={22} color="#FF3B30" />
                </Pressable>
              </View>
            ))}
          </View>
        )}
        {video && (
          <View style={styles.videoPreviewCard}>
            <View style={styles.videoPreviewIcon}>
              <Ionicons name="videocam" size={24} color={C.primary} />
            </View>
            <View style={styles.videoPreviewInfo}>
              <Text style={styles.videoPreviewTitle} numberOfLines={1}>Video attached</Text>
              <Text style={styles.videoPreviewSubtitle}>Ready to upload</Text>
            </View>
            <Pressable onPress={removeVideo} hitSlop={12}>
              <Ionicons name="close-circle" size={22} color="#FF3B30" />
            </Pressable>
          </View>
        )}
        <View style={styles.imageButtons}>
          <Pressable
            style={({ pressed }) => [styles.imageBtn, pressed && { opacity: 0.7 }]}
            onPress={pickImages}
            disabled={images.length >= 4}
          >
            <Ionicons name="images-outline" size={22} color={images.length >= 4 ? C.textTertiary : C.primary} />
            <Text style={[styles.imageBtnText, images.length >= 4 && { color: C.textTertiary }]}>Gallery</Text>
          </Pressable>
          {Platform.OS !== 'web' && (
            <Pressable
              style={({ pressed }) => [styles.imageBtn, pressed && { opacity: 0.7 }]}
              onPress={takePhoto}
              disabled={images.length >= 4}
            >
              <Ionicons name="camera-outline" size={22} color={images.length >= 4 ? C.textTertiary : C.primary} />
              <Text style={[styles.imageBtnText, images.length >= 4 && { color: C.textTertiary }]}>Camera</Text>
            </Pressable>
          )}
          <Pressable
            style={({ pressed }) => [styles.imageBtn, pressed && { opacity: 0.7 }]}
            onPress={pickVideo}
            disabled={!!video}
          >
            <Ionicons name="videocam-outline" size={22} color={video ? C.textTertiary : C.primary} />
            <Text style={[styles.imageBtnText, video ? { color: C.textTertiary } : {}]}>Video</Text>
          </Pressable>
          <Text style={styles.imageCount}>{images.length}/4</Text>
        </View>
      </View>

      {isSubmitting && uploadProgress ? (
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
      ) : null}

      <Pressable
        style={({ pressed }) => [
          styles.submitBtn,
          pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
          (isSubmitting || (!text.trim() && images.length === 0 && !video)) && { opacity: 0.5 },
        ]}
        onPress={handleSubmit}
        disabled={isSubmitting || (!text.trim() && images.length === 0 && !video)}
      >
        <Ionicons name="send" size={20} color="#FFF" />
        <Text style={styles.submitText}>
          {isSubmitting ? 'Posting...' : 'Publish Post'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  content: {
    paddingHorizontal: 20,
  },
  title: {
    color: C.text,
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
  },
  subtitle: {
    color: C.textTertiary,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    marginTop: 4,
    marginBottom: 24,
  },
  label: {
    color: C.textSecondary,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  categoryCard: {
    width: '47%' as any,
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
    gap: 8,
    position: 'relative',
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: {
    color: C.textSecondary,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  checkCircle: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInputContainer: {
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 24,
  },
  textInput: {
    color: C.text,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    minHeight: 100,
    lineHeight: 22,
    padding: 0,
  },
  charCount: {
    color: C.textTertiary,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    textAlign: 'right',
    marginTop: 8,
  },
  imageSection: {
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 24,
  },
  imagePreviewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  imagePreview: {
    width: 80,
    height: 80,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
  },
  videoPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surfaceElevated,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  videoPreviewIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: C.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPreviewInfo: {
    flex: 1,
  },
  videoPreviewTitle: {
    color: C.text,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  videoPreviewSubtitle: {
    color: C.textTertiary,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  imageButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  imageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.surfaceElevated,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  imageBtnText: {
    color: C.primary,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  imageCount: {
    color: C.textTertiary,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginLeft: 'auto',
  },
  submitBtn: {
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
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
