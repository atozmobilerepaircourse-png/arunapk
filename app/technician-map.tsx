import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { apiRequest } from '@/lib/query-client';
import TechMap from '@/components/TechMap';

const PRIMARY = '#FF6B2C';
const BG = '#F5F5F5';
const CARD = '#FFFFFF';
const BORDER = '#E8E8E8';
const FORE = '#1A1A1A';
const MUTED = '#888888';

export default function TechnicianMapScreen() {
  const insets = useSafeAreaInsets();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [techs, setTechs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const botInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const fetchNearbyTechs = useCallback(async (lat: number, lng: number) => {
    try {
      const res = await apiRequest('GET', `/api/technicians/nearby?lat=${lat}&lng=${lng}&radius=50`);
      const data = await res.json();
      setTechs(Array.isArray(data) ? data : (data.technicians ?? []));
    } catch (err) {
      console.error('[TechMap] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg('Location permission denied. Showing all technicians.');
          fetchNearbyTechs(17.3850, 78.4867);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setLocation(loc);
        fetchNearbyTechs(loc.coords.latitude, loc.coords.longitude);
      } catch {
        setErrorMsg('Could not get location. Showing nearby technicians.');
        fetchNearbyTechs(17.3850, 78.4867);
      }
    })();
  }, [fetchNearbyTechs]);

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={FORE} />
        </Pressable>
        <Text style={styles.headerTitle}>Nearby Technicians</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadingTxt}>Finding technicians near you...</Text>
        </View>
      ) : (
        <TechMap
          techs={techs}
          location={location}
          loading={loading}
          errorMsg={errorMsg}
          bottomInset={botInset}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: CARD, borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: FORE },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  loadingTxt: { fontSize: 15, fontFamily: 'Inter_400Regular', color: MUTED },
});
