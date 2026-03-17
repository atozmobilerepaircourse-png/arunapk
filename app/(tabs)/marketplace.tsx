import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, FlatList, ScrollView,
  Platform, ActivityIndicator, RefreshControl, Dimensions, Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useApp } from '@/lib/context';
import { useCart } from '@/lib/cart-context';
import { getApiUrl, apiRequest } from '@/lib/query-client';

const { width: SW } = Dimensions.get('window');
const CARD_W = (SW - 36) / 2;
const H_CARD_W = SW * 0.52;
const SHOP_CARD_W = 130;
const webTop = Platform.OS === 'web' ? 67 : 0;

// ─── Theme ─────────────────────────────────────────────────────────────────────
const T = {
  primary: '#0B4A45',
  primaryLight: '#E6F4F1',
  orange: '#C74A27',
  orangeLight: '#FDECE8',
  bg: '#F5F5F5',
  white: '#FFFFFF',
  text: '#111827',
  sub: '#4B5563',
  muted: '#9CA3AF',
  border: '#E5E7EB',
  star: '#F59E0B',
  green: '#22C55E',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getImgUri(img: string) {
  if (!img) return '';
  if (img.startsWith('http')) return img;
  if (img.startsWith('/')) return `${getApiUrl()}${img}`;
  return img;
}

function parseImages(raw: any): string[] {
  if (Array.isArray(raw)) return raw.filter(u => typeof u === 'string' && u.length > 0);
  if (typeof raw === 'string') {
    try { const p = JSON.parse(raw); return Array.isArray(p) ? p.filter(Boolean) : []; }
    catch { return raw.includes(',') ? raw.split(',').map((s: string) => s.trim()).filter(Boolean) : raw ? [raw] : []; }
  }
  return [];
}

function fmtPrice(v: any) {
  return `₹${(parseFloat(v) || 0).toLocaleString('en-IN')}`;
}

function discPct(p: any, m: any) {
  const pn = parseFloat(p) || 0, mn = parseFloat(m) || 0;
  return mn > pn ? Math.round(((mn - pn) / mn) * 100) : 0;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ w, h, radius = 8 }: { w: number | string; h: number; radius?: number }) {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
    ])).start();
  }, []);
  return <Animated.View style={{ width: w as any, height: h, borderRadius: radius, backgroundColor: '#E5E7EB', opacity: anim }} />;
}

