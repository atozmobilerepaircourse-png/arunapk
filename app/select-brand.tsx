import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform, FlatList, TextInput, Dimensions, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';

const { width: SW } = Dimensions.get('window');
const CARD_W = (SW - 48) / 3;

const BG   = '#F2F4F7';
const CARD = '#FFFFFF';
const DARK = '#0F172A';
const GRAY = '#64748B';
const PRIMARY = '#FF6B2C';

const POPULAR_BRANDS = [
  { name: 'Apple',    emoji: '🍎', color: '#1C1C1E', bg: '#F5F5F7' },
  { name: 'Samsung',  emoji: '📱', color: '#1428A0', bg: '#EAF0FF' },
  { name: 'Xiaomi',   emoji: '📲', color: '#FF6900', bg: '#FFF0E8' },
  { name: 'Vivo',     emoji: '📱', color: '#415FFF', bg: '#EAEDFF' },
  { name: 'Oppo',     emoji: '📱', color: '#1F8EF1', bg: '#E8F4FF' },
  { name: 'Realme',   emoji: '📱', color: '#E8A100', bg: '#FFF8E8' },
  { name: 'OnePlus',  emoji: '📱', color: '#F5010C', bg: '#FFEBEB' },
];

const ALL_BRANDS = [
  { name: 'Apple',    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Apple_logo_black.svg/120px-Apple_logo_black.svg.png',   bg: '#FFFFFF' },
  { name: 'Samsung',  logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Samsung_Logo.svg/320px-Samsung_Logo.svg.png',             bg: '#FFFFFF' },
  { name: 'Xiaomi',   logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Xiaomi_logo_%282021-%29.svg/320px-Xiaomi_logo_%282021-%29.svg.png', bg: '#FFFFFF' },
  { name: 'Vivo',     logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Vivo_logo_2019.svg/320px-Vivo_logo_2019.svg.png',         bg: '#FFFFFF' },
  { name: 'Oppo',     logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Oppo_logo.svg/320px-Oppo_logo.svg.png',                   bg: '#FFFFFF' },
  { name: 'Realme',   logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Realme_logo.svg/320px-Realme_logo.svg.png',               bg: '#FFFFFF' },
  { name: 'OnePlus',  logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/OnePlus_Logo.svg/320px-OnePlus_Logo.svg.png',             bg: '#FFFFFF' },
  { name: 'Motorola', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/Motorola_2021_logo.svg/320px-Motorola_2021_logo.svg.png', bg: '#FFFFFF' },
  { name: 'Google',   logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Google_2015_logo.svg/320px-Google_2015_logo.svg.png',    bg: '#FFFFFF' },
];

export default function SelectBrandScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const topInset  = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom + 16;

  const filtered = search.trim()
    ? ALL_BRANDS.filter(b => b.name.toLowerCase().includes(search.toLowerCase()))
    : ALL_BRANDS;

  const goToBrand = (brand: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/select-model', params: { brand } } as any);
  };

  return (
    <View style={[styles.root, { paddingTop: topInset }]}>
      {/* ── Nav ── */}
      <View style={styles.nav}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={DARK} />
        </Pressable>
        <View>
          <Text style={styles.navTitle}>Select Brand</Text>
          <Text style={styles.navSub}>Choose your phone brand</Text>
        </View>
      </View>

      {/* ── Search ── */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={GRAY} style={{ marginLeft: 2 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search brand..."
          placeholderTextColor={GRAY}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={GRAY} />
          </Pressable>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomPad + 24 }}>
        {/* ── Popular ── */}
        {!search && (
          <>
            <Text style={styles.sectionLabel}>Popular Brands</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.popularRow}>
              {POPULAR_BRANDS.map(b => (
                <Pressable key={b.name} style={({ pressed }) => [styles.popularChip, { opacity: pressed ? 0.8 : 1 }]} onPress={() => goToBrand(b.name)}>
                  <View style={[styles.popularEmoji, { backgroundColor: b.bg }]}>
                    <Text style={{ fontSize: 22 }}>{b.emoji}</Text>
                  </View>
                  <Text style={styles.popularChipName}>{b.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.sectionLabel}>All Brands</Text>
          </>
        )}

        {/* ── Brand Grid ── */}
        <View style={styles.grid}>
          {filtered.map(b => (
            <Pressable
              key={b.name}
              style={({ pressed }) => [styles.brandCard, { opacity: pressed ? 0.88 : 1 }]}
              onPress={() => goToBrand(b.name)}
            >
              <View style={[styles.logoBox, { backgroundColor: b.bg }]}>
                {b.logo ? (
                  <Image source={{ uri: b.logo }} style={styles.logo} contentFit="contain" />
                ) : (
                  <Text style={{ fontSize: 22, fontFamily: 'Inter_700Bold', color: DARK }}>{b.name[0]}</Text>
                )}
              </View>
              <Text style={styles.brandName} numberOfLines={1}>{b.name}</Text>
              <Text style={styles.brandPrice}>Starts ₹199</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  navTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: DARK },
  navSub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: GRAY, marginTop: 1 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 10, marginHorizontal: 16, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', color: DARK, padding: 0 },
  sectionLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: GRAY, paddingHorizontal: 16, marginBottom: 12, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  popularRow: { paddingHorizontal: 16, gap: 14, paddingBottom: 20 },
  popularChip: { alignItems: 'center', width: 68 },
  popularEmoji: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  popularChipName: { fontSize: 11, fontFamily: 'Inter_500Medium', color: DARK, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 10 },
  brandCard: { width: CARD_W, backgroundColor: CARD, borderRadius: 20, padding: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3, borderWidth: 1, borderColor: '#F1F5F9' },
  logoBox: { width: '100%', height: 60, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  logo: { width: '70%', height: '70%' },
  brandName: { fontSize: 13, fontFamily: 'Inter_700Bold', color: DARK, marginBottom: 2, textAlign: 'center' },
  brandPrice: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: PRIMARY },
});
