import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, Pressable,
  FlatList, ActivityIndicator, Dimensions, Animated, RefreshControl, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '@/lib/context';
import { useCart } from '@/lib/cart-context';
import { apiRequest } from '@/lib/query-client';
import { T } from '@/constants/techTheme';

const { width } = Dimensions.get('window');
const CARD_W = (width - 48) / 2;
const webTop = Platform.OS === 'web' ? 67 : 0;

const CATEGORIES = [
  { id: 'all', label: 'All', icon: 'apps', color: T.accent },
  { id: 'tools', label: 'Tools', icon: 'hammer', color: '#3B82F6' },
  { id: 'spare-parts', label: 'Spare Parts', icon: 'construct', color: '#10B981' },
  { id: 'equipment', label: 'Equipment', icon: 'hardware-chip', color: '#8B5CF6' },
  { id: 'accessories', label: 'Accessories', icon: 'flash', color: '#F59E0B' },
  { id: 'materials', label: 'Materials', icon: 'layers', color: '#EF4444' },
  { id: 'software', label: 'Software', icon: 'code-slash', color: '#06B6D4' },
];

const SORT_OPTIONS = ['Newest', 'Price ↑', 'Price ↓', 'Popular'];

interface Product {
  id: string;
  title: string;
  price: string;
  images: string;
  userName: string;
  userId: string;
  userAvatar: string;
  category: string;
  views: number;
  likes: string;
  inStock: number;
  description: string;
  city: string;
  state: string;
  createdAt: number;
}

function SkeletonCard() {
  const anim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <Animated.View style={[styles.skeleton, { opacity: anim, width: CARD_W }]}>
      <View style={styles.skeletonImg} />
      <View style={{ padding: 10 }}>
        <View style={styles.skeletonLine} />
        <View style={[styles.skeletonLine, { width: '60%', marginTop: 6 }]} />
        <View style={[styles.skeletonLine, { width: '40%', marginTop: 6 }]} />
      </View>
    </Animated.View>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }}>
      {[1, 2, 3, 4, 5].map(s => (
        <Ionicons key={s} name={s <= Math.round(rating) ? 'star' : 'star-outline'} size={10} color="#F59E0B" />
      ))}
    </View>
  );
}

function ProductCard({ product, onPress, onAddToCart }: { product: Product; onPress: () => void; onAddToCart: () => void }) {
  const { isInCart, getQuantity } = useCart();
  const imgs = (() => { try { return JSON.parse(product.images); } catch { return []; } })();
  const img = imgs[0] || '';
  const price = parseFloat(product.price) || 0;
  const inCart = isInCart(product.id);
  const qty = getQuantity(product.id);
  const views = product.views || 0;
  const fakeRating = 3.5 + ((product.id.charCodeAt(0) || 65) % 15) / 10;
  const fakeReviews = 10 + ((product.id.charCodeAt(1) || 65) % 90);
  const fakeDiscount = views > 50 ? Math.floor(views % 30) + 5 : 0;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, { width: CARD_W, opacity: pressed ? 0.92 : 1 }]}>
      <View style={styles.cardImgWrap}>
        {img ? (
          <Image source={{ uri: img }} style={styles.cardImg} contentFit="cover" />
        ) : (
          <View style={[styles.cardImg, styles.cardImgPlaceholder]}>
            <Ionicons name="cube-outline" size={36} color={T.muted} />
          </View>
        )}
        {fakeDiscount > 0 && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{fakeDiscount}% OFF</Text>
          </View>
        )}
        {product.inStock === 0 && (
          <View style={styles.outOfStockOverlay}>
            <Text style={{ color: '#fff', fontSize: 11, fontFamily: 'Inter_600SemiBold' }}>Out of Stock</Text>
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{product.title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
          <StarRating rating={fakeRating} />
          <Text style={styles.reviewCount}>({fakeReviews})</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
          <Text style={styles.price}>₹{price.toLocaleString('en-IN')}</Text>
          {fakeDiscount > 0 && (
            <Text style={styles.originalPrice}>₹{Math.round(price * 100 / (100 - fakeDiscount)).toLocaleString('en-IN')}</Text>
          )}
        </View>
        <View style={styles.supplierRow}>
          <Ionicons name="storefront-outline" size={11} color={T.muted} />
          <Text style={styles.supplierName} numberOfLines={1}>{product.userName}</Text>
        </View>
        <Pressable
          onPress={e => { e.stopPropagation(); onAddToCart(); }}
          style={[styles.addBtn, inCart && styles.addBtnActive]}
          disabled={product.inStock === 0}
        >
          {inCart ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="checkmark-circle" size={14} color="#fff" />
              <Text style={styles.addBtnText}>In Cart ({qty})</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="cart-outline" size={14} color="#fff" />
              <Text style={styles.addBtnText}>Add to Cart</Text>
            </View>
          )}
        </Pressable>
      </View>
    </Pressable>
  );
}

