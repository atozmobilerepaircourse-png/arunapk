import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  FlatList, ScrollView, Platform, ActivityIndicator,
  RefreshControl, Dimensions, Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { apiRequest, getApiUrl } from '@/lib/query-client';

const { width: SW } = Dimensions.get('window');

const ACCENT   = '#6B46C1';
const BG       = '#F9FAFB';
const WHITE    = '#FFFFFF';
const DARK     = '#111827';
const MUTED    = '#6B7280';
const BORDER   = '#E5E7EB';
const STAR     = '#F2C94C';
const DANGER   = '#EB5757';

function getImgUri(img: string) {
  if (!img) return '';
  if (img.startsWith('http')) return img;
  if (img.startsWith('/')) return `${getApiUrl()}${img}`;
  return img;
}

function StarRow({ rating = 0, count = 0 }: { rating: number; count: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name="star" size={12} color={STAR} />
      <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: STAR }}>{rating.toFixed(1)}</Text>
      <Text style={{ fontSize: 12, color: MUTED, fontFamily: 'Inter_400Regular' }}>({count} reviews)</Text>
    </View>
  );
}

function SupplierCard({ item, onPress }: { item: any; onPress: () => void }) {
  const bannerUri = getImgUri(item.bannerImage || item.avatar || '');
  const cats: string[] = Array.isArray(item.categories)
    ? item.categories
    : typeof item.categories === 'string'
      ? item.categories.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [];

  return (
    <TouchableOpacity style={ss.card} onPress={onPress} activeOpacity={0.92}>
      {/* Banner */}
      <View style={ss.bannerWrap}>
        {bannerUri ? (
          <Image source={{ uri: bannerUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: ACCENT + '22', alignItems: 'center', justifyContent: 'center' }]}>
            <Ionicons name="storefront" size={36} color={ACCENT} />
          </View>
        )}
        <View style={ss.bannerOverlay} />
        <View style={ss.bannerBadge}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#27AE60', marginRight: 4 }} />
          <Text style={{ fontSize: 10, color: WHITE, fontFamily: 'Inter_600SemiBold' }}>Verified</Text>
        </View>
      </View>

      {/* Body */}
      <View style={ss.cardBody}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <Text style={ss.shopName} numberOfLines={1}>{item.businessName || item.name || 'Supplier Shop'}</Text>
          <TouchableOpacity style={{ padding: 2 }} onPress={() => {}}>
            <Ionicons name="heart-outline" size={18} color={MUTED} />
          </TouchableOpacity>
        </View>

        <View style={ss.metaRow}>
          <StarRow rating={parseFloat(item.rating) || 4.5} count={parseInt(item.reviewCount) || 0} />
          {item.city || item.location ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="location-outline" size={11} color={MUTED} />
              <Text style={ss.metaText}>{item.city || item.location}</Text>
            </View>
          ) : null}
          {item.yearsActive ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="time-outline" size={11} color={MUTED} />
              <Text style={ss.metaText}>{item.yearsActive} yrs</Text>
            </View>
          ) : null}
        </View>

        {cats.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {cats.slice(0, 4).map((c, i) => (
                <View key={i} style={ss.catTag}>
                  <Text style={ss.catTagText}>{c}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 10, marginTop: 2 }}>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            {item.productCount != null && (
              <View>
                <Text style={{ fontSize: 15, fontFamily: 'Inter_700Bold', color: DARK }}>{item.productCount}</Text>
                <Text style={{ fontSize: 11, color: MUTED, fontFamily: 'Inter_400Regular' }}>Products</Text>
              </View>
            )}
          </View>
          <TouchableOpacity style={ss.visitBtn} onPress={onPress}>
            <Text style={ss.visitBtnText}>Visit Shop</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function MarketplaceScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch]       = useState('');
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const webTop = Platform.OS === 'web' ? 67 : 0;

  const fetchSuppliers = useCallback(async () => {
    try {
      const res  = await apiRequest('GET', '/api/profiles');
      const data = await res.json();
      const arr  = Array.isArray(data) ? data : (data.profiles || []);
      setSuppliers(arr.filter((u: any) => u.role === 'supplier' && !u.blocked));
    } catch {
      setSuppliers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  const filtered = suppliers.filter(s => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (s.businessName || s.name || '').toLowerCase().includes(q) ||
      (s.city || s.location || '').toLowerCase().includes(q) ||
      (Array.isArray(s.categories) ? s.categories.join(' ') : (s.categories || '')).toLowerCase().includes(q)
    );
  });

  const openShop = (s: any) => {
    router.push({ pathname: '/shop/[supplierId]', params: { supplierId: s.id, supplierName: s.businessName || s.name } } as any);
  };

  return (
    <View style={[ss.root, { paddingTop: webTop }]}>
      {/* Header */}
      <View style={[ss.header, { paddingTop: Platform.OS === 'ios' ? insets.top : 12 }]}>
        <View style={ss.headerRow}>
          <TouchableOpacity style={ss.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={DARK} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={ss.headerTitle}>Discover Suppliers</Text>
            <Text style={ss.headerSub}>Find trusted wholesale partners for your business</Text>
          </View>
        </View>

        {/* Search */}
        <View style={ss.searchWrap}>
          <Ionicons name="search-outline" size={16} color={MUTED} style={{ marginLeft: 14 }} />
          <TextInput
            style={ss.searchInput}
            placeholder="Search suppliers, products, categories..."
            placeholderTextColor={MUTED}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} style={{ padding: 10 }}>
              <Ionicons name="close-circle" size={16} color={MUTED} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={ACCENT} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id?.toString()}
          renderItem={({ item }) => <SupplierCard item={item} onPress={() => openShop(item)} />}
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSuppliers(); }} tintColor={ACCENT} />}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Ionicons name="storefront-outline" size={48} color={BORDER} />
              <Text style={{ marginTop: 12, fontSize: 15, color: MUTED, fontFamily: 'Inter_500Medium' }}>
                {search ? 'No suppliers found' : 'No suppliers yet'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const ss = StyleSheet.create({
  root:       { flex: 1, backgroundColor: BG },
  header:     { backgroundColor: WHITE, borderBottomWidth: 1, borderBottomColor: BORDER, paddingHorizontal: 16, paddingBottom: 12 },
  headerRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  backBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  headerTitle:{ fontSize: 20, fontFamily: 'Inter_700Bold', color: DARK },
  headerSub:  { fontSize: 13, fontFamily: 'Inter_400Regular', color: MUTED, marginTop: 2 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 999, borderWidth: 1, borderColor: BORDER, gap: 6 },
  searchInput:{ flex: 1, height: 42, fontSize: 14, fontFamily: 'Inter_400Regular', color: DARK, paddingHorizontal: 8 },

  card:       { backgroundColor: WHITE, borderRadius: 16, borderWidth: 1, borderColor: BORDER, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  bannerWrap: { height: 140, backgroundColor: '#E5E7EB', overflow: 'hidden', position: 'relative' },
  bannerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  bannerBadge:{ position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },

  cardBody:   { padding: 16 },
  shopName:   { fontSize: 16, fontFamily: 'Inter_700Bold', color: DARK, flex: 1, marginRight: 8 },

  metaRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  metaText:   { fontSize: 12, color: MUTED, fontFamily: 'Inter_400Regular' },

  catTag:     { backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  catTagText: { fontSize: 11, color: '#4B5563', fontFamily: 'Inter_500Medium' },

  visitBtn:   { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: BORDER, backgroundColor: WHITE },
  visitBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: DARK },
});
