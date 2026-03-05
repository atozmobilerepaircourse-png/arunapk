import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform, FlatList,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useApp } from '@/lib/context';
import { apiRequest } from '@/lib/query-client';

const PRIMARY = '#FF6B2C';
const BG      = '#F5F7FA';
const CARD    = '#FFFFFF';
const DARK    = '#1A1A2E';
const GRAY    = '#8E8E93';

type FilterType = 'all' | 'active' | 'completed';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending:   { label: 'Pending',   color: '#FF9F0A', bg: '#FFF3E0', icon: 'time'            },
  confirmed: { label: 'Confirmed', color: '#34C759', bg: '#EAF7EE', icon: 'checkmark-circle' },
  shipped:   { label: 'On the Way',color: '#4F8EF7', bg: '#EAF1FF', icon: 'car'              },
  delivered: { label: 'Delivered', color: '#34C759', bg: '#EAF7EE', icon: 'checkmark-circle' },
  completed: { label: 'Completed', color: '#34C759', bg: '#EAF7EE', icon: 'checkmark-circle' },
  cancelled: { label: 'Cancelled', color: '#FF3B30', bg: '#FFEBEA', icon: 'close-circle'     },
  rejected:  { label: 'Rejected',  color: '#FF3B30', bg: '#FFEBEA', icon: 'close-circle'     },
};

