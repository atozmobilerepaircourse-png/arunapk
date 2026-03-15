import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, FlatList, ScrollView,
  Platform, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useApp } from '@/lib/context';
import { useCart } from '@/lib/cart-context';
import { getApiUrl } from '@/lib/query-client';

// ─── MarketHub Design Tokens ─────────────────────────────────────────────────
const MH = {
  primary: '#1B4D3E',
  primaryMid: '#2D6A4F',
  primaryLight: '#D1FAE5',
  accent: '#10B981',
  bg: '#F9FAFB',
  surface: '#FFFFFF',
  border: '#E5E7EB',
  text: '#111827',
  textSub: '#4B5563',
  textMuted: '#9CA3AF',
  sale: '#DC2626',
  new: '#2563EB',
  star: '#F59E0B',
  outOfStock: '#6B7280',
  radius: 12,
};

function Stars({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
      {[1,2,3,4,5].map(i => (
        <Ionicons key={i} name={i <= Math.round(rating) ? 'star' : 'star-outline'} size={10} color={MH.star} />
      ))}
    </View>
  );
}

function ProductCard({ product, onAdd, onPress }: {
  product: any; onAdd: () => void; onPress: () => void;
}) {
  const images = (() => { 
    // If already an array, return it directly
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
  const img = images[0] || '';
  const isOut = product.inStock === 0;
  const price = parseFloat(product.price || '0');
  const isNew = Date.now() - (product.createdAt || 0) < 7 * 86400000;

  return (
    <Pressable onPress={onPress} style={styles.card}>
      {/* Badge */}
      {isOut ? (
        <View style={[styles.badge, { backgroundColor: MH.outOfStock }]}>
          <Text style={styles.badgeTxt}>OUT OF STOCK</Text>
        </View>
      ) : isNew ? (
        <View style={[styles.badge, { backgroundColor: MH.new }]}>
          <Text style={styles.badgeTxt}>NEW</Text>
        </View>
      ) : null}

      {/* Wishlist */}
      <View style={styles.heartBtn}>
        <Ionicons name="heart-outline" size={15} color={MH.textMuted} />
      </View>

      {/* Image */}
      <View style={styles.cardImgWrap}>
        {img ? (
          <Image source={{ uri: img }} style={styles.cardImg} contentFit="cover" />
        ) : (
          <View style={[styles.cardImg, styles.cardImgEmpty]}>
            <Ionicons name="cube-outline" size={32} color={MH.textMuted} />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.cardBody}>
        <Stars rating={4.5} />
        <Text style={styles.cardTitle} numberOfLines={2}>{product.title}</Text>
        <Text style={styles.cardSeller} numberOfLines={1}>{product.userName} · {product.city || 'India'}</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.cardPrice}>₹{price.toLocaleString('en-IN')}</Text>
          {!isOut ? (
            <Pressable
              onPress={(e) => { e.stopPropagation?.(); onAdd(); }}
              style={styles.addBtn}
            >
              <Ionicons name="add" size={18} color="#FFF" />
            </Pressable>
          ) : (
            <View style={styles.addBtnOut}>
              <Ionicons name="notifications-outline" size={14} color={MH.textMuted} />
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export default function MarketplaceTab() {
  const params = useLocalSearchParams<{ supplierId?: string; supplierName?: string }>();
  const insets = useSafeAreaInsets();
  const { profile } = useApp();
  const { items, addToCart, updateQuantity, totalItems } = useCart();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;
  const viewingSupplier = params.supplierId !== undefined;

  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const { data: rawProducts = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ['/api/products'],
    queryFn: async () => {
      const r = await fetch(new URL('/api/products', getApiUrl()).toString());
      return r.json();
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Refetch products whenever this tab is focused (new products added by supplier)
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const products = useMemo(() => {
    let list = [...rawProducts];
    if (viewingSupplier) list = list.filter(p => p.userId === params.supplierId);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.title?.toLowerCase().includes(q) ||
        p.userName?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [rawProducts, search, viewingSupplier, params.supplierId]);

  const handleAdd = useCallback((product: any) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const images = (() => {
      if (Array.isArray(product.images)) return product.images.filter((url: any) => typeof url === 'string' && url.length > 0);
      if (typeof product.images === 'string') {
        try { const p = JSON.parse(product.images); return Array.isArray(p) ? p.filter((url: any) => typeof url === 'string' && url.length > 0) : []; } 
        catch { return product.images.includes(',') ? product.images.split(',').filter((url: string) => url.trim().length > 0) : []; }
      }
      return [];
    })();
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

  const suppliers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; productCount: number; avatar?: string }>();
    for (const p of rawProducts) {
      if (!map.has(p.userId)) {
        map.set(p.userId, { id: p.userId, name: p.userName || 'Supplier', productCount: 1, avatar: p.userAvatar });
      } else {
        map.get(p.userId)!.productCount++;
      }
    }
    return Array.from(map.values());
  }, [rawProducts]);

  const isSupplier = profile?.role === 'supplier';
  const isTeacher = profile?.role === 'teacher';

  // Supplier / Teacher see their own dashboard instead
  if (isSupplier || isTeacher) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center', paddingTop: topInset }]}>
        <View style={styles.roleCard}>
          <View style={styles.roleIcon}>
            <Ionicons name="storefront" size={32} color="#FFF" />
          </View>
          <Text style={styles.roleTitle}>{isSupplier ? 'Supplier Dashboard' : 'Content Dashboard'}</Text>
          <Text style={styles.roleSub}>Manage your products and orders from the Products tab</Text>
          <Pressable onPress={() => router.push('/(tabs)/products' as any)} style={styles.roleBtn}>
            <Text style={styles.roleBtnTxt}>Go to Dashboard</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFF" />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <View style={styles.headerRow}>
          <View style={styles.logoRow}>
            <Pressable onPress={() => viewingSupplier && router.back()} style={styles.logoBox}>
              <Ionicons name={viewingSupplier ? "arrow-back" : "storefront"} size={18} color="#FFF" />
            </Pressable>
            <View>
              <Text style={styles.headerTitle}>{viewingSupplier ? params.supplierName : 'MarketHub'}</Text>
              <Text style={styles.headerSub}>{isLoading ? 'Loading...' : `${products.length} products`}</Text>
            </View>
          </View>
          <Pressable onPress={() => router.push('/cart' as any)} style={styles.cartBtn}>
            <Ionicons name="bag-outline" size={22} color={MH.primary} />
            {totalItems > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeTxt}>{totalItems > 9 ? '9+' : totalItems}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Search */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={17} color={MH.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search products, suppliers..."
            placeholderTextColor={MH.textMuted}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={17} color={MH.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Suppliers Row ── */}
      {!viewingSupplier && suppliers.length > 0 && (
        <View style={styles.suppliersSection}>
          <Text style={styles.suppliersTitle}>Suppliers</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suppliersScroll}>
            {suppliers.map(s => (
              <Pressable
                key={s.id}
                style={styles.supplierChip}
                onPress={() => router.push({ pathname: '/supplier-store', params: { supplierId: s.id, supplierName: s.name } } as any)}
              >
                <View style={styles.supplierAvatar}>
                  {s.avatar ? (
                    <Image source={{ uri: s.avatar }} style={{ width: 36, height: 36, borderRadius: 18 }} contentFit="cover" />
                  ) : (
                    <Ionicons name="person" size={16} color={MH.primary} />
                  )}
                </View>
                <Text style={styles.supplierName} numberOfLines={1}>{s.name}</Text>
                <Text style={styles.supplierCount}>{s.productCount} items</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Results Bar ── */}
      <View style={styles.resultsBar}>
        <Text style={styles.resultsTxt}>
          {isLoading ? '...' : `${products.length} product${products.length !== 1 ? 's' : ''}`}
          {search ? ` for "${search}"` : ''}
        </Text>
      </View>

      {/* ── Grid ── */}
      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={MH.primary} />
          <Text style={styles.loadingTxt}>Loading products...</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={p => p.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[styles.grid, { paddingBottom: bottomInset + 90 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={MH.primary} colors={[MH.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="search-outline" size={36} color={MH.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No products found</Text>
              <Text style={styles.emptySub}>
                {search ? `No results for "${search}"` : 'No products in this category yet'}
              </Text>
              {search ? (
                <Pressable onPress={() => setSearch('')} style={styles.clearBtn}>
                  <Text style={styles.clearBtnTxt}>Clear Search</Text>
                </Pressable>
              ) : (
                <Text style={styles.emptyHint}>Products from suppliers will appear here</Text>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              onAdd={() => handleAdd(item)}
              onPress={() => router.push({ pathname: '/product-detail', params: { productId: item.id } } as any)}
            />
          )}
        />
      )}

      {/* ── Cart Bar ── */}
      {totalItems > 0 && (
        <Pressable
          onPress={() => router.push('/cart' as any)}
          style={[styles.cartBar, { paddingBottom: Math.max(bottomInset, 16) }]}
        >
          <View style={styles.cartBarBadge}>
            <Text style={styles.cartBarBadgeTxt}>{totalItems}</Text>
          </View>
          <Text style={styles.cartBarTxt}>{totalItems} {totalItems === 1 ? 'item' : 'items'} in cart</Text>
          <View style={{ flex: 1 }} />
          <Text style={styles.cartBarAction}>View Cart</Text>
          <Ionicons name="arrow-forward" size={16} color="#FFF" />
        </Pressable>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: MH.bg },

  // Header
  header: { backgroundColor: MH.surface, paddingHorizontal: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: MH.border },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: MH.primary, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: MH.primary },
  headerSub: { fontSize: 11, color: MH.textMuted, fontFamily: 'Inter_400Regular' },
  cartBtn: { position: 'relative', width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: MH.border },
  cartBadge: { position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: MH.sale, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  cartBadgeTxt: { color: '#FFF', fontSize: 10, fontFamily: 'Inter_700Bold' },

  // Search
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: MH.bg, borderRadius: MH.radius, borderWidth: 1, borderColor: MH.border, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 14, color: MH.text, fontFamily: 'Inter_400Regular', padding: 0 },

  // Categories
  catBar: { backgroundColor: MH.surface, borderBottomWidth: 1, borderBottomColor: MH.border },
  catScroll: { paddingHorizontal: 16, paddingVertical: 6, gap: 6 },
  catChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: MH.border, backgroundColor: MH.surface },
  catChipOn: { backgroundColor: MH.primary, borderColor: MH.primary },
  catLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', color: MH.textSub },
  catLabelOn: { color: '#FFF', fontFamily: 'Inter_600SemiBold' },

  // Results
  resultsBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: MH.surface, borderBottomWidth: 1, borderBottomColor: MH.border },
  resultsTxt: { fontSize: 13, color: MH.textMuted, fontFamily: 'Inter_400Regular', flex: 1 },
  resultsActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: MH.border },
  filterTxt: { fontSize: 13, color: MH.textSub, fontFamily: 'Inter_500Medium' },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: MH.border },
  sortTxt: { fontSize: 13, color: MH.textSub, fontFamily: 'Inter_500Medium' },

  // Grid
  grid: { padding: 8, gap: 8 },
  row: { gap: 10, justifyContent: 'space-between' },

  // Product Card
  card: { flex: 1, maxWidth: '49%', backgroundColor: MH.surface, borderRadius: MH.radius, overflow: 'hidden', borderWidth: 1, borderColor: MH.border, ...({ shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2 } as any) },
  badge: { position: 'absolute', top: 8, left: 8, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, zIndex: 2 },
  badgeTxt: { color: '#FFF', fontSize: 8, fontFamily: 'Inter_700Bold', letterSpacing: 0.3 },
  heartBtn: { position: 'absolute', top: 8, right: 8, zIndex: 2, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  cardImgWrap: { width: '100%', aspectRatio: 1, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: MH.border },
  cardImg: { width: '100%', height: '100%' },
  cardImgEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' },
  cardBody: { padding: 8, gap: 2 },
  cardTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: MH.text, lineHeight: 17, marginTop: 1 },
  cardSeller: { fontSize: 11, color: MH.textMuted, fontFamily: 'Inter_400Regular' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  cardPrice: { fontSize: 15, fontFamily: 'Inter_700Bold', color: MH.text },
  addBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: MH.primary, alignItems: 'center', justifyContent: 'center' },
  addBtnOut: { width: 30, height: 30, borderRadius: 15, backgroundColor: MH.bg, borderWidth: 1, borderColor: MH.border, alignItems: 'center', justifyContent: 'center' },

  // States
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingTxt: { color: MH.textMuted, fontFamily: 'Inter_400Regular', fontSize: 14 },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: MH.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: MH.text },
  emptySub: { fontSize: 14, color: MH.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 20, fontFamily: 'Inter_400Regular' },
  emptyHint: { fontSize: 12, color: MH.textMuted, textAlign: 'center', marginTop: 8, fontFamily: 'Inter_400Regular' },
  clearBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: MH.primary },
  clearBtnTxt: { color: MH.primary, fontFamily: 'Inter_600SemiBold', fontSize: 14 },

  // Cart Bar
  cartBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: MH.primary, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 14, gap: 10 },
  cartBarBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  cartBarBadgeTxt: { color: '#FFF', fontSize: 13, fontFamily: 'Inter_700Bold' },
  cartBarTxt: { color: '#FFF', fontSize: 14, fontFamily: 'Inter_500Medium' },
  cartBarAction: { color: '#FFF', fontSize: 14, fontFamily: 'Inter_700Bold' },

  // Modals
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: MH.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingTop: 12 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: MH.border, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: MH.text, marginBottom: 4 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: MH.bg },
  sheetRowTxt: { fontSize: 15, fontFamily: 'Inter_400Regular', color: MH.textSub },
  filterSection: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: MH.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 10 },
  filterToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  filterToggleLabel: { fontSize: 14, color: MH.text, fontFamily: 'Inter_400Regular' },
  applyBtn: { backgroundColor: MH.primary, borderRadius: MH.radius, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  applyBtnTxt: { color: '#FFF', fontFamily: 'Inter_700Bold', fontSize: 16 },

  // Role card
  roleCard: { backgroundColor: MH.surface, borderRadius: 20, padding: 28, alignItems: 'center', marginHorizontal: 32, borderWidth: 1, borderColor: MH.border },
  roleIcon: { width: 72, height: 72, borderRadius: 20, backgroundColor: MH.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  roleTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: MH.text, textAlign: 'center' },
  roleSub: { fontSize: 14, color: MH.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 20, fontFamily: 'Inter_400Regular' },
  roleBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: MH.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, marginTop: 20 },
  roleBtnTxt: { color: '#FFF', fontFamily: 'Inter_700Bold', fontSize: 16 },

  suppliersSection: { backgroundColor: MH.surface, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: MH.border },
  suppliersTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: MH.text, paddingHorizontal: 16, marginBottom: 8 },
  suppliersScroll: { paddingHorizontal: 16, gap: 10 },
  supplierChip: { alignItems: 'center', width: 80, gap: 4 },
  supplierAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: MH.primaryLight, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  supplierName: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: MH.text, textAlign: 'center' },
  supplierCount: { fontSize: 10, fontFamily: 'Inter_400Regular', color: MH.textMuted },
});
