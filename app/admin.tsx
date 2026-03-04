import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, Platform, Alert, ScrollView, TextInput, Switch, ActivityIndicator, RefreshControl, TouchableOpacity
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Colors from '@/constants/colors';
import { useApp } from '@/lib/context';
import { ROLE_LABELS, UserRole, ADMIN_PHONE, SubscriptionSetting } from '@/lib/types';
import { apiRequest, getApiUrl } from '@/lib/query-client';
import { openLink } from '@/lib/open-link';

const C = Colors.light;

type AdminTab = 'dashboard' | 'users' | 'posts' | 'jobs' | 'subscriptions' | 'revenue' | 'ads' | 'links' | 'device' | 'notifications' | 'email' | 'security' | 'reviews' | 'insurance' | 'diagnostics';

const ROLE_COLORS: Record<UserRole, string> = {
  technician: '#34C759',
  teacher: '#FFD60A',
  supplier: '#FF6B2C',
  job_provider: '#5E8BFF',
  customer: '#FF2D55',
};

const NOTIF_ROLE_OPTIONS = [
  { key: 'all', label: 'All Users', color: '#007AFF' },
  { key: 'technician', label: 'Technicians', color: '#34C759' },
  { key: 'teacher', label: 'Teachers', color: '#FFD60A' },
  { key: 'supplier', label: 'Suppliers', color: '#FF6B2C' },
  { key: 'job_provider', label: 'Job Providers', color: '#5E8BFF' },
  { key: 'customer', label: 'Customers', color: '#FF2D55' },
];

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function maskNumber(num: string): string {
  if (!num || num.length < 4) return num || '';
  return num.slice(0, 4) + ' XXXX ' + num.slice(-4);
}