const ACTIVE_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered'];
const DONE_STATUSES   = ['completed', 'cancelled', 'rejected'];

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: GRAY, bg: '#F2F2F7', icon: 'ellipse' };
  return (
    <View style={[statusStyles.badge, { backgroundColor: cfg.bg }]}>
      <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
      <Text style={[statusStyles.text, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

const statusStyles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  text: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
});

function OrderCard({ order, onCancel }: { order: any; onCancel: (id: string) => void }) {
  const canCancel = order.status === 'pending';
  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;

  return (
    <Pressable
      style={({ pressed }) => [styles.orderCard, { opacity: pressed ? 0.96 : 1 }]}
      onPress={() => {}}
    >
      {/* Color bar */}
      <View style={[styles.orderColorBar, { backgroundColor: cfg.color }]} />

      <View style={styles.orderContent}>
        {/* Header */}
        <View style={styles.orderHeader}>
          <View style={styles.orderIconWrap}>
            <Ionicons name="construct" size={20} color={PRIMARY} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.orderTitle} numberOfLines={2}>{order.productTitle || 'Repair Order'}</Text>
            <Text style={styles.orderDate}>
              {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
          </View>
          <StatusBadge status={order.status} />
        </View>

        {/* Details */}
        <View style={styles.orderDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Booking ID</Text>
            <Text style={styles.detailValue}>#{order.id?.slice(-6)?.toUpperCase() || 'XXXXXX'}</Text>
          </View>
          {order.shippingAddress && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Address</Text>
              <Text style={styles.detailValue} numberOfLines={1}>{order.shippingAddress}</Text>
            </View>
          )}
          {order.buyerNotes && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Slot</Text>
              <Text style={styles.detailValue} numberOfLines={1}>{order.buyerNotes}</Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.orderFooter}>
          <Text style={styles.orderPrice}>₹{order.productPrice}</Text>
          <View style={styles.orderActions}>
            {canCancel && (
              <Pressable
                style={styles.cancelBtn}
                onPress={() => onCancel(order.id)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
            )}
            {order.status === 'confirmed' && (
              <Pressable
                style={styles.trackBtn}
                onPress={() => router.push({ pathname: '/(tabs)/directory', params: { filter: 'technician' } } as any)}
              >
                <Ionicons name="navigate" size={14} color={PRIMARY} />
                <Text style={styles.trackBtnText}>Track Tech</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useApp();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');

  const topInset  = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 84 + 34 : 100;

  const fetchOrders = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const res = await apiRequest('GET', `/api/orders?buyerId=${profile.id}`);
      const data = await res.json();
      setOrders(Array.isArray(data) ? data.sort((a, b) => b.createdAt - a.createdAt) : []);
    } catch { setOrders([]); }
    finally { setLoading(false); }
  }, [profile?.id]);

  useEffect(() => {
    fetchOrders();
    const t = setInterval(fetchOrders, 15000);
    return () => clearInterval(t);
  }, [fetchOrders]);

  const onRefresh = async () => { setRefreshing(true); await fetchOrders(); setRefreshing(false); };

  const cancelOrder = (id: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm('Cancel this repair booking?')) {
        apiRequest('PATCH', `/api/orders/${id}/status`, { status: 'cancelled' }).then(fetchOrders);
      }
    } else {
      Alert.alert('Cancel Booking', 'Are you sure you want to cancel?', [
        { text: 'No', style: 'cancel' },
        { text: 'Cancel Booking', style: 'destructive', onPress: async () => {
          await apiRequest('PATCH', `/api/orders/${id}/status`, { status: 'cancelled' });
          fetchOrders();
        }},
      ]);
    }
  };

  const filtered = orders.filter(o => {
    if (filter === 'active') return ACTIVE_STATUSES.includes(o.status);
    if (filter === 'completed') return DONE_STATUSES.includes(o.status);
    return true;
  });

  const activeCount = orders.filter(o => ACTIVE_STATUSES.includes(o.status)).length;

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Repairs</Text>
        {activeCount > 0 && (
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>{activeCount} active</Text>
          </View>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(['all', 'active', 'completed'] as FilterType[]).map(f => (
          <Pressable
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
              {f === 'all' ? 'All Orders' : f === 'active' ? 'Active' : 'Completed'}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <OrderCard order={item} onCancel={cancelOrder} />}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} colors={[PRIMARY]} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="construct-outline" size={40} color={GRAY} />
              </View>
              <Text style={styles.emptyTitle}>No repairs yet</Text>
              <Text style={styles.emptyText}>Book a repair to get started</Text>
              <Pressable style={styles.emptyBtn} onPress={() => router.push('/select-brand' as any)}>
                <Text style={styles.emptyBtnText}>Book a Repair</Text>
              </Pressable>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 28, fontFamily: 'Inter_700Bold', color: DARK, flex: 1 },
  activeBadge: { backgroundColor: PRIMARY + '18', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  activeBadgeText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: PRIMARY },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  filterTab: { flex: 1, paddingVertical: 8, borderRadius: 12, backgroundColor: CARD, alignItems: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  filterTabActive: { backgroundColor: PRIMARY + '15', borderColor: PRIMARY },
  filterTabText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: GRAY },
  filterTabTextActive: { color: PRIMARY, fontFamily: 'Inter_600SemiBold' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 16, paddingTop: 4, gap: 12 },
  orderCard: { backgroundColor: CARD, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2, overflow: 'hidden' },
  orderColorBar: { height: 4 },
  orderContent: { padding: 14 },
  orderHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  orderIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: PRIMARY + '15', alignItems: 'center', justifyContent: 'center' },
  orderTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: DARK, flex: 1, lineHeight: 20 },
  orderDate: { fontSize: 12, fontFamily: 'Inter_400Regular', color: GRAY, marginTop: 2 },
  orderDetails: { backgroundColor: BG, borderRadius: 10, padding: 10, gap: 6, marginBottom: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  detailLabel: { fontSize: 12, fontFamily: 'Inter_400Regular', color: GRAY },
  detailValue: { fontSize: 12, fontFamily: 'Inter_500Medium', color: DARK, flex: 1, textAlign: 'right' },
  orderFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orderPrice: { fontSize: 18, fontFamily: 'Inter_700Bold', color: DARK },
  orderActions: { flexDirection: 'row', gap: 8 },
  cancelBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#FF3B30' },
  cancelBtnText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: '#FF3B30' },
  trackBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: PRIMARY },
  trackBtnText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: PRIMARY },
  empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 },
  emptyTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: DARK },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: GRAY },
  emptyBtn: { marginTop: 8, backgroundColor: PRIMARY, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  emptyBtnText: { color: '#FFF', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
});
