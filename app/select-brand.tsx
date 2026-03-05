import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform, FlatList, TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';

const PRIMARY = '#FF6B2C';
const BG      = '#F5F7FA';
const CARD    = '#FFFFFF';
const DARK    = '#1A1A2E';
const GRAY    = '#8E8E93';

const BRANDS = [
  { name: 'Apple',   logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Apple_logo_black.svg/120px-Apple_logo_black.svg.png',    bg: '#F5F5F7', count: 48 },
  { name: 'Samsung', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Samsung_Logo.svg/320px-Samsung_Logo.svg.png',              bg: '#EAF0FF', count: 76 },
  { name: 'Xiaomi',  logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Xiaomi_logo_%282021-%29.svg/320px-Xiaomi_logo_%282021-%29.svg.png', bg: '#FFF0E8', count: 52 },
  { name: 'Vivo',    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Vivo_logo_2019.svg/320px-Vivo_logo_2019.svg.png',          bg: '#EAF0FF', count: 44 },
  { name: 'Oppo',    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Oppo_logo.svg/320px-Oppo_logo.svg.png',                    bg: '#E8F4FF', count: 38 },
  { name: 'Realme',  logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Realme_logo.svg/320px-Realme_logo.svg.png',                bg: '#FFFBE8', count: 42 },
  { name: 'OnePlus', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/OnePlus_Logo.svg/320px-OnePlus_Logo.svg.png',              bg: '#FFEBEB', count: 28 },
  { name: 'Motorola',logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/Motorola_2021_logo.svg/320px-Motorola_2021_logo.svg.png',  bg: '#F0F0F0', count: 32 },
  { name: 'Nokia',   logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/Nokia_wordmark.svg/320px-Nokia_wordmark.svg.png',          bg: '#E8F0FF', count: 22 },
  { name: 'Google',  logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Google_2015_logo.svg/320px-Google_2015_logo.svg.png',     bg: '#EAF7EE', count: 14 },
  { name: 'Asus',    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/ASUS_Logo.svg/320px-ASUS_Logo.svg.png',                   bg: '#F5F0FF', count: 18 },
  { name: 'Poco',    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/POCO_Logo.svg/320px-POCO_Logo.svg.png',                   bg: '#FFF0E8', count: 24 },
];

export default function SelectBrandScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const topInset  = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom + 16;

  const filtered = BRANDS.filter(b => b.name.toLowerCase().includes(search.toLowerCase()));

  const handleBrand = (brand: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/select-model', params: { brand } } as any);
  };

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.navBar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={DARK} />
        </Pressable>
        <Text style={styles.navTitle}>Select Brand</Text>
        <View style={{ width: 40 }} />
      </View>

      <Text style={styles.subTitle}>Which brand is your phone?</Text>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={GRAY} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search brand..."
          placeholderTextColor={GRAY}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={GRAY} />
          </Pressable>
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.name}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[styles.grid, { paddingBottom: bottomPad + 16 }]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.brandCard, { opacity: pressed ? 0.88 : 1 }]}
            onPress={() => handleBrand(item.name)}
          >
            <View style={[styles.logoWrap, { backgroundColor: item.bg }]}>
              <Image source={{ uri: item.logo }} style={styles.logo} contentFit="contain" />
            </View>
            <Text style={styles.brandName}>{item.name}</Text>
            <Text style={styles.brandCount}>{item.count} models</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="search" size={40} color={GRAY} />
            <Text style={styles.emptyText}>No brands found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  navTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: DARK },
  subTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', color: DARK, paddingHorizontal: 16, marginBottom: 14 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 10, marginHorizontal: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', color: DARK, padding: 0 },
  grid: { paddingHorizontal: 16, paddingTop: 4 },
  row: { justifyContent: 'space-between', marginBottom: 12 },
  brandCard: { width: '48%', backgroundColor: CARD, borderRadius: 16, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 },
  logoWrap: { width: 70, height: 70, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  logo: { width: 48, height: 48 },
  brandName: { fontSize: 15, fontFamily: 'Inter_700Bold', color: DARK, marginBottom: 2 },
  brandCount: { fontSize: 12, fontFamily: 'Inter_400Regular', color: GRAY },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 16, fontFamily: 'Inter_400Regular', color: GRAY },
});
