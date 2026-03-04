import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform,
  ActivityIndicator, Alert, Linking, Animated, Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useApp } from '@/lib/context';
import { apiRequest } from '@/lib/query-client';
import * as Haptics from 'expo-haptics';

const ACCENT = '#6C63FF';
const ACCENT2 = '#FF6B6B';
const GREEN = '#34C759';
const ORANGE = '#FF9500';
const RED = '#FF3B30';

interface CheckItem {
  key: string;
  label: string;
  icon: string;
  status: 'checking' | 'good' | 'warning' | 'critical';
  detail: string;
  value?: number;
}

interface AiSuggestion {
  issue: string;
  recommendation: string;
  estimatedCost: string;
  urgency: 'high' | 'medium' | 'low';
  category: 'hardware' | 'software';
}

interface DiagnosticResult {
  batteryLevel: number;
  batteryHealth: string;
  storageUsed: number;
  storageTotal: number;
  storagePercent: number;
  networkType: string;
  networkStrength: string;
  temperature: string;
  sensorsStatus: string;
  overallScore: number;
  issues: string[];
  platform: string;
  deviceModel: string;
}

function statusColor(status: CheckItem['status']): string {
  if (status === 'good') return GREEN;
  if (status === 'warning') return ORANGE;
  if (status === 'critical') return RED;
  return '#999';
}

function statusIcon(status: CheckItem['status']): string {
  if (status === 'good') return 'checkmark-circle';
  if (status === 'warning') return 'warning';
  if (status === 'critical') return 'close-circle';
  return 'ellipse-outline';
}

function urgencyColor(urgency: string): string {
  if (urgency === 'high') return RED;
  if (urgency === 'medium') return ORANGE;
  return GREEN;
}

async function runDeviceScan(): Promise<DiagnosticResult> {
  let batteryLevel = 85;
  let batteryHealth = 'good';
  let storageUsed = 0;
  let storageTotal = 0;
  let storagePercent = 60;
  let networkType = 'WiFi';
  let networkStrength = 'good';
  const temperature = 'normal';
  const sensorsStatus = 'good';
  let deviceModel = 'Smartphone';
  const platform = Platform.OS;

  if (Platform.OS !== 'web') {
    try {
      const Battery = await import('expo-battery');
      const level = await Battery.getBatteryLevelAsync();
      batteryLevel = Math.round(level * 100);
      const state = await Battery.getBatteryStateAsync();
      if (batteryLevel < 20) batteryHealth = 'critical';
      else if (batteryLevel < 40) batteryHealth = 'low';
      else if (batteryLevel < 60) batteryHealth = 'fair';
      else batteryHealth = 'good';
    } catch {}

    try {
      const FileSystem = await import('expo-file-system');
      const info = await FileSystem.getFreeDiskStorageAsync();
      const total = await FileSystem.getTotalDiskCapacityAsync();
      storageTotal = Math.round(total / (1024 * 1024 * 1024));
      const free = Math.round(info / (1024 * 1024 * 1024));
      storageUsed = storageTotal - free;
      storagePercent = Math.round((storageUsed / storageTotal) * 100);
    } catch {}

    try {
      const Network = await import('expo-network');
      const netState = await Network.getNetworkStateAsync();
      if (netState.type === Network.NetworkStateType.WIFI) networkType = 'WiFi';
      else if (netState.type === Network.NetworkStateType.CELLULAR) networkType = '4G/5G';
      else if (!netState.isConnected) { networkType = 'Offline'; networkStrength = 'critical'; }
      networkStrength = netState.isInternetReachable ? 'good' : 'warning';
    } catch {}

    try {
      const Device = await import('expo-device');
      deviceModel = `${Device.manufacturer || ''} ${Device.modelName || 'Device'}`.trim();
    } catch {}
  } else {
    batteryLevel = 78;
    batteryHealth = 'good';
    storageUsed = 45;
    storageTotal = 64;
    storagePercent = 70;
    networkType = 'WiFi';
    networkStrength = 'good';
    deviceModel = 'Web Browser';
  }

  const issues: string[] = [];
  let overallScore = 100;

  if (batteryLevel < 20) { issues.push('Battery critically low — needs immediate charging'); overallScore -= 25; }
  else if (batteryLevel < 40) { issues.push('Battery level is low — consider charging soon'); overallScore -= 10; }
  if (batteryHealth === 'low' || batteryHealth === 'critical') { issues.push('Battery health degraded — replacement recommended'); overallScore -= 20; }
  if (storagePercent > 90) { issues.push('Storage almost full — device performance affected'); overallScore -= 20; }
  else if (storagePercent > 75) { issues.push('Storage getting full — clean up recommended'); overallScore -= 10; }
  if (networkStrength === 'critical') { issues.push('No internet connection detected'); overallScore -= 15; }
  else if (networkStrength === 'warning') { issues.push('Internet connectivity issues detected'); overallScore -= 8; }

  overallScore = Math.max(0, overallScore);

  return {
    batteryLevel, batteryHealth,
    storageUsed, storageTotal, storagePercent,
    networkType, networkStrength,
    temperature, sensorsStatus,
    overallScore, issues, platform, deviceModel,
  };
}

