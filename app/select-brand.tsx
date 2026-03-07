import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform,
  TextInput, Dimensions, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';

const { width: SW } = Dimensions.get('window');
const NUM_COLS = SW >= 600 ? 3 : 2;
const GAP      = 12;
const H_PAD    = 16;
const CARD_W   = (SW - H_PAD * 2 - GAP * (NUM_COLS - 1)) / NUM_COLS;

const BG      = '#F5F5F5';
const CARD    = '#FFFFFF';
const DARK    = '#1A1A1A';
const MUTED   = '#888888';
const BORDER  = '#EEEEEE';
const PRIMARY = '#E8704A';
const PRIMARY_L = '#FFF1EC';

const SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.07,
  shadowRadius: 8,
  elevation: 2,
};

// ── Brand data ──────────────────────────────────────────────────────────────
type Brand = { name: string; logo: string; accentColor: string; accentBg: string; popular?: true };

const BRANDS: Brand[] = [
  {
    name: 'Apple',       popular: true,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Apple_logo_black.svg/512px-Apple_logo_black.svg.png',
    accentColor: '#1C1C1E', accentBg: '#F5F5F7',
  },
  {
    name: 'Samsung',     popular: true,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Samsung_Logo.svg/512px-Samsung_Logo.svg.png',
    accentColor: '#1428A0', accentBg: '#EAF0FF',
  },
  {
    name: 'Xiaomi',      popular: true,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Xiaomi_logo.svg/512px-Xiaomi_logo.svg.png',
    accentColor: '#FF6900', accentBg: '#FFF0E8',
  },
  {
    name: 'Vivo',        popular: true,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Vivo_logo.svg/512px-Vivo_logo.svg.png',
    accentColor: '#415FFF', accentBg: '#EAEDFF',
  },
  {
    name: 'Oppo',        popular: true,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Oppo_logo.svg/512px-Oppo_logo.svg.png',
    accentColor: '#1F8EF1', accentBg: '#E8F4FF',
  },
  {
    name: 'Realme',      popular: true,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Realme_text_logo.svg/512px-Realme_text_logo.svg.png',
    accentColor: '#E8A100', accentBg: '#FFF8E8',
  },
  {
    name: 'OnePlus',     popular: true,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/OnePlus_2016_logo.svg/512px-OnePlus_2016_logo.svg.png',
    accentColor: '#F5010C', accentBg: '#FFEBEB',
  },
  {
    name: 'Motorola',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Motorola_Batwing_Logo.svg/512px-Motorola_Batwing_Logo.svg.png',
    accentColor: '#005A9C', accentBg: '#E8F2FB',
  },
  {
    name: 'Google Pixel',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/512px-Google_%22G%22_logo.svg.png',
    accentColor: '#4285F4', accentBg: '#EEF4FF',
  },
  {
    name: 'Nokia',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Nokia_logo.svg/512px-Nokia_logo.svg.png',
    accentColor: '#124191', accentBg: '#E8EEFB',
  },
  {
    name: 'Honor',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Honor_smartphone_brand_logo.svg/512px-Honor_smartphone_brand_logo.svg.png',
    accentColor: '#CF0A2C', accentBg: '#FFEBEF',
  },
  {
    name: 'Huawei',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Huawei_Standard_logo.svg/512px-Huawei_Standard_logo.svg.png',
    accentColor: '#CF0A2C', accentBg: '#FFEBEF',
  },
  {
    name: 'Infinix',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Infinix_Mobility_Logo.svg/512px-Infinix_Mobility_Logo.svg.png',
    accentColor: '#E8704A', accentBg: '#FFF1EC',
  },
  {
    name: 'Tecno',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Tecno_Logo.svg/512px-Tecno_Logo.svg.png',
    accentColor: '#00AEEF', accentBg: '#E8F8FF',
  },
  {
    name: 'Nothing',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Nothing_%28company%29_logo.svg/512px-Nothing_%28company%29_logo.svg.png',
    accentColor: '#1A1A1A', accentBg: '#F5F5F5',
  },
  {
    name: 'Asus',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Asus_logo.svg/512px-Asus_logo.svg.png',
    accentColor: '#00AEEF', accentBg: '#E8F8FF',
  },
  {
    name: 'Sony',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Sony_logo.svg/512px-Sony_logo.svg.png',
    accentColor: '#1A1A1A', accentBg: '#F5F5F5',
  },
  {
    name: 'Lava',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Lava_International_Logo.svg/512px-Lava_International_Logo.svg.png',
    accentColor: '#FF4500', accentBg: '#FFF0EC',
  },
  {
    name: 'Micromax',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Micromax_logo.svg/512px-Micromax_logo.svg.png',
    accentColor: '#D40000', accentBg: '#FFEBEB',
  },
];

const POPULAR = BRANDS.filter(b => b.popular);

