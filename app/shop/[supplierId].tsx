import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform,
  ActivityIndicator, FlatList, RefreshControl,
  Dimensions, TextInput, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useApp } from '@/lib/context';
import { useCart } from '@/lib/cart-context';
import { apiRequest, getApiUrl } from '@/lib/query-client';

const { width } = Dimensions.get('window');
const CARD_W = (width - 36) / 2;
const webTop = Platform.OS === 'web' ? 67 : 0;

const GREEN = '#0B4A45';
const GREEN_LIGHT = '#E6F4F1';
const ORANGE = '#C74A27';
const ORANGE_LIGHT = '#FDECE8';

function getImgUri(img: string) {
  if (!img) return '';
  if (img.startsWith('http')) return img;
  if (img.startsWith('/')) return `${getApiUrl()}${img}`;
  return img;
}

function getProductImages(product: any): string[] {
  try {
    if (Array.isArray(product.images)) return product.images;
    const parsed = JSON.parse(product.images || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    if (typeof product.images === 'string' && product.images.length > 0) {
      return product.images.includes(',')
        ? product.images.split(',').filter((u: string) => u.trim())
        : [product.images.trim()];
    }
    return [];
  }
}

function formatPrice(p: any) {
  const n = parseFloat(p) || 0;
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function ShopPage() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ supplierId: string; supplierName?: string }>();
  const supplierId = params.supplierId;
  const { profile: myProfile, startConversation } = useApp();
  const { addToCart, isInCart } = useCart();

  const [supplier, setSupplier] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('All');

  const fetchData = useCallback(async () => {
    try {
      const [profRes, prodRes] = await Promise.all([
        apiRequest('GET', `/api/profiles/${supplierId}`),
        apiRequest('GET', `/api/products?supplierId=${supplierId}`),
      ]);
      const profData = await profRes.json();
      const prodData = await prodRes.json();
      if (profData?.id) setSupplier(profData);
      const list = Array.isArray(prodData) ? prodData : [];
      setProducts(list);
      setFiltered(list);
    } catch (e) {
      console.error('[ShopPage] fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [supplierId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    let list = products;
    if (selectedCat !== 'All') {
      list = list.filter(p => (p.category || '').toLowerCase() === selectedCat.toLowerCase());
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => (p.title || '').toLowerCase().includes(q));
    }
    setFiltered(list);
  }, [search, selectedCat, products]);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchData(); }, [fetchData]);

  const handleAddToCart = (item: any) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const imgs = getProductImages(item);
    addToCart({
      productId: item.id,
      title: item.title,
      price: parseFloat(item.price) || 0,
      image: imgs[0] ? getImgUri(imgs[0]) : '',
      supplierName: item.userName,
      supplierId: item.userId,
      inStock: item.inStock,
      category: item.category,
    });
  };

  const handleMessage = async () => {
    if (!myProfile || !supplier) return;
    const convoId = await startConversation(supplier.id, supplier.name, supplier.role);
    if (convoId) router.push({ pathname: '/chat/[id]', params: { id: convoId } });
  };

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];

  const shopName = supplier?.shopName || supplier?.name || params.supplierName || 'Shop';
  const initials = shopName.charAt(0).toUpperCase();
  const totalProducts = products.length;
  const totalViews = products.reduce((s: number, p: any) => s + (p.views || 0), 0);

  const renderProduct = ({ item }: { item: any }) => {
    const imgs = getProductImages(item);
    const imgUri = imgs[0] ? getImgUri(imgs[0]) : null;
    const price = parseFloat(item.price) || 0;
    const mrp = parseFloat(item.mrp) || 0;
    const discount = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
    const inCart = isInCart(item.id);

    return (
      <Pressable
        style={styles.productCard}
        onPress={() => router.push({ pathname: '/product-detail', params: { id: item.id } } as any)}
      >
        <View style={styles.imgWrap}>
          {discount > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>-{discount}%</Text>
            </View>
          )}
          {item.category === 'digital' || item.category === 'Digital' ? (
            <View style={styles.digitalBadge}>
              <Text style={styles.digitalText}>DIGITAL</Text>
            </View>
          ) : null}
          <Pressable style={styles.eyeBtn} onPress={() => router.push({ pathname: '/product-detail', params: { id: item.id } } as any)}>
            <Ionicons name="eye-outline" size={16} color="#666" />
          </Pressable>
          {imgUri ? (
            <Image
              source={{ uri: imgUri }}
              style={styles.productImg}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.productImg, styles.noImg]}>
              <Ionicons name="cube-outline" size={40} color="#CCC" />
            </View>
          )}
          <Pressable
            style={[styles.cartIconBtn, inCart && styles.cartIconBtnActive]}
            onPress={() => handleAddToCart(item)}
          >
            <Ionicons name={inCart ? 'cart' : 'cart-outline'} size={18} color={inCart ? '#fff' : GREEN} />
          </Pressable>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.productTitle} numberOfLines={2}>{item.title}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatPrice(item.price)}</Text>
            {mrp > price && (
              <Text style={styles.mrp}>{formatPrice(item.mrp)}</Text>
            )}
          </View>
          <Pressable
            style={[styles.addBtn, inCart && styles.addBtnActive]}
            onPress={() => handleAddToCart(item)}
          >
            <Ionicons name="cart-outline" size={14} color="#fff" />
            <Text style={styles.addBtnText}>{inCart ? 'Added' : 'ADD TO CART'}</Text>
          </Pressable>
        </View>
      </Pressable>
    );
  };

  const ListHeader = () => (
    <View>
      {/* Shop Banner */}
      <View style={styles.banner}>
        <View style={styles.bannerContent}>
          <View style={styles.shopAvatar}>
            {supplier?.avatar ? (
              <Image source={{ uri: getImgUri(supplier.avatar) }} style={styles.avatarImg} contentFit="cover" />
            ) : (
              <Text style={styles.avatarInitial}>{initials}</Text>
            )}
          </View>
          <View style={styles.shopInfo}>
            <Text style={styles.shopName}>{shopName}</Text>
            {supplier?.city || supplier?.state ? (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.8)" />
                <Text style={styles.locationText}>
                  {[supplier.city, supplier.state].filter(Boolean).join(', ')}
                </Text>
              </View>
            ) : null}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{totalProducts}</Text>
                <Text style={styles.statLabel}>Products</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{totalViews}</Text>
                <Text style={styles.statLabel}>Views</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Ionicons name="checkmark-circle" size={14} color="#4ADE80" />
                <Text style={styles.statLabel}>Verified</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          {supplier?.phone && (
            <Pressable
              style={styles.callBtn}
              onPress={() => require('react-native').Linking.openURL(`tel:${supplier.phone}`)}
            >
              <Ionicons name="call-outline" size={16} color={GREEN} />
              <Text style={styles.callBtnText}>Call</Text>
            </Pressable>
          )}
          {myProfile?.id !== supplierId && (
            <Pressable style={styles.msgBtn} onPress={handleMessage}>
              <Ionicons name="chatbubble-outline" size={16} color="#fff" />
              <Text style={styles.msgBtnText}>Message</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color="#999" style={{ marginLeft: 12 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search products..."
          placeholderTextColor="#999"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} style={{ paddingRight: 12 }}>
            <Ionicons name="close-circle" size={18} color="#999" />
          </Pressable>
        )}
      </View>

      {/* Category Tabs */}
      {categories.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
          {categories.map(cat => (
            <Pressable
              key={cat}
              style={[styles.catChip, selectedCat === cat && styles.catChipActive]}
              onPress={() => setSelectedCat(cat)}
            >
              <Text style={[styles.catChipText, selectedCat === cat && styles.catChipTextActive]}>{cat}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Products heading */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {selectedCat === 'All' ? 'All Products' : selectedCat} ({filtered.length})
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTop }]}>
        <View style={styles.headerBar}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#111" />
          </Pressable>
          <Text style={styles.headerTitle}>Shop</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={GREEN} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTop }]}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#111" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{shopName}</Text>
        <Pressable onPress={() => router.push('/cart' as any)} style={styles.cartBtn}>
          <Ionicons name="cart-outline" size={22} color={GREEN} />
        </Pressable>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        renderItem={renderProduct}
        ListHeaderComponent={<ListHeader />}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GREEN} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="storefront-outline" size={56} color="#DDD" />
            <Text style={styles.emptyTitle}>No Products Available Yet</Text>
            <Text style={styles.emptySubtitle}>This supplier hasn't listed any products</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  headerBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#EEEEEE',
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontSize: 16, fontFamily: 'Inter_700Bold', color: '#111827',
    marginHorizontal: 8,
  },
  cartBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: GREEN_LIGHT, alignItems: 'center', justifyContent: 'center',
  },

  // BANNER
  banner: {
    backgroundColor: GREEN,
    paddingTop: 20, paddingBottom: 16, paddingHorizontal: 16,
  },
  bannerContent: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  shopAvatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
    overflow: 'hidden',
  },
  avatarImg: { width: 72, height: 72, borderRadius: 36 },
  avatarInitial: { fontSize: 28, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  shopInfo: { flex: 1 },
  shopName: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#FFFFFF', marginBottom: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 8 },
  locationText: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontFamily: 'Inter_400Regular' },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statNum: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.75)', fontFamily: 'Inter_400Regular' },
  statDivider: { width: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.3)' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  callBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 8, flex: 1, justifyContent: 'center',
  },
  callBtnText: { color: GREEN, fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  msgBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 8, flex: 2, justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
  },
  msgBtnText: { color: '#FFFFFF', fontSize: 14, fontFamily: 'Inter_600SemiBold' },

  // SEARCH
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', marginHorizontal: 12, marginTop: 12, marginBottom: 4,
    borderRadius: 10, borderWidth: 1, borderColor: '#EEEEEE',
    height: 44,
  },
  searchInput: {
    flex: 1, paddingHorizontal: 10, fontSize: 14,
    fontFamily: 'Inter_400Regular', color: '#111827',
  },

  // CATEGORY TABS
  catScroll: { marginTop: 10, marginBottom: 6 },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#E0E0E0',
  },
  catChipActive: { backgroundColor: GREEN, borderColor: GREEN },
  catChipText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: '#666' },
  catChipTextActive: { color: '#FFFFFF', fontFamily: 'Inter_600SemiBold' },

  // SECTION HEADER
  sectionHeader: {
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8,
    flexDirection: 'row', alignItems: 'center',
  },
  sectionTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#111827' },

  // PRODUCT GRID
  listContent: { paddingBottom: 40 },
  row: { paddingHorizontal: 12, gap: 12, marginBottom: 12 },
  productCard: {
    width: CARD_W,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1, borderColor: '#EEEEEE',
    elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4,
  },
  imgWrap: {
    width: '100%', aspectRatio: 1,
    backgroundColor: '#F5F5F5', position: 'relative',
  },
  productImg: { width: '100%', height: '100%' },
  noImg: { alignItems: 'center', justifyContent: 'center' },
  discountBadge: {
    position: 'absolute', top: 8, left: 8, zIndex: 2,
    backgroundColor: ORANGE, borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 3,
  },
  discountText: { color: '#fff', fontSize: 10, fontFamily: 'Inter_700Bold' },
  digitalBadge: {
    position: 'absolute', top: 8, right: 34, zIndex: 2,
    backgroundColor: '#22C55E', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 3,
  },
  digitalText: { color: '#fff', fontSize: 10, fontFamily: 'Inter_700Bold' },
  eyeBtn: {
    position: 'absolute', top: 8, right: 8, zIndex: 2,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center', justifyContent: 'center',
  },
  cartIconBtn: {
    position: 'absolute', bottom: 8, right: 8, zIndex: 2,
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: GREEN_LIGHT,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: GREEN,
  },
  cartIconBtnActive: { backgroundColor: GREEN },
  cardBody: { padding: 10 },
  productTitle: {
    fontSize: 12, fontFamily: 'Inter_500Medium',
    color: '#111827', marginBottom: 4, lineHeight: 17,
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  price: { fontSize: 15, fontFamily: 'Inter_700Bold', color: ORANGE },
  mrp: { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#999', textDecorationLine: 'line-through' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: '#111827', borderRadius: 6, paddingVertical: 8,
  },
  addBtnActive: { backgroundColor: GREEN },
  addBtnText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_600SemiBold' },

  // EMPTY STATE
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#374151', marginTop: 16 },
  emptySubtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#9CA3AF', marginTop: 8, textAlign: 'center' },
});
