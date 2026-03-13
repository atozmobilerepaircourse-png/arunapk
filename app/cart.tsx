import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { T } from '@/constants/techTheme';
import { useCart } from '@/lib/cart-context';

const webTop = Platform.OS === 'web' ? 67 : 0;

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const { items, totalItems, totalPrice, removeFromCart, updateQuantity, clearCart } = useCart();

  const handleRemove = (productId: string, title: string) => {
    Alert.alert('Remove Item', `Remove "${title}" from cart?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => { removeFromCart(productId); if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } },
    ]);
  };

  const handleClear = () => {
    Alert.alert('Clear Cart', 'Remove all items from your cart?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear All', style: 'destructive', onPress: () => clearCart() },
    ]);
  };

  const deliveryFee = totalPrice > 999 ? 0 : 49;
  const grandTotal = totalPrice + deliveryFee;

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: (Platform.OS === 'web' ? webTop : insets.top) + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={T.text} />
        </Pressable>
        <Text style={styles.headerTitle}>My Cart</Text>
        {items.length > 0 && (
          <Pressable onPress={handleClear} style={styles.clearBtn}>
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        )}
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="cart-outline" size={80} color={T.muted} />
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptyMsg}>Add products from the marketplace to get started</Text>
          <Pressable onPress={() => router.back()} style={styles.shopBtn}>
            <Text style={styles.shopBtnText}>Browse Products</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
            {/* CART ITEMS */}
            {items.map((item, idx) => (
              <View key={item.id} style={[styles.itemCard, idx < items.length - 1 && { marginBottom: 12 }]}>
                <View style={styles.itemImgWrap}>
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.itemImg} contentFit="cover" />
                  ) : (
                    <View style={[styles.itemImg, { backgroundColor: T.card, alignItems: 'center', justifyContent: 'center' }]}>
                      <Ionicons name="cube-outline" size={28} color={T.muted} />
                    </View>
                  )}
                </View>
                <View style={styles.itemBody}>
                  <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                    <Ionicons name="storefront-outline" size={11} color={T.muted} />
                    <Text style={styles.itemSupplier}>{item.supplierName}</Text>
                  </View>
                  <Text style={styles.itemPrice}>₹{(item.price * item.quantity).toLocaleString('en-IN')}</Text>
                  <View style={styles.qtyRow}>
                    <View style={styles.qtyControl}>
                      <Pressable
                        onPress={() => updateQuantity(item.productId, item.quantity - 1)}
                        style={styles.qtyBtn}
                      >
                        <Ionicons name={item.quantity === 1 ? 'trash-outline' : 'remove'} size={16} color={item.quantity === 1 ? T.red : T.text} />
                      </Pressable>
                      <Text style={styles.qtyNum}>{item.quantity}</Text>
                      <Pressable
                        onPress={() => updateQuantity(item.productId, Math.min(item.quantity + 1, item.inStock || 99))}
                        style={styles.qtyBtn}
                        disabled={item.quantity >= (item.inStock || 99)}
                      >
                        <Ionicons name="add" size={16} color={item.quantity >= (item.inStock || 99) ? T.muted : T.text} />
                      </Pressable>
                    </View>
                    <Pressable onPress={() => handleRemove(item.productId, item.title)}>
                      <Text style={{ color: T.red, fontSize: 12, fontFamily: 'Inter_500Medium' }}>Remove</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}

            {/* ORDER SUMMARY */}
            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>Order Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal ({totalItems} items)</Text>
                <Text style={styles.summaryValue}>₹{totalPrice.toLocaleString('en-IN')}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Delivery Charges</Text>
                <Text style={[styles.summaryValue, deliveryFee === 0 && { color: T.green }]}>
                  {deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}
                </Text>
              </View>
              {deliveryFee === 0 && (
                <View style={styles.freeDeliveryBadge}>
                  <Ionicons name="checkmark-circle" size={14} color={T.green} />
                  <Text style={{ color: T.green, fontSize: 12, fontFamily: 'Inter_500Medium' }}>Free delivery on orders above ₹999</Text>
                </View>
              )}
              {deliveryFee > 0 && (
                <View style={styles.freeDeliveryBadge}>
                  <Ionicons name="information-circle-outline" size={14} color={T.muted} />
                  <Text style={{ color: T.muted, fontSize: 12, fontFamily: 'Inter_400Regular' }}>
                    Add ₹{999 - totalPrice} more for free delivery
                  </Text>
                </View>
              )}
              <View style={[styles.summaryRow, { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: T.border }]}>
                <Text style={[styles.summaryLabel, { color: T.text, fontFamily: 'Inter_700Bold', fontSize: 16 }]}>Total</Text>
                <Text style={[styles.summaryValue, { color: T.accent, fontSize: 20, fontFamily: 'Inter_700Bold' }]}>₹{grandTotal.toLocaleString('en-IN')}</Text>
              </View>
            </View>
          </ScrollView>

          {/* CHECKOUT BUTTON */}
          <View style={[styles.checkoutBar, { paddingBottom: insets.bottom + 16 }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: T.muted, fontSize: 12, fontFamily: 'Inter_400Regular' }}>{totalItems} items</Text>
              <Text style={{ color: T.accent, fontSize: 18, fontFamily: 'Inter_700Bold' }}>₹{grandTotal.toLocaleString('en-IN')}</Text>
            </View>
            <Pressable
              onPress={() => router.push('/checkout')}
              style={({ pressed }) => [styles.checkoutBtn, { opacity: pressed ? 0.9 : 1 }]}
            >
              <Text style={styles.checkoutBtnText}>Proceed to Checkout</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A14' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: T.border },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: T.card, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontFamily: 'Inter_700Bold', color: T.text },
  clearBtn: { padding: 8 },
  clearText: { color: T.red, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', color: T.text, marginTop: 20 },
  emptyMsg: { fontSize: 14, color: T.muted, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 8 },
  shopBtn: { marginTop: 24, backgroundColor: T.accent, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 },
  shopBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
  itemCard: { flexDirection: 'row', backgroundColor: T.card, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: T.border, padding: 12, gap: 12 },
  itemImgWrap: { borderRadius: 12, overflow: 'hidden' },
  itemImg: { width: 90, height: 90, borderRadius: 12 },
  itemBody: { flex: 1 },
  itemTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: T.text, lineHeight: 19 },
  itemSupplier: { fontSize: 11, color: T.muted, fontFamily: 'Inter_400Regular' },
  itemPrice: { fontSize: 16, fontFamily: 'Inter_700Bold', color: T.accent, marginTop: 6 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  qtyControl: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.cardSurface, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: T.border },
  qtyBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  qtyNum: { minWidth: 32, textAlign: 'center', color: T.text, fontSize: 15, fontFamily: 'Inter_700Bold' },
  summary: { backgroundColor: T.card, borderRadius: 16, padding: 16, marginTop: 16, borderWidth: 1, borderColor: T.border },
  summaryTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: T.text, marginBottom: 14 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  summaryLabel: { fontSize: 14, color: T.muted, fontFamily: 'Inter_400Regular' },
  summaryValue: { fontSize: 14, color: T.text, fontFamily: 'Inter_600SemiBold' },
  freeDeliveryBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: 8, padding: 10, marginTop: 2, marginBottom: 4 },
  checkoutBar: { borderTopWidth: 1, borderTopColor: T.border, backgroundColor: '#0A0A14', paddingHorizontal: 16, paddingTop: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.accent, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 14 },
  checkoutBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
});