// ─── Section Header ────────────────────────────────────────────────────────────
function SecHead({ icon, title, onSeeAll }: { icon: string; title: string; onSeeAll?: () => void }) {
  return (
    <View style={styles.secHead}>
      <Text style={styles.secTitle}>{icon} {title}</Text>
      {onSeeAll && (
        <Pressable onPress={onSeeAll}>
          <Text style={styles.secSeeAll}>See all</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Shop Card (Top Shops) ─────────────────────────────────────────────────────
function ShopCard({ supplier, onPress }: { supplier: any; onPress: () => void }) {
  const avatar = supplier?.avatar ? getImgUri(supplier.avatar) : '';
  const name = supplier?.shopName || supplier?.name || 'Shop';
  return (
    <Pressable style={styles.shopCard} onPress={onPress}>
      <View style={styles.shopAvatarWrap}>
        {avatar
          ? <Image source={{ uri: avatar }} style={styles.shopAvatar} contentFit="cover" />
          : <View style={[styles.shopAvatar, { backgroundColor: T.primary, alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ fontSize: 22, fontFamily: 'Inter_700Bold', color: '#fff' }}>{name.charAt(0)}</Text>
            </View>
        }
        <View style={styles.shopOnline} />
      </View>
      <Text style={styles.shopName} numberOfLines={1}>{name}</Text>
      {supplier?.city && <Text style={styles.shopCity} numberOfLines={1}>{supplier.city}</Text>}
    </Pressable>
  );
}

// ─── Horizontal Product Card ──────────────────────────────────────────────────
function HProductCard({ item, onPress, onAdd }: { item: any; onPress: () => void; onAdd: () => void }) {
  const imgs = parseImages(item.images);
  const disc = discPct(item.price, item.mrp);
  const imgUri = imgs[0] ? getImgUri(imgs[0]) : null;
  return (
    <Pressable style={styles.hCard} onPress={onPress}>
      <View style={styles.hImgWrap}>
        {disc > 0 && <View style={styles.discBadge}><Text style={styles.discTxt}>-{disc}%</Text></View>}
        {imgUri
          ? <Image source={{ uri: imgUri }} style={styles.hImg} contentFit="cover" />
          : <View style={[styles.hImg, styles.noImg]}><Ionicons name="cube-outline" size={28} color="#CCC" /></View>
        }
        <Pressable style={styles.hCartBtn} onPress={(e) => { e.stopPropagation?.(); onAdd(); }}>
          <Ionicons name="cart-outline" size={15} color="#fff" />
        </Pressable>
      </View>
      <View style={styles.hBody}>
        <Text style={styles.hTitle} numberOfLines={2}>{item.title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.hPrice}>{fmtPrice(item.price)}</Text>
          {parseFloat(item.mrp) > parseFloat(item.price) && (
            <Text style={styles.hMrp}>{fmtPrice(item.mrp)}</Text>
          )}
        </View>
        {item.views > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
            <Ionicons name="eye-outline" size={11} color={T.muted} />
            <Text style={{ fontSize: 10, color: T.muted }}>{item.views} views</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ─── Grid Product Card ────────────────────────────────────────────────────────
function GProductCard({ item, onPress, onAdd, inCart }: { item: any; onPress: () => void; onAdd: () => void; inCart: boolean }) {
  const imgs = parseImages(item.images);
  const disc = discPct(item.price, item.mrp);
  const imgUri = imgs[0] ? getImgUri(imgs[0]) : null;
  return (
    <Pressable style={styles.gCard} onPress={onPress}>
      <View style={styles.gImgWrap}>
        {disc > 0 && <View style={styles.discBadge}><Text style={styles.discTxt}>-{disc}%</Text></View>}
        {imgUri
          ? <Image source={{ uri: imgUri }} style={styles.gImg} contentFit="cover" />
          : <View style={[styles.gImg, styles.noImg]}><Ionicons name="cube-outline" size={24} color="#CCC" /></View>
        }
        <Pressable style={[styles.gCartIcon, inCart && { backgroundColor: T.green }]} onPress={(e) => { e.stopPropagation?.(); onAdd(); }}>
          <Ionicons name={inCart ? 'cart' : 'cart-outline'} size={14} color="#fff" />
        </Pressable>
      </View>
      <View style={styles.gBody}>
        <Text style={styles.gTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.gPrice}>{fmtPrice(item.price)}</Text>
        {parseFloat(item.mrp) > parseFloat(item.price) && (
          <Text style={styles.gMrp}>{fmtPrice(item.mrp)}</Text>
        )}
        <Pressable style={[styles.gBtn, inCart && { backgroundColor: T.primary }]} onPress={(e) => { e.stopPropagation?.(); onAdd(); }}>
          <Text style={styles.gBtnTxt}>{inCart ? '✓ Added' : 'ADD TO CART'}</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

// ─── Main Marketplace Tab ─────────────────────────────────────────────────────
export default function MarketplaceTab() {
  const insets = useSafeAreaInsets();
  const { profile } = useApp();
  const { addToCart, isInCart } = useCart();

  const [products, setProducts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [selectedCat, setSelectedCat] = useState('All');

  const fetchAll = useCallback(async () => {
    try {
      const [prodRes, profRes] = await Promise.all([
        fetch(`${getApiUrl()}/api/products`),
        fetch(`${getApiUrl()}/api/profiles`),
      ]);
      const prodData = await prodRes.json();
      const profData = await profRes.json();
      if (Array.isArray(prodData)) setProducts(prodData);
      if (Array.isArray(profData)) {
        setSuppliers(profData.filter((p: any) => p.role === 'supplier' || p.role === 'teacher').slice(0, 20));
      }
    } catch (e) {
      console.error('[Marketplace]', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));
  const onRefresh = useCallback(() => { setRefreshing(true); fetchAll(); }, [fetchAll]);

  const handleAdd = useCallback((item: any) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const imgs = parseImages(item.images);
    addToCart({ productId: item.id, title: item.title, price: parseFloat(item.price) || 0, image: imgs[0] ? getImgUri(imgs[0]) : '', supplierName: item.userName, supplierId: item.userId, inStock: item.inStock, category: item.category });
  }, [addToCart]);

  const openShop = (supplierId: string, supplierName: string) => {
    router.push({ pathname: '/shop/[supplierId]', params: { supplierId, supplierName } } as any);
  };

  const openProduct = (id: string) => {
    router.push({ pathname: '/product-detail', params: { id } } as any);
  };

  // Filtered products
  const categories = ['All', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];
  const filtered = products.filter(p => {
    const catOk = selectedCat === 'All' || p.category === selectedCat;
    const searchOk = !search || (p.title || '').toLowerCase().includes(search.toLowerCase());
    return catOk && searchOk;
  });

  // Sections
  const trending = [...products].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 10);
  const newArrivals = [...products].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 10);
  const onSale = products.filter(p => parseFloat(p.mrp) > parseFloat(p.price)).slice(0, 10);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTop }]}>
        <View style={styles.header}>
          <Text style={styles.logo}>🛒 Marketplace</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
          <Skeleton w="100%" h={44} radius={22} />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {[1,2,3].map(i => <View key={i} style={{ alignItems: 'center', gap: 8 }}><Skeleton w={70} h={70} radius={35} /><Skeleton w={60} h={12} /></View>)}
          </View>
          <Skeleton w={160} h={18} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ gap: 12 }}>
            {[1,2,3].map(i => <View key={i} style={{ marginRight: 12, gap: 8 }}><Skeleton w={H_CARD_W} h={H_CARD_W * 0.7} /><Skeleton w={H_CARD_W * 0.8} h={14} /><Skeleton w={80} h={14} /></View>)}
          </ScrollView>
        </ScrollView>
      </View>
    );
  }

  const ListHeader = () => (
    <View>
      {/* ── Top Shops ── */}
      {suppliers.length > 0 && (
        <View style={styles.section}>
          <SecHead icon="🏪" title="Top Shops" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, gap: 12, paddingBottom: 4 }}>
            {suppliers.map(sup => (
              <ShopCard key={sup.id} supplier={sup} onPress={() => openShop(sup.id, sup.shopName || sup.name)} />
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Trending Products ── */}
      {trending.length > 0 && (
        <View style={styles.section}>
          <SecHead icon="🔥" title="Trending Products" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 4 }} decelerationRate="fast" snapToInterval={H_CARD_W + 12}>
            {trending.map(item => (
              <HProductCard key={item.id} item={item}
                onPress={() => openProduct(item.id)}
                onAdd={() => handleAdd(item)}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── New Arrivals ── */}
      {newArrivals.length > 0 && (
        <View style={styles.section}>
          <SecHead icon="🆕" title="New Arrivals" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 4 }} decelerationRate="fast" snapToInterval={H_CARD_W + 12}>
            {newArrivals.map(item => (
              <HProductCard key={item.id} item={item}
                onPress={() => openProduct(item.id)}
                onAdd={() => handleAdd(item)}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── On Sale ── */}
      {onSale.length > 0 && (
        <View style={styles.section}>
          <SecHead icon="💥" title="Best Deals" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 4 }} decelerationRate="fast" snapToInterval={H_CARD_W + 12}>
            {onSale.map(item => (
              <HProductCard key={item.id} item={item}
                onPress={() => openProduct(item.id)}
                onAdd={() => handleAdd(item)}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Search + Filters ── */}
      <View style={styles.searchSection}>
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={{ paddingHorizontal: 14, gap: 8 }}>
          {categories.map(cat => (
            <Pressable key={cat} style={[styles.catChip, selectedCat === cat && styles.catChipActive]} onPress={() => setSelectedCat(cat)}>
              <Text style={[styles.catChipTxt, selectedCat === cat && styles.catChipTxtActive]}>{cat}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* ── All Products heading ── */}
      <View style={styles.secHead}>
        <Text style={styles.secTitle}>📦 All Products ({filtered.length})</Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTop }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>🛒 Marketplace</Text>
          <Text style={styles.logoSub}>Mobile Repair Parts & Tools</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {profile?.role === 'supplier' || profile?.role === 'teacher' ? (
            <Pressable style={styles.headerBtn} onPress={() => router.push('/add-product' as any)}>
              <Ionicons name="add" size={20} color={T.primary} />
            </Pressable>
          ) : null}
          <Pressable style={styles.headerBtn} onPress={() => router.push('/cart' as any)}>
            <Ionicons name="cart-outline" size={20} color={T.primary} />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => (
          <GProductCard
            item={item}
            inCart={isInCart(item.id)}
            onPress={() => openProduct(item.id)}
            onAdd={() => handleAdd(item)}
          />
        )}
        ListHeaderComponent={<ListHeader />}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="cube-outline" size={48} color="#DDD" />
            <Text style={styles.emptyTxt}>No products found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: T.white, borderBottomWidth: 1, borderBottomColor: T.border },
  logo: { fontSize: 18, fontFamily: 'Inter_700Bold', color: T.text },
  logoSub: { fontSize: 11, color: T.muted, fontFamily: 'Inter_400Regular' },
  headerBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: T.primaryLight, alignItems: 'center', justifyContent: 'center' },

  // Sections
  section: { marginBottom: 4 },
  secHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 16, paddingBottom: 10 },
  secTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: T.text },
  secSeeAll: { fontSize: 13, color: T.primary, fontFamily: 'Inter_600SemiBold' },

  // Shop Cards
  shopCard: { width: SHOP_CARD_W, alignItems: 'center', marginRight: 0 },
  shopAvatarWrap: { position: 'relative', marginBottom: 6 },
  shopAvatar: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: T.primaryLight },
  shopOnline: { position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: T.green, borderWidth: 2, borderColor: T.white },
  shopName: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: T.text, textAlign: 'center', width: SHOP_CARD_W },
  shopCity: { fontSize: 10, color: T.muted, textAlign: 'center', fontFamily: 'Inter_400Regular' },

  // Promo Banner
  promoBanner: { marginHorizontal: 14, marginVertical: 8, backgroundColor: T.primary, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  promoLeft: { flex: 1 },
  promoTag: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#4ADE80', letterSpacing: 1, marginBottom: 4 },
  promoTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#FFF', marginBottom: 4 },
  promoSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontFamily: 'Inter_400Regular' },

  // Horizontal Card
  hCard: { width: H_CARD_W, backgroundColor: T.white, borderRadius: 12, overflow: 'hidden', marginRight: 12, borderWidth: 1, borderColor: T.border, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
  hImgWrap: { width: '100%', height: H_CARD_W * 0.72, backgroundColor: '#F5F5F5', position: 'relative' },
  hImg: { width: '100%', height: '100%' },
  hCartBtn: { position: 'absolute', bottom: 8, right: 8, zIndex: 2, width: 30, height: 30, borderRadius: 8, backgroundColor: T.primary, alignItems: 'center', justifyContent: 'center' },
  hBody: { padding: 10 },
  hTitle: { fontSize: 12, fontFamily: 'Inter_500Medium', color: T.text, marginBottom: 4, lineHeight: 17 },
  hPrice: { fontSize: 14, fontFamily: 'Inter_700Bold', color: T.orange },
  hMrp: { fontSize: 10, color: T.muted, textDecorationLine: 'line-through', fontFamily: 'Inter_400Regular' },

  // Discount Badge
  discBadge: { position: 'absolute', top: 6, left: 6, zIndex: 2, backgroundColor: T.orange, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  discTxt: { color: '#fff', fontSize: 9, fontFamily: 'Inter_700Bold' },
  noImg: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' },

  // Search
  searchSection: { backgroundColor: T.white, paddingTop: 12, paddingBottom: 4, borderTopWidth: 1, borderTopColor: T.border, marginTop: 8 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 14, marginBottom: 10, backgroundColor: '#F5F5F5', borderRadius: 10, borderWidth: 1, borderColor: T.border, height: 44 },
  searchInput: { flex: 1, paddingHorizontal: 10, fontSize: 14, fontFamily: 'Inter_400Regular', color: T.text },
  catScroll: { marginBottom: 6 },
  catChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: T.white, borderWidth: 1, borderColor: '#E0E0E0' },
  catChipActive: { backgroundColor: T.primary, borderColor: T.primary },
  catChipTxt: { fontSize: 13, fontFamily: 'Inter_500Medium', color: '#666' },
  catChipTxtActive: { color: '#FFF', fontFamily: 'Inter_600SemiBold' },

  // Grid
  gCard: { width: CARD_W, backgroundColor: T.white, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: T.border, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  gImgWrap: { width: '100%', aspectRatio: 1, backgroundColor: '#F5F5F5', position: 'relative' },
  gImg: { width: '100%', height: '100%' },
  gCartIcon: { position: 'absolute', bottom: 6, right: 6, zIndex: 2, width: 26, height: 26, borderRadius: 6, backgroundColor: T.primary, alignItems: 'center', justifyContent: 'center' },
  gBody: { padding: 8 },
  gTitle: { fontSize: 12, fontFamily: 'Inter_500Medium', color: T.text, marginBottom: 3, lineHeight: 16 },
  gPrice: { fontSize: 14, fontFamily: 'Inter_700Bold', color: T.orange },
  gMrp: { fontSize: 10, color: T.muted, textDecorationLine: 'line-through', fontFamily: 'Inter_400Regular', marginBottom: 5 },
  gBtn: { backgroundColor: '#111827', borderRadius: 5, paddingVertical: 6, alignItems: 'center' },
  gBtnTxt: { color: '#fff', fontSize: 10, fontFamily: 'Inter_600SemiBold' },

  listContent: { paddingBottom: 100 },
  row: { paddingHorizontal: 12, gap: 12, marginBottom: 12 },
  empty: { alignItems: 'center', paddingTop: 40 },
  emptyTxt: { fontSize: 14, color: T.muted, marginTop: 12, fontFamily: 'Inter_400Regular' },
});
