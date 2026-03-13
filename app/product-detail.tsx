import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform,
  Dimensions, Alert, Linking, Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { T } from '@/constants/techTheme';
import { useApp } from '@/lib/context';
import { useCart } from '@/lib/cart-context';
import { apiRequest, getApiUrl } from '@/lib/query-client';
import { Product } from '@/lib/types';

const { width } = Dimensions.get('window');
const webTop = Platform.OS === 'web' ? 67 : 0;

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(s => (
        <Ionicons key={s} name={s <= Math.round(rating) ? 'star' : 'star-outline'} size={size} color="#F59E0B" />
      ))}
    </View>
  );
}

function SkeletonLoader() {
  const anim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <Animated.View style={{ opacity: anim, backgroundColor: '#0A0A14', flex: 1 }}>
      <View style={{ width, height: width * 0.75, backgroundColor: T.card }} />
      <View style={{ padding: 20 }}>
        <View style={{ height: 24, backgroundColor: T.card, borderRadius: 8, width: '60%', marginBottom: 12 }} />
        <View style={{ height: 16, backgroundColor: T.card, borderRadius: 6, marginBottom: 8 }} />
        <View style={{ height: 16, backgroundColor: T.card, borderRadius: 6, width: '80%' }} />
      </View>
    </Animated.View>
  );
}

const FAKE_REVIEWS = [
  { name: 'Rahul M.', rating: 5, text: 'Excellent quality, fast delivery!', time: '2 days ago' },
  { name: 'Priya S.', rating: 4, text: 'Good product, as described.', time: '1 week ago' },
  { name: 'Karan T.', rating: 5, text: 'Great value for money. Highly recommend!', time: '2 weeks ago' },
];

