import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform,
  Dimensions, Alert, Animated, StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useApp } from '@/lib/context';
import { useCart } from '@/lib/cart-context';
import { apiRequest } from '@/lib/query-client';
import { Product } from '@/lib/types';

// ─── MarketHub Light Theme ───────────────────────────────────────────────────
const T = {
  bg: '#F9FAFB', card: '#FFFFFF', cardSurface: '#F3F4F6', bgElevated: '#FFFFFF',
  border: '#E5E7EB', text: '#111827', muted: '#9CA3AF', textSub: '#4B5563',
  accent: '#1B4D3E', accentMuted: '#D1FAE5', green: '#10B981', red: '#EF4444',
  greenMuted: '#DBEAFE', redMuted: '#FEE2E2',
};

const { width, height } = Dimensions.get('window');
const IMG_H = width * 0.85;

export default function ProductDetailScreen() {
  const params = useLocalSearchParams<{ id: string; productId: string }>();
  const id = params.productId || params.id;
  const insets = useSafeAreaInsets();
  const { profile, startConversation } = useApp();
  const { addToCart, removeFromCart, isInCart, getQuantity, updateQuantity } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);
  const [liked, setLiked] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const inCart = product ? isInCart(product.id) : false;
  const cartQty = product ? getQuantity(product.id) : 0;

  const fetchProduct = useCallback(async () => {
    if (!id) return;
    try {
      const res = await apiRequest('GET', `/api/products/${id}`);
      const data = await res.json();
      setProduct(data);
      if (profile) setLiked((() => { try { return JSON.parse(data.likes || '[]').includes(profile.id); } catch { return false; } })());
    } catch (e) {
      Alert.alert('Error', 'Could not load product');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id, profile]);

  useEffect(() => { fetchProduct(); }, [fetchProduct]);

  const imgs = product
    ? (() => { try { return JSON.parse(product.images || '[]'); } catch { return []; } })()
    : [];

  const price = product ? parseFloat(product.price) || 0 : 0;

  const handleToggleLike = async () => {
    if (!product || !profile) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLiked(v => !v);
    try {
      await apiRequest('POST', `/api/products/${product.id}/like`, { userId: profile.id });
    } catch {}
  };

  const handleAddToCart = () => {
    if (!product) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    addToCart({
      productId: product.id,
      title: product.title,
      price,
      image: imgs[0] || '',
      supplierName: product.userName,
      supplierId: product.userId,
      inStock: product.inStock || 0,
      category: product.category,
    });
  };

  const handleChat = async () => {
    if (!product || !profile) return;
    if (profile.id === product.userId) return;
    setChatLoading(true);
    try {
      const convoId = await startConversation(product.userId, product.userName, 'supplier' as any);
      router.push({ pathname: '/chat/[id]', params: { id: convoId } } as any);
    } catch {
      Alert.alert('Error', 'Could not open chat');
    } finally {
      setChatLoading(false);
    }
  };

  if (loading || !product) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <Ionicons name="cube-outline" size={48} color={T.muted} />
        <Text style={{ color: T.muted, marginTop: 12, fontFamily: 'Inter_400Regular' }}>Loading product...</Text>
      </View>
    );
  }

  const topInset = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Floating back/action bar */}
      <View style={[styles.floatBar, { top: topInset + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.floatBtn}>
          <Ionicons name="arrow-back" size={20} color={T.text} />
        </Pressable>
        <View style={styles.floatRight}>
          <Pressable onPress={handleToggleLike} style={styles.floatBtn}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={20} color={liked ? '#EF4444' : T.text} />
          </Pressable>
          <Pressable onPress={() => router.push('/cart' as any)} style={[styles.floatBtn, { position: 'relative' }]}>
            <Ionicons name="bag-outline" size={20} color={T.text} />
            {cartQty > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeTxt}>{cartQty}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Image carousel */}
        <View style={styles.imgWrap}>
          {imgs.length > 0 ? (
            <Image source={{ uri: imgs[activeImg] }} style={styles.mainImg} contentFit="cover" />
          ) : (
            <View style={[styles.mainImg, styles.noImg]}>
              <Ionicons name="cube-outline" size={64} color={T.muted} />
              <Text style={{ color: T.muted, marginTop: 8, fontFamily: 'Inter_400Regular' }}>No image</Text>
            </View>
          )}
          {/* Out of stock overlay */}
          {product.inStock === 0 && (
            <View style={styles.outOfStockOverlay}>
              <Text style={styles.outOfStockTxt}>Out of Stock</Text>
            </View>
          )}
        </View>

        {/* Thumbnail strip */}
        {imgs.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbsRow}>
            {imgs.map((img: string, i: number) => (
              <Pressable key={i} onPress={() => setActiveImg(i)} style={[styles.thumb, activeImg === i && styles.thumbActive]}>
                <Image source={{ uri: img }} style={styles.thumbImg} contentFit="cover" />
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Product Info */}
        <View style={styles.content}>
          <View style={styles.topRow}>
            <View style={styles.categoryChip}>
              <Text style={styles.categoryTxt}>{product.category}</Text>
            </View>
            <View style={[styles.stockChip, { backgroundColor: product.inStock > 0 ? T.greenMuted : T.redMuted }]}>
              <View style={[styles.stockDot, { backgroundColor: product.inStock > 0 ? T.green : T.red }]} />
              <Text style={[styles.stockTxt, { color: product.inStock > 0 ? T.green : T.red }]}>
                {product.inStock > 0 ? 'In Stock' : 'Out of Stock'}
              </Text>
            </View>
          </View>

          <Text style={styles.title}>{product.title}</Text>

          <View style={styles.priceRow}>
            <Text style={styles.price}>₹{price.toLocaleString('en-IN')}</Text>
            {product.city && (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={13} color={T.muted} />
                <Text style={styles.locationTxt}>{product.city}{product.state ? `, ${product.state}` : ''}</Text>
              </View>
            )}
          </View>

          {/* Supplier card */}
          <View style={styles.supplierCard}>
            <View style={styles.supplierAvatar}>
              <Text style={styles.supplierInitials}>
                {(product.userName || 'S').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.supplierName}>{product.userName}</Text>
              <Text style={styles.supplierRole}>Verified Supplier</Text>
            </View>
            <Pressable
              onPress={() => router.push({ pathname: '/shop', params: { supplierId: product.userId, supplierName: product.userName } } as any)}
              style={styles.viewShopBtn}
            >
              <Ionicons name="storefront-outline" size={13} color="#1B4D3E" />
              <Text style={styles.viewShopTxt}>Shop</Text>
            </Pressable>
            <Pressable onPress={handleChat} style={styles.chatBtn}>
              <Ionicons name="chatbubble-outline" size={14} color={T.accent} />
              <Text style={styles.chatBtnTxt}>Chat</Text>
            </Pressable>
          </View>

          {/* Description */}
          {product.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>{product.description}</Text>
            </View>
          ) : null}

          {/* Delivery Info */}
          {product.deliveryInfo ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Delivery Information</Text>
              <View style={styles.deliveryCard}>
                <Ionicons name="car-outline" size={18} color={T.accent} />
                <Text style={styles.deliveryTxt}>{product.deliveryInfo}</Text>
              </View>
            </View>
          ) : null}

          {/* Cart quantity control if in cart */}
          {inCart && (
            <View style={styles.qtySection}>
              <Text style={styles.sectionTitle}>In Your Cart</Text>
              <View style={styles.qtyRow}>
                <Pressable
                  onPress={() => {
                    if (cartQty <= 1) removeFromCart(product.id);
                    else updateQuantity(product.id, cartQty - 1);
                  }}
                  style={styles.qtyBtn}
                >
                  <Ionicons name={cartQty <= 1 ? 'trash-outline' : 'remove'} size={18} color={cartQty <= 1 ? '#EF4444' : T.text} />
                </Pressable>
                <Text style={styles.qtyVal}>{cartQty}</Text>
                <Pressable
                  onPress={() => {
                    if (cartQty < (product.inStock || 99)) updateQuantity(product.id, cartQty + 1);
                  }}
                  style={styles.qtyBtn}
                >
                  <Ionicons name="add" size={18} color={T.text} />
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom action bar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'web' ? 34 : 16) }]}>
        <View style={styles.bottomTotal}>
          <Text style={styles.bottomLabel}>Total</Text>
          <Text style={styles.bottomPrice}>₹{(price * (inCart ? cartQty : 1)).toLocaleString('en-IN')}</Text>
        </View>
        <Animated.View style={{ transform: [{ scale: scaleAnim }], flex: 1 }}>
          <Pressable
            onPress={inCart ? () => router.push('/cart' as any) : handleAddToCart}
            disabled={product.inStock === 0}
            style={[styles.cartActionBtn, product.inStock === 0 && styles.cartActionBtnDisabled, inCart && styles.cartActionBtnGo]}
          >
            <Ionicons
              name={inCart ? 'bag-check' : product.inStock === 0 ? 'close-circle-outline' : 'bag-add-outline'}
              size={20}
              color="#FFF"
            />
            <Text style={styles.cartActionBtnTxt}>
              {product.inStock === 0 ? 'Out of Stock' : inCart ? 'Go to Cart' : 'Add to Cart'}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  floatBar: { position: 'absolute', left: 16, right: 16, zIndex: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  floatRight: { flexDirection: 'row', gap: 8 },
  floatBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(30,30,30,0.85)', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' as any },
  cartBadge: { position: 'absolute', top: -2, right: -2, backgroundColor: T.accent, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  cartBadgeTxt: { color: '#FFF', fontSize: 9, fontFamily: 'Inter_700Bold' },
  imgWrap: { position: 'relative' },
  mainImg: { width, height: IMG_H, backgroundColor: T.card },
  noImg: { alignItems: 'center', justifyContent: 'center' },
  outOfStockOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  outOfStockTxt: { color: '#FFF', fontSize: 20, fontFamily: 'Inter_700Bold' },
  thumbsRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  thumb: { width: 60, height: 60, borderRadius: 10, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  thumbActive: { borderColor: T.accent },
  thumbImg: { width: 60, height: 60 },
  content: { padding: 20 },
  topRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  categoryChip: { backgroundColor: T.accentMuted, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  categoryTxt: { color: T.accent, fontSize: 12, fontFamily: 'Inter_600SemiBold', textTransform: 'capitalize' },
  stockChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  stockDot: { width: 6, height: 6, borderRadius: 3 },
  stockTxt: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  title: { fontSize: 22, fontFamily: 'Inter_700Bold', color: T.text, lineHeight: 30 },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 16 },
  price: { fontSize: 28, fontFamily: 'Inter_700Bold', color: T.accent },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationTxt: { fontSize: 12, color: T.muted, fontFamily: 'Inter_400Regular' },
  supplierCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: T.border, marginBottom: 20 },
  supplierAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center' },
  supplierInitials: { color: '#FFF', fontSize: 18, fontFamily: 'Inter_700Bold' },
  supplierName: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: T.text },
  supplierRole: { fontSize: 11, color: T.muted, fontFamily: 'Inter_400Regular', marginTop: 2 },
  chatBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: T.accentMuted, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  chatBtnTxt: { color: T.accent, fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  viewShopBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#D1FAE5', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, marginRight: 4 },
  viewShopTxt: { color: '#1B4D3E', fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: T.text, marginBottom: 10 },
  description: { fontSize: 14, color: T.textSub, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  deliveryCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: T.card, borderRadius: 12, padding: 14 },
  deliveryTxt: { flex: 1, fontSize: 14, color: T.textSub, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  qtySection: { marginBottom: 20 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 0, backgroundColor: T.card, borderRadius: 12, alignSelf: 'flex-start', overflow: 'hidden', borderWidth: 1, borderColor: T.border },
  qtyBtn: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  qtyVal: { fontSize: 18, fontFamily: 'Inter_700Bold', color: T.text, paddingHorizontal: 20, borderLeftWidth: 1, borderRightWidth: 1, borderColor: T.border, height: 46, lineHeight: 46, textAlignVertical: 'center' },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingTop: 16, backgroundColor: T.bgElevated, borderTopWidth: 1, borderTopColor: T.border },
  bottomTotal: { alignItems: 'flex-start' },
  bottomLabel: { fontSize: 11, color: T.muted, fontFamily: 'Inter_400Regular' },
  bottomPrice: { fontSize: 20, fontFamily: 'Inter_700Bold', color: T.text },
  cartActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: T.accent, borderRadius: 14, paddingVertical: 14 },
  cartActionBtnDisabled: { backgroundColor: T.border },
  cartActionBtnGo: { backgroundColor: T.green },
  cartActionBtnTxt: { color: '#FFF', fontFamily: 'Inter_700Bold', fontSize: 16 },
});
