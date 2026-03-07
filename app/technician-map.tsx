import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { apiRequest } from '@/lib/query-client';
import { useApp } from '@/lib/context';
import TechMap from '@/components/TechMap';

const PRIMARY = '#FF6B2C';
const BG = '#F5F5F5';
const CARD = '#FFFFFF';
const BORDER = '#E8E8E8';
const FORE = '#1A1A1A';
const MUTED = '#888888';
const SUCCESS = '#34C759';

const RADIUS_KM = 20;
const POLL_INTERVAL_MS = 30000;

export default function TechnicianMapScreen() {
  const insets = useSafeAreaInsets();
  const { profile, startConversation } = useApp();
  const [customerLocation, setCustomerLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [techs, setTechs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const latRef = useRef<number>(17.3850);
  const lngRef = useRef<number>(78.4867);

  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const botInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const fetchNearbyTechs = useCallback(async (lat: number, lng: number) => {
    try {
      const res = await apiRequest('GET', `/api/technicians/nearby?lat=${lat}&lng=${lng}&radius=${RADIUS_KM}`);
      const data = await res.json();
      setTechs(Array.isArray(data) ? data : (data.technicians ?? []));
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('[TechMap] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const initLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg('Location permission denied. Showing technicians near Hyderabad.');
          fetchNearbyTechs(17.3850, 78.4867);
          return;
        }

        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!mounted) return;
        setCustomerLocation(loc);
        latRef.current = loc.coords.latitude;
        lngRef.current = loc.coords.longitude;
        fetchNearbyTechs(loc.coords.latitude, loc.coords.longitude);

        if (Platform.OS !== 'web') {
          locationSubRef.current = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.Balanced, distanceInterval: 100, timeInterval: 15000 },
            (pos) => {
              if (!mounted) return;
              setCustomerLocation(pos);
              latRef.current = pos.coords.latitude;
              lngRef.current = pos.coords.longitude;
            }
          );
        }
      } catch {
        if (!mounted) return;
        setErrorMsg('Could not get location. Showing nearby technicians.');
        fetchNearbyTechs(17.3850, 78.4867);
      }
    };

    initLocation();

    pollTimerRef.current = setInterval(() => {
      fetchNearbyTechs(latRef.current, lngRef.current);
    }, POLL_INTERVAL_MS);

    return () => {
      mounted = false;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (locationSubRef.current) locationSubRef.current.remove();
    };
  }, [fetchNearbyTechs]);

  const handleChat = useCallback(async (tech: any) => {
    if (!profile) {
      router.push('/onboarding' as any);
      return;
    }
    try {
      const convoId = await startConversation(tech.id, tech.name, tech.role ?? 'technician');
      router.push(`/chat/${convoId}` as any);
    } catch (e) {
      console.error('[TechMap] chat error:', e);
    }
  }, [profile, startConversation]);

  const handleRefresh = useCallback(() => {
    setLoading(true);
    fetchNearbyTechs(latRef.current, lngRef.current);
  }, [fetchNearbyTechs]);

  const availableCount = techs.filter(t => t.availableForJobs === 'true').length;

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={FORE} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Nearby Technicians</Text>
          {lastRefreshed && (
            <Text style={styles.headerSub}>
              {availableCount} available within {RADIUS_KM} km
            </Text>
          )}
        </View>
        <Pressable style={styles.refreshBtn} onPress={handleRefresh} disabled={loading}>
          {loading
            ? <ActivityIndicator size="small" color={PRIMARY} />
            : <Ionicons name="refresh" size={22} color={PRIMARY} />
          }
        </Pressable>
      </View>

      {loading && techs.length === 0 ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadingTxt}>Finding technicians near you...</Text>
          <Text style={styles.loadingSubTxt}>Searching within {RADIUS_KM} km radius</Text>
        </View>
      ) : (
        <TechMap
          techs={techs}
          location={customerLocation}
          loading={loading}
          errorMsg={errorMsg}
          bottomInset={botInset}
          onChat={handleChat}
          radiusKm={RADIUS_KM}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: CARD, borderBottomWidth: 1, borderBottomColor: BORDER,
    gap: 8,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: FORE },
  headerSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: MUTED, marginTop: 1 },
  refreshBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingTxt: { fontSize: 15, fontFamily: 'Inter_500Medium', color: FORE },
  loadingSubTxt: { fontSize: 13, fontFamily: 'Inter_400Regular', color: MUTED },
});
