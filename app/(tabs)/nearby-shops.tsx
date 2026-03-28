import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Platform, ActivityIndicator, TextInput, RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useApp } from '@/lib/context';
import { apiRequest, getApiUrl } from '@/lib/query-client';

const PURPLE    = '#8B5CF6';
const TEAL      = '#0D9488';
const TEXT      = '#111827';
const MUTED     = '#6B7280';
const BG        = '#F9FAFB';
const WHITE     = '#FFFFFF';
const BORDER    = '#E5E7EB';
const ORANGE    = '#F59E0B';
const NEARBY_KM = 50;

function calcDist(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDist(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  if (km < 10) return `${km.toFixed(1)}km`;
  return `${Math.round(km)}km`;
}

function getUri(img: string): string {
  if (!img) return '';
  if (img.startsWith('http')) return img;
  if (img.startsWith('/')) return `${getApiUrl()}${img}`;
  return img;
}

interface Shop {
  id: string;
  name: string;
  businessName?: string;
  avatar?: string;
  shopThumbnail?: string;
  bannerImage?: string;
  city?: string;
  state?: string;
  latitude?: string;
  longitude?: string;
  productCount?: number;
  role: string;
  distance?: number;
}

// Flat list item types
type ListItem =
  | { type: 'header'; title: string; count: number; icon: string }
  | { type: 'row'; left: Shop; right: Shop | null };

function buildItems(sections: { title: string; icon: string; data: Shop[] }[]): ListItem[] {
  const items: ListItem[] = [];
  for (const sec of sections) {
    if (sec.data.length === 0) continue;
    items.push({ type: 'header', title: sec.title, count: sec.data.length, icon: sec.icon });
    for (let i = 0; i < sec.data.length; i += 2) {
      items.push({ type: 'row', left: sec.data[i], right: sec.data[i + 1] ?? null });
    }
  }
  return items;
}

function ShopCard({ item, accentColor, flex }: { item: Shop; accentColor: string; flex?: number }) {
  const name = item.businessName || item.name || 'Shop';
  const thumb = getUri(item.shopThumbnail || item.bannerImage || item.avatar || '');
  return (
    <TouchableOpacity
      style={[styles.card, flex != null && { flex }]}
      activeOpacity={0.88}
      onPress={() => router.push(`/shop/${item.id}` as any)}
    >
      <View style={styles.cardImg}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.cardImgPlaceholder]}>
            <Ionicons name="storefront" size={30} color={accentColor + '60'} />
          </View>
        )}
        {item.distance != null && (
          <View style={[styles.distBadge, { backgroundColor: accentColor }]}>
            <Ionicons name="location" size={8} color={WHITE} />
            <Text style={styles.distTxt}>{fmtDist(item.distance)} away</Text>
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={1}>{name}</Text>
        {(item.city || item.state) && (
          <View style={styles.cityRow}>
            <Ionicons name="location-outline" size={10} color={MUTED} />
            <Text style={styles.cityTxt} numberOfLines={1}>
              {[item.city, item.state].filter(Boolean).join(', ')}
            </Text>
          </View>
        )}
        {!!item.productCount && (
          <Text style={[styles.prodCnt, { color: accentColor }]}>
            {item.productCount} product{item.productCount !== 1 ? 's' : ''}
          </Text>
        )}
        <View style={[styles.visitBtn, { borderColor: accentColor + '40', backgroundColor: accentColor + '10' }]}>
          <Ionicons name="storefront-outline" size={10} color={accentColor} />
          <Text style={[styles.visitTxt, { color: accentColor }]}>Visit Shop</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function NearbyShopsScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useApp();

  const isTechnician = profile?.role === 'technician';
  const shopRole     = isTechnician ? 'supplier' : 'shopkeeper';
  const accent       = isTechnician ? TEAL : PURPLE;
  const pageTitle    = isTechnician ? 'Supplier Shops' : 'Nearby Shops';
  const pageSub      = isTechnician ? 'Find wholesale suppliers near you' : 'Discover shops near you';

  const [shops, setShops]           = useState<Shop[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]         = useState('');
  const [userLoc, setUserLoc]       = useState<{ latitude: number; longitude: number } | null>(null);
  const [locErr, setLocErr]         = useState('');
  const [filter, setFilter]         = useState<'all' | 'nearby'>('all');

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  // Request location once
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setUserLoc({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        } else {
          setLocErr('No GPS — showing all shops');
        }
      } catch {
        setLocErr('No GPS — showing all shops');
      }
    })();
  }, []);

  const loadShops = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res  = await apiRequest('GET', '/api/profiles');
      const data = await res.json();
      const arr: any[] = Array.isArray(data) ? data : (data.profiles || []);
      setShops(arr.filter((u: any) => u.role === shopRole && !u.blocked_at));
    } catch (e) {
      console.error('NearbyShops error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [shopRole]);

  useFocusEffect(useCallback(() => { loadShops(); }, [loadShops]));

  // Enrich with distances
  const enriched: Shop[] = shops.map(s => {
    if (userLoc && s.latitude && s.longitude) {
      const lat = parseFloat(s.latitude);
      const lng = parseFloat(s.longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        return { ...s, distance: calcDist(userLoc.latitude, userLoc.longitude, lat, lng) };
      }
    }
    return s;
  });

  // Search
  const q = search.trim().toLowerCase();
  const searched = q
    ? enriched.filter(s =>
        (s.businessName || s.name || '').toLowerCase().includes(q) ||
        (s.city || '').toLowerCase().includes(q) ||
        (s.state || '').toLowerCase().includes(q)
      )
    : enriched;

  const nearby   = searched.filter(s => s.distance != null && s.distance <= NEARBY_KM)
    .sort((a, b) => (a.distance ?? 999999) - (b.distance ?? 999999));
  const allIndia = searched.filter(s => s.distance == null || s.distance > NEARBY_KM)
    .sort((a, b) => (a.businessName || a.name || '').localeCompare(b.businessName || b.name || ''));

  const sections =
    filter === 'nearby'
      ? [{ title: `Nearby (within ${NEARBY_KM}km)`, icon: 'location', data: nearby }]
      : [
          ...(nearby.length > 0 ? [{ title: `Nearby (within ${NEARBY_KM}km)`, icon: 'location', data: nearby }] : []),
          ...(allIndia.length > 0 ? [{ title: 'All India', icon: 'globe-outline', data: allIndia }] : []),
        ];

  const listItems = buildItems(sections);
  const isEmpty   = listItems.length === 0 && !loading;

  const renderItem = useCallback(({ item }: { item: ListItem }) => {
    if (item.type === 'header') {
      return (
        <View style={styles.secHeader}>
          <Ionicons name={item.icon as any} size={14} color={accent} />
          <Text style={styles.secTitle}>{item.title}</Text>
          <View style={styles.secBadge}>
            <Text style={styles.secBadgeTxt}>{item.count}</Text>
          </View>
        </View>
      );
    }
    return (
      <View style={styles.row}>
        <ShopCard item={item.left} accentColor={accent} flex={1} />
        {item.right
          ? <ShopCard item={item.right} accentColor={accent} flex={1} />
          : <View style={{ flex: 1 }} />
        }
      </View>
    );
  }, [accent]);

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.pageTitle}>{pageTitle}</Text>
        <Text style={styles.pageSub}>{pageSub}</Text>

        {/* Search */}
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={15} color={MUTED} style={{ marginLeft: 12 }} />
          <TextInput
            style={styles.searchInput}
            placeholder={isTechnician ? 'Search suppliers, city...' : 'Search shops, city...'}
            placeholderTextColor={MUTED}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} style={{ padding: 10 }}>
              <Ionicons name="close-circle" size={15} color={MUTED} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter pills */}
        <View style={styles.pillsRow}>
          {(['all', 'nearby'] as const).map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.pill, filter === f && { backgroundColor: accent, borderColor: accent }]}
              onPress={() => setFilter(f)}
            >
              <Ionicons
                name={f === 'nearby' ? 'location-outline' : 'globe-outline'}
                size={11}
                color={filter === f ? WHITE : MUTED}
              />
              <Text style={[styles.pillTxt, filter === f && { color: WHITE }]}>
                {f === 'all' ? 'All Shops' : 'Nearby'}
              </Text>
            </TouchableOpacity>
          ))}
          {locErr ? (
            <View style={styles.locErrBadge}>
              <Ionicons name="warning-outline" size={10} color={ORANGE} />
              <Text style={styles.locErrTxt}>No GPS</Text>
            </View>
          ) : userLoc ? (
            <View style={styles.locOkBadge}>
              <Ionicons name="location" size={10} color={TEAL} />
              <Text style={styles.locOkTxt}>Location on</Text>
            </View>
          ) : null}
        </View>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={accent} />
          <Text style={styles.loaderTxt}>Finding shops...</Text>
        </View>
      ) : isEmpty ? (
        <View style={styles.empty}>
          <Ionicons name="storefront-outline" size={52} color={BORDER} />
          <Text style={styles.emptyTitle}>
            {filter === 'nearby' ? 'No nearby shops' : 'No shops yet'}
          </Text>
          <Text style={styles.emptySub}>
            {filter === 'nearby'
              ? `No shops within ${NEARBY_KM}km. Try "All Shops"`
              : isTechnician ? 'Suppliers will appear here' : 'Shopkeeper shops will appear here'}
          </Text>
          {filter === 'nearby' && (
            <TouchableOpacity
              style={[styles.switchBtn, { backgroundColor: accent }]}
              onPress={() => setFilter('all')}
            >
              <Text style={styles.switchTxt}>Show All Shops</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={listItems}
          keyExtractor={(item, index) => index.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadShops(true)}
              tintColor={accent}
              colors={[accent]}
            />
          }
        />
      )}
    </View>
  );
}

