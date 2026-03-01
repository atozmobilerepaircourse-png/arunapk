import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, Platform,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';
import { router } from 'expo-router';
import { useApp } from '@/lib/context';
import { getApiUrl } from '@/lib/query-client';

const LT = {
  text: '#1A1A1A',
  textSecondary: '#555555',
  textTertiary: '#888888',
  background: '#FFFFFF',
  surface: '#F7F7F7',
  surfaceElevated: '#EBEBEB',
  border: '#E0E0E0',
  primary: '#FF6B2C',
  accent: '#FF2D55',
};

const CONDITIONS = ['Like New', 'Good', 'Fair', 'Used'];

const SELL_CATEGORIES = [
  { key: 'mobiles', label: 'Mobiles', icon: 'phone-portrait-outline' as const },
  { key: 'electronics', label: 'Electronics', icon: 'tv-outline' as const },
  { key: 'spare_parts', label: 'Spare Parts', icon: 'hardware-chip-outline' as const },
  { key: 'tools', label: 'Tools', icon: 'construct-outline' as const },
  { key: 'ewaste', label: 'E-Waste', icon: 'trash-outline' as const },
  { key: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' as const },
];

function formatSellText(title: string, price: string, condition: string, description: string, sellCategory: string): string {
  let text = `SELL_TITLE:${title}\nSELL_PRICE:${price}\nSELL_CONDITION:${condition}\nSELL_DESC:${description}`;
  if (sellCategory) text += `\nSELL_CATEGORY:${sellCategory}`;
  return text;
}

export default function SellItemScreen() {
  const insets = useSafeAreaInsets();
  const { profile, addPost } = useApp();

  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [condition, setCondition] = useState('Like New');
  const [description, setDescription] = useState('');
  const [sellCategory, setSellCategory] = useState('other');
  const [images, setImages] = useState<string[]>([]);
  const [isPosting, setIsPosting] = useState(false);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const webBottomInset = Platform.OS === 'web' ? 34 : 0;

  const pickImages = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 5 - images.length,
        quality: 0.8,
      });
      if (!result.canceled && result.assets) {
        const newUris = result.assets.map(a => a.uri);
        setImages(prev => [...prev, ...newUris].slice(0, 5));
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not pick images');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required to take photos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      if (!result.canceled && result.assets) {
        setImages(prev => [...prev, result.assets[0].uri].slice(0, 5));
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not take photo');
    }
  };

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  const postAd = async () => {
    if (!profile) {
      Alert.alert('Profile required', 'Please complete your profile first.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Required', 'Enter item name');
      return;
    }
    if (!price.trim()) {
      Alert.alert('Required', 'Enter price');
      return;
    }

    setIsPosting(true);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const text = formatSellText(title.trim(), price.trim(), condition, description.trim(), sellCategory);
      await addPost({
        userId: profile.id,
        userName: profile.name,
        userRole: profile.role,
        userAvatar: profile.avatar || '',
        text,
        images,
        category: 'sell',
      } as any);

      Alert.alert('Posted!', 'Your ad has been listed successfully.');
      router.back();
    } catch (e) {
      Alert.alert('Error', 'Failed to post your ad. Please try again.');
    } finally {
      setIsPosting(false);
    }
  };

  const canPost = title.trim().length > 0 && price.trim().length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.header, { paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 12 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={26} color={LT.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Sell Something</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={[styles.bodyContent, { paddingBottom: (Platform.OS === 'web' ? webBottomInset : insets.bottom) + 100 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>Item Photos ({images.length}/5)</Text>
        <View style={styles.photosSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photosRow}>
            {images.map((uri, i) => (
              <View key={i} style={styles.photoThumb}>
                <Image source={{ uri }} style={styles.photoThumbImage} contentFit="cover" />
                <Pressable style={styles.photoRemoveBtn} onPress={() => removeImage(i)}>
                  <Ionicons name="close-circle" size={22} color={LT.accent} />
                </Pressable>
              </View>
            ))}
            {images.length < 5 && (
              <>
                <Pressable style={styles.photoAddBtn} onPress={pickImages}>
                  <Ionicons name="images-outline" size={26} color={LT.primary} />
                  <Text style={styles.photoAddLabel}>Gallery</Text>
                </Pressable>
                {Platform.OS !== 'web' && (
                  <Pressable style={styles.photoAddBtn} onPress={takePhoto}>
                    <Ionicons name="camera-outline" size={26} color={LT.primary} />
                    <Text style={styles.photoAddLabel}>Camera</Text>
                  </Pressable>
                )}
              </>
            )}
          </ScrollView>
        </View>

        <Text style={styles.sectionLabel}>Item Title *</Text>
        <TextInput
          style={styles.input}
          placeholder="What are you selling?"
          placeholderTextColor={LT.textTertiary}
          value={title}
          onChangeText={setTitle}
          maxLength={100}
        />

        <Text style={styles.sectionLabel}>Price *</Text>
        <View style={styles.priceRow}>
          <View style={styles.pricePrefix}>
            <Text style={styles.pricePrefixText}>{'\u20B9'}</Text>
          </View>
          <TextInput
            style={[styles.input, styles.priceInput]}
            placeholder="0"
            placeholderTextColor={LT.textTertiary}
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
          />
        </View>

        <Text style={styles.sectionLabel}>Condition</Text>
        <View style={styles.conditionRow}>
          {CONDITIONS.map(c => (
            <Pressable
              key={c}
              style={[styles.conditionChip, condition === c && styles.conditionChipActive]}
              onPress={() => {
                setCondition(c);
                if (Platform.OS !== 'web') Haptics.selectionAsync();
              }}
            >
              <Text style={[styles.conditionChipText, condition === c && styles.conditionChipTextActive]}>{c}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Category</Text>
        <View style={styles.categoryGrid}>
          {SELL_CATEGORIES.map(cat => (
            <Pressable
              key={cat.key}
              style={[styles.categoryItem, sellCategory === cat.key && styles.categoryItemActive]}
              onPress={() => {
                setSellCategory(cat.key);
                if (Platform.OS !== 'web') Haptics.selectionAsync();
              }}
            >
              <Ionicons
                name={cat.icon}
                size={20}
                color={sellCategory === cat.key ? LT.primary : LT.textSecondary}
              />
              <Text
                style={[styles.categoryItemLabel, sellCategory === cat.key && styles.categoryItemLabelActive]}
                numberOfLines={1}
              >
                {cat.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe your item - brand, model, age, any defects..."
          placeholderTextColor={LT.textTertiary}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          maxLength={500}
        />
        <Text style={styles.charCount}>{description.length}/500</Text>

        <Pressable
          style={({ pressed }) => [
            styles.postBtn,
            pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            (!canPost || isPosting) && { opacity: 0.5 },
          ]}
          onPress={postAd}
          disabled={!canPost || isPosting}
        >
          {isPosting ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <>
              <Ionicons name="megaphone" size={20} color="#FFF" />
              <Text style={styles.postBtnText}>Post Ad</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LT.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: LT.border,
    backgroundColor: LT.background,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: LT.text,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: LT.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 4,
  },
  photosSection: {
    marginBottom: 20,
  },
  photosRow: {
    flexDirection: 'row',
    gap: 10,
  },
  photoThumb: {
    width: 90,
    height: 90,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: LT.border,
  },
  photoThumbImage: {
    width: '100%',
    height: '100%',
  },
  photoRemoveBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  photoAddBtn: {
    width: 90,
    height: 90,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: LT.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LT.surface,
    gap: 4,
  },
  photoAddLabel: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: LT.textSecondary,
  },
  input: {
    backgroundColor: LT.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LT.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: LT.text,
    marginBottom: 20,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 20,
  },
  pricePrefix: {
    backgroundColor: LT.surfaceElevated,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    borderWidth: 1,
    borderRightWidth: 0,
    borderColor: LT.border,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  pricePrefixText: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: LT.text,
  },
  priceInput: {
    flex: 1,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    marginBottom: 0,
  },
  conditionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  conditionChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: LT.surface,
    borderWidth: 1.5,
    borderColor: LT.border,
  },
  conditionChipActive: {
    backgroundColor: LT.primary + '15',
    borderColor: LT.primary,
  },
  conditionChipText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: LT.textSecondary,
  },
  conditionChipTextActive: {
    color: LT.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: LT.surface,
    borderWidth: 1.5,
    borderColor: LT.border,
  },
  categoryItemActive: {
    backgroundColor: LT.primary + '12',
    borderColor: LT.primary,
  },
  categoryItemLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: LT.textSecondary,
  },
  categoryItemLabelActive: {
    color: LT.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 14,
    marginBottom: 4,
  },
  charCount: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: LT.textTertiary,
    textAlign: 'right',
    marginBottom: 24,
  },
  postBtn: {
    backgroundColor: LT.primary,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: LT.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  postBtnText: {
    color: '#FFF',
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
  },
});
