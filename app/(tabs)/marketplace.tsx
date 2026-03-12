import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Platform,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Animated,
  FlatList,
  Alert,
  Modal,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { fetch as expoFetch } from 'expo/fetch';
import { useApp } from '@/lib/context';
import { apiRequest, getApiUrl } from '@/lib/query-client';
import { openLink } from '@/lib/open-link';
import BuySellScreen from '@/app/buy-sell';
import { T } from '@/constants/techTheme';


const { width } = Dimensions.get('window');
const ORANGE = '#FF6B2C';
const BLUE = '#3B82F6';
const YELLOW = '#FBBF24';
const LIGHT_BG = '#0F0F0F';
const GRAY = '#9CA3AF';
const DARK_BG = '#0F0F0F';
const DARK_CARD = '#1E1E1E';
const DARK_SURFACE = '#2A2A2A';
const DARK_TEXT = '#F3F4F6';
const DARK_MUTED = '#9CA3AF';
const DARK_BORDER = '#374151';

const TEACH_TYPE_FILTERS = ['All', 'Software Repair', 'Hardware Repair', 'Mobile Repair', 'Laptop Repair', 'AC Repair'];
const SELL_TYPE_FILTERS = ['All', 'Spare Parts', 'Accessories', 'Tools', 'Software'];

interface ProfileData {
  id: string;
  name: string;
  role: string;
  city?: string;
  state?: string;
  avatar?: string;
  shopName?: string;
  skills?: string[];
  teachType?: string;
  sellType?: string;
  bio?: string;
  shopAddress?: string;
}

interface CourseData {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherAvatar?: string;
  title: string;
  description?: string;
  price: string;
  coverImage?: string;
  category?: string;
  language?: string;
  totalVideos?: number;
  enrollmentCount?: number;
  rating?: string;
}

interface ProductData {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  title: string;
  description?: string;
  price: string;
  category?: string;
  images?: string | string[];
  city?: string;
  inStock?: number;
  views?: number;
}

function getImageUri(img: string): string {
  if (!img) return '';
  if (img.startsWith('/')) return `${getApiUrl()}${img}`;
  return img;
}

