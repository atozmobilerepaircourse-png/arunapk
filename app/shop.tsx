import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, FlatList, ScrollView,
  Platform, ActivityIndicator, RefreshControl, Modal, Switch,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useCart } from '@/lib/cart-context';
import { getApiUrl } from '@/lib/query-client';

// ─── MarketHub Design Tokens ──────────────────────────────────────────────────
const MH = {
  primary: '#1B4D3E',
  primaryMid: '#2D6A4F',
  primaryLight: '#D1FAE5',
  accent: '#10B981',
  bg: '#F9FAFB',
  surface: '#FFFFFF',
  border: '#E5E7EB',
  borderDark: '#D1D5DB',
  text: '#111827',
  textSub: '#4B5563',
  textMuted: '#9CA3AF',
  sale: '#DC2626',
  saleBg: '#FEF2F2',
  new: '#2563EB',
  newBg: '#EFF6FF',
  star: '#F59E0B',
  outOfStock: '#6B7280',
  outOfStockBg: '#F3F4F6',
  cartBtn: '#1B4D3E',
  radius: 12,
  radiusSm: 8,
  shadow: {
    shadowColor: '#000', shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 3,
  },
};

const CATEGORIES = [
  { key: 'all', label: 'All Results', icon: 'grid-outline' },
  { key: 'spare_part', label: 'Spare Parts', icon: 'hardware-chip-outline' },
  { key: 'tool', label: 'Tools', icon: 'construct-outline' },
  { key: 'component', label: 'Components', icon: 'flash-outline' },
  { key: 'accessory', label: 'Accessories', icon: 'headset-outline' },
  { key: 'other', label: 'Other', icon: 'cube-outline' },
];

const SORT_OPTIONS = [
  { key: 'recommended', label: 'Recommended' },
  { key: 'price_asc', label: 'Price: Low to High' },
  { key: 'price_desc', label: 'Price: High to Low' },
  { key: 'newest', label: 'Newest Arrivals' },
  { key: 'rating', label: 'Customer Rating' },
];

function StarRating({ rating, count }: { rating: number; count?: number }) {
  const stars = Math.round(rating);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <Ionicons key={i} name={i <= stars ? 'star' : 'star-outline'} size={11} color={MH.star} />
      ))}
      {count !== undefined && (
        <Text style={{ fontSize: 11, color: MH.textMuted, marginLeft: 2 }}>({count})</Text>
      )}
    </View>
  );
}

