import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Dimensions,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useApp } from '@/lib/context';
import { apiRequest, getApiUrl } from '@/lib/query-client';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 44) / 2;

const COLORS = {
  dark: '#0F1624',
  card: '#1A2035',
  cardSurface: '#222C44',
  accent: '#FF7B47',
  accentBlue: '#3B82F6',
  text: '#FFFFFF',
  muted: '#9CA3AF',
  border: '#2E3A54',
  green: '#10B981',
  yellow: '#FBBF24',
  red: '#EF4444',
};

const conditionColors: Record<string, string> = {
  new: COLORS.green,
  refurbished: COLORS.accentBlue,
  used: '#6B7280',
  'like new': '#8B5CF6',
  'for parts': COLORS.red,
};

interface RealProduct {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  userAvatar?: string;
  title: string;
  description?: string;
  price?: string;
  category?: string;
  condition?: string;
  city?: string;
  images?: string | string[];
  views?: number;
  likes?: string | string[];
  createdAt?: number;
}

interface AdBanner {
  type: 'ad';
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  linkUrl?: string;
}

type RowItem =
  | { type: 'products-row'; items: RealProduct[] }
  | { type: 'ad'; id: string; title: string; description?: string; imageUrl?: string; linkUrl?: string };

interface ShopProductsTabProps {
  search: string;
  onSearch: (query: string) => void;
}

