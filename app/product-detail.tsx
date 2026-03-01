import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform,
  Dimensions, Alert, Linking, Modal, TextInput, KeyboardAvoidingView,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import Colors from '@/constants/colors';
import { useApp } from '@/lib/context';
import { apiRequest, getApiUrl } from '@/lib/query-client';
import { openLink } from '@/lib/open-link';
import { Product, ROLE_LABELS } from '@/lib/types';

const C = Colors.dark;
const { width } = Dimensions.get('window');

export default function ProductDetailScreen() {
  const params = useLocalSearchParams<{ id: string; productId: string }>();
  const id = params.productId || params.id;
  const insets = useSafeAreaInsets();
  const { profile, startConversation } = useApp();
  const [product, setProduct] = useState<Product | null>(null);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [liked, setLiked] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderQty, setOrderQty] = useState('1');
  const [shippingAddr, setShippingAddr] = useState('');
  const [buyerNotes, setBuyerNotes] = useState('');
  const [ordering, setOrdering] = useState(false);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

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

  useEffect(() => {
    if (profile) {
      setShippingAddr(`${profile.city}, ${profile.state}`);
    }
  }, [profile]);

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

  const contactSeller = async () => {
    if (!product || !profile) return;
    try {
      const convoId = await startConversation(product.userId, product.userName, product.userRole as any);
      if (convoId) router.push({ pathname: '/chat/[id]', params: { id: convoId } });
    } catch (e) {
      Alert.alert('Error', 'Could not start conversation');
    }
  };

  const callSeller = () => {
    if (product?.contactPhone) {
      Linking.openURL(`tel:${product.contactPhone}`);
    }
  };

  const placeOrder = async () => {
    if (!product || !profile) return;
    const qty = parseInt(orderQty) || 1;
    const total = (parseInt(product.price) || 0) * qty;

    setOrdering(true);
    try {
      const res = await apiRequest('POST', '/api/orders', {
        productId: product.id,
        productTitle: product.title,
        productPrice: product.price,
        productImage: product.images?.[0] || '',
        productCategory: product.category,
        buyerId: profile.id,
        buyerName: profile.name,
        buyerPhone: profile.phone,
        buyerCity: profile.city,
        buyerState: profile.state,
        sellerId: product.userId,
        sellerName: product.userName,
        sellerRole: product.userRole,
        quantity: qty,
        totalAmount: total.toString(),
        shippingAddress: shippingAddr,
        buyerNotes,
      });
      const data = await res.json();
      if (data.success) {
        setShowOrderModal(false);
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Order Placed',
          `Your order for "${product.title}" has been sent to ${product.userName}. They will confirm it soon.`,
          [
            { text: 'View My Orders', onPress: () => router.push('/my-orders') },
            { text: 'OK' },
          ]
        );
      } else {
        Alert.alert('Error', data.message || 'Failed to place order');
      }
    } catch (e) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setOrdering(false);
    }
  };

  if (!product) {
    return (
      <View style={[styles.container, { paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={C.text} />
        </Pressable>
        <View style={styles.loadingState}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  const isTeacher = product.userRole === 'teacher';
  const isOwner = profile?.id === product.userId;
  const hasImages = product.images && product.images.length > 0;
  const qty = parseInt(orderQty) || 1;
  const totalPrice = (parseInt(product.price) || 0) * qty;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }}>
        <View style={{ paddingTop: Platform.OS === 'web' ? webTopInset : insets.top }}>
          <View style={styles.topActions}>
            <Pressable onPress={() => router.back()} style={styles.circleBtn} hitSlop={12}>
              <Ionicons name="arrow-back" size={22} color={C.text} />
            </Pressable>
            <Pressable onPress={toggleLike} style={styles.circleBtn} hitSlop={12}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? C.error : C.text} />
            </Pressable>
          </View>
        </View>

        {hasImages ? (
          <View>
            <ScrollView
              horizontal pagingEnabled showsHorizontalScrollIndicator={false}
              onScroll={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / width);
                setActiveImageIdx(idx);
              }}
              scrollEventThrottle={16}
            >
              {product.images.map((img, i) => (
                <Image
                  key={i}
                  source={{ uri: img.startsWith('/') ? `${getApiUrl()}${img}` : img }}
                  style={styles.heroImage}
                  contentFit="cover"
                />
              ))}
            </ScrollView>
            {product.images.length > 1 && (
              <View style={styles.dotsRow}>
                {product.images.map((_, i) => (
                  <View key={i} style={[styles.dot, i === activeImageIdx && styles.dotActive]} />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.noImageBox}>
            <Ionicons name={isTeacher ? 'school' : 'cube'} size={64} color={C.textTertiary} />
          </View>
        )}

        <View style={styles.content}>
          <View style={styles.priceBadge}>
            <Text style={styles.priceText}>Rs. {product.price}</Text>
          </View>

          <Text style={styles.title}>{product.title}</Text>

          <View style={styles.sellerRow}>
            <View style={styles.sellerInfo}>
              {product.userAvatar ? (
                <Image source={{ uri: product.userAvatar.startsWith('/') ? `${getApiUrl()}${product.userAvatar}` : product.userAvatar }} style={styles.sellerAvatar} />
              ) : (
                <View style={[styles.sellerAvatar, styles.sellerAvatarPlaceholder]}>
                  <Text style={styles.sellerInitial}>{product.userName[0]}</Text>
                </View>
              )}
              <View>
                <Text style={styles.sellerName}>{product.userName}</Text>
                <Text style={styles.sellerRole}>{ROLE_LABELS[product.userRole as keyof typeof ROLE_LABELS] || product.userRole}</Text>
              </View>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaChip}>
              <Ionicons name="eye-outline" size={14} color={C.textSecondary} />
              <Text style={styles.metaValue}>{product.views} views</Text>
            </View>
            <View style={styles.metaChip}>
              <Ionicons name="heart-outline" size={14} color={C.textSecondary} />
              <Text style={styles.metaValue}>{product.likes?.length || 0} likes</Text>
            </View>
            <View style={styles.metaChip}>
              <Ionicons name="location-outline" size={14} color={C.textSecondary} />
              <Text style={styles.metaValue}>{product.city}, {product.state}</Text>
            </View>
          </View>

          {product.inStock ? (
            <View style={styles.stockTag}>
              <Ionicons name="checkmark-circle" size={16} color={C.success} />
              <Text style={[styles.stockTagText, { color: C.success }]}>Available</Text>
            </View>
          ) : (
            <View style={styles.stockTag}>
              <Ionicons name="close-circle" size={16} color={C.error} />
              <Text style={[styles.stockTagText, { color: C.error }]}>Out of Stock</Text>
            </View>
          )}

          {product.videoUrl ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Video</Text>
              <Pressable
                style={styles.videoBox}
                onPress={() => {
                  const videoSrc = product.videoUrl!.startsWith('/') ? `${getApiUrl()}${product.videoUrl}` : product.videoUrl!;
                  openLink(videoSrc, 'Video');
                }}
              >
                <View style={styles.videoPlayOverlay}>
                  <Ionicons name="play-circle" size={48} color={C.primary} />
                </View>
                <Text style={styles.videoLabel}>Tap to play video</Text>
              </Pressable>
            </View>
          ) : null}

          {product.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.descText}>{product.description}</Text>
            </View>
          ) : null}

          {product.deliveryInfo ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{isTeacher ? 'Access Info' : 'Delivery Info'}</Text>
              <View style={styles.deliveryBox}>
                <Ionicons name={isTeacher ? 'cloud-download-outline' : 'car-outline'} size={18} color={C.primary} />
                <Text style={styles.deliveryText}>{product.deliveryInfo}</Text>
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {!isOwner && (
        <View style={[styles.bottomBar, { paddingBottom: (Platform.OS === 'web' ? 34 : insets.bottom) + 12 }]}>
          <Pressable style={styles.chatBtn} onPress={contactSeller}>
            <Ionicons name="chatbubble-outline" size={22} color={C.primary} />
          </Pressable>
          {product.contactPhone && (
            <Pressable style={styles.chatBtn} onPress={callSeller}>
              <Ionicons name="call-outline" size={22} color={C.primary} />
            </Pressable>
          )}
          <Pressable
            style={[styles.buyBtn, !product.inStock && styles.buyBtnDisabled]}
            onPress={() => product.inStock && setShowOrderModal(true)}
            disabled={!product.inStock}
          >
            <Ionicons name="cart" size={20} color="#FFF" />
            <Text style={styles.buyBtnText}>{isTeacher ? 'Buy Now' : 'Order Now'}</Text>
          </Pressable>
        </View>
      )}

      <Modal visible={showOrderModal} transparent animationType="slide" onRequestClose={() => setShowOrderModal(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalKeyboard}>
            <View style={[styles.modalContent, { paddingBottom: (Platform.OS === 'web' ? 34 : insets.bottom) + 20 }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{isTeacher ? 'Buy Content' : 'Place Order'}</Text>
                <Pressable onPress={() => setShowOrderModal(false)} hitSlop={12}>
                  <Ionicons name="close" size={24} color={C.text} />
                </Pressable>
              </View>

              <View style={styles.orderProduct}>
                <Text style={styles.orderProductName} numberOfLines={2}>{product.title}</Text>
                <Text style={styles.orderProductPrice}>Rs. {product.price} each</Text>
              </View>

              {!isTeacher && (
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Quantity</Text>
                  <View style={styles.qtyRow}>
                    <Pressable style={styles.qtyBtn} onPress={() => setOrderQty(Math.max(1, qty - 1).toString())}>
                      <Ionicons name="remove" size={20} color={C.text} />
                    </Pressable>
                    <TextInput
                      style={styles.qtyInput}
                      value={orderQty}
                      onChangeText={setOrderQty}
                      keyboardType="number-pad"
                      maxLength={3}
                    />
                    <Pressable style={styles.qtyBtn} onPress={() => setOrderQty((qty + 1).toString())}>
                      <Ionicons name="add" size={20} color={C.text} />
                    </Pressable>
                  </View>
                </View>
              )}

              {!isTeacher && (
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Shipping Address</Text>
                  <TextInput
                    style={styles.formInput}
                    value={shippingAddr}
                    onChangeText={setShippingAddr}
                    placeholder="Enter delivery address..."
                    placeholderTextColor={C.textTertiary}
                    multiline
                  />
                </View>
              )}

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Note to Seller (optional)</Text>
                <TextInput
                  style={styles.formInput}
                  value={buyerNotes}
                  onChangeText={setBuyerNotes}
                  placeholder="Any special instructions..."
                  placeholderTextColor={C.textTertiary}
                  multiline
                />
              </View>

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>Rs. {totalPrice}</Text>
              </View>

              <Text style={styles.paymentNote}>
                Payment will be arranged directly with the seller after they confirm your order.
              </Text>

              <Pressable
                style={[styles.placeOrderBtn, ordering && { opacity: 0.6 }]}
                onPress={placeOrder}
                disabled={ordering}
              >
                <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                <Text style={styles.placeOrderText}>{ordering ? 'Placing Order...' : 'Confirm Order'}</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  backBtn: { paddingHorizontal: 16, paddingVertical: 8 },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: C.textTertiary, fontSize: 16 },
  topActions: {
    position: 'absolute' as const, top: 12, left: 16, right: 16, zIndex: 10,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  circleBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(13,13,15,0.7)', alignItems: 'center', justifyContent: 'center',
  },
  heroImage: { width, height: width * 0.75 },
  noImageBox: {
    width, height: 200, backgroundColor: C.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.textTertiary },
  dotActive: { backgroundColor: C.primary, width: 18 },
  content: { paddingHorizontal: 20, paddingTop: 16 },
  priceBadge: {
    alignSelf: 'flex-start' as const,
    backgroundColor: C.primaryMuted, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
  },
  priceText: { color: C.primary, fontSize: 20, fontFamily: 'Inter_700Bold' },
  title: { color: C.text, fontSize: 22, fontFamily: 'Inter_700Bold', marginTop: 12, lineHeight: 28 },
  sellerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 16, padding: 14, backgroundColor: C.surface, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
  },
  sellerInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sellerAvatar: { width: 40, height: 40, borderRadius: 20 },
  sellerAvatarPlaceholder: { backgroundColor: C.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  sellerInitial: { color: C.primary, fontSize: 18, fontFamily: 'Inter_700Bold' },
  sellerName: { color: C.text, fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  sellerRole: { color: C.textTertiary, fontSize: 12, fontFamily: 'Inter_400Regular' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap' as const, gap: 10, marginTop: 14 },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.surface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    borderWidth: 1, borderColor: C.border,
  },
  metaValue: { color: C.textSecondary, fontSize: 12, fontFamily: 'Inter_400Regular' },
  stockTag: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  stockTagText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  section: { marginTop: 20 },
  sectionTitle: { color: C.text, fontSize: 16, fontFamily: 'Inter_600SemiBold', marginBottom: 8 },
  descText: { color: C.textSecondary, fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  deliveryBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.surface, padding: 14, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
  },
  deliveryText: { color: C.textSecondary, fontSize: 14, fontFamily: 'Inter_400Regular', flex: 1 },
  videoBox: {
    backgroundColor: C.surface, borderRadius: 14, padding: 24,
    borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center',
  },
  videoPlayOverlay: { marginBottom: 8 },
  videoLabel: { color: C.textSecondary, fontSize: 14, fontFamily: 'Inter_500Medium' },
  bottomBar: {
    position: 'absolute' as const, bottom: 0, left: 0, right: 0,
    flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12,
    backgroundColor: C.background, borderTopWidth: 1, borderTopColor: C.border, gap: 10,
  },
  chatBtn: {
    width: 50, height: 50, borderRadius: 25,
    borderWidth: 2, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  buyBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.primary, borderRadius: 25, height: 50,
  },
  buyBtnDisabled: { backgroundColor: C.textTertiary },
  buyBtnText: { color: '#FFF', fontSize: 16, fontFamily: 'Inter_700Bold' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end',
  },
  modalKeyboard: { justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 20,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20,
  },
  modalTitle: { color: C.text, fontSize: 20, fontFamily: 'Inter_700Bold' },
  orderProduct: {
    backgroundColor: C.background, borderRadius: 12, padding: 14,
    marginBottom: 16, borderWidth: 1, borderColor: C.border,
  },
  orderProductName: { color: C.text, fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  orderProductPrice: { color: C.primary, fontSize: 14, fontFamily: 'Inter_500Medium', marginTop: 4 },
  formGroup: { marginBottom: 14 },
  formLabel: { color: C.textSecondary, fontSize: 13, fontFamily: 'Inter_500Medium', marginBottom: 6 },
  formInput: {
    backgroundColor: C.background, borderRadius: 12, padding: 14,
    color: C.text, fontSize: 14, fontFamily: 'Inter_400Regular',
    borderWidth: 1, borderColor: C.border, minHeight: 44, textAlignVertical: 'top' as const,
  },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: C.background,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border,
  },
  qtyInput: {
    width: 60, height: 44, backgroundColor: C.background, borderRadius: 12, textAlign: 'center' as const,
    color: C.text, fontSize: 18, fontFamily: 'Inter_600SemiBold', borderWidth: 1, borderColor: C.border,
  },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: C.primaryMuted, borderRadius: 12, padding: 16, marginTop: 4, marginBottom: 8,
  },
  totalLabel: { color: C.text, fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  totalValue: { color: C.primary, fontSize: 22, fontFamily: 'Inter_700Bold' },
  paymentNote: {
    color: C.textTertiary, fontSize: 12, fontFamily: 'Inter_400Regular',
    textAlign: 'center' as const, marginBottom: 16, lineHeight: 18,
  },
  placeOrderBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#30D158', borderRadius: 25, height: 52,
  },
  placeOrderText: { color: '#FFF', fontSize: 16, fontFamily: 'Inter_700Bold' },
});