function ProductCard({ product, onAddToCart, onPress }: {
  product: any;
  onAddToCart: () => void;
  onPress: () => void;
}) {
  const images = (() => {
    // If already an array, return it
    if (Array.isArray(product.images)) {
      return product.images.filter((url: any) => typeof url === 'string' && url.length > 0);
    }
    // Try JSON parsing if it's a string
    if (typeof product.images === 'string') {
      try {
        const parsed = JSON.parse(product.images);
        return Array.isArray(parsed) ? parsed.filter((url: any) => typeof url === 'string' && url.length > 0) : [];
      } catch {
        // Fallback: comma-separated string
        if (product.images.includes(',')) {
          return product.images.split(',').filter((url: string) => url.trim().length > 0);
        }
        return product.images.trim().length > 0 ? [product.images.trim()] : [];
      }
    }
    return [];
  })();
  const img = images[0];
  const isOutOfStock = product.inStock === 0;
  const price = parseFloat(product.price || '0');
  const rating = 4.5;
  const reviewCount = Math.floor(Math.random() * 200) + 10;
  const isNew = Date.now() - (product.createdAt || 0) < 7 * 24 * 3600 * 1000;
  const isOnSale = product.originalPrice && parseFloat(product.originalPrice) > price;

  return (
    <Pressable onPress={onPress} style={styles.productCard}>
      {/* Badge */}
      {isOnSale && !isOutOfStock && (
        <View style={[styles.badge, { backgroundColor: MH.sale }]}>
          <Text style={styles.badgeText}>SALE</Text>
        </View>
      )}
      {isNew && !isOnSale && !isOutOfStock && (
        <View style={[styles.badge, { backgroundColor: MH.new }]}>
          <Text style={styles.badgeText}>NEW</Text>
        </View>
      )}
      {isOutOfStock && (
        <View style={[styles.badge, { backgroundColor: MH.outOfStock }]}>
          <Text style={styles.badgeText}>OUT OF STOCK</Text>
        </View>
      )}

      {/* Wishlist */}
      <Pressable style={styles.wishlistBtn} onPress={() => {}}>
        <Ionicons name="heart-outline" size={16} color={MH.textMuted} />
      </Pressable>

      {/* Product Image */}
      <View style={styles.productImgContainer}>
        {img ? (
          <Image source={{ uri: img }} style={styles.productImg} contentFit="contain" />
        ) : (
          <View style={[styles.productImg, styles.productImgPlaceholder]}>
            <Ionicons name="cube-outline" size={36} color={MH.textMuted} />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.productInfo}>
        <StarRating rating={rating} count={reviewCount} />
        <Text style={styles.productName} numberOfLines={2}>{product.title}</Text>
        <Text style={styles.productSupplier} numberOfLines={1}>
          {product.userName} • {product.city || 'India'}
        </Text>
        <View style={styles.productPriceRow}>
          <View>
            {isOnSale && (
              <Text style={styles.productOldPrice}>₹{parseFloat(product.originalPrice).toLocaleString('en-IN')}</Text>
            )}
            <Text style={styles.productPrice}>₹{price.toLocaleString('en-IN')}</Text>
          </View>
          {!isOutOfStock ? (
            <Pressable
              onPress={(e) => { e.stopPropagation?.(); onAddToCart(); }}
              style={styles.addBtn}
            >
              <Ionicons name="add" size={18} color="#FFF" />
            </Pressable>
          ) : (
            <Pressable style={[styles.addBtn, styles.addBtnDisabled]} disabled>
              <Ionicons name="notifications-outline" size={15} color={MH.textMuted} />
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export default function ShopScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ supplierId?: string; supplierName?: string }>();
  const { items, addToCart, updateQuantity } = useCart();
  const cartCount = items.reduce((s, i) => s + i.quantity, 0);

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [sortBy, setSortBy] = useState('recommended');
  const [showSort, setShowSort] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [freeDelivery, setFreeDelivery] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const qKey = params.supplierId
    ? ['/api/products', { userId: params.supplierId }]
    : ['/api/products'];

  const apiUrl = params.supplierId
    ? new URL(`/api/products?userId=${params.supplierId}`, getApiUrl()).toString()
    : new URL('/api/products', getApiUrl()).toString();

  const { data: rawProducts = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: qKey,
    queryFn: async () => {
      const r = await fetch(apiUrl);
      return r.json();
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const products = useMemo(() => {
    let list = [...rawProducts];
    // Filter by category
    if (activeCategory !== 'all') list = list.filter(p => p.category === activeCategory);
    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.title?.toLowerCase().includes(q) ||
        p.userName?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
      );
    }
    // Filter free delivery (all items have free delivery in this app)
    // Sort
    if (sortBy === 'price_asc') list.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
    else if (sortBy === 'price_desc') list.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
    else if (sortBy === 'newest') list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return list;
  }, [rawProducts, activeCategory, search, sortBy]);

  const handleAddToCart = useCallback((product: any) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const images = (() => { try { return JSON.parse(product.images || '[]'); } catch { return []; } })();
    const existing = items.find(i => i.productId === product.id);
    if (existing) {
      updateQuantity(product.id, existing.quantity + 1);
    } else {
      addToCart({
        productId: product.id,
        title: product.title,
        price: parseFloat(product.price || '0'),
        image: images[0] || '',
        supplierName: product.userName,
        supplierId: product.userId,
        category: product.category,
        inStock: product.inStock ?? 1,
      });
    }
  }, [items, addToCart, updateQuantity]);

  const cartQty = useCallback((productId: string) => {
    return items.find(i => i.productId === productId)?.quantity || 0;
  }, [items]);

  const title = params.supplierName
    ? `${params.supplierName}'s Shop`
    : 'Marketplace';

  return (
    <View style={styles.container}>
      {/* ── Top Header ── */}
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={MH.primary} />
          </Pressable>
          <View style={styles.headerLogo}>
            <View style={styles.logoIcon}>
              <Ionicons name="storefront" size={18} color="#FFF" />
            </View>
            <Text style={styles.logoText} numberOfLines={1}>{title}</Text>
          </View>
          <Pressable onPress={() => router.push('/cart' as any)} style={styles.cartBtn}>
            <Ionicons name="bag-outline" size={22} color={MH.primary} />
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount > 9 ? '9+' : cartCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={MH.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={params.supplierId ? 'Search products...' : 'Search products, suppliers...'}
            placeholderTextColor={MH.textMuted}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={MH.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Category Tabs ── */}
      <View style={styles.categoryBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
          {CATEGORIES.map(cat => (
            <Pressable
              key={cat.key}
              onPress={() => setActiveCategory(cat.key)}
              style={[styles.catChip, activeCategory === cat.key && styles.catChipActive]}
            >
              <Text style={[styles.catLabel, activeCategory === cat.key && styles.catLabelActive]}>
                {cat.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* ── Results Bar ── */}
      <View style={styles.resultsBar}>
        <Text style={styles.resultsCount}>
          {isLoading ? 'Loading...' : `Showing ${products.length} ${products.length === 1 ? 'result' : 'results'}`}
          {search.trim() ? ` for "${search}"` : ''}
        </Text>
        <View style={styles.resultsActions}>
          <Pressable onPress={() => setShowFilters(true)} style={styles.filterBtn}>
            <Ionicons name="options-outline" size={16} color={MH.textSub} />
            <Text style={styles.filterBtnText}>Filters</Text>
          </Pressable>
          <Pressable onPress={() => setShowSort(true)} style={styles.sortBtn}>
            <Text style={styles.sortBtnText}>
              Sort: {SORT_OPTIONS.find(s => s.key === sortBy)?.label?.split(':')[0] || 'Sort'}
            </Text>
            <Ionicons name="chevron-down" size={14} color={MH.textSub} />
          </Pressable>
        </View>
      </View>

      {/* ── Product Grid ── */}
      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={MH.primary} />
          <Text style={styles.loadingText}>Loading products...</Text>
        </View>
      ) : products.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="search-outline" size={40} color={MH.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No products found</Text>
          <Text style={styles.emptySub}>
            {search ? `No results for "${search}". Try a different search.` : 'No products available in this category yet.'}
          </Text>
          {search && (
            <Pressable onPress={() => setSearch('')} style={styles.clearSearchBtn}>
              <Text style={styles.clearSearchText}>Clear Search</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={p => p.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={[styles.grid, { paddingBottom: bottomInset + 80 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={MH.primary} colors={[MH.primary]} />
          }
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              onAddToCart={() => handleAddToCart(item)}
              onPress={() => router.push({ pathname: '/product-detail', params: { productId: item.id } } as any)}
            />
          )}
        />
      )}

      {/* ── Cart Action Bar ── */}
      {cartCount > 0 && (
        <Pressable
          onPress={() => router.push('/cart' as any)}
          style={[styles.cartBar, { paddingBottom: Math.max(bottomInset, 16) }]}
        >
          <View style={styles.cartBarLeft}>
            <View style={styles.cartBarBadge}>
              <Text style={styles.cartBarBadgeText}>{cartCount}</Text>
            </View>
            <Text style={styles.cartBarText}>{cartCount} {cartCount === 1 ? 'item' : 'items'} in cart</Text>
          </View>
          <View style={styles.cartBarRight}>
            <Text style={styles.cartBarAction}>View Cart</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFF" />
          </View>
        </Pressable>
      )}

      {/* ── Sort Modal ── */}
      <Modal visible={showSort} transparent animationType="slide" onRequestClose={() => setShowSort(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowSort(false)}>
          <View style={[styles.modalSheet, { paddingBottom: bottomInset + 16 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Sort By</Text>
            {SORT_OPTIONS.map(opt => (
              <Pressable
                key={opt.key}
                onPress={() => { setSortBy(opt.key); setShowSort(false); }}
                style={styles.sortOption}
              >
                <Text style={[styles.sortOptionText, sortBy === opt.key && { color: MH.primary, fontFamily: 'Inter_600SemiBold' }]}>
                  {opt.label}
                </Text>
                {sortBy === opt.key && <Ionicons name="checkmark" size={18} color={MH.primary} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* ── Filters Modal ── */}
      <Modal visible={showFilters} transparent animationType="slide" onRequestClose={() => setShowFilters(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowFilters(false)}>
          <View style={[styles.modalSheet, { paddingBottom: bottomInset + 16 }]}>
            <View style={styles.modalHandle} />
            <View style={styles.filterHeader}>
              <Text style={styles.modalTitle}>Filters</Text>
              <Pressable onPress={() => { setFreeDelivery(false); setShowFilters(false); }}>
                <Text style={{ color: MH.primary, fontFamily: 'Inter_500Medium', fontSize: 14 }}>Reset</Text>
              </Pressable>
            </View>

            <Text style={styles.filterSectionTitle}>Delivery</Text>
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>Free Delivery</Text>
              <Switch
                value={freeDelivery}
                onValueChange={setFreeDelivery}
                trackColor={{ false: MH.border, true: MH.primary }}
                thumbColor="#FFF"
              />
            </View>

            <Text style={styles.filterSectionTitle}>Availability</Text>
            {['In Stock', 'All Items'].map(opt => (
              <Pressable key={opt} style={styles.filterOption}>
                <View style={styles.filterCheckbox}>
                  {opt === 'In Stock' && <Ionicons name="checkmark" size={13} color={MH.primary} />}
                </View>
                <Text style={styles.filterLabel}>{opt}</Text>
              </Pressable>
            ))}

            <Pressable onPress={() => setShowFilters(false)} style={styles.applyFilterBtn}>
              <Text style={styles.applyFilterText}>Apply Filters</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const CARD_WIDTH = '48%';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: MH.bg },

  // Header
  header: { backgroundColor: MH.surface, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: MH.border },
  headerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: MH.primaryLight, alignItems: 'center', justifyContent: 'center' },
  headerLogo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: MH.primary, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: MH.primary, flex: 1 },
  cartBtn: { position: 'relative', width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  cartBadge: { position: 'absolute', top: 2, right: 2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: MH.sale, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  cartBadgeText: { color: '#FFF', fontSize: 10, fontFamily: 'Inter_700Bold' },

  // Search
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: MH.bg, borderRadius: MH.radius, borderWidth: 1, borderColor: MH.border, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 14, color: MH.text, fontFamily: 'Inter_400Regular', padding: 0 },

  // Categories
  categoryBar: { backgroundColor: MH.surface, borderBottomWidth: 1, borderBottomColor: MH.border },
  categoryScroll: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  catChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: MH.border, backgroundColor: MH.surface },
  catChipActive: { backgroundColor: MH.primary, borderColor: MH.primary },
  catLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', color: MH.textSub },
  catLabelActive: { color: '#FFF', fontFamily: 'Inter_600SemiBold' },

  // Results bar
  resultsBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: MH.surface, borderBottomWidth: 1, borderBottomColor: MH.border },
  resultsCount: { fontSize: 13, color: MH.textMuted, fontFamily: 'Inter_400Regular', flex: 1 },
  resultsActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: MH.border },
  filterBtnText: { fontSize: 13, color: MH.textSub, fontFamily: 'Inter_500Medium' },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sortBtnText: { fontSize: 13, color: MH.textSub, fontFamily: 'Inter_500Medium' },

  // Grid
  grid: { padding: 12, gap: 10 },
  gridRow: { gap: 10, justifyContent: 'space-between' },

  // Product Card
  productCard: { width: CARD_WIDTH, backgroundColor: MH.surface, borderRadius: MH.radius, overflow: 'hidden', borderWidth: 1, borderColor: MH.border, ...({ shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 3 } as any) },
  badge: { position: 'absolute', top: 8, left: 8, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, zIndex: 2 },
  badgeText: { color: '#FFF', fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 0.3 },
  wishlistBtn: { position: 'absolute', top: 8, right: 8, zIndex: 2, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  productImgContainer: { width: '100%', height: 130, backgroundColor: MH.bg, alignItems: 'center', justifyContent: 'center' },
  productImg: { width: '100%', height: '100%' },
  productImgPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: MH.bg },
  productInfo: { padding: 10, gap: 3 },
  productName: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: MH.text, lineHeight: 18, marginTop: 2 },
  productSupplier: { fontSize: 11, color: MH.textMuted, fontFamily: 'Inter_400Regular' },
  productPriceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  productOldPrice: { fontSize: 11, color: MH.textMuted, textDecorationLine: 'line-through', fontFamily: 'Inter_400Regular' },
  productPrice: { fontSize: 16, fontFamily: 'Inter_700Bold', color: MH.text },
  addBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: MH.primary, alignItems: 'center', justifyContent: 'center' },
  addBtnDisabled: { backgroundColor: MH.bg, borderWidth: 1, borderColor: MH.border },

  // States
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: MH.textMuted, fontFamily: 'Inter_400Regular', fontSize: 14 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingTop: 40 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: MH.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: MH.text },
  emptySub: { fontSize: 14, color: MH.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 20, fontFamily: 'Inter_400Regular' },
  clearSearchBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: MH.primary },
  clearSearchText: { color: MH.primary, fontFamily: 'Inter_600SemiBold', fontSize: 14 },

  // Cart Bar
  cartBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: MH.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 14 },
  cartBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cartBarBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  cartBarBadgeText: { color: '#FFF', fontSize: 13, fontFamily: 'Inter_700Bold' },
  cartBarText: { color: '#FFF', fontSize: 14, fontFamily: 'Inter_500Medium' },
  cartBarRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cartBarAction: { color: '#FFF', fontSize: 14, fontFamily: 'Inter_700Bold' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: MH.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingTop: 12 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: MH.border, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: MH.text, marginBottom: 16 },
  sortOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: MH.bg },
  sortOptionText: { fontSize: 15, fontFamily: 'Inter_400Regular', color: MH.textSub },
  filterHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  filterSectionTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: MH.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12, marginTop: 8 },
  filterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  filterLabel: { fontSize: 14, color: MH.text, fontFamily: 'Inter_400Regular' },
  filterOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  filterCheckbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: MH.primary, alignItems: 'center', justifyContent: 'center', backgroundColor: MH.primaryLight },
  applyFilterBtn: { backgroundColor: MH.primary, borderRadius: MH.radius, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  applyFilterText: { color: '#FFF', fontFamily: 'Inter_700Bold', fontSize: 16 },
});
