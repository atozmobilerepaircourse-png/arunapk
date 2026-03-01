import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform,
  ActivityIndicator, FlatList, RefreshControl, Dimensions, Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useApp } from '@/lib/context';
import { apiRequest, getApiUrl } from '@/lib/query-client';
import { UserProfile } from '@/lib/types';

const ACCENT = '#2C7AFF';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 10;
const CARD_WIDTH = (SCREEN_WIDTH - 16 * 2 - CARD_GAP) / 2;

function getImageUri(img: string): string {
  if (img.startsWith('/')) return `${getApiUrl()}${img}`;
  return img;
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function getProductImage(product: any): string {
  let imgs: string[] = [];
  try {
    if (Array.isArray(product.images)) {
      imgs = product.images;
    } else if (typeof product.images === 'string') {
      imgs = JSON.parse(product.images || '[]');
    }
  } catch {}
  if (imgs.length > 0) return getImageUri(imgs[0]);
  return '';
}

export default function SupplierStoreScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile: myProfile, startConversation } = useApp();
  const [supplier, setSupplier] = useState<UserProfile | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const fetchData = useCallback(async () => {
    try {
      const [profileRes, productsRes] = await Promise.all([
        apiRequest('GET', `/api/profiles/${id}`),
        apiRequest('GET', '/api/products'),
      ]);
      const profileData = await profileRes.json();
      const allProducts = await productsRes.json();
      if (profileData && profileData.id) setSupplier(profileData);
      if (Array.isArray(allProducts)) {
        setProducts(allProducts.filter((p: any) => p.userId === id));
      }
    } catch (e) {
      console.error('[SupplierStore] fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const handleMessage = async () => {
    if (!myProfile || !supplier) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const convoId = await startConversation(supplier.id, supplier.name, supplier.role);
    if (convoId) router.push({ pathname: '/chat/[id]', params: { id: convoId } });
  };

  const handleContact = () => {
    if (!supplier) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(`tel:${(supplier as any).phone}`);
  };

  const totalViews = products.reduce((sum, p) => sum + (p.views || 0), 0);
  const displayName = supplier?.shopName || supplier?.name || '';
  const subtitle = supplier?.shopName ? supplier.name : '';

  if (loading) {
    return (
      <View style={[s.container, s.center]}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  if (!supplier) {
    return (
      <View style={[s.container, s.center]}>
        <Ionicons name="storefront-outline" size={48} color="#999" />
        <Text style={s.emptyTitle}>Supplier not found</Text>
        <Pressable onPress={() => router.back()} style={s.goBackBtn}>
          <Text style={s.goBackText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const renderHeader = () => (
    <View>
      <View style={s.profileSection}>
        {supplier.avatar ? (
          <Image
            source={{ uri: getImageUri(supplier.avatar) }}
            style={s.avatar}
            contentFit="cover"
          />
        ) : (
          <View style={s.avatarFallback}>
            <Text style={s.avatarInitials}>{getInitials(supplier.name)}</Text>
          </View>
        )}

        <Text style={s.shopName}>{displayName}</Text>
        {subtitle ? <Text style={s.supplierName}>{subtitle}</Text> : null}

        {supplier.sellType ? (
          <View style={s.sellTypeBadge}>
            <Ionicons name="pricetag" size={12} color={ACCENT} />
            <Text style={s.sellTypeText}>{supplier.sellType}</Text>
          </View>
        ) : null}

        <View style={s.locationRow}>
          <Ionicons name="location-outline" size={14} color="#888" />
          <Text style={s.locationText}>
            {supplier.city}{supplier.state ? `, ${supplier.state}` : ''}
          </Text>
        </View>
        {supplier.shopAddress ? (
          <Text style={s.shopAddress}>{supplier.shopAddress}</Text>
        ) : null}

        <View style={s.statsRow}>
          <View style={s.statItem}>
            <Text style={s.statValue}>{products.length}</Text>
            <Text style={s.statLabel}>Products</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statValue}>{totalViews}</Text>
            <Text style={s.statLabel}>Views</Text>
          </View>
        </View>

        <View style={s.actionRow}>
          <Pressable style={s.contactBtn} onPress={handleContact}>
            <Ionicons name="call-outline" size={18} color={ACCENT} />
            <Text style={s.contactBtnText}>Contact</Text>
          </Pressable>
          <Pressable style={s.messageBtn} onPress={handleMessage}>
            <Ionicons name="chatbubble-outline" size={18} color="#FFF" />
            <Text style={s.messageBtnText}>Message</Text>
          </Pressable>
        </View>
      </View>

      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Products by {displayName}</Text>
      </View>
    </View>
  );

  const renderProduct = ({ item }: { item: any }) => {
    const imgUri = getProductImage(item);
    const location = [item.city, item.state].filter(Boolean).join(', ');
    const price = Number(item.price) > 0
      ? `\u20B9${Number(item.price).toLocaleString('en-IN')}`
      : 'Free';

    return (
      <Pressable
        style={s.productCard}
        onPress={() => router.push(`/product-detail?id=${item.id}`)}
      >
        <View style={s.productImageWrap}>
          {imgUri ? (
            <Image source={{ uri: imgUri }} style={s.productImage} contentFit="cover" />
          ) : (
            <View style={[s.productImage, s.productImagePlaceholder]}>
              <Ionicons name="cube" size={28} color="#CCC" />
            </View>
          )}
          {item.inStock ? (
            <View style={s.stockBadgeIn}>
              <Text style={s.stockBadgeText}>In Stock</Text>
            </View>
          ) : (
            <View style={s.stockBadgeOut}>
              <Text style={s.stockBadgeText}>Out of Stock</Text>
            </View>
          )}
        </View>
        <View style={s.productInfo}>
          <Text style={s.productTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={s.productPrice}>{price}</Text>
          {location ? (
            <View style={s.productLocationRow}>
              <Ionicons name="location-outline" size={11} color="#999" />
              <Text style={s.productLocationText} numberOfLines={1}>{location}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={s.container}>
      <View style={[s.topBar, { paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 8 }]}>
        <Pressable hitSlop={14} onPress={() => router.back()} style={s.topBtn}>
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </Pressable>
        <Text style={s.topTitle} numberOfLines={1}>{displayName}</Text>
        <View style={{ width: 34 }} />
      </View>

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={s.columnWrapper}
        contentContainerStyle={[
          s.listContent,
          { paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 56 },
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={s.emptyState}>
            <Ionicons name="cube-outline" size={48} color="#CCC" />
            <Text style={s.emptyText}>No products yet</Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />
        }
        renderItem={renderProduct}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { justifyContent: 'center', alignItems: 'center' },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingBottom: 10,
    backgroundColor: '#FFFFFF', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E0E0E0',
  },
  topBtn: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  topTitle: { color: '#1A1A1A', fontSize: 17, fontWeight: '700' as const, flex: 1, textAlign: 'center' },

  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
  columnWrapper: { gap: CARD_GAP, marginBottom: CARD_GAP },

  profileSection: { alignItems: 'center', paddingTop: 16, paddingBottom: 20 },
  avatar: {
    width: 88, height: 88, borderRadius: 44, marginBottom: 12,
    borderWidth: 3, borderColor: ACCENT + '30',
  },
  avatarFallback: {
    width: 88, height: 88, borderRadius: 44, marginBottom: 12,
    backgroundColor: ACCENT + '15', justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: ACCENT + '30',
  },
  avatarInitials: { fontSize: 30, fontWeight: '700' as const, color: ACCENT },

  shopName: { fontSize: 22, fontWeight: '800' as const, color: '#1A1A1A', marginBottom: 2 },
  supplierName: { fontSize: 14, color: '#666', marginBottom: 6 },

  sellTypeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: ACCENT + '12', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14,
    marginBottom: 8,
  },
  sellTypeText: { fontSize: 13, fontWeight: '600' as const, color: ACCENT },

  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  locationText: { fontSize: 13, color: '#888' },
  shopAddress: { fontSize: 12, color: '#AAA', marginBottom: 8, textAlign: 'center' as const, paddingHorizontal: 24 },

  statsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F7F7F7', borderRadius: 14, paddingVertical: 14,
    marginTop: 12, marginBottom: 16, width: '100%' as const,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '700' as const, color: '#1A1A1A' },
  statLabel: { fontSize: 12, color: '#888', marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: '#E0E0E0' },

  actionRow: { flexDirection: 'row', gap: 12, width: '100%' as const },
  contactBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 46, borderRadius: 23, borderWidth: 2, borderColor: ACCENT,
    backgroundColor: '#FFF',
  },
  contactBtnText: { fontSize: 15, fontWeight: '600' as const, color: ACCENT },
  messageBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 46, borderRadius: 23, backgroundColor: ACCENT,
  },
  messageBtnText: { fontSize: 15, fontWeight: '600' as const, color: '#FFF' },

  sectionHeader: { marginTop: 8, marginBottom: 12 },
  sectionTitle: {
    fontSize: 16, fontWeight: '700' as const, color: '#1A1A1A',
    textTransform: 'uppercase' as const, letterSpacing: 0.5,
  },

  productCard: {
    width: CARD_WIDTH, backgroundColor: '#FFF', borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: '#EBEBEB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8,
    elevation: 3,
  },
  productImageWrap: { position: 'relative' as const },
  productImage: { width: '100%' as const, aspectRatio: 1, backgroundColor: '#F7F7F7' },
  productImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  stockBadgeIn: {
    position: 'absolute' as const, top: 8, left: 8,
    backgroundColor: '#30D158', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  stockBadgeOut: {
    position: 'absolute' as const, top: 8, left: 8,
    backgroundColor: '#FF453A', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  stockBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' as const },

  productInfo: { padding: 10 },
  productTitle: { fontSize: 13, fontWeight: '600' as const, color: '#1A1A1A', marginBottom: 4 },
  productPrice: { fontSize: 16, fontWeight: '800' as const, color: ACCENT },
  productLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  productLocationText: { fontSize: 11, color: '#999', flex: 1 },

  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 14, color: '#999' },

  emptyTitle: { fontSize: 17, fontWeight: '600' as const, color: '#1A1A1A', marginTop: 12 },
  goBackBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#F7F7F7', borderRadius: 10 },
  goBackText: { fontSize: 14, fontWeight: '600' as const, color: '#1A1A1A' },
});