export default function ProductDetailScreen() {
  const params = useLocalSearchParams<{ id: string; productId: string }>();
  const id = params.productId || params.id;
  const insets = useSafeAreaInsets();
  const { profile, startConversation } = useApp();
  const { addToCart, isInCart, getQuantity, removeFromCart } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [liked, setLiked] = useState(false);
  const [addedAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await apiRequest('GET', `/api/products/${id}`);
        const data = await res.json();
        setProduct(data);
        if (profile) setLiked(data.likes?.includes(profile.id) || false);
      } catch (e) {}
    })();
  }, [id]);

  const toggleLike = async () => {
    if (!product || !profile) return;
    try {
      const res = await apiRequest('POST', `/api/products/${product.id}/like`, { userId: profile.id });
      const data = await res.json();
      setLiked(!liked);
      setProduct(prev => prev ? { ...prev, likes: data.likes } : null);
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}
  };

  const handleAddToCart = () => {
    if (!product) return;
    const imgs = Array.isArray(product.images) ? product.images : (() => { try { return JSON.parse(product.images as any); } catch { return []; } })();
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
    Animated.sequence([
      Animated.timing(addedAnim, { toValue: 0.9, duration: 80, useNativeDriver: true }),
      Animated.spring(addedAnim, { toValue: 1, useNativeDriver: true }),
    ]).start();
  };

  const contactSeller = async () => {
    if (!product || !profile) return;
    try {
      const convoId = await startConversation(product.userId, product.userName, product.userRole as any);
      if (convoId) router.push({ pathname: '/chat/[id]', params: { id: convoId } });
    } catch (e) {
      Alert.alert('Error', 'Could not start conversation');
    }
  };

  if (!product) return <SkeletonLoader />;

  const imgs = Array.isArray(product.images) ? product.images : (() => { try { return JSON.parse(product.images as any); } catch { return []; } })();
  const hasImages = imgs.length > 0;
  const inCart = isInCart(product.id);
  const cartQty = getQuantity(product.id);
  const price = parseFloat(product.price) || 0;
  const fakeRating = 3.8 + ((product.id.charCodeAt(0) || 65) % 12) / 10;
  const fakeDiscount = (product.views || 0) > 50 ? Math.floor((product.views || 0) % 30) + 5 : 0;
  const originalPrice = fakeDiscount > 0 ? Math.round(price * 100 / (100 - fakeDiscount)) : 0;
  const isOwner = profile?.id === product.userId;
  const fakeRatingCount = 50 + ((product.id.charCodeAt(1) || 65) % 200);

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A14' }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }}>
        {/* IMAGE GALLERY */}
        <View>
          {hasImages ? (
            <>
              <ScrollView
                horizontal pagingEnabled showsHorizontalScrollIndicator={false}
                onScroll={e => setActiveImageIdx(Math.round(e.nativeEvent.contentOffset.x / width))}
                scrollEventThrottle={16}
              >
                {imgs.map((img: string, i: number) => (
                  <Image
                    key={i}
                    source={{ uri: img.startsWith('/') ? `${getApiUrl()}${img}` : img }}
                    style={{ width, height: width * 0.75 }}
                    contentFit="cover"
                  />
                ))}
              </ScrollView>
              {imgs.length > 1 && (
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: -18, marginBottom: 8 }}>
                  {imgs.map((_: any, i: number) => (
                    <View key={i} style={{ width: i === activeImageIdx ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === activeImageIdx ? T.accent : 'rgba(255,255,255,0.3)' }} />
                  ))}
                </View>
              )}
            </>
          ) : (
            <View style={{ width, height: width * 0.65, backgroundColor: T.card, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="cube-outline" size={72} color={T.muted} />
            </View>
          )}
        </View>

        {/* FLOATING NAV */}
        <View style={[styles.floatingNav, { top: (Platform.OS === 'web' ? webTop : insets.top) + 8 }]}>
          <Pressable onPress={() => router.back()} style={styles.floatBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable onPress={toggleLike} style={styles.floatBtn}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? '#FF4444' : '#fff'} />
            </Pressable>
            <Pressable onPress={() => router.push('/cart')} style={styles.floatBtn}>
              <Ionicons name="cart-outline" size={22} color="#fff" />
            </Pressable>
          </View>
        </View>

        {/* CONTENT */}
        <View style={styles.content}>
          {/* PRICE + DISCOUNT */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <Text style={styles.price}>₹{price.toLocaleString('en-IN')}</Text>
            {fakeDiscount > 0 && (
              <>
                <Text style={styles.originalPrice}>₹{originalPrice.toLocaleString('en-IN')}</Text>
                <View style={styles.discountPill}>
                  <Text style={styles.discountPillText}>{fakeDiscount}% off</Text>
                </View>
              </>
            )}
          </View>

          {/* TITLE */}
          <Text style={styles.title}>{product.title}</Text>

          {/* RATING */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1A2A1A', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 }}>
              <Text style={{ color: T.green, fontFamily: 'Inter_700Bold', fontSize: 14 }}>{fakeRating.toFixed(1)}</Text>
              <Ionicons name="star" size={13} color={T.green} />
            </View>
            <Text style={{ color: T.muted, fontSize: 13, fontFamily: 'Inter_400Regular' }}>{fakeRatingCount.toLocaleString('en-IN')} ratings</Text>
            {product.inStock > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="checkmark-circle" size={14} color={T.green} />
                <Text style={{ color: T.green, fontSize: 13, fontFamily: 'Inter_500Medium' }}>In Stock</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="close-circle" size={14} color={T.red} />
                <Text style={{ color: T.red, fontSize: 13, fontFamily: 'Inter_500Medium' }}>Out of Stock</Text>
              </View>
            )}
          </View>

          {/* DELIVERY INFO */}
          <View style={styles.deliveryBanner}>
            <Ionicons name="car-outline" size={18} color={T.accent} />
            <Text style={{ color: T.text, fontSize: 13, fontFamily: 'Inter_500Medium' }}>
              {price > 999 ? 'FREE Delivery' : 'Delivery ₹49'}
            </Text>
            <Text style={{ color: T.muted, fontSize: 12, fontFamily: 'Inter_400Regular' }}>· Est. 3–7 days</Text>
          </View>

          {/* SUPPLIER CARD */}
          <Pressable
            onPress={() => router.push({ pathname: '/supplier-store', params: { supplierId: product.userId } })}
            style={styles.supplierCard}
          >
            <View style={styles.supplierAvatarWrap}>
              {product.userAvatar ? (
                <Image source={{ uri: product.userAvatar.startsWith('/') ? `${getApiUrl()}${product.userAvatar}` : product.userAvatar }} style={styles.supplierAvatar} contentFit="cover" />
              ) : (
                <View style={[styles.supplierAvatar, { backgroundColor: T.card, alignItems: 'center', justifyContent: 'center' }]}>
                  <Ionicons name="storefront" size={22} color={T.accent} />
                </View>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.supplierName}>{product.userName}</Text>
              <Text style={{ color: T.muted, fontSize: 12, fontFamily: 'Inter_400Regular' }}>
                {product.city}, {product.state}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                <StarRating rating={4.2} size={11} />
                <Text style={{ color: T.muted, fontSize: 11, fontFamily: 'Inter_400Regular' }}>4.2</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ color: T.accent, fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>Visit Store</Text>
              <Ionicons name="chevron-forward" size={14} color={T.accent} />
            </View>
          </Pressable>

          {/* DESCRIPTION */}
          {product.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About this Product</Text>
              <Text style={styles.descText}>{product.description}</Text>
            </View>
          ) : null}

          {/* PRODUCT DETAILS */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Product Details</Text>
            <View style={styles.detailTable}>
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>Category</Text>
                <Text style={styles.detailValue}>{product.category || 'General'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>Location</Text>
                <Text style={styles.detailValue}>{product.city}, {product.state}</Text>
              </View>
              {product.deliveryInfo && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>Delivery</Text>
                  <Text style={styles.detailValue}>{product.deliveryInfo}</Text>
                </View>
              )}
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>Stock</Text>
                <Text style={[styles.detailValue, { color: product.inStock > 0 ? T.green : T.red }]}>
                  {product.inStock > 0 ? `${product.inStock} available` : 'Out of Stock'}
                </Text>
              </View>
            </View>
          </View>

          {/* RATINGS & REVIEWS */}
          <View style={styles.section}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={styles.sectionTitle}>Ratings & Reviews</Text>
            </View>
            <View style={styles.ratingOverview}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 48, fontFamily: 'Inter_700Bold', color: T.text }}>{fakeRating.toFixed(1)}</Text>
                <StarRating rating={fakeRating} size={16} />
                <Text style={{ color: T.muted, fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 4 }}>{fakeRatingCount} reviews</Text>
              </View>
              <View style={{ flex: 1, paddingLeft: 20, gap: 5 }}>
                {[5, 4, 3, 2, 1].map(star => {
                  const pct = star === 5 ? 60 : star === 4 ? 25 : star === 3 ? 10 : star === 2 ? 3 : 2;
                  return (
                    <View key={star} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ color: T.muted, fontSize: 11, width: 8, fontFamily: 'Inter_400Regular' }}>{star}</Text>
                      <Ionicons name="star" size={10} color="#F59E0B" />
                      <View style={{ flex: 1, height: 4, backgroundColor: T.cardSurface, borderRadius: 2, overflow: 'hidden' }}>
                        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: '#F59E0B', borderRadius: 2 }} />
                      </View>
                      <Text style={{ color: T.muted, fontSize: 10, width: 24, textAlign: 'right', fontFamily: 'Inter_400Regular' }}>{pct}%</Text>
                    </View>
                  );
                })}
              </View>
            </View>
            <View style={{ gap: 12 }}>
              {FAKE_REVIEWS.map((r, i) => (
                <View key={i} style={styles.reviewCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: T.cardSurface, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: T.accent, fontFamily: 'Inter_700Bold', fontSize: 14 }}>{r.name[0]}</Text>
                      </View>
                      <View>
                        <Text style={{ color: T.text, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>{r.name}</Text>
                        <StarRating rating={r.rating} size={11} />
                      </View>
                    </View>
                    <Text style={{ color: T.muted, fontSize: 11, fontFamily: 'Inter_400Regular' }}>{r.time}</Text>
                  </View>
                  <Text style={{ color: T.textSub, fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19 }}>{r.text}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* BOTTOM ACTION BAR */}
      {!isOwner && (
        <View style={[styles.bottomBar, { paddingBottom: (Platform.OS === 'web' ? 34 : insets.bottom) + 10 }]}>
          <Pressable onPress={contactSeller} style={styles.chatBtn}>
            <Ionicons name="chatbubble-outline" size={20} color={T.accent} />
          </Pressable>
          {product.contactPhone && (
            <Pressable onPress={() => Linking.openURL(`tel:${product.contactPhone}`)} style={styles.chatBtn}>
              <Ionicons name="call-outline" size={20} color={T.accent} />
            </Pressable>
          )}
          <Animated.View style={{ flex: 1, transform: [{ scale: addedAnim }] }}>
            <Pressable
              onPress={handleAddToCart}
              disabled={product.inStock === 0}
              style={[styles.addCartBtn, inCart && styles.addCartBtnActive, product.inStock === 0 && { backgroundColor: T.cardSurface }]}
            >
              <Ionicons name={inCart ? 'cart' : 'cart-outline'} size={18} color="#fff" />
              <Text style={styles.addCartText}>
                {inCart ? `In Cart (${cartQty})` : 'Add to Cart'}
              </Text>
            </Pressable>
          </Animated.View>
          <Pressable
            onPress={() => {
              handleAddToCart();
              router.push('/cart');
            }}
            disabled={product.inStock === 0}
            style={[styles.buyNowBtn, product.inStock === 0 && { backgroundColor: T.cardSurface }]}
          >
            <Text style={styles.buyNowText}>Buy Now</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  floatingNav: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', zIndex: 10 },
  floatBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 16, paddingTop: 16 },
  price: { fontSize: 28, fontFamily: 'Inter_700Bold', color: T.text },
  originalPrice: { fontSize: 16, fontFamily: 'Inter_400Regular', color: T.muted, textDecorationLine: 'line-through' },
  discountPill: { backgroundColor: '#2A3A1A', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  discountPillText: { color: T.green, fontSize: 12, fontFamily: 'Inter_700Bold' },
  title: { fontSize: 18, fontFamily: 'Inter_600SemiBold', color: T.text, lineHeight: 26 },
  deliveryBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.card, borderRadius: 12, padding: 12, marginTop: 16, borderWidth: 1, borderColor: T.border },
  supplierCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.card, borderRadius: 16, padding: 14, marginTop: 16, borderWidth: 1, borderColor: T.border },
  supplierAvatarWrap: { borderRadius: 24, overflow: 'hidden', borderWidth: 2, borderColor: T.accent },
  supplierAvatar: { width: 48, height: 48, borderRadius: 24 },
  supplierName: { color: T.text, fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  section: { marginTop: 24 },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: T.text, marginBottom: 12 },
  descText: { color: T.textSub, fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  detailTable: { backgroundColor: T.card, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: T.border },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: T.border },
  detailKey: { color: T.muted, fontSize: 13, fontFamily: 'Inter_400Regular' },
  detailValue: { color: T.text, fontSize: 13, fontFamily: 'Inter_500Medium' },
  ratingOverview: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: T.border, marginBottom: 14 },
  reviewCard: { backgroundColor: T.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: T.border },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#0A0A14', borderTopWidth: 1, borderTopColor: T.border },
  chatBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: T.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: T.border },
  addCartBtn: { flex: 1, height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: T.card, borderRadius: 24, borderWidth: 1, borderColor: T.accent },
  addCartBtnActive: { backgroundColor: T.green, borderColor: T.green },
  addCartText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold' },
  buyNowBtn: { paddingHorizontal: 18, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: T.accent, borderRadius: 24 },
  buyNowText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold' },
});