function FlashDealCard({ product, onPress }: { product: Product; onPress: () => void }) {
  const imgs = (() => { try { return JSON.parse(product.images); } catch { return []; } })();
  const price = parseFloat(product.price) || 0;
  const discount = 15 + ((product.id.charCodeAt(0) || 65) % 25);
  const original = Math.round(price * 100 / (100 - discount));
  return (
    <Pressable onPress={onPress} style={styles.flashCard}>
      <View style={styles.flashImgWrap}>
        {imgs[0] ? (
          <Image source={{ uri: imgs[0] }} style={styles.flashImg} contentFit="cover" />
        ) : (
          <View style={[styles.flashImg, { backgroundColor: T.card, alignItems: 'center', justifyContent: 'center' }]}>
            <Ionicons name="cube-outline" size={28} color={T.muted} />
          </View>
        )}
        <View style={styles.flashDiscount}>
          <Text style={{ color: '#fff', fontSize: 10, fontFamily: 'Inter_700Bold' }}>{discount}%</Text>
          <Text style={{ color: '#fff', fontSize: 8, fontFamily: 'Inter_600SemiBold' }}>OFF</Text>
        </View>
      </View>
      <Text style={styles.flashTitle} numberOfLines={2}>{product.title}</Text>
      <Text style={styles.flashPrice}>₹{price.toLocaleString('en-IN')}</Text>
      <Text style={styles.flashOriginal}>₹{original.toLocaleString('en-IN')}</Text>
    </Pressable>
  );
}

