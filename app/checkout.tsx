import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Platform, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCart } from '@/lib/cart-context';
import { useApp } from '@/lib/context';
import { apiRequest } from '@/lib/query-client';

// ─── MarketHub Light Theme ───────────────────────────────────────────────────
const T = {
  bg: '#F9FAFB', card: '#FFFFFF', cardSurface: '#F3F4F6', bgElevated: '#FFFFFF',
  border: '#E5E7EB', text: '#111827', muted: '#9CA3AF', textSub: '#4B5563',
  accent: '#1B4D3E', accentMuted: '#D1FAE5', green: '#10B981', red: '#EF4444',
};

const webTop = Platform.OS === 'web' ? 67 : 0;

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const { items, totalPrice, clearCart } = useCart();
  const { profile } = useApp();

  const [name, setName] = useState(profile?.name || '');
  const [phone, setPhone] = useState(profile?.phone?.replace(/\D/g, '').slice(-10) || '');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState(profile?.city || '');
  const [pincode, setPincode] = useState('');
  const [notes, setNotes] = useState('');
  const [placing, setPlacing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'online'>('cod');

  const topInset = Platform.OS === 'web' ? webTop : insets.top;
  const deliveryCharge = totalPrice > 999 ? 0 : 49;
  const grandTotal = totalPrice + deliveryCharge;

  const validate = () => {
    if (!name.trim()) { Alert.alert('Required', 'Please enter your name'); return false; }
    if (!phone.trim() || phone.length < 10) { Alert.alert('Required', 'Please enter a valid phone number'); return false; }
    if (!address.trim()) { Alert.alert('Required', 'Please enter your delivery address'); return false; }
    if (!city.trim()) { Alert.alert('Required', 'Please enter your city'); return false; }
    if (!pincode.trim() || pincode.length !== 6) { Alert.alert('Required', 'Please enter a valid 6-digit pincode'); return false; }
    return true;
  };

  const placeOrder = async () => {
    setPlacing(true);
    try {
      const addr = `${address}, ${city} - ${pincode}`;
      
      for (const item of items) {
        await apiRequest('POST', '/api/orders', {
          productId: item.productId,
          productTitle: item.title,
          productPrice: item.price.toString(),
          productImage: item.image,
          productCategory: item.category,
          buyerId: profile?.id || '',
          buyerName: name,
          buyerPhone: phone,
          buyerCity: city,
          buyerState: profile?.state || '',
          sellerId: item.supplierId,
          sellerName: item.supplierName,
          sellerRole: 'supplier',
          quantity: item.quantity,
          totalAmount: (item.price * item.quantity).toString(),
          shippingAddress: addr,
          buyerNotes: notes,
          status: 'pending',
        });
      }

      clearCart();
      Alert.alert('Success!', 'Order placed', [{ text: 'OK', onPress: () => router.push('/(tabs)/marketplace' as any) }]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed');
    } finally {
      setPlacing(false);
    }
  };

  if (items.length === 0) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <Ionicons name="bag-outline" size={52} color={T.muted} />
        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Cart is empty</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtnEmpty}>
          <Text style={{ color: T.accent, fontFamily: 'Inter_600SemiBold' }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={T.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Checkout</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Delivery Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="location-outline" size={16} color={T.accent} /> Delivery Details
          </Text>
          <View style={styles.fieldRow}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Full Name *</Text>
              <TextInput
                value={name} onChangeText={setName}
                placeholder="Your name" placeholderTextColor={T.placeholder}
                style={styles.input} autoCapitalize="words"
              />
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Phone Number *</Text>
            <TextInput
              value={phone} onChangeText={setPhone}
              placeholder="10-digit mobile number" placeholderTextColor={T.placeholder}
              style={styles.input} keyboardType="phone-pad" maxLength={10}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Delivery Address *</Text>
            <TextInput
              value={address} onChangeText={setAddress}
              placeholder="House no., Street, Area" placeholderTextColor={T.placeholder}
              style={[styles.input, styles.inputMulti]}
              multiline numberOfLines={3} autoCapitalize="words"
            />
          </View>
          <View style={styles.fieldRow}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>City *</Text>
              <TextInput value={city} onChangeText={setCity} placeholder="City" placeholderTextColor={T.placeholder} style={styles.input} autoCapitalize="words" />
            </View>
            <View style={[styles.field, { width: 120 }]}>
              <Text style={styles.fieldLabel}>Pincode *</Text>
              <TextInput value={pincode} onChangeText={setPincode} placeholder="6 digits" placeholderTextColor={T.placeholder} style={styles.input} keyboardType="numeric" maxLength={6} />
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Order Notes (Optional)</Text>
            <TextInput
              value={notes} onChangeText={setNotes}
              placeholder="Any special instructions..." placeholderTextColor={T.placeholder}
              style={[styles.input, styles.inputMulti]}
              multiline numberOfLines={2}
            />
          </View>
        </View>

        {/* Payment Method */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="card-outline" size={16} color={T.accent} /> Payment Method
          </Text>
          <Pressable
            onPress={() => setPaymentMethod('cod')}
            style={[styles.payOption, paymentMethod === 'cod' && styles.payOptionActive]}
          >
            <Ionicons name="cash-outline" size={22} color={paymentMethod === 'cod' ? T.accent : T.muted} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.payOptionTitle, paymentMethod === 'cod' && { color: T.text }]}>Cash on Delivery</Text>
              <Text style={styles.payOptionSub}>Pay when you receive the product</Text>
            </View>
            <View style={[styles.radio, paymentMethod === 'cod' && styles.radioActive]}>
              {paymentMethod === 'cod' && <View style={styles.radioDot} />}
            </View>
          </Pressable>
          <Pressable
            onPress={() => setPaymentMethod('online')}
            style={[styles.payOption, paymentMethod === 'online' && styles.payOptionActive]}
          >
            <Ionicons name="phone-portrait-outline" size={22} color={paymentMethod === 'online' ? T.accent : T.muted} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.payOptionTitle, paymentMethod === 'online' && { color: T.text }]}>Online Payment</Text>
              <Text style={styles.payOptionSub}>UPI, Card, Net Banking</Text>
            </View>
            <View style={[styles.radio, paymentMethod === 'online' && styles.radioActive]}>
              {paymentMethod === 'online' && <View style={styles.radioDot} />}
            </View>
          </Pressable>
        </View>

        {/* Order Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="receipt-outline" size={16} color={T.accent} /> Order Summary
          </Text>
          {items.map((item) => (
            <View key={item.productId} style={styles.summaryItem}>
              <Text style={styles.summaryItemName} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.summaryItemQty}>×{item.quantity}</Text>
              <Text style={styles.summaryItemPrice}>₹{(item.price * item.quantity).toLocaleString('en-IN')}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryVal}>₹{totalPrice.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery</Text>
            <Text style={[styles.summaryVal, deliveryCharge === 0 && { color: T.green }]}>
              {deliveryCharge === 0 ? 'FREE' : `₹${deliveryCharge}`}
            </Text>
          </View>
          <View style={[styles.summaryRow, { marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: T.border }]}>
            <Text style={[styles.summaryLabel, { fontSize: 16, fontFamily: 'Inter_700Bold', color: T.text }]}>Total</Text>
            <Text style={[styles.summaryVal, { fontSize: 20, color: T.accent }]}>₹{grandTotal.toLocaleString('en-IN')}</Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={[styles.placeBar, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'web' ? 34 : 16) }]}>
        <View>
          <Text style={styles.placeLabel}>Total</Text>
          <Text style={styles.placeTotal}>₹{grandTotal.toLocaleString('en-IN')}</Text>
        </View>
        <Pressable onPress={placeOrder} disabled={placing} style={[styles.placeBtn, placing && { opacity: 0.7 }]}>
          {placing ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color="#FFF" />
              <Text style={styles.placeBtnTxt}>Place Order</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, backgroundColor: T.bgElevated, borderBottomWidth: 1, borderBottomColor: T.border },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: T.card, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  backBtnEmpty: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10 },
  headerTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: T.text },
  content: { padding: 16, gap: 16 },
  section: { backgroundColor: T.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: T.border },
  sectionTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', color: T.text, marginBottom: 14 },
  fieldRow: { flexDirection: 'row', gap: 12 },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, color: T.muted, fontFamily: 'Inter_500Medium', marginBottom: 6 },
  input: { backgroundColor: T.cardSurface, borderRadius: 10, borderWidth: 1, borderColor: T.border, paddingHorizontal: 12, paddingVertical: 10, color: T.text, fontFamily: 'Inter_400Regular', fontSize: 14 },
  inputMulti: { minHeight: 80, textAlignVertical: 'top', paddingTop: 10 },
  payOption: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.cardSurface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: T.border, marginBottom: 10 },
  payOptionActive: { borderColor: T.accent, backgroundColor: T.accentMuted },
  payOptionTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: T.muted },
  payOptionSub: { fontSize: 11, color: T.muted, fontFamily: 'Inter_400Regular', marginTop: 2 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: T.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: T.accent },
  summaryItem: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  summaryItemName: { flex: 1, fontSize: 13, color: T.textSub, fontFamily: 'Inter_400Regular' },
  summaryItemQty: { fontSize: 13, color: T.muted, fontFamily: 'Inter_400Regular' },
  summaryItemPrice: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: T.text },
  divider: { height: 1, backgroundColor: T.border, marginVertical: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  summaryLabel: { fontSize: 14, color: T.textSub, fontFamily: 'Inter_400Regular' },
  summaryVal: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: T.text },
  placeBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, backgroundColor: T.bgElevated, borderTopWidth: 1, borderTopColor: T.border, gap: 16 },
  placeLabel: { fontSize: 11, color: T.muted, fontFamily: 'Inter_400Regular' },
  placeTotal: { fontSize: 20, fontFamily: 'Inter_700Bold', color: T.text },
  placeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: T.accent, borderRadius: 14, paddingVertical: 14 },
  placeBtnTxt: { color: '#FFF', fontFamily: 'Inter_700Bold', fontSize: 16 },
});