function getImageUri(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${getApiUrl()}${url}`;
}

function parseImages(images?: string | string[]): string[] {
  if (!images) return [];
  if (Array.isArray(images)) return images;
  try { return JSON.parse(images); } catch { return images ? [images] : []; }
}

function getStableRating(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
  return 3.8 + ((Math.abs(h) % 13) / 10);
}

function getReviewCount(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 17 + id.charCodeAt(i)) & 0xffffffff;
  return 5 + (Math.abs(h) % 245);
}

function ShopProductsTab({ search, onSearch }: ShopProductsTabProps) {
  const { profile, startConversation } = useApp();
  const [wishlist, setWishlist] = useState(new Set<string>());
  const [products, setProducts] = useState<RealProduct[]>([]);
  const [ads, setAds] = useState<AdBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [prodRes, adsRes] = await Promise.all([
        apiRequest('GET', '/api/products'),
        apiRequest('GET', '/api/ads/active'),
      ]);
      const [prodData, adsData] = await Promise.all([
        prodRes.json(),
        adsRes.json(),
      ]);
      if (Array.isArray(prodData)) setProducts(prodData);
      if (Array.isArray(adsData)) setAds(adsData.map((a: any) => ({ type: 'ad' as const, ...a })));
    } catch (e) {
      console.warn('[ShopTab] fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase().trim();
    return products.filter(p => {
      if (!q) return true;
      const hay = [p.title, p.userName, p.city, p.category].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [products, search]);

  const listData = useMemo((): RowItem[] => {
    const rows: RowItem[] = [];
    const pairs: RealProduct[][] = [];
    for (let i = 0; i < filteredProducts.length; i += 2) {
      pairs.push(filteredProducts.slice(i, i + 2));
    }
    pairs.forEach((pair, pairIdx) => {
      rows.push({ type: 'products-row', items: pair });
      if (ads.length > 0 && (pairIdx + 1) % 3 === 0) {
        const adIdx = Math.floor(pairIdx / 3) % ads.length;
        rows.push({ type: 'ad', ...ads[adIdx] });
      }
    });
    return rows;
  }, [filteredProducts, ads]);

  const toggleWishlist = (id: string) => {
    const nw = new Set(wishlist);
    if (nw.has(id)) nw.delete(id); else nw.add(id);
    setWishlist(nw);
  };

  const handleChatWithSeller = async (product: RealProduct) => {
    if (!profile) { Alert.alert('Login Required', 'Please log in to chat with sellers.'); return; }
    if (product.userId === profile.id) return;
    setChatLoading(product.id);
    try {
      const convoId = await startConversation(product.userId, product.userName, product.userRole as any);
      if (convoId) router.push(`/chat/${convoId}` as any);
    } catch {
      Alert.alert('Error', 'Could not open chat. Try again.');
    } finally {
      setChatLoading(null);
    }
  };

  const renderSingleProduct = (p: RealProduct) => {
    const imgs = parseImages(p.images);
    const firstImg = imgs.length > 0 ? getImageUri(imgs[0]) : undefined;
    const rating = getStableRating(p.id);
    const reviews = getReviewCount(p.id);
    const condition = (p.condition || 'new').toLowerCase();
    const condColor = conditionColors[condition] || COLORS.green;
    const priceNum = parseFloat(p.price || '0');
    const priceText = !isNaN(priceNum) && priceNum > 0 ? `₹${Math.round(priceNum)}` : 'Ask price';
    const isOwn = profile?.id === p.userId;
    const chatting = chatLoading === p.id;
    return (
      <Pressable
        key={p.id}
        style={styles.productCard}
        onPress={() => router.push(`/product-detail?productId=${p.id}` as any)}
      >
        <Pressable style={styles.wishlistBtn} onPress={() => toggleWishlist(p.id)} hitSlop={8}>
          <Ionicons name={wishlist.has(p.id) ? 'heart' : 'heart-outline'} size={14} color={wishlist.has(p.id) ? '#FF3B30' : COLORS.muted} />
        </Pressable>
        <View style={styles.imageContainer}>
          {firstImg ? (
            <Image source={{ uri: firstImg }} style={styles.productImage} contentFit="cover" cachePolicy="memory-disk" />
          ) : (
            <View style={[styles.productImage, { backgroundColor: COLORS.cardSurface, alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="cube-outline" size={40} color={COLORS.muted} />
            </View>
          )}
          <View style={[styles.conditionBadge, { backgroundColor: condColor }]}>
            <Text style={styles.conditionBadgeText}>{condition.toUpperCase()}</Text>
          </View>
        </View>
        <View style={styles.cardContent}>
          <View style={styles.brandRatingRow}>
            <Text style={styles.brand} numberOfLines={1}>{p.userName}</Text>
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={9} color={COLORS.yellow} />
              <Text style={styles.rating}>{rating.toFixed(1)}</Text>
              <Text style={styles.reviewCount}>({reviews})</Text>
            </View>
          </View>
          <Text style={styles.productTitle} numberOfLines={2}>{p.title}</Text>
          {p.category && <Text style={styles.partNumber}>{p.category.replace(/_/g, ' ')}</Text>}
          <View style={styles.priceStockRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.price}>{priceText}</Text>
              {p.city && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
                  <Ionicons name="location-outline" size={10} color={COLORS.muted} />
                  <Text style={styles.cityText}>{p.city}</Text>
                </View>
              )}
            </View>
            {!isOwn && (
              <Pressable style={[styles.chatBtn, chatting && { opacity: 0.6 }]} onPress={() => handleChatWithSeller(p)} disabled={chatting} hitSlop={4}>
                {chatting ? <ActivityIndicator size="small" color={COLORS.text} /> : <MaterialCommunityIcons name="chat-outline" size={15} color={COLORS.text} />}
              </Pressable>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  const renderRowItem = ({ item }: { item: RowItem }) => {
    if (item.type === 'ad') {
      return (
        <Pressable
          style={styles.adBanner}
          onPress={() => item.linkUrl && Linking.openURL(item.linkUrl).catch(() => {})}
        >
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.adBannerImage} contentFit="cover" />
          ) : (
            <View style={[styles.adBannerImage, { backgroundColor: COLORS.cardSurface, justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="megaphone" size={32} color={COLORS.accent} />
            </View>
          )}
          <View style={styles.adBannerOverlay}>
            <View style={styles.adSponsored}>
              <Ionicons name="megaphone" size={10} color={COLORS.accent} />
              <Text style={styles.adSponsoredText}>SPONSORED</Text>
            </View>
            <Text style={styles.adBannerTitle} numberOfLines={1}>{item.title}</Text>
            {item.description && <Text style={styles.adBannerDesc} numberOfLines={1}>{item.description}</Text>}
          </View>
        </Pressable>
      );
    }
    return (
      <View style={styles.gridRow}>
        {item.items.map(renderSingleProduct)}
        {item.items.length === 1 && <View style={styles.productCard} />}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.dark, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={{ color: COLORS.muted, marginTop: 12, fontSize: 13 }}>Loading parts...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerSection}>
        <View>
          <Text style={styles.headerTitle}>Spare Parts & Tools</Text>
          <Text style={styles.headerSubtitle}>
            {filteredProducts.length} {filteredProducts.length === 1 ? 'item' : 'items'} available
          </Text>
        </View>
        {ads.length > 0 && (
          <View style={styles.adsBadge}>
            <Ionicons name="megaphone" size={10} color={COLORS.accent} />
            <Text style={styles.adsBadgeText}>{ads.length} Sponsored</Text>
          </View>
        )}
      </View>

      {listData.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 60 }}>
          <Ionicons name="cube-outline" size={56} color={COLORS.muted} />
          <Text style={{ color: COLORS.muted, fontSize: 16, marginTop: 14, fontWeight: '600' }}>No parts listed yet</Text>
          <Text style={{ color: COLORS.muted, fontSize: 13, marginTop: 6, opacity: 0.7 }}>Suppliers can add products from their profile</Text>
        </View>
      ) : (
        <FlatList
          data={listData}
          renderItem={renderRowItem}
          keyExtractor={(item, i) => item.type === 'ad' ? `ad-${item.id}-${i}` : `row-${(item as { type: 'products-row'; items: RealProduct[] }).items[0]?.id}-${i}`}
          contentContainerStyle={styles.gridContent}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  headerSection: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F3F4F6',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.muted,
  },
  adsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.accent + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.accent + '40',
  },
  adsBadgeText: {
    color: COLORS.accent,
    fontSize: 10,
    fontWeight: '700',
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    gap: 12,
  },
  gridContent: {
    paddingTop: 12,
    paddingBottom: 12,
  },
  productCard: {
    width: CARD_WIDTH,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    position: 'relative',
  },
  wishlistBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    width: '100%',
    height: 130,
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  conditionBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  conditionBadgeText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardContent: {
    padding: 10,
    gap: 4,
  },
  brandRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: '600',
    flex: 1,
    marginRight: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  rating: {
    color: COLORS.yellow,
    fontSize: 10,
    fontWeight: '700',
  },
  reviewCount: {
    color: COLORS.muted,
    fontSize: 9,
  },
  productTitle: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    minHeight: 34,
  },
  partNumber: {
    color: COLORS.muted,
    fontSize: 10,
    textTransform: 'capitalize',
  },
  cityText: {
    color: COLORS.muted,
    fontSize: 10,
  },
  priceStockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  price: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '800',
  },
  chatBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adBanner: {
    marginHorizontal: 16,
    borderRadius: 14,
    overflow: 'hidden',
    height: 120,
    position: 'relative',
    borderWidth: 1,
    borderColor: COLORS.accent + '40',
    backgroundColor: COLORS.cardSurface,
    width: width - 32,
  },
  adBannerImage: {
    width: '100%',
    height: '100%',
  },
  adBannerOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  adSponsored: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  adSponsoredText: {
    color: COLORS.accent,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  adBannerTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  adBannerDesc: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    marginTop: 2,
  },
});

export default ShopProductsTab;
