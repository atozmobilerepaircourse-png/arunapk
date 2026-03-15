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
import { getApiUrl } from '@/lib/query-client';
import { PostCategory } from '@/lib/types';

const C = Colors.light;

const CATEGORIES: { key: PostCategory; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { key: 'repair', label: 'Repair Work', icon: 'construct', color: '#34C759' },
  { key: 'job', label: 'Job', icon: 'briefcase', color: '#5E8BFF' },
  { key: 'training', label: 'Training', icon: 'school', color: '#FFD60A' },
  { key: 'supplier', label: 'Supplier', icon: 'cube', color: '#FF6B2C' },
];

const QUICK_ISSUES = [
  'Screen Broken',
  'Battery Issue',
  'Not Charging',
  'Water Damage',
  'Camera Not Working',
  'Speaker Issue',
  'Mic Not Working',
  'Touch Not Responding',
  'Software Issue',
  'Back Panel Broken',
];

export default function CreatePostScreen() {
  const insets = useSafeAreaInsets();
  const { profile, addPost } = useApp();
  const [text, setText] = useState('');
  const [category, setCategory] = useState<PostCategory>('repair');
  const [images, setImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadPercent, setUploadPercent] = useState(0);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const pickImages = async () => {
    try {
      // Request permissions on Android/iOS
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Please grant permission to access your photos.');
          return;
        }
      }
      
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
    } catch (e: any) {
      Alert.alert('Error', 'Could not access photos: ' + (e.message || 'Unknown error'));
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

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  const uploadImage = useCallback(async (uri: string, index: number, total: number): Promise<string | null> => {
    const baseUrl = getApiUrl();
    const uploadUrl = new URL('/api/upload', baseUrl).toString();
    setUploadProgress(total > 1 ? `Uploading photo ${index + 1} of ${total}...` : 'Uploading photo...');
    try {
      const formData = new FormData();
      if (Platform.OS === 'web') {
        // On web, ImagePicker returns blob: or data: URLs
        // Fetch from blob URL may fail with CORS, so we handle it differently
        try {
          const res = await window.fetch(uri, { mode: 'no-cors' });
          const blob = await res.blob();
          formData.append('image', blob, 'photo.jpg');
        } catch (fetchErr) {
          // If fetch fails (common with blob URLs), try to use fetch with proper headers
          console.warn('[Upload] Fetch with no-cors failed, retrying with standard fetch');
          try {
            const res = await window.fetch(uri);
            const blob = await res.blob();
            formData.append('image', blob, 'photo.jpg');
          } catch {
            // Last resort: create a simple blob from the URI string
            const blob = new Blob([uri], { type: 'image/jpeg' });
            formData.append('image', blob, 'photo.jpg');
          }
        }
        const uploadRes = await window.fetch(uploadUrl, { method: 'POST', body: formData });
        if (!uploadRes.ok) throw new Error(`Server error ${uploadRes.status}`);
        const data = await uploadRes.json();
        if (data.success && data.url) return data.url;
        throw new Error(data.message || 'Upload failed');
      } else {
        formData.append('image', { uri, name: 'photo.jpg', type: 'image/jpeg' } as any);
        const uploadRes = await expoFetch(uploadUrl, { method: 'POST', body: formData });
        if (!uploadRes.ok) {
          const errText = await uploadRes.text().catch(() => '');
          throw new Error(`Server error ${uploadRes.status}: ${errText.slice(0, 80)}`);
        }
        const data = await uploadRes.json();
        if (data.success && data.url) return data.url;
        throw new Error(data.message || 'Upload failed');
      }
    } catch (e: any) {
      console.error(`[Upload] Image ${index + 1} failed:`, e?.message || e);
      throw e;
    }
  }, []);

  const handleSubmit = async () => {
    if (!text.trim() && images.length === 0) {
      Alert.alert('Missing content', 'Please write something or add media before posting.');
      return;
    }
    if (!profile) {
      Alert.alert('Profile required', 'Please complete your profile first.');
      return;
    }

    setIsSubmitting(true);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      let uploadedImages: string[] = [];
      if (images.length > 0) {
        setUploadProgress(`Uploading ${images.length} photo${images.length > 1 ? 's' : ''}...`);
        const results = await Promise.allSettled(images.map((uri, i) => uploadImage(uri, i, images.length)));
        uploadedImages = results
          .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled' && typeof r.value === 'string')
          .map(r => r.value);
        const failed = results.filter(r => r.status === 'rejected').length;
        if (uploadedImages.length === 0) {
          const errMsg = results[0]?.status === 'rejected' ? (results[0] as PromiseRejectedResult).reason?.message : 'Unknown error';
          Alert.alert('Photo Upload Failed', `Could not upload photos: ${errMsg}\n\nPlease check your connection and try again.`);
          setIsSubmitting(false);
          setUploadProgress('');
          setUploadPercent(0);
          return;
        }
        if (failed > 0) {
          Alert.alert('Partial Upload', `${uploadedImages.length} of ${images.length} photos uploaded. Posting with available photos.`);
        }
        setUploadProgress('');
      }

      setUploadProgress('Creating post...');
      await addPost({
        userId: profile.id,
        userName: profile.name,
        userRole: profile.role,
        userAvatar: profile.avatar || '',
        text: text.trim(),
        images: uploadedImages,
        videoUrl: '',
        category,
      } as any);

      setText('');
      setImages([]);
      setCategory('repair');
      setUploadProgress('Post created!');
      setUploadPercent(100);
      
      // Brief delay to show success message
      await new Promise(r => setTimeout(r, 500));
      router.navigate('/(tabs)');
    } catch (e: any) {
      console.error('[CreatePost] Submit failed:', e instanceof Error ? e.message : String(e));
      Alert.alert('Post Failed', `Something went wrong: ${(e?.message || 'Unknown error').slice(0, 120)}\n\nPlease try again.`);
    } finally {
      setIsSubmitting(false);
      setUploadProgress('');
      setUploadPercent(0);
    }
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

      {category === 'repair' && profile?.role === 'customer' && (
        <>
          <Text style={styles.label}>Quick Issue</Text>
          <View style={styles.quickIssueGrid}>
            {QUICK_ISSUES.map(issue => {
              const selected = text.includes(issue);
              return (
                <Pressable
                  key={issue}
                  style={[styles.quickIssueChip, selected && styles.quickIssueChipActive]}
                  onPress={() => {
                    if (selected) {
                      setText(text.replace(issue, '').replace(/\s+/g, ' ').trim());
                    } else {
                      setText(prev => (prev ? `${prev.trim()} ${issue}` : issue));
                    }
                    if (Platform.OS !== 'web') Haptics.selectionAsync();
                  }}
                >
                  <Text style={[styles.quickIssueText, selected && styles.quickIssueTextActive]}>{issue}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

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
          (isSubmitting || (!text.trim() && images.length === 0)) && { opacity: 0.5 },
        ]}
        onPress={handleSubmit}
        disabled={isSubmitting || (!text.trim() && images.length === 0)}
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
  sellCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF2D55',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    gap: 12,
    shadowColor: '#FF2D55',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  sellCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellCardText: {
    flex: 1,
  },
  sellCardTitle: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  sellCardSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
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
  quickIssueGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  quickIssueChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  quickIssueChipActive: {
    backgroundColor: '#34C759' + '18',
    borderColor: '#34C759',
  },
  quickIssueText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: C.textSecondary,
  },
  quickIssueTextActive: {
    color: '#34C759',
    fontFamily: 'Inter_600SemiBold',
  },
});
