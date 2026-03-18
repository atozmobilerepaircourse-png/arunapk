import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  TouchableOpacity, Platform, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { apiRequest, getApiUrl } from '@/lib/query-client';
import Colors from '@/constants/colors';

const C = Colors.light;

const PRIMARY = '#FF6B2C';
const TEXT = '#111827';
const MUTED = '#6B7280';
const BG = '#FFFFFF';
const SURFACE = '#F9FAFB';
const BORDER = '#E5E7EB';
const PURPLE = '#8B5CF6';

interface Product {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  title: string;
  description?: string;
  price: number;
  category: string;
  images?: string[];
  thumbnail?: string;
  city?: string;
  state?: string;
  inStock?: boolean;
  deliveryInfo?: string;
  userRole?: string;
}

function ProductCard({ item }: { item: Product }) {
  const image = item.thumbnail || (item.images && item.images[0]);
  return (
    <TouchableOpacity
      activeOpacity={0.82}
      style={styles.card}
      onPress={() => router.push(`/shop/${item.userId}` as any)}
    >
      {image ? (
        <Image source={{ uri: image }} style={styles.cardImg} contentFit="cover" />
      ) : (
        <View style={[styles.cardImg, styles.cardImgPlaceholder]}>
          <Ionicons name="cube-outline" size={32} color={MUTED} />
        </View>
      )}
      <View style={styles.cardBadge}>
        <Ionicons name="storefront" size={10} color={PURPLE} />
        <Text style={styles.cardBadgeText}>Shop</Text>
      </View>
      {item.inStock === false && (
        <View style={styles.outOfStockBadge}>
          <Text style={styles.outOfStockText}>Out of Stock</Text>
        </View>
      )}
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.cardPrice}>₹{item.price.toLocaleString('en-IN')}</Text>
        {(item.city || item.state) && (
          <View style={styles.cardLocation}>
            <Ionicons name="location-outline" size={11} color={MUTED} />
            <Text style={styles.cardLocationText}>{[item.city, item.state].filter(Boolean).join(', ')}</Text>
          </View>
        )}
        <View style={styles.cardSellerRow}>
          {item.userAvatar ? (
            <Image source={{ uri: item.userAvatar }} style={styles.sellerAvatar} contentFit="cover" />
          ) : (
            <View style={[styles.sellerAvatar, styles.sellerAvatarPlaceholder]}>
              <Ionicons name="person" size={10} color={PURPLE} />
            </View>
          )}
          <Text style={styles.sellerName} numberOfLines={1}>{item.userName}</Text>
        </View>
        <TouchableOpacity
          style={styles.viewShopBtn}
          activeOpacity={0.75}
          onPress={() => router.push(`/shop/${item.userId}` as any)}
        >
          <Ionicons name="storefront-outline" size={11} color={PURPLE} />
          <Text style={styles.viewShopText}>View Shop</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function NearbyShopsScreen() {
  const insets = useSafeAreaInsets();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const topPad = (Platform.OS === 'web' ? 67 : insets.top) + 10;

  const loadProducts = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const url = new URL('/api/products', getApiUrl());
      url.searchParams.set('role', 'shopkeeper');
      const res = await fetch(url.toString());
      const data = await res.json();
      // /api/products returns a raw array (not { success, products })
      if (Array.isArray(data)) {
        setProducts(data);
      } else if (data.success && Array.isArray(data.products)) {
        setProducts(data.products);
      }
    } catch (e) {
      console.error('NearbyShops load error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadProducts(); }, [loadProducts]));

  const filtered = search.trim()
    ? products.filter(p =>
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.userName.toLowerCase().includes(search.toLowerCase()) ||
        (p.city || '').toLowerCase().includes(search.toLowerCase())
      )
    : products;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Text style={styles.headerTitle}>Nearby Shops</Text>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={PURPLE} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          numColumns={2}
          contentContainerStyle={[styles.grid, { paddingBottom: (Platform.OS === 'web' ? 34 : insets.bottom) + 80 }]}
          columnWrapperStyle={styles.columnWrapper}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadProducts(true)} tintColor={PURPLE} />
          }
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="storefront-outline" size={48} color={MUTED} />
              <Text style={styles.emptyTitle}>No shops yet</Text>
              <Text style={styles.emptySubtitle}>Shopkeepers will appear here</Text>
            </View>
          }
          renderItem={({ item }) => <ProductCard item={item} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    backgroundColor: BG,
    borderBottomWidth: 1,
    borderBottomColor: BORDER + '60',
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: TEXT,
  },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  grid: { padding: 12, paddingTop: 16 },
  columnWrapper: { gap: 12 },
  card: {
    flex: 1,
    backgroundColor: SURFACE,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 12,
  },
  cardImg: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: BORDER,
  },
  cardImgPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: PURPLE + '18',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  cardBadgeText: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    color: PURPLE,
  },
  outOfStockBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#EF444440',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  outOfStockText: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    color: '#EF4444',
  },
  cardBody: { padding: 10, gap: 4 },
  cardTitle: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: TEXT,
    lineHeight: 18,
  },
  cardPrice: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: PRIMARY,
  },
  cardLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  cardLocationText: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: MUTED,
  },
  cardSellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  sellerAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  sellerAvatarPlaceholder: {
    backgroundColor: PURPLE + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerName: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: MUTED,
    flex: 1,
  },
  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    color: TEXT,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: MUTED,
  },
  viewShopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    backgroundColor: PURPLE + '12',
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
  },
  viewShopText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: PURPLE,
  },
});