const CARD_GAP = 10;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  header: {
    backgroundColor: WHITE,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  pageTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', color: TEXT, marginBottom: 2 },
  pageSub:   { fontSize: 13, fontFamily: 'Inter_400Regular', color: MUTED, marginBottom: 12 },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    height: 42,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: TEXT,
    paddingHorizontal: 10,
  },

  pillsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: WHITE,
  },
  pillTxt: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: MUTED },

  locErrBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  locErrTxt:   { fontSize: 11, color: ORANGE, fontFamily: 'Inter_400Regular' },
  locOkBadge:  { flexDirection: 'row', alignItems: 'center', gap: 3 },
  locOkTxt:    { fontSize: 11, color: TEAL, fontFamily: 'Inter_400Regular' },

  loader:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loaderTxt: { fontSize: 14, fontFamily: 'Inter_400Regular', color: MUTED },

  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  emptyTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold', color: TEXT },
  emptySub:   { fontSize: 13, fontFamily: 'Inter_400Regular', color: MUTED, textAlign: 'center', lineHeight: 20 },
  switchBtn:  { marginTop: 8, paddingVertical: 10, paddingHorizontal: 24, borderRadius: 10 },
  switchTxt:  { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: WHITE },

  list: { padding: 12, paddingBottom: 100 },

  secHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 2,
  },
  secTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: TEXT, flex: 1 },
  secBadge: { backgroundColor: BORDER, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1 },
  secBadgeTxt: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: MUTED },

  row: { flexDirection: 'row', gap: CARD_GAP, marginBottom: CARD_GAP },

  card: {
    backgroundColor: WHITE,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: BORDER,
  },
  cardImg: { width: '100%', aspectRatio: 1.05, backgroundColor: BG },
  cardImgPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: BG },

  distBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  distTxt: { fontSize: 9, fontFamily: 'Inter_700Bold', color: WHITE },

  cardBody:   { padding: 10, gap: 3 },
  cardName:   { fontSize: 13, fontFamily: 'Inter_700Bold', color: TEXT },
  cityRow:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  cityTxt:    { fontSize: 11, fontFamily: 'Inter_400Regular', color: MUTED, flex: 1 },
  prodCnt:    { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  visitBtn:   {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 4, borderWidth: 1, borderRadius: 6,
    paddingVertical: 4, paddingHorizontal: 8, alignSelf: 'flex-start',
  },
  visitTxt:   { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
});
