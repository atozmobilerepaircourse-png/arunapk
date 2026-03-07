import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const PRIMARY = '#FF6B2C';
const BG = '#F5F5F5';
const CARD = '#FFFFFF';
const BORDER = '#E8E8E8';
const FORE = '#1A1A1A';
const MUTED = '#888888';
const SUCCESS = '#34C759';

export type TechMapProps = {
  techs: any[];
  location: { coords: { latitude: number; longitude: number } } | null;
  loading: boolean;
  errorMsg: string | null;
  bottomInset: number;
};

function TechCard({ tech, onCall }: { tech: any; onCall: (phone: string) => void }) {
  const isAvailable = tech.availableForJobs === 'true';
  const skills: string[] = Array.isArray(tech.skills) ? tech.skills : [];
  return (
    <View style={styles.techCard}>
      <View style={styles.techCardTop}>
        <View style={[styles.avatar, { backgroundColor: isAvailable ? '#E8F9EE' : '#F5F5F5' }]}>
          <Ionicons name="person" size={22} color={isAvailable ? SUCCESS : MUTED} />
        </View>
        <View style={styles.techInfo}>
          <View style={styles.techNameRow}>
            <Text style={styles.techName}>{tech.name}</Text>
            {tech.verified === 1 && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={14} color={SUCCESS} />
                <Text style={styles.verifiedTxt}>Verified</Text>
              </View>
            )}
          </View>
          <Text style={styles.techSkills} numberOfLines={1}>
            {skills.slice(0, 2).join(', ') || 'Mobile Technician'}
          </Text>
          <View style={styles.techMeta}>
            <View style={[styles.statusDot, { backgroundColor: isAvailable ? SUCCESS : MUTED }]} />
            <Text style={[styles.statusTxt, { color: isAvailable ? SUCCESS : MUTED }]}>
              {isAvailable ? 'Available' : 'Busy'}
            </Text>
            {tech.distance != null && (
              <Text style={styles.distanceTxt}>  •  {tech.distance.toFixed(1)} km away</Text>
            )}
          </View>
        </View>
        {tech.phone && (
          <Pressable style={styles.callBtn} onPress={() => onCall(tech.phone)}>
            <Ionicons name="call" size={18} color="#FFF" />
          </Pressable>
        )}
      </View>
      {tech.city ? (
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={12} color={MUTED} />
          <Text style={styles.locationTxt}>{tech.city}{tech.state ? `, ${tech.state}` : ''}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function TechMap({ techs, location, loading, errorMsg, bottomInset }: TechMapProps) {
  const handleCall = (phone: string) => { if (phone) Linking.openURL(`tel:${phone}`); };
  const availableTechs = techs.filter(t => t.availableForJobs === 'true');

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.listContent, { paddingBottom: bottomInset + 20 }]}
    >
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{availableTechs.length}</Text>
          <Text style={styles.statLabel}>Available</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{techs.length}</Text>
          <Text style={styles.statLabel}>Total Nearby</Text>
        </View>
      </View>
      {errorMsg && (
        <View style={styles.errorBanner}>
          <Ionicons name="information-circle-outline" size={16} color={PRIMARY} />
          <Text style={styles.errorBannerTxt}>{errorMsg}</Text>
        </View>
      )}
      {!loading && techs.length === 0 && (
        <View style={styles.emptyBox}>
          <Ionicons name="people-outline" size={56} color={MUTED} />
          <Text style={styles.emptyTitle}>No technicians found</Text>
          <Text style={styles.emptyTxt}>Try expanding your search area</Text>
        </View>
      )}
      {techs.map(tech => (
        <TechCard key={tech.id} tech={tech} onCall={handleCall} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  listContent: { padding: 16, gap: 12 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  statCard: {
    flex: 1, backgroundColor: CARD, borderRadius: 14, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: BORDER,
  },
  statNum: { fontSize: 28, fontFamily: 'Inter_700Bold', color: PRIMARY },
  statLabel: { fontSize: 13, fontFamily: 'Inter_400Regular', color: MUTED, marginTop: 2 },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF1EC', borderRadius: 10, padding: 12, marginBottom: 4,
  },
  errorBannerTxt: { color: PRIMARY, fontSize: 13, fontFamily: 'Inter_400Regular', flex: 1 },
  emptyBox: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold', color: FORE },
  emptyTxt: { fontSize: 14, fontFamily: 'Inter_400Regular', color: MUTED },
  techCard: {
    backgroundColor: CARD, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: BORDER,
  },
  techCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  techInfo: { flex: 1 },
  techNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  techName: { fontSize: 15, fontFamily: 'Inter_700Bold', color: FORE },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  verifiedTxt: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: SUCCESS },
  techSkills: { fontSize: 13, fontFamily: 'Inter_400Regular', color: MUTED, marginBottom: 4 },
  techMeta: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
  statusTxt: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  distanceTxt: { fontSize: 12, fontFamily: 'Inter_400Regular', color: MUTED },
  callBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: PRIMARY,
    alignItems: 'center', justifyContent: 'center',
  },
  locationRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: BORDER,
  },
  locationTxt: { fontSize: 12, fontFamily: 'Inter_400Regular', color: MUTED },
  BG: { flex: 1, backgroundColor: BG },
});
