import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform, FlatList, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';

const PRIMARY = '#FF6B2C';
const BG      = '#F5F7FA';
const CARD    = '#FFFFFF';
const DARK    = '#1A1A2E';
const GRAY    = '#8E8E93';

const MODELS: Record<string, { name: string; year: string; popular?: boolean }[]> = {
  Apple: [
    { name: 'iPhone 16 Pro Max', year: '2024', popular: true },
    { name: 'iPhone 16 Pro',     year: '2024', popular: true },
    { name: 'iPhone 16',         year: '2024' },
    { name: 'iPhone 16 Plus',    year: '2024' },
    { name: 'iPhone 15 Pro Max', year: '2023', popular: true },
    { name: 'iPhone 15 Pro',     year: '2023' },
    { name: 'iPhone 15',         year: '2023' },
    { name: 'iPhone 14 Pro Max', year: '2022' },
    { name: 'iPhone 14 Pro',     year: '2022' },
    { name: 'iPhone 14',         year: '2022' },
    { name: 'iPhone 13 Pro Max', year: '2021' },
    { name: 'iPhone 13',         year: '2021' },
    { name: 'iPhone 12',         year: '2020' },
    { name: 'iPhone 11',         year: '2019' },
    { name: 'iPhone SE (3rd)',   year: '2022' },
  ],
  Samsung: [
    { name: 'Galaxy S24 Ultra', year: '2024', popular: true },
    { name: 'Galaxy S24+',      year: '2024', popular: true },
    { name: 'Galaxy S24',       year: '2024' },
    { name: 'Galaxy S23 Ultra', year: '2023' },
    { name: 'Galaxy A55',       year: '2024', popular: true },
    { name: 'Galaxy A35',       year: '2024' },
    { name: 'Galaxy A15',       year: '2024' },
    { name: 'Galaxy M55',       year: '2024' },
    { name: 'Galaxy M35',       year: '2024' },
    { name: 'Galaxy F55',       year: '2024' },
    { name: 'Galaxy Z Fold 6',  year: '2024' },
    { name: 'Galaxy Z Flip 6',  year: '2024' },
  ],
  Xiaomi: [
    { name: 'Xiaomi 14 Ultra',  year: '2024', popular: true },
    { name: 'Xiaomi 14',        year: '2024' },
    { name: 'Redmi Note 13 Pro+', year: '2024', popular: true },
    { name: 'Redmi Note 13 Pro',  year: '2024' },
    { name: 'Redmi Note 13',      year: '2024' },
    { name: 'Redmi 13C',          year: '2024' },
    { name: 'POCO X6 Pro',        year: '2024' },
    { name: 'POCO F6 Pro',        year: '2024' },
    { name: 'POCO M6 Pro',        year: '2024' },
  ],
  Vivo: [
    { name: 'Vivo X100 Pro',  year: '2024', popular: true },
    { name: 'Vivo V30 Pro',   year: '2024', popular: true },
    { name: 'Vivo V30',       year: '2024' },
    { name: 'Vivo T3 Pro',    year: '2024' },
    { name: 'Vivo Y200',      year: '2024' },
    { name: 'Vivo Y100',      year: '2024' },
    { name: 'Vivo Y58',       year: '2024' },
  ],
  Oppo: [
    { name: 'OPPO Find X7 Ultra', year: '2024', popular: true },
    { name: 'OPPO Reno 12 Pro',   year: '2024', popular: true },
    { name: 'OPPO Reno 12',       year: '2024' },
    { name: 'OPPO A3 Pro',        year: '2024' },
    { name: 'OPPO A60',           year: '2024' },
  ],
  Realme: [
    { name: 'Realme GT 6',       year: '2024', popular: true },
    { name: 'Realme 12 Pro+',    year: '2024', popular: true },
    { name: 'Realme 12 Pro',     year: '2024' },
    { name: 'Realme Narzo 70',   year: '2024' },
    { name: 'Realme C65',        year: '2024' },
  ],
  OnePlus: [
    { name: 'OnePlus 12',        year: '2024', popular: true },
    { name: 'OnePlus 12R',       year: '2024', popular: true },
    { name: 'OnePlus Nord 4',    year: '2024' },
    { name: 'OnePlus Nord CE 4', year: '2024' },
    { name: 'OnePlus Open',      year: '2024' },
  ],
};

const DEFAULT_MODELS = [
  { name: 'Latest Model', year: '2024', popular: true },
  { name: 'Previous Model', year: '2023' },
  { name: 'Older Model', year: '2022' },
];

export default function SelectModelScreen() {
  const insets = useSafeAreaInsets();
  const { brand } = useLocalSearchParams<{ brand?: string }>();
  const [search, setSearch] = useState('');
  const topInset  = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom + 16;

  const allModels = MODELS[brand || ''] || DEFAULT_MODELS;
  const filtered = allModels.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));

  const handleModel = (model: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/repair-services', params: { brand, model } } as any);
  };

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.navBar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={DARK} />
        </Pressable>
        <Text style={styles.navTitle}>{brand || 'Select Model'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <Text style={styles.subTitle}>Select your model</Text>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={GRAY} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search model..."
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
        contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 16 }]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.modelRow, { opacity: pressed ? 0.88 : 1 }]}
            onPress={() => handleModel(item.name)}
          >
            <View style={styles.modelLeft}>
              <View style={styles.modelIconWrap}>
                <Ionicons name="phone-portrait-outline" size={20} color={PRIMARY} />
              </View>
              <View>
                <View style={styles.modelNameRow}>
                  <Text style={styles.modelName}>{item.name}</Text>
                  {item.popular && (
                    <View style={styles.popularBadge}>
                      <Text style={styles.popularText}>Popular</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.modelYear}>{item.year}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={GRAY} />
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="search" size={40} color={GRAY} />
            <Text style={styles.emptyText}>No models found</Text>
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
  list: { paddingHorizontal: 16, paddingTop: 4, gap: 8 },
  modelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: CARD, borderRadius: 14, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  modelLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  modelIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: PRIMARY + '15', alignItems: 'center', justifyContent: 'center' },
  modelNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modelName: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: DARK },
  popularBadge: { backgroundColor: PRIMARY + '18', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  popularText: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: PRIMARY },
  modelYear: { fontSize: 12, fontFamily: 'Inter_400Regular', color: GRAY, marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 16, fontFamily: 'Inter_400Regular', color: GRAY },
});