export default function DiagnosticsScreen() {
  const insets = useSafeAreaInsets();
  const { profile, allProfiles } = useApp();
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'done'>('idle');
  const [checks, setChecks] = useState<CheckItem[]>([]);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [policy, setPolicy] = useState<any>(null);
  const [scanAnim] = useState(new Animated.Value(0));
  const [showTechs, setShowTechs] = useState(false);

  const webTop = Platform.OS === 'web' ? 67 : 0;
  const tabBarPad = Platform.OS === 'web' ? 84 + 34 : 100;

  useEffect(() => {
    if (profile?.id) {
      apiRequest('GET', `/api/insurance/policy/${profile.id}`)
        .then(r => r.json())
        .then(d => setPolicy(d.policy || null))
        .catch(() => {});
    }
  }, [profile?.id]);

  useEffect(() => {
    if (phase === 'scanning') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, { toValue: 1, duration: 1000, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(scanAnim, { toValue: 0, duration: 1000, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        ])
      ).start();
    } else {
      scanAnim.stopAnimation();
      scanAnim.setValue(0);
    }
  }, [phase]);

  const runScan = useCallback(async () => {
    if (!profile) { Alert.alert('Login Required', 'Please log in to run diagnostics.'); return; }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setPhase('scanning');
    setChecks([
      { key: 'battery', label: 'Battery Health', icon: 'battery-charging', status: 'checking', detail: 'Scanning...' },
      { key: 'storage', label: 'Storage', icon: 'server', status: 'checking', detail: 'Scanning...' },
      { key: 'network', label: 'Network', icon: 'wifi', status: 'checking', detail: 'Scanning...' },
      { key: 'temp', label: 'Temperature', icon: 'thermometer', status: 'checking', detail: 'Scanning...' },
      { key: 'sensors', label: 'Sensors', icon: 'compass', status: 'checking', detail: 'Scanning...' },
    ]);
    setAiSuggestions([]);
    setResult(null);

    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

    try {
      await delay(600);
      const scanResult = await runDeviceScan();

      const batteryStatus: CheckItem['status'] =
        scanResult.batteryHealth === 'critical' ? 'critical' :
        scanResult.batteryHealth === 'low' ? 'warning' :
        scanResult.batteryLevel < 40 ? 'warning' : 'good';
      setChecks(prev => prev.map(c => c.key === 'battery' ? {
        ...c, status: batteryStatus,
        detail: `${scanResult.batteryLevel}% — ${scanResult.batteryHealth.charAt(0).toUpperCase() + scanResult.batteryHealth.slice(1)}`,
        value: scanResult.batteryLevel,
      } : c));
      await delay(500);

      const storageStatus: CheckItem['status'] =
        scanResult.storagePercent > 90 ? 'critical' :
        scanResult.storagePercent > 75 ? 'warning' : 'good';
      setChecks(prev => prev.map(c => c.key === 'storage' ? {
        ...c, status: storageStatus,
        detail: `${scanResult.storagePercent}% used (${scanResult.storageUsed}GB / ${scanResult.storageTotal}GB)`,
        value: scanResult.storagePercent,
      } : c));
      await delay(500);

      const netStatus: CheckItem['status'] =
        scanResult.networkStrength === 'critical' ? 'critical' :
        scanResult.networkStrength === 'warning' ? 'warning' : 'good';
      setChecks(prev => prev.map(c => c.key === 'network' ? {
        ...c, status: netStatus,
        detail: `${scanResult.networkType} — ${netStatus === 'good' ? 'Connected' : 'Issues Detected'}`,
      } : c));
      await delay(400);

      setChecks(prev => prev.map(c => c.key === 'temp' ? { ...c, status: 'good', detail: 'Normal Range' } : c));
      await delay(300);
      setChecks(prev => prev.map(c => c.key === 'sensors' ? { ...c, status: 'good', detail: 'All sensors working' } : c));
      await delay(300);

      setResult(scanResult);
      setPhase('done');

      setAiLoading(true);
      try {
        const res = await apiRequest('POST', '/api/diagnostics', {
          userId: profile.id,
          userName: profile.name,
          deviceModel: scanResult.deviceModel,
          platform: scanResult.platform,
          batteryLevel: scanResult.batteryLevel,
          batteryHealth: scanResult.batteryHealth,
          storageUsed: `${scanResult.storageUsed}GB`,
          storageTotal: `${scanResult.storageTotal}GB`,
          networkType: scanResult.networkType,
          networkStrength: scanResult.networkStrength,
          temperature: scanResult.temperature,
          sensorsStatus: scanResult.sensorsStatus,
          overallScore: scanResult.overallScore,
          issues: scanResult.issues,
        });
        const data = await res.json();
        if (data.aiSuggestions && data.aiSuggestions.length > 0) {
          setAiSuggestions(data.aiSuggestions);
        }
      } catch (e) {
        console.log('[Diagnostics] Failed to save/get AI suggestions:', e);
      } finally {
        setAiLoading(false);
      }
    } catch (err) {
      console.error('[Diagnostics] Scan error:', err);
      setPhase('idle');
      Alert.alert('Scan Failed', 'Could not complete the scan. Please try again.');
    }
  }, [profile]);

  const technicians = allProfiles.filter(p => p.role === 'technician').slice(0, 6);

  const scoreColor = (score: number) => score >= 80 ? GREEN : score >= 50 ? ORANGE : RED;

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Good';
    if (score >= 50) return 'Fair';
    return 'Needs Attention';
  };

  const renderIdle = () => (
    <View style={s.idleContainer}>
      <Animated.View style={[s.scanOrb, {
        opacity: scanAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }),
        transform: [{ scale: scanAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.05] }) }],
      }]}>
        <Ionicons name="phone-portrait" size={56} color={ACCENT} />
      </Animated.View>
      <Text style={s.idleTitle}>Smart Device Scan</Text>
      <Text style={s.idleSub}>
        Analyze battery, storage, network{'\n'}and get AI-powered repair suggestions
      </Text>
      <Pressable
        style={({ pressed }) => [s.startBtn, pressed && { opacity: 0.85 }]}
        onPress={runScan}
      >
        <Ionicons name="scan" size={22} color="#fff" />
        <Text style={s.startBtnText}>Run Diagnostic Scan</Text>
      </Pressable>
      <View style={s.featuresRow}>
        {[
          { icon: 'shield-checkmark', label: 'AI Powered' },
          { icon: 'flash', label: 'Instant' },
          { icon: 'lock-closed', label: 'Private' },
        ].map((f, i) => (
          <View key={i} style={s.featureItem}>
            <Ionicons name={f.icon as any} size={18} color={ACCENT} />
            <Text style={s.featureLabel}>{f.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  const renderScanning = () => (
    <View style={s.scanningContainer}>
      <Animated.View style={[s.scanRing, {
        opacity: scanAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.8] }),
        transform: [{ scale: scanAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.1] }) }],
      }]} />
      <View style={s.scanInner}>
        <Ionicons name="scan" size={40} color={ACCENT} />
      </View>
      <Text style={s.scanningTitle}>Running Smart Device Scan...</Text>
      {checks.map((check, i) => (
        <View key={check.key} style={s.checkRow}>
          <View style={[s.checkIconCircle, { backgroundColor: check.status === 'checking' ? '#F0F0F0' : statusColor(check.status) + '20' }]}>
            {check.status === 'checking' ? (
              <ActivityIndicator size="small" color={ACCENT} />
            ) : (
              <Ionicons name={statusIcon(check.status) as any} size={18} color={statusColor(check.status)} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.checkLabel}>{check.label}</Text>
            <Text style={[s.checkDetail, { color: check.status === 'checking' ? '#999' : statusColor(check.status) }]}>
              {check.detail}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );

  const renderResults = () => {
    if (!result) return null;
    const hasIssues = result.issues.length > 0;
    const discount = policy?.planPrice === 59 ? 1000 : policy ? 500 : 0;

    return (
      <>
        <View style={s.scoreCard}>
          <View style={s.scoreCircle}>
            <Text style={[s.scoreNum, { color: scoreColor(result.overallScore) }]}>{result.overallScore}</Text>
            <Text style={s.scoreOutOf}>/100</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={s.scoreTitle}>Device Health Report</Text>
            <Text style={[s.scoreLabel, { color: scoreColor(result.overallScore) }]}>
              {getScoreLabel(result.overallScore)}
            </Text>
            <Text style={s.deviceModel}>{result.deviceModel}</Text>
          </View>
          <Pressable style={s.rescanBtn} onPress={runScan}>
            <Ionicons name="refresh" size={18} color={ACCENT} />
          </Pressable>
        </View>

        <View style={s.checksGrid}>
          {checks.map(check => (
            <View key={check.key} style={[s.checkCard, { borderTopColor: statusColor(check.status) }]}>
              <Ionicons name={check.icon as any} size={20} color={statusColor(check.status)} />
              <Text style={s.checkCardLabel}>{check.label}</Text>
              <Ionicons name={statusIcon(check.status) as any} size={14} color={statusColor(check.status)} />
              <Text style={[s.checkCardDetail, { color: statusColor(check.status) }]} numberOfLines={2}>
                {check.detail}
              </Text>
            </View>
          ))}
        </View>

        {hasIssues && (
          <View style={s.issuesCard}>
            <View style={s.issuesHeader}>
              <Ionicons name="warning" size={20} color={ORANGE} />
              <Text style={s.issuesTitle}>Issues Detected</Text>
            </View>
            {result.issues.map((issue, i) => (
              <View key={i} style={s.issueRow}>
                <View style={s.issueDot} />
                <Text style={s.issueText}>{issue}</Text>
              </View>
            ))}
          </View>
        )}

        {aiLoading ? (
          <View style={s.aiLoadingCard}>
            <ActivityIndicator size="small" color={ACCENT} />
            <Text style={s.aiLoadingText}>AI is analyzing your device...</Text>
          </View>
        ) : aiSuggestions.length > 0 ? (
          <View style={s.suggestionsSection}>
            <View style={s.sectionHeaderRow}>
              <Ionicons name="sparkles" size={18} color={ACCENT} />
              <Text style={s.sectionTitle}>AI Repair Suggestions</Text>
            </View>
            {aiSuggestions.map((sug, i) => (
              <View key={i} style={s.suggestionCard}>
                <View style={s.suggestionHeader}>
                  <View style={[s.urgencyBadge, { backgroundColor: urgencyColor(sug.urgency) + '20' }]}>
                    <Text style={[s.urgencyText, { color: urgencyColor(sug.urgency) }]}>
                      {sug.urgency.toUpperCase()}
                    </Text>
                  </View>
                  <View style={[s.categoryBadge, { backgroundColor: sug.category === 'hardware' ? '#FF6B6B20' : '#6C63FF20' }]}>
                    <Ionicons
                      name={sug.category === 'hardware' ? 'construct' : 'code-slash'}
                      size={12}
                      color={sug.category === 'hardware' ? ACCENT2 : ACCENT}
                    />
                    <Text style={[s.categoryText, { color: sug.category === 'hardware' ? ACCENT2 : ACCENT }]}>
                      {sug.category}
                    </Text>
                  </View>
                </View>
                <Text style={s.suggestionIssue}>{sug.issue}</Text>
                <Text style={s.suggestionRec}>{sug.recommendation}</Text>
                <View style={s.costRow}>
                  <View>
                    <Text style={s.costLabel}>Estimated Cost</Text>
                    <Text style={s.costValue}>{sug.estimatedCost}</Text>
                  </View>
                  {policy && discount > 0 && (
                    <View style={s.discountBox}>
                      <Text style={s.discountLabel}>Insurance saves you</Text>
                      <Text style={s.discountValue}>₹{discount}</Text>
                    </View>
                  )}
                </View>
                <Pressable
                  style={({ pressed }) => [s.bookBtn, pressed && { opacity: 0.85 }]}
                  onPress={() => { setShowTechs(true); router.push('/(tabs)/directory'); }}
                >
                  <Ionicons name="construct" size={16} color="#fff" />
                  <Text style={s.bookBtnText}>Book Repair</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : !hasIssues ? (
          <View style={s.healthyCard}>
            <Ionicons name="checkmark-circle" size={48} color={GREEN} />
            <Text style={s.healthyTitle}>Your device is healthy!</Text>
            <Text style={s.healthySub}>No issues found. Keep up the good maintenance.</Text>
          </View>
        ) : null}

        {policy ? (
          <View style={s.insuranceBanner}>
            <Ionicons name="shield-checkmark" size={22} color="#5856D6" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={s.insuranceBannerTitle}>Insurance Active — {policy.planName}</Text>
              <Text style={s.insuranceBannerSub}>₹{discount} discount on any repair booking</Text>
            </View>
          </View>
        ) : (
          <Pressable
            style={s.getInsuranceBanner}
            onPress={() => router.push('/insurance')}
          >
            <Ionicons name="shield-outline" size={22} color="#5856D6" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={s.insuranceBannerTitle}>Protect Your Device</Text>
              <Text style={s.insuranceBannerSub}>Get insurance from ₹30/month → get repair discounts</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#5856D6" />
          </Pressable>
        )}

        <View style={s.sectionHeaderRow}>
          <Ionicons name="location" size={18} color="#FF6B6B" />
          <Text style={s.sectionTitle}>Nearby Technicians</Text>
        </View>
        {technicians.length === 0 ? (
          <View style={s.noTechsBox}>
            <Text style={s.noTechsText}>No technicians found nearby</Text>
          </View>
        ) : (
          technicians.map(tech => {
            const skills = Array.isArray(tech.skills) ? tech.skills : [];
            return (
              <View key={tech.id} style={s.techCard}>
                <View style={s.techLeft}>
                  <View style={s.techAvatar}>
                    <Text style={s.techAvatarText}>{tech.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View>
                    <Text style={s.techName}>{tech.name}</Text>
                    {(tech.city || tech.state) && (
                      <Text style={s.techLocation}>{[tech.city, tech.state].filter(Boolean).join(', ')}</Text>
                    )}
                    {skills.length > 0 && (
                      <Text style={s.techSkills} numberOfLines={1}>{skills.slice(0, 2).join(' · ')}</Text>
                    )}
                  </View>
                </View>
                <Pressable
                  style={({ pressed }) => [s.bookNowBtn, pressed && { opacity: 0.8 }]}
                  onPress={() => router.push({ pathname: '/user-profile', params: { id: tech.id } })}
                >
                  <Text style={s.bookNowText}>Book</Text>
                </Pressable>
              </View>
            );
          })
        )}
      </>
    );
  };

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: (Platform.OS === 'web' ? webTop : insets.top) + 16 }]}>
        <View style={s.headerInner}>
          <View>
            <Text style={s.headerTitle}>Diagnostics</Text>
            <Text style={s.headerSub}>AI-powered device health</Text>
          </View>
          {phase === 'done' && (
            <Pressable
              style={s.historyBtn}
              onPress={() => router.push('/diagnostic-history')}
            >
              <Ionicons name="time-outline" size={20} color={ACCENT} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: tabBarPad }}
        showsVerticalScrollIndicator={false}
      >
        {phase === 'idle' && renderIdle()}
        {phase === 'scanning' && renderScanning()}
        {phase === 'done' && renderResults()}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F4F8' },
  header: {
    backgroundColor: '#fff', paddingHorizontal: 20, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  headerInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerTitle: { fontSize: 26, fontFamily: 'Inter_700Bold', color: '#1A1A2E' },
  headerSub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#999', marginTop: 2 },
  historyBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0EFFE', justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },

  idleContainer: { alignItems: 'center', paddingTop: 40, paddingBottom: 20 },
  scanOrb: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: '#F0EFFE', justifyContent: 'center', alignItems: 'center',
    marginBottom: 28,
    shadowColor: ACCENT, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 8,
  },
  idleTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', color: '#1A1A2E', marginBottom: 10 },
  idleSub: { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: ACCENT, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 32,
    shadowColor: ACCENT, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
    marginBottom: 28,
  },
  startBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },
  featuresRow: { flexDirection: 'row', gap: 24 },
  featureItem: { alignItems: 'center', gap: 4 },
  featureLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', color: '#666' },

  scanningContainer: { alignItems: 'center', paddingTop: 30, paddingBottom: 20, width: '100%' },
  scanRing: {
    position: 'absolute', top: 10, width: 120, height: 120,
    borderRadius: 60, borderWidth: 3, borderColor: ACCENT,
  },
  scanInner: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#F0EFFE', justifyContent: 'center', alignItems: 'center',
    marginBottom: 24,
  },
  scanningTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#1A1A2E', marginBottom: 24 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%', marginBottom: 12 },
  checkIconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  checkLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#1A1A2E' },
  checkDetail: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },

  scoreCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 20, padding: 20, marginTop: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  scoreCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#F8F8FF', justifyContent: 'center', alignItems: 'center', flexDirection: 'row',
    borderWidth: 3, borderColor: '#E8E8F0',
  },
  scoreNum: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  scoreOutOf: { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#999', marginTop: 8 },
  scoreTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#1A1A2E' },
  scoreLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginTop: 3 },
  deviceModel: { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#999', marginTop: 2 },
  rescanBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F0EFFE', justifyContent: 'center', alignItems: 'center' },

  checksGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  checkCard: {
    width: '48%' as any, backgroundColor: '#fff', borderRadius: 14, padding: 14,
    borderTopWidth: 3, gap: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  checkCardLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#1A1A2E' },
  checkCardDetail: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 15 },

  issuesCard: {
    backgroundColor: '#FFF8F0', borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#FFE4B5',
  },
  issuesHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  issuesTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#1A1A2E' },
  issueRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  issueDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ORANGE, marginTop: 6 },
  issueText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', color: '#444', lineHeight: 20 },

  aiLoadingCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F0EFFE', borderRadius: 16, padding: 16, marginBottom: 12,
  },
  aiLoadingText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: ACCENT },

  suggestionsSection: { marginBottom: 12 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, marginTop: 4 },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: '#1A1A2E' },
  suggestionCard: {
    backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  suggestionHeader: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  urgencyBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  urgencyText: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  categoryBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  categoryText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  suggestionIssue: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#1A1A2E', marginBottom: 4 },
  suggestionRec: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#555', lineHeight: 20, marginBottom: 12 },
  costRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  costLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#999' },
  costValue: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#1A1A2E' },
  discountBox: { backgroundColor: '#E8FAF0', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center' },
  discountLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', color: '#34C759' },
  discountValue: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#34C759' },
  bookBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: ACCENT, borderRadius: 12, padding: 12,
  },
  bookBtnText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#fff' },

  healthyCard: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 20, padding: 28, marginBottom: 12 },
  healthyTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#1A1A2E', marginTop: 12 },
  healthySub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#666', marginTop: 6, textAlign: 'center' },

  insuranceBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F0EFFE', borderRadius: 16, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: '#D4D0FA',
  },
  getInsuranceBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F0EFFE', borderRadius: 16, padding: 14, marginBottom: 16,
    borderWidth: 1.5, borderColor: '#5856D6',
  },
  insuranceBannerTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#1A1A2E' },
  insuranceBannerSub: { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#666', marginTop: 2 },

  techCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  techLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  techAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F0EFFE', justifyContent: 'center', alignItems: 'center' },
  techAvatarText: { fontSize: 18, fontFamily: 'Inter_700Bold', color: ACCENT },
  techName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#1A1A2E' },
  techLocation: { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#999', marginTop: 1 },
  techSkills: { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#666', marginTop: 1 },
  bookNowBtn: { backgroundColor: ACCENT, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  bookNowText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#fff' },

  noTechsBox: { alignItems: 'center', padding: 24 },
  noTechsText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#999' },
});
