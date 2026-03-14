import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, Platform,
  Alert, RefreshControl, ActivityIndicator, Dimensions, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useApp } from '@/lib/context';
import { apiRequest, getApiUrl } from '@/lib/query-client';

const C = Colors.light;
const PRIMARY = '#FF6B2C';
const GREEN = '#10B981';
const { width } = Dimensions.get('window');
const webTopInset = Platform.OS === 'web' ? 67 : 0;

interface Product {
  id: string;
  title: string;
  price: string;
  images: string;
  category: string;
  inStock: number;
  views: number;
  createdAt: number;
  description: string;
}

interface Order {
  id: string;
  productTitle: string;
  productImage?: string;
  buyerName: string;
  buyerPhone?: string;
  quantity: number;
  totalAmount: string;
  status: string;
  createdAt: number;
  deliveryAddress?: string;
  city?: string;
  sellerNotes?: string;
}

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={[styles.statIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ProductRow({ product, onEdit, onDelete }: { product: Product; onEdit: () => void; onDelete: () => void }) {
  const imgs = (() => { try { return JSON.parse(product.images); } catch { return []; } })();
  const img = imgs[0] || '';
  const price = parseFloat(product.price) || 0;

  return (
    <View style={styles.productRow}>
      <View style={styles.productImgWrap}>
        {img ? (
          <Image source={{ uri: img }} style={styles.productImg} contentFit="cover" />
        ) : (
          <View style={[styles.productImg, styles.productImgPlaceholder]}>
            <Ionicons name="cube-outline" size={22} color={C.textTertiary} />
          </View>
        )}
      </View>
      <View style={styles.productInfo}>
        <Text style={styles.productTitle} numberOfLines={1}>{product.title}</Text>
        <Text style={styles.productCategory}>{product.category}</Text>
        <View style={styles.productMeta}>
          <Text style={styles.productPrice}>₹{price.toLocaleString('en-IN')}</Text>
          <View style={[styles.stockBadge, { backgroundColor: product.inStock > 0 ? '#34C75918' : '#FF3B3018' }]}>
            <Text style={[styles.stockTxt, { color: product.inStock > 0 ? '#34C759' : '#FF3B30' }]}>
              {product.inStock > 0 ? 'In Stock' : 'Out of Stock'}
            </Text>
          </View>
        </View>
        <View style={styles.productStats}>
          <Ionicons name="eye-outline" size={11} color={C.textTertiary} />
          <Text style={styles.productStatTxt}>{product.views || 0} views</Text>
        </View>
      </View>
      <View style={styles.productActions}>
        <Pressable onPress={onEdit} style={styles.actionBtn}>
          <Ionicons name="create-outline" size={18} color={PRIMARY} />
        </Pressable>
        <Pressable onPress={onDelete} style={styles.actionBtn}>
          <Ionicons name="trash-outline" size={18} color='#FF3B30' />
        </Pressable>
      </View>
    </View>
  );
}

const STATUS_COLOR: Record<string, string> = {
  confirmed: '#007AFF',
  shipped:   '#FF9F0A',
  delivered: '#34C759',
  completed: '#34C759',
  cancelled: '#FF3B30',
  rejected:  '#FF3B30',
  pending:   '#FF9F0A',
};

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Confirmed',
  shipped:   'Shipped',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rejected:  'Rejected',
  pending:   'Pending',
};

export default function SupplierProductsScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'products' | 'orders'>('products');
  const [orderTab, setOrderTab] = useState<'confirmed' | 'old'>('confirmed');
  const [deliveringId, setDeliveringId] = useState<string | null>(null);

  const topInset = Platform.OS === 'web' ? webTopInset : insets.top;

  const loadData = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const [prodRes, ordRes] = await Promise.all([
        apiRequest('GET', `/api/products?userId=${profile.id}`),
        apiRequest('GET', `/api/orders?sellerId=${profile.id}`),
      ]);
      const prodData = await prodRes.json();
      const ordData = await ordRes.json();
      if (Array.isArray(prodData)) setProducts(prodData);
      if (Array.isArray(ordData)) setOrders(ordData);
    } catch (e) {
      console.error('[SupplierProducts] fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleDelete = (product: Product) => {
    Alert.alert('Delete Product', `Delete "${product.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await apiRequest('DELETE', `/api/products/${product.id}`);
            setProducts(prev => prev.filter(p => p.id !== product.id));
            if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch {
            Alert.alert('Error', 'Failed to delete product');
          }
        }
      }
    ]);
  };

  const markDelivered = async (order: Order) => {
    setDeliveringId(order.id);
    try {
      const res = await apiRequest('PATCH', `/api/orders/${order.id}/status`, { status: 'delivered' });
      if (!res.ok) throw new Error('Failed');
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'delivered' } : o));
      setOrderTab('old');
    } catch {
      Alert.alert('Error', 'Could not mark as delivered. Please try again.');
    } finally {
      setDeliveringId(null);
    }
  };

  const confirmedOrders = orders.filter(o => o.status === 'confirmed');
  const oldOrders = orders.filter(o => ['delivered', 'completed', 'shipped', 'cancelled', 'rejected'].includes(o.status));
  const pendingOrders = orders.filter(o => o.status === 'pending');

  const totalRevenue = orders
    .filter(o => ['delivered', 'completed'].includes(o.status))
    .reduce((s, o) => s + (parseFloat(o.totalAmount) || 0), 0);

  const getDate = (ts: number) =>
    new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  const renderConfirmedOrder = ({ item }: { item: Order }) => {
    const isDelivering = deliveringId === item.id;
    const imgUri = item.productImage
      ? (item.productImage.startsWith('/') ? `${getApiUrl()}${item.productImage}` : item.productImage)
      : null;

    return (
      <View style={styles.orderCard}>
        <View style={styles.ocTop}>
          {imgUri ? (
            <Image source={{ uri: imgUri }} style={styles.ocImg} contentFit="cover" />
          ) : (
            <View style={[styles.ocImg, styles.ocImgPlaceholder]}>
              <Ionicons name="cube-outline" size={22} color={C.textTertiary} />
            </View>
          )}
          <View style={styles.ocInfo}>
            <Text style={styles.ocTitle} numberOfLines={2}>{item.productTitle}</Text>
            <Text style={styles.ocBuyer}>{item.buyerName}</Text>
            {item.buyerPhone ? (
              <Text style={styles.ocPhone}>{item.buyerPhone}</Text>
            ) : null}
            <View style={styles.ocMeta}>
              <Text style={styles.ocQty}>Qty: {item.quantity || 1}</Text>
              <Text style={styles.ocDate}>{getDate(item.createdAt)}</Text>
            </View>
          </View>
          <View style={styles.ocRight}>
            <View style={[styles.statusPill, { backgroundColor: STATUS_COLOR['confirmed'] + '20' }]}>
              <Text style={[styles.statusPillTxt, { color: STATUS_COLOR['confirmed'] }]}>Confirmed</Text>
            </View>
            <Text style={styles.ocAmount}>₹{(parseFloat(item.totalAmount) || 0).toLocaleString('en-IN')}</Text>
          </View>
        </View>

        {item.deliveryAddress ? (
          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={13} color={C.textTertiary} />
            <Text style={styles.addressTxt} numberOfLines={1}>
              {[item.deliveryAddress, item.city].filter(Boolean).join(', ')}
            </Text>
          </View>
        ) : null}

        <Pressable
          style={[styles.deliverBtn, isDelivering && { opacity: 0.7 }]}
          onPress={() => markDelivered(item)}
          disabled={isDelivering}
        >
          {isDelivering ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={18} color="#FFF" />
              <Text style={styles.deliverBtnTxt}>Mark as Delivered</Text>
            </>
          )}
        </Pressable>
      </View>
    );
  };

  const renderOldOrder = ({ item }: { item: Order }) => {
    const color = STATUS_COLOR[item.status] || '#9CA3AF';
    const imgUri = item.productImage
      ? (item.productImage.startsWith('/') ? `${getApiUrl()}${item.productImage}` : item.productImage)
      : null;

    return (
      <View style={[styles.orderCard, styles.oldCard]}>
        <View style={styles.ocTop}>
          {imgUri ? (
            <Image source={{ uri: imgUri }} style={styles.ocImg} contentFit="cover" />
          ) : (
            <View style={[styles.ocImg, styles.ocImgPlaceholder]}>
              <Ionicons name="cube-outline" size={20} color={C.textTertiary} />
            </View>
          )}
          <View style={styles.ocInfo}>
            <Text style={styles.ocTitle} numberOfLines={2}>{item.productTitle}</Text>
            <Text style={styles.ocBuyer}>{item.buyerName}</Text>
            <View style={styles.ocMeta}>
              <Text style={styles.ocQty}>Qty: {item.quantity || 1}</Text>
              <Text style={styles.ocDate}>{getDate(item.createdAt)}</Text>
            </View>
          </View>
          <View style={styles.ocRight}>
            <View style={[styles.statusPill, { backgroundColor: color + '20' }]}>
              <Text style={[styles.statusPillTxt, { color }]}>{STATUS_LABEL[item.status] || item.status}</Text>
            </View>
            <Text style={styles.ocAmount}>₹{(parseFloat(item.totalAmount) || 0).toLocaleString('en-IN')}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>My Store</Text>
            <Text style={styles.headerSub}>{profile?.shopName || profile?.name}</Text>
          </View>
          <Pressable
            onPress={() => router.push('/add-product' as any)}
            style={styles.addBtn}
          >
            <Ionicons name="add" size={20} color="#FFF" />
            <Text style={styles.addBtnTxt}>Add Product</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12, marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
          <StatCard label="Products" value={products.length} icon="cube-outline" color={PRIMARY} />
          <StatCard label="Total Orders" value={orders.length} icon="receipt-outline" color="#007AFF" />
          <StatCard label="Confirmed" value={confirmedOrders.length} icon="checkmark-circle-outline" color={GREEN} />
          <StatCard label="Revenue" value={`₹${Math.round(totalRevenue).toLocaleString('en-IN')}`} icon="cash-outline" color="#34C759" />
        </ScrollView>
      </View>

      {/* Main Tabs */}
      <View style={styles.tabRow}>
        <Pressable
          onPress={() => setActiveTab('products')}
          style={[styles.tab, activeTab === 'products' && styles.tabActive]}
        >
          <Ionicons name="cube-outline" size={15} color={activeTab === 'products' ? PRIMARY : C.textTertiary} />
          <Text style={[styles.tabTxt, activeTab === 'products' && styles.tabTxtActive]}>
            Products ({products.length})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('orders')}
          style={[styles.tab, activeTab === 'orders' && styles.tabActive]}
        >
          <Ionicons name="receipt-outline" size={15} color={activeTab === 'orders' ? PRIMARY : C.textTertiary} />
          <Text style={[styles.tabTxt, activeTab === 'orders' && styles.tabTxtActive]}>
            Orders ({orders.filter(o => o.status !== 'pending').length})
          </Text>
          {confirmedOrders.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeTxt}>{confirmedOrders.length}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Products List */}
      {activeTab === 'products' ? (
        <FlatList
          data={products}
          keyExtractor={i => i.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={52} color={C.textTertiary} />
              <Text style={styles.emptyTitle}>No products yet</Text>
              <Text style={styles.emptySub}>Add your first product to start selling</Text>
              <Pressable onPress={() => router.push('/add-product' as any)} style={styles.emptyBtn}>
                <Ionicons name="add" size={18} color="#FFF" />
                <Text style={styles.emptyBtnTxt}>Add First Product</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <ProductRow
              product={item}
              onEdit={() => router.push({ pathname: '/add-product', params: { productId: item.id } } as any)}
              onDelete={() => handleDelete(item)}
            />
          )}
        />
      ) : (
        <View style={{ flex: 1 }}>
          {/* Order Sub-tabs */}
          <View style={styles.subTabRow}>
            <Pressable
              onPress={() => setOrderTab('confirmed')}
              style={[styles.subTab, orderTab === 'confirmed' && styles.subTabActive]}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={14}
                color={orderTab === 'confirmed' ? GREEN : C.textTertiary}
              />
              <Text style={[styles.subTabTxt, orderTab === 'confirmed' && styles.subTabTxtActive]}>
                Confirmed ({confirmedOrders.length})
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setOrderTab('old')}
              style={[styles.subTab, orderTab === 'old' && styles.subTabActive]}
            >
              <Ionicons
                name="time-outline"
                size={14}
                color={orderTab === 'old' ? PRIMARY : C.textTertiary}
              />
              <Text style={[styles.subTabTxt, orderTab === 'old' && { color: PRIMARY, fontFamily: 'Inter_600SemiBold' }]}>
                Old Orders ({oldOrders.length})
              </Text>
            </Pressable>
          </View>

          {/* Confirmed Orders List */}
          {orderTab === 'confirmed' ? (
            <FlatList
              data={confirmedOrders}
              keyExtractor={i => i.id}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GREEN} />}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Ionicons name="checkmark-circle-outline" size={52} color={C.textTertiary} />
                  <Text style={styles.emptyTitle}>No Confirmed Orders</Text>
                  <Text style={styles.emptySub}>Accepted orders will appear here ready for delivery</Text>
                </View>
              }
              renderItem={renderConfirmedOrder}
            />
          ) : (
            /* Old Orders List */
            <FlatList
              data={oldOrders}
              keyExtractor={i => i.id}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
              ListHeaderComponent={
                oldOrders.length > 0 ? (
                  <View style={styles.oldHeader}>
                    <Ionicons name="archive-outline" size={15} color={C.textTertiary} />
                    <Text style={styles.oldHeaderTxt}>Order History — {oldOrders.length} orders</Text>
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Ionicons name="time-outline" size={52} color={C.textTertiary} />
                  <Text style={styles.emptyTitle}>No Past Orders</Text>
                  <Text style={styles.emptySub}>Delivered and completed orders will appear here</Text>
                </View>
              }
              renderItem={renderOldOrder}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: { backgroundColor: C.surface, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 24, fontFamily: 'Inter_700Bold', color: C.text },
  headerSub: { fontSize: 12, color: C.textTertiary, fontFamily: 'Inter_400Regular', marginTop: 2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: PRIMARY, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  addBtnTxt: { color: '#FFF', fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  statCard: { backgroundColor: C.surfaceElevated, borderRadius: 12, padding: 14, minWidth: 110, borderLeftWidth: 3 },
  statIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statValue: { fontSize: 20, fontFamily: 'Inter_700Bold', color: C.text },
  statLabel: { fontSize: 11, color: C.textTertiary, fontFamily: 'Inter_400Regular', marginTop: 2 },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.surface },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: PRIMARY },
  tabTxt: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.textTertiary },
  tabTxtActive: { color: PRIMARY, fontFamily: 'Inter_600SemiBold' },
  tabBadge: { backgroundColor: GREEN, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabBadgeTxt: { color: '#FFF', fontSize: 10, fontFamily: 'Inter_700Bold' },
  subTabRow: { flexDirection: 'row', backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: 16, gap: 0 },
  subTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  subTabActive: { borderBottomColor: GREEN },
  subTabTxt: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.textTertiary },
  subTabTxtActive: { color: GREEN, fontFamily: 'Inter_600SemiBold' },
  list: { padding: 16, paddingBottom: Platform.OS === 'web' ? 100 : 80, gap: 12 },
  productRow: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  productImgWrap: { width: 80, height: 80 },
  productImg: { width: 80, height: 80, backgroundColor: C.surfaceElevated },
  productImgPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  productInfo: { flex: 1, padding: 10 },
  productTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text },
  productCategory: { fontSize: 11, color: C.textTertiary, fontFamily: 'Inter_400Regular', textTransform: 'capitalize', marginTop: 2 },
  productMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  productPrice: { fontSize: 15, fontFamily: 'Inter_700Bold', color: PRIMARY },
  stockBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  stockTxt: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  productStats: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  productStatTxt: { fontSize: 10, color: C.textTertiary, fontFamily: 'Inter_400Regular' },
  productActions: { paddingRight: 10, gap: 8 },
  actionBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  orderCard: { backgroundColor: C.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border },
  oldCard: { opacity: 0.9 },
  ocTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  ocImg: { width: 60, height: 60, borderRadius: 10, backgroundColor: C.surfaceElevated },
  ocImgPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  ocInfo: { flex: 1 },
  ocTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text, lineHeight: 19 },
  ocBuyer: { fontSize: 12, color: C.textSecondary, fontFamily: 'Inter_400Regular', marginTop: 3 },
  ocPhone: { fontSize: 12, color: '#007AFF', fontFamily: 'Inter_400Regular', marginTop: 1 },
  ocMeta: { flexDirection: 'row', gap: 10, marginTop: 5 },
  ocQty: { fontSize: 11, color: C.textTertiary, fontFamily: 'Inter_400Regular' },
  ocDate: { fontSize: 11, color: C.textTertiary, fontFamily: 'Inter_400Regular' },
  ocRight: { alignItems: 'flex-end', gap: 6 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusPillTxt: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  ocAmount: { fontSize: 15, fontFamily: 'Inter_700Bold', color: GREEN },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border },
  addressTxt: { fontSize: 12, color: C.textTertiary, fontFamily: 'Inter_400Regular', flex: 1 },
  deliverBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: GREEN, borderRadius: 10, paddingVertical: 11, marginTop: 12 },
  deliverBtnTxt: { color: '#FFF', fontFamily: 'Inter_700Bold', fontSize: 14 },
  oldHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  oldHeaderTxt: { fontSize: 12, color: C.textTertiary, fontFamily: 'Inter_400Regular' },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: C.text, marginTop: 16 },
  emptySub: { fontSize: 14, color: C.textTertiary, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 8 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: PRIMARY, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 20 },
  emptyBtnTxt: { color: '#FFF', fontFamily: 'Inter_600SemiBold', fontSize: 14 },
});