export default function MarketplaceScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useApp();
  const { addToCart, totalItems } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [sortBy, setSortBy] = useState('Newest');
  const [showSort, setShowSort] = useState(false);

  const loadProducts = useCallback(async () => {
    try {
      const res = await apiRequest('GET', '/api/products');
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load products:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadProducts(); }, []);

  const onRefresh = useCallback(() => { setRefreshing(true); loadProducts(); }, [loadProducts]);

  const filtered = products.filter(p => {
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.userName.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === 'all' || p.category === activeCategory;
    return matchSearch && matchCat && p.inStock !== 0;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'Price ↑') return parseFloat(a.price) - parseFloat(b.price);
    if (sortBy === 'Price ↓') return parseFloat(b.price) - parseFloat(a.price);
    if (sortBy === 'Popular') return (b.views || 0) - (a.views || 0);
    return b.createdAt - a.createdAt;
  });

  const flashDeals = products.filter(p => p.inStock > 0).slice(0, 8);
  const featured = products.filter(p => p.inStock > 0 && (p.views || 0) > 0).slice(0, 6);
  const suppliers = [...new Map(products.filter(p => p.userId).map(p => [p.userId, p])).values()].slice(0, 8);

  const handleAddToCart = (product: Product) => {
    const imgs = (() => { try { return JSON.parse(product.images); } catch { return []; } })();
    addToCart({
      productId: product.id,
      title: product.title,
      price: parseFloat(product.price) || 0,
      image: imgs[0] || '',
      supplierName: product.userName,
      supplierId: product.userId,
      inStock: product.inStock,
      category: product.category,
    });
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <LinearGradient
        colors={['#0A0A14', '#0F1624']}
        style={[styles.header, { paddingTop: (Platform.OS === 'web' ? webTop : insets.top) + 8 }]}
      >
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerGreet}>Mobi Marketplace</Text>
            <Text style={styles.headerSub}>Tools & Parts for Technicians</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable onPress={() => router.push('/cart')} style={styles.cartBtn}>
              <Ionicons name="cart-outline" size={22} color="#fff" />
              {totalItems > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{totalItems > 9 ? '9+' : totalItems}</Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>

        {/* SEARCH */}
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color={T.muted} style={{ marginLeft: 12 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search tools, parts, equipment..."
            placeholderTextColor={T.placeholder}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} style={{ padding: 10 }}>
              <Ionicons name="close-circle" size={18} color={T.muted} />
            </Pressable>
          )}
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.accent} />}
        contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
      >
        {/* CATEGORIES */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
          {CATEGORIES.map(cat => (
            <Pressable
              key={cat.id}
              onPress={() => { setActiveCategory(cat.id); if (Platform.OS !== 'web') Haptics.selectionAsync(); }}
              style={[styles.categoryPill, activeCategory === cat.id && { backgroundColor: cat.color, borderColor: cat.color }]}
            >
              <Ionicons name={cat.icon as any} size={15} color={activeCategory === cat.id ? '#fff' : T.muted} />
              <Text style={[styles.categoryText, activeCategory === cat.id && { color: '#fff' }]}>{cat.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {loading ? (
          <View>
            <View style={styles.sectionHeader}>
              <View style={{ width: 120, height: 16, backgroundColor: T.card, borderRadius: 4 }} />
            </View>
            <View style={styles.skeletonGrid}>
              {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
            </View>
          </View>
        ) : (
          <>
            {/* FLASH DEALS */}
            {flashDeals.length > 0 && !search && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={styles.flashBadge}>
                      <Ionicons name="flash" size={14} color="#fff" />
                    </View>
                    <Text style={styles.sectionTitle}>Flash Deals</Text>
                  </View>
                  <Pressable onPress={() => setActiveCategory('all')}>
                    <Text style={styles.seeAll}>See All</Text>
                  </Pressable>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
                  {flashDeals.map(p => (
                    <FlashDealCard key={p.id} product={p} onPress={() => router.push({ pathname: '/product-detail', params: { id: p.id } })} />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* TOP SUPPLIERS */}
            {suppliers.length > 0 && !search && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Top Suppliers</Text>
                  <Pressable>
                    <Text style={styles.seeAll}>See All</Text>
                  </Pressable>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
                  {suppliers.map(p => (
                    <Pressable
                      key={p.userId}
                      onPress={() => router.push({ pathname: '/supplier-store', params: { supplierId: p.userId } })}
                      style={styles.supplierCard}
                    >
                      {p.userAvatar ? (
                        <Image source={{ uri: p.userAvatar }} style={styles.supplierAvatar} contentFit="cover" />
                      ) : (
                        <View style={[styles.supplierAvatar, { backgroundColor: T.card, alignItems: 'center', justifyContent: 'center' }]}>
                          <Ionicons name="storefront" size={24} color={T.accent} />
                        </View>
                      )}
                      <Text style={styles.supplierCardName} numberOfLines={2}>{p.userName}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                        <Ionicons name="star" size={10} color="#F59E0B" />
                        <Text style={styles.supplierRating}>4.{(p.userId.charCodeAt(0) % 9 + 1)}</Text>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* SORT + FILTER */}
            <View style={styles.sortRow}>
              <Text style={styles.resultCount}>{sorted.length} products</Text>
              <Pressable onPress={() => setShowSort(!showSort)} style={styles.sortBtn}>
                <Ionicons name="funnel-outline" size={15} color={T.accent} />
                <Text style={styles.sortText}>Sort: {sortBy}</Text>
                <Ionicons name={showSort ? 'chevron-up' : 'chevron-down'} size={14} color={T.muted} />
              </Pressable>
            </View>

            {showSort && (
              <View style={styles.sortDropdown}>
                {SORT_OPTIONS.map(opt => (
                  <Pressable key={opt} onPress={() => { setSortBy(opt); setShowSort(false); }} style={styles.sortOption}>
                    <Text style={[styles.sortOptionText, sortBy === opt && { color: T.accent }]}>{opt}</Text>
                    {sortBy === opt && <Ionicons name="checkmark" size={16} color={T.accent} />}
                  </Pressable>
                ))}
              </View>
            )}

            {/* PRODUCTS GRID */}
            {sorted.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="cube-outline" size={56} color={T.muted} />
                <Text style={styles.emptyTitle}>No Products Found</Text>
                <Text style={styles.emptyMsg}>
                  {search ? `No results for "${search}"` : 'No products in this category yet.'}
                </Text>
              </View>
            ) : (
              <View style={styles.grid}>
                {sorted.map(p => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    onPress={() => router.push({ pathname: '/product-detail', params: { id: p.id } })}
                    onAddToCart={() => handleAddToCart(p)}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A14' },
  header: { paddingHorizontal: 16, paddingBottom: 14 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  headerGreet: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#fff' },
  headerSub: { fontSize: 12, color: T.muted, fontFamily: 'Inter_400Regular', marginTop: 2 },
  cartBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,107,44,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,107,44,0.3)' },
  cartBadge: { position: 'absolute', top: -2, right: -2, backgroundColor: T.accent, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  cartBadgeText: { color: '#fff', fontSize: 10, fontFamily: 'Inter_700Bold' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  searchInput: { flex: 1, paddingVertical: 12, paddingHorizontal: 10, color: '#fff', fontSize: 14, fontFamily: 'Inter_400Regular' },
  categoryList: { paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  categoryPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: T.card, borderWidth: 1, borderColor: T.border },
  categoryText: { color: T.muted, fontSize: 13, fontFamily: 'Inter_500Medium' },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 14 },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: T.text },
  seeAll: { fontSize: 13, color: T.accent, fontFamily: 'Inter_600SemiBold' },
  flashBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center' },
  flashCard: { width: 130, backgroundColor: T.card, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: T.border },
  flashImgWrap: { position: 'relative' },
  flashImg: { width: 130, height: 100 },
  flashDiscount: { position: 'absolute', top: 8, right: 8, backgroundColor: T.accent, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3, alignItems: 'center' },
  flashTitle: { color: T.text, fontSize: 12, fontFamily: 'Inter_500Medium', padding: 8, paddingBottom: 2 },
  flashPrice: { color: T.accent, fontSize: 14, fontFamily: 'Inter_700Bold', paddingHorizontal: 8 },
  flashOriginal: { color: T.muted, fontSize: 11, textDecorationLine: 'line-through', paddingHorizontal: 8, paddingBottom: 8 },
  supplierCard: { width: 90, alignItems: 'center', gap: 6 },
  supplierAvatar: { width: 70, height: 70, borderRadius: 35, borderWidth: 2, borderColor: T.accent },
  supplierCardName: { color: T.text, fontSize: 11, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  supplierRating: { color: T.muted, fontSize: 10, fontFamily: 'Inter_400Regular' },
  sortRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  resultCount: { color: T.muted, fontSize: 13, fontFamily: 'Inter_400Regular' },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.card, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: T.border },
  sortText: { color: T.text, fontSize: 13, fontFamily: 'Inter_500Medium' },
  sortDropdown: { marginHorizontal: 16, backgroundColor: T.card, borderRadius: 12, borderWidth: 1, borderColor: T.border, overflow: 'hidden', marginBottom: 8 },
  sortOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: T.border },
  sortOptionText: { color: T.text, fontSize: 14, fontFamily: 'Inter_500Medium' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 16 },
  card: { backgroundColor: T.card, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: T.border },
  cardImgWrap: { position: 'relative' },
  cardImg: { width: '100%', height: 150 },
  cardImgPlaceholder: { backgroundColor: T.cardSurface, alignItems: 'center', justifyContent: 'center' },
  discountBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: '#EF4444', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  discountText: { color: '#fff', fontSize: 10, fontFamily: 'Inter_700Bold' },
  outOfStockOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: 10 },
  cardTitle: { color: T.text, fontSize: 13, fontFamily: 'Inter_500Medium', lineHeight: 18 },
  reviewCount: { color: T.muted, fontSize: 10, fontFamily: 'Inter_400Regular' },
  price: { color: T.accent, fontSize: 16, fontFamily: 'Inter_700Bold' },
  originalPrice: { color: T.muted, fontSize: 12, fontFamily: 'Inter_400Regular', textDecorationLine: 'line-through' },
  supplierRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  supplierName: { color: T.muted, fontSize: 11, fontFamily: 'Inter_400Regular', flex: 1 },
  addBtn: { marginTop: 10, backgroundColor: T.accent, borderRadius: 10, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  addBtnActive: { backgroundColor: T.green },
  addBtnText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyTitle: { color: T.text, fontSize: 18, fontFamily: 'Inter_700Bold', marginTop: 16 },
  emptyMsg: { color: T.muted, fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 8 },
  skeleton: { backgroundColor: T.card, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: T.border },
  skeletonImg: { width: '100%', height: 150, backgroundColor: T.cardSurface },
  skeletonLine: { height: 12, backgroundColor: T.cardSurface, borderRadius: 6, width: '80%' },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 16 },
});
