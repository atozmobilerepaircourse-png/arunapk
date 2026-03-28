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
  const [images, setImages] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadPercent, setUploadPercent] = useState(0);

  const isWeb = typeof window !== 'undefined';
  const webTopInset = isWeb ? 67 : 0;

  const pickImages = async () => {
    try {
      // Request permissions on Android/iOS
      if (!isWeb) {
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
        base64: isWeb,
      });

      if (!result.canceled && result.assets) {
        const newAssets = result.assets;
        setImages(prev => [...prev, ...newAssets].slice(0, 4));
        if (!isWeb) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e: any) {
      Alert.alert('Error', 'Could not access photos: ' + (e.message || 'Unknown error'));
    }
  };

  // Parse EXIF orientation from JPEG
  const getEXIFOrientation = (data: Uint8Array): number => {
    if (data[0] !== 0xFF || data[1] !== 0xD8) return 1;
    let i = 2;
    while (i < data.length) {
      if (data[i] !== 0xFF) return 1;
      const marker = data[i + 1];
      if (marker === 0xE1) {
        const len = (data[i + 2] << 8) | data[i + 3];
        const exifData = data.slice(i + 4, i + 2 + len);
        if (exifData[0] === 69 && exifData[1] === 120 && exifData[2] === 105 && exifData[3] === 102) {
          const isBigEndian = (exifData[6] === 0x4D && exifData[7] === 0x4D);
          let offset = 8;
          const numDirEntries = isBigEndian ? (exifData[offset] << 8) | exifData[offset + 1] : (exifData[offset + 1] << 8) | exifData[offset];
          offset += 2;
          for (let j = 0; j < numDirEntries; j++) {
            const tag = isBigEndian ? (exifData[offset] << 8) | exifData[offset + 1] : (exifData[offset + 1] << 8) | exifData[offset];
            const type = isBigEndian ? (exifData[offset + 2] << 8) | exifData[offset + 3] : (exifData[offset + 3] << 8) | exifData[offset + 2];
            if (tag === 274) {
              const value = isBigEndian ? (exifData[offset + 8] << 8) | exifData[offset + 9] : (exifData[offset + 9] << 8) | exifData[offset + 8];
              return value || 1;
            }
            offset += 12;
          }
        }
        return 1;
      }
      const len = (data[i + 2] << 8) | data[i + 3];
      i += 2 + len;
    }
    return 1;
  };

  // Fix EXIF rotation by redrawing image on canvas with correct orientation
  const fixEXIFRotation = async (base64Data: string): Promise<Blob> => {
    return new Promise((resolve) => {
      try {
        const byteChars = atob(base64Data);
        const bytes = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          bytes[i] = byteChars.charCodeAt(i);
        }
        const orientation = getEXIFOrientation(bytes);
        const img = new Image();
        let timeout: NodeJS.Timeout | null = null;
        
        img.onload = () => {
          if (timeout) clearTimeout(timeout);
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(new Blob([''], { type: 'image/jpeg' }));
            
            let width = img.width, height = img.height;
            if (orientation > 4) [width, height] = [height, width];
            canvas.width = width;
            canvas.height = height;
            
            ctx.save();
            switch (orientation) {
              case 2: ctx.translate(width, 0); ctx.scale(-1, 1); break;
              case 3: ctx.translate(width, height); ctx.rotate(Math.PI); break;
              case 4: ctx.translate(0, height); ctx.scale(1, -1); break;
              case 5: ctx.translate(width, 0); ctx.rotate(Math.PI / 2); ctx.scale(-1, 1); break;
              case 6: ctx.translate(width, 0); ctx.rotate(Math.PI / 2); break;
              case 7: ctx.translate(0, height); ctx.rotate(Math.PI / 2); ctx.scale(-1, 1); break;
              case 8: ctx.translate(0, height); ctx.rotate(-Math.PI / 2); break;
            }
            ctx.drawImage(img, 0, 0);
            ctx.restore();
            
            canvas.toBlob((blob) => {
              resolve(blob || new Blob([''], { type: 'image/jpeg' }));
            }, 'image/jpeg', 0.92);
          } catch (e) {
            console.error('[EXIF] Canvas processing failed:', e);
            resolve(new Blob([''], { type: 'image/jpeg' }));
          }
        };
        
        img.onerror = () => {
          if (timeout) clearTimeout(timeout);
          console.warn('[EXIF] Image load failed, returning empty blob');
          resolve(new Blob([''], { type: 'image/jpeg' }));
        };
        
        timeout = setTimeout(() => {
          console.warn('[EXIF] Image load timeout, returning empty blob');
          resolve(new Blob([''], { type: 'image/jpeg' }));
        }, 5000);
        
        img.src = `data:image/jpeg;base64,${base64Data}`;
      } catch (e) {
        console.error('[EXIF] Parsing failed:', e);
        resolve(new Blob([''], { type: 'image/jpeg' }));
      }
    });
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      base64: isWeb,
    });
    if (!result.canceled && result.assets) {
      setImages(prev => [...prev, result.assets[0]].slice(0, 4));
      if (!isWeb) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  const uploadImage = useCallback(async (asset: any, index: number, total: number): Promise<string | null> => {
    const baseUrl = getApiUrl();
    const uploadUrl = new URL('/api/upload', baseUrl).toString();
    setUploadProgress(total > 1 ? `Uploading photo ${index + 1} of ${total}...` : 'Uploading photo...');
    console.log(`[Upload] Starting image ${index + 1}/${total}`);
    try {
      const formData = new FormData();
      
      if (isWeb) {
        // Web: Handle File object, base64, or URI
        try {
          console.log(`[Upload] Web: asset type=${typeof asset}, keys=${Object.keys(asset).join(',')}`);
          
          // Method 0: If asset is a File object, strip EXIF
          if (asset instanceof File) {
            console.log(`[Upload] Web: File object detected, size: ${asset.size} bytes, stripping EXIF...`);
            const base64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => {
                const result = reader.result as string;
                resolve(result.split(',')[1] || result);
              };
              reader.readAsDataURL(asset);
            });
            const rotatedBlob = await fixEXIFRotation(base64);
            console.log(`[Upload] Web: Fixed EXIF rotation from File, blob size: ${rotatedBlob.size} bytes`);
            formData.append('image', rotatedBlob, `photo_${Date.now()}.jpg`);
          } 
          // Method 1: If asset has base64, convert to blob and fix EXIF rotation
          else if (asset.base64) {
            console.log(`[Upload] Web: Converting base64 to blob (size: ${asset.base64.length} chars)`);
            // Fix EXIF rotation by parsing orientation and rotating on canvas
            const rotatedBlob = await fixEXIFRotation(asset.base64);
            console.log(`[Upload] Web: Fixed EXIF rotation, blob size: ${rotatedBlob.size} bytes`);
            const filename = `photo_${Date.now()}.jpg`;
            formData.append('image', rotatedBlob, filename);
          } 
          // Method 2: Fallback - fetch from URI (file:// or blob: URLs) and strip EXIF
          else if (asset.uri) {
            console.log(`[Upload] Web: Fetching blob from URI: ${asset.uri.slice(0, 50)}...`);
            const response = await fetch(asset.uri);
            if (!response.ok) throw new Error(`Failed to fetch URI: ${response.status}`);
            const blob = await response.blob();
            const base64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => {
                const result = reader.result as string;
                resolve(result.split(',')[1] || result);
              };
              reader.readAsDataURL(blob);
            });
            const rotatedBlob = await fixEXIFRotation(base64);
            console.log(`[Upload] Web: Fixed EXIF rotation from URI, blob size: ${rotatedBlob.size} bytes`);
            const filename = `photo_${Date.now()}.jpg`;
            formData.append('image', rotatedBlob, filename);
          } 
          else {
            throw new Error(`ImagePicker asset missing required fields. Keys: ${Object.keys(asset).join(',')}`);
          }
        } catch (e: any) {
          console.error(`[Upload] Web processing failed:`, e?.message);
          throw e;
        }
      } else {
        // Mobile: Use URI with Expo fetch
        console.log(`[Upload] Mobile: Using URI directly`);
        formData.append('image', { uri: asset.uri, name: `photo_${Date.now()}.jpg`, type: 'image/jpeg' } as any);
      }
      
      console.log(`[Upload] Sending to server: ${uploadUrl}`);
      const uploadRes = await (isWeb ? window.fetch(uploadUrl, { method: 'POST', body: formData }) : expoFetch(uploadUrl, { method: 'POST', body: formData }));
      
      console.log(`[Upload] Response status: ${uploadRes.status}`);
      if (!uploadRes.ok) {
        const errText = await uploadRes.text().catch(() => '(no error text)');
        console.error(`[Upload] Server error ${uploadRes.status}: ${errText}`);
        throw new Error(`Server error ${uploadRes.status}`);
      }
      
      const data = await uploadRes.json();
      console.log(`[Upload] Response data:`, data);
      if (data.success && data.url) {
        console.log(`[Upload] SUCCESS - Image ${index + 1} uploaded: ${data.url}`);
        return data.url;
      }
      throw new Error(data.message || 'Upload returned no URL');
    } catch (e: any) {
      console.error(`[Upload] Image ${index + 1} FAILED:`, e?.message || String(e));
      setUploadProgress('');
      setUploadPercent(0);
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
    if (!isWeb) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      let uploadedImages: string[] = [];
      if (images.length > 0) {
        setUploadProgress(`Uploading ${images.length} photo${images.length > 1 ? 's' : ''}...`);
        const results = await Promise.allSettled(images.map((uri, i) => uploadImage(uri, i, images.length)));
        uploadedImages = results
          .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled' && typeof r.value === 'string')
          .map(r => r.value);
        const failed = results.filter(r => r.status === 'rejected').length;
        console.log('[CreatePost] Upload complete:', { total: images.length, successful: uploadedImages.length, failed, urls: uploadedImages });
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
      console.log('[CreatePost] Calling addPost with:', { images: uploadedImages, imageCount: uploadedImages.length, hasImages: uploadedImages.length > 0 });
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
          paddingTop: (isWeb ? webTopInset : insets.top) + 16,
          paddingBottom: isWeb ? 84 + 34 : 100,
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
              if (!isWeb) Haptics.selectionAsync();
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
            {images.map((asset, idx) => (
              <View key={idx} style={styles.imagePreview}>
                <Image source={{ uri: asset.uri }} style={styles.previewImage} contentFit="cover" />
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