// ── Fallback initials box ────────────────────────────────────────────────────
function BrandLogo({ brand, size }: { brand: Brand; size: number }) {
  const [failed, setFailed] = useState(false);
  
  return (
    <Image
      source={{ uri: brand.logo }}
      style={{ width: size, height: size, borderRadius: 6 }}
      contentFit="contain"
      cachePolicy="memory-disk"
      onError={() => {
        console.log('[BrandLogo] Failed to load:', brand.name, brand.logo);
        setFailed(true);
      }}
    />
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────
export default function SelectBrandScreen() {
  const insets    = useSafeAreaInsets();
  const [search, setSearch] = useState('');

  const topInset  = Platform.OS === 'web' ? 67 : insets.top;
  const botPad    = Platform.OS === 'web' ? 34 : insets.bottom + 16;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? BRANDS.filter(b => b.name.toLowerCase().includes(q)) : BRANDS;
  }, [search]);

  const goToBrand = (name: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/select-model', params: { brand: name } } as any);
  };

  return (
    <View style={[styles.root, { paddingTop: topInset }]}>

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <View style={styles.nav}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={DARK} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle}>Select Brand</Text>
          <Text style={styles.navSub}>Choose your phone brand to continue</Text>
        </View>
      </View>

      {/* ── Search ───────────────────────────────────────────────────────── */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={MUTED} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search brand..."
          placeholderTextColor={MUTED}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {search.length > 0 && Platform.OS !== 'ios' && (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={MUTED} />
          </Pressable>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: botPad + 24 }}
      >
        {/* ── Popular Brands ───────────────────────────────────────────────── */}
        {!search && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>Popular Brands</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.popularRow}
            >
              {POPULAR.map(b => (
                <Pressable
                  key={b.name}
                  style={({ pressed }) => [styles.popularItem, { opacity: pressed ? 0.8 : 1 }]}
                  onPress={() => goToBrand(b.name)}
                >
                  <View style={[styles.popularLogoWrap, { backgroundColor: b.accentBg, borderColor: b.accentColor + '22' }]}>
                    <BrandLogo brand={b} size={40} />
                  </View>
                  <Text style={styles.popularName} numberOfLines={1}>{b.name}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>All Brands</Text>
              <Text style={styles.sectionCount}>{BRANDS.length} brands</Text>
            </View>
          </>
        )}

        {/* ── Brand Grid ───────────────────────────────────────────────────── */}
        <View style={styles.grid}>
          {filtered.map(b => (
            <BrandCard key={b.name} brand={b} onPress={() => goToBrand(b.name)} />
          ))}
        </View>

        {filtered.length === 0 && (
          <View style={styles.emptyWrap}>
            <Ionicons name="search-outline" size={36} color={MUTED} />
            <Text style={styles.emptyTitle}>No brand found</Text>
            <Text style={styles.emptyText}>Try a different search term</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── Brand card ───────────────────────────────────────────────────────────────
function BrandCard({ brand, onPress }: { brand: Brand; onPress: () => void }) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      style={[styles.brandCard, pressed && { borderColor: PRIMARY, borderWidth: 1.5 }]}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
    >
      {/* Logo box */}
      <View style={[styles.logoBox, { backgroundColor: brand.accentBg }]}>
        <BrandLogo brand={brand} size={CARD_W * 0.5} />
      </View>

      {/* Name */}
      <Text style={styles.brandName} numberOfLines={1}>{brand.name}</Text>

      {/* Price */}
      <View style={styles.priceRow}>
        <Ionicons name="pricetag-outline" size={10} color={PRIMARY} />
        <Text style={styles.brandPrice}>Starting from ₹199</Text>
      </View>
    </Pressable>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  nav: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 14,
  },
  backBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: CARD, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: BORDER, ...SHADOW,
  },
  navTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: DARK },
  navSub:   { fontSize: 12, fontFamily: 'Inter_400Regular', color: MUTED, marginTop: 2 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: CARD, borderRadius: 14,
    paddingHorizontal: 14, height: 50,
    gap: 10, marginHorizontal: H_PAD, marginBottom: 20,
    borderWidth: 1, borderColor: BORDER, ...SHADOW,
  },
  searchInput: {
    flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', color: DARK, padding: 0,
  },

  sectionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: H_PAD, marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 13, fontFamily: 'Inter_700Bold', color: DARK,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  sectionCount: { fontSize: 12, color: MUTED, fontFamily: 'Inter_400Regular' },

  popularRow: { paddingHorizontal: H_PAD, gap: 16, paddingBottom: 24 },
  popularItem: { alignItems: 'center', width: 66 },
  popularLogoWrap: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 7, borderWidth: 1,
    ...SHADOW,
  },
  popularName: {
    fontSize: 11, fontFamily: 'Inter_500Medium', color: DARK,
    textAlign: 'center',
  },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: H_PAD, gap: GAP,
  },

  brandCard: {
    width: CARD_W,
    backgroundColor: CARD,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
    ...SHADOW,
  },
  logoBox: {
    width: CARD_W - 24,
    height: CARD_W * 0.50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  brandName: {
    fontSize: 14, fontFamily: 'Inter_700Bold', color: DARK,
    marginBottom: 6, textAlign: 'center',
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  brandPrice: {
    fontSize: 11, fontFamily: 'Inter_600SemiBold', color: PRIMARY,
  },

  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: DARK },
  emptyText:  { fontSize: 14, color: MUTED, fontFamily: 'Inter_400Regular' },
});
