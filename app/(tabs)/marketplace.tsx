import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, FlatList,
  ActivityIndicator, Dimensions, RefreshControl, Platform, Animated, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useApp } from '@/lib/context';
import { useCart } from '@/lib/cart-context';
import { apiRequest } from '@/lib/query-client';
import { T } from '@/constants/techTheme';

const { width } = Dimensions.get('window');
const CARD_W = (width - 48) / 2;
const webTop = Platform.OS === 'web' ? 67 : 0;

const CATEGORIES = [
  { id: 'all', label: 'All', icon: 'apps-outline' as const },
  { id: 'spare-parts', label: 'Spare Parts', icon: 'construct-outline' as const },
  { id: 'tools', label: 'Tools', icon: 'hammer-outline' as const },
  { id: 'equipment', label: 'Equipment', icon: 'hardware-chip-outline' as const },
  { id: 'accessories', label: 'Accessories', icon: 'flash-outline' as const },
  { id: 'materials', label: 'Materials', icon: 'layers-outline' as const },
  { id: 'software', label: 'Software', icon: 'code-slash-outline' as const },
];

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

function ProductCard({ product, onPress, onAddToCart }: { product: Product; onPress: () => void; onAddToCart: () => void }) {
  const { isInCart, getQuantity } = useCart();
  const imgs = (() => { try { return JSON.parse(product.images); } catch { return []; } })();
  const img = imgs[0] || '';
  const price = parseFloat(product.price) || 0;
  const inCart = isInCart(product.id);
  const qty = getQuantity(product.id);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }], width: CARD_W }}>
      <Pressable onPress={handlePress} style={styles.card}>
        <View style={styles.cardImgWrap}>
          {img ? (
            <Image source={{ uri: img }} style={styles.cardImg} contentFit="cover" />
          ) : (
            <View style={[styles.cardImg, styles.noImg]}>
              <Ionicons name="cube-outline" size={32} color={T.muted} />
            </View>
          )}
          {product.inStock === 0 && (
            <View style={styles.outOfStock}>
              <Text style={styles.outOfStockTxt}>Out of Stock</Text>
            </View>
          )}
          {inCart && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeTxt}>{qty}</Text>
            </View>
          )}
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>{product.title}</Text>
          <Text style={styles.cardSeller} numberOfLines={1}>
            <Ionicons name="storefront-outline" size={10} color={T.muted} /> {product.userName}
          </Text>
          <View style={styles.cardFooter}>
            <Text style={styles.cardPrice}>₹{price.toLocaleString('en-IN')}</Text>
            {product.inStock > 0 && (
              <Pressable
                onPress={(e) => { e.stopPropagation(); onAddToCart(); }}
                style={[styles.addBtn, inCart && styles.addBtnActive]}
              >
                <Ionicons name={inCart ? 'checkmark' : 'add'} size={14} color="#FFF" />
              </Pressable>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function CategoryChip({ category, selected, onPress }: { category: typeof CATEGORIES[0]; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipActive]}>
      <Ionicons name={category.icon} size={13} color={selected ? '#FFF' : T.muted} />
      <Text style={[styles.chipLabel, selected && styles.chipLabelActive]}>{category.label}</Text>
    </Pressable>
  );
}

