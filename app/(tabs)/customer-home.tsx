import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform, Animated, ScrollView, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import Colors from '@/constants/colors';
import { useApp } from '@/lib/context';

const C = Colors.light;

type ScanPhase = 'idle' | 'detecting' | 'scanning' | 'results';

const SCAN_CHECKS: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'screen', label: 'Screen', icon: 'phone-portrait-outline' },
  { key: 'battery', label: 'Battery', icon: 'battery-half-outline' },
  { key: 'camera', label: 'Camera', icon: 'camera-outline' },
  { key: 'microphone', label: 'Microphone', icon: 'mic-outline' },
  { key: 'network', label: 'Network', icon: 'wifi-outline' },
  { key: 'storage', label: 'Storage', icon: 'server-outline' },
  { key: 'sensors', label: 'Sensors', icon: 'pulse-outline' },
];

type DeviceInfo = { model: string; os: string; battery: number };

export default function CustomerHomeScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useApp();

  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [completedChecks, setCompletedChecks] = useState<string[]>([]);
  const [issueChecks, setIssueChecks] = useState<string[]>([]);
  const [healthScore, setHealthScore] = useState(0);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 84 + 34 : 100;

  useEffect(() => {
    if (phase !== 'idle') return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ])
    );
    anim.start();
    glow.start();
    return () => { anim.stop(); glow.stop(); };
  }, [phase]);

  const getDeviceInfo = async (): Promise<DeviceInfo> => {
    let model = 'Your Device';
    let os = Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'Web';
    let battery = 78;

    if (Platform.OS === 'web') {
      const ua = navigator.userAgent;
      if (ua.includes('iPhone')) model = 'iPhone';
      else if (ua.includes('iPad')) model = 'iPad';
      else if (ua.includes('Android')) {
        const match = ua.match(/;\s*([^)]+)\)/);
        model = match ? match[1].trim().split(';').pop()?.trim() || 'Android Device' : 'Android Device';
      } else {
        model = 'Computer';
      }
      os = ua.includes('iPhone') || ua.includes('iPad') ? 'iOS'
         : ua.includes('Android') ? 'Android' : 'Desktop';
      try {
        if ('getBattery' in navigator) {
          const bat = await (navigator as any).getBattery();
          battery = Math.round(bat.level * 100);
        }
      } catch {}
    } else {
      model = Platform.OS === 'ios' ? 'iPhone' : 'Android Phone';
    }

    return { model, os, battery };
  };

  const runScan = async () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    setPhase('detecting');
    setCompletedChecks([]);
    setIssueChecks([]);
    setDeviceInfo(null);

    const info = await getDeviceInfo();
    await new Promise(r => setTimeout(r, 1200));
    setDeviceInfo(info);

    setPhase('scanning');

    const issues: string[] = [];
    for (const check of SCAN_CHECKS) {
      await new Promise(r => setTimeout(r, 350 + Math.random() * 280));
      const hasIssue = check.key === 'battery' && info.battery < 50;
      if (hasIssue) issues.push(check.key);
      setCompletedChecks(prev => [...prev, check.key]);
      if (hasIssue) setIssueChecks(prev => [...prev, check.key]);
    }

    await new Promise(r => setTimeout(r, 400));

    const score = Math.max(62, 97 - issues.length * 12 - (info.battery < 30 ? 10 : info.battery < 50 ? 5 : 0));
    setHealthScore(score);
    setPhase('results');
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const reset = () => {
    setPhase('idle');
    setCompletedChecks([]);
    setIssueChecks([]);
    setDeviceInfo(null);
    setHealthScore(0);
  };

  const bookTechnician = () => {
    router.push({ pathname: '/(tabs)/directory', params: { filter: 'technician' } });
  };

  const scoreColor = healthScore >= 85 ? '#34C759' : healthScore >= 70 ? '#FF9F0A' : '#FF3B30';
  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.45] });

  if (phase === 'idle') {
    return (
      <View style={[st.container, { paddingTop: topInset }]}>
        <ScrollView
          contentContainerStyle={[st.idleContent, { paddingBottom: bottomPad }]}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
        >
          <View style={st.greetingSection}>
            <Text style={st.greeting}>Hi, {profile?.name?.split(' ')[0] || 'there'} 👋</Text>
            <Text style={st.greetingSub}>How's your phone doing today?</Text>
          </View>

          <View style={st.buttonArea}>
            <Animated.View style={[st.glowRing, { opacity: glowOpacity }]} />
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Pressable
                style={({ pressed }) => [st.mainButton, pressed && st.mainButtonPressed]}
                onPress={runScan}
                testID="smart-phone-check-btn"
              >
                <Ionicons name="shield-checkmark" size={52} color="#FFF" />
                <Text style={st.mainBtnTitle}>Smart Phone Check</Text>
                <Text style={st.mainBtnSub}>Tap to scan your device</Text>
              </Pressable>
            </Animated.View>
          </View>

          <View style={st.featureRow}>
            {[
              { icon: 'hardware-chip-outline' as keyof typeof Ionicons.glyphMap, label: 'Device\nDetection' },
              { icon: 'pulse-outline' as keyof typeof Ionicons.glyphMap, label: 'Full\nDiagnosis' },
              { icon: 'shield-outline' as keyof typeof Ionicons.glyphMap, label: 'Health\nScore' },
              { icon: 'construct-outline' as keyof typeof Ionicons.glyphMap, label: 'Repair\nSuggestion' },
            ].map((f, i) => (
              <View key={i} style={st.featureItem}>
                <View style={st.featureIcon}>
                  <Ionicons name={f.icon} size={20} color={C.primary} />
                </View>
                <Text style={st.featureLabel}>{f.label}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  if (phase === 'detecting') {
    return (
      <View style={[st.container, st.centered, { paddingTop: topInset }]}>
        <View style={st.detectingIcon}>
          <Ionicons name="phone-portrait" size={52} color={C.primary} />
        </View>
        <Text style={st.phaseTitle}>Detecting Device...</Text>
        <Text style={st.phaseSub}>Reading system information</Text>
        <ActivityIndicator style={{ marginTop: 28 }} size="large" color={C.primary} />
      </View>
    );
  }

  if (phase === 'scanning') {
    return (
      <View style={[st.container, { paddingTop: topInset + 20, paddingHorizontal: 20, paddingBottom: bottomPad }]}>
        <Text style={st.phaseTitle}>Running Device Check...</Text>

        {deviceInfo && (
          <View style={st.devicePill}>
            <Ionicons name="phone-portrait-outline" size={16} color={C.primary} />
            <Text style={st.devicePillText}>
              {deviceInfo.model} · {deviceInfo.os} · Battery {deviceInfo.battery}%
            </Text>
          </View>
        )}

        <View style={st.checksList}>
          {SCAN_CHECKS.map(check => {
            const done = completedChecks.includes(check.key);
            const issue = issueChecks.includes(check.key);
            return (
              <View key={check.key} style={st.checkRow}>
                <Ionicons
                  name={check.icon}
                  size={20}
                  color={done ? (issue ? '#FF9F0A' : C.textSecondary) : C.textTertiary}
                />
                <Text style={[st.checkLabel, done && { color: C.text }]}>{check.label}</Text>
                <View style={st.checkStatus}>
                  {done ? (
                    <Ionicons
                      name={issue ? 'warning' : 'checkmark-circle'}
                      size={22}
                      color={issue ? '#FF9F0A' : '#34C759'}
                    />
                  ) : (
                    <View style={st.checkPending} />
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={st.container}
      contentContainerStyle={[st.resultsContent, { paddingTop: topInset + 16, paddingBottom: bottomPad }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={st.phaseTitle}>Device Health Report</Text>

      {deviceInfo && (
        <View style={st.devicePill}>
          <Ionicons name="phone-portrait-outline" size={16} color={C.primary} />
          <Text style={st.devicePillText}>
            {deviceInfo.model} · Battery {deviceInfo.battery}%
          </Text>
        </View>
      )}

      <View style={[st.scoreCard, { borderColor: scoreColor + '50' }]}>
        <Text style={st.scoreLabel}>Health Score</Text>
        <Text style={[st.scoreValue, { color: scoreColor }]}>
          {healthScore}
          <Text style={st.scoreMax}>/100</Text>
        </Text>
        <View style={[st.scoreBar, { backgroundColor: scoreColor + '20' }]}>
          <View style={[st.scoreBarFill, { width: `${healthScore}%` as any, backgroundColor: scoreColor }]} />
        </View>
        <Text style={[st.scoreStatus, { color: scoreColor }]}>
          {healthScore >= 85 ? 'Excellent Condition' : healthScore >= 70 ? 'Good — Minor Issues' : 'Needs Attention'}
        </Text>
      </View>

      <View style={st.checksGrid}>
        {SCAN_CHECKS.map(check => {
          const issue = issueChecks.includes(check.key);
          return (
            <View key={check.key} style={[st.checkChip, issue && st.checkChipIssue]}>
              <Ionicons
                name={issue ? 'warning' : 'checkmark-circle'}
                size={13}
                color={issue ? '#FF9F0A' : '#34C759'}
              />
              <Text style={[st.checkChipText, issue && { color: '#FF9F0A' }]}>{check.label}</Text>
            </View>
          );
        })}
      </View>

      {issueChecks.length > 0 ? (
        <View style={st.issueCard}>
          <Text style={st.issueCardTitle}>Issues Detected</Text>
          {issueChecks.includes('battery') && (
            <View style={st.issueRow}>
              <View style={st.issueIconWrap}>
                <Ionicons name="battery-half" size={20} color="#FF9F0A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.issueName}>Battery Health Low</Text>
                <Text style={st.issueDetail}>Recommended: Battery Replacement</Text>
                <Text style={st.issueCost}>Est. Cost ₹900 · With care plan ₹400</Text>
              </View>
            </View>
          )}
          <Pressable style={({ pressed }) => [st.bookBtn, pressed && { opacity: 0.85 }]} onPress={bookTechnician}>
            <Ionicons name="construct-outline" size={18} color="#FFF" />
            <Text style={st.bookBtnText}>Book a Technician</Text>
          </Pressable>
        </View>
      ) : (
        <View style={st.allGoodCard}>
          <Ionicons name="checkmark-circle" size={40} color="#34C759" />
          <Text style={st.allGoodTitle}>Your phone is in great shape!</Text>
          <Text style={st.allGoodSub}>No issues detected. Keep it well maintained.</Text>
        </View>
      )}

      <Pressable
        style={({ pressed }) => [st.findTechBtn, pressed && { opacity: 0.85 }]}
        onPress={bookTechnician}
      >
        <Ionicons name="people-outline" size={18} color={C.primary} />
        <Text style={st.findTechText}>Find Technicians Near You</Text>
      </Pressable>

      <Pressable style={st.scanAgainBtn} onPress={reset}>
        <Text style={st.scanAgainText}>Scan Again</Text>
      </Pressable>
    </ScrollView>
  );
}

const BUTTON_SIZE = 200;

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  centered: { justifyContent: 'center', alignItems: 'center' },

  idleContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
  },

  greetingSection: { alignItems: 'center', marginBottom: 36 },
  greeting: { fontSize: 28, fontFamily: 'Inter_700Bold', color: C.text, textAlign: 'center' },
  greetingSub: { fontSize: 15, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 6, textAlign: 'center' },

  buttonArea: { alignItems: 'center', justifyContent: 'center', marginBottom: 40, position: 'relative' },
  glowRing: {
    position: 'absolute',
    width: BUTTON_SIZE + 48,
    height: BUTTON_SIZE + 48,
    borderRadius: (BUTTON_SIZE + 48) / 2,
    backgroundColor: C.primary,
  },
  mainButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  mainButtonPressed: { opacity: 0.9, transform: [{ scale: 0.96 }] },
  mainBtnTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: '#FFF', marginTop: 10, textAlign: 'center' },
  mainBtnSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.8)', marginTop: 4, textAlign: 'center' },

  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 8,
  },
  featureItem: { flex: 1, alignItems: 'center', gap: 6 },
  featureIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: C.primary + '12',
    alignItems: 'center', justifyContent: 'center',
  },
  featureLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: C.textSecondary, textAlign: 'center', lineHeight: 15 },

  detectingIcon: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: C.primary + '15',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  phaseTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', color: C.text, textAlign: 'center', marginBottom: 6 },
  phaseSub: { fontSize: 14, fontFamily: 'Inter_400Regular', color: C.textSecondary, textAlign: 'center' },

  devicePill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.primary + '12',
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, alignSelf: 'center',
    marginTop: 12, marginBottom: 20,
  },
  devicePillText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.primary },

  checksList: { gap: 6, marginTop: 4 },
  checkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.surface, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: C.border,
  },
  checkLabel: { flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium', color: C.textSecondary },
  checkStatus: { width: 22, alignItems: 'center' },
  checkPending: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: C.border },

  resultsContent: { paddingHorizontal: 20 },

  scoreCard: {
    backgroundColor: C.surface, borderRadius: 16, padding: 20,
    borderWidth: 1.5, alignItems: 'center', marginTop: 16, marginBottom: 16,
  },
  scoreLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  scoreValue: { fontSize: 56, fontFamily: 'Inter_700Bold', lineHeight: 60 },
  scoreMax: { fontSize: 22, fontFamily: 'Inter_400Regular', color: C.textTertiary },
  scoreBar: { width: '100%', height: 6, borderRadius: 3, marginTop: 12, marginBottom: 10, overflow: 'hidden' },
  scoreBarFill: { height: '100%', borderRadius: 3 },
  scoreStatus: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },

  checksGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  checkChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#34C75912', paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8,
  },
  checkChipIssue: { backgroundColor: '#FF9F0A12' },
  checkChipText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: '#34C759' },

  issueCard: {
    backgroundColor: '#FF9F0A0D', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#FF9F0A30', marginBottom: 14,
  },
  issueCardTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', color: C.text, marginBottom: 12 },
  issueRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  issueIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FF9F0A18', alignItems: 'center', justifyContent: 'center' },
  issueName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text, marginBottom: 2 },
  issueDetail: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary },
  issueCost: { fontSize: 12, fontFamily: 'Inter_500Medium', color: '#FF9F0A', marginTop: 2 },
  bookBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: C.primary, borderRadius: 12,
    paddingVertical: 13, marginTop: 4,
  },
  bookBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#FFF' },

  allGoodCard: {
    backgroundColor: '#34C75910', borderRadius: 14, padding: 20,
    alignItems: 'center', borderWidth: 1, borderColor: '#34C75930', marginBottom: 14,
  },
  allGoodTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: C.text, marginTop: 10, textAlign: 'center' },
  allGoodSub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 6, textAlign: 'center' },

  findTechBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: C.primary + '15',
    borderRadius: 12, paddingVertical: 13, marginBottom: 10,
    borderWidth: 1, borderColor: C.primary + '30',
  },
  findTechText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.primary },

  scanAgainBtn: { alignItems: 'center', paddingVertical: 12 },
  scanAgainText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: C.textSecondary },
});
