import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import MapView, { Marker, Callout, Circle } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import type { TechMapProps } from './TechMap';

const PRIMARY = '#FF6B2C';
const CARD = '#FFFFFF';
const BORDER = '#E8E8E8';
const FORE = '#1A1A1A';
const MUTED = '#888888';
const SUCCESS = '#34C759';

export default function TechMap({ techs, location, loading, errorMsg, bottomInset }: TechMapProps) {
  const handleCall = (phone: string) => { if (phone) Linking.openURL(`tel:${phone}`); };
  const availableTechs = techs.filter(t => t.availableForJobs === 'true');

  return (
    <View style={styles.flex}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: location?.coords.latitude ?? 17.3850,
          longitude: location?.coords.longitude ?? 78.4867,
          latitudeDelta: 0.15,
          longitudeDelta: 0.15,
        }}
        showsUserLocation
        showsMyLocationButton
      >
        {techs.map(tech => (
          <Marker
            key={tech.id}
            coordinate={{
              latitude: parseFloat(tech.latitude) || 17.3850,
              longitude: parseFloat(tech.longitude) || 78.4867,
            }}
            pinColor={tech.availableForJobs === 'true' ? SUCCESS : MUTED}
          >
            <Callout tooltip>
              <View style={styles.callout}>
                <Text style={styles.calloutName}>{tech.name}</Text>
                <Text style={styles.calloutSkills} numberOfLines={1}>
                  {(Array.isArray(tech.skills) ? tech.skills[0] : null) || 'Technician'}
                </Text>
                <View style={styles.calloutMeta}>
                  <Text style={styles.calloutDist}>{tech.distance?.toFixed(1) ?? '?'} km</Text>
                  {tech.verified === 1 && <Text style={styles.calloutVerified}> • Verified ✓</Text>}
                </View>
                {tech.phone && (
                  <Pressable style={styles.calloutBtn} onPress={() => handleCall(tech.phone)}>
                    <Text style={styles.calloutBtnTxt}>Call Now</Text>
                  </Pressable>
                )}
              </View>
            </Callout>
          </Marker>
        ))}
        {location && (
          <Circle
            center={{ latitude: location.coords.latitude, longitude: location.coords.longitude }}
            radius={5000}
            fillColor="rgba(255, 107, 44, 0.08)"
            strokeColor="rgba(255, 107, 44, 0.3)"
            strokeWidth={1}
          />
        )}
      </MapView>
      <View style={[styles.bottomSheet, { paddingBottom: Math.max(bottomInset, 20) }]}>
        <View style={styles.handle} />
        <Text style={styles.countTxt}>
          {availableTechs.length} {availableTechs.length === 1 ? 'technician' : 'technicians'} available near you
        </Text>
        <Text style={styles.subTxt}>Green = Available  •  Gray = Busy</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  map: { flex: 1 },
  callout: {
    backgroundColor: CARD, borderRadius: 12, padding: 12, width: 200,
    borderWidth: 1, borderColor: BORDER,
  },
  calloutName: { fontSize: 15, fontFamily: 'Inter_700Bold', color: FORE, marginBottom: 2 },
  calloutSkills: { fontSize: 12, fontFamily: 'Inter_400Regular', color: MUTED, marginBottom: 4 },
  calloutMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  calloutDist: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: PRIMARY },
  calloutVerified: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: SUCCESS },
  calloutBtn: { backgroundColor: PRIMARY, borderRadius: 8, paddingVertical: 6, alignItems: 'center' },
  calloutBtnTxt: { color: '#FFF', fontSize: 12, fontFamily: 'Inter_700Bold' },
  bottomSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: CARD, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, alignItems: 'center',
  },
  handle: { width: 40, height: 4, backgroundColor: BORDER, borderRadius: 2, marginBottom: 12 },
  countTxt: { fontSize: 16, fontFamily: 'Inter_700Bold', color: FORE, marginBottom: 4 },
  subTxt: { fontSize: 12, fontFamily: 'Inter_400Regular', color: MUTED },
});
