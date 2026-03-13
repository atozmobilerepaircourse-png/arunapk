import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, Platform,
  Alert, RefreshControl, ActivityIndicator, Dimensions, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useApp } from '@/lib/context';
import { apiRequest } from '@/lib/query-client';

const C = Colors.light;
const PRIMARY = '#FF6B2C';
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
  buyerName: string;
  totalAmount: string;
  status: string;
  createdAt: number;
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

export default function SupplierProductsScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'products' | 'orders'>('products');

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

  const pendingOrders = orders.filter(o => o.status === 'pending');
  const totalRevenue = orders
    .filter(o => o.status === 'completed')
    .reduce((s, o) => s + (parseFloat(o.totalAmount) || 0), 0);

  const getStatusColor = (status: string) => {
    if (status === 'completed') return '#34C759';
    if (status === 'cancelled') return '#FF3B30';
    if (status === 'processing') return '#FF9F0A';
    return '#007AFF';
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

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

        {/* Stats */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12, marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
          <StatCard label="Products" value={products.length} icon="cube-outline" color={PRIMARY} />
          <StatCard label="Total Orders" value={orders.length} icon="receipt-outline" color="#007AFF" />
          <StatCard label="Pending" value={pendingOrders.length} icon="time-outline" color="#FF9F0A" />
          <StatCard label="Revenue" value={`₹${Math.round(totalRevenue).toLocaleString('en-IN')}`} icon="cash-outline" color="#34C759" />
        </ScrollView>
      </View>

      {/* Tabs */}
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
            Orders ({orders.length})
          </Text>
          {pendingOrders.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeTxt}>{pendingOrders.length}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Content */}
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
        <FlatList
          data={orders}
          keyExtractor={i => i.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={52} color={C.textTertiary} />
              <Text style={styles.emptyTitle}>No orders yet</Text>
              <Text style={styles.emptySub}>Orders will appear here when customers purchase</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderProduct} numberOfLines={1}>{item.productTitle}</Text>
                  <Text style={styles.orderBuyer}>{item.buyerName}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                  <Text style={[styles.statusTxt, { color: getStatusColor(item.status) }]}>
                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                  </Text>
                </View>
              </View>
              <View style={styles.orderFooter}>
                <Text style={styles.orderAmount}>₹{(parseFloat(item.totalAmount) || 0).toLocaleString('en-IN')}</Text>
                <Text style={styles.orderDate}>
                  {new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </Text>
              </View>
            </View>
          )}
        />
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
  tabTxtActive: { color: PRIMARY },
  tabBadge: { backgroundColor: PRIMARY, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabBadgeTxt: { color: '#FFF', fontSize: 10, fontFamily: 'Inter_700Bold' },
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
  orderCard: { backgroundColor: C.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.border },
  orderHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  orderProduct: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text },
  orderBuyer: { fontSize: 12, color: C.textSecondary, fontFamily: 'Inter_400Regular', marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusTxt: { fontSize: 11, fontFamily: 'Inter_600SemiBold', textTransform: 'capitalize' },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border },
  orderAmount: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#34C759' },
  orderDate: { fontSize: 11, color: C.textTertiary, fontFamily: 'Inter_400Regular' },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: C.text, marginTop: 16 },
  emptySub: { fontSize: 14, color: C.textTertiary, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 8 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: PRIMARY, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 20 },
  emptyBtnTxt: { color: '#FFF', fontFamily: 'Inter_600SemiBold', fontSize: 14 },
});