function UserDetailCard({ user, onBlock, onDelete }: { user: any; onBlock: (id: string, name: string, blocked: boolean) => void; onDelete: (id: string, name: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [changingRole, setChangingRole] = useState(false);
  const [roleStatus, setRoleStatus] = useState<{msg: string; ok: boolean} | null>(null);
  const { refreshData } = useApp();
  const roleColor = ROLE_COLORS[user.role as UserRole] || C.textSecondary;
  const profile = user.fullProfile;
  const isBlocked = profile?.blocked === 1;

  const changeRole = async (newRole: UserRole) => {
    setShowRolePicker(false);
    setChangingRole(true);
    setRoleStatus(null);
    try {
      const res = await apiRequest('POST', '/api/admin/change-role', { userId: user.id, newRole });
      const data = await res.json();
      if (data.success) {
        setRoleStatus({ msg: `Changed to ${ROLE_LABELS[newRole] || newRole}`, ok: true });
        await refreshData();
      } else {
        setRoleStatus({ msg: data.message || 'Failed', ok: false });
      }
    } catch (e: any) {
      setRoleStatus({ msg: e?.message || 'Network error', ok: false });
    } finally {
      setChangingRole(false);
      setTimeout(() => setRoleStatus(null), 3000);
    }
  };

  const ROLES_LIST: UserRole[] = ['technician', 'teacher', 'supplier', 'customer', 'job_provider', 'admin'];

  return (
    <View style={[styles.userCard, isBlocked && { borderColor: '#FF3B30', borderWidth: 1 }]}>
      <Pressable onPress={() => { setShowRolePicker(false); setExpanded(!expanded); }}>
      <View style={styles.userCardTop}>
        {profile?.avatar ? (
          <Image source={{ uri: profile.avatar }} style={[styles.userAvatarImg, isBlocked && { opacity: 0.5 }]} contentFit="cover" />
        ) : (
          <View style={[styles.userAvatar, { backgroundColor: roleColor + '20' }, isBlocked && { opacity: 0.5 }]}>
            <Text style={[styles.userAvatarText, { color: roleColor }]}>{getInitials(user.name)}</Text>
          </View>
        )}
        <View style={styles.userInfo}>
          <View style={styles.userNameRow}>
            <Text style={[styles.userName, isBlocked && { color: '#FF3B30' }]} numberOfLines={1}>{user.name}</Text>
            {isBlocked && (
              <View style={[styles.registeredBadge, { backgroundColor: '#FF3B3015' }]}>
                <Text style={[styles.registeredText, { color: '#FF3B30' }]}>Blocked</Text>
              </View>
            )}
            {!isBlocked && user.isRegistered && (
              <View style={styles.registeredBadge}>
                <Text style={styles.registeredText}>Verified</Text>
              </View>
            )}
          </View>
              <View style={styles.userMeta}>
                <View style={[styles.userRoleBadge, { backgroundColor: roleColor + '15' }]}>
                  <Text style={[styles.userRoleText, { color: roleColor }]}>{ROLE_LABELS[user.role as UserRole] || user.role}</Text>
                </View>
                <Pressable 
                  style={{ marginLeft: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: C.surfaceHighlight, borderRadius: 6 }}
                  onPress={(e) => { e.stopPropagation?.(); setShowRolePicker(v => !v); }}
                  disabled={changingRole}
                >
                  <Text style={{ fontSize: 10, color: C.primary, fontFamily: 'Inter_600SemiBold' }}>
                    {changingRole ? 'Saving...' : 'Change Role'}
                  </Text>
                </Pressable>
            {user.city ? (
              <View style={styles.userCityRow}>
                <Ionicons name="location-outline" size={12} color={C.textTertiary} />
                <Text style={styles.userCity}>{user.city}</Text>
              </View>
            ) : null}
          </View>
          {profile?.phone && (
            <View style={styles.phoneRow}>
              <Ionicons name="call-outline" size={12} color={C.textTertiary} />
              <Text style={styles.phoneText}>{profile.phone}</Text>
            </View>
          )}
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={C.textTertiary} />
      </View>
      </Pressable>

      {roleStatus && (
        <View style={{ marginTop: 6, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: roleStatus.ok ? '#34C75915' : '#FF3B3015', borderRadius: 8 }}>
          <Text style={{ fontSize: 12, color: roleStatus.ok ? '#34C759' : '#FF3B30', fontFamily: 'Inter_600SemiBold' }}>{roleStatus.msg}</Text>
        </View>
      )}

      {showRolePicker && (
        <View style={{ marginTop: 8, backgroundColor: C.surfaceElevated, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: C.border }}>
          {ROLES_LIST.map(r => (
            <Pressable
              key={r}
              onPress={() => changeRole(r)}
              style={[{
                paddingVertical: 11,
                paddingHorizontal: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                borderBottomWidth: 1,
                borderBottomColor: C.borderLight,
              }, r === user.role && { backgroundColor: C.primary + '15' }]}
            >
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: ROLE_COLORS[r] || C.textSecondary }} />
              <Text style={{ fontSize: 14, fontFamily: r === user.role ? 'Inter_600SemiBold' : 'Inter_400Regular', color: r === user.role ? C.primary : C.text }}>
                {ROLE_LABELS[r] || r}
              </Text>
              {r === user.role && <Ionicons name="checkmark" size={14} color={C.primary} style={{ marginLeft: 'auto' as any }} />}
            </Pressable>
          ))}
          <Pressable
            onPress={() => setShowRolePicker(false)}
            style={{ paddingVertical: 11, paddingHorizontal: 14, alignItems: 'center' }}
          >
            <Text style={{ fontSize: 13, color: C.textTertiary, fontFamily: 'Inter_500Medium' }}>Cancel</Text>
          </Pressable>
        </View>
      )}

      {expanded && profile && (
        <View style={styles.userDetails}>
          {profile.sellType ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Sells</Text>
              <Text style={styles.detailValue}>{profile.sellType}</Text>
            </View>
          ) : null}
          {profile.teachType ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Teaches</Text>
              <Text style={styles.detailValue}>{profile.teachType}</Text>
            </View>
          ) : null}
          {profile.shopName ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Shop</Text>
              <Text style={styles.detailValue}>{profile.shopName}</Text>
            </View>
          ) : null}
          {profile.shopAddress ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Address</Text>
              <Text style={styles.detailValue}>{profile.shopAddress}</Text>
            </View>
          ) : null}
          {profile.gstNumber ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>GST</Text>
              <Text style={styles.detailValue}>{profile.gstNumber}</Text>
            </View>
          ) : null}
          {profile.aadhaarNumber ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Aadhaar</Text>
              <Text style={styles.detailValue}>{maskNumber(profile.aadhaarNumber)}</Text>
            </View>
          ) : null}
          {profile.panNumber ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>PAN</Text>
              <Text style={styles.detailValue}>{profile.panNumber}</Text>
            </View>
          ) : null}
          {profile.experience ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Experience</Text>
              <Text style={styles.detailValue}>{profile.experience}</Text>
            </View>
          ) : null}
          {profile.skills && profile.skills.length > 0 ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Skills</Text>
              <Text style={styles.detailValue}>{profile.skills.join(', ')}</Text>
            </View>
          ) : null}
          <Text style={styles.detailPostCount}>{user.postCount} post{user.postCount !== 1 ? 's' : ''}</Text>

          {confirmDelete ? (
            <View style={{ marginTop: 12, backgroundColor: '#FF3B3010', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#FF3B3040' }}>
              <Text style={{ color: '#FF3B30', fontSize: 13, fontFamily: 'Inter_600SemiBold', textAlign: 'center', marginBottom: 10 }}>
                Permanently delete {user.name}? This cannot be undone.
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  style={{ flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 8, backgroundColor: C.card, borderWidth: 1, borderColor: C.border }}
                  onPress={() => setConfirmDelete(false)}
                >
                  <Text style={{ color: C.text, fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={{ flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 8, backgroundColor: '#FF3B30' }}
                  onPress={() => { setConfirmDelete(false); onDelete(user.id, user.name); }}
                >
                  <Text style={{ color: '#fff', fontSize: 13, fontFamily: 'Inter_700Bold' }}>Yes, Delete</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <Pressable
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: isBlocked ? '#34C75915' : '#FF3B3015', paddingVertical: 10, borderRadius: 10 }}
                onPress={() => onBlock(user.id, user.name, !isBlocked)}
              >
                <Ionicons name={isBlocked ? 'checkmark-circle-outline' : 'ban'} size={16} color={isBlocked ? '#34C759' : '#FF3B30'} />
                <Text style={{ color: isBlocked ? '#34C759' : '#FF3B30', fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>
                  {isBlocked ? 'Unblock' : 'Block'}
                </Text>
              </Pressable>
              <Pressable
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FF3B3015', paddingVertical: 10, borderRadius: 10 }}
                onPress={() => setConfirmDelete(true)}
              >
                <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                <Text style={{ color: '#FF3B30', fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>Delete</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const { profile, posts, jobs, conversations, deletePost, allProfiles, refreshData } = useApp();
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [subscriptions, setSubscriptions] = useState<SubscriptionSetting[]>([]);
  const [subLoading, setSubLoading] = useState(false);
  const [adsList, setAdsList] = useState<any[]>([]);
  const [loadingAds, setLoadingAds] = useState(false);
  const [adTitle, setAdTitle] = useState('');
  const [adLinkUrl, setAdLinkUrl] = useState('');
  const [adImage, setAdImage] = useState<string | null>(null);
  const [liveUrl, setLiveUrl] = useState('');
  const [schematicsUrl, setSchematicsUrl] = useState('');
  const [webToolsUrl, setWebToolsUrl] = useState('');
  const [whatsappSupportUrl, setWhatsappSupportUrl] = useState('');
  const [linksLoading, setLinksLoading] = useState(false);
  const [deviceLockEnabled, setDeviceLockEnabled] = useState(false);
  const [deviceLockPrice, setDeviceLockPrice] = useState('100');
  const [deviceSettingsLoading, setDeviceSettingsLoading] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | UserRole>('all');

  const [revenueData, setRevenueData] = useState<any>(null);
  const [revenueLoading, setRevenueLoading] = useState(false);
  const [activeSubsList, setActiveSubsList] = useState<any[]>([]);
  const [activeSubsLoading, setActiveSubsLoading] = useState(false);

  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [notifSending, setNotifSending] = useState(false);
  const [notifResult, setNotifResult] = useState<string | null>(null);
  const [pushStats, setPushStats] = useState<{ total: number; withToken: number; byRole?: Record<string, number> } | null>(null);
  const [pushStatsLoading, setPushStatsLoading] = useState(false);
  const [notifTargetRole, setNotifTargetRole] = useState<string>('all');

  const [smsBody, setSmsBody] = useState('');
  const [smsSending, setSmsSending] = useState(false);
  const [smsResult, setSmsResult] = useState<string | null>(null);
  const [smsTargetRole, setSmsTargetRole] = useState<string>('all');

  const [emailTargetRole, setEmailTargetRole] = useState<string>('all');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<string | null>(null);

  const [emailStats, setEmailStats] = useState<{ totalWithEmail: number; subscribed: number; unsubscribed: number } | null>(null);
  const [emailCampaignList, setEmailCampaignList] = useState<any[]>([]);
  const [emailStatsLoading, setEmailStatsLoading] = useState(false);
  const [emailScheduleDate, setEmailScheduleDate] = useState('');
  const [emailScheduleTime, setEmailScheduleTime] = useState('');

  const [lockNotifications, setLockNotifications] = useState<any[]>([]);
  const [lockNotifLoading, setLockNotifLoading] = useState(false);
  const [reviewsList, setReviewsList] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [diagnosticsList, setDiagnosticsList] = useState<any[]>([]);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [insurancePlansAdmin, setInsurancePlansAdmin] = useState<any[]>([]);
  const [insurancePoliciesAdmin, setInsurancePoliciesAdmin] = useState<any[]>([]);
  const [insuranceLoading, setInsuranceLoading] = useState(false);
  const [insuranceTab, setInsuranceTab] = useState<'plans' | 'policies'>('plans');
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [newPlan, setNewPlan] = useState({ name: '', price: '30', repairDiscount: '500', coverage: '' });
  const [showNewPlan, setShowNewPlan] = useState(false);

  const [whatsappLink, setWhatsappLink] = useState('https://wa.me/918179142535');
  const [supportSaving, setSupportSaving] = useState(false);
  const [unlockingUserId, setUnlockingUserId] = useState<string | null>(null);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const cleanProfilePhone = profile?.phone?.replace(/\D/g, "");
  const isAdmin = profile?.role === 'admin' || cleanProfilePhone === "8179142535" || cleanProfilePhone === "9876543210";

  useEffect(() => {
    if (!isAdmin) {
      Alert.alert('Access Denied', 'You do not have admin access.');
      router.back();
    }
  }, [isAdmin]);

  const fetchSubscriptions = useCallback(async () => {
    try {
      setSubLoading(true);
      const res = await apiRequest('GET', '/api/subscription-settings');
      const data = await res.json();
      setSubscriptions(data);
    } catch (e) {
      console.warn('Failed to fetch subscriptions:', e);
    } finally {
      setSubLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'subscriptions') {
      fetchSubscriptions();
    }
  }, [activeTab, fetchSubscriptions]);

  const fetchAds = useCallback(async () => {
    setLoadingAds(true);
    try {
      const res = await apiRequest('GET', '/api/ads');
      const data = await res.json();
      if (Array.isArray(data)) setAdsList(data);
    } catch (err) {
      console.warn('Failed to fetch ads:', err);
    } finally {
      setLoadingAds(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'ads') fetchAds();
  }, [activeTab]);

  const fetchLinks = useCallback(async () => {
    setLinksLoading(true);
    try {
      const res = await apiRequest('GET', '/api/app-settings');
      const data = await res.json();
      setLiveUrl(data.live_url || '');
      setSchematicsUrl(data.schematics_url || '');
      setWebToolsUrl(data.web_tools_url || '');
      setWhatsappSupportUrl(data.whatsapp_support_link || '');
    } catch (err) {
      console.warn('Failed to fetch links:', err);
    } finally {
      setLinksLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'links') fetchLinks();
  }, [activeTab]);

  const fetchDeviceSettings = useCallback(async () => {
    setDeviceSettingsLoading(true);
    try {
      const res = await apiRequest('GET', '/api/app-settings');
      const data = await res.json();
      setDeviceLockEnabled(data.device_lock_enabled === 'true');
      setDeviceLockPrice(data.device_lock_price || '100');
    } catch (err) {
      console.warn('Failed to fetch device settings:', err);
    } finally {
      setDeviceSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'device') fetchDeviceSettings();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'notifications') fetchPushStats();
  }, [activeTab]);

  const fetchRevenue = useCallback(async () => {
    setRevenueLoading(true);
    try {
      const res = await apiRequest('GET', '/api/admin/revenue');
      const data = await res.json();
      if (data.success) setRevenueData(data);
    } catch (err) {
      console.warn('Failed to fetch revenue:', err);
    } finally {
      setRevenueLoading(false);
    }
  }, []);

  const fetchActiveSubscriptions = useCallback(async () => {
    setActiveSubsLoading(true);
    try {
      const res = await apiRequest('GET', '/api/admin/active-subscriptions');
      const data = await res.json();
      if (Array.isArray(data)) setActiveSubsList(data);
    } catch (err) {
      console.warn('Failed to fetch active subscriptions:', err);
    } finally {
      setActiveSubsLoading(false);
    }
  }, []);


  useEffect(() => {
    if (activeTab === 'revenue') {
      fetchRevenue();
      fetchActiveSubscriptions();
    }
  }, [activeTab, fetchRevenue, fetchActiveSubscriptions]);

  useEffect(() => {
    if (activeTab === 'subscriptions') fetchActiveSubscriptions();
  }, [activeTab, fetchActiveSubscriptions]);

  const fetchEmailStats = useCallback(async () => {
    setEmailStatsLoading(true);
    try {
      const res = await apiRequest('GET', '/api/admin/email-stats');
      const data = await res.json();
      if (data.success) {
        setEmailStats(data.stats);
        setEmailCampaignList(data.campaigns || []);
      }
    } catch (e) {
      console.error('[Admin] email-stats error:', e);
    } finally {
      setEmailStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'email') fetchEmailStats();
  }, [activeTab, fetchEmailStats]);

  const fetchReviews = useCallback(async () => {
    setReviewsLoading(true);
    try {
      const res = await apiRequest('GET', '/api/admin/reviews');
      const data = await res.json();
      if (Array.isArray(data)) setReviewsList(data);
    } catch (err) {
      console.warn('Failed to fetch reviews:', err);
    } finally {
      setReviewsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'reviews') fetchReviews();
  }, [activeTab, fetchReviews]);

  const fetchInsurance = useCallback(async () => {
    setInsuranceLoading(true);
    try {
      const [plansRes, policiesRes] = await Promise.all([
        apiRequest('GET', '/api/admin/insurance/plans'),
        apiRequest('GET', '/api/admin/insurance/policies'),
      ]);
      const plansData = await plansRes.json();
      const policiesData = await policiesRes.json();
      if (plansData.plans) setInsurancePlansAdmin(plansData.plans);
      if (policiesData.policies) setInsurancePoliciesAdmin(policiesData.policies);
    } catch (err) {
      console.warn('Failed to fetch insurance:', err);
    } finally {
      setInsuranceLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'insurance') fetchInsurance();
  }, [activeTab, fetchInsurance]);

  const fetchDiagnostics = useCallback(async () => {
    setDiagnosticsLoading(true);
    try {
      const res = await apiRequest('GET', '/api/admin/diagnostics');
      const data = await res.json();
      if (data.diagnostics) setDiagnosticsList(data.diagnostics);
    } catch {}
    setDiagnosticsLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'diagnostics') fetchDiagnostics();
  }, [activeTab, fetchDiagnostics]);

  const renderDiagnostics = () => {
    const avgScore = diagnosticsList.length > 0
      ? Math.round(diagnosticsList.reduce((s, d) => s + (d.overallScore || 0), 0) / diagnosticsList.length)
      : 0;
    const withIssues = diagnosticsList.filter(d => {
      try { return JSON.parse(d.issues || '[]').length > 0; } catch { return false; }
    }).length;

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          <View style={[styles.statCard, { flex: 1, borderLeftColor: '#6C63FF' }]}>
            <Ionicons name="pulse" size={22} color="#6C63FF" />
            <Text style={styles.statNumber}>{diagnosticsList.length}</Text>
            <Text style={styles.statLabel}>Total Scans</Text>
          </View>
          <View style={[styles.statCard, { flex: 1, borderLeftColor: '#34C759' }]}>
            <Ionicons name="heart" size={22} color="#34C759" />
            <Text style={styles.statNumber}>{avgScore}</Text>
            <Text style={styles.statLabel}>Avg Score</Text>
          </View>
          <View style={[styles.statCard, { flex: 1, borderLeftColor: '#FF9500' }]}>
            <Ionicons name="warning" size={22} color="#FF9500" />
            <Text style={styles.statNumber}>{withIssues}</Text>
            <Text style={styles.statLabel}>With Issues</Text>
          </View>
        </View>
        {diagnosticsLoading ? (
          <View style={styles.emptyState}><ActivityIndicator size="small" color="#6C63FF" /></View>
        ) : diagnosticsList.length === 0 ? (
          <View style={styles.emptyState}><Text style={styles.emptyText}>No scans yet</Text></View>
        ) : (
          diagnosticsList.map((diag: any) => {
            const score = diag.overallScore || 0;
            const scoreColor = score >= 80 ? '#34C759' : score >= 50 ? '#FF9500' : '#FF3B30';
            let issueArr: string[] = [];
            try { issueArr = JSON.parse(diag.issues || '[]'); } catch {}
            return (
              <View key={diag.id} style={[styles.sectionCard, { marginBottom: 10 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: C.text }}>{diag.userName || 'User'}</Text>
                    <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 2 }}>
                      {diag.deviceModel || 'Unknown device'} · {diag.platform || ''}
                    </Text>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textTertiary, marginTop: 2 }}>
                      {diag.createdAt ? new Date(diag.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'center', backgroundColor: scoreColor + '20', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 }}>
                    <Text style={{ fontSize: 18, fontFamily: 'Inter_700Bold', color: scoreColor }}>{score}</Text>
                    <Text style={{ fontSize: 9, fontFamily: 'Inter_400Regular', color: scoreColor }}>/ 100</Text>
                  </View>
                </View>
                {issueArr.length > 0 && (
                  <View style={{ marginTop: 8, gap: 4 }}>
                    {issueArr.map((issue: string, i: number) => (
                      <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                        <Ionicons name="warning-outline" size={12} color="#FF9500" style={{ marginTop: 2 }} />
                        <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, flex: 1 }}>{issue}</Text>
                      </View>
                    ))}
                  </View>
                )}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Battery', value: diag.batteryLevel + '%' },
                    { label: 'Storage', value: diag.storageUsed + '/' + diag.storageTotal },
                    { label: 'Network', value: diag.networkType },
                  ].map((item, i) => (
                    <View key={i} style={{ backgroundColor: C.background, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                      <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: C.textTertiary }}>{item.label}</Text>
                      <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.text }}>{item.value || '—'}</Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    );
  };

  const handleDeleteReview = (reviewId: string) => {
    Alert.alert(
      'Delete Review',
      'Are you sure you want to delete this review? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiRequest('DELETE', `/api/admin/reviews/${reviewId}`);
              fetchReviews();
            } catch (err) {
              Alert.alert('Error', 'Failed to delete review');
            }
          },
        },
      ]
    );
  };

  const renderReviews = () => {
    const totalReviews = reviewsList.length;
    const avgRating = totalReviews > 0
      ? (reviewsList.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / totalReviews).toFixed(1)
      : '0.0';

    const renderStars = (rating: number) => {
      const stars = [];
      for (let i = 1; i <= 5; i++) {
        stars.push(
          <Ionicons
            key={i}
            name={i <= rating ? 'star' : i - 0.5 <= rating ? 'star-half' : 'star-outline'}
            size={14}
            color="#FFD60A"
          />
        );
      }
      return <View style={{ flexDirection: 'row', gap: 2 }}>{stars}</View>;
    };

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          <View style={[styles.statCard, { flex: 1, borderLeftColor: '#FFD60A' }]}>
            <Ionicons name="star" size={22} color="#FFD60A" />
            <Text style={styles.statNumber}>{totalReviews}</Text>
            <Text style={styles.statLabel}>Total Reviews</Text>
          </View>
          <View style={[styles.statCard, { flex: 1, borderLeftColor: '#FF6B2C' }]}>
            <Ionicons name="star-half" size={22} color="#FF6B2C" />
            <Text style={styles.statNumber}>{avgRating}</Text>
            <Text style={styles.statLabel}>Avg Rating</Text>
          </View>
        </View>

        {reviewsLoading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="small" color={C.primary} />
            <Text style={[styles.emptyText, { marginTop: 8 }]}>Loading reviews...</Text>
          </View>
        ) : reviewsList.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No reviews yet</Text>
          </View>
        ) : (
          reviewsList.map((review: any) => (
            <View key={review.id} style={[styles.sectionCard, { marginBottom: 10 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>
                    {review.reviewerName || 'Unknown User'}
                  </Text>
                  <Text style={{ color: C.textTertiary, fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 }}>
                    Reviewed user: {review.revieweeId || 'N/A'}
                  </Text>
                </View>
                <Pressable hitSlop={12} onPress={() => handleDeleteReview(review.id)}>
                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                {renderStars(review.rating || 0)}
                <Text style={{ color: C.textSecondary, fontSize: 12, fontFamily: 'Inter_500Medium' }}>
                  {review.rating || 0}/5
                </Text>
              </View>
              {review.comment ? (
                <Text style={{ color: C.text, fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 8, lineHeight: 18 }}>
                  {review.comment}
                </Text>
              ) : null}
              <Text style={{ color: C.textTertiary, fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 8 }}>
                {review.createdAt ? new Date(review.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Unknown date'}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    );
  };

  const renderInsurance = () => {
    const handleTogglePlan = async (plan: any) => {
      try {
        await apiRequest('PUT', `/api/admin/insurance/plans/${plan.id}`, {
          ...plan,
          isActive: plan.isActive === 1 ? 0 : 1,
        });
        await fetchInsurance();
      } catch {
        Alert.alert('Error', 'Failed to update plan');
      }
    };
    const handleDeletePlan = (planId: string, planName: string) => {
      Alert.alert('Delete Plan', `Delete "${planName}"? This cannot be undone.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await apiRequest('DELETE', `/api/admin/insurance/plans/${planId}`);
            await fetchInsurance();
          } catch { Alert.alert('Error', 'Failed to delete plan'); }
        }},
      ]);
    };
    const handleSaveNewPlan = async () => {
      if (!newPlan.name.trim()) {
        Alert.alert('Error', 'Plan name required');
        return;
      }
      setInsuranceLoading(true);
      try {
        const coverageArr = newPlan.coverage.split('\n').map(s => s.trim()).filter(Boolean);
        const res = await apiRequest('POST', '/api/admin/insurance/plans', {
          name: newPlan.name.trim(),
          price: parseInt(newPlan.price) || 30,
          repairDiscount: parseInt(newPlan.repairDiscount) || 500,
          coverage: coverageArr,
          isActive: 1,
          sortOrder: insurancePlansAdmin?.length || 0,
        });
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to create plan');
        }

        const data = await res.json();
        if (data.success) {
          Alert.alert('Success', 'Plan created successfully');
          setNewPlan({
            name: '',
            price: '30',
            repairDiscount: '500',
            coverage: ''
          });
          setShowNewPlan(false);
          await fetchInsurance();
        } else {
          Alert.alert('Error', data.message || 'Failed to create plan');
        }
      } catch (err: any) {
        console.error('[Admin] Create plan error:', err);
        Alert.alert('Error', err?.message || 'Connection failed');
      } finally {
        setInsuranceLoading(false);
      }
    };
    const handleUpdateClaimStatus = async (policyId: string, status: string) => {
      try {
        await apiRequest('PUT', `/api/admin/insurance/claims/${policyId}`, { claimStatus: status });
        await fetchInsurance();
      } catch { Alert.alert('Error', 'Failed to update claim'); }
    };

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          <View style={[styles.statCard, { flex: 1, borderLeftColor: '#5856D6' }]}>
            <Ionicons name="shield-checkmark" size={22} color="#5856D6" />
            <Text style={styles.statNumber}>{insurancePlansAdmin.filter(p => p.isActive === 1).length}</Text>
            <Text style={styles.statLabel}>Active Plans</Text>
          </View>
          <View style={[styles.statCard, { flex: 1, borderLeftColor: '#34C759' }]}>
            <Ionicons name="people" size={22} color="#34C759" />
            <Text style={styles.statNumber}>{insurancePoliciesAdmin.filter(p => p.status === 'active').length}</Text>
            <Text style={styles.statLabel}>Active Policies</Text>
          </View>
          <View style={[styles.statCard, { flex: 1, borderLeftColor: '#FF9500' }]}>
            <Ionicons name="document-text" size={22} color="#FF9500" />
            <Text style={styles.statNumber}>{insurancePoliciesAdmin.filter(p => p.claimStatus === 'pending').length}</Text>
            <Text style={styles.statLabel}>Pending Claims</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          {(['plans', 'policies'] as const).map(tab => (
            <Pressable
              key={tab}
              style={[{ flex: 1, padding: 10, borderRadius: 10, alignItems: 'center' },
                insuranceTab === tab ? { backgroundColor: '#5856D6' } : { backgroundColor: C.surfaceElevated }]}
              onPress={() => setInsuranceTab(tab)}
            >
              <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: insuranceTab === tab ? '#fff' : C.textSecondary }}>
                {tab === 'plans' ? 'Plans' : 'Policies & Claims'}
              </Text>
            </Pressable>
          ))}
        </View>

        {insuranceLoading ? (
          <View style={styles.emptyState}><ActivityIndicator size="small" color="#5856D6" /></View>
        ) : insuranceTab === 'plans' ? (
          <>
            <Pressable
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#5856D6', borderRadius: 12, padding: 12, marginBottom: 16 }}
              onPress={() => setShowNewPlan(!showNewPlan)}
            >
              <Ionicons name={showNewPlan ? 'close' : 'add'} size={20} color="#fff" />
              <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#fff' }}>
                {showNewPlan ? 'Cancel' : 'Add New Plan'}
              </Text>
            </Pressable>
            {showNewPlan && (
              <View style={[styles.sectionCard, { marginBottom: 16 }]}>
                <Text style={{ fontSize: 15, fontFamily: 'Inter_700Bold', color: C.text, marginBottom: 12 }}>New Plan</Text>
                {[
                  { label: 'Plan Name', key: 'name', placeholder: 'e.g. Basic Plan' },
                  { label: 'Price (₹/month)', key: 'price', placeholder: '30' },
                  { label: 'Repair Discount (₹)', key: 'repairDiscount', placeholder: '500' },
                ].map(field => (
                  <View key={field.key} style={{ marginBottom: 10 }}>
                    <Text style={{ fontSize: 12, fontFamily: 'Inter_500Medium', color: C.textSecondary, marginBottom: 4 }}>{field.label}</Text>
                    <TextInput
                      style={[styles.input, { color: C.text }]}
                      placeholder={field.placeholder}
                      placeholderTextColor={C.textTertiary}
                      value={(newPlan as any)[field.key]}
                      onChangeText={v => setNewPlan(p => ({ ...p, [field.key]: v }))}
                      keyboardType={field.key === 'name' ? 'default' : 'numeric'}
                    />
                  </View>
                ))}
                <Text style={{ fontSize: 12, fontFamily: 'Inter_500Medium', color: C.textSecondary, marginBottom: 4 }}>Coverage (one per line)</Text>
                <TextInput
                  style={[styles.input, { color: C.text, minHeight: 80, textAlignVertical: 'top' }]}
                  placeholder={"Accidental damage\nScreen repair\nWater damage"}
                  placeholderTextColor={C.textTertiary}
                  value={newPlan.coverage}
                  onChangeText={v => setNewPlan(p => ({ ...p, coverage: v }))}
                  multiline
                />
                <Pressable 
                  style={({ pressed }) => [{ backgroundColor: '#5856D6', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 12 }, pressed && { opacity: 0.8 }]} 
                  onPress={handleSaveNewPlan}
                  disabled={insuranceLoading}
                >
                  {insuranceLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: '#fff' }}>Create Plan</Text>
                  )}
                </Pressable>
              </View>
            )}
            {insurancePlansAdmin.length === 0 ? (
              <View style={styles.emptyState}><Text style={styles.emptyText}>No plans yet</Text></View>
            ) : (
              insurancePlansAdmin.map(plan => {
                const coverage = (() => { try { return JSON.parse(plan.coverage || '[]'); } catch { return []; } })();
                return (
                  <View key={plan.id} style={[styles.sectionCard, { marginBottom: 10 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontFamily: 'Inter_700Bold', color: C.text }}>{plan.name}</Text>
                        <Text style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: '#5856D6', marginTop: 2 }}>₹{plan.price}/month</Text>
                        <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: '#34C759', marginTop: 2 }}>₹{plan.repairDiscount} discount</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Switch
                          value={plan.isActive === 1}
                          onValueChange={() => handleTogglePlan(plan)}
                          trackColor={{ true: '#5856D6', false: C.border }}
                          thumbColor="#fff"
                        />
                        <Pressable hitSlop={12} onPress={() => handleDeletePlan(plan.id, plan.name)}>
                          <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                        </Pressable>
                      </View>
                    </View>
                    {coverage.length > 0 && (
                      <View style={{ marginTop: 8, gap: 4 }}>
                        {coverage.map((item: string, i: number) => (
                          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="checkmark-circle" size={14} color="#34C759" />
                            <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary }}>{item}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </>
        ) : (
          insurancePoliciesAdmin.length === 0 ? (
            <View style={styles.emptyState}><Text style={styles.emptyText}>No policies yet</Text></View>
          ) : (
            insurancePoliciesAdmin.map(policy => (
              <View key={policy.id} style={[styles.sectionCard, { marginBottom: 10 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: C.text }}>{policy.userName || 'User'}</Text>
                    <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 2 }}>{policy.planName} — ₹{policy.planPrice}/mo</Text>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textTertiary, marginTop: 2 }}>
                      Expires: {policy.endDate ? new Date(policy.endDate).toLocaleDateString('en-IN') : '—'}
                    </Text>
                  </View>
                  <View style={[{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
                    policy.status === 'active' ? { backgroundColor: '#34C75920' } : { backgroundColor: '#FF3B3020' }
                  ]}>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: policy.status === 'active' ? '#34C759' : '#FF3B30' }}>
                      {policy.status}
                    </Text>
                  </View>
                </View>
                {policy.claimStatus && policy.claimStatus !== 'none' && (
                  <View style={{ marginTop: 10, backgroundColor: C.background, borderRadius: 10, padding: 10 }}>
                    <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.text, marginBottom: 4 }}>
                      Claim: <Text style={{ color: policy.claimStatus === 'pending' ? '#FF9500' : policy.claimStatus === 'approved' ? '#34C759' : '#FF3B30' }}>
                        {policy.claimStatus}
                      </Text>
                    </Text>
                    {policy.claimDescription ? (
                      <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginBottom: 8 }}>{policy.claimDescription}</Text>
                    ) : null}
                    {policy.claimStatus === 'pending' && (
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Pressable
                          style={{ flex: 1, backgroundColor: '#34C759', borderRadius: 8, padding: 8, alignItems: 'center' }}
                          onPress={() => handleUpdateClaimStatus(policy.id, 'approved')}
                        >
                          <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#fff' }}>Approve</Text>
                        </Pressable>
                        <Pressable
                          style={{ flex: 1, backgroundColor: '#FF3B30', borderRadius: 8, padding: 8, alignItems: 'center' }}
                          onPress={() => handleUpdateClaimStatus(policy.id, 'rejected')}
                        >
                          <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#fff' }}>Reject</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                )}
              </View>
            ))
          )
        )}
      </ScrollView>
    );
  };

  const pickAdImage = async () => {
    const { launchImageLibraryAsync, MediaTypeOptions } = await import('expo-image-picker');
    const result = await launchImageLibraryAsync({ mediaTypes: MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setAdImage(result.assets[0].uri);
    }
  };

  const createAd = async () => {
    if (!adTitle.trim() && !adImage) {
      Alert.alert('Error', 'Please add a title or image for the ad');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('title', adTitle.trim());
      formData.append('linkUrl', adLinkUrl.trim());
      if (adImage) {
        const ext = adImage.split('.').pop() || 'jpg';
        formData.append('image', { uri: adImage, name: `ad.${ext}`, type: `image/${ext}` } as any);
      }
      const { getApiUrl } = await import('@/lib/query-client');
      await fetch(`${getApiUrl()}/api/ads`, { method: 'POST', body: formData });
      setAdTitle('');
      setAdLinkUrl('');
      setAdImage(null);
      fetchAds();
      Alert.alert('Success', 'Ad created successfully');
    } catch (err) {
      Alert.alert('Error', 'Failed to create ad');
    }
  };

  const toggleAd = async (id: string, currentActive: number) => {
    try {
      const formData = new FormData();
      formData.append('isActive', String(currentActive === 1 ? 0 : 1));
      const { getApiUrl } = await import('@/lib/query-client');
      await fetch(`${getApiUrl()}/api/ads/${id}`, { method: 'PATCH', body: formData });
      fetchAds();
    } catch (err) {
      console.warn('Failed to toggle ad:', err);
    }
  };

  const deleteAd = (id: string) => {
    Alert.alert('Delete Ad', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await apiRequest('DELETE', `/api/ads/${id}`);
          fetchAds();
        } catch (err) {
          Alert.alert('Error', 'Failed to delete ad');
        }
      }},
    ]);
  };

  const toggleSubscription = async (role: string, enabled: boolean) => {
    try {
      await apiRequest('PATCH', `/api/subscription-settings/${role}`, { enabled: enabled ? 1 : 0 });
      setSubscriptions(prev => prev.map(s => s.role === role ? { ...s, enabled: enabled ? 1 : 0 } : s));
    } catch (e) {
      Alert.alert('Error', 'Failed to update subscription setting.');
    }
  };

  const updateSubAmount = async (role: string, amount: string) => {
    try {
      await apiRequest('PATCH', `/api/subscription-settings/${role}`, { amount });
      setSubscriptions(prev => prev.map(s => s.role === role ? { ...s, amount } : s));
    } catch (e) {
      Alert.alert('Error', 'Failed to update amount.');
    }
  };

  const allUsers = useMemo(() => {
    const userMap = new Map<string, any>();

    if (allProfiles) {
      allProfiles.forEach(p => {
        userMap.set(p.id, {
          id: p.id,
          name: p.name,
          role: p.role as UserRole,
          city: p.city || '',
          postCount: 0,
          isRegistered: true,
          fullProfile: p,
        });
      });
    }

    if (posts) {
      posts.forEach(p => {
        if (!userMap.has(p.userId)) {
          userMap.set(p.userId, { id: p.userId, name: p.userName, role: p.userRole, city: '', postCount: 0, isRegistered: false, fullProfile: null });
        }
        const user = userMap.get(p.userId)!;
        user.postCount += 1;
      });
    }

    return Array.from(userMap.values());
  }, [allProfiles, posts]);

  const filteredUsers = useMemo(() => {
    let users = allUsers;
    if (userRoleFilter !== 'all') {
      users = users.filter(u => u.role === userRoleFilter);
    }
    if (userSearchQuery.trim()) {
      const q = userSearchQuery.trim().toLowerCase();
      users = users.filter(u =>
        (u.name || '').toLowerCase().includes(q) ||
        (u.fullProfile?.phone || '').includes(q) ||
        (u.city || '').toLowerCase().includes(q)
      );
    }
    return users;
  }, [allUsers, userSearchQuery, userRoleFilter]);

  const stats = useMemo(() => {
    const totalUsers = allUsers.length;
    const registeredUsers = allUsers.filter(u => u.isRegistered).length;
    const totalPosts = posts?.length || 0;
    const totalJobs = jobs?.length || 0;
    const totalChats = conversations?.length || 0;
    const totalLikes = posts?.reduce((sum, p) => sum + (p.likes?.length || 0), 0) || 0;
    const totalComments = posts?.reduce((sum, p) => sum + (p.comments?.length || 0), 0) || 0;
    const roleBreakdown = {
      technician: allUsers.filter(u => u.role === 'technician').length,
      teacher: allUsers.filter(u => u.role === 'teacher').length,
      supplier: allUsers.filter(u => u.role === 'supplier').length,
      job_provider: allUsers.filter(u => u.role === 'job_provider').length,
    };
    return { totalUsers, registeredUsers, totalPosts, totalJobs, totalChats, totalLikes, totalComments, roleBreakdown };
  }, [allUsers, posts, jobs, conversations]);

  if (!isAdmin) return null;

  const tabs: { key: AdminTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: 'grid' },
    { key: 'users', label: 'Users', icon: 'people' },
    { key: 'subscriptions', label: 'Subs', icon: 'card' },
    { key: 'revenue', label: 'Revenue', icon: 'trending-up' },
    { key: 'posts', label: 'Posts', icon: 'newspaper' },
    { key: 'jobs', label: 'Jobs', icon: 'briefcase' },
    { key: 'ads', label: 'Ads', icon: 'megaphone' },
    { key: 'links', label: 'Links', icon: 'link' },
    { key: 'device', label: 'Device', icon: 'phone-portrait' },
    { key: 'notifications', label: 'Notify', icon: 'notifications' },
    { key: 'email', label: 'Email', icon: 'mail' },
    { key: 'security', label: 'Security', icon: 'shield' },
    { key: 'reviews', label: 'Reviews', icon: 'star-half-outline' },
    { key: 'insurance', label: 'Insurance', icon: 'shield-checkmark-outline' },
    { key: 'diagnostics', label: 'Scans', icon: 'pulse-outline' },
  ];

  const handleDeletePost = (postId: string, userName: string) => {
    Alert.alert(
      'Delete Post',
      `Delete post by ${userName}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deletePost(postId) },
      ]
    );
  };

  const executeBlockUser = async (userId: string, userName: string, block: boolean) => {
    try {
      const res = await apiRequest('POST', '/api/admin/block-user', { userId, blocked: block });
      const data = await res.json();
      if (data.success) {
        Alert.alert('Success', `${userName} has been ${block ? 'blocked' : 'unblocked'}.`);
        await refreshData();
      } else {
        Alert.alert('Error', data.message || 'Failed to update user.');
      }
    } catch (e: any) {
      console.error('Block user error:', e);
      Alert.alert('Error', 'Failed to update user. Please try again.');
    }
  };

  const executeDeleteUser = async (userId: string, userName: string) => {
    try {
      const res = await apiRequest('POST', '/api/admin/delete-user', { userId });
      const data = await res.json();
      if (data.success) {
        await refreshData();
      } else {
        console.error('Delete user failed:', data.message);
      }
    } catch (e: any) {
      console.error('Delete user error:', e);
    }
  };

  const handleBlockUser = (userId: string, userName: string, block: boolean) => {
    Alert.alert(
      block ? 'Block User' : 'Unblock User',
      block
        ? `Block ${userName}? They won't be able to log in.`
        : `Unblock ${userName}? They will be able to log in again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: block ? 'Block' : 'Unblock',
          style: block ? 'destructive' : 'default',
          onPress: () => executeBlockUser(userId, userName, block),
        },
      ]
    );
  };

  const handleDeleteUser = (userId: string, userName: string) => {
    executeDeleteUser(userId, userName);
  };

  const downloadUsersCSV = () => {
    const url = `${getApiUrl()}/api/admin/export-users`;
    openLink(url, 'Export');
  };

  const renderDashboard = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.dashboardContent}>
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { borderLeftColor: C.primary }]}>
          <Ionicons name="people" size={24} color={C.primary} />
          <Text style={styles.statNumber}>{stats.totalUsers}</Text>
          <Text style={styles.statLabel}>Total Users</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: '#34C759' }]}>
          <Ionicons name="person-add" size={24} color="#34C759" />
          <Text style={styles.statNumber}>{stats.registeredUsers}</Text>
          <Text style={styles.statLabel}>Registered</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: '#5E8BFF' }]}>
          <Ionicons name="newspaper" size={24} color="#5E8BFF" />
          <Text style={styles.statNumber}>{stats.totalPosts}</Text>
          <Text style={styles.statLabel}>Total Posts</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: '#FFD60A' }]}>
          <Ionicons name="briefcase" size={24} color="#FFD60A" />
          <Text style={styles.statNumber}>{stats.totalJobs}</Text>
          <Text style={styles.statLabel}>Job Listings</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: '#FF6B2C' }]}>
          <Ionicons name="chatbubbles" size={24} color="#FF6B2C" />
          <Text style={styles.statNumber}>{stats.totalChats}</Text>
          <Text style={styles.statLabel}>Conversations</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: '#FF3B30' }]}>
          <Ionicons name="heart" size={24} color="#FF3B30" />
          <Text style={styles.statNumber}>{stats.totalLikes}</Text>
          <Text style={styles.statLabel}>Total Likes</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Users by Role</Text>
        {(Object.entries(stats.roleBreakdown) as [UserRole, number][]).map(([role, count]) => (
          <View key={role} style={styles.roleRow}>
            <View style={styles.roleRowLeft}>
              <View style={[styles.roleDot, { backgroundColor: ROLE_COLORS[role] }]} />
              <Text style={styles.roleLabelText}>{ROLE_LABELS[role]}</Text>
            </View>
            <View style={styles.roleBarContainer}>
              <View style={[styles.roleBar, { width: `${Math.max((count / Math.max(stats.totalUsers, 1)) * 100, 8)}%`, backgroundColor: ROLE_COLORS[role] }]} />
            </View>
            <Text style={styles.roleCount}>{count}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Activity Summary</Text>
        <View style={styles.activityRow}>
          <Text style={styles.activityLabel}>Comments</Text>
          <Text style={styles.activityValue}>{stats.totalComments}</Text>
        </View>
        <View style={styles.activityRow}>
          <Text style={styles.activityLabel}>Avg Likes/Post</Text>
          <Text style={styles.activityValue}>{stats.totalPosts > 0 ? (stats.totalLikes / stats.totalPosts).toFixed(1) : '0'}</Text>
        </View>
        <View style={styles.activityRow}>
          <Text style={styles.activityLabel}>Most Active Role</Text>
          <Text style={styles.activityValue}>
            {ROLE_LABELS[Object.entries(stats.roleBreakdown).sort((a, b) => b[1] - a[1])[0]?.[0] as UserRole || 'technician']}
          </Text>
        </View>
      </View>
    </ScrollView>
  );

  const USER_ROLE_FILTERS: { key: 'all' | UserRole; label: string; color: string }[] = [
    { key: 'all', label: 'All', color: '#007AFF' },
    { key: 'technician', label: 'Techs', color: '#34C759' },
    { key: 'teacher', label: 'Teachers', color: '#FFD60A' },
    { key: 'supplier', label: 'Suppliers', color: '#FF6B2C' },
    { key: 'job_provider', label: 'Jobs', color: '#5E8BFF' },
    { key: 'customer', label: 'Customers', color: '#FF2D55' },
  ];

  const renderUsers = () => (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: C.border }}>
          <Ionicons name="search" size={16} color={C.textMuted} />
          <TextInput
            value={userSearchQuery}
            onChangeText={setUserSearchQuery}
            placeholder="Search by name, phone, city..."
            placeholderTextColor={C.textMuted}
            style={{ flex: 1, color: C.text, paddingVertical: 10, paddingHorizontal: 8, fontFamily: 'Inter_400Regular', fontSize: 14 }}
            clearButtonMode="while-editing"
          />
          {userSearchQuery.length > 0 && (
            <Pressable onPress={() => setUserSearchQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={C.textMuted} />
            </Pressable>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 6, paddingBottom: 2 }}>
          {USER_ROLE_FILTERS.map(f => {
            const active = userRoleFilter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setUserRoleFilter(f.key)}
                style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: active ? f.color : C.card, borderWidth: 1, borderColor: active ? f.color : C.border }}
              >
                <Text style={{ color: active ? '#fff' : C.textMuted, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: C.textMuted, fontSize: 12, fontFamily: 'Inter_400Regular' }}>
            {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
            {userRoleFilter !== 'all' ? ` · ${USER_ROLE_FILTERS.find(f => f.key === userRoleFilter)?.label}` : ''}
            {userSearchQuery ? ` · "${userSearchQuery}"` : ''}
          </Text>
          <Pressable
            onPress={downloadUsersCSV}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#1C3A57', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: '#2A5080' }}
          >
            <Ionicons name="download-outline" size={14} color="#5E8BFF" />
            <Text style={{ color: '#5E8BFF', fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>Download All ({allUsers.length})</Text>
          </Pressable>
        </View>
      </View>
      <FlatList
        data={filteredUsers}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === 'web' ? 34 : 40, paddingHorizontal: 12 }}
        renderItem={({ item }) => <UserDetailCard user={item} onBlock={handleBlockUser} onDelete={handleDeleteUser} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{userSearchQuery || userRoleFilter !== 'all' ? 'No users match your search' : 'No users found'}</Text>
          </View>
        }
      />
    </View>
  );

  const renderRevenue = () => {
    const rd = revenueData;
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, paddingTop: 4 }}>
        {revenueLoading && !rd ? (
          <View style={{ paddingTop: 40, alignItems: 'center' }}>
            <Text style={styles.emptyText}>Loading revenue data...</Text>
          </View>
        ) : rd ? (
          <>
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { borderLeftColor: '#34C759', width: '100%' }]}>
                <Ionicons name="trending-up" size={24} color="#34C759" />
                <Text style={styles.statNumber}>₹{rd.totalRevenue?.toLocaleString('en-IN', { maximumFractionDigits: 0 }) || '0'}</Text>
                <Text style={styles.statLabel}>Total Platform Revenue</Text>
              </View>
              <View style={[styles.statCard, { borderLeftColor: '#5E8BFF' }]}>
                <Ionicons name="card" size={22} color="#5E8BFF" />
                <Text style={styles.statNumber}>₹{rd.subscriptionRevenue?.toLocaleString('en-IN', { maximumFractionDigits: 0 }) || '0'}</Text>
                <Text style={styles.statLabel}>Subscription Revenue</Text>
              </View>
              <View style={[styles.statCard, { borderLeftColor: '#FFD60A' }]}>
                <Ionicons name="school" size={22} color="#FFD60A" />
                <Text style={styles.statNumber}>₹{rd.platformCourseRevenue?.toLocaleString('en-IN', { maximumFractionDigits: 0 }) || '0'}</Text>
                <Text style={styles.statLabel}>Course Revenue</Text>
              </View>
              <View style={[styles.statCard, { borderLeftColor: '#FF6B2C' }]}>
                <Ionicons name="people" size={22} color="#FF6B2C" />
                <Text style={styles.statNumber}>{rd.activeSubscribers || 0}</Text>
                <Text style={styles.statLabel}>Active Subscribers</Text>
              </View>
              <View style={[styles.statCard, { borderLeftColor: '#FF2D55' }]}>
                <Ionicons name="play-circle" size={22} color="#FF2D55" />
                <Text style={styles.statNumber}>{rd.totalEnrollments || 0}</Text>
                <Text style={styles.statLabel}>Paid Enrollments</Text>
              </View>
              <View style={[styles.statCard, { borderLeftColor: '#34C759' }]}>
                <Ionicons name="gift" size={22} color="#34C759" />
                <Text style={styles.statNumber}>{rd.freeEnrollments || 0}</Text>
                <Text style={styles.statLabel}>Free Enrollments</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Subscription Revenue by Role</Text>
              {[
                { role: 'technician', label: 'Technicians', color: '#34C759' },
                { role: 'teacher', label: 'Teachers', color: '#FFD60A' },
                { role: 'supplier', label: 'Suppliers', color: '#FF6B2C' },
                { role: 'customer', label: 'Customers', color: '#FF2D55' },
              ].map(({ role, label, color }) => {
                const count = rd.activeSubscribersByRole?.[role] || 0;
                const rev = rd.subscriptionRevenueByRole?.[role] || 0;
                return (
                  <View key={role} style={styles.activityRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
                      <Text style={styles.activityLabel}>{label} ({count} active)</Text>
                    </View>
                    <Text style={[styles.activityValue, { color }]}>₹{rev.toLocaleString('en-IN')}</Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Course Stats</Text>
              <View style={styles.activityRow}>
                <Text style={styles.activityLabel}>Total Courses</Text>
                <Text style={styles.activityValue}>{rd.courseCount || 0}</Text>
              </View>
              <View style={styles.activityRow}>
                <Text style={styles.activityLabel}>Published Courses</Text>
                <Text style={styles.activityValue}>{rd.publishedCourses || 0}</Text>
              </View>
              <View style={styles.activityRow}>
                <Text style={styles.activityLabel}>Total Course Revenue</Text>
                <Text style={styles.activityValue}>₹{rd.courseRevenue?.toLocaleString('en-IN', { maximumFractionDigits: 0 }) || '0'}</Text>
              </View>
              <View style={[styles.activityRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.activityLabel}>Total Payments</Text>
                <Text style={styles.activityValue}>{rd.totalPayments || 0}</Text>
              </View>
            </View>

            {rd.teacherRevenue?.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Top Teacher Earnings</Text>
                {rd.teacherRevenue.map((t: any, i: number) => (
                  <View key={t.teacherId} style={[styles.activityRow, i === rd.teacherRevenue.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activityLabel}>{t.name || 'Unknown Teacher'}</Text>
                      <Text style={{ color: C.textTertiary, fontSize: 11, fontFamily: 'Inter_400Regular' }}>
                        {t.enrollments} enrollments · {t.courseCount} courses
                      </Text>
                    </View>
                    <Text style={[styles.activityValue, { color: '#FFD60A' }]}>₹{t.amount?.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={{ marginBottom: 12 }}>
              <Text style={{ color: C.textTertiary, fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center' }}>
                Active Subscribers List → go to Subs tab
              </Text>
            </View>
          </>
        ) : (
          <View style={{ paddingTop: 40, alignItems: 'center' }}>
            <Text style={styles.emptyText}>No revenue data available</Text>
          </View>
        )}
      </ScrollView>
    );
  };

  const renderSubscriptions = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.subHeading}>Control subscription settings for each role</Text>
      {(['technician', 'teacher', 'supplier', 'customer'] as const).map(role => {
        const sub = subscriptions.find(s => s.role === role);
        const enabled = sub?.enabled === 1;
        const amount = sub?.amount || '0';
        const roleColor = ROLE_COLORS[role] || '#007AFF';
        const iconName = role === 'technician' ? 'construct' : role === 'teacher' ? 'school' : role === 'customer' ? 'person' : 'cube';
        return (
          <View key={role} style={[styles.subCard, { borderLeftColor: roleColor, borderLeftWidth: 3 }]}>
            <View style={styles.subCardHeader}>
              <View style={styles.subCardLeft}>
                <View style={[styles.subRoleIcon, { backgroundColor: roleColor + '20' }]}>
                  <Ionicons name={iconName as any} size={20} color={roleColor} />
                </View>
                <Text style={styles.subRoleName}>{ROLE_LABELS[role] || 'Customer'}</Text>
              </View>
              <Switch
                value={enabled}
                onValueChange={(val) => toggleSubscription(role, val)}
                trackColor={{ false: C.surfaceElevated, true: roleColor + '60' }}
                thumbColor={enabled ? roleColor : C.textTertiary}
              />
            </View>
            {enabled && (
              <View style={styles.subAmountRow}>
                <Text style={styles.subAmountLabel}>Monthly Amount (₹)</Text>
                <TextInput
                  style={styles.subAmountInput}
                  value={amount}
                  onChangeText={(val) => {
                    setSubscriptions(prev => prev.map(s => s.role === role ? { ...s, amount: val } : s));
                  }}
                  onBlur={() => updateSubAmount(role, amount)}
                  keyboardType="number-pad"
                  placeholder="99"
                  placeholderTextColor={C.textTertiary}
                />
              </View>
            )}
          </View>
        );
      })}

      <View style={[styles.subCard, { borderLeftColor: '#34C759', borderLeftWidth: 3, marginTop: 8 }]}>
        <View style={[styles.subCardHeader, { marginBottom: 12 }]}>
          <View style={styles.subCardLeft}>
            <View style={[styles.subRoleIcon, { backgroundColor: '#34C75920' }]}>
              <Ionicons name="checkmark-circle" size={20} color="#34C759" />
            </View>
            <View>
              <Text style={styles.subRoleName}>Active Subscribers</Text>
              <Text style={{ color: C.textTertiary, fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 1 }}>
                {activeSubsLoading ? 'Loading...' : `${activeSubsList.length} active`}
              </Text>
            </View>
          </View>
        </View>
        {activeSubsList.length === 0 ? (
          <Text style={{ color: C.textTertiary, fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', paddingVertical: 16 }}>
            {activeSubsLoading ? 'Loading...' : 'No active subscribers'}
          </Text>
        ) : (
          activeSubsList.map((sub, i) => {
            const roleColor = ROLE_COLORS[sub.role as UserRole] || C.textSecondary;
            const daysLeft = sub.subscriptionEnd ? Math.max(0, Math.ceil((sub.subscriptionEnd - Date.now()) / 86400000)) : 0;
            return (
              <View key={sub.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: i < activeSubsList.length - 1 ? 1 : 0, borderBottomColor: C.surfaceElevated }}>
                {sub.avatar ? (
                  <Image source={{ uri: sub.avatar }} style={{ width: 34, height: 34, borderRadius: 17 }} contentFit="cover" />
                ) : (
                  <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: roleColor + '20', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: roleColor, fontSize: 13, fontWeight: '700' }}>{getInitials(sub.name)}</Text>
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={{ color: C.text, fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>{sub.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <View style={{ backgroundColor: roleColor + '20', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                      <Text style={{ color: roleColor, fontSize: 10, fontFamily: 'Inter_500Medium' }}>{ROLE_LABELS[sub.role as UserRole]}</Text>
                    </View>
                    {sub.city ? <Text style={{ color: C.textTertiary, fontSize: 11, fontFamily: 'Inter_400Regular' }}>{sub.city}</Text> : null}
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: daysLeft <= 7 ? '#FF3B30' : '#34C759', fontSize: 11, fontFamily: 'Inter_600SemiBold' }}>
                    {daysLeft}d left
                  </Text>
                  <Text style={{ color: C.textTertiary, fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 1 }}>
                    {sub.phone}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );

  const renderPosts = () => (
    <FlatList
      data={posts}
      keyExtractor={item => item.id}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: Platform.OS === 'web' ? 34 : 40 }}
      renderItem={({ item }) => (
        <View style={styles.postCard}>
          <View style={styles.postHeader}>
            <View style={styles.postHeaderLeft}>
              <Text style={styles.postAuthor}>{item.userName}</Text>
              <Text style={styles.postTime}>{timeAgo(item.createdAt)}</Text>
            </View>
            <Pressable
              hitSlop={12}
              onPress={() => handleDeletePost(item.id, item.userName)}
            >
              <Ionicons name="trash-outline" size={18} color="#FF3B30" />
            </Pressable>
          </View>
          <Text style={styles.postText} numberOfLines={2}>{item.text}</Text>
          <View style={styles.postStats}>
            <View style={styles.postStatItem}>
              <Ionicons name="heart" size={14} color="#FF3B30" />
              <Text style={styles.postStatText}>{item.likes.length}</Text>
            </View>
            <View style={styles.postStatItem}>
              <Ionicons name="chatbubble" size={14} color="#5E8BFF" />
              <Text style={styles.postStatText}>{item.comments.length}</Text>
            </View>
            <View style={[styles.categoryTag, { backgroundColor: C.surfaceElevated }]}>
              <Text style={styles.categoryTagText}>{item.category}</Text>
            </View>
          </View>
        </View>
      )}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No posts yet</Text>
        </View>
      }
    />
  );

  const renderAds = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={[styles.subCard, { marginBottom: 16 }]}>
        <Text style={[styles.subRoleName, { marginBottom: 12 }]}>Create New Ad</Text>
        <TextInput
          style={[styles.subAmountInput, { marginBottom: 10, fontSize: 14 }]}
          placeholder="Ad Title"
          placeholderTextColor={C.textTertiary}
          value={adTitle}
          onChangeText={setAdTitle}
        />
        <TextInput
          style={[styles.subAmountInput, { marginBottom: 10, fontSize: 14 }]}
          placeholder="Link URL (optional)"
          placeholderTextColor={C.textTertiary}
          value={adLinkUrl}
          onChangeText={setAdLinkUrl}
          autoCapitalize="none"
        />
        <Pressable
          style={[styles.tabItem, { marginBottom: 10, justifyContent: 'center' }]}
          onPress={pickAdImage}
        >
          <Ionicons name="image-outline" size={18} color={C.textSecondary} />
          <Text style={styles.tabText}>{adImage ? 'Change Image' : 'Pick Image'}</Text>
        </Pressable>
        {adImage && (
          <Image source={{ uri: adImage }} style={{ width: '100%', height: 150, borderRadius: 10, marginBottom: 10 }} contentFit="cover" />
        )}
        <Pressable
          style={[styles.tabItemActive, { paddingVertical: 12, borderRadius: 10, alignItems: 'center' }]}
          onPress={createAd}
        >
          <Text style={[styles.tabTextActive, { fontSize: 15 }]}>Create Ad</Text>
        </Pressable>
      </View>
      {loadingAds ? (
        <View style={styles.emptyState}><Text style={styles.emptyText}>Loading ads...</Text></View>
      ) : adsList.length === 0 ? (
        <View style={styles.emptyState}><Text style={styles.emptyText}>No ads created yet</Text></View>
      ) : (
        adsList.map(ad => (
          <View key={ad.id} style={[styles.subCard, { marginBottom: 10 }]}>
            {ad.image_url ? (
              <Image source={{ uri: ad.image_url.startsWith('/') ? `${require('@/lib/query-client').getApiUrl()}${ad.image_url}` : ad.image_url }} style={{ width: '100%', height: 120, borderRadius: 10, marginBottom: 10 }} contentFit="cover" />
            ) : null}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.subRoleName}>{ad.title || 'Untitled Ad'}</Text>
                {ad.link_url ? <Text style={[styles.emptyText, { fontSize: 11, marginTop: 2 }]} numberOfLines={1}>{ad.link_url}</Text> : null}
              </View>
              <Switch
                value={ad.is_active === 1}
                onValueChange={() => toggleAd(ad.id, ad.is_active)}
                trackColor={{ false: C.surfaceElevated, true: '#34C75960' }}
                thumbColor={ad.is_active === 1 ? '#34C759' : C.textTertiary}
              />
              <Pressable hitSlop={12} onPress={() => deleteAd(ad.id)} style={{ marginLeft: 12 }}>
                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
              </Pressable>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );

  const saveLink = async (key: string, value: string) => {
    try {
      await apiRequest('PUT', `/api/app-settings/${key}`, { value });
      let label = 'Link';
      if (key === 'live_url') {
        label = 'Mobi Live';
        refreshData();
      }
      else if (key === 'schematics_url') label = 'Schematics';
      else if (key === 'web_tools_url') label = 'Web Tools';
      else if (key === 'whatsapp_support_link') label = 'WhatsApp Support';
      Alert.alert('Saved', `${label} link updated successfully`);
    } catch (err) {
      Alert.alert('Error', 'Failed to save link');
    }
  };

  const renderLinks = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, padding: 16 }}>
      <Text style={[styles.subHeading, { marginBottom: 16 }]}>Manage links that appear in the app header. Users can tap these to open the content inside the app.</Text>

      <View style={[styles.subCard, { borderLeftColor: '#FF3B30', borderLeftWidth: 3, marginBottom: 16 }]}>
        <View style={styles.subCardHeader}>
          <View style={styles.subCardLeft}>
            <View style={[styles.subRoleIcon, { backgroundColor: '#FF3B3020' }]}>
              <Ionicons name="radio" size={20} color="#FF3B30" />
            </View>
            <View>
              <Text style={styles.subRoleName}>Mobi Live Link</Text>
            </View>
          </View>
        </View>
        <Text style={[styles.emptyText, { fontSize: 12, marginTop: 4, marginBottom: 8, textAlign: 'left' }]}>
          This link opens inside the app when users tap the Mobi Live button. Use it for live streams, YouTube videos, etc.
        </Text>
        <TextInput
          style={[styles.subAmountInput, { fontSize: 14, marginBottom: 10 }]}
          placeholder="https://youtube.com/live/..."
          placeholderTextColor={C.textTertiary}
          value={liveUrl}
          onChangeText={setLiveUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <Pressable
          style={[styles.tabItemActive, { paddingVertical: 10, borderRadius: 10, alignItems: 'center' }]}
          onPress={() => saveLink('live_url', liveUrl)}
        >
          <Text style={[styles.tabTextActive, { fontSize: 14 }]}>Save Mobi Live Link</Text>
        </Pressable>
        {liveUrl ? (
          <Pressable
            style={{ marginTop: 8, alignItems: 'center' }}
            onPress={() => { setLiveUrl(''); saveLink('live_url', ''); }}
          >
            <Text style={{ color: '#FF3B30', fontSize: 13, fontFamily: 'Inter_500Medium' }}>Remove Link</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.subCard, { borderLeftColor: '#FFD60A', borderLeftWidth: 3, marginBottom: 16 }]}>
        <View style={styles.subCardHeader}>
          <View style={styles.subCardLeft}>
            <View style={[styles.subRoleIcon, { backgroundColor: '#FFD60A20' }]}>
              <Ionicons name="document-text" size={20} color="#FFD60A" />
            </View>
            <Text style={styles.subRoleName}>Schematics Link</Text>
          </View>
        </View>
        <Text style={[styles.emptyText, { fontSize: 12, marginTop: 4, marginBottom: 8, textAlign: 'left' }]}>
          This link opens inside the app when users tap the Schematics button in the header.
        </Text>
        <TextInput
          style={[styles.subAmountInput, { fontSize: 14, marginBottom: 10 }]}
          placeholder="https://..."
          placeholderTextColor={C.textTertiary}
          value={schematicsUrl}
          onChangeText={setSchematicsUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <Pressable
          style={[styles.tabItemActive, { paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: '#FFD60A' }]}
          onPress={() => saveLink('schematics_url', schematicsUrl)}
        >
          <Text style={[styles.tabTextActive, { fontSize: 14, color: '#000' }]}>Save Schematics Link</Text>
        </Pressable>
        {schematicsUrl ? (
          <Pressable
            style={{ marginTop: 8, alignItems: 'center' }}
            onPress={() => { setSchematicsUrl(''); saveLink('schematics_url', ''); }}
          >
            <Text style={{ color: '#FF3B30', fontSize: 13, fontFamily: 'Inter_500Medium' }}>Remove Link</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.subCard, { borderLeftColor: '#5E8BFF', borderLeftWidth: 3, marginBottom: 16 }]}>
        <View style={styles.subCardHeader}>
          <View style={styles.subCardLeft}>
            <View style={[styles.subRoleIcon, { backgroundColor: '#5E8BFF20' }]}>
              <Ionicons name="globe" size={20} color="#5E8BFF" />
            </View>
            <Text style={styles.subRoleName}>Web Tools Link</Text>
          </View>
        </View>
        <Text style={[styles.emptyText, { fontSize: 12, marginTop: 4, marginBottom: 8, textAlign: 'left' }]}>
          This link opens inside the app when users tap the Tools button. Use it for external tools, websites, etc.
        </Text>
        <TextInput
          style={[styles.subAmountInput, { fontSize: 14, marginBottom: 10 }]}
          placeholder="https://example.com/tools"
          placeholderTextColor={C.textTertiary}
          value={webToolsUrl}
          onChangeText={setWebToolsUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <Pressable
          style={[styles.tabItemActive, { paddingVertical: 10, borderRadius: 10, alignItems: 'center' }]}
          onPress={() => saveLink('web_tools_url', webToolsUrl)}
        >
          <Text style={[styles.tabTextActive, { fontSize: 14 }]}>Save Web Tools Link</Text>
        </Pressable>
        {webToolsUrl ? (
          <Pressable
            style={{ marginTop: 8, alignItems: 'center' }}
            onPress={() => { setWebToolsUrl(''); saveLink('web_tools_url', ''); }}
          >
            <Text style={{ color: '#FF3B30', fontSize: 13, fontFamily: 'Inter_500Medium' }}>Remove Link</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.subCard, { borderLeftColor: '#25D366', borderLeftWidth: 3 }]}>
        <View style={styles.subCardHeader}>
          <View style={styles.subCardLeft}>
            <View style={[styles.subRoleIcon, { backgroundColor: '#25D36620' }]}>
              <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
            </View>
            <Text style={styles.subRoleName}>WhatsApp Support</Text>
          </View>
        </View>
        <Text style={[styles.emptyText, { fontSize: 12, marginTop: 4, marginBottom: 8, textAlign: 'left' }]}>
          This link opens WhatsApp when users tap the Contact Us button in Settings.
        </Text>
        <TextInput
          style={[styles.subAmountInput, { fontSize: 14, marginBottom: 10 }]}
          placeholder="https://wa.link/..."
          placeholderTextColor={C.textTertiary}
          value={whatsappSupportUrl}
          onChangeText={setWhatsappSupportUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <Pressable
          style={[styles.tabItemActive, { paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: '#25D366' }]}
          onPress={() => saveLink('whatsapp_support_link', whatsappSupportUrl)}
        >
          <Text style={[styles.tabTextActive, { fontSize: 14 }]}>Save WhatsApp Link</Text>
        </Pressable>
        {whatsappSupportUrl ? (
          <Pressable
            style={{ marginTop: 8, alignItems: 'center' }}
            onPress={() => { setWhatsappSupportUrl(''); saveLink('whatsapp_support_link', ''); }}
          >
            <Text style={{ color: '#FF3B30', fontSize: 13, fontFamily: 'Inter_500Medium' }}>Remove Link</Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );

  const saveDeviceSetting = async (key: string, value: string) => {
    try {
      await apiRequest('PUT', `/api/app-settings/${key}`, { value });
    } catch (err) {
      Alert.alert('Error', 'Failed to save setting');
    }
  };

  const toggleDeviceLock = async (enabled: boolean) => {
    setDeviceLockEnabled(enabled);
    await saveDeviceSetting('device_lock_enabled', enabled ? 'true' : 'false');
  };

  const resetUserDevice = (userId: string, userName: string) => {
    Alert.alert(
      'Reset Device',
      `Reset device lock for ${userName}? They will be able to login from any device again with 2 free changes.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: async () => {
          try {
            await apiRequest('POST', '/api/admin/reset-device', { userId });
            Alert.alert('Success', `Device reset for ${userName}`);
          } catch (err) {
            Alert.alert('Error', 'Failed to reset device');
          }
        }},
      ]
    );
  };

  const fetchPushStats = useCallback(async () => {
    try {
      setPushStatsLoading(true);
      const baseUrl = getApiUrl();
      const res = await fetch(`${baseUrl}/api/admin/push-stats?phone=${ADMIN_PHONE}`);
      const data = await res.json();
      setPushStats(data);
    } catch (e) {
      console.warn('Failed to fetch push stats:', e);
    } finally {
      setPushStatsLoading(false);
    }
  }, []);


  useEffect(() => {
    if (activeTab === 'notifications') {
      fetchPushStats();
    }
  }, [activeTab, fetchPushStats]);

  const fetchLockNotifications = useCallback(async () => {
    try {
      setLockNotifLoading(true);
      const res = await apiRequest('GET', '/api/admin/lock-notifications');
      const data = await res.json();
      setLockNotifications(data.notifications || []);
    } catch (e) {
      console.warn('Failed to fetch lock notifications:', e);
    } finally {
      setLockNotifLoading(false);
    }
  }, []);

  const fetchSupportInfo = useCallback(async () => {
    try {
      const res = await apiRequest('GET', '/api/admin/support-info');
      if (!res.ok) {
        console.warn('Support info fetch failed with status:', res.status);
        return;
      }
      const data = await res.json();
      if (data.success) {
        if (data.supportNumber) setSupportNumber(data.supportNumber);
        if (data.whatsappLink) setWhatsappLink(data.whatsappLink);
      }
    } catch (e) {
      console.warn('Failed to fetch support info:', e);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'security') {
      fetchLockNotifications();
      fetchSupportInfo();
    }
  }, [activeTab, fetchLockNotifications, fetchSupportInfo]);

  const saveSupportInfo = useCallback(async () => {
    try {
      setSupportSaving(true);
      await apiRequest('POST', '/api/admin/support-info', { supportNumber, whatsappLink });
      Alert.alert('Saved', 'Support info updated successfully.');
    } catch (e) {
      Alert.alert('Error', 'Failed to save support info.');
    } finally {
      setSupportSaving(false);
    }
  }, [supportNumber, whatsappLink]);

  const unlockUser = useCallback(async (userId: string, userName: string) => {
    Alert.alert('Unlock User', `Unlock ${userName}'s account and reset device binding?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unlock',
        onPress: async () => {
          try {
            setUnlockingUserId(userId);
            const res = await apiRequest('POST', '/api/admin/unlock-user', { userId });
            const data = await res.json();
            if (data.success) {
              Alert.alert('Success', `${userName} has been unlocked.`);
              fetchLockNotifications();
              await refreshData();
            } else {
              Alert.alert('Error', data.message || 'Failed to unlock user.');
            }
          } catch (e) {
            Alert.alert('Error', 'Failed to unlock user.');
          } finally {
            setUnlockingUserId(null);
          }
        }
      }
    ]);
  }, [fetchLockNotifications, refreshData]);

  const sendNotificationToAll = useCallback(async () => {
    if (!notifTitle.trim() || !notifBody.trim()) {
      Alert.alert('Error', 'Please enter both title and message.');
      return;
    }
    try {
      setNotifSending(true);
      setNotifResult(null);
      const baseUrl = getApiUrl();
      const endpoint = notifTargetRole === 'all' ? '/api/admin/notify-all' : '/api/admin/notify-role';
      const payload: any = { phone: ADMIN_PHONE, title: notifTitle.trim(), body: notifBody.trim() };
      if (notifTargetRole !== 'all') payload.role = notifTargetRole;
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        const roleLabel = notifTargetRole === 'all' ? 'all users' : `all ${notifTargetRole}s`;
        setNotifResult(`✅ Sent to ${data.sent} device${data.sent !== 1 ? 's' : ''} (${roleLabel})`);
        setNotifTitle('');
        setNotifBody('');
      } else {
        setNotifResult(`❌ Failed: ${data.message || 'Unknown error'}`);
      }
    } catch (e) {
      setNotifResult('❌ Network error');
    } finally {
      setNotifSending(false);
    }
  }, [notifTitle, notifBody, notifTargetRole]);

  const sendSMS = useCallback(async () => {
    if (!smsBody.trim()) {
      Alert.alert('Error', 'Please enter a message.');
      return;
    }
    try {
      setSmsSending(true);
      setSmsResult(null);
      const baseUrl = getApiUrl();
      const payload: any = { phone: ADMIN_PHONE, message: smsBody.trim() };
      if (smsTargetRole !== 'all') payload.role = smsTargetRole;
      const res = await fetch(`${baseUrl}/api/admin/send-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        const roleLabel = smsTargetRole === 'all' ? 'all users' : `all ${smsTargetRole}s`;
        setSmsResult(`✅ Sent ${data.sent}${data.failed ? `, failed ${data.failed}` : ''} (${roleLabel})`);
        setSmsBody('');
      } else {
        setSmsResult(`❌ Failed: ${data.message || 'Unknown error'}`);
      }
    } catch (e) {
      setSmsResult('❌ Network error');
    } finally {
      setSmsSending(false);
    }
  }, [smsBody, smsTargetRole]);

  const sendBulkEmail = useCallback(async (scheduled?: boolean) => {
    if (!emailSubject.trim()) {
      Alert.alert('Error', 'Please enter an email subject.');
      return;
    }
    if (!emailBody.trim()) {
      Alert.alert('Error', 'Please enter the email message.');
      return;
    }
    if (scheduled && (!emailScheduleDate.trim() || !emailScheduleTime.trim())) {
      Alert.alert('Error', 'Please enter both a date (YYYY-MM-DD) and time (HH:MM) to schedule.');
      return;
    }
    try {
      setEmailSending(true);
      setEmailResult(null);
      const payload: any = { subject: emailSubject.trim(), message: emailBody.trim(), role: emailTargetRole };
      if (scheduled && emailScheduleDate && emailScheduleTime) {
        const scheduledAt = new Date(`${emailScheduleDate}T${emailScheduleTime}:00`).getTime();
        if (isNaN(scheduledAt) || scheduledAt < Date.now()) {
          Alert.alert('Error', 'Scheduled time must be in the future.');
          setEmailSending(false);
          return;
        }
        payload.scheduledAt = scheduledAt;
      }
      const res = await apiRequest('POST', '/api/admin/send-email', payload);
      const data = await res.json();
      if (data.success) {
        if (data.scheduled) {
          setEmailResult(`✅ Scheduled! Campaign will send to ${data.total} users on ${new Date(payload.scheduledAt).toLocaleString()}`);
        } else {
          setEmailResult(`✅ Sending to ${data.total} users in batches (Campaign ID: ${data.campaignId})`);
        }
        setEmailSubject('');
        setEmailBody('');
        setEmailScheduleDate('');
        setEmailScheduleTime('');
        setTimeout(() => fetchEmailStats(), 2000);
      } else {
        setEmailResult(`❌ Failed: ${data.message || 'Unknown error'}`);
      }
    } catch (e) {
      setEmailResult('❌ Network error');
    } finally {
      setEmailSending(false);
    }
  }, [emailSubject, emailBody, emailTargetRole, emailScheduleDate, emailScheduleTime, fetchEmailStats]);

  const renderNotifications = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, padding: 16 }}>

      <View style={[styles.subCard, { borderLeftColor: '#007AFF', borderLeftWidth: 3, marginBottom: 16 }]}>
        <View style={styles.subCardHeader}>
          <View style={styles.subCardLeft}>
            <View style={[styles.subRoleIcon, { backgroundColor: '#007AFF20' }]}>
              <Ionicons name="stats-chart" size={20} color="#007AFF" />
            </View>
            <View>
              <Text style={styles.subRoleName}>Push Token Stats</Text>
              <Text style={{ color: C.textTertiary, fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 }}>
                Devices registered to receive notifications
              </Text>
            </View>
          </View>
          <Pressable onPress={fetchPushStats} style={{ padding: 6 }}>
            <Ionicons name="refresh" size={18} color="#007AFF" />
          </Pressable>
        </View>
        {pushStatsLoading ? (
          <ActivityIndicator size="small" color="#007AFF" style={{ marginTop: 8 }} />
        ) : pushStats ? (
          <>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <View style={{ flex: 1, alignItems: 'center', backgroundColor: C.surfaceElevated, borderRadius: 10, padding: 12 }}>
                <Text style={{ fontSize: 22, fontFamily: 'Inter_700Bold', color: '#34C759' }}>{pushStats.withToken}</Text>
                <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: C.textTertiary, marginTop: 2 }}>Registered</Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center', backgroundColor: C.surfaceElevated, borderRadius: 10, padding: 12 }}>
                <Text style={{ fontSize: 22, fontFamily: 'Inter_700Bold', color: C.textPrimary }}>{pushStats.total}</Text>
                <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: C.textTertiary, marginTop: 2 }}>Total Users</Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center', backgroundColor: C.surfaceElevated, borderRadius: 10, padding: 12 }}>
                <Text style={{ fontSize: 22, fontFamily: 'Inter_700Bold', color: '#FF9F0A' }}>
                  {pushStats.total > 0 ? Math.round((pushStats.withToken / pushStats.total) * 100) : 0}%
                </Text>
                <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: C.textTertiary, marginTop: 2 }}>Coverage</Text>
              </View>
            </View>
            {pushStats.byRole && Object.keys(pushStats.byRole).length > 0 && (
              <View style={{ marginTop: 12, gap: 6 }}>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: C.textTertiary, marginBottom: 4 }}>BY ROLE</Text>
                {Object.entries(pushStats.byRole).map(([role, count]) => {
                  const opt = NOTIF_ROLE_OPTIONS.find(o => o.key === role);
                  return (
                    <View key={role} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: opt?.color || C.textTertiary }} />
                        <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary }}>{opt?.label || role}</Text>
                      </View>
                      <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.textPrimary }}>{count}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        ) : (
          <Pressable onPress={fetchPushStats} style={{ marginTop: 8 }}>
            <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: '#007AFF' }}>Tap refresh to load stats</Text>
          </Pressable>
        )}
      </View>

      <View style={[styles.subCard, { borderLeftColor: '#FF6B35', borderLeftWidth: 3 }]}>
        <View style={styles.subCardLeft}>
          <View style={[styles.subRoleIcon, { backgroundColor: '#FF6B3520' }]}>
            <Ionicons name="megaphone" size={20} color="#FF6B35" />
          </View>
          <View>
            <Text style={styles.subRoleName}>Send Notification</Text>
            <Text style={{ color: C.textTertiary, fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 }}>
              Target all users or a specific role
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 14, gap: 12 }}>
          <View>
            <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.textSecondary, marginBottom: 8 }}>Target Audience</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {NOTIF_ROLE_OPTIONS.map(opt => (
                <Pressable
                  key={opt.key}
                  onPress={() => setNotifTargetRole(opt.key)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
                    backgroundColor: notifTargetRole === opt.key ? opt.color : C.surfaceElevated,
                    borderWidth: 1, borderColor: notifTargetRole === opt.key ? opt.color : C.border,
                  }}
                >
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: notifTargetRole === opt.key ? '#FFF' : C.textSecondary }}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          <View>
            <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.textSecondary, marginBottom: 6 }}>Notification Title</Text>
            <TextInput
              value={notifTitle}
              onChangeText={setNotifTitle}
              placeholder="e.g. New Feature Available!"
              placeholderTextColor={C.textTertiary}
              style={{
                backgroundColor: C.surfaceElevated,
                color: C.textPrimary,
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 10,
                fontSize: 14,
                fontFamily: 'Inter_400Regular',
                borderWidth: 1,
                borderColor: C.border,
              }}
            />
          </View>
          <View>
            <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.textSecondary, marginBottom: 6 }}>Message</Text>
            <TextInput
              value={notifBody}
              onChangeText={setNotifBody}
              placeholder="e.g. Check out the latest updates..."
              placeholderTextColor={C.textTertiary}
              multiline
              numberOfLines={4}
              style={{
                backgroundColor: C.surfaceElevated,
                color: C.textPrimary,
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 10,
                fontSize: 14,
                fontFamily: 'Inter_400Regular',
                borderWidth: 1,
                borderColor: C.border,
                minHeight: 100,
                textAlignVertical: 'top',
              }}
            />
          </View>
          {notifResult && (
            <View style={{ backgroundColor: notifResult.startsWith('✅') ? '#34C75920' : '#FF3B3020', borderRadius: 8, padding: 10 }}>
              <Text style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: notifResult.startsWith('✅') ? '#34C759' : '#FF3B30' }}>
                {notifResult}
              </Text>
            </View>
          )}
          <Pressable
            onPress={sendNotificationToAll}
            disabled={notifSending}
            style={{
              backgroundColor: notifSending ? C.surfaceElevated : '#FF6B35',
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
              marginTop: 4,
            }}
          >
            {notifSending ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="send" size={18} color="#FFF" />
            )}
            <Text style={{ fontSize: 15, fontFamily: 'Inter_700Bold', color: '#FFF' }}>
              {notifSending ? 'Sending...' : notifTargetRole === 'all' ? 'Send to All Users' : `Send to ${NOTIF_ROLE_OPTIONS.find(o => o.key === notifTargetRole)?.label || notifTargetRole}`}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.subCard, { borderLeftColor: '#34C759', borderLeftWidth: 3, marginTop: 16 }]}>
        <View style={styles.subCardLeft}>
          <View style={[styles.subRoleIcon, { backgroundColor: '#34C75920' }]}>
            <Ionicons name="chatbubble-ellipses" size={20} color="#34C759" />
          </View>
          <View>
            <Text style={styles.subRoleName}>Send SMS</Text>
            <Text style={{ color: C.textTertiary, fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 }}>
              Send SMS to users via Twilio
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 14, gap: 12 }}>
          <View>
            <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.textSecondary, marginBottom: 8 }}>Target Audience</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {NOTIF_ROLE_OPTIONS.map(opt => (
                <Pressable
                  key={opt.key}
                  onPress={() => setSmsTargetRole(opt.key)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
                    backgroundColor: smsTargetRole === opt.key ? opt.color : C.surfaceElevated,
                    borderWidth: 1, borderColor: smsTargetRole === opt.key ? opt.color : C.border,
                  }}
                >
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: smsTargetRole === opt.key ? '#FFF' : C.textSecondary }}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          <View>
            <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.textSecondary, marginBottom: 6 }}>SMS Message</Text>
            <TextInput
              value={smsBody}
              onChangeText={setSmsBody}
              placeholder="Type your SMS message..."
              placeholderTextColor={C.textTertiary}
              multiline
              numberOfLines={4}
              style={{
                backgroundColor: C.surfaceElevated,
                color: C.textPrimary,
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 10,
                fontSize: 14,
                fontFamily: 'Inter_400Regular',
                borderWidth: 1,
                borderColor: C.border,
                minHeight: 100,
                textAlignVertical: 'top',
              }}
            />
          </View>
          {smsResult && (
            <View style={{ backgroundColor: smsResult.startsWith('✅') ? '#34C75920' : '#FF3B3020', borderRadius: 8, padding: 10 }}>
              <Text style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: smsResult.startsWith('✅') ? '#34C759' : '#FF3B30' }}>
                {smsResult}
              </Text>
            </View>
          )}
          <Pressable
            onPress={sendSMS}
            disabled={smsSending}
            style={{
              backgroundColor: smsSending ? C.surfaceElevated : '#34C759',
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
              marginTop: 4,
            }}
          >
            {smsSending ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="chatbubble-ellipses" size={18} color="#FFF" />
            )}
            <Text style={{ fontSize: 15, fontFamily: 'Inter_700Bold', color: '#FFF' }}>
              {smsSending ? 'Sending SMS...' : smsTargetRole === 'all' ? 'Send SMS to All' : `Send SMS to ${NOTIF_ROLE_OPTIONS.find(o => o.key === smsTargetRole)?.label || smsTargetRole}`}
            </Text>
          </Pressable>
        </View>
      </View>

      <Pressable
        onPress={() => setActiveTab('email')}
        style={[styles.subCard, { borderLeftColor: '#5E8BFF', borderLeftWidth: 3, marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
      >
        <View style={styles.subCardLeft}>
          <View style={[styles.subRoleIcon, { backgroundColor: '#5E8BFF20' }]}>
            <Ionicons name="mail" size={20} color="#5E8BFF" />
          </View>
          <View>
            <Text style={styles.subRoleName}>Email Marketing</Text>
            <Text style={{ color: C.textTertiary, fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 }}>
              Campaigns, analytics, scheduling & more
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={C.textSecondary} />
      </Pressable>
    </ScrollView>
  );

  const EMAIL_TARGET_OPTIONS = [
    { key: 'all', label: 'All Users', color: '#FF6B35' },
    { key: 'paid', label: 'Paid Users', color: '#FFD60A' },
    { key: 'technician', label: 'Technicians', color: '#34C759' },
    { key: 'teacher', label: 'Teachers', color: '#AF52DE' },
    { key: 'supplier', label: 'Suppliers', color: '#FF9500' },
    { key: 'customer', label: 'Customers', color: '#5E8BFF' },
    { key: 'job_provider', label: 'Job Providers', color: '#FF2D55' },
  ];

  const CAMPAIGN_STATUS_COLOR: Record<string, string> = {
    sending: '#FFD60A',
    sent: '#34C759',
    scheduled: '#5E8BFF',
    pending: '#888',
    failed: '#FF3B30',
  };

  const renderEmail = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, padding: 16 }}>
      <Text style={[styles.subHeading, { marginBottom: 16 }]}>
        Full email marketing control — campaigns, targeting, scheduling, and analytics.
      </Text>

      {emailStatsLoading ? (
        <ActivityIndicator color="#5E8BFF" style={{ marginBottom: 16 }} />
      ) : emailStats ? (
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'With Email', value: emailStats.totalWithEmail, color: '#5E8BFF' },
            { label: 'Subscribed', value: emailStats.subscribed, color: '#34C759' },
            { label: 'Unsubscribed', value: emailStats.unsubscribed, color: '#FF3B30' },
          ].map(stat => (
            <View key={stat.label} style={{ flex: 1, backgroundColor: C.surface, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: C.border }}>
              <Text style={{ fontSize: 22, fontFamily: 'Inter_700Bold', color: stat.color }}>{stat.value}</Text>
              <Text style={{ fontSize: 11, fontFamily: 'Inter_500Medium', color: C.textSecondary, marginTop: 2 }}>{stat.label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={[styles.subCard, { borderLeftColor: '#5E8BFF', borderLeftWidth: 3, marginBottom: 16 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
          <View style={[styles.subRoleIcon, { backgroundColor: '#5E8BFF20' }]}>
            <Ionicons name="create" size={20} color="#5E8BFF" />
          </View>
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.subRoleName}>Compose Campaign</Text>
            <Text style={{ color: C.textTertiary, fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 }}>
              Sends in batches of 50 · 2s delay between batches
            </Text>
          </View>
        </View>

        <View style={{ gap: 12 }}>
          <View>
            <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.textSecondary, marginBottom: 8 }}>Target Audience</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {EMAIL_TARGET_OPTIONS.map(opt => (
                <Pressable
                  key={opt.key}
                  onPress={() => setEmailTargetRole(opt.key)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
                    backgroundColor: emailTargetRole === opt.key ? opt.color : C.surfaceElevated,
                    borderWidth: 1, borderColor: emailTargetRole === opt.key ? opt.color : C.border,
                  }}
                >
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: emailTargetRole === opt.key ? '#FFF' : C.textSecondary }}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View>
            <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.textSecondary, marginBottom: 6 }}>Subject Line</Text>
            <TextInput
              value={emailSubject}
              onChangeText={setEmailSubject}
              placeholder="e.g. Exciting Update from Mobi!"
              placeholderTextColor={C.textTertiary}
              style={{ backgroundColor: C.surfaceElevated, color: C.textPrimary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, fontFamily: 'Inter_400Regular', borderWidth: 1, borderColor: C.border }}
            />
          </View>

          <View>
            <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.textSecondary, marginBottom: 6 }}>Message Body</Text>
            <TextInput
              value={emailBody}
              onChangeText={setEmailBody}
              placeholder="Write your email message here..."
              placeholderTextColor={C.textTertiary}
              multiline
              numberOfLines={6}
              style={{ backgroundColor: C.surfaceElevated, color: C.textPrimary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, fontFamily: 'Inter_400Regular', borderWidth: 1, borderColor: C.border, minHeight: 130, textAlignVertical: 'top' }}
            />
          </View>

          <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12 }}>
            <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.textSecondary, marginBottom: 8 }}>
              <Ionicons name="time-outline" size={12} /> Schedule (optional)
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput
                value={emailScheduleDate}
                onChangeText={setEmailScheduleDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={C.textTertiary}
                style={{ flex: 1, backgroundColor: C.surfaceElevated, color: C.textPrimary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, fontFamily: 'Inter_400Regular', borderWidth: 1, borderColor: C.border }}
              />
              <TextInput
                value={emailScheduleTime}
                onChangeText={setEmailScheduleTime}
                placeholder="HH:MM"
                placeholderTextColor={C.textTertiary}
                style={{ width: 90, backgroundColor: C.surfaceElevated, color: C.textPrimary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, fontFamily: 'Inter_400Regular', borderWidth: 1, borderColor: C.border }}
              />
            </View>
            <Text style={{ fontSize: 11, color: C.textTertiary, fontFamily: 'Inter_400Regular', marginTop: 6 }}>
              Leave blank to send immediately
            </Text>
          </View>

          {emailResult && (
            <View style={{ backgroundColor: emailResult.startsWith('✅') ? '#34C75920' : '#FF3B3020', borderRadius: 8, padding: 10 }}>
              <Text style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: emailResult.startsWith('✅') ? '#34C759' : '#FF3B30' }}>
                {emailResult}
              </Text>
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={() => sendBulkEmail(false)}
              disabled={emailSending}
              style={{ flex: 1, backgroundColor: emailSending ? C.surfaceElevated : '#5E8BFF', borderRadius: 12, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
            >
              {emailSending ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="send" size={16} color="#FFF" />}
              <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: '#FFF' }}>
                {emailSending ? 'Sending...' : 'Send Now'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => sendBulkEmail(true)}
              disabled={emailSending}
              style={{ flex: 1, backgroundColor: emailSending ? C.surfaceElevated : '#FF9500', borderRadius: 12, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
            >
              <Ionicons name="time" size={16} color="#FFF" />
              <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: '#FFF' }}>Schedule</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text style={[styles.sectionTitle, { fontSize: 15 }]}>Campaign History</Text>
        <Pressable onPress={fetchEmailStats} style={{ padding: 6 }}>
          <Ionicons name="refresh" size={18} color={C.textSecondary} />
        </Pressable>
      </View>

      {emailCampaignList.length === 0 ? (
        <View style={{ alignItems: 'center', padding: 32 }}>
          <Ionicons name="mail-open-outline" size={40} color={C.textTertiary} />
          <Text style={{ color: C.textTertiary, fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: 8 }}>No campaigns yet</Text>
        </View>
      ) : (
        emailCampaignList.map((camp) => (
          <View key={camp.id} style={[styles.subCard, { marginBottom: 10, borderLeftColor: CAMPAIGN_STATUS_COLOR[camp.status] || '#888', borderLeftWidth: 3 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.textPrimary }} numberOfLines={1}>{camp.subject}</Text>
                <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 2 }} numberOfLines={2}>{camp.message}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <View style={{ backgroundColor: (CAMPAIGN_STATUS_COLOR[camp.status] || '#888') + '25', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 }}>
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: CAMPAIGN_STATUS_COLOR[camp.status] || '#888', textTransform: 'capitalize' }}>{camp.status}</Text>
                </View>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="people-outline" size={14} color={C.textTertiary} />
                <Text style={{ fontSize: 12, fontFamily: 'Inter_500Medium', color: C.textSecondary }}>
                  {camp.targetRole === 'all' ? 'All Users' : camp.targetRole}
                </Text>
              </View>
              {camp.total > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="checkmark-circle-outline" size={14} color="#34C759" />
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_500Medium', color: C.textSecondary }}>{camp.sent}/{camp.total}</Text>
                </View>
              )}
              {camp.failed > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="close-circle-outline" size={14} color="#FF3B30" />
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_500Medium', color: '#FF3B30' }}>{camp.failed} failed</Text>
                </View>
              )}
              <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textTertiary, marginLeft: 'auto' }}>
                {camp.sentAt ? new Date(camp.sentAt).toLocaleDateString() : camp.scheduledAt ? `Sched: ${new Date(camp.scheduledAt).toLocaleDateString()}` : new Date(camp.createdAt).toLocaleDateString()}
              </Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );

  const renderDevice = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, padding: 16 }}>
      <Text style={[styles.subHeading, { marginBottom: 16 }]}>
        Control device security. Each user can only login from one device. They get 2 free device changes.
      </Text>

      <View style={[styles.subCard, { borderLeftColor: '#FF6B35', borderLeftWidth: 3, marginBottom: 16 }]}>
        <View style={styles.subCardHeader}>
          <View style={styles.subCardLeft}>
            <View style={[styles.subRoleIcon, { backgroundColor: '#FF6B3520' }]}>
              <Ionicons name="lock-closed" size={20} color="#FF6B35" />
            </View>
            <View>
              <Text style={styles.subRoleName}>Device Lock Payment</Text>
              <Text style={{ color: C.textTertiary, fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 }}>
                {deviceLockEnabled ? 'ON - Payment required after 2 free changes' : 'OFF - Free device change with OTP'}
              </Text>
            </View>
          </View>
          <Switch
            value={deviceLockEnabled}
            onValueChange={toggleDeviceLock}
            trackColor={{ false: C.surfaceElevated, true: '#FF6B3560' }}
            thumbColor={deviceLockEnabled ? '#FF6B35' : C.textTertiary}
          />
        </View>
        {deviceLockEnabled && (
          <View style={styles.subAmountRow}>
            <Text style={styles.subAmountLabel}>Device Change Price (₹)</Text>
            <TextInput
              style={styles.subAmountInput}
              value={deviceLockPrice}
              onChangeText={setDeviceLockPrice}
              onBlur={() => saveDeviceSetting('device_lock_price', deviceLockPrice)}
              keyboardType="number-pad"
              placeholder="100"
              placeholderTextColor={C.textTertiary}
            />
          </View>
        )}
      </View>

      <View style={[styles.subCard, { borderLeftColor: '#5E8BFF', borderLeftWidth: 3 }]}>
        <View style={[styles.subCardHeader, { marginBottom: 12 }]}>
          <View style={styles.subCardLeft}>
            <View style={[styles.subRoleIcon, { backgroundColor: '#5E8BFF20' }]}>
              <Ionicons name="people" size={20} color="#5E8BFF" />
            </View>
            <Text style={styles.subRoleName}>Reset User Devices</Text>
          </View>
        </View>
        <Text style={{ color: C.textTertiary, fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 12 }}>
          Tap a technician to reset their device lock. This clears their device ID and resets their change count to 0. Device lock only applies to technicians.
        </Text>
        {allProfiles.filter(p => p.role === 'technician' && (p.deviceId || (p.deviceChangeCount || 0) > 0)).length === 0 ? (
          <Text style={{ color: C.textTertiary, fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', paddingVertical: 20 }}>
            No technicians with device locks yet
          </Text>
        ) : (
          allProfiles.filter(p => p.role === 'technician' && (p.deviceId || (p.deviceChangeCount || 0) > 0)).map(user => {
            const roleColor = ROLE_COLORS[user.role as UserRole] || C.textSecondary;
            return (
              <View key={user.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.surfaceElevated }}>
                {user.avatar ? (
                  <Image source={{ uri: user.avatar }} style={{ width: 36, height: 36, borderRadius: 18 }} contentFit="cover" />
                ) : (
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: roleColor + '20', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: roleColor, fontSize: 14, fontWeight: '700' }}>{getInitials(user.name)}</Text>
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={{ color: C.text, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>{user.name}</Text>
                  <Text style={{ color: C.textTertiary, fontSize: 11, fontFamily: 'Inter_400Regular' }}>
                    Changes: {user.deviceChangeCount || 0} | {user.deviceId ? 'Device locked' : 'No device'}
                  </Text>
                </View>
                <Pressable
                  style={{ backgroundColor: '#FF3B3015', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
                  onPress={() => resetUserDevice(user.id, user.name)}
                >
                  <Text style={{ color: '#FF3B30', fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>Reset</Text>
                </Pressable>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );

  const renderJobs = () => (
    <FlatList
      data={jobs}
      keyExtractor={item => item.id}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: Platform.OS === 'web' ? 34 : 40 }}
      renderItem={({ item }) => (
        <View style={styles.jobCard}>
          <View style={styles.jobHeader}>
            <Text style={styles.jobTitle}>{item.title}</Text>
            <View style={styles.jobTypeBadge}>
              <Text style={styles.jobTypeText}>{item.type.replace('_', ' ')}</Text>
            </View>
          </View>
          <Text style={styles.jobAuthor}>Posted by {item.userName}</Text>
          <Text style={styles.jobDesc} numberOfLines={2}>{item.description}</Text>
          <View style={styles.jobFooter}>
            <View style={styles.jobLocation}>
              <Ionicons name="location-outline" size={14} color={C.textTertiary} />
              <Text style={styles.jobLocationText}>{item.city}, {item.state}</Text>
            </View>
            {item.salary && <Text style={styles.jobSalary}>{item.salary}</Text>}
          </View>
        </View>
      )}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No job listings yet</Text>
        </View>
      }
    />
  );

  const renderSecurity = () => (
    <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
      <View style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Support Contact Info</Text>
        <Text style={{ fontSize: 12, color: C.textTertiary, fontFamily: 'Inter_400Regular', marginBottom: 12 }}>
          This number shows on the lock screen when a user's account is blocked or subscription expires.
        </Text>
        <Text style={[styles.settingLabel, { marginBottom: 4 }]}>Support Phone Number</Text>
        <TextInput
          style={styles.input}
          value={supportNumber}
          onChangeText={setSupportNumber}
          placeholder="+918179142535"
          placeholderTextColor={C.textTertiary}
          keyboardType="phone-pad"
        />
        <Text style={[styles.settingLabel, { marginBottom: 4, marginTop: 12 }]}>WhatsApp Link</Text>
        <TextInput
          style={styles.input}
          value={whatsappLink}
          onChangeText={setWhatsappLink}
          placeholder="https://wa.me/918179142535"
          placeholderTextColor={C.textTertiary}
          autoCapitalize="none"
        />
        <TouchableOpacity
          style={[styles.saveBtn, { marginTop: 16 }]}
          onPress={saveSupportInfo}
          disabled={supportSaving}
        >
          <Text style={styles.saveBtnText}>{supportSaving ? 'Saving...' : 'Save Support Info'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={styles.sectionLabel}>Lock Alerts</Text>
          <TouchableOpacity onPress={fetchLockNotifications}>
            <Ionicons name="refresh" size={18} color={C.primary} />
          </TouchableOpacity>
        </View>
        {lockNotifLoading ? (
          <ActivityIndicator color={C.primary} />
        ) : lockNotifications.length === 0 ? (
          <Text style={{ color: C.textTertiary, fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', paddingVertical: 20 }}>
            No lock events yet
          </Text>
        ) : (
          lockNotifications.map(notif => (
            <View key={notif.id} style={{
              padding: 14,
              backgroundColor: notif.read === 1 ? C.surfaceElevated : '#FF3B3010',
              borderRadius: 12,
              marginBottom: 10,
              borderWidth: notif.read === 1 ? 0 : 1,
              borderColor: notif.read === 1 ? 'transparent' : '#FF3B3040',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Ionicons name="lock-closed" size={16} color="#FF3B30" />
                <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text, flex: 1 }}>
                  {notif.userName || 'Unknown'}
                </Text>
                {notif.read !== 1 && (
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30' }} />
                )}
              </View>
              <Text style={{ fontSize: 12, color: C.textSecondary, fontFamily: 'Inter_400Regular', marginBottom: 2 }}>
                {notif.phone}
              </Text>
              <Text style={{ fontSize: 12, color: C.textTertiary, fontFamily: 'Inter_400Regular', marginBottom: 10 }}>
                {notif.reason} · {new Date(notif.createdAt).toLocaleDateString()}
              </Text>
              <TouchableOpacity
                style={{ backgroundColor: '#007AFF', borderRadius: 8, paddingVertical: 8, alignItems: 'center' }}
                disabled={unlockingUserId === notif.userId}
                onPress={() => unlockUser(notif.userId, notif.userName)}
              >
                <Text style={{ color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>
                  {unlockingUserId === notif.userId ? 'Unlocking...' : 'Unlock Account'}
                </Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Blocked Users</Text>
        {allUsers.filter(u => u.fullProfile?.blocked === 1).length === 0 ? (
          <Text style={{ color: C.textTertiary, fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', paddingVertical: 20 }}>
            No blocked users
          </Text>
        ) : (
          allUsers.filter(u => u.fullProfile?.blocked === 1).map(user => (
            <View key={user.id} style={{
              padding: 14,
              backgroundColor: '#FF3B3010',
              borderRadius: 12,
              marginBottom: 10,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text }}>{user.name}</Text>
                <Text style={{ fontSize: 12, color: C.textSecondary, fontFamily: 'Inter_400Regular' }}>{user.fullProfile?.phone || ''} · {user.role}</Text>
              </View>
              <TouchableOpacity
                style={{ backgroundColor: '#34C759', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 }}
                onPress={() => {
                  Alert.alert('Unblock User', `Unblock ${user.name}?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Unblock', onPress: () => executeBlockUser(user.id, user.name, false) }
                  ]);
                }}
              >
                <Text style={{ color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>Unblock</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 8 }]}>
        <View style={styles.headerRow}>
          <Pressable hitSlop={12} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={C.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Admin Panel</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
          style={styles.tabsScroll}
        >
          {tabs.map(tab => (
            <Pressable
              key={tab.key}
              style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Ionicons
                name={tab.icon}
                size={16}
                color={activeTab === tab.key ? '#FFF' : C.textSecondary}
              />
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={styles.contentArea}>
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'users' && renderUsers()}
        {activeTab === 'subscriptions' && renderSubscriptions()}
        {activeTab === 'revenue' && renderRevenue()}
        {activeTab === 'posts' && renderPosts()}
        {activeTab === 'jobs' && renderJobs()}
        {activeTab === 'ads' && renderAds()}
        {activeTab === 'links' && renderLinks()}
        {activeTab === 'device' && renderDevice()}
        {activeTab === 'notifications' && renderNotifications()}
        {activeTab === 'email' && renderEmail()}
        {activeTab === 'security' && renderSecurity()}
        {activeTab === 'reviews' && renderReviews()}
        {activeTab === 'insurance' && renderInsurance()}
        {activeTab === 'diagnostics' && renderDiagnostics()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitle: {
    color: C.text,
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
  },
  tabsScroll: {
    marginBottom: 4,
  },
  tabsContent: {
    gap: 8,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: C.surfaceElevated,
    gap: 6,
  },
  tabItemActive: {
    backgroundColor: C.primary,
  },
  tabText: {
    color: C.textSecondary,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  contentArea: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  dashboardContent: {
    paddingBottom: 40,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    width: '47%' as any,
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 3,
    gap: 6,
  },
  statNumber: {
    color: C.text,
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
  },
  statLabel: {
    color: C.textTertiary,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  section: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  sectionTitle: {
    color: C.textSecondary,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  roleRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 110,
    gap: 8,
  },
  roleDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  roleLabelText: {
    color: C.text,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  roleBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: C.surfaceElevated,
    borderRadius: 4,
    overflow: 'hidden',
  },
  roleBar: {
    height: '100%' as any,
    borderRadius: 4,
  },
  roleCount: {
    color: C.textSecondary,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    width: 28,
    textAlign: 'right',
  },
  activityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  activityLabel: {
    color: C.textSecondary,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  activityValue: {
    color: C.text,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  userCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  userCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 14,
  },
  userAvatarText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  userInfo: {
    flex: 1,
    gap: 4,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userName: {
    color: C.text,
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    flexShrink: 1,
  },
  registeredBadge: {
    backgroundColor: '#34C75920',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  registeredText: {
    color: '#34C759',
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userRoleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  userRoleText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  userCityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  userCity: {
    color: C.textTertiary,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  phoneText: {
    color: C.textTertiary,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  userDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.borderLight,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  detailLabel: {
    color: C.textTertiary,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    width: 80,
  },
  detailValue: {
    color: C.text,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    flex: 1,
    textAlign: 'right',
  },
  detailPostCount: {
    color: C.textTertiary,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 4,
    textAlign: 'center',
  },
  subHeading: {
    color: C.textTertiary,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    marginBottom: 16,
    textAlign: 'center',
  },
  subCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  subCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  subRoleIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subRoleName: {
    color: C.text,
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  subAmountRow: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.borderLight,
  },
  subAmountLabel: {
    color: C.textTertiary,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginBottom: 8,
  },
  subAmountInput: {
    backgroundColor: C.surfaceElevated,
    borderRadius: 10,
    padding: 12,
    color: C.text,
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    borderWidth: 1,
    borderColor: C.border,
  },
  postCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.border,
    gap: 8,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  postHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  postAuthor: {
    color: C.text,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  postTime: {
    color: C.textTertiary,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  postText: {
    color: C.textSecondary,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
  postStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  postStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  postStatText: {
    color: C.textTertiary,
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  categoryTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 'auto',
  },
  categoryTagText: {
    color: C.textSecondary,
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    textTransform: 'capitalize' as const,
  },
  jobCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.border,
    gap: 6,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  jobTitle: {
    color: C.text,
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    flex: 1,
  },
  jobTypeBadge: {
    backgroundColor: '#5E8BFF20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  jobTypeText: {
    color: '#5E8BFF',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    textTransform: 'capitalize' as const,
  },
  jobAuthor: {
    color: C.textTertiary,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  jobDesc: {
    color: C.textSecondary,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
  jobFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  jobLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  jobLocationText: {
    color: C.textTertiary,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  jobSalary: {
    color: '#34C759',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    color: C.textTertiary,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  sectionCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  sectionLabel: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: C.text,
    marginBottom: 8,
  },
  settingLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: C.textSecondary,
  },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: C.text,
    backgroundColor: C.surfaceElevated,
  },
  saveBtn: {
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
});
