import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { T } from '@/constants/techTheme';
import { useCart } from '@/lib/cart-context';
import { useApp } from '@/lib/context';
import { apiRequest } from '@/lib/query-client';

const webTop = Platform.OS === 'web' ? 67 : 0;

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const { items, totalPrice, totalItems, clearCart } = useCart();
  const { profile } = useApp();

  const [name, setName] = useState(profile?.name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState(profile?.city || '');
  const [state, setState] = useState(profile?.state || '');
  const [pincode, setPincode] = useState('');
  const [notes, setNotes] = useState('');
  const [placing, setPlacing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState('');

  const deliveryFee = totalPrice > 999 ? 0 : 49;
  const grandTotal = totalPrice + deliveryFee;

  const validate = () => {
    if (!name.trim()) return 'Please enter your full name';
    if (!phone.trim() || phone.replace(/\D/g, '').length < 10) return 'Please enter a valid phone number';
    if (!address.trim()) return 'Please enter your delivery address';
    if (!city.trim()) return 'Please enter your city';
    if (!pincode.trim() || pincode.length < 6) return 'Please enter a valid 6-digit pincode';
    return null;
  };

  const handlePlaceOrder = async () => {
    const err = validate();
    if (err) { Alert.alert('Missing Info', err); return; }
    if (items.length === 0) { Alert.alert('Empty Cart', 'Your cart is empty'); return; }

    setPlacing(true);
    try {
      const shippingAddr = `${address}, ${city}, ${state} - ${pincode}`;
      const orderPromises = items.map(item =>
        apiRequest('POST', '/api/orders', {
          productId: item.productId,
          productTitle: item.title,
          buyerId: profile?.id,
          buyerName: name,
          buyerPhone: phone,
          sellerId: item.supplierId,
          quantity: item.quantity,
          totalPrice: (item.price * item.quantity).toString(),
          shippingAddress: shippingAddr,
          notes,
          status: 'pending',
        })
      );
      const results = await Promise.all(orderPromises);
      const first = await results[0].json();
      const newOrderId = first?.order?.id || first?.id || `ORD${Date.now()}`;

      clearCart();
      setOrderId(newOrderId);
      setSuccess(true);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert('Order Failed', e?.message || 'Could not place order. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  if (success) {
    return (
      <View style={styles.container}>
        <View style={[styles.successContainer, { paddingTop: (Platform.OS === 'web' ? webTop : insets.top) + 40, paddingBottom: insets.bottom + 40 }]}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={48} color="#fff" />
          </View>
          <Text style={styles.successTitle}>Order Placed!</Text>
          <Text style={styles.successSub}>Your order has been placed successfully</Text>
          {orderId && (
            <View style={styles.orderIdBox}>
              <Text style={styles.orderIdLabel}>Order ID</Text>
              <Text style={styles.orderIdText}>#{orderId.slice(-8).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.successDetails}>
            <View style={styles.successDetailRow}>
              <Ionicons name="cube-outline" size={18} color={T.muted} />
              <Text style={styles.successDetailText}>{totalItems} item{totalItems !== 1 ? 's' : ''} ordered</Text>
            </View>
            <View style={styles.successDetailRow}>
              <Ionicons name="location-outline" size={18} color={T.muted} />
              <Text style={styles.successDetailText}>{address}, {city}</Text>
            </View>
            <View style={styles.successDetailRow}>
              <Ionicons name="time-outline" size={18} color={T.muted} />
              <Text style={styles.successDetailText}>Estimated delivery: 3–7 business days</Text>
            </View>
          </View>
          <Pressable onPress={() => router.replace('/(tabs)/marketplace')} style={styles.continueBtn}>
            <Text style={styles.continueBtnText}>Continue Shopping</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/my-orders')} style={styles.viewOrdersBtn}>
            <Text style={styles.viewOrdersBtnText}>View My Orders</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: (Platform.OS === 'web' ? webTop : insets.top) + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={T.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 20 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* DELIVERY DETAILS */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons name="location" size={16} color="#fff" />
            </View>
            <Text style={styles.sectionTitle}>Delivery Details</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Full Name *</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Enter your full name" placeholderTextColor={T.placeholder} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Phone Number *</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Enter phone number" placeholderTextColor={T.placeholder} keyboardType="phone-pad" />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Delivery Address *</Text>
            <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]} value={address} onChangeText={setAddress} placeholder="House no., Street, Area..." placeholderTextColor={T.placeholder} multiline />
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>City *</Text>
              <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="City" placeholderTextColor={T.placeholder} />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>State</Text>
              <TextInput style={styles.input} value={state} onChangeText={setState} placeholder="State" placeholderTextColor={T.placeholder} />
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Pincode *</Text>
            <TextInput style={styles.input} value={pincode} onChangeText={setPincode} placeholder="6-digit pincode" placeholderTextColor={T.placeholder} keyboardType="number-pad" maxLength={6} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Order Notes (Optional)</Text>
            <TextInput style={[styles.input, { height: 70, textAlignVertical: 'top', paddingTop: 12 }]} value={notes} onChangeText={setNotes} placeholder="Any special instructions..." placeholderTextColor={T.placeholder} multiline />
          </View>
        </View>

        {/* ORDER SUMMARY */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: T.blue }]}>
              <Ionicons name="receipt" size={16} color="#fff" />
            </View>
            <Text style={styles.sectionTitle}>Order Summary</Text>
          </View>
          {items.map(item => (
            <View key={item.id} style={styles.orderItem}>
              <Text style={styles.orderItemName} numberOfLines={1}>{item.title}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.orderItemQty}>x{item.quantity}</Text>
                <Text style={styles.orderItemPrice}>₹{(item.price * item.quantity).toLocaleString('en-IN')}</Text>
              </View>
            </View>
          ))}
          <View style={[styles.orderItem, { borderTopWidth: 1, borderTopColor: T.border, marginTop: 8, paddingTop: 12 }]}>
            <Text style={{ color: T.muted, fontFamily: 'Inter_400Regular', fontSize: 13 }}>Delivery</Text>
            <Text style={{ color: deliveryFee === 0 ? T.green : T.text, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>
              {deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}
            </Text>
          </View>
          <View style={[styles.orderItem, { paddingTop: 8 }]}>
            <Text style={{ color: T.text, fontFamily: 'Inter_700Bold', fontSize: 16 }}>Total</Text>
            <Text style={{ color: T.accent, fontFamily: 'Inter_700Bold', fontSize: 18 }}>₹{grandTotal.toLocaleString('en-IN')}</Text>
          </View>
        </View>

        {/* PAYMENT NOTE */}
        <View style={styles.paymentNote}>
          <Ionicons name="shield-checkmark" size={20} color={T.green} />
          <Text style={styles.paymentNoteText}>Cash on Delivery / Bank Transfer. Supplier will contact you with payment details after order confirmation.</Text>
        </View>
      </ScrollView>

      {/* PLACE ORDER */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          onPress={handlePlaceOrder}
          disabled={placing}
          style={({ pressed }) => [styles.placeBtn, { opacity: pressed || placing ? 0.85 : 1 }]}
        >
          {placing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Text style={styles.placeBtnText}>Place Order · ₹{grandTotal.toLocaleString('en-IN')}</Text>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A14' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: T.border },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: T.card, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontFamily: 'Inter_700Bold', color: T.text },
  section: { backgroundColor: T.card, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: T.border },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  sectionIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: T.text },
  field: { marginBottom: 14 },
  label: { color: T.muted, fontSize: 12, fontFamily: 'Inter_600SemiBold', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: T.cardSurface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: T.text, fontSize: 14, fontFamily: 'Inter_400Regular', borderWidth: 1, borderColor: T.border },
  orderItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  orderItemName: { color: T.text, fontSize: 13, fontFamily: 'Inter_500Medium', flex: 1, marginRight: 8 },
  orderItemQty: { color: T.muted, fontSize: 12, fontFamily: 'Inter_400Regular' },
  orderItemPrice: { color: T.accent, fontSize: 14, fontFamily: 'Inter_700Bold', minWidth: 70, textAlign: 'right' },
  paymentNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)', marginBottom: 16 },
  paymentNoteText: { flex: 1, color: T.muted, fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 19 },
  footer: { borderTopWidth: 1, borderTopColor: T.border, padding: 16 },
  placeBtn: { backgroundColor: T.accent, borderRadius: 16, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  placeBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  successIcon: { width: 100, height: 100, borderRadius: 50, backgroundColor: T.green, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  successTitle: { fontSize: 28, fontFamily: 'Inter_700Bold', color: T.text },
  successSub: { fontSize: 15, color: T.muted, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 8 },
  orderIdBox: { marginTop: 20, backgroundColor: T.card, borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: T.border, width: '100%' },
  orderIdLabel: { color: T.muted, fontSize: 12, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 1 },
  orderIdText: { color: T.accent, fontSize: 20, fontFamily: 'Inter_700Bold', marginTop: 4 },
  successDetails: { marginTop: 24, width: '100%', gap: 14 },
  successDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  successDetailText: { color: T.muted, fontSize: 14, fontFamily: 'Inter_400Regular', flex: 1 },
  continueBtn: { marginTop: 28, backgroundColor: T.accent, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, width: '100%', alignItems: 'center' },
  continueBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
  viewOrdersBtn: { marginTop: 12, paddingVertical: 12, width: '100%', alignItems: 'center' },
  viewOrdersBtnText: { color: T.accent, fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