export default function MarketplaceScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useApp();
  const { addToCart, items: cartItems } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'priceAsc' | 'priceDesc'>('newest');
  const totalCartItems = cartItems.reduce((s, i) => s + i.quantity, 0);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await apiRequest('GET', '/api/products');
      const data = await res.json();
      if (Array.isArray(data)) setProducts(data);
    } catch (e) {
      console.error('[Marketplace] fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProducts(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProducts();
    setRefreshing(false);
  };

  const handleAddToCart = (product: Product) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

  const filtered = products
    .filter(p => {
      const matchCat = activeCategory === 'all' || p.category === activeCategory;
      const q = search.toLowerCase().trim();
      const matchSearch = !q || p.title.toLowerCase().includes(q) || (p.userName || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
      return matchCat && matchSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'priceAsc') return parseFloat(a.price) - parseFloat(b.price);
      if (sortBy === 'priceDesc') return parseFloat(b.price) - parseFloat(a.price);
      return b.createdAt - a.createdAt;
    });

  const topInset = Platform.OS === 'web' ? webTop : insets.top;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Marketplace</Text>
            <Text style={styles.headerSub}>{products.length} products available</Text>
          </View>
          <Pressable onPress={() => router.push('/cart' as any)} style={styles.cartBtn}>
            <Ionicons name="bag-outline" size={22} color={T.text} />
            {totalCartItems > 0 && (
              <View style={styles.cartCount}>
                <Text style={styles.cartCountTxt}>{totalCartItems > 9 ? '9+' : totalCartItems}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={16} color={T.muted} style={{ marginLeft: 12 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products, suppliers..."
            placeholderTextColor={T.placeholder}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} style={{ marginRight: 10 }}>
              <Ionicons name="close-circle" size={16} color={T.muted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
        style={styles.chipsScroll}
      >
        {CATEGORIES.map(cat => (
          <CategoryChip
            key={cat.id}
            category={cat}
            selected={activeCategory === cat.id}
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.selectionAsync();
              setActiveCategory(cat.id);
            }}
          />
        ))}
      </ScrollView>

      {/* Sort row */}
      <View style={styles.sortRow}>
        <Text style={styles.resultsCount}>{filtered.length} results</Text>
        <View style={styles.sortBtns}>
          {([['newest', 'New'], ['priceAsc', '↑ Price'], ['priceDesc', '↓ Price']] as const).map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => setSortBy(key)}
              style={[styles.sortBtn, sortBy === key && styles.sortBtnActive]}
            >
              <Text style={[styles.sortBtnTxt, sortBy === key && styles.sortBtnTxtActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Products grid */}
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={T.accent} />
          <Text style={styles.loadingTxt}>Loading products...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.accent} />}
          ListHeaderComponent={
            <Pressable
              onPress={() => router.push('/shop' as any)}
              style={styles.shopBanner}
            >
              <View style={styles.shopBannerIcon}>
                <Ionicons name="storefront" size={28} color="#FFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.shopBannerTitle}>MarketHub Store</Text>
                <Text style={styles.shopBannerSub}>Browse full catalog · Search · Filter</Text>
              </View>
              <View style={styles.shopBannerArrow}>
                <Ionicons name="arrow-forward" size={18} color="#FFF" />
              </View>
            </Pressable>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={56} color={T.muted} />
              <Text style={styles.emptyTitle}>No products found</Text>
              <Text style={styles.emptySub}>
                {search ? 'Try a different search term' : 'Check back later for new products'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              onPress={() => router.push({ pathname: '/product-detail', params: { id: item.id } } as any)}
              onAddToCart={() => handleAddToCart(item)}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  header: { backgroundColor: T.bgElevated, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: T.border },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  headerTitle: { fontSize: 24, fontFamily: 'Inter_700Bold', color: T.text },
  headerSub: { fontSize: 12, color: T.muted, fontFamily: 'Inter_400Regular', marginTop: 2 },
  cartBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: T.card, alignItems: 'center', justifyContent: 'center' },
  cartCount: { position: 'absolute', top: -4, right: -4, backgroundColor: T.accent, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  cartCountTxt: { color: '#FFF', fontSize: 10, fontFamily: 'Inter_700Bold' },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.card, borderRadius: 12, borderWidth: 1, borderColor: T.border },
  searchInput: { flex: 1, height: 42, color: T.text, fontFamily: 'Inter_400Regular', fontSize: 14, paddingHorizontal: 10 },
  chipsScroll: { backgroundColor: T.bgElevated, flexGrow: 0 },
  chipsRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: T.card, borderWidth: 1, borderColor: T.border },
  chipActive: { backgroundColor: T.accent, borderColor: T.accent },
  chipLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', color: T.muted },
  chipLabelActive: { color: '#FFF' },
  sortRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: T.bg },
  resultsCount: { fontSize: 12, color: T.muted, fontFamily: 'Inter_400Regular' },
  sortBtns: { flexDirection: 'row', gap: 6 },
  sortBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: T.border },
  sortBtnActive: { backgroundColor: T.accentMuted, borderColor: T.accent },
  sortBtnTxt: { fontSize: 11, color: T.muted, fontFamily: 'Inter_500Medium' },
  sortBtnTxtActive: { color: T.accent },
  grid: { padding: 16, paddingBottom: Platform.OS === 'web' ? 100 : 80 },
  row: { gap: 16, marginBottom: 16 },
  card: { backgroundColor: T.card, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: T.border },
  cardImgWrap: { position: 'relative' },
  cardImg: { width: '100%', height: CARD_W * 0.8, backgroundColor: T.cardSurface },
  noImg: { alignItems: 'center', justifyContent: 'center' },
  outOfStock: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
  outOfStockTxt: { color: '#FFF', fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  cartBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: T.accent, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cartBadgeTxt: { color: '#FFF', fontSize: 10, fontFamily: 'Inter_700Bold' },
  cardBody: { padding: 10 },
  cardTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: T.text, lineHeight: 18 },
  cardSeller: { fontSize: 11, color: T.muted, fontFamily: 'Inter_400Regular', marginTop: 4 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  cardPrice: { fontSize: 15, fontFamily: 'Inter_700Bold', color: T.accent },
  addBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center' },
  addBtnActive: { backgroundColor: T.green },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingTxt: { color: T.muted, fontFamily: 'Inter_400Regular', fontSize: 14 },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: T.text, marginTop: 16 },
  emptySub: { fontSize: 14, color: T.muted, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 8 },
  shopBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1B4D3E', borderRadius: 16, padding: 16, marginBottom: 16, gap: 12 },
  shopBannerIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  shopBannerTitle: { color: '#FFF', fontFamily: 'Inter_700Bold', fontSize: 16 },
  shopBannerSub: { color: 'rgba(255,255,255,0.75)', fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
  shopBannerArrow: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
});
