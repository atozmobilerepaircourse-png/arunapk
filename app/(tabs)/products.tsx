import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, Pressable, Platform, RefreshControl, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useApp } from '@/lib/context';
import { T } from '@/constants/techTheme';
import Colors from '@/constants/colors';
import { apiRequest, getApiUrl } from '@/lib/query-client';

const C = Colors.light;
const webTopInset = Platform.OS === 'web' ? 67 : 0;

interface Product {
  id: string;
  name: string;
  price: string;
  image?: string;
  stock?: number;
  category?: string;
  sellerId: string;
}

export default function ProductsScreen() {
  const insets = useSafeAreaInsets();
  const { profile, refreshData } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadProducts();
  }, [profile?.id]);

  const loadProducts = async () => {
    try {
      const res = await apiRequest('GET', `/api/products?sellerId=${profile?.id}`);
      const data = await res.json();
      setProducts(data || []);
    } catch (e) {
      console.error('Failed to load products:', e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProducts();
    await refreshData();
    setRefreshing(false);
  };

  if (loading && products.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: T.bg }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={T.accent} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: T.bg }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 16 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>My Products</Text>
          <Pressable onPress={() => router.push('/create' as any)}>
            <Ionicons name="add-circle" size={28} color={T.accent} />
          </Pressable>
        </View>

        {products.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="cube-outline" size={64} color={T.muted} />
            <Text style={styles.emptyText}>No products listed</Text>
            <Text style={styles.emptySubtext}>Add products to your inventory to start selling</Text>
            <Pressable onPress={() => router.push('/create' as any)} style={styles.createBtn}>
              <Text style={styles.createBtnText}>Add Product</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            scrollEnabled={false}
            data={products}
            keyExtractor={p => p.id}
            numColumns={2}
            columnWrapperStyle={styles.row}
            renderItem={({ item }) => (
              <Pressable onPress={() => router.push(`/product/${item.id}` as any)} style={styles.productCard}>
                {item.image && (
                  <Image source={{ uri: item.image }} style={styles.productImage} contentFit="cover" cachePolicy="memory-disk" />
                )}
                <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.productPrice}>₹{item.price}</Text>
                {item.stock !== undefined && (
                  <Text style={[styles.stock, item.stock > 0 ? styles.inStock : styles.outOfStock]}>
                    {item.stock > 0 ? `${item.stock} in stock` : 'Out of stock'}
                  </Text>
                )}
              </Pressable>
            )}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 120 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '700', color: T.text },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 18, fontWeight: '600', color: T.text, marginTop: 16 },
  emptySubtext: { fontSize: 14, color: T.muted, marginTop: 8, textAlign: 'center', marginHorizontal: 16 },
  createBtn: { marginTop: 24, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: T.accent, borderRadius: 8 },
  createBtnText: { color: '#FFF', fontWeight: '600', fontSize: 16 },
  row: { justifyContent: 'space-between', marginBottom: 16 },
  productCard: { width: '48%', backgroundColor: T.card, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: T.border },
  productImage: { width: '100%', height: 140, backgroundColor: T.surface },
  productName: { fontSize: 14, fontWeight: '600', color: T.text, padding: 12, paddingBottom: 8 },
  productPrice: { fontSize: 16, fontWeight: '700', color: T.accent, paddingHorizontal: 12 },
  stock: { fontSize: 12, paddingHorizontal: 12, paddingBottom: 12 },
  inStock: { color: T.green || '#10B981' },
  outOfStock: { color: '#EF4444' },
});