function getInitials(name: string): string {
  if (!name) return '??';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

type TabKey = 'courses' | 'suppliers' | 'buysell' | 'live';

interface LiveSession {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherAvatar?: string;
  title: string;
  description?: string;
  platform: 'youtube' | 'zoom' | 'meet' | 'other';
  link: string;
  isLive: boolean;
  startedAt: number;
  latestImage?: string;
  latestImageAt?: number;
}

const CM = {
  bg: '#F5F5F5',
  card: '#FFFFFF',
  orange: '#FF6B2C',
  orangeLight: '#FFF1EC',
  dark: '#1A1A1A',
  muted: '#888888',
  border: '#EEEEEE',
  green: '#34C759',
  blue: '#007AFF',
};

const SELL_BRANDS = [
  { name: 'Apple', domain: 'apple.com' },
  { name: 'Samsung', domain: 'samsung.com' },
  { name: 'Xiaomi', domain: 'mi.com' },
  { name: 'Oppo', domain: 'oppo.com' },
  { name: 'Vivo', domain: 'vivo.com' },
  { name: 'Realme', domain: 'realme.com' },
  { name: 'OnePlus', domain: 'oneplus.com' },
  { name: 'Motorola', domain: 'motorola.com' },
  { name: 'Nokia', domain: 'nokia.com' },
  { name: 'Google', domain: 'google.com' },
  { name: 'Sony', domain: 'sony.com' },
  { name: 'LG', domain: 'lg.com' },
  { name: 'Huawei', domain: 'huawei.com' },
  { name: 'Honor', domain: 'hihonor.com' },
  { name: 'iQOO', domain: 'iqoo.com' },
  { name: 'Tecno', domain: 'tecno-mobile.com' },
  { name: 'Infinix', domain: 'infinixmobility.com' },
  { name: 'Itel', domain: 'itel-mobile.com' },
  { name: 'Lava', domain: 'lavamobiles.com' },
  { name: 'Micromax', domain: 'micromaxinfo.com' },
  { name: 'Other', domain: '' },
];

const SELL_CATEGORIES_LIST = ['Mobiles', 'Electronics', 'Spare Parts', 'Tools', 'E-Waste', 'Other'];
const SELL_CONDITIONS = ['New', 'Like New', 'Used', 'For Parts', 'Damaged'];
const CATEGORY_FILTER_LIST = ['All', 'Mobiles', 'Electronics', 'Spare Parts', 'Tools', 'E-Waste', 'Other'];

interface SellListing {
  id: string;
  title: string;
  price: string;
  condition: string;
  description: string;
  category: string;
  brand: string;
  model: string;
  location: string;
  contact: string;
  images: string[];
  sellerId: string;
  sellerName: string;
  sellerAvatar?: string;
  createdAt: number;
}

function parseSellListing(post: any): SellListing | null {
  const text: string = post.text || '';
  if (!text.includes('SELL_TITLE:')) return null;
  const get = (key: string) => {
    const line = text.split('\n').find((l: string) => l.startsWith(key + ':'));
    return line ? line.replace(key + ':', '').trim() : '';
  };
  const title = get('SELL_TITLE');
  if (!title) return null;
  let imgs: string[] = [];
  try {
    if (Array.isArray(post.images)) imgs = post.images;
    else if (typeof post.images === 'string') imgs = JSON.parse(post.images || '[]');
  } catch {}
  return {
    id: post.id,
    title,
    price: get('SELL_PRICE'),
    condition: get('SELL_CONDITION'),
    description: get('SELL_DESC'),
    category: get('SELL_CATEGORY'),
    brand: get('SELL_BRAND'),
    model: get('SELL_MODEL'),
    location: get('SELL_LOCATION') || post.sellerCity || '',
    contact: get('SELL_CONTACT'),
    images: imgs.map((img: string) => img.startsWith('/') ? `${getApiUrl()}${img}` : img),
    sellerId: post.userId,
    sellerName: post.userName,
    sellerAvatar: post.userAvatar,
    createdAt: post.createdAt,
  };
}

function conditionColor(condition: string): string {
  if (!condition) return CM.muted;
  const c = condition.toLowerCase();
  if (c === 'new') return CM.green;
  if (c === 'like new') return '#007AFF';
  if (c === 'used') return '#FF9500';
  return '#FF3B30';
}

function CustomerMarketplace() {
  const insets = useSafeAreaInsets();
  const { profile } = useApp();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const topPad = (Platform.OS === 'web' ? webTopInset : insets.top) + 0;
  const bottomPad = Platform.OS === 'web' ? 84 : insets.bottom;
  const cardWidth = (width - 40) / 2;

  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [listings, setListings] = useState<SellListing[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [detailItem, setDetailItem] = useState<SellListing | null>(null);

  const [sellImages, setSellImages] = useState<string[]>([]);
  const [sellCategory, setSellCategory] = useState('Mobiles');
  const [sellBrand, setSellBrand] = useState('');
  const [sellModel, setSellModel] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [sellCondition, setSellCondition] = useState('Used');
  const [sellDesc, setSellDesc] = useState('');
  const [sellLocation, setSellLocation] = useState('');
  const [sellContact, setSellContact] = useState(profile?.phone || '');
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [showBrandPicker, setShowBrandPicker] = useState(false);
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [showCondPicker, setShowCondPicker] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const fetchListings = useCallback(async () => {
    try {
      const res = await apiRequest('GET', '/api/posts');
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        const parsed = data
          .map(parseSellListing)
          .filter(Boolean) as SellListing[];
        setListings(parsed.reverse());
        console.log('[CustomerMarketplace] Fetched', parsed.length, 'listings');
      }
    } catch (e) {
      console.error('[CustomerMarketplace] fetch error:', e);
    }
  }, []);

  useEffect(() => {
    setLoadingListings(true);
    fetchListings().finally(() => setLoadingListings(false));
  }, [fetchListings]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchListings();
    setRefreshing(false);
  }, [fetchListings]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return listings.filter(l => {
      if (catFilter !== 'All') {
        const catLower = (l.category || '').toLowerCase();
        const filterLower = catFilter.toLowerCase().replace(' ', '_');
        if (!catLower.includes(filterLower.replace('_', ' ')) && catLower !== filterLower) return false;
      }
      if (q) {
        const hay = [l.title, l.brand, l.model, l.category, l.location, l.sellerName].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [listings, search, catFilter]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const pickImages = async () => {
    if (Platform.OS === 'web') {
      fileInputRef.current?.click();
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Please allow photo access to upload images.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.85,
        selectionLimit: 5 - sellImages.length,
      });
      if (result.canceled) return;
      await uploadImages(result.assets.map(a => a.uri));
    }
  };

  const handleWebFileSelect = (e: any) => {
    const files = e.target?.files;
    if (!files) return;
    const fileArray = Array.from(files) as File[];
    uploadWebImages(fileArray.slice(0, 5 - sellImages.length));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadWebImages = async (files: File[]) => {
    setUploadingImages(true);
    try {
      const uploaded: string[] = [];
      const uploadUrl = new URL('/api/upload', getApiUrl()).toString();
      for (const file of files) {
        const formData = new FormData();
        formData.append('image', file, file.name || 'listing.jpg');
        const res = await window.fetch(uploadUrl, { method: 'POST', body: formData });
        const data = await res.json();
        if (!data.success || !data.url) throw new Error(data.message || 'Upload failed');
        uploaded.push(data.url);
      }
      setSellImages(prev => [...prev, ...uploaded].slice(0, 5));
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.error('[Marketplace] Web upload error:', e);
      Alert.alert('Upload failed', String(e).slice(0, 80));
    } finally {
      setUploadingImages(false);
    }
  };

  const takePhoto = async () => {
    if (Platform.OS === 'web') return;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Camera permission is required to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.85,
      aspect: [1, 1],
      allowsEditing: false,
    });
    if (result.canceled) return;
    await uploadImages(result.assets.map(a => a.uri));
  };

  const uploadImages = async (uris: string[]) => {
    setUploadingImages(true);
    try {
      const uploaded: string[] = [];
      const uploadUrl = new URL('/api/upload', getApiUrl()).toString();
      for (const uri of uris) {
        const formData = new FormData();
        formData.append('image', { uri, name: 'listing.jpg', type: 'image/jpeg' } as any);
        const res = await expoFetch(uploadUrl, { method: 'POST', body: formData });
        const data = await res.json();
        if (!data.success || !data.url) throw new Error(data.message || 'Upload failed');
        uploaded.push(data.url);
      }
      setSellImages(prev => [...prev, ...uploaded].slice(0, 5));
      if (uploaded.length > 0 && Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.error('[Marketplace] Native upload error:', e);
      Alert.alert('Upload failed', `Could not upload images. ${String(e).slice(0, 50)}`);
    } finally {
      setUploadingImages(false);
    }
  };

  const submitListing = async () => {
    if (!sellModel.trim()) { Alert.alert('Missing info', 'Please enter a model name.'); return; }
    if (!sellPrice.trim()) { Alert.alert('Missing info', 'Please enter a price.'); return; }
    if (!profile) { Alert.alert('Login required', 'Please login to post a listing.'); return; }
    setSubmitting(true);
    try {
      const text = [
        `SELL_TITLE: ${sellBrand ? sellBrand + ' ' : ''}${sellModel.trim()}`,
        `SELL_PRICE: ${sellPrice.trim()}`,
        `SELL_CONDITION: ${sellCondition}`,
        `SELL_CATEGORY: ${sellCategory}`,
        `SELL_BRAND: ${sellBrand}`,
        `SELL_MODEL: ${sellModel.trim()}`,
        `SELL_DESC: ${sellDesc.trim()}`,
        `SELL_LOCATION: ${sellLocation.trim()}`,
        `SELL_CONTACT: ${sellContact.trim()}`,
      ].join('\n');
      await apiRequest('POST', '/api/posts', {
        userId: profile.id,
        userName: profile.name,
        userRole: profile.role,
        userAvatar: profile.avatar || '',
        text,
        images: sellImages,
        category: 'sell',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSubmitSuccess(true);
      setSellImages([]);
      setSellCategory('Mobiles');
      setSellBrand('');
      setSellModel('');
      setSellPrice('');
      setSellCondition('Used');
      setSellDesc('');
      setSellLocation('');
      setTimeout(async () => {
        setSubmitSuccess(false);
        setActiveTab('buy');
        await fetchListings();
      }, 2000);
    } catch (e) {
      Alert.alert('Error', 'Failed to post listing. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderBuyCard = ({ item }: { item: SellListing }) => {
    const priceNum = parseFloat(item.price || '0');
    const brandObj = SELL_BRANDS.find(b => b.name.toLowerCase() === item.brand.toLowerCase());
    const logoUrl = brandObj?.domain ? `https://logo.clearbit.com/${brandObj.domain}` : null;
    const imageUri = item.images && item.images.length > 0 ? item.images[0] : null;
    return (
      <Pressable style={[cmStyles.listingCard, { width: cardWidth }]} onPress={() => setDetailItem(item)}>
        <View style={cmStyles.listingImageWrap}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={cmStyles.listingImage} contentFit="cover" />
          ) : (
            <View style={cmStyles.listingImagePlaceholder}>
              <Ionicons name="phone-portrait-outline" size={36} color="#DDD" />
            </View>
          )}
          {item.condition ? (
            <View style={[cmStyles.condBadge, { backgroundColor: conditionColor(item.condition) }]}>
              <Text style={cmStyles.condBadgeText}>{item.condition}</Text>
            </View>
          ) : null}
          {item.images.length > 1 && (
            <View style={cmStyles.imgCountBadge}>
              <Ionicons name="images-outline" size={10} color="#FFF" />
              <Text style={cmStyles.imgCountText}>{item.images.length}</Text>
            </View>
          )}
        </View>
        <View style={cmStyles.listingBody}>
          {item.brand ? (
            <View style={cmStyles.brandRow}>
              {logoUrl ? (
                <Image source={{ uri: logoUrl }} style={cmStyles.brandLogo} contentFit="contain" />
              ) : (
                <View style={cmStyles.brandInitial}>
                  <Text style={cmStyles.brandInitialText}>{item.brand[0].toUpperCase()}</Text>
                </View>
              )}
              <Text style={cmStyles.brandText}>{item.brand}</Text>
            </View>
          ) : null}
          <Text style={cmStyles.listingTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={cmStyles.listingPrice}>
            {priceNum > 0 ? `₹${priceNum.toLocaleString('en-IN')}` : 'Price on request'}
          </Text>
          {item.location ? (
            <View style={cmStyles.locRow}>
              <Ionicons name="location-sharp" size={11} color={CM.muted} />
              <Text style={cmStyles.locText} numberOfLines={1}>{item.location}</Text>
            </View>
          ) : null}
          <Pressable style={cmStyles.buyNowBtn} onPress={() => setDetailItem(item)}>
            <Text style={cmStyles.buyNowText}>View Details</Text>
          </Pressable>
        </View>
      </Pressable>
    );
  };

  const renderDetail = () => {
    if (!detailItem) return null;
    const priceNum = parseFloat(detailItem.price || '0');
    const brandObj = SELL_BRANDS.find(b => b.name.toLowerCase() === (detailItem.brand || '').toLowerCase());
    const logoUrl = brandObj?.domain ? `https://logo.clearbit.com/${brandObj.domain}` : null;
    return (
      <Modal visible animationType="slide" onRequestClose={() => setDetailItem(null)}>
        <View style={[cmStyles.detailContainer, { paddingTop: topPad + (Platform.OS === 'web' ? 0 : insets.top) }]}>
          <View style={cmStyles.detailHeader}>
            <Pressable onPress={() => setDetailItem(null)} hitSlop={8}>
              <Ionicons name="arrow-back" size={24} color={CM.dark} />
            </Pressable>
            <Text style={cmStyles.detailHeaderTitle} numberOfLines={1}>{detailItem.title}</Text>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {detailItem.images.length > 0 ? (
              <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={cmStyles.carousel}>
                {detailItem.images.map((uri, i) => (
                  <Image key={i} source={{ uri }} style={cmStyles.carouselImg} contentFit="contain" />
                ))}
              </ScrollView>
            ) : (
              <View style={cmStyles.detailNoImg}>
                <Ionicons name="phone-portrait-outline" size={64} color="#DDD" />
              </View>
            )}
            <View style={cmStyles.detailBody}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={cmStyles.detailPrice}>{priceNum > 0 ? `₹${priceNum.toLocaleString('en-IN')}` : 'Price on request'}</Text>
                  <Text style={cmStyles.detailTitle}>{detailItem.title}</Text>
                </View>
                {detailItem.condition ? (
                  <View style={[cmStyles.condBadgeLg, { backgroundColor: conditionColor(detailItem.condition) }]}>
                    <Text style={cmStyles.condBadgeLgText}>{detailItem.condition}</Text>
                  </View>
                ) : null}
              </View>
              <View style={cmStyles.detailMeta}>
                {detailItem.brand ? (
                  <View style={cmStyles.detailMetaItem}>
                    {logoUrl ? (
                      <Image source={{ uri: logoUrl }} style={cmStyles.detailBrandLogo} contentFit="contain" />
                    ) : null}
                    <Text style={cmStyles.detailMetaLabel}>Brand</Text>
                    <Text style={cmStyles.detailMetaVal}>{detailItem.brand}</Text>
                  </View>
                ) : null}
                {detailItem.model ? (
                  <View style={cmStyles.detailMetaItem}>
                    <Ionicons name="phone-portrait-outline" size={18} color={CM.orange} />
                    <Text style={cmStyles.detailMetaLabel}>Model</Text>
                    <Text style={cmStyles.detailMetaVal}>{detailItem.model}</Text>
                  </View>
                ) : null}
                {detailItem.category ? (
                  <View style={cmStyles.detailMetaItem}>
                    <Ionicons name="grid-outline" size={18} color={CM.orange} />
                    <Text style={cmStyles.detailMetaLabel}>Category</Text>
                    <Text style={cmStyles.detailMetaVal}>{detailItem.category}</Text>
                  </View>
                ) : null}
                {detailItem.location ? (
                  <View style={cmStyles.detailMetaItem}>
                    <Ionicons name="location-outline" size={18} color={CM.orange} />
                    <Text style={cmStyles.detailMetaLabel}>Location</Text>
                    <Text style={cmStyles.detailMetaVal}>{detailItem.location}</Text>
                  </View>
                ) : null}
              </View>
              {detailItem.description ? (
                <View style={cmStyles.descSection}>
                  <Text style={cmStyles.descTitle}>Description</Text>
                  <Text style={cmStyles.descText}>{detailItem.description}</Text>
                </View>
              ) : null}
              <View style={cmStyles.sellerSection}>
                <Text style={cmStyles.sellerSectionTitle}>Seller</Text>
                <View style={cmStyles.sellerRow}>
                  {detailItem.sellerAvatar ? (
                    <Image source={{ uri: getApiUrl() + detailItem.sellerAvatar }} style={cmStyles.sellerAvatar} contentFit="cover" />
                  ) : (
                    <View style={cmStyles.sellerAvatarPlaceholder}>
                      <Text style={cmStyles.sellerInitials}>{(detailItem.sellerName || 'S').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}</Text>
                    </View>
                  )}
                  <View>
                    <Text style={cmStyles.sellerName}>{detailItem.sellerName}</Text>
                    {detailItem.location ? <Text style={cmStyles.sellerLoc}>{detailItem.location}</Text> : null}
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>
          {detailItem.contact ? (
            <View style={[cmStyles.detailFooter, { paddingBottom: bottomPad + 12 }]}>
              <Pressable style={cmStyles.contactBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}>
                <Ionicons name="call" size={20} color="#FFF" />
                <Text style={cmStyles.contactBtnText}>Call {detailItem.contact}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Modal>
    );
  };

  const renderSellForm = () => (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottomPad + 80 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={cmStyles.formSectionTitle}>Photos ({sellImages.length}/5)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
        {sellImages.map((uri, i) => (
          <View key={i} style={cmStyles.uploadedThumb}>
            <Image source={{ uri }} style={cmStyles.uploadedThumbImg} contentFit="cover" />
            <Pressable style={cmStyles.removeThumb} onPress={() => setSellImages(prev => prev.filter((_, idx) => idx !== i))}>
              <Ionicons name="close-circle" size={22} color="#FF3B30" />
            </Pressable>
          </View>
        ))}
        {sellImages.length < 5 && (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable style={cmStyles.addImageBtn} onPress={pickImages} disabled={uploadingImages}>
              {uploadingImages ? (
                <ActivityIndicator size="small" color={CM.orange} />
              ) : (
                <>
                  <Ionicons name="image-outline" size={24} color={CM.orange} />
                  <Text style={[cmStyles.addImageText, { fontSize: 11 }]}>Gallery</Text>
                </>
              )}
            </Pressable>
            {Platform.OS !== 'web' && (
              <Pressable style={cmStyles.addImageBtn} onPress={takePhoto} disabled={uploadingImages}>
                {!uploadingImages && (
                  <>
                    <Ionicons name="camera-outline" size={24} color={CM.orange} />
                    <Text style={[cmStyles.addImageText, { fontSize: 11 }]}>Camera</Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>

      <Text style={cmStyles.formSectionTitle}>Category</Text>
      <Pressable style={cmStyles.pickerBtn} onPress={() => setShowCatPicker(true)}>
        <Text style={cmStyles.pickerBtnText}>{sellCategory}</Text>
        <Ionicons name="chevron-down" size={18} color={CM.muted} />
      </Pressable>

      <Text style={cmStyles.formSectionTitle}>Brand</Text>
      <Pressable style={cmStyles.pickerBtn} onPress={() => setShowBrandPicker(true)}>
        {sellBrand ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {SELL_BRANDS.find(b => b.name === sellBrand)?.domain ? (
              <Image source={{ uri: `https://logo.clearbit.com/${SELL_BRANDS.find(b => b.name === sellBrand)?.domain}` }} style={{ width: 20, height: 20 }} contentFit="contain" />
            ) : null}
            <Text style={cmStyles.pickerBtnText}>{sellBrand}</Text>
          </View>
        ) : (
          <Text style={[cmStyles.pickerBtnText, { color: CM.muted }]}>Select Brand</Text>
        )}
        <Ionicons name="chevron-down" size={18} color={CM.muted} />
      </Pressable>

      <Text style={cmStyles.formSectionTitle}>Model Name *</Text>
      <TextInput
        style={cmStyles.input}
        placeholder="e.g. iPhone 14 Pro"
        placeholderTextColor={CM.muted}
        value={sellModel}
        onChangeText={setSellModel}
      />

      <Text style={cmStyles.formSectionTitle}>Price (₹) *</Text>
      <TextInput
        style={cmStyles.input}
        placeholder="Enter asking price"
        placeholderTextColor={CM.muted}
        keyboardType="numeric"
        value={sellPrice}
        onChangeText={setSellPrice}
      />

      <Text style={cmStyles.formSectionTitle}>Condition</Text>
      <Pressable style={cmStyles.pickerBtn} onPress={() => setShowCondPicker(true)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: conditionColor(sellCondition) }} />
          <Text style={cmStyles.pickerBtnText}>{sellCondition}</Text>
        </View>
        <Ionicons name="chevron-down" size={18} color={CM.muted} />
      </Pressable>

      <Text style={cmStyles.formSectionTitle}>Description</Text>
      <TextInput
        style={[cmStyles.input, cmStyles.textArea]}
        placeholder="Describe the product, any defects, accessories included..."
        placeholderTextColor={CM.muted}
        multiline
        numberOfLines={4}
        value={sellDesc}
        onChangeText={setSellDesc}
      />

      <Text style={cmStyles.formSectionTitle}>Location</Text>
      <TextInput
        style={cmStyles.input}
        placeholder="City / Area"
        placeholderTextColor={CM.muted}
        value={sellLocation}
        onChangeText={setSellLocation}
      />

      <Text style={cmStyles.formSectionTitle}>Contact Number</Text>
      <TextInput
        style={cmStyles.input}
        placeholder="Your phone number"
        placeholderTextColor={CM.muted}
        keyboardType="phone-pad"
        value={sellContact}
        onChangeText={setSellContact}
      />

      {submitSuccess ? (
        <View style={cmStyles.successBanner}>
          <Ionicons name="checkmark-circle" size={24} color={CM.green} />
          <Text style={cmStyles.successText}>Listing posted successfully!</Text>
        </View>
      ) : (
        <Pressable style={[cmStyles.submitBtn, submitting && { opacity: 0.6 }]} onPress={submitListing} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Ionicons name="pricetag" size={20} color="#FFF" />
              <Text style={cmStyles.submitBtnText}>Post Listing</Text>
            </>
          )}
        </Pressable>
      )}
    </ScrollView>
  );

  return (
    <View style={{ flex: 1, backgroundColor: CM.bg }}>
      {Platform.OS === 'web' && (
        <input
          ref={fileInputRef as any}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none', position: 'absolute' } as any}
          onChange={handleWebFileSelect}
        />
      )}
      <View style={[cmStyles.cmHeader, { paddingTop: topPad + (Platform.OS === 'web' ? 0 : insets.top) }]}>
        <Text style={cmStyles.cmHeaderTitle}>Marketplace</Text>
        {activeTab === 'buy' && (
          <View style={cmStyles.searchRow}>
            <View style={cmStyles.searchBox}>
              <Ionicons name="search" size={16} color={CM.muted} />
              <TextInput
                style={cmStyles.searchInput}
                placeholder="Search phones, parts..."
                placeholderTextColor={CM.muted}
                value={search}
                onChangeText={setSearch}
              />
            </View>
          </View>
        )}
        <View style={cmStyles.mainTabRow}>
          {(['buy', 'sell'] as const).map(t => (
            <Pressable
              key={t}
              style={[cmStyles.mainTab, activeTab === t && cmStyles.mainTabActive]}
              onPress={() => { setActiveTab(t); Haptics.selectionAsync(); }}
            >
              <Ionicons
                name={t === 'buy' ? 'bag-handle' : 'pricetag'}
                size={16}
                color={activeTab === t ? '#FFF' : CM.muted}
              />
              <Text style={[cmStyles.mainTabText, activeTab === t && cmStyles.mainTabTextActive]}>
                {t === 'buy' ? 'BUY' : 'SELL'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {activeTab === 'buy' && (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={cmStyles.catFilterRow} style={{ flexGrow: 0 }}>
            {CATEGORY_FILTER_LIST.map(c => (
              <Pressable
                key={c}
                style={[cmStyles.catChip, catFilter === c && cmStyles.catChipActive]}
                onPress={() => setCatFilter(c)}
              >
                <Text style={[cmStyles.catChipText, catFilter === c && cmStyles.catChipTextActive]}>{c}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {loadingListings ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color={CM.orange} />
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={item => item.id}
              renderItem={renderBuyCard}
              numColumns={2}
              columnWrapperStyle={{ gap: 12 }}
              contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 12, paddingBottom: bottomPad + 80, gap: 12 }}
              showsVerticalScrollIndicator={false}
              scrollEnabled={filtered.length > 0}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={CM.orange} />}
              ListEmptyComponent={
                <View style={cmStyles.emptyState}>
                  <View style={cmStyles.emptyIconWrap}>
                    <Ionicons name="storefront-outline" size={52} color={CM.orange} />
                  </View>
                  <Text style={cmStyles.emptyTitle}>No listings yet</Text>
                  <Text style={cmStyles.emptySubtitle}>Start buying or selling now.{'\n'}Be the first to post!</Text>
                  <Pressable style={cmStyles.emptyAction} onPress={() => setActiveTab('sell')}>
                    <Ionicons name="add-circle" size={18} color="#FFF" />
                    <Text style={cmStyles.emptyActionText}>Post a Listing</Text>
                  </Pressable>
                </View>
              }
            />
          )}
        </>
      )}

      {activeTab === 'sell' && renderSellForm()}

      {renderDetail()}

      <Modal visible={showBrandPicker} transparent animationType="slide" onRequestClose={() => setShowBrandPicker(false)}>
        <View style={cmStyles.pickerModal}>
          <View style={cmStyles.pickerSheet}>
            <View style={cmStyles.pickerSheetHandle} />
            <Text style={cmStyles.pickerSheetTitle}>Select Brand</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {SELL_BRANDS.map(b => (
                <Pressable
                  key={b.name}
                  style={[cmStyles.pickerOption, sellBrand === b.name && cmStyles.pickerOptionActive]}
                  onPress={() => { setSellBrand(b.name); setShowBrandPicker(false); }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    {b.domain ? (
                      <Image source={{ uri: `https://logo.clearbit.com/${b.domain}` }} style={{ width: 28, height: 28 }} contentFit="contain" />
                    ) : (
                      <View style={[cmStyles.brandInitial, { width: 28, height: 28 }]}>
                        <Text style={cmStyles.brandInitialText}>{b.name[0]}</Text>
                      </View>
                    )}
                    <Text style={[cmStyles.pickerOptionText, sellBrand === b.name && { color: CM.orange, fontWeight: '700' as const }]}>{b.name}</Text>
                  </View>
                  {sellBrand === b.name && <Ionicons name="checkmark-circle" size={20} color={CM.orange} />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showCatPicker} transparent animationType="slide" onRequestClose={() => setShowCatPicker(false)}>
        <View style={cmStyles.pickerModal}>
          <View style={cmStyles.pickerSheet}>
            <View style={cmStyles.pickerSheetHandle} />
            <Text style={cmStyles.pickerSheetTitle}>Select Category</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {SELL_CATEGORIES_LIST.map(c => (
                <Pressable
                  key={c}
                  style={[cmStyles.pickerOption, sellCategory === c && cmStyles.pickerOptionActive]}
                  onPress={() => { setSellCategory(c); setShowCatPicker(false); }}
                >
                  <Text style={[cmStyles.pickerOptionText, sellCategory === c && { color: CM.orange, fontWeight: '700' as const }]}>{c}</Text>
                  {sellCategory === c && <Ionicons name="checkmark-circle" size={20} color={CM.orange} />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showCondPicker} transparent animationType="slide" onRequestClose={() => setShowCondPicker(false)}>
        <View style={cmStyles.pickerModal}>
          <View style={cmStyles.pickerSheet}>
            <View style={cmStyles.pickerSheetHandle} />
            <Text style={cmStyles.pickerSheetTitle}>Select Condition</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {SELL_CONDITIONS.map(c => (
                <Pressable
                  key={c}
                  style={[cmStyles.pickerOption, sellCondition === c && cmStyles.pickerOptionActive]}
                  onPress={() => { setSellCondition(c); setShowCondPicker(false); }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: conditionColor(c) }} />
                    <Text style={[cmStyles.pickerOptionText, sellCondition === c && { color: CM.orange, fontWeight: '700' as const }]}>{c}</Text>
                  </View>
                  {sellCondition === c && <Ionicons name="checkmark-circle" size={20} color={CM.orange} />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const cmStyles = StyleSheet.create({
  cmHeader: {
    backgroundColor: CM.card,
    paddingHorizontal: 16,
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: CM.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cmHeaderTitle: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: CM.dark,
    marginBottom: 10,
  },
  searchRow: {
    marginBottom: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CM.bg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: CM.dark,
  },
  mainTabRow: {
    flexDirection: 'row',
    gap: 0,
    marginTop: 0,
  },
  mainTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  mainTabActive: {
    borderBottomColor: CM.orange,
  },
  mainTabText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: CM.muted,
  },
  mainTabTextActive: {
    color: CM.orange,
  },
  catFilterRow: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: CM.card,
    borderWidth: 1,
    borderColor: CM.border,
  },
  catChipActive: {
    backgroundColor: CM.orange,
    borderColor: CM.orange,
  },
  catChipText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: CM.muted,
  },
  catChipTextActive: {
    color: '#FFF',
  },
  listingCard: {
    backgroundColor: CM.card,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  listingImageWrap: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F0F0F0',
    position: 'relative',
  },
  listingImage: {
    width: '100%',
    height: '100%',
  },
  listingImagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
  },
  condBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  condBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#FFF',
  },
  imgCountBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  imgCountText: {
    fontSize: 10,
    color: '#FFF',
    fontWeight: '600' as const,
  },
  listingBody: {
    padding: 10,
    gap: 4,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  brandLogo: {
    width: 16,
    height: 16,
  },
  brandText: {
    fontSize: 11,
    color: CM.muted,
    fontWeight: '500' as const,
  },
  brandInitial: {
    width: 16,
    height: 16,
    borderRadius: 4,
    backgroundColor: CM.orangeLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandInitialText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: CM.orange,
  },
  listingTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: CM.dark,
    lineHeight: 18,
  },
  listingPrice: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: CM.orange,
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  locText: {
    fontSize: 11,
    color: CM.muted,
    flex: 1,
  },
  buyNowBtn: {
    backgroundColor: CM.orangeLight,
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: 'center',
    marginTop: 4,
  },
  buyNowText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: CM.orange,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: CM.orangeLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: CM.dark,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: CM.muted,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  emptyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: CM.orange,
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  emptyActionText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#FFF',
  },
  formSectionTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: CM.muted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: CM.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: CM.dark,
    borderWidth: 1,
    borderColor: CM.border,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top' as const,
    paddingTop: 12,
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CM.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: CM.border,
  },
  pickerBtnText: {
    fontSize: 15,
    color: CM.dark,
  },
  addImageBtn: {
    width: 90,
    height: 90,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: CM.orange,
    borderStyle: 'dashed' as const,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CM.orangeLight,
    gap: 4,
  },
  addImageText: {
    fontSize: 11,
    color: CM.orange,
    fontWeight: '600' as const,
  },
  uploadedThumb: {
    width: 90,
    height: 90,
    borderRadius: 12,
    overflow: 'visible',
    position: 'relative',
  },
  uploadedThumbImg: {
    width: 90,
    height: 90,
    borderRadius: 12,
  },
  removeThumb: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: CM.orange,
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 24,
    shadowColor: CM.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: '#FFF',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#EAFAF1',
    borderRadius: 14,
    padding: 16,
    marginTop: 24,
  },
  successText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: CM.green,
  },
  pickerModal: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  pickerSheet: {
    backgroundColor: CM.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingBottom: 40,
  },
  pickerSheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DDD',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  pickerSheetTitle: {
    fontSize: 17,
    fontWeight: '800' as const,
    color: CM.dark,
    textAlign: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: CM.border,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: CM.border,
  },
  pickerOptionActive: {
    backgroundColor: CM.orangeLight,
  },
  pickerOptionText: {
    fontSize: 15,
    color: CM.dark,
  },
  detailContainer: {
    flex: 1,
    backgroundColor: CM.card,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: CM.border,
  },
  detailHeaderTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: CM.dark,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  carousel: {
    height: 280,
    backgroundColor: '#F7F7F7',
  },
  carouselImg: {
    width,
    height: 250,
    backgroundColor: '#F7F7F7',
  },
  detailNoImg: {
    height: 200,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailBody: {
    padding: 16,
    gap: 4,
  },
  detailPrice: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: CM.orange,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: CM.dark,
    marginTop: 4,
    marginBottom: 12,
  },
  detailMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    gap: 10,
    marginBottom: 16,
  },
  detailMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: CM.bg,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  detailMetaLabel: {
    fontSize: 11,
    color: CM.muted,
    fontWeight: '500' as const,
  },
  detailMetaVal: {
    fontSize: 13,
    color: CM.dark,
    fontWeight: '600' as const,
  },
  detailBrandLogo: {
    width: 18,
    height: 18,
  },
  condBadgeLg: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    marginLeft: 8,
    alignSelf: 'flex-start',
  },
  condBadgeLgText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#FFF',
  },
  descSection: {
    marginBottom: 16,
  },
  descTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: CM.dark,
    marginBottom: 8,
  },
  descText: {
    fontSize: 14,
    color: CM.muted,
    lineHeight: 21,
  },
  sellerSection: {
    backgroundColor: CM.bg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sellerSectionTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: CM.muted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sellerAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  sellerAvatarPlaceholder: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: CM.orangeLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerInitials: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: CM.orange,
  },
  sellerName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: CM.dark,
  },
  sellerLoc: {
    fontSize: 12,
    color: CM.muted,
    marginTop: 2,
  },
  detailFooter: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: CM.border,
    backgroundColor: CM.card,
  },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: CM.green,
    borderRadius: 16,
    paddingVertical: 16,
    shadowColor: CM.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  contactBtnText: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: '#FFF',
  },
});

export default function MarketplaceScreen() {
  const insets = useSafeAreaInsets();
  const { profile, startConversation } = useApp();
  const isCustomer = profile?.role === 'customer';

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const topPad = (Platform.OS === 'web' ? webTopInset : insets.top) + 12;
  const webBottomInset = Platform.OS === 'web' ? 84 : 0;

  const [activeTab, setActiveTab] = useState<TabKey>('live');
  const [search, setSearch] = useState('');
  const [teachFilter, setTeachFilter] = useState('All');
  const [sellFilter, setSellFilter] = useState('All');

  const [profiles, setProfiles] = useState<ProfileData[]>([]);
  const [courses, setCourses] = useState<CourseData[]>([]);
  const [products, setProducts] = useState<ProductData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveUrl, setLiveUrl] = useState('');
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (liveUrl) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [liveUrl]);

  const fetchLiveUrl = useCallback(async () => {
    try {
      const res = await apiRequest('GET', '/api/app-settings/live_url');
      const data = await res.json();
      if (data.value) setLiveUrl(data.value);
      else setLiveUrl('');
    } catch (e) {
      setLiveUrl('');
    }
  }, []);

  useEffect(() => {
    fetchLiveUrl();
  }, [fetchLiveUrl]);

  interface RecommendedCourse {
    id: string;
    title: string;
    price: string;
    coverImage?: string;
    teacherName: string;
    totalVideos?: number;
    reason: string;
  }
  const [recommendations, setRecommendations] = useState<RecommendedCourse[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  const fetchLiveSessions = useCallback(async () => {
    setLiveLoading(true);
    try {
      const res = await apiRequest('GET', '/api/teacher/live-sessions');
      const data = await res.json();
      if (data.sessions) setLiveSessions(data.sessions);
    } catch (e) {
      console.warn('[Live] Fetch error:', e);
    } finally {
      setLiveLoading(false);
    }
  }, []);

  const fetchRecommendations = useCallback(async () => {
    if (!profile?.id) return;
    setRecsLoading(true);
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 900, useNativeDriver: false }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 900, useNativeDriver: false }),
      ])
    ).start();
    try {
      const res = await apiRequest('GET', `/api/courses/personalized-recommendations?userId=${profile.id}`);
      const data = await res.json();
      if (data.recommendations) setRecommendations(data.recommendations);
    } catch (e) {
      console.warn('[Recommendations] fetch error:', e);
    } finally {
      setRecsLoading(false);
      shimmerAnim.stopAnimation();
    }
  }, [profile?.id, shimmerAnim]);

  const fetchAll = useCallback(async () => {
    try {
      const [profRes, courseRes, prodRes] = await Promise.all([
        apiRequest('GET', '/api/profiles'),
        apiRequest('GET', '/api/courses'),
        apiRequest('GET', '/api/products'),
      ]);
      const [profData, courseData, prodData] = await Promise.all([
        profRes.json(),
        courseRes.json(),
        prodRes.json(),
      ]);
      if (Array.isArray(profData)) setProfiles(profData);
      if (Array.isArray(courseData)) setCourses(courseData);
      if (Array.isArray(prodData)) setProducts(prodData);
    } catch (e) {
      console.warn('[Shop] fetch error:', e);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchAll().finally(() => setLoading(false));
  }, [fetchAll]);

  useEffect(() => {
    if (activeTab === 'courses' && profile?.id && recommendations.length === 0) {
      fetchRecommendations();
    }
    if (activeTab === 'live') {
      fetchLiveSessions();
    }
  }, [activeTab, profile?.id]);

  // Auto-refresh live sessions every 10s when on the live tab so shared photos appear
  useEffect(() => {
    if (activeTab !== 'live') return;
    const liveRefreshInterval = setInterval(fetchLiveSessions, 10000);
    return () => clearInterval(liveRefreshInterval);
  }, [activeTab, fetchLiveSessions]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  const courseCounts = useMemo(() => {
    const map: Record<string, number> = {};
    courses.forEach(c => {
      map[c.teacherId] = (map[c.teacherId] || 0) + 1;
    });
    return map;
  }, [courses]);

  const productCounts = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach(p => {
      map[p.userId] = (map[p.userId] || 0) + 1;
    });
    return map;
  }, [products]);

  const suppliers = useMemo(() => {
    const q = search.toLowerCase().trim();
    return profiles
      .filter(p => p.role === 'supplier')
      .filter(p => {
        if (q) {
          const hay = [p.name, p.city, p.shopName, ...(p.skills || []), p.sellType].filter(Boolean).join(' ').toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (sellFilter !== 'All' && p.sellType !== sellFilter) return false;
        return true;
      });
  }, [profiles, search, sellFilter]);

  const filteredCourses = useMemo(() => {
    const q = search.toLowerCase().trim();
    return courses.filter(c => {
      if (q) {
        const hay = [c.title, c.teacherName, c.category, c.language].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (teachFilter !== 'All') {
        const cat = (c.category || '').replace(/_/g, ' ').toLowerCase();
        if (!cat.includes(teachFilter.toLowerCase())) return false;
      }
      return true;
    });
  }, [courses, search, teachFilter]);

  const spareProducts = useMemo(() => {
    const q = search.toLowerCase().trim();
    return products.filter(p => {
      const cat = p.category || '';
      const isSpare = ['spare_part', 'tool', 'component', 'accessory'].includes(cat) || !['course', 'tutorial', 'ebook'].includes(cat);
      if (!isSpare) return false;
      if (q) {
        const hay = [p.title, p.userName, p.city, p.category].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (sellFilter !== 'All') {
        const catMap: Record<string, string[]> = {
          'Spare Parts': ['spare_part', 'component'],
          'Accessories': ['accessory'],
          'Tools': ['tool'],
          'Software': ['software'],
        };
        const allowed = catMap[sellFilter] || [];
        if (allowed.length > 0 && !allowed.includes(cat)) return false;
      }
      return true;
    });
  }, [products, search, sellFilter]);

  if (isCustomer) {
    return <CustomerMarketplace />;
  }

  const renderCourseCard = (c: CourseData) => {
    const priceNum = parseFloat(c.price || '0');
    return (
      <Pressable
        key={c.id}
        style={s.courseCard}
        onPress={() => router.push(`/course-detail?courseId=${c.id}` as any)}
      >
        <View style={s.courseImageWrap}>
          {c.coverImage ? (
            <Image source={{ uri: getImageUri(c.coverImage) }} style={s.courseImage} contentFit="cover" />
          ) : (
            <View style={[s.courseImage, { backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="videocam" size={40} color="#000" />
            </View>
          )}
          <View style={s.priceBadge}>
            <Text style={s.priceBadgeText}>{priceNum > 0 ? `₹${priceNum}` : 'FREE'}</Text>
          </View>
        </View>
        <View style={s.courseInfo}>
          <Text style={s.courseTitle} numberOfLines={2}>{c.title}</Text>
          <View style={s.metaRowCompact}>
            <Ionicons name="person" size={12} color={ORANGE} />
            <Text style={s.metaTextCompact}>{c.teacherName}</Text>
            <View style={s.dot} />
            <Ionicons name="play-circle" size={12} color={GRAY} />
            <Text style={s.metaTextCompact}>{c.totalVideos || 0} Videos</Text>
          </View>
        </View>
      </Pressable>
    );
  };

  const renderProductCard = (p: ProductData) => {
    const priceNum = parseFloat(p.price || '0');
    const priceText = !isNaN(priceNum) && priceNum > 0 ? `₹${Math.round(priceNum)}` : 'FREE';
    let imgs: string[] = [];
    try {
      if (Array.isArray(p.images)) imgs = p.images;
      else if (typeof p.images === 'string' && p.images) imgs = JSON.parse(p.images);
    } catch (e) {}
    const firstImg = imgs && imgs.length > 0 ? getImageUri(imgs[0]) : null;
    const conditionColors: Record<string, string> = {
      new: '#10B981', refurbished: '#3B82F6', used: '#9CA3AF',
    };
    const condition = p.condition || 'new';
    const conditionColor = conditionColors[condition.toLowerCase()] || '#10B981';
    return (
      <Pressable
        key={p.id}
        style={s.productCard}
        onPress={() => router.push(`/product-detail?productId=${p.id}` as any)}
      >
        {/* Image area */}
        <View style={s.productImageWrap}>
          {firstImg ? (
            <Image source={{ uri: firstImg }} style={s.productImage} contentFit="cover" />
          ) : (
            <View style={[s.productImage, { backgroundColor: T.cardSurface, alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="cube" size={30} color={BLUE} />
            </View>
          )}
          {/* Condition badge - bottom left */}
          <View style={[s.conditionBadge, { backgroundColor: conditionColor }]}>
            <Text style={s.conditionBadgeText}>{condition.toUpperCase()}</Text>
          </View>
          {/* Wishlist button - top right */}
          <Pressable style={s.wishlistBtn} onPress={(e) => { e.stopPropagation?.(); }}>
            <Ionicons name="heart-outline" size={14} color="#FFF" />
          </Pressable>
        </View>
        <View style={s.productInfo}>
          <Text style={s.productTitle} numberOfLines={2}>{p.title}</Text>
          <Text style={s.productPrice}>{priceText}</Text>
          {p.city && (
            <View style={s.metaRowCompact}>
              <Ionicons name="location" size={10} color={GRAY} />
              <Text style={s.metaTextCompact}>{p.city}</Text>
            </View>
          )}
        </View>
      </Pressable>
    );
  };

  const getSupplierRating = (id: string): number => {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
    return 3.8 + ((Math.abs(h) % 13) / 10);
  };

  const handleChatWithSupplier = async (sup: ProfileData) => {
    if (!profile) { Alert.alert('Login Required', 'Please log in to chat.'); return; }
    if (sup.id === profile.id) return;
    try {
      const convoId = await startConversation(sup.id, sup.name, sup.role as any);
      if (convoId) router.push(`/chat/${convoId}` as any);
    } catch (e) {
      Alert.alert('Error', 'Could not start chat. Please try again.');
    }
  };

  const handleCallSupplier = (phone: string) => {
    if (!phone) { Alert.alert('No number', 'Phone not available for this supplier.'); return; }
    Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('Error', 'Cannot open dialer.'));
  };

  const renderStars = (rating: number) => {
    const stars = [];
    const full = Math.floor(rating);
    for (let i = 0; i < 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i < full ? 'star' : (i === full && rating % 1 >= 0.5 ? 'star-half' : 'star-outline')}
          size={11}
          color="#FBBF24"
        />
      );
    }
    return stars;
  };

  const renderSupplierCard = (sup: ProfileData) => {
    const rating = getSupplierRating(sup.id);
    const isOwn = profile?.id === sup.id;
    return (
      <Pressable
        key={sup.id}
        style={s.supplierCard}
        onPress={() => router.push(`/supplier-store?id=${sup.id}` as any)}
      >
        {/* Top section: Logo + Basic Info + Location Badge */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
          {/* Logo */}
          <View style={s.supplierLogoWrap}>
            {sup.avatar ? (
              <Image source={{ uri: getImageUri(sup.avatar) }} style={s.supplierLogo} contentFit="contain" />
            ) : (
              <View style={[s.supplierLogo, { backgroundColor: BLUE + '22', alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ color: BLUE, fontSize: 18, fontWeight: '700' as const }}>{getInitials(sup.name)}</Text>
              </View>
            )}
            {sup.verified && <View style={s.supplierVerified}><Ionicons name="checkmark" size={9} color="#FFF" /></View>}
          </View>

          {/* Name + Rating + Status */}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Text style={s.supplierName} numberOfLines={1}>{sup.name}</Text>
            </View>
            
            {/* Rating row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', gap: 1 }}>{renderStars(rating)}</View>
              <Text style={{ color: '#FBBF24', fontSize: 12, fontWeight: '700' as const }}>{rating.toFixed(1)}</Text>
              <Text style={{ color: T.muted, fontSize: 10 }}>({Math.floor(12 + Math.abs(rating * 7) % 88)} reviews)</Text>
            </View>

            {/* Status row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' }} />
                <Text style={{ color: '#10B981', fontSize: 11, fontWeight: '600' as const }}>Open Now</Text>
              </View>
              <Text style={{ color: T.muted, fontSize: 10 }}>• Closes 6PM</Text>
            </View>
          </View>
        </View>

        {/* Middle section: Distance + Response */}
        <View style={{ flexDirection: 'row', gap: 16, marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: T.borderLight }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, flex: 1 }}>
            <Ionicons name="location" size={14} color={T.muted} style={{ marginTop: 2 }} />
            <View>
              <Text style={{ color: T.text, fontSize: 12, fontWeight: '600' as const }}>12.4 miles away</Text>
              <Text style={{ color: T.muted, fontSize: 11 }}>{sup.city || 'Location'}, {sup.state || 'State'}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, flex: 1 }}>
            <Ionicons name="flash" size={14} color={ORANGE} style={{ marginTop: 2 }} />
            <View>
              <Text style={{ color: T.text, fontSize: 12, fontWeight: '600' as const }}>Fast Response</Text>
              <Text style={{ color: T.muted, fontSize: 11 }}>Usually within 15 mins</Text>
            </View>
          </View>
        </View>

        {/* Specialties Tags */}
        {sup.skills && sup.skills.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {sup.skills.slice(0, 3).map((skill, i) => (
              <View key={i} style={s.supplierTag}>
                <Text style={s.supplierTagText}>{skill}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Action buttons */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            style={[s.supplierContactBtn, { flex: 1 }]}
            onPress={() => handleChatWithSupplier(sup)}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={14} color="#FFF" />
            <Text style={s.supplierContactBtnText}>Chat</Text>
          </Pressable>
          {(sup as any).phone && (
            <Pressable
              style={[s.supplierContactBtn, { flex: 1, backgroundColor: T.cardSurface, borderWidth: 1, borderColor: T.borderLight }]}
              onPress={() => handleCallSupplier((sup as any).phone)}
            >
              <Ionicons name="call-outline" size={14} color={T.text} />
              <Text style={[s.supplierContactBtnText, { color: T.text }]}>Call</Text>
            </Pressable>
          )}
          <Pressable
            style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: T.cardSurface, borderRadius: 8, borderWidth: 1, borderColor: T.borderLight }}
            onPress={() => {}}
          >
            <Ionicons name="ellipsis-vertical" size={16} color={T.muted} />
          </Pressable>
        </View>
      </Pressable>
    );
  };

  const renderFilterChips = (items: string[], selected: string, onSelect: (v: string) => void, color: string) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow} style={s.chipScroll}>
      {items.map(item => (
        <Pressable
          key={item}
          style={[s.chip, selected === item && { backgroundColor: color, borderColor: color }]}
          onPress={() => onSelect(item)}
        >
          <Text style={[s.chipText, selected === item && s.chipTextActive]}>{item}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: topPad }]}>
        <Text style={s.headerTitle}>Shop</Text>
        <View style={s.searchWrap}>
          <Ionicons name="search" size={18} color="#999" />
          <TextInput
            style={s.searchInput}
            placeholder="Search courses, spare parts..."
            placeholderTextColor="#999"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
        <View style={s.tabContainer}>
          {[
            { key: 'live', label: liveUrl ? 'Mobi Live' : 'Live', icon: 'radio', color: '#FF3B30' },
            { key: 'suppliers', label: 'Suppliers', icon: 'construct' },
            ...(!['technician', 'teacher', 'supplier'].includes(profile?.role || '') ? [{ key: 'buysell', label: 'Buy & Sell', icon: 'pricetags' }] : []),
          ].map(tab => {
            const isActive = activeTab === tab.key;
            const isLive = tab.key === 'live';
            return (
              <Pressable
                key={tab.key}
                style={[s.tabPill, isActive && (isLive ? s.tabPillLive : s.tabPillActive)]}
                onPress={() => setActiveTab(tab.key as TabKey)}
              >
                {isLive && (
                  <Animated.View style={[s.liveDot, liveUrl ? { transform: [{ scale: pulseAnim }] } : null]} />
                )}
                <Ionicons name={tab.icon as any} size={14} color={isActive ? '#FFF' : (isLive ? '#FF3B30' : '#666')} />
                <Text style={[s.tabPillText, isActive && s.tabPillTextActive]}>{tab.label}</Text>
                {isLive && liveSessions.length > 0 && (
                  <View style={s.liveCountBadge}><Text style={s.liveCountText}>{liveSessions.length}</Text></View>
                )}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {activeTab === 'buysell' ? (
        <BuySellScreen isEmbedded />
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: webBottomInset + 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ORANGE} />}
        >
          {activeTab === 'suppliers' && (
            <View style={{ paddingVertical: 10 }}>
              {suppliers.map(renderSupplierCard)}
              {suppliers.length === 0 && !loading && (
                <View style={s.emptyWrap}><Ionicons name="construct-outline" size={48} color="#DDD" /><Text style={s.emptyText}>No suppliers found</Text></View>
              )}
            </View>
          )}

          {activeTab === 'live' && (
            <View style={{ padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={s.liveHeaderDot} />
                  <Text style={{ fontSize: 20, fontWeight: '800' as const, color: T.text }}>Live Now</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable onPress={fetchLiveSessions} style={{ backgroundColor: T.card, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: T.border }}>
                    <Ionicons name="refresh" size={18} color={T.muted} />
                  </Pressable>
                  {profile?.role === 'teacher' && (
                    <Pressable
                      style={s.goLiveBtn}
                      onPress={() => router.push('/go-live' as any)}
                    >
                      <View style={s.goLiveDot} />
                      <Text style={s.goLiveBtnText}>Go Live</Text>
                    </Pressable>
                  )}
                </View>
              </View>
              {liveLoading ? (
                <ActivityIndicator size="large" color="#FF3B30" style={{ marginTop: 40 }} />
              ) : liveSessions.length === 0 ? (
                <View style={s.emptyWrap}>
                  <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(239,68,68,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                    <Ionicons name="radio-outline" size={40} color="#FF3B30" />
                  </View>
                  <Text style={{ fontSize: 17, fontWeight: '700' as const, color: T.text, marginBottom: 4 }}>No Live Sessions</Text>
                  <Text style={s.emptyText}>Teachers will appear here when they go live</Text>
                  {profile?.role === 'teacher' && (
                    <Pressable style={[s.goLiveBtn, { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12 }]} onPress={() => router.push('/go-live' as any)}>
                      <View style={s.goLiveDot} />
                      <Text style={s.goLiveBtnText}>Start Streaming</Text>
                    </Pressable>
                  )}
                </View>
              ) : (
                liveSessions.map(session => {
                  const platformColors: Record<string, string> = { youtube: '#FF0000', zoom: '#2D8CFF', meet: '#00897B', other: '#FF3B30' };
                  const platformIcons: Record<string, string> = { youtube: 'logo-youtube', zoom: 'videocam', meet: 'videocam', other: 'radio' };
                  const platformNames: Record<string, string> = { youtube: 'YouTube', zoom: 'Zoom', meet: 'Google Meet', other: 'Live' };
                  const color = platformColors[session.platform] || '#FF3B30';
                  const iconName = platformIcons[session.platform] || 'radio';
                  const platformName = platformNames[session.platform] || 'Live';
                  const elapsed = Math.floor((Date.now() - session.startedAt) / 60000);
                  const elapsedText = elapsed < 60 ? `${elapsed}m ago` : `${Math.floor(elapsed / 60)}h ago`;
                  return (
                    <Pressable
                      key={session.id}
                      style={s.liveCard}
                      onPress={() => router.push({ pathname: '/live-session', params: { url: session.link, title: session.title } } as any)}
                    >
                      {/* Thumbnail area - aspect-video ratio */}
                      <View style={s.liveThumbWrap}>
                        {session.latestImage ? (
                          <Image
                            source={{ uri: getImageUri(session.latestImage) }}
                            style={StyleSheet.absoluteFill}
                            contentFit="cover"
                          />
                        ) : (
                          <View style={[StyleSheet.absoluteFill, { backgroundColor: color + '20', alignItems: 'center', justifyContent: 'center' }]}>
                            <Ionicons name={iconName as any} size={40} color={color} />
                          </View>
                        )}
                        {/* Gradient overlay */}
                        <View style={s.liveThumbGradient} />
                        {/* LIVE badge - top-left */}
                        <View style={s.liveBadge}>
                          <View style={s.liveBadgeDot} />
                          <Text style={s.liveBadgeText}>LIVE</Text>
                        </View>
                        {/* Platform badge - top-right */}
                        <View style={[s.platformBadge, { backgroundColor: color + '22' }]}>
                          <Ionicons name={iconName as any} size={12} color={color} />
                        </View>
                      </View>

                      {/* Info section below image */}
                      <View style={s.liveInfo}>
                        <View style={[s.liveAvatar, { backgroundColor: color + '20' }]}>
                          <Text style={[s.liveAvatarText, { color }]}>{getInitials(session.teacherName)}</Text>
                        </View>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={s.liveCardTitle} numberOfLines={2}>{session.title}</Text>
                          <Text style={s.liveTeacherName}>{session.teacherName} · Started {elapsedText}</Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })
              )}
            </View>
          )}


          {loading && <ActivityIndicator size="large" color={ORANGE} style={{ marginTop: 20 }} />}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  header: { paddingHorizontal: 16, backgroundColor: T.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border, paddingBottom: 12 },
  headerTitle: { fontSize: 26, fontWeight: '800' as const, color: T.text, marginBottom: 10 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.card, borderRadius: 14, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: T.border },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: T.text },
  tabContainer: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  tabPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20, backgroundColor: T.card, borderWidth: 1, borderColor: T.border },
  tabPillActive: { backgroundColor: T.accent, borderColor: T.accent },
  tabPillText: { fontSize: 12, fontWeight: '600' as const, color: T.muted },
  tabPillTextActive: { color: '#FFF' },
  chipScroll: { maxHeight: 44, marginBottom: 6 },
  chipRow: { paddingHorizontal: 12, gap: 6, alignItems: 'center' },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10, backgroundColor: T.card, borderWidth: 1, borderColor: T.border },
  chipText: { fontSize: 12, fontWeight: '600' as const, color: T.muted },
  chipTextActive: { color: '#FFF' },
  grid: { padding: 16, gap: 16 },
  supplierCard: { backgroundColor: T.card, borderRadius: 16, borderWidth: 1, borderColor: T.borderLight, padding: 16, marginHorizontal: 12, marginBottom: 12 },
  supplierLogoWrap: { position: 'relative', width: 70, height: 70 },
  supplierLogo: { width: 70, height: 70, borderRadius: 12, backgroundColor: '#FFF' },
  supplierVerified: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: '#3B82F6', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: T.card },
  supplierName: { color: T.text, fontSize: 15, fontWeight: '700' as const },
  supplierShop: { color: T.muted, fontSize: 12, fontWeight: '400' as const },
  supplierTag: { backgroundColor: T.bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: T.borderLight },
  supplierTagText: { color: T.muted, fontSize: 11, fontWeight: '500' as const },
  supplierContactBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: ORANGE, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  supplierContactBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' as const },
  supplierSecondBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: T.cardSurface, borderWidth: 1, borderColor: T.borderLight, alignItems: 'center', justifyContent: 'center' },
  grid2: { padding: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  courseCard: { backgroundColor: T.card, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: T.border, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  courseImageWrap: { width: '100%', height: 180, position: 'relative' },
  courseImage: { width: '100%', height: '100%' },
  priceBadge: { position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  priceBadgeText: { color: '#FFF', fontSize: 14, fontWeight: '800' as const },
  courseInfo: { padding: 16, gap: 8 },
  courseTitle: { fontSize: 16, fontWeight: '700' as const, color: T.text, lineHeight: 22 },
  productCard: { width: (width - 36) / 2, backgroundColor: T.card, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: T.border },
  productImageWrap: { width: '100%', height: 130, position: 'relative' },
  conditionBadge: { position: 'absolute', bottom: 6, left: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  conditionBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '700' as const },
  wishlistBtn: { position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  productImage: { width: '100%', height: '100%' },
  productInfo: { padding: 10, gap: 4 },
  productTitle: { fontSize: 13, fontWeight: '600' as const, color: T.text, height: 32 },
  productPrice: { fontSize: 15, fontWeight: '800' as const, color: BLUE },
  card: { marginHorizontal: 12, marginBottom: 8, backgroundColor: T.card, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: T.border },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 16, fontWeight: '700' as const, color: T.muted },
  cardInfo: { flex: 1, gap: 2 },
  cardName: { fontSize: 16, fontWeight: '700' as const, color: T.text },
  metaRowCompact: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaTextCompact: { fontSize: 12, color: T.muted, fontWeight: '500' as const },
  metaText: { fontSize: 13, color: T.muted },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: T.border, marginHorizontal: 2 },
  adCard: { marginBottom: 16, borderRadius: 20, overflow: 'hidden', height: 160, position: 'relative', borderWidth: 1, borderColor: T.border },
  adImage: { width: '100%', height: '100%' },
  adOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: 'rgba(0,0,0,0.7)' },
  adTitle: { color: '#FFF', fontSize: 16, fontWeight: '700' as const },
  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 12, width: '100%' },
  emptyText: { fontSize: 15, color: T.muted, fontWeight: '500' as const },
  allCoursesLabel: { fontSize: 18, fontWeight: '700' as const, color: T.text, marginTop: 8 },
  recSection: { marginBottom: 8, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border },
  recHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  recHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sparkleIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: T.accentMuted, alignItems: 'center', justifyContent: 'center' },
  recTitle: { fontSize: 17, fontWeight: '700' as const, color: T.text },
  refreshBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: T.accentMuted, alignItems: 'center', justifyContent: 'center' },
  recCardSkeleton: { width: 180, height: 220, borderRadius: 16, backgroundColor: T.card },
  recCard: { width: 180, backgroundColor: T.card, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: T.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 3 },
  recImageWrap: { width: '100%', height: 110, position: 'relative' },
  recImage: { width: '100%', height: '100%' },
  recPriceBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  recPriceBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '800' as const },
  recCardBody: { padding: 10, gap: 6 },
  recCardTitle: { fontSize: 13, fontWeight: '700' as const, color: T.text, lineHeight: 18 },
  recAiReason: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, backgroundColor: T.accentMuted, padding: 6, borderRadius: 8 },
  recReasonText: { fontSize: 10, color: T.accent, lineHeight: 14, flex: 1, fontWeight: '500' as const },
  recMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  recMetaText: { fontSize: 10, color: T.muted, flex: 1 },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59,130,246,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 2,
  },
  locationBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#3B82F6',
  },
  tabPillLive: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' },
  liveCountBadge: { backgroundColor: '#EF4444', borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  liveCountText: { color: '#FFF', fontSize: 9, fontWeight: '700' as const },
  goLiveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EF4444', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  goLiveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFF' },
  goLiveBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' as const },
  liveHeaderDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444' },
  liveCard: { backgroundColor: T.card, borderRadius: 24, marginBottom: 16, borderWidth: 1, borderColor: T.borderLight, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  liveThumbWrap: { width: '100%', aspectRatio: 16/9, position: 'relative', backgroundColor: '#000' },
  liveThumbGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, backgroundColor: 'rgba(0,0,0,0.5)' },
  liveBadge: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#DC2626', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  liveBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFF' },
  liveBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' as const },
  platformBadge: { position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  liveInfo: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12 },
  liveAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  liveAvatarText: { fontSize: 13, fontWeight: '700' as const },
  liveCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  livePlatformBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  livePlatformText: { fontSize: 12, fontWeight: '700' as const },
  liveActiveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  liveActiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' },
  liveActiveText: { fontSize: 10, fontWeight: '800' as const, color: '#EF4444', letterSpacing: 1 },
  liveCardTitle: { fontSize: 16, fontWeight: '800' as const, color: T.text, marginBottom: 6, lineHeight: 22 },
  liveCardDesc: { fontSize: 13, color: T.muted, lineHeight: 18, marginBottom: 12 },
  liveCardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  liveTeacherName: { fontSize: 13, fontWeight: '600' as const, color: T.textSub },
  liveElapsed: { fontSize: 11, color: T.muted },
  joinLiveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 14 },
  joinLiveBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' as const },
});
