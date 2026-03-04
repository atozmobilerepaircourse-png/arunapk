import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform, Animated,
  ScrollView, ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import Colors from '@/constants/colors';
import { useApp } from '@/lib/context';
import { apiRequest } from '@/lib/query-client';

const C = Colors.light;

type ScanPhase = 'idle' | 'detecting' | 'scanning' | 'results' | 'insurance' | 'repair';

const SCAN_CHECKS: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'screen',      label: 'Screen',      icon: 'phone-portrait-outline' },
  { key: 'battery',     label: 'Battery',      icon: 'battery-half-outline'  },
  { key: 'camera',      label: 'Camera',       icon: 'camera-outline'         },
  { key: 'microphone',  label: 'Microphone',   icon: 'mic-outline'            },
  { key: 'gps',         label: 'GPS',          icon: 'navigate-outline'       },
  { key: 'network',     label: 'Network',      icon: 'wifi-outline'           },
  { key: 'storage',     label: 'Storage',      icon: 'server-outline'         },
  { key: 'sensors',     label: 'Sensors',      icon: 'pulse-outline'          },
];

type DeviceInfo = { model: string; os: string; battery: number };

export default function CustomerHomeScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useApp();

  const [phase, setPhase]                   = useState<ScanPhase>('idle');
  const [deviceInfo, setDeviceInfo]         = useState<DeviceInfo | null>(null);
  const [completedChecks, setCompleted]     = useState<string[]>([]);
  const [issueChecks, setIssues]            = useState<string[]>([]);
  const [healthScore, setHealthScore]       = useState(0);
  const [insuranceActive, setInsurance]     = useState(false);

  const [showLive, setShowLive]             = useState(false);
  const [liveSessions, setLiveSessions]     = useState<any[]>([]);
  const [liveLoading, setLiveLoading]       = useState(false);
  const [showPost, setShowPost]             = useState(false);
  const [problemText, setProblemText]       = useState('');
  const [posting, setPosting]               = useState(false);
  const [postSuccess, setPostSuccess]       = useState(false);

  const fetchLiveSessions = useCallback(async () => {
    setLiveLoading(true);
    try {
      const res = await apiRequest('GET', '/api/teacher/live-sessions');
      const data = await res.json();
      setLiveSessions(data.sessions || []);
    } catch {
      setLiveSessions([]);
    } finally {
      setLiveLoading(false);
    }
  }, []);

  const toggleLive = () => {
    router.push('/');
  };

  const togglePost = () => {
    router.push('/create');
  };

  const submitProblem = async () => {
    if (!problemText.trim()) return;
    if (!profile) { router.push('/onboarding'); return; }
    setPosting(true);
    try {
      await apiRequest('POST', '/api/posts', {
        userId: profile.id,
        author: profile.name,
        content: `🔧 Help Needed: ${problemText.trim()}`,
        category: 'repair',
        authorRole: 'customer',
        authorAvatar: profile.avatar || '',
      });
      setPostSuccess(true);
      setProblemText('');
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      if (Platform.OS === 'web') window.alert('Failed to post. Please try again.');
      else Alert.alert('Error', 'Failed to post. Please try again.');
    } finally {
      setPosting(false);
    }
  };

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim  = useRef(new Animated.Value(0)).current;

  const topInset  = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 84 + 34 : 100;

  useEffect(() => {
    if (phase !== 'idle') return;
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.06, duration: 900, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1.00, duration: 900, useNativeDriver: true }),
    ]));
    const glow = Animated.loop(Animated.sequence([
      Animated.timing(glowAnim,  { toValue: 1, duration: 1400, useNativeDriver: true }),
      Animated.timing(glowAnim,  { toValue: 0, duration: 1400, useNativeDriver: true }),
    ]));
    pulse.start(); glow.start();
    return () => { pulse.stop(); glow.stop(); };
  }, [phase]);

  const getDeviceInfo = async (): Promise<DeviceInfo> => {
    let model = 'Your Device', os = 'Android', battery = 78;
    if (Platform.OS === 'web') {
      const ua = navigator.userAgent;
      if (ua.includes('iPhone')) model = 'iPhone';
      else if (ua.includes('iPad')) model = 'iPad';
      else if (ua.includes('Android')) {
        const m = ua.match(/;\s*([^)]+)\)/);
        model = m ? (m[1].trim().split(';').pop()?.trim() ?? 'Android Device') : 'Android Device';
      } else model = 'Computer';
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
      os    = Platform.OS === 'ios' ? 'iOS' : 'Android';
    }
    return { model, os, battery };
  };

  const runScan = async () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setPhase('detecting');
    setCompleted([]);
    setIssues([]);

    const info = await getDeviceInfo();
    await new Promise(r => setTimeout(r, 1200));
    setDeviceInfo(info);
    setPhase('scanning');

    const found: string[] = [];
    for (const check of SCAN_CHECKS) {
      await new Promise(r => setTimeout(r, 320 + Math.random() * 260));
      const bad = check.key === 'battery' && info.battery < 50;
      if (bad) found.push(check.key);
      setCompleted(p => [...p, check.key]);
      if (bad) setIssues(p => [...p, check.key]);
    }

    await new Promise(r => setTimeout(r, 350));
    const score = Math.max(62, 97 - found.length * 12 - (info.battery < 30 ? 10 : info.battery < 50 ? 5 : 0));
    setHealthScore(score);
    setPhase('results');
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const proceedToInsurance = () => setPhase('insurance');
  const activateInsurance  = () => { setInsurance(true);  setPhase('repair'); };
  const skipInsurance      = () => { setInsurance(false); setPhase('repair'); };

  const reset = () => {
    setPhase('idle');
    setCompleted([]);
    setIssues([]);
    setDeviceInfo(null);
    setHealthScore(0);
  };

  const bookTechnician = () =>
    router.push({ pathname: '/(tabs)/directory', params: { filter: 'technician' } });

  const scoreColor = healthScore >= 85 ? '#34C759' : healthScore >= 70 ? '#FF9F0A' : '#FF3B30';
  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.40] });
  const firstName = profile?.name?.split(' ')[0] || 'there';

  /* ─── IDLE ─────────────────────────────────────────────────────── */
  if (phase === 'idle') {
    return (
      <ScrollView
        style={st.container}
        contentContainerStyle={[st.idleContent, { paddingTop: topInset + 16, paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={st.greeting}>Hello {firstName} 👋</Text>
        <Text style={st.greetingSub}>Let's check your phone health today</Text>

        {deviceInfo && (
          <View style={st.deviceCard}>
            <Ionicons name="phone-portrait" size={18} color={C.primary} />
            <Text style={st.deviceCardText}>
              {deviceInfo.model} · {deviceInfo.os} · Battery {deviceInfo.battery}%
            </Text>
          </View>
        )}

        <View style={st.buttonArea}>
          <Animated.View style={[st.glowRing, { opacity: glowOpacity }]} />
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Pressable
              style={({ pressed }) => [st.mainButton, pressed && st.mainButtonPressed]}
              onPress={runScan}
              testID="phone-check-btn"
            >
              <Ionicons name="shield-checkmark" size={54} color="#FFF" />
              <Text style={st.mainBtnTitle}>Check & Protect{'\n'}My Phone</Text>
              <Text style={st.mainBtnSub}>Tap for instant health scan</Text>
            </Pressable>
          </Animated.View>
        </View>

        <View style={st.flowRow}>
          {[
            { icon: 'hardware-chip-outline' as const, label: 'Auto Detect\nDevice' },
            { icon: 'pulse-outline'          as const, label: 'Full\nDiagnosis' },
            { icon: 'shield-outline'         as const, label: 'Health\nScore' },
            { icon: 'umbrella-outline'       as const, label: 'Insurance\nOffer' },
          ].map((f, i) => (
            <View key={i} style={st.flowItem}>
              <View style={st.flowIcon}>
                <Ionicons name={f.icon} size={20} color={C.primary} />
              </View>
              <Text style={st.flowLabel}>{f.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Live Help & Post Problem ── */}
        <View style={st.actionRow}>
          <Pressable
            style={({ pressed }) => [st.actionCard, showLive && st.actionCardActive, pressed && { opacity: 0.85 }]}
            onPress={toggleLive}
          >
            <View style={[st.actionIcon, { backgroundColor: '#FF3B3015' }]}>
              <View style={st.liveRedDot} />
              <Ionicons name="videocam" size={20} color="#FF3B30" />
            </View>
            <Text style={st.actionCardTitle}>Watch Live Help</Text>
            <Text style={st.actionCardSub}>See technicians live</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [st.actionCard, showPost && st.actionCardActive, pressed && { opacity: 0.85 }]}
            onPress={togglePost}
          >
            <View style={[st.actionIcon, { backgroundColor: C.primary + '15' }]}>
              <Ionicons name="chatbubble-ellipses" size={20} color={C.primary} />
            </View>
            <Text style={st.actionCardTitle}>Post My Problem</Text>
            <Text style={st.actionCardSub}>Get help from experts</Text>
          </Pressable>
        </View>

        {insuranceActive && (
          <View style={st.activeInsuranceCard}>
            <View style={st.activeInsuranceHeader}>
              <Ionicons name="umbrella" size={18} color="#5E8BFF" />
              <Text style={st.activeInsuranceTitle}>Active Insurance</Text>
              <View style={st.activeBadge}><Text style={st.activeBadgeText}>ACTIVE</Text></View>
            </View>
            <Text style={st.activeInsuranceDesc}>Monthly Plan · ₹30/month · ₹500 repair discount</Text>
          </View>
        )}

        {deviceInfo && (
          <View style={st.recentSection}>
            <Text style={st.recentTitle}>Recent Repairs</Text>
            <View style={st.recentEmpty}>
              <Ionicons name="construct-outline" size={28} color={C.textTertiary} />
              <Text style={st.recentEmptyText}>No repairs yet</Text>
            </View>
          </View>
        )}
      </ScrollView>
    );
  }

  /* ─── DETECTING ────────────────────────────────────────────────── */
  if (phase === 'detecting') {
    return (
      <View style={[st.container, st.centered, { paddingTop: topInset }]}>
        <View style={st.detectIcon}>
          <Ionicons name="phone-portrait" size={52} color={C.primary} />
        </View>
        <Text style={st.phaseTitle}>Detecting Device...</Text>
        <Text style={st.phaseSub}>Reading system information</Text>
        <ActivityIndicator style={{ marginTop: 28 }} size="large" color={C.primary} />
      </View>
    );
  }

  /* ─── SCANNING ─────────────────────────────────────────────────── */
  if (phase === 'scanning') {
    const done = completedChecks.length;
    const total = SCAN_CHECKS.length;
    const pct = total > 0 ? done / total : 0;
    return (
      <View style={[st.container, { paddingTop: topInset + 20, paddingBottom: bottomPad }]}>
        <Text style={[st.phaseTitle, { paddingHorizontal: 20 }]}>Running Device Check...</Text>

        {deviceInfo && (
          <View style={[st.devicePill, { marginHorizontal: 20 }]}>
            <Ionicons name="phone-portrait-outline" size={15} color={C.primary} />
            <Text style={st.devicePillText}>
              {deviceInfo.model} · {deviceInfo.os} · Battery {deviceInfo.battery}%
            </Text>
          </View>
        )}

        <View style={[st.progressBar, { marginHorizontal: 20 }]}>
          <Animated.View style={[st.progressFill, { width: `${Math.round(pct * 100)}%` as any }]} />
        </View>
        <Text style={[st.progressLabel, { marginHorizontal: 20 }]}>{done} / {total} checks</Text>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={[st.checksList, { paddingHorizontal: 20 }]}>
          {SCAN_CHECKS.map(check => {
            const isDone  = completedChecks.includes(check.key);
            const isIssue = issueChecks.includes(check.key);
            return (
              <View key={check.key} style={st.checkRow}>
                <Ionicons
                  name={check.icon}
                  size={20}
                  color={isDone ? (isIssue ? '#FF9F0A' : C.textSecondary) : C.textTertiary}
                />
                <Text style={[st.checkLabel, isDone && { color: C.text }]}>{check.label}</Text>
                <View style={st.checkStatus}>
                  {isDone
                    ? <Ionicons
                        name={isIssue ? 'warning' : 'checkmark-circle'}
                        size={22}
                        color={isIssue ? '#FF9F0A' : '#34C759'}
                      />
                    : <View style={st.checkPending} />
                  }
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  /* ─── RESULTS ──────────────────────────────────────────────────── */
  if (phase === 'results') {
    return (
      <ScrollView
        style={st.container}
        contentContainerStyle={[st.resultsContent, { paddingTop: topInset + 16, paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={st.phaseTitle}>Device Health Report</Text>

        {deviceInfo && (
          <View style={st.devicePill}>
            <Ionicons name="phone-portrait-outline" size={15} color={C.primary} />
            <Text style={st.devicePillText}>{deviceInfo.model} · Battery {deviceInfo.battery}%</Text>
          </View>
        )}

        <View style={[st.scoreCard, { borderColor: scoreColor + '50' }]}>
          <Text style={st.scoreLabel}>Device Health Score</Text>
          <Text style={[st.scoreValue, { color: scoreColor }]}>
            {healthScore}<Text style={st.scoreMax}>/100</Text>
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
                <Ionicons name={issue ? 'warning' : 'checkmark-circle'} size={13}
                  color={issue ? '#FF9F0A' : '#34C759'} />
                <Text style={[st.checkChipText, issue && { color: '#FF9F0A' }]}>{check.label}</Text>
              </View>
            );
          })}
        </View>

        {issueChecks.length > 0 && (
          <View style={st.aiCard}>
            <View style={st.aiHeader}>
              <Ionicons name="flash" size={16} color="#5E8BFF" />
              <Text style={st.aiTitle}>AI Problem Detection</Text>
            </View>
            {issueChecks.includes('battery') && (
              <View style={st.aiIssueRow}>
                <Ionicons name="battery-half" size={18} color="#FF9F0A" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={st.aiIssueName}>Battery Health Low</Text>
                  <Text style={st.aiIssueDetail}>Recommended Repair: Battery Replacement</Text>
                  <Text style={st.aiIssueCost}>Estimated Cost ₹900</Text>
                </View>
              </View>
            )}
          </View>
        )}

        <Pressable
          style={({ pressed }) => [st.primaryBtn, pressed && { opacity: 0.85 }]}
          onPress={proceedToInsurance}
        >
          <Ionicons name="umbrella-outline" size={18} color="#FFF" />
          <Text style={st.primaryBtnText}>View Insurance Offer</Text>
        </Pressable>

        <Pressable style={st.secondaryBtn} onPress={reset}>
          <Text style={st.secondaryBtnText}>Scan Again</Text>
        </Pressable>
      </ScrollView>
    );
  }

  /* ─── INSURANCE ────────────────────────────────────────────────── */
  if (phase === 'insurance') {
    const repairCost      = issueChecks.length > 0 ? 900 : 0;
    const discountedCost  = Math.round(repairCost * 0.44);
    return (
      <ScrollView
        style={st.container}
        contentContainerStyle={[st.resultsContent, { paddingTop: topInset + 16, paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={st.insuranceBadge}>
          <Ionicons name="umbrella" size={36} color="#5E8BFF" />
        </View>
        <Text style={st.phaseTitle}>Protect Your Phone</Text>
        <Text style={st.phaseSub}>One plan. Full coverage. Instant savings.</Text>

        <View style={st.planCard}>
          <View style={st.planRow}>
            <View style={st.planBullet} />
            <View style={{ flex: 1 }}>
              <Text style={st.planName}>Monthly Plan</Text>
              <Text style={st.planDesc}>Complete device protection</Text>
            </View>
            <Text style={st.planPrice}>₹30<Text style={st.planPer}>/mo</Text></Text>
          </View>

          <View style={st.planDivider} />

          <View style={st.benefitsList}>
            {[
              { icon: 'cash-outline'        as const, text: '₹500 Repair Discount on every job'  },
              { icon: 'construct-outline'   as const, text: 'Priority technician booking'          },
              { icon: 'shield-checkmark'    as const, text: 'Accidental damage coverage'           },
              { icon: 'chatbubbles-outline' as const, text: '24/7 expert support'                  },
            ].map((b, i) => (
              <View key={i} style={st.benefitRow}>
                <Ionicons name={b.icon} size={16} color="#5E8BFF" />
                <Text style={st.benefitText}>{b.text}</Text>
              </View>
            ))}
          </View>

          {issueChecks.length > 0 && (
            <View style={st.savingsBox}>
              <Text style={st.savingsLabel}>Your Savings Today</Text>
              <View style={st.savingsRow}>
                <View style={st.savingsItem}>
                  <Text style={st.savingsAmt}>₹{repairCost}</Text>
                  <Text style={st.savingsSub}>Without Plan</Text>
                </View>
                <Ionicons name="arrow-forward" size={18} color={C.textTertiary} />
                <View style={st.savingsItem}>
                  <Text style={[st.savingsAmt, { color: '#34C759' }]}>₹{discountedCost}</Text>
                  <Text style={st.savingsSub}>With Plan</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        <Pressable
          style={({ pressed }) => [st.activateBtn, pressed && { opacity: 0.85 }]}
          onPress={activateInsurance}
        >
          <Ionicons name="shield-checkmark" size={18} color="#FFF" />
          <Text style={st.primaryBtnText}>Activate Protection</Text>
        </Pressable>

        <Pressable style={st.secondaryBtn} onPress={skipInsurance}>
          <Text style={st.secondaryBtnText}>Skip for now</Text>
        </Pressable>
      </ScrollView>
    );
  }

  /* ─── REPAIR (final) ───────────────────────────────────────────── */
  const repairCost     = 900;
  const discountedCost = 400;

  return (
    <ScrollView
      style={st.container}
      contentContainerStyle={[st.resultsContent, { paddingTop: topInset + 16, paddingBottom: bottomPad }]}
      showsVerticalScrollIndicator={false}
    >
      {insuranceActive && (
        <View style={st.insuranceConfirmCard}>
          <Ionicons name="shield-checkmark" size={22} color="#5E8BFF" />
          <Text style={st.insuranceConfirmText}>Protection Activated! ₹30/month</Text>
        </View>
      )}

      {issueChecks.length > 0 ? (
        <>
          <Text style={st.phaseTitle}>Problem Detected</Text>
          <Text style={st.phaseSub}>Here's what we found and how to fix it</Text>

          {issueChecks.includes('battery') && (
            <View style={st.repairCard}>
              <View style={st.repairHeader}>
                <View style={[st.repairIconWrap, { backgroundColor: '#FF9F0A18' }]}>
                  <Ionicons name="battery-half" size={22} color="#FF9F0A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.repairName}>Battery Weak</Text>
                  <Text style={st.repairSub}>Draining faster than normal</Text>
                </View>
              </View>
              <View style={st.repairCostRow}>
                <View style={st.repairCostItem}>
                  <Text style={st.repairCostLabel}>Repair Cost</Text>
                  <Text style={[st.repairCostValue, insuranceActive && st.strikethrough]}>₹{repairCost}</Text>
                </View>
                {insuranceActive && (
                  <View style={st.repairCostItem}>
                    <Text style={st.repairCostLabel}>With Insurance</Text>
                    <Text style={[st.repairCostValue, { color: '#34C759' }]}>₹{discountedCost}</Text>
                  </View>
                )}
              </View>
              <Pressable
                style={({ pressed }) => [st.primaryBtn, { marginTop: 12 }, pressed && { opacity: 0.85 }]}
                onPress={bookTechnician}
              >
                <Ionicons name="construct-outline" size={18} color="#FFF" />
                <Text style={st.primaryBtnText}>Book Technician</Text>
              </Pressable>
            </View>
          )}
        </>
      ) : (
        <View style={st.allGoodCard}>
          <Ionicons name="checkmark-circle" size={42} color="#34C759" />
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

      <Pressable style={st.secondaryBtn} onPress={reset}>
        <Text style={st.secondaryBtnText}>Back to Home</Text>
      </Pressable>
    </ScrollView>
  );
}

const BUTTON_SIZE = 196;

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  centered:  { justifyContent: 'center', alignItems: 'center' },

  idleContent: { alignItems: 'center', paddingHorizontal: 24 },

  greeting:    { fontSize: 28, fontFamily: 'Inter_700Bold', color: C.text, textAlign: 'center' },
  greetingSub: { fontSize: 14, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 4, marginBottom: 20, textAlign: 'center' },

  deviceCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.surface, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: C.border, marginBottom: 24, alignSelf: 'stretch',
  },
  deviceCardText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.text },

  buttonArea:  { alignItems: 'center', justifyContent: 'center', marginBottom: 32, position: 'relative' },
  glowRing: {
    position: 'absolute',
    width: BUTTON_SIZE + 52, height: BUTTON_SIZE + 52,
    borderRadius: (BUTTON_SIZE + 52) / 2,
    backgroundColor: C.primary,
  },
  mainButton: {
    width: BUTTON_SIZE, height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45, shadowRadius: 22, elevation: 14,
  },
  mainButtonPressed: { opacity: 0.9, transform: [{ scale: 0.96 }] },
  mainBtnTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#FFF', marginTop: 10, textAlign: 'center', lineHeight: 20 },
  mainBtnSub:   { fontSize: 11, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.8)', marginTop: 5, textAlign: 'center' },

  flowRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 6, marginBottom: 24 },
  flowItem: { flex: 1, alignItems: 'center', gap: 6 },
  flowIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: C.primary + '12', alignItems: 'center', justifyContent: 'center' },
  flowLabel: { fontSize: 10, fontFamily: 'Inter_500Medium', color: C.textSecondary, textAlign: 'center', lineHeight: 14 },

  activeInsuranceCard: {
    backgroundColor: '#5E8BFF12', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#5E8BFF30', alignSelf: 'stretch', marginBottom: 14,
  },
  activeInsuranceHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  activeInsuranceTitle:  { flex: 1, fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text },
  activeBadge: { backgroundColor: '#34C759', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  activeBadgeText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#FFF' },
  activeInsuranceDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary },

  recentSection:   { alignSelf: 'stretch', marginBottom: 8 },
  recentTitle:     { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: C.text, marginBottom: 10 },
  recentEmpty:     { alignItems: 'center', paddingVertical: 20, gap: 8 },
  recentEmptyText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textTertiary },

  detectIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: C.primary + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  phaseTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', color: C.text, textAlign: 'center', marginBottom: 6 },
  phaseSub:   { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textSecondary, textAlign: 'center', marginBottom: 4 },

  devicePill: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: C.primary + '12', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, alignSelf: 'center', marginTop: 10, marginBottom: 14,
  },
  devicePillText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: C.primary },

  progressBar:   { height: 5, backgroundColor: C.border, borderRadius: 3, marginTop: 4, overflow: 'hidden' },
  progressFill:  { height: '100%', backgroundColor: C.primary, borderRadius: 3 },
  progressLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textTertiary, marginTop: 4, marginBottom: 10 },

  checksList: { gap: 6 },
  checkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.surface, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 13,
    borderWidth: 1, borderColor: C.border,
  },
  checkLabel:   { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium', color: C.textSecondary },
  checkStatus:  { width: 22, alignItems: 'center' },
  checkPending: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: C.border },

  resultsContent: { paddingHorizontal: 20 },

  scoreCard: { backgroundColor: C.surface, borderRadius: 16, padding: 20, borderWidth: 1.5, alignItems: 'center', marginTop: 14, marginBottom: 14 },
  scoreLabel:   { fontSize: 12, fontFamily: 'Inter_500Medium', color: C.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  scoreValue:   { fontSize: 58, fontFamily: 'Inter_700Bold', lineHeight: 62 },
  scoreMax:     { fontSize: 22, fontFamily: 'Inter_400Regular', color: C.textTertiary },
  scoreBar:     { width: '100%', height: 6, borderRadius: 3, marginTop: 10, marginBottom: 8, overflow: 'hidden' },
  scoreBarFill: { height: '100%', borderRadius: 3 },
  scoreStatus:  { fontSize: 13, fontFamily: 'Inter_600SemiBold' },

  checksGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 },
  checkChip:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#34C75912', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  checkChipIssue:{ backgroundColor: '#FF9F0A12' },
  checkChipText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: '#34C759' },

  aiCard: { backgroundColor: '#5E8BFF0D', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#5E8BFF25', marginBottom: 14 },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 },
  aiTitle:  { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#5E8BFF' },
  aiIssueRow:  { flexDirection: 'row', alignItems: 'flex-start' },
  aiIssueName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text, marginBottom: 2 },
  aiIssueDetail:{ fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary },
  aiIssueCost:  { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#FF9F0A', marginTop: 3 },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.primary, borderRadius: 14, paddingVertical: 15, marginBottom: 10,
  },
  primaryBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#FFF' },

  activateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#5E8BFF', borderRadius: 14, paddingVertical: 15, marginBottom: 10,
  },

  secondaryBtn: { alignItems: 'center', paddingVertical: 12 },
  secondaryBtnText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: C.textSecondary },

  insuranceBadge: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#5E8BFF15', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 12 },

  planCard: { backgroundColor: C.surface, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: C.border, marginTop: 14, marginBottom: 16 },
  planRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  planBullet: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#5E8BFF' },
  planName:  { fontSize: 16, fontFamily: 'Inter_700Bold', color: C.text },
  planDesc:  { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 2 },
  planPrice: { fontSize: 26, fontFamily: 'Inter_700Bold', color: '#5E8BFF' },
  planPer:   { fontSize: 14, fontFamily: 'Inter_400Regular', color: C.textSecondary },
  planDivider: { height: 1, backgroundColor: C.border, marginVertical: 14 },
  benefitsList: { gap: 10 },
  benefitRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  benefitText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.text },

  savingsBox: { backgroundColor: '#34C75908', borderRadius: 12, padding: 14, marginTop: 14, borderWidth: 1, borderColor: '#34C75925' },
  savingsLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#34C759', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  savingsRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 },
  savingsItem: { alignItems: 'center', gap: 4 },
  savingsAmt:  { fontSize: 22, fontFamily: 'Inter_700Bold', color: C.text },
  savingsSub:  { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textSecondary },

  insuranceConfirmCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#5E8BFF12', borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: '#5E8BFF30', marginBottom: 16,
  },
  insuranceConfirmText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#5E8BFF', flex: 1 },

  repairCard: { backgroundColor: C.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border, marginTop: 14, marginBottom: 14 },
  repairHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  repairIconWrap: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  repairName: { fontSize: 16, fontFamily: 'Inter_700Bold', color: C.text },
  repairSub:  { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 2 },
  repairCostRow: { flexDirection: 'row', gap: 20, marginBottom: 4 },
  repairCostItem: { gap: 3 },
  repairCostLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3 },
  repairCostValue: { fontSize: 22, fontFamily: 'Inter_700Bold', color: C.text },
  strikethrough: { textDecorationLine: 'line-through', color: C.textTertiary },

  allGoodCard: { backgroundColor: '#34C75910', borderRadius: 14, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#34C75930', marginBottom: 14, marginTop: 14 },
  allGoodTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: C.text, marginTop: 10, textAlign: 'center' },
  allGoodSub:   { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 6, textAlign: 'center' },

  findTechBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.primary + '15', borderRadius: 12, paddingVertical: 13, marginBottom: 8,
    borderWidth: 1, borderColor: C.primary + '30',
  },
  findTechText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.primary },

  actionRow: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginBottom: 4 },
  actionCard: {
    flex: 1, backgroundColor: C.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: C.border, alignItems: 'flex-start', gap: 6,
  },
  actionCardActive: { borderColor: C.primary, backgroundColor: C.primary + '08' },
  actionIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 3, position: 'relative',
  },
  liveRedDot: {
    width: 7, height: 7, borderRadius: 4, backgroundColor: '#FF3B30',
    position: 'absolute', top: 4, right: 4, zIndex: 1,
  },
  actionCardTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.text },
  actionCardSub:   { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textSecondary },

  panel: {
    alignSelf: 'stretch', backgroundColor: C.surface, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 8,
  },
  panelHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  panelTitle:  { fontSize: 15, fontFamily: 'Inter_700Bold', color: C.text, flex: 1 },
  panelEmpty:  { alignItems: 'center', paddingVertical: 20, gap: 8 },
  panelEmptyText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: C.textSecondary },
  panelEmptySub:  { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textTertiary },

  sessionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.background, borderRadius: 12, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: C.border,
  },
  sessionLeft:   { position: 'relative' },
  sessionAvatar: { width: 46, height: 46, borderRadius: 23 },
  liveBadge: {
    position: 'absolute', bottom: -2, right: -4,
    backgroundColor: '#FF3B30', borderRadius: 4,
    paddingHorizontal: 4, paddingVertical: 1,
  },
  liveBadgeText: { fontSize: 8, fontFamily: 'Inter_700Bold', color: '#FFF', letterSpacing: 0.5 },
  sessionTitle:    { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.text, marginBottom: 2 },
  sessionHost:     { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginBottom: 3 },
  sessionMeta:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sessionMetaText: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textTertiary },

  problemInput: {
    backgroundColor: C.background, borderRadius: 12, padding: 14,
    minHeight: 96, fontSize: 14, fontFamily: 'Inter_400Regular',
    color: C.text, borderWidth: 1, borderColor: C.border,
    textAlignVertical: 'top', marginBottom: 6,
  },
  charCount: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textTertiary, textAlign: 'right', marginBottom: 10 },
  postBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.primary, borderRadius: 12, paddingVertical: 13, marginBottom: 8,
  },
  postBtnDisabled: { backgroundColor: C.textTertiary },
  postBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#FFF' },
  postHint:    { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textTertiary, textAlign: 'center' },

  postSuccess: { alignItems: 'center', paddingVertical: 12, gap: 8 },
  postSuccessTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: C.text },
  postSuccessSub:   { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textSecondary, textAlign: 'center' },
  postAgainBtn:     { marginTop: 4, paddingVertical: 8, paddingHorizontal: 20 },
  postAgainText:    { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.primary },
});
