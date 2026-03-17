import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform, ActivityIndicator,
  FlatList, RefreshControl, ScrollView, Dimensions, Modal,
  Animated, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useApp } from '@/lib/context';
import { useCart } from '@/lib/cart-context';
import { apiRequest, getApiUrl } from '@/lib/query-client';

const { width: SW, height: SH } = Dimensions.get('window');
const CARD_W = (SW - 36) / 2;
const H_CARD_W = SW * 0.58;
const webTop = Platform.OS === 'web' ? 67 : 0;

// ─── Theme ─────────────────────────────────────────────────────────────────────
const C = {
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
  sale: '#EF4444',
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

function price(v: any) {
  const n = parseFloat(v) || 0;
  return `₹${n.toLocaleString('en-IN')}`;
}

function discount(p: any, m: any) {
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

// ─── Image Slider (inside card) ──────────────────────────────────────────────
function ImageSlider({ images, height, borderRadius = 0 }: { images: string[]; height: number; borderRadius?: number }) {
  const [idx, setIdx] = useState(0);
  const ref = useRef<ScrollView>(null);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    setIdx(Math.round(x / SW));
  };
  if (images.length === 0) {
    return (
      <View style={{ width: '100%', height, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', borderRadius }}>
        <Ionicons name="cube-outline" size={36} color="#CCC" />
        <Text style={{ color: '#CCC', fontSize: 11, marginTop: 4 }}>No Image</Text>
      </View>
    );
  }
  return (
    <View style={{ width: '100%', height, borderRadius, overflow: 'hidden' }}>
      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        snapToInterval={SW}
      >
        {images.map((img, i) => (
          <Image key={i} source={{ uri: getImgUri(img) }} style={{ width: SW, height }} contentFit="cover" />
        ))}
      </ScrollView>
      {images.length > 1 && (
        <View style={{ position: 'absolute', bottom: 6, alignSelf: 'center', flexDirection: 'row', gap: 4 }}>
          {images.map((_, i) => (
            <View key={i} style={{ width: i === idx ? 14 : 5, height: 5, borderRadius: 3, backgroundColor: i === idx ? '#FFF' : 'rgba(255,255,255,0.5)' }} />
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Horizontal Product Card (for sections) ──────────────────────────────────
function HCard({ item, onPress, onAdd }: { item: any; onPress: () => void; onAdd: () => void }) {
  const imgs = parseImages(item.images);
  const disc = discount(item.price, item.mrp);
  const inCart = false;
  return (
    <Pressable style={hStyles.card} onPress={onPress}>
      <View style={hStyles.imgWrap}>
        {disc > 0 && <View style={hStyles.discBadge}><Text style={hStyles.discText}>-{disc}%</Text></View>}
        {imgs.length > 0
          ? <Image source={{ uri: getImgUri(imgs[0]) }} style={hStyles.img} contentFit="cover" />
          : <View style={[hStyles.img, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' }]}><Ionicons name="cube-outline" size={32} color="#CCC" /></View>
        }
        <Pressable style={hStyles.cartBtn} onPress={(e) => { e.stopPropagation?.(); onAdd(); }}>
          <Ionicons name="cart-outline" size={16} color={C.white} />
        </Pressable>
      </View>
      <View style={hStyles.body}>
        <Text style={hStyles.title} numberOfLines={2}>{item.title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={hStyles.price}>{price(item.price)}</Text>
          {parseFloat(item.mrp) > parseFloat(item.price) && (
            <Text style={hStyles.mrp}>{price(item.mrp)}</Text>
          )}
        </View>
        {item.views > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 }}>
            <Ionicons name="eye-outline" size={11} color={C.muted} />
            <Text style={{ fontSize: 11, color: C.muted }}>{item.views}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const hStyles = StyleSheet.create({
  card: { width: H_CARD_W, backgroundColor: C.white, borderRadius: 12, overflow: 'hidden', marginRight: 12, borderWidth: 1, borderColor: C.border, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
  imgWrap: { width: '100%', height: H_CARD_W * 0.75, backgroundColor: '#F5F5F5', position: 'relative' },
  img: { width: '100%', height: '100%' },
  discBadge: { position: 'absolute', top: 8, left: 8, zIndex: 2, backgroundColor: C.orange, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  discText: { color: '#fff', fontSize: 10, fontFamily: 'Inter_700Bold' },
  cartBtn: { position: 'absolute', bottom: 8, right: 8, zIndex: 2, width: 32, height: 32, borderRadius: 8, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 10 },
  title: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.text, marginBottom: 4, lineHeight: 18 },
  price: { fontSize: 15, fontFamily: 'Inter_700Bold', color: C.orange },
  mrp: { fontSize: 11, color: C.muted, textDecorationLine: 'line-through', fontFamily: 'Inter_400Regular' },
});

// ─── Grid Product Card ────────────────────────────────────────────────────────
function GCard({ item, onPress, onAdd, inCart }: { item: any; onPress: () => void; onAdd: () => void; inCart: boolean }) {
  const imgs = parseImages(item.images);
  const disc = discount(item.price, item.mrp);
  return (
    <Pressable style={gStyles.card} onPress={onPress}>
      <View style={gStyles.imgWrap}>
        {disc > 0 && <View style={gStyles.discBadge}><Text style={gStyles.discText}>-{disc}%</Text></View>}
        {imgs.length > 0
          ? <Image source={{ uri: getImgUri(imgs[0]) }} style={gStyles.img} contentFit="cover" />
          : <View style={[gStyles.img, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' }]}><Ionicons name="cube-outline" size={28} color="#CCC" /></View>
        }
        <Pressable style={[gStyles.cartBtn, inCart && { backgroundColor: C.green }]} onPress={(e) => { e.stopPropagation?.(); onAdd(); }}>
          <Ionicons name={inCart ? 'cart' : 'cart-outline'} size={15} color="#fff" />
        </Pressable>
      </View>
      <View style={gStyles.body}>
        <Text style={gStyles.title} numberOfLines={2}>{item.title}</Text>
        <Text style={gStyles.price}>{price(item.price)}</Text>
        {parseFloat(item.mrp) > parseFloat(item.price) && (
          <Text style={gStyles.mrp}>{price(item.mrp)}</Text>
        )}
        <Pressable style={[gStyles.btn, inCart && { backgroundColor: C.primary }]} onPress={(e) => { e.stopPropagation?.(); onAdd(); }}>
          <Text style={gStyles.btnTxt}>{inCart ? 'Added ✓' : 'ADD TO CART'}</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const gStyles = StyleSheet.create({
  card: { width: CARD_W, backgroundColor: C.white, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: C.border, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  imgWrap: { width: '100%', aspectRatio: 1, backgroundColor: '#F5F5F5', position: 'relative' },
  img: { width: '100%', height: '100%' },
  discBadge: { position: 'absolute', top: 6, left: 6, zIndex: 2, backgroundColor: C.orange, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  discText: { color: '#fff', fontSize: 9, fontFamily: 'Inter_700Bold' },
  cartBtn: { position: 'absolute', bottom: 6, right: 6, zIndex: 2, width: 28, height: 28, borderRadius: 6, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 8 },
  title: { fontSize: 12, fontFamily: 'Inter_500Medium', color: C.text, marginBottom: 3, lineHeight: 16 },
  price: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.orange },
  mrp: { fontSize: 10, color: C.muted, textDecorationLine: 'line-through', fontFamily: 'Inter_400Regular', marginBottom: 6 },
  btn: { backgroundColor: '#111827', borderRadius: 5, paddingVertical: 6, alignItems: 'center' },
  btnTxt: { color: '#fff', fontSize: 10, fontFamily: 'Inter_600SemiBold' },
});

// ─── Quick View Modal ─────────────────────────────────────────────────────────
function QuickView({ item, visible, onClose, onAdd, supplierName }: { item: any | null; visible: boolean; onClose: () => void; onAdd: () => void; supplierName: string }) {
  const slideAnim = useRef(new Animated.Value(SH)).current;
  const imgs = item ? parseImages(item.images).map(getImgUri) : [];
  useEffect(() => {
    Animated.spring(slideAnim, { toValue: visible ? 0 : SH, useNativeDriver: true, tension: 70, friction: 12 }).start();
  }, [visible]);
  if (!item) return null;
  return (
    <Modal transparent visible={visible} onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={qStyles.overlay} onPress={onClose} />
      <Animated.View style={[qStyles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={qStyles.handle} />
        <ImageSlider images={imgs} height={240} />
        <ScrollView style={qStyles.content} showsVerticalScrollIndicator={false}>
          <Text style={qStyles.title}>{item.title}</Text>
          <Text style={qStyles.sub}>by {supplierName}</Text>
          <View style={qStyles.priceRow}>
            <Text style={qStyles.price}>{price(item.price)}</Text>
            {parseFloat(item.mrp) > parseFloat(item.price) && (
              <Text style={qStyles.mrp}>{price(item.mrp)}</Text>
            )}
          </View>
          {item.description ? <Text style={qStyles.desc}>{item.description}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 24 }}>
            <Pressable style={qStyles.viewBtn} onPress={() => { onClose(); router.push({ pathname: '/product-detail', params: { id: item.id } } as any); }}>
              <Text style={qStyles.viewBtnTxt}>View Full Details</Text>
            </Pressable>
            <Pressable style={qStyles.addBtn} onPress={() => { onAdd(); onClose(); }}>
              <Ionicons name="cart-outline" size={16} color="#fff" />
              <Text style={qStyles.addBtnTxt}>Add to Cart</Text>
            </Pressable>
          </View>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const qStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: SH * 0.85, overflow: 'hidden' },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#DDD', alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  content: { paddingHorizontal: 16 },
  title: { fontSize: 18, fontFamily: 'Inter_700Bold', color: C.text, marginTop: 12 },
  sub: { fontSize: 13, color: C.muted, fontFamily: 'Inter_400Regular', marginTop: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  price: { fontSize: 22, fontFamily: 'Inter_700Bold', color: C.orange },
  mrp: { fontSize: 14, color: C.muted, textDecorationLine: 'line-through', fontFamily: 'Inter_400Regular' },
  desc: { fontSize: 13, color: C.sub, lineHeight: 20, marginTop: 10, fontFamily: 'Inter_400Regular' },
  viewBtn: { flex: 1, borderWidth: 1.5, borderColor: C.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  viewBtnTxt: { color: C.primary, fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  addBtn: { flex: 1, backgroundColor: C.primary, borderRadius: 10, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  addBtnTxt: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});

// ─── Section Header ────────────────────────────────────────────────────────────
function SectionHead({ title, count }: { title: string; count?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 20, paddingBottom: 10 }}>
      <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: C.text, flex: 1 }}>{title}</Text>
      {count !== undefined && <Text style={{ fontSize: 12, color: C.muted }}>({count})</Text>}
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ShopPage() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ supplierId: string; supplierName?: string }>();
  const supplierId = params.supplierId;
  const { profile: myProfile, startConversation } = useApp();
  const { addToCart, isInCart } = useCart();

  const [supplier, setSupplier] = useState<any>(null);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [quickItem, setQuickItem] = useState<any>(null);
  const [quickVisible, setQuickVisible] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  const fetchData = useCallback(async () => {
    try {
      const [profRes, prodRes] = await Promise.all([
        apiRequest('GET', `/api/profiles/${supplierId}`),
        apiRequest('GET', `/api/products?supplierId=${supplierId}`),
      ]);
      const profData = await profRes.json();
      const prodData = await prodRes.json();
      if (profData?.id) setSupplier(profData);
      setAllProducts(Array.isArray(prodData) ? prodData : []);
    } catch (e) {
      console.error('[ShopPage]', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [supplierId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = useCallback(() => { setRefreshing(true); fetchData(); }, [fetchData]);

  const handleAdd = useCallback((item: any) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const imgs = parseImages(item.images);
    addToCart({ productId: item.id, title: item.title, price: parseFloat(item.price) || 0, image: imgs[0] ? getImgUri(imgs[0]) : '', supplierName: item.userName || supplier?.name, supplierId: item.userId, inStock: item.inStock, category: item.category });
  }, [addToCart, supplier]);

  const handleMessage = async () => {
    if (!myProfile || !supplier) return;
    const c = await startConversation(supplier.id, supplier.name, supplier.role);
    if (c) router.push({ pathname: '/chat/[id]', params: { id: c } } as any);
  };

  const shopName = supplier?.shopName || supplier?.name || params.supplierName || 'Shop';
  const featured = allProducts.slice(0, 8);
  const newArrivals = [...allProducts].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 8);
  const bestSelling = [...allProducts].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 8);

  const headerOpacity = scrollY.interpolate({ inputRange: [0, 120], outputRange: [0, 1], extrapolate: 'clamp' });

  if (loading) {
    return (
      <View style={[s.container, { paddingTop: insets.top + webTop }]}>
        <View style={s.headerBar}>
          <Pressable onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#111" />
          </Pressable>
          <Text style={s.headerTitle}>Shop</Text>
          <View style={{ width: 38 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <Skeleton w="100%" h={180} radius={0} />
          <View style={{ paddingHorizontal: 4, gap: 10 }}>
            <Skeleton w={180} h={22} />
            <Skeleton w={120} h={16} />
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {[1,2].map(i => <View key={i} style={{ gap: 8 }}><Skeleton w={CARD_W} h={CARD_W} /><Skeleton w={CARD_W * 0.8} h={14} /><Skeleton w={80} h={14} /></View>)}
          </View>
        </ScrollView>
      </View>
    );
  }

  const ListHeader = () => (
    <View>
      {/* Full Banner */}
      <View style={s.bannerWrap}>
        {supplier?.banner ? (
          <Image source={{ uri: getImgUri(supplier.banner) }} style={s.bannerImg} contentFit="cover" />
        ) : (
          <View style={[s.bannerImg, s.bannerFallback]}>
            <Text style={s.bannerLetter}>{shopName.charAt(0)}</Text>
          </View>
        )}
        {/* Overlay gradient */}
        <View style={s.bannerGradient} />
        {/* Logo + Name */}
        <View style={s.bannerBottom}>
          <View style={s.logoCircle}>
            {supplier?.avatar
              ? <Image source={{ uri: getImgUri(supplier.avatar) }} style={s.logoImg} contentFit="cover" />
              : <Text style={s.logoLetter}>{shopName.charAt(0)}</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.bannerShopName}>{shopName}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name="star" size={13} color={C.star} />
                <Text style={{ color: '#FFF', fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>4.8</Text>
              </View>
              <View style={s.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={12} color={C.green} />
                <Text style={{ color: C.green, fontSize: 11, fontFamily: 'Inter_600SemiBold' }}>Verified</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Stats + Actions */}
      <View style={s.infoCard}>
        <View style={s.statsRow}>
          <View style={s.stat}><Text style={s.statN}>{allProducts.length}</Text><Text style={s.statL}>Products</Text></View>
          <View style={s.statDiv} />
          <View style={s.stat}><Text style={s.statN}>{allProducts.reduce((a, p) => a + (p.views || 0), 0)}</Text><Text style={s.statL}>Views</Text></View>
          <View style={s.statDiv} />
          <View style={s.stat}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.green }} />
              <Text style={s.statN}>Active</Text>
            </View>
            <Text style={s.statL}>Status</Text>
          </View>
        </View>
        {supplier?.city || supplier?.state ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: 10 }}>
            <Ionicons name="location-outline" size={13} color={C.muted} />
            <Text style={{ fontSize: 12, color: C.muted, fontFamily: 'Inter_400Regular' }}>
              {[supplier.city, supplier.state].filter(Boolean).join(', ')}
            </Text>
          </View>
        ) : null}
        <View style={s.actionRow}>
          {supplier?.phone && (
            <Pressable style={s.callBtn} onPress={() => require('react-native').Linking.openURL(`tel:${supplier.phone}`)}>
              <Ionicons name="call-outline" size={16} color={C.primary} />
              <Text style={s.callTxt}>Call</Text>
            </Pressable>
          )}
          {myProfile?.id !== supplierId && (
            <Pressable style={s.msgBtn} onPress={handleMessage}>
              <Ionicons name="chatbubble-outline" size={16} color="#fff" />
              <Text style={s.msgTxt}>Message</Text>
            </Pressable>
          )}
          <Pressable style={s.cartTopBtn} onPress={() => router.push('/cart' as any)}>
            <Ionicons name="cart-outline" size={18} color={C.primary} />
          </Pressable>
        </View>
      </View>

      {/* 🔥 Featured Products */}
      {featured.length > 0 && (
        <View>
          <SectionHead title="🔥 Featured Products" count={featured.length} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 4 }} decelerationRate="fast" snapToInterval={H_CARD_W + 12}>
            {featured.map(item => (
              <HCard key={item.id} item={item}
                onPress={() => { setQuickItem(item); setQuickVisible(true); }}
                onAdd={() => handleAdd(item)}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* 🆕 New Arrivals */}
      {newArrivals.length > 0 && (
        <View>
          <SectionHead title="🆕 New Arrivals" count={newArrivals.length} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 4 }} decelerationRate="fast" snapToInterval={H_CARD_W + 12}>
            {newArrivals.map(item => (
              <HCard key={item.id} item={item}
                onPress={() => { setQuickItem(item); setQuickVisible(true); }}
                onAdd={() => handleAdd(item)}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* 💥 Best Selling */}
      {bestSelling.length > 0 && (
        <View>
          <SectionHead title="💥 Best Selling" count={bestSelling.length} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 4 }} decelerationRate="fast" snapToInterval={H_CARD_W + 12}>
            {bestSelling.map(item => (
              <HCard key={item.id} item={item}
                onPress={() => { setQuickItem(item); setQuickVisible(true); }}
                onAdd={() => handleAdd(item)}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* All Products Grid Header */}
      <SectionHead title="📦 All Products" count={allProducts.length} />
    </View>
  );

  return (
    <View style={[s.container, { paddingTop: insets.top + webTop }]}>
      {/* Sticky Header Bar */}
      <View style={s.headerBar}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#111" />
        </Pressable>
        <Animated.Text style={[s.headerTitle, { opacity: headerOpacity }]} numberOfLines={1}>{shopName}</Animated.Text>
        <Pressable onPress={() => router.push('/cart' as any)} style={s.cartBtn}>
          <Ionicons name="cart-outline" size={22} color={C.primary} />
        </Pressable>
      </View>

      {/* Products FlatList with header */}
      {allProducts.length === 0 && !loading ? (
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}>
          <ListHeader />
          <View style={s.empty}>
            <Ionicons name="storefront-outline" size={64} color="#DDD" />
            <Text style={s.emptyTitle}>No Products Yet</Text>
            <Text style={s.emptySub}>This supplier hasn't listed any products</Text>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={allProducts}
          keyExtractor={i => i.id}
          numColumns={2}
          columnWrapperStyle={s.row}
          renderItem={({ item }) => (
            <GCard
              item={item}
              inCart={isInCart(item.id)}
              onPress={() => { setQuickItem(item); setQuickVisible(true); }}
              onAdd={() => handleAdd(item)}
            />
          )}
          ListHeaderComponent={<ListHeader />}
          contentContainerStyle={s.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
          scrollEventThrottle={16}
        />
      )}

      {/* Quick View Bottom Sheet */}
      <QuickView
        item={quickItem}
        visible={quickVisible}
        onClose={() => setQuickVisible(false)}
        onAdd={() => quickItem && handleAdd(quickItem)}
        supplierName={shopName}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border, zIndex: 10 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontFamily: 'Inter_700Bold', color: C.text, marginHorizontal: 8 },
  cartBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center' },

  // Banner
  bannerWrap: { width: SW, height: 200, position: 'relative', backgroundColor: C.primary },
  bannerImg: { width: SW, height: 200 },
  bannerFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary },
  bannerLetter: { fontSize: 72, fontFamily: 'Inter_700Bold', color: 'rgba(255,255,255,0.3)' },
  bannerGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 100, backgroundColor: 'rgba(0,0,0,0.45)' },
  bannerBottom: { position: 'absolute', bottom: 12, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff', borderWidth: 2, borderColor: C.primary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoImg: { width: 56, height: 56, borderRadius: 28 },
  logoLetter: { fontSize: 22, fontFamily: 'Inter_700Bold', color: C.primary },
  bannerShopName: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#FFF', marginBottom: 4 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(34,197,94,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },

  // Info Card
  infoCard: { backgroundColor: C.white, marginHorizontal: 0, paddingHorizontal: 14, paddingTop: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  statsRow: { flexDirection: 'row', alignItems: 'center', paddingBottom: 10 },
  stat: { flex: 1, alignItems: 'center' },
  statN: { fontSize: 15, fontFamily: 'Inter_700Bold', color: C.text },
  statL: { fontSize: 11, color: C.muted, fontFamily: 'Inter_400Regular' },
  statDiv: { width: 1, height: 28, backgroundColor: C.border },
  actionRow: { flexDirection: 'row', gap: 10, paddingBottom: 12 },
  callBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: C.primary, borderRadius: 8, paddingVertical: 10 },
  callTxt: { color: C.primary, fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  msgBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.primary, borderRadius: 8, paddingVertical: 10 },
  msgTxt: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  cartTopBtn: { width: 44, height: 44, borderRadius: 8, backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center' },

  // Grid
  listContent: { paddingBottom: 40 },
  row: { paddingHorizontal: 12, gap: 12, marginBottom: 12 },

  // Empty
  empty: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: '#374151', marginTop: 16 },
  emptySub: { fontSize: 13, color: C.muted, marginTop: 8, textAlign: 'center', fontFamily: 'Inter_400Regular' },
});
