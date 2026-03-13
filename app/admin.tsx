import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, Platform, Alert, ScrollView,
  TextInput, Switch, ActivityIndicator, RefreshControl, TouchableOpacity
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
const PRIMARY = '#FF6B2C';

type AdminTab = 'dashboard' | 'users' | 'bookings' | 'subscriptions' | 'insurance' | 'revenue' | 'posts' | 'jobs' | 'ads' | 'listings' | 'links' | 'notifications' | 'email';

const ROLE_COLORS: Record<UserRole | 'admin', string> = {
  technician: '#34C759',
  teacher: '#FFD60A',
  supplier: '#FF6B2C',
  job_provider: '#5E8BFF',
  customer: '#FF2D55',
  admin: '#8E8E93',
};

const NOTIF_ROLE_OPTIONS = [
  { key: 'all', label: 'All Users', color: '#007AFF' },
  { key: 'technician', label: 'Technicians', color: '#34C759' },
  { key: 'teacher', label: 'Teachers', color: '#FFD60A' },
  { key: 'supplier', label: 'Suppliers', color: '#FF6B2C' },
  { key: 'job_provider', label: 'Job Providers', color: '#5E8BFF' },
  { key: 'customer', label: 'Customers', color: '#FF2D55' },
];

const TABS: { key: AdminTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'grid-outline' },
  { key: 'users', label: 'Users', icon: 'people-outline' },
  { key: 'bookings', label: 'Bookings', icon: 'calendar-outline' },
  { key: 'subscriptions', label: 'Subscriptions', icon: 'card-outline' },
  { key: 'insurance', label: 'Insurance', icon: 'shield-checkmark-outline' },
  { key: 'revenue', label: 'Revenue', icon: 'trending-up-outline' },
  { key: 'posts', label: 'Posts', icon: 'newspaper-outline' },
  { key: 'jobs', label: 'Jobs', icon: 'briefcase-outline' },
  { key: 'ads', label: 'Ads & Shop', icon: 'megaphone-outline' },
  { key: 'listings', label: 'Listings', icon: 'cube-outline' },
  { key: 'links', label: 'Links', icon: 'link-outline' },
  { key: 'notifications', label: 'Notifications', icon: 'notifications-outline' },
  { key: 'email', label: 'Email', icon: 'mail-outline' },
];

function getInitials(name: string): string {
  if (!name) return '?';
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

function StatCard({ icon, value, label, color }: { icon: any; value: string | number; label: string; color: string }) {
  return (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <View style={[styles.statIconWrap, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SectionCard({ title, children, accent }: { title?: string; children: React.ReactNode; accent?: string }) {
  return (
    <View style={[styles.sectionCard, accent ? { borderLeftWidth: 3, borderLeftColor: accent } : {}]}>
      {title ? <Text style={styles.sectionCardTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

function InputField({ label, ...props }: any) {
  return (
    <View style={{ marginBottom: 12 }}>
      {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
      <TextInput
        style={styles.input}
        placeholderTextColor={C.textTertiary}
        {...props}
      />
    </View>
  );
}

function ActionButton({ title, onPress, disabled, loading, color = PRIMARY, style }: any) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.actionBtn, { backgroundColor: (disabled || loading) ? C.surfaceElevated : color }, style]}
    >
      {loading
        ? <ActivityIndicator size="small" color="#FFF" />
        : <Text style={[styles.actionBtnText, { color: (disabled || loading) ? C.textTertiary : '#FFF' }]}>{title}</Text>
      }
    </Pressable>
  );
}

function UserDetailCard({ user, onBlock, onVerify, onDelete }: {
  user: any;
  onBlock: (id: string, name: string, blocked: boolean) => void;
  onVerify: (id: string, name: string, verified: boolean) => void;
  onDelete: (id: string, name: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [changingRole, setChangingRole] = useState(false);
  const [roleStatus, setRoleStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const { refreshData } = useApp();
  const roleColor = ROLE_COLORS[user.role as UserRole] || C.textSecondary;
  const profile = user.fullProfile;
  const isBlocked = profile?.blocked === 1;
  const isVerified = profile?.verified === 1;

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

  const ROLES_LIST: UserRole[] = ['technician', 'teacher', 'supplier', 'customer', 'job_provider'];

  return (
    <View style={[styles.userCard, isBlocked && { borderColor: '#FF3B30' }]}>
      <Pressable onPress={() => { setShowRolePicker(false); setExpanded(!expanded); }}>
        <View style={styles.userCardRow}>
          {profile?.avatar ? (
            <Image source={{ uri: profile.avatar }} style={styles.userAvatar} contentFit="cover" />
          ) : (
            <View style={[styles.userAvatarFallback, { backgroundColor: roleColor + '20' }]}>
              <Text style={[styles.userAvatarText, { color: roleColor }]}>{getInitials(user.name)}</Text>
            </View>
          )}
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.userName, isBlocked && { color: '#FF3B30' }]} numberOfLines={1}>{user.name}</Text>
              {isVerified && <Ionicons name="checkmark-circle" size={14} color="#34C759" />}
              {isBlocked && (
                <View style={[styles.badge, { backgroundColor: '#FF3B3015' }]}>
                  <Text style={[styles.badgeText, { color: '#FF3B30' }]}>Blocked</Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={[styles.badge, { backgroundColor: roleColor + '18' }]}>
                <Text style={[styles.badgeText, { color: roleColor }]}>{ROLE_LABELS[user.role as UserRole] || user.role}</Text>
              </View>
              {profile?.phone ? (
                <Text style={styles.userSub} numberOfLines={1}>{profile.phone}</Text>
              ) : null}
            </View>
            {user.city ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="location-outline" size={11} color={C.textTertiary} />
                <Text style={styles.userSub}>{user.city}</Text>
              </View>
            ) : null}
          </View>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={C.textTertiary} />
        </View>
      </Pressable>

      {roleStatus && (
        <View style={{ marginHorizontal: 12, marginBottom: 8, padding: 8, backgroundColor: roleStatus.ok ? '#34C75915' : '#FF3B3015', borderRadius: 8 }}>
          <Text style={{ fontSize: 12, color: roleStatus.ok ? '#34C759' : '#FF3B30', fontFamily: 'Inter_600SemiBold' }}>{roleStatus.msg}</Text>
        </View>
      )}

      {expanded && (
        <View style={styles.userExpanded}>
          {/* Role Change */}
          <View style={{ marginBottom: 12 }}>
            <Text style={styles.expandedLabel}>Role Management</Text>
            <Pressable
              style={[styles.smallBtn, { backgroundColor: C.surfaceElevated }]}
              onPress={() => setShowRolePicker(v => !v)}
              disabled={changingRole}
            >
              <Ionicons name="swap-horizontal-outline" size={14} color={PRIMARY} />
              <Text style={{ fontSize: 12, color: PRIMARY, fontFamily: 'Inter_600SemiBold' }}>
                {changingRole ? 'Changing...' : 'Change Role'}
              </Text>
            </Pressable>
            {showRolePicker && (
              <View style={styles.rolePicker}>
                {ROLES_LIST.map(r => (
                  <Pressable
                    key={r}
                    onPress={() => changeRole(r)}
                    style={[styles.rolePickerItem, r === user.role && { backgroundColor: PRIMARY + '15' }]}
                  >
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ROLE_COLORS[r] || C.textSecondary }} />
                    <Text style={{ fontSize: 13, fontFamily: r === user.role ? 'Inter_600SemiBold' : 'Inter_400Regular', color: r === user.role ? PRIMARY : C.text }}>
                      {ROLE_LABELS[r] || r}
                    </Text>
                    {r === user.role && <Ionicons name="checkmark" size={14} color={PRIMARY} style={{ marginLeft: 'auto' as any }} />}
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Profile Details */}
          {profile && (
            <View style={{ gap: 6, marginBottom: 12 }}>
              {profile.sellType ? <Text style={styles.expandedDetail}>Sells: {profile.sellType}</Text> : null}
              {profile.teachType ? <Text style={styles.expandedDetail}>Teaches: {profile.teachType}</Text> : null}
              {profile.shopName ? <Text style={styles.expandedDetail}>Shop: {profile.shopName}</Text> : null}
              {profile.shopAddress ? <Text style={styles.expandedDetail}>Address: {profile.shopAddress}</Text> : null}
              {profile.gstNumber ? <Text style={styles.expandedDetail}>GST: {profile.gstNumber}</Text> : null}
              {profile.aadhaarNumber ? <Text style={styles.expandedDetail}>Aadhaar: {maskNumber(profile.aadhaarNumber)}</Text> : null}
              {profile.panNumber ? <Text style={styles.expandedDetail}>PAN: {profile.panNumber}</Text> : null}
              {profile.experience ? <Text style={styles.expandedDetail}>Experience: {profile.experience}</Text> : null}
              {profile.skills?.length > 0 ? <Text style={styles.expandedDetail}>Skills: {profile.skills.join(', ')}</Text> : null}
              <Text style={[styles.expandedDetail, { color: C.textTertiary }]}>{user.postCount} post{user.postCount !== 1 ? 's' : ''}</Text>
            </View>
          )}

          {/* Actions */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              style={[styles.actionChip, { backgroundColor: isBlocked ? '#34C75918' : '#FF3B3015' }]}
              onPress={() => onBlock(user.id, user.name, !isBlocked)}
            >
              <Ionicons name={isBlocked ? 'checkmark-circle-outline' : 'ban'} size={14} color={isBlocked ? '#34C759' : '#FF3B30'} />
              <Text style={{ color: isBlocked ? '#34C759' : '#FF3B30', fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>
                {isBlocked ? 'Unblock' : 'Block'}
              </Text>
            </Pressable>
            {user.role === 'technician' && (
              <Pressable
                style={[styles.actionChip, { backgroundColor: isVerified ? '#FF3B3015' : '#34C75918' }]}
                onPress={() => onVerify(user.id, user.name, !isVerified)}
              >
                <Ionicons name={isVerified ? 'close-circle-outline' : 'checkmark-circle-outline'} size={14} color={isVerified ? '#FF3B30' : '#34C759'} />
                <Text style={{ color: isVerified ? '#FF3B30' : '#34C759', fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>
                  {isVerified ? 'Unverify' : 'Verify'}
                </Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.actionChip, { backgroundColor: '#FF3B3015' }]}
              onPress={() => onDelete(user.id, user.name)}
            >
              <Ionicons name="trash-outline" size={14} color="#FF3B30" />
              <Text style={{ color: '#FF3B30', fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>Delete</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const { profile, posts, jobs, conversations, deletePost, allProfiles, refreshData } = useApp();
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');

  // Subscriptions
  const [subscriptions, setSubscriptions] = useState<SubscriptionSetting[]>([]);
  const [subLoading, setSubLoading] = useState(false);
  const [activeSubsList, setActiveSubsList] = useState<any[]>([]);
  const [activeSubsLoading, setActiveSubsLoading] = useState(false);

  // Links
  const [liveUrl, setLiveUrl] = useState('');
  const [schematicsUrl, setSchematicsUrl] = useState('');
  const [webToolsUrl, setWebToolsUrl] = useState('');
  const [whatsappSupportUrl, setWhatsappSupportUrl] = useState('');
  const [linksLoading, setLinksLoading] = useState(false);

  // Users
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | UserRole>('all');

  // Revenue
  const [revenueData, setRevenueData] = useState<any>(null);
  const [revenueLoading, setRevenueLoading] = useState(false);

  // Payouts
  const [payoutsData, setPayoutsData] = useState<any[]>([]);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [payoutsUpdating, setPayoutsUpdating] = useState<string | null>(null);

  // Notifications
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [notifSending, setNotifSending] = useState(false);
  const [notifResult, setNotifResult] = useState<string | null>(null);
  const [pushStats, setPushStats] = useState<{ total: number; withToken: number; byRole?: Record<string, number> } | null>(null);
  const [pushStatsLoading, setPushStatsLoading] = useState(false);
  const [notifTargetRole, setNotifTargetRole] = useState<string>('all');

  // SMS
  const [smsBody, setSmsBody] = useState('');
  const [smsSending, setSmsSending] = useState(false);
  const [smsResult, setSmsResult] = useState<string | null>(null);
  const [smsTargetRole, setSmsTargetRole] = useState<string>('all');

  // Email
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

  // Insurance
  const [insurancePlanName, setInsurancePlanName] = useState('Mobile Protection Plan');
  const [insurancePlanPrice, setInsurancePlanPrice] = useState('50');
  const [insuranceDiscount, setInsuranceDiscount] = useState('500');
  const [insuranceStatus, setInsuranceStatus] = useState<'active' | 'disabled'>('active');
  const [insuranceLoading, setInsuranceLoading] = useState(false);
  const [insuranceSaving, setInsuranceSaving] = useState(false);
  const [insuranceSaved, setInsuranceSaved] = useState(false);

  // Ads
  const [adsList, setAdsList] = useState<any[]>([]);
  const [adsLoading, setAdsLoading] = useState(false);
  const [adsSeeding, setAdsSeeding] = useState(false);
  const [newAdTitle, setNewAdTitle] = useState('');
  const [newAdDescription, setNewAdDescription] = useState('');
  const [newAdImageUrl, setNewAdImageUrl] = useState('');
  const [newAdLinkUrl, setNewAdLinkUrl] = useState('');
  const [adSaving, setAdSaving] = useState(false);

  // Listings
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [listingsSearch, setListingsSearch] = useState('');

  // Repair Bookings
  const [repairBookings, setRepairBookings] = useState<any[]>([]);
  const [repairLoading, setRepairLoading] = useState(false);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const cleanProfilePhone = profile?.phone?.replace(/\D/g, '');
  const isAdmin = profile && (profile.role === 'admin' || cleanProfilePhone === '8179142535' || cleanProfilePhone === '9876543210');

  useEffect(() => {
    if (profile && !isAdmin) {
      Alert.alert('Access Denied', 'You do not have admin access.');
      router.back();
    }
  }, [isAdmin, profile]);

  // ---- Fetch functions ----
  const fetchRepairBookings = useCallback(async () => {
    setRepairLoading(true);
    try {
      const res = await apiRequest('GET', '/api/repair-bookings');
      const data = await res.json();
      if (Array.isArray(data)) setRepairBookings(data);
    } catch { } finally { setRepairLoading(false); }
  }, []);

  const fetchAds = useCallback(async () => {
    setAdsLoading(true);
    try {
      const res = await apiRequest('GET', '/api/ads');
      const data = await res.json();
      if (Array.isArray(data)) setAdsList(data);
    } catch { } finally { setAdsLoading(false); }
  }, []);

  const fetchAllProducts = useCallback(async () => {
    setListingsLoading(true);
    try {
      const res = await apiRequest('GET', '/api/products');
      const data = await res.json();
      if (Array.isArray(data)) setAllProducts(data);
    } catch { } finally { setListingsLoading(false); }
  }, []);

  const fetchInsuranceSettings = useCallback(async () => {
    setInsuranceLoading(true);
    try {
      const res = await apiRequest('GET', '/api/settings/insurance');
      const data = await res.json();
      if (data.success && data.settings) {
        setInsurancePlanName(data.settings.planName);
        setInsurancePlanPrice(String(data.settings.protectionPlanPrice));
        setInsuranceDiscount(String(data.settings.repairDiscount));
        setInsuranceStatus(data.settings.status);
      }
    } catch { } finally { setInsuranceLoading(false); }
  }, []);

  const saveInsuranceSettings = useCallback(async () => {
    setInsuranceSaving(true);
    try {
      const res = await apiRequest('PUT', '/api/admin/settings/insurance', {
        planName: insurancePlanName,
        protectionPlanPrice: parseInt(insurancePlanPrice, 10),
        repairDiscount: parseInt(insuranceDiscount, 10),
        status: insuranceStatus,
      });
      const data = await res.json();
      if (data.success) {
        setInsuranceSaved(true);
        setTimeout(() => setInsuranceSaved(false), 2500);
        if (Platform.OS !== 'web') Alert.alert('Saved', 'Insurance settings updated.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save settings');
    } finally { setInsuranceSaving(false); }
  }, [insurancePlanName, insurancePlanPrice, insuranceDiscount, insuranceStatus]);

  const fetchSubscriptions = useCallback(async () => {
    setSubLoading(true);
    try {
      const res = await apiRequest('GET', '/api/subscription-settings');
      const data = await res.json();
      setSubscriptions(data);
    } catch { } finally { setSubLoading(false); }
  }, []);

  const fetchLinks = useCallback(async () => {
    setLinksLoading(true);
    try {
      const res = await apiRequest('GET', '/api/app-settings');
      const data = await res.json();
      setLiveUrl(data.live_url || '');
      setSchematicsUrl(data.schematics_url || '');
      setWebToolsUrl(data.web_tools_url || '');
      setWhatsappSupportUrl(data.whatsapp_support_link || '');
    } catch { } finally { setLinksLoading(false); }
  }, []);

  const fetchPushStats = useCallback(async () => {
    setPushStatsLoading(true);
    try {
      const baseUrl = getApiUrl();
      const res = await fetch(`${baseUrl}/api/admin/push-stats?phone=${ADMIN_PHONE}`);
      const data = await res.json();
      setPushStats(data);
    } catch { } finally { setPushStatsLoading(false); }
  }, []);

  const fetchRevenue = useCallback(async () => {
    setRevenueLoading(true);
    try {
      const res = await apiRequest('GET', '/api/admin/revenue');
      const data = await res.json();
      if (data.success) setRevenueData(data);
    } catch { } finally { setRevenueLoading(false); }
  }, []);

  const fetchActiveSubscriptions = useCallback(async () => {
    setActiveSubsLoading(true);
    try {
      const res = await apiRequest('GET', '/api/admin/active-subscriptions');
      const data = await res.json();
      if (Array.isArray(data)) setActiveSubsList(data);
    } catch { } finally { setActiveSubsLoading(false); }
  }, []);

  const fetchPayouts = useCallback(async () => {
    setPayoutsLoading(true);
    try {
      const res = await apiRequest('GET', '/api/admin/teacher-payouts');
      const data = await res.json();
      if (data.success && Array.isArray(data.payouts)) setPayoutsData(data.payouts);
    } catch { } finally { setPayoutsLoading(false); }
  }, []);

  const fetchEmailStats = useCallback(async () => {
    setEmailStatsLoading(true);
    try {
      const res = await apiRequest('GET', '/api/admin/email-stats');
      const data = await res.json();
      if (data.success) {
        setEmailStats(data.stats);
        setEmailCampaignList(data.campaigns || []);
      }
    } catch { } finally { setEmailStatsLoading(false); }
  }, []);

  // Tab-based fetching
  useEffect(() => {
    if (activeTab === 'bookings') fetchRepairBookings();
    if (activeTab === 'ads') fetchAds();
    if (activeTab === 'listings') fetchAllProducts();
    if (activeTab === 'insurance') fetchInsuranceSettings();
    if (activeTab === 'subscriptions') { fetchSubscriptions(); fetchActiveSubscriptions(); }
    if (activeTab === 'links') fetchLinks();
    if (activeTab === 'notifications') fetchPushStats();
    if (activeTab === 'revenue') { fetchRevenue(); fetchActiveSubscriptions(); }
    if (activeTab === 'email') fetchEmailStats();
  }, [activeTab]);

  // ---- User Actions ----
  const toggleSubscription = async (role: string, enabled: boolean) => {
    try {
      await apiRequest('PATCH', `/api/subscription-settings/${role}`, { enabled: enabled ? 1 : 0 });
      setSubscriptions(prev => prev.map(s => s.role === role ? { ...s, enabled: enabled ? 1 : 0 } : s));
    } catch { Alert.alert('Error', 'Failed to update subscription setting.'); }
  };

  const updateSubAmount = async (role: string, amount: string) => {
    try {
      await apiRequest('PATCH', `/api/subscription-settings/${role}`, { amount });
    } catch { Alert.alert('Error', 'Failed to update amount.'); }
  };

  const createAd = async () => {
    if (!newAdTitle.trim()) { Alert.alert('Error', 'Title is required'); return; }
    setAdSaving(true);
    try {
      const res = await apiRequest('POST', '/api/ads', { title: newAdTitle, description: newAdDescription, imageUrl: newAdImageUrl, linkUrl: newAdLinkUrl, isActive: 1, sortOrder: adsList.length });
      if (res.ok) {
        setNewAdTitle(''); setNewAdDescription(''); setNewAdImageUrl(''); setNewAdLinkUrl('');
        await fetchAds();
      }
    } catch { Alert.alert('Error', 'Failed to create ad'); } finally { setAdSaving(false); }
  };

  const toggleAd = async (ad: any) => {
    try {
      await apiRequest('PATCH', `/api/ads/${ad.id}`, { isActive: ad.isActive ? 0 : 1 });
      await fetchAds();
    } catch { Alert.alert('Error', 'Failed to toggle ad'); }
  };

  const deleteAd = (id: string, title: string) => {
    Alert.alert('Delete Ad', `Delete "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await apiRequest('DELETE', `/api/ads/${id}`); await fetchAds(); }
        catch { Alert.alert('Error', 'Failed to delete ad'); }
      }},
    ]);
  };

  const seedSuppliers = async () => {
    setAdsSeeding(true);
    try {
      const res = await apiRequest('POST', '/api/admin/seed-suppliers', {});
      const data = await res.json();
      Alert.alert('Done', data.message || 'Suppliers seeded');
    } catch { Alert.alert('Error', 'Failed to seed suppliers'); } finally { setAdsSeeding(false); }
  };

  const adminDeleteProduct = (id: string, title: string) => {
    Alert.alert('Delete Listing', `Delete "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await apiRequest('DELETE', `/api/admin/products/${id}`); await fetchAllProducts(); }
        catch { Alert.alert('Error', 'Failed to delete listing'); }
      }},
    ]);
  };

  const executeBlockUser = async (userId: string, userName: string, block: boolean) => {
    try {
      const res = await apiRequest('POST', '/api/admin/block-user', { userId, blocked: block });
      const data = await res.json();
      if (data.success) { Alert.alert('Success', `${userName} has been ${block ? 'blocked' : 'unblocked'}.`); await refreshData(); }
      else Alert.alert('Error', data.message || 'Failed to update user.');
    } catch { Alert.alert('Error', 'Failed to update user. Please try again.'); }
  };

  const executeVerifyUser = async (userId: string, userName: string, verify: boolean) => {
    try {
      const res = await apiRequest('PATCH', `/api/profiles/${userId}/verify`, { verified: verify ? 1 : 0 });
      const data = await res.json();
      if (data.success) { await refreshData(); Alert.alert('Success', `${userName} has been ${verify ? 'verified' : 'unverified'}.`); }
    } catch (e: any) { Alert.alert('Error', e.message || 'Failed to verify user.'); }
  };

  const handleBlockUser = (userId: string, userName: string, block: boolean) => {
    Alert.alert(block ? 'Block User' : 'Unblock User',
      block ? `Block ${userName}? They won't be able to log in.` : `Unblock ${userName}?`,
      [{ text: 'Cancel', style: 'cancel' }, { text: block ? 'Block' : 'Unblock', style: block ? 'destructive' : 'default', onPress: () => executeBlockUser(userId, userName, block) }]);
  };

  const handleVerifyUser = (userId: string, userName: string, verify: boolean) => {
    executeVerifyUser(userId, userName, verify);
  };

  const handleDeleteUser = (userId: string, userName: string) => {
    Alert.alert('Delete User', `Permanently delete ${userName}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          const res = await apiRequest('POST', '/api/admin/delete-user', { userId });
          const data = await res.json();
          if (data.success) await refreshData();
        } catch { Alert.alert('Error', 'Failed to delete user.'); }
      }},
    ]);
  };

  const handleDeletePost = (postId: string, userName: string) => {
    Alert.alert('Delete Post', `Delete post by ${userName}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deletePost(postId) },
    ]);
  };

  const saveLink = async (key: string, value: string) => {
    try {
      await apiRequest('PUT', `/api/app-settings/${key}`, { value });
      refreshData();
      Alert.alert('Saved', 'Link updated successfully');
    } catch { Alert.alert('Error', 'Failed to save link'); }
  };

  const updatePayout = useCallback(async (payoutId: string, status: string, adminNotes: string) => {
    setPayoutsUpdating(payoutId);
    try {
      const res = await apiRequest('PATCH', `/api/admin/teacher-payouts/${payoutId}`, { status, adminNotes });
      const data = await res.json();
      if (data.success) setPayoutsData(prev => prev.map(p => p.id === payoutId ? data.payout : p));
    } catch { } finally { setPayoutsUpdating(null); }
  }, []);

  const sendNotificationToAll = useCallback(async () => {
    if (!notifTitle.trim() || !notifBody.trim()) { Alert.alert('Error', 'Please enter both title and message.'); return; }
    setNotifSending(true); setNotifResult(null);
    try {
      const baseUrl = getApiUrl();
      const endpoint = notifTargetRole === 'all' ? '/api/admin/notify-all' : '/api/admin/notify-role';
      const payload: any = { phone: ADMIN_PHONE, title: notifTitle.trim(), body: notifBody.trim() };
      if (notifTargetRole !== 'all') payload.role = notifTargetRole;
      const res = await fetch(`${baseUrl}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.success) {
        setNotifResult(`Sent to ${data.sent} device${data.sent !== 1 ? 's' : ''}`);
        setNotifTitle(''); setNotifBody('');
      } else { setNotifResult(`Failed: ${data.message || 'Unknown error'}`); }
    } catch { setNotifResult('Network error'); } finally { setNotifSending(false); }
  }, [notifTitle, notifBody, notifTargetRole]);

  const sendSMS = useCallback(async () => {
    if (!smsBody.trim()) { Alert.alert('Error', 'Please enter a message.'); return; }
    setSmsSending(true); setSmsResult(null);
    try {
      const baseUrl = getApiUrl();
      const payload: any = { phone: ADMIN_PHONE, message: smsBody.trim() };
      if (smsTargetRole !== 'all') payload.role = smsTargetRole;
      const res = await fetch(`${baseUrl}/api/admin/send-sms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.success) { setSmsResult(`Sent ${data.sent}${data.failed ? `, failed ${data.failed}` : ''}`); setSmsBody(''); }
      else { setSmsResult(`Failed: ${data.message || 'Unknown error'}`); }
    } catch { setSmsResult('Network error'); } finally { setSmsSending(false); }
  }, [smsBody, smsTargetRole]);

  const sendBulkEmail = useCallback(async (scheduled?: boolean) => {
    if (!emailSubject.trim()) { Alert.alert('Error', 'Please enter an email subject.'); return; }
    if (!emailBody.trim()) { Alert.alert('Error', 'Please enter the email message.'); return; }
    if (scheduled && (!emailScheduleDate.trim() || !emailScheduleTime.trim())) {
      Alert.alert('Error', 'Please enter both a date (YYYY-MM-DD) and time (HH:MM) to schedule.'); return;
    }
    setEmailSending(true); setEmailResult(null);
    try {
      const payload: any = { subject: emailSubject.trim(), message: emailBody.trim(), role: emailTargetRole };
      if (scheduled && emailScheduleDate && emailScheduleTime) {
        const scheduledAt = new Date(`${emailScheduleDate}T${emailScheduleTime}:00`).getTime();
        if (isNaN(scheduledAt) || scheduledAt < Date.now()) { Alert.alert('Error', 'Scheduled time must be in the future.'); setEmailSending(false); return; }
        payload.scheduledAt = scheduledAt;
      }
      const res = await apiRequest('POST', '/api/admin/send-email', payload);
      const data = await res.json();
      if (data.success) {
        setEmailResult(data.scheduled ? `Scheduled! Sending to ${data.total} users` : `Sending to ${data.total} users (Campaign: ${data.campaignId})`);
        setEmailSubject(''); setEmailBody(''); setEmailScheduleDate(''); setEmailScheduleTime('');
        setTimeout(() => fetchEmailStats(), 2000);
      } else { setEmailResult(`Failed: ${data.message || 'Unknown error'}`); }
    } catch { setEmailResult('Network error'); } finally { setEmailSending(false); }
  }, [emailSubject, emailBody, emailTargetRole, emailScheduleDate, emailScheduleTime, fetchEmailStats]);

  const downloadUsersCSV = () => {
    const url = `${getApiUrl()}/api/admin/export-users`;
    openLink(url, 'Export');
  };

  // ---- Computed Data ----
  const allUsers = useMemo(() => {
    const userMap = new Map<string, any>();
    if (allProfiles) {
      allProfiles.forEach(p => {
        userMap.set(p.id, { id: p.id, name: p.name, role: p.role as UserRole, city: p.city || '', postCount: 0, isRegistered: true, fullProfile: p });
      });
    }
    if (posts) {
      posts.forEach(p => {
        if (!userMap.has(p.userId)) userMap.set(p.userId, { id: p.userId, name: p.userName, role: p.userRole, city: '', postCount: 0, isRegistered: false, fullProfile: null });
        userMap.get(p.userId)!.postCount += 1;
      });
    }
    return Array.from(userMap.values());
  }, [allProfiles, posts]);

  const filteredUsers = useMemo(() => {
    let users = allUsers;
    if (userRoleFilter !== 'all') users = users.filter(u => u.role === userRoleFilter);
    if (userSearchQuery.trim()) {
      const q = userSearchQuery.trim().toLowerCase();
      users = users.filter(u => (u.name || '').toLowerCase().includes(q) || (u.fullProfile?.phone || '').includes(q) || (u.city || '').toLowerCase().includes(q));
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
      customer: allUsers.filter(u => u.role === 'customer').length,
    };
    return { totalUsers, registeredUsers, totalPosts, totalJobs, totalChats, totalLikes, totalComments, roleBreakdown };
  }, [allUsers, posts, jobs, conversations]);

  if (!profile) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={styles.loadingText}>Loading admin panel...</Text>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.accessDeniedScreen}>
        <Ionicons name="lock-closed" size={56} color="#FF3B30" />
        <Text style={styles.accessDeniedTitle}>Access Denied</Text>
        <Text style={styles.accessDeniedText}>You don't have permission to access the admin panel.</Text>
        <Pressable onPress={() => router.back()} style={styles.accessDeniedBtn}>
          <Text style={{ color: '#FFF', fontFamily: 'Inter_600SemiBold' }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  // ---- Render Sections ----
  const renderDashboard = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
      <View style={styles.statsGrid}>
        <StatCard icon="people-outline" value={stats.totalUsers} label="Total Users" color={PRIMARY} />
        <StatCard icon="person-add-outline" value={stats.registeredUsers} label="Registered" color="#34C759" />
        <StatCard icon="newspaper-outline" value={stats.totalPosts} label="Posts" color="#5E8BFF" />
        <StatCard icon="briefcase-outline" value={stats.totalJobs} label="Jobs" color="#FFD60A" />
        <StatCard icon="chatbubbles-outline" value={stats.totalChats} label="Conversations" color="#FF6B2C" />
        <StatCard icon="heart-outline" value={stats.totalLikes} label="Total Likes" color="#FF3B30" />
      </View>

      <SectionCard title="Users by Role">
        {(Object.entries(stats.roleBreakdown) as [string, number][]).map(([role, count]) => {
          const color = ROLE_COLORS[role as UserRole] || C.textSecondary;
          const pct = stats.totalUsers > 0 ? (count / stats.totalUsers) * 100 : 0;
          return (
            <View key={role} style={styles.roleRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, width: 100 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
                <Text style={styles.roleLabel}>{ROLE_LABELS[role as UserRole] || role}</Text>
              </View>
              <View style={{ flex: 1, height: 6, backgroundColor: C.surfaceElevated, borderRadius: 3, overflow: 'hidden', marginHorizontal: 10 }}>
                <View style={{ width: `${Math.max(pct, 4)}%`, height: '100%', backgroundColor: color, borderRadius: 3 }} />
              </View>
              <Text style={[styles.roleCount, { color }]}>{count}</Text>
            </View>
          );
        })}
      </SectionCard>

      <SectionCard title="Activity Summary">
        {[
          { label: 'Comments', value: stats.totalComments },
          { label: 'Avg Likes/Post', value: stats.totalPosts > 0 ? (stats.totalLikes / stats.totalPosts).toFixed(1) : '0' },
          { label: 'Most Active Role', value: ROLE_LABELS[Object.entries(stats.roleBreakdown).sort((a, b) => b[1] - a[1])[0]?.[0] as UserRole] || 'Technician' },
        ].map(({ label, value }) => (
          <View key={label} style={styles.activityRow}>
            <Text style={styles.activityLabel}>{label}</Text>
            <Text style={styles.activityValue}>{value}</Text>
          </View>
        ))}
      </SectionCard>

      <SectionCard title="Quick Actions">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {TABS.filter(t => t.key !== 'dashboard').map(tab => (
            <Pressable key={tab.key} onPress={() => setActiveTab(tab.key)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: C.surfaceElevated, borderWidth: 1, borderColor: C.border }}>
              <Ionicons name={tab.icon} size={14} color={PRIMARY} />
              <Text style={{ fontSize: 12, color: C.text, fontFamily: 'Inter_500Medium' }}>{tab.label}</Text>
            </Pressable>
          ))}
        </View>
      </SectionCard>
    </ScrollView>
  );

  const USER_ROLE_FILTERS = [
    { key: 'all' as const, label: 'All', color: '#007AFF' },
    { key: 'technician' as const, label: 'Techs', color: '#34C759' },
    { key: 'teacher' as const, label: 'Teachers', color: '#FFD60A' },
    { key: 'supplier' as const, label: 'Suppliers', color: '#FF6B2C' },
    { key: 'job_provider' as const, label: 'Jobs', color: '#5E8BFF' },
    { key: 'customer' as const, label: 'Customers', color: '#FF2D55' },
  ];

  const renderUsers = () => (
    <View style={{ flex: 1 }}>
      <View style={styles.searchBar}>
        <View style={styles.searchInputWrap}>
          <Ionicons name="search" size={16} color={C.textTertiary} />
          <TextInput
            value={userSearchQuery} onChangeText={setUserSearchQuery}
            placeholder="Search by name, phone, city..."
            placeholderTextColor={C.textTertiary}
            style={{ flex: 1, color: C.text, paddingVertical: 10, paddingHorizontal: 8, fontFamily: 'Inter_400Regular', fontSize: 14 }}
            clearButtonMode="while-editing"
          />
          {userSearchQuery.length > 0 && (
            <Pressable onPress={() => setUserSearchQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={C.textTertiary} />
            </Pressable>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
          {USER_ROLE_FILTERS.map(f => {
            const active = userRoleFilter === f.key;
            return (
              <Pressable key={f.key} onPress={() => setUserRoleFilter(f.key)}
                style={[styles.filterChip, active && { backgroundColor: f.color, borderColor: f.color }]}>
                <Text style={[styles.filterChipText, active && { color: '#FFF' }]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
          <Text style={styles.resultCount}>{filteredUsers.length} users</Text>
          <Pressable onPress={downloadUsersCSV} style={styles.downloadBtn}>
            <Ionicons name="download-outline" size={13} color="#5E8BFF" />
            <Text style={{ color: '#5E8BFF', fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>Export CSV</Text>
          </Pressable>
        </View>
      </View>
      <FlatList
        data={filteredUsers}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === 'web' ? 50 : 80, paddingHorizontal: 12 }}
        renderItem={({ item }) => (
          <UserDetailCard user={item} onBlock={handleBlockUser} onVerify={handleVerifyUser} onDelete={handleDeleteUser} />
        )}
        ListEmptyComponent={<View style={styles.emptyState}><Ionicons name="people-outline" size={40} color={C.textTertiary} /><Text style={styles.emptyText}>{userSearchQuery ? 'No users match your search' : 'No users found'}</Text></View>}
      />
    </View>
  );

  const renderBookings = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}
      refreshControl={<RefreshControl refreshing={repairLoading} onRefresh={fetchRepairBookings} tintColor={C.textTertiary} />}>
      {repairLoading && repairBookings.length === 0 ? (
        <ActivityIndicator color={PRIMARY} style={{ marginTop: 40 }} />
      ) : repairBookings.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={40} color={C.textTertiary} />
          <Text style={styles.emptyText}>No repair bookings yet</Text>
        </View>
      ) : (
        repairBookings.map((b: any) => (
          <View key={b.id} style={styles.listCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={styles.listCardTitle}>{b.customerName || 'Customer'}</Text>
              <View style={[styles.statusBadge, { backgroundColor: b.status === 'completed' ? '#34C75920' : b.status === 'pending' ? '#FFD60A20' : '#FF6B2C20' }]}>
                <Text style={[styles.statusText, { color: b.status === 'completed' ? '#34C759' : b.status === 'pending' ? '#FFD60A' : '#FF6B2C' }]}>{b.status}</Text>
              </View>
            </View>
            <Text style={styles.listCardSub}>{b.deviceType} — {b.issue}</Text>
            <Text style={styles.listCardMeta}>{b.phone} · {b.createdAt ? new Date(b.createdAt).toLocaleDateString('en-IN') : ''}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );

  const renderSubscriptions = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
      {subLoading ? (
        <ActivityIndicator color={PRIMARY} style={{ marginTop: 40 }} />
      ) : (
        <>
          {(['technician', 'teacher', 'supplier'] as const).map(role => {
            const sub = subscriptions.find(s => s.role === role);
            const enabled = sub?.enabled === 1;
            const amount = sub?.amount || '0';
            const roleColor = ROLE_COLORS[role];
            const roleIcons = { technician: 'construct-outline' as const, teacher: 'school-outline' as const, supplier: 'cube-outline' as const };
            return (
              <View key={role} style={[styles.sectionCard, { borderLeftWidth: 3, borderLeftColor: roleColor }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: enabled ? 12 : 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={[styles.roleIconWrap, { backgroundColor: roleColor + '20' }]}>
                      <Ionicons name={roleIcons[role]} size={20} color={roleColor} />
                    </View>
                    <View>
                      <Text style={styles.sectionCardTitle}>{ROLE_LABELS[role]}</Text>
                      <Text style={{ fontSize: 12, color: C.textTertiary, fontFamily: 'Inter_400Regular' }}>{enabled ? 'Subscription active' : 'Subscription disabled'}</Text>
                    </View>
                  </View>
                  <Switch value={enabled} onValueChange={(val) => toggleSubscription(role, val)}
                    trackColor={{ false: C.surfaceElevated, true: roleColor + '60' }} thumbColor={enabled ? roleColor : C.textTertiary} />
                </View>
                {enabled && role === 'teacher' && (
                  <View style={styles.subAmountRow}>
                    <Text style={styles.inputLabel}>Commission on Sales (%)</Text>
                    <TextInput style={[styles.input, { marginTop: 6 }]} value={sub?.commissionPercent || '30'}
                      onChangeText={(val) => setSubscriptions(prev => prev.map(s => s.role === role ? { ...s, commissionPercent: val } : s))}
                      onBlur={() => apiRequest('PATCH', `/api/subscription-settings/${role}`, { commissionPercent: sub?.commissionPercent || '30' }).catch(() => {})}
                      keyboardType="number-pad" placeholder="30" placeholderTextColor={C.textTertiary} />
                  </View>
                )}
                {enabled && role !== 'teacher' && (
                  <View style={styles.subAmountRow}>
                    <Text style={styles.inputLabel}>Monthly Amount (₹)</Text>
                    <TextInput style={[styles.input, { marginTop: 6 }]} value={amount}
                      onChangeText={(val) => setSubscriptions(prev => prev.map(s => s.role === role ? { ...s, amount: val } : s))}
                      onBlur={() => updateSubAmount(role, amount)}
                      keyboardType="number-pad" placeholder={role === 'technician' ? '99' : '999'} placeholderTextColor={C.textTertiary} />
                  </View>
                )}
              </View>
            );
          })}

          <View style={styles.sectionCard}>
            <Text style={styles.sectionCardTitle}>Active Subscribers ({activeSubsLoading ? '...' : activeSubsList.length})</Text>
            {activeSubsLoading ? (
              <ActivityIndicator color={PRIMARY} style={{ marginTop: 12 }} />
            ) : activeSubsList.length === 0 ? (
              <View style={styles.emptyState}><Text style={styles.emptyText}>No active subscribers</Text></View>
            ) : (
              activeSubsList.map((sub, i) => {
                const roleColor = ROLE_COLORS[sub.role as UserRole] || C.textSecondary;
                const daysLeft = sub.subscriptionEnd ? Math.max(0, Math.ceil((sub.subscriptionEnd - Date.now()) / 86400000)) : 0;
                return (
                  <View key={sub.id} style={[styles.activityRow, i === activeSubsList.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                      {sub.avatar ? (
                        <Image source={{ uri: sub.avatar }} style={{ width: 32, height: 32, borderRadius: 16 }} contentFit="cover" />
                      ) : (
                        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: roleColor + '20', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: roleColor, fontSize: 12, fontFamily: 'Inter_700Bold' }}>{getInitials(sub.name)}</Text>
                        </View>
                      )}
                      <View>
                        <Text style={{ color: C.text, fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>{sub.name}</Text>
                        <Text style={{ color: C.textTertiary, fontSize: 11 }}>{sub.phone}</Text>
                      </View>
                    </View>
                    <Text style={{ color: daysLeft <= 7 ? '#FF3B30' : '#34C759', fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>{daysLeft}d left</Text>
                  </View>
                );
              })
            )}
          </View>
        </>
      )}
    </ScrollView>
  );

  const renderInsurance = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
      {insuranceLoading ? (
        <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: 40 }} />
      ) : (
        <>
          <SectionCard title="Plan Details">
            <InputField label="Plan Name" value={insurancePlanName} onChangeText={setInsurancePlanName} placeholder="Mobile Protection Plan" />
            <InputField label="Monthly Price (₹)" value={insurancePlanPrice} onChangeText={setInsurancePlanPrice} keyboardType="numeric" placeholder="50" />
            <Text style={[styles.inputLabel, { color: C.textTertiary, marginTop: 0 }]}>Razorpay charges ₹{insurancePlanPrice || '0'} (this value × 100 paise)</Text>
            <InputField label="Repair Discount (₹)" value={insuranceDiscount} onChangeText={setInsuranceDiscount} keyboardType="numeric" placeholder="500" />
          </SectionCard>

          <SectionCard title="Plan Status">
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {(['active', 'disabled'] as const).map(s => (
                <Pressable key={s} onPress={() => setInsuranceStatus(s)} style={[styles.statusToggle, insuranceStatus === s && { borderColor: s === 'active' ? '#34C759' : '#FF3B30', backgroundColor: s === 'active' ? '#34C75920' : '#FF3B3020' }]}>
                  <Ionicons name={s === 'active' ? 'checkmark-circle' : 'close-circle'} size={18} color={s === 'active' ? '#34C759' : '#FF3B30'} />
                  <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: s === 'active' ? '#34C759' : '#FF3B30' }}>{s === 'active' ? 'Active' : 'Disabled'}</Text>
                </Pressable>
              ))}
            </View>
          </SectionCard>

          <View style={[styles.sectionCard, { backgroundColor: PRIMARY + '10', borderWidth: 1, borderColor: PRIMARY + '40' }]}>
            <Text style={[styles.sectionCardTitle, { color: PRIMARY }]}>Live Preview</Text>
            <Text style={{ color: C.textSecondary, fontSize: 13, lineHeight: 20, fontFamily: 'Inter_400Regular' }}>
              Banner: "{insurancePlanName} — Just ₹{insurancePlanPrice}/month + ₹{insuranceDiscount} off on repairs"
            </Text>
          </View>

          <Pressable onPress={saveInsuranceSettings} disabled={insuranceSaving}
            style={[styles.actionBtn, { backgroundColor: insuranceSaved ? '#34C759' : PRIMARY }]}>
            {insuranceSaving ? <ActivityIndicator color="#FFF" size="small" /> : (
              <Text style={styles.actionBtnText}>{insuranceSaved ? '✓ Saved!' : 'Save Changes'}</Text>
            )}
          </Pressable>
        </>
      )}
    </ScrollView>
  );

  const renderRevenue = () => {
    const rd = revenueData;
    const fmt = (v: number) => `₹${(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
        {revenueLoading && !rd ? (
          <ActivityIndicator color={PRIMARY} style={{ marginTop: 40 }} />
        ) : rd ? (
          <>
            <View style={[styles.sectionCard, { backgroundColor: '#34C75918', borderColor: '#34C75940', borderWidth: 1 }]}>
              <Text style={[styles.sectionCardTitle, { color: '#34C759' }]}>Total Platform Revenue</Text>
              <Text style={{ fontSize: 32, fontFamily: 'Inter_700Bold', color: '#34C759' }}>{fmt(rd.totalRevenue)}</Text>
            </View>

            <View style={styles.statsGrid}>
              <StatCard icon="card-outline" value={fmt(rd.subscriptionRevenue)} label="Subscriptions" color="#5E8BFF" />
              <StatCard icon="school-outline" value={fmt(rd.platformCourseRevenue)} label={`Course (${rd.commissionPercent || 30}%)`} color="#FFD60A" />
              <StatCard icon="people-outline" value={rd.activeSubscribers || 0} label="Active Subscribers" color="#FF6B2C" />
              <StatCard icon="play-circle-outline" value={rd.totalEnrollments || 0} label="Paid Enrollments" color="#FF2D55" />
              <StatCard icon="gift-outline" value={rd.freeEnrollments || 0} label="Free Enrollments" color="#34C759" />
              <StatCard icon="book-outline" value={rd.publishedCourses || 0} label="Published Courses" color="#007AFF" />
            </View>

            <SectionCard title="Revenue by Role">
              {[{ role: 'technician', label: 'Technicians', color: '#34C759' }, { role: 'teacher', label: 'Teachers', color: '#FFD60A' }, { role: 'supplier', label: 'Suppliers', color: '#FF6B2C' }].map(({ role, label, color }) => {
                const count = rd.activeSubscribersByRole?.[role] || 0;
                const rev = rd.subscriptionRevenueByRole?.[role] || 0;
                return (
                  <View key={role} style={styles.activityRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
                      <Text style={styles.activityLabel}>{label} ({count} active)</Text>
                    </View>
                    <Text style={[styles.activityValue, { color }]}>{fmt(rev)}</Text>
                  </View>
                );
              })}
            </SectionCard>

            {rd.teacherRevenue?.length > 0 && (
              <SectionCard title="Top Teacher Earnings">
                {rd.teacherRevenue.map((t: any, i: number) => (
                  <View key={t.teacherId} style={[styles.activityRow, i === rd.teacherRevenue.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activityLabel}>{t.name || 'Unknown'}</Text>
                      <Text style={styles.activityMeta}>{t.enrollments} enrollments · {t.courseCount} courses</Text>
                    </View>
                    <Text style={[styles.activityValue, { color: '#FFD60A' }]}>{fmt(t.amount)}</Text>
                  </View>
                ))}
              </SectionCard>
            )}
          </>
        ) : (
          <View style={styles.emptyState}><Text style={styles.emptyText}>No revenue data available</Text></View>
        )}
      </ScrollView>
    );
  };

  const renderPosts = () => (
    <FlatList
      data={posts}
      keyExtractor={item => item.id}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 80, paddingTop: 12 }}
      renderItem={({ item }) => (
        <View style={styles.listCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <View>
              <Text style={styles.listCardTitle}>{item.userName}</Text>
              <Text style={styles.listCardMeta}>{timeAgo(item.createdAt)}</Text>
            </View>
            <Pressable hitSlop={12} onPress={() => handleDeletePost(item.id, item.userName)}
              style={{ padding: 6, borderRadius: 8, backgroundColor: '#FF3B3015' }}>
              <Ionicons name="trash-outline" size={16} color="#FF3B30" />
            </Pressable>
          </View>
          <Text style={styles.listCardSub} numberOfLines={2}>{item.text}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="heart" size={13} color="#FF3B30" />
              <Text style={styles.listCardMeta}>{item.likes.length}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="chatbubble" size={13} color="#5E8BFF" />
              <Text style={styles.listCardMeta}>{item.comments.length}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: C.surfaceElevated }]}>
              <Text style={styles.badgeText}>{item.category}</Text>
            </View>
          </View>
        </View>
      )}
      ListEmptyComponent={<View style={styles.emptyState}><Ionicons name="newspaper-outline" size={40} color={C.textTertiary} /><Text style={styles.emptyText}>No posts yet</Text></View>}
    />
  );

  const renderJobs = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
      {(jobs || []).length === 0 ? (
        <View style={styles.emptyState}><Ionicons name="briefcase-outline" size={40} color={C.textTertiary} /><Text style={styles.emptyText}>No jobs posted yet</Text></View>
      ) : (
        (jobs || []).map((job: any) => (
          <View key={job.id} style={styles.listCard}>
            <Text style={styles.listCardTitle}>{job.title}</Text>
            {job.description ? <Text style={styles.listCardSub} numberOfLines={2}>{job.description}</Text> : null}
            <Text style={styles.listCardMeta}>{job.location ? `${job.location} · ` : ''}{job.createdAt ? new Date(job.createdAt).toLocaleDateString('en-IN') : ''}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );

  const renderAds = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
      <SectionCard title="Create New Ad">
        <InputField label="Title *" value={newAdTitle} onChangeText={setNewAdTitle} placeholder="Ad title" />
        <InputField label="Description" value={newAdDescription} onChangeText={setNewAdDescription} placeholder="Short description" />
        <InputField label="Image URL" value={newAdImageUrl} onChangeText={setNewAdImageUrl} placeholder="https://..." autoCapitalize="none" />
        <InputField label="Link URL" value={newAdLinkUrl} onChangeText={setNewAdLinkUrl} placeholder="https://..." autoCapitalize="none" />
        <ActionButton title={adSaving ? 'Creating...' : '+ Create Ad'} onPress={createAd} loading={adSaving} />
      </SectionCard>

      <SectionCard title="Seed Test Data">
        <Text style={[styles.inputLabel, { color: C.textSecondary, marginBottom: 8 }]}>Add 10 test supplier accounts to populate the Suppliers tab.</Text>
        <ActionButton title={adsSeeding ? 'Seeding...' : 'Seed 10 Test Suppliers'} onPress={seedSuppliers} loading={adsSeeding} color="#FF6B2C" />
      </SectionCard>

      <Text style={styles.sectionHeader}>All Ads ({adsList.length})</Text>
      {adsLoading ? (
        <ActivityIndicator color={PRIMARY} style={{ marginTop: 20 }} />
      ) : adsList.length === 0 ? (
        <View style={styles.emptyState}><Ionicons name="megaphone-outline" size={40} color={C.textTertiary} /><Text style={styles.emptyText}>No ads yet</Text></View>
      ) : (
        adsList.map(ad => (
          <View key={ad.id} style={[styles.listCard, { borderColor: ad.isActive ? PRIMARY + '40' : C.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.listCardTitle} numberOfLines={1}>{ad.title}</Text>
                {ad.description ? <Text style={styles.listCardSub} numberOfLines={1}>{ad.description}</Text> : null}
                {ad.linkUrl ? <Text style={{ color: PRIMARY, fontSize: 11, marginTop: 2 }} numberOfLines={1}>{ad.linkUrl}</Text> : null}
              </View>
              <View style={[styles.statusBadge, { backgroundColor: ad.isActive ? '#34C75920' : C.surfaceElevated }]}>
                <Text style={[styles.statusText, { color: ad.isActive ? '#34C759' : C.textTertiary }]}>{ad.isActive ? 'Active' : 'Hidden'}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable style={[styles.actionChip, { flex: 1, justifyContent: 'center', backgroundColor: ad.isActive ? '#FF3B3015' : '#34C75915' }]} onPress={() => toggleAd(ad)}>
                <Ionicons name={ad.isActive ? 'eye-off-outline' : 'eye-outline'} size={14} color={ad.isActive ? '#FF3B30' : '#34C759'} />
                <Text style={{ color: ad.isActive ? '#FF3B30' : '#34C759', fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>{ad.isActive ? 'Hide' : 'Show'}</Text>
              </Pressable>
              <Pressable style={[styles.actionChip, { backgroundColor: '#FF3B3015' }]} onPress={() => deleteAd(ad.id, ad.title)}>
                <Ionicons name="trash-outline" size={14} color="#FF3B30" />
                <Text style={{ color: '#FF3B30', fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>Delete</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );

  const renderListings = () => {
    const filtered = allProducts.filter(p =>
      !listingsSearch || [p.title, p.userName, p.city, p.category].filter(Boolean).join(' ').toLowerCase().includes(listingsSearch.toLowerCase())
    );
    return (
      <View style={{ flex: 1 }}>
        <View style={{ padding: 12, gap: 8 }}>
          <View style={styles.searchInputWrap}>
            <Ionicons name="search" size={16} color={C.textTertiary} />
            <TextInput style={{ flex: 1, color: C.text, fontSize: 14, paddingVertical: 8, paddingHorizontal: 8 }}
              placeholder="Search listings..." placeholderTextColor={C.textTertiary}
              value={listingsSearch} onChangeText={setListingsSearch} />
          </View>
        </View>
        {listingsLoading ? (
          <ActivityIndicator color={PRIMARY} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={filtered} keyExtractor={item => item.id}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 80 }}
            ListEmptyComponent={<View style={styles.emptyState}><Ionicons name="cube-outline" size={40} color={C.textTertiary} /><Text style={styles.emptyText}>No listings found</Text></View>}
            renderItem={({ item }) => (
              <View style={[styles.listCard, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listCardTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.listCardSub}>By {item.userName} · {item.category || 'general'}</Text>
                  {item.city ? <Text style={styles.listCardMeta}>{item.city}</Text> : null}
                  {item.price ? <Text style={{ color: PRIMARY, fontSize: 13, fontFamily: 'Inter_700Bold', marginTop: 2 }}>₹{item.price}</Text> : null}
                </View>
                <Pressable style={{ padding: 10, borderRadius: 8, backgroundColor: '#FF3B3015' }} onPress={() => adminDeleteProduct(item.id, item.title)}>
                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                </Pressable>
              </View>
            )}
          />
        )}
      </View>
    );
  };

  const renderLinks = () => {
    const linkItems = [
      { key: 'live_url', label: 'Mobi Live Link', icon: 'radio-outline' as const, color: '#FF3B30', value: liveUrl, setValue: setLiveUrl, placeholder: 'https://youtube.com/live/...' },
      { key: 'schematics_url', label: 'Schematics Link', icon: 'document-text-outline' as const, color: '#FFD60A', value: schematicsUrl, setValue: setSchematicsUrl, placeholder: 'https://...' },
      { key: 'web_tools_url', label: 'Web Tools Link', icon: 'globe-outline' as const, color: '#5E8BFF', value: webToolsUrl, setValue: setWebToolsUrl, placeholder: 'https://example.com/tools' },
      { key: 'whatsapp_support_link', label: 'WhatsApp Support', icon: 'logo-whatsapp' as const, color: '#25D366', value: whatsappSupportUrl, setValue: setWhatsappSupportUrl, placeholder: 'https://wa.link/...' },
    ];
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
        {linkItems.map(item => (
          <View key={item.key} style={[styles.sectionCard, { borderLeftWidth: 3, borderLeftColor: item.color }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <View style={[styles.roleIconWrap, { backgroundColor: item.color + '20' }]}>
                <Ionicons name={item.icon} size={18} color={item.color} />
              </View>
              <Text style={styles.sectionCardTitle}>{item.label}</Text>
            </View>
            <TextInput style={styles.input} value={item.value} onChangeText={item.setValue}
              placeholder={item.placeholder} placeholderTextColor={C.textTertiary}
              autoCapitalize="none" autoCorrect={false} keyboardType="url" />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <ActionButton title="Save" onPress={() => saveLink(item.key, item.value)} color={item.color} style={{ flex: 1 }} />
              {item.value ? (
                <Pressable onPress={() => { item.setValue(''); saveLink(item.key, ''); }}
                  style={{ paddingHorizontal: 16, justifyContent: 'center', borderRadius: 10, backgroundColor: '#FF3B3015' }}>
                  <Text style={{ color: '#FF3B30', fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderNotifications = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
      {/* Push Stats */}
      <SectionCard title="Push Notification Stats">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={styles.activityLabel}>Registered devices</Text>
          <Pressable onPress={fetchPushStats} style={{ padding: 4 }}>
            <Ionicons name="refresh-outline" size={18} color={PRIMARY} />
          </Pressable>
        </View>
        {pushStatsLoading ? (
          <ActivityIndicator color={PRIMARY} />
        ) : pushStats ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={styles.miniStatCard}>
              <Text style={[styles.miniStatValue, { color: '#34C759' }]}>{pushStats.withToken}</Text>
              <Text style={styles.miniStatLabel}>Registered</Text>
            </View>
            <View style={styles.miniStatCard}>
              <Text style={styles.miniStatValue}>{pushStats.total}</Text>
              <Text style={styles.miniStatLabel}>Total Users</Text>
            </View>
            <View style={styles.miniStatCard}>
              <Text style={[styles.miniStatValue, { color: '#FF9F0A' }]}>
                {pushStats.total > 0 ? Math.round((pushStats.withToken / pushStats.total) * 100) : 0}%
              </Text>
              <Text style={styles.miniStatLabel}>Coverage</Text>
            </View>
          </View>
        ) : (
          <Pressable onPress={fetchPushStats}><Text style={{ color: PRIMARY, fontSize: 13 }}>Tap refresh to load stats</Text></Pressable>
        )}
      </SectionCard>

      {/* Send Push Notification */}
      <SectionCard title="Send Push Notification" accent="#FF6B35">
        <Text style={styles.inputLabel}>Target Audience</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
          {NOTIF_ROLE_OPTIONS.map(opt => (
            <Pressable key={opt.key} onPress={() => setNotifTargetRole(opt.key)}
              style={[styles.filterChip, notifTargetRole === opt.key && { backgroundColor: opt.color, borderColor: opt.color }]}>
              <Text style={[styles.filterChipText, notifTargetRole === opt.key && { color: '#FFF' }]}>{opt.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <InputField label="Title" value={notifTitle} onChangeText={setNotifTitle} placeholder="e.g. New Feature Available!" />
        <InputField label="Message" value={notifBody} onChangeText={setNotifBody} placeholder="Enter message..." multiline numberOfLines={4} style={{ minHeight: 90, textAlignVertical: 'top' }} />
        {notifResult && (
          <View style={[styles.resultBanner, { backgroundColor: notifResult.includes('Failed') || notifResult.includes('error') ? '#FF3B3020' : '#34C75920' }]}>
            <Text style={{ fontSize: 13, color: notifResult.includes('Failed') || notifResult.includes('error') ? '#FF3B30' : '#34C759', fontFamily: 'Inter_500Medium' }}>{notifResult}</Text>
          </View>
        )}
        <ActionButton title={notifSending ? 'Sending...' : 'Send Notification'} onPress={sendNotificationToAll} loading={notifSending} color="#FF6B35" />
      </SectionCard>

      {/* Send SMS */}
      <SectionCard title="Send SMS" accent="#34C759">
        <Text style={styles.inputLabel}>Target Audience</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
          {NOTIF_ROLE_OPTIONS.map(opt => (
            <Pressable key={opt.key} onPress={() => setSmsTargetRole(opt.key)}
              style={[styles.filterChip, smsTargetRole === opt.key && { backgroundColor: opt.color, borderColor: opt.color }]}>
              <Text style={[styles.filterChipText, smsTargetRole === opt.key && { color: '#FFF' }]}>{opt.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <InputField label="SMS Message" value={smsBody} onChangeText={setSmsBody} placeholder="Type your SMS..." multiline numberOfLines={4} style={{ minHeight: 90, textAlignVertical: 'top' }} />
        {smsResult && (
          <View style={[styles.resultBanner, { backgroundColor: smsResult.includes('Failed') || smsResult.includes('error') ? '#FF3B3020' : '#34C75920' }]}>
            <Text style={{ fontSize: 13, color: smsResult.includes('Failed') || smsResult.includes('error') ? '#FF3B30' : '#34C759', fontFamily: 'Inter_500Medium' }}>{smsResult}</Text>
          </View>
        )}
        <ActionButton title={smsSending ? 'Sending...' : 'Send SMS'} onPress={sendSMS} loading={smsSending} color="#34C759" />
      </SectionCard>
    </ScrollView>
  );

  const renderEmail = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
      {/* Email Stats */}
      {emailStatsLoading ? (
        <ActivityIndicator color={PRIMARY} style={{ marginTop: 20 }} />
      ) : emailStats ? (
        <View style={styles.statsGrid}>
          <StatCard icon="mail-outline" value={emailStats.totalWithEmail} label="Have Email" color="#007AFF" />
          <StatCard icon="checkmark-circle-outline" value={emailStats.subscribed} label="Subscribed" color="#34C759" />
          <StatCard icon="close-circle-outline" value={emailStats.unsubscribed} label="Unsubscribed" color="#FF3B30" />
        </View>
      ) : null}

      {/* Compose Email */}
      <SectionCard title="Compose Email Campaign" accent="#007AFF">
        <Text style={styles.inputLabel}>Target Audience</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
          {NOTIF_ROLE_OPTIONS.map(opt => (
            <Pressable key={opt.key} onPress={() => setEmailTargetRole(opt.key)}
              style={[styles.filterChip, emailTargetRole === opt.key && { backgroundColor: opt.color, borderColor: opt.color }]}>
              <Text style={[styles.filterChipText, emailTargetRole === opt.key && { color: '#FFF' }]}>{opt.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <InputField label="Subject *" value={emailSubject} onChangeText={setEmailSubject} placeholder="Email subject..." />
        <InputField label="Message *" value={emailBody} onChangeText={setEmailBody} placeholder="Email content..." multiline numberOfLines={6} style={{ minHeight: 120, textAlignVertical: 'top' }} />
        <View style={styles.scheduleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.inputLabel}>Schedule Date (optional)</Text>
            <TextInput style={styles.input} value={emailScheduleDate} onChangeText={setEmailScheduleDate} placeholder="YYYY-MM-DD" placeholderTextColor={C.textTertiary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.inputLabel}>Time</Text>
            <TextInput style={styles.input} value={emailScheduleTime} onChangeText={setEmailScheduleTime} placeholder="HH:MM" placeholderTextColor={C.textTertiary} />
          </View>
        </View>
        {emailResult && (
          <View style={[styles.resultBanner, { backgroundColor: emailResult.includes('Failed') || emailResult.includes('error') ? '#FF3B3020' : '#34C75920' }]}>
            <Text style={{ fontSize: 13, color: emailResult.includes('Failed') || emailResult.includes('error') ? '#FF3B30' : '#34C759', fontFamily: 'Inter_500Medium' }}>{emailResult}</Text>
          </View>
        )}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <ActionButton title={emailSending ? 'Sending...' : 'Send Now'} onPress={() => sendBulkEmail(false)} loading={emailSending} color="#007AFF" style={{ flex: 1 }} />
          {(emailScheduleDate && emailScheduleTime) ? (
            <ActionButton title="Schedule" onPress={() => sendBulkEmail(true)} loading={emailSending} color="#5E8BFF" style={{ flex: 1 }} />
          ) : null}
        </View>
      </SectionCard>

      {/* Campaign History */}
      {emailCampaignList.length > 0 && (
        <SectionCard title={`Campaign History (${emailCampaignList.length})`}>
          {emailCampaignList.map(camp => (
            <View key={camp.id} style={[styles.activityRow, { flexDirection: 'column', alignItems: 'flex-start', gap: 4 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
                <Text style={styles.activityLabel} numberOfLines={1}>{camp.subject}</Text>
                <View style={[styles.badge, { backgroundColor: camp.status === 'sent' ? '#34C75920' : camp.status === 'scheduled' ? '#FFD60A20' : '#FF3B3020' }]}>
                  <Text style={[styles.badgeText, { color: camp.status === 'sent' ? '#34C759' : camp.status === 'scheduled' ? '#FFD60A' : '#FF3B30' }]}>{camp.status}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {camp.sent ? <Text style={styles.activityMeta}>{camp.sent} sent</Text> : null}
                {camp.failed ? <Text style={[styles.activityMeta, { color: '#FF3B30' }]}>{camp.failed} failed</Text> : null}
                <Text style={styles.activityMeta}>{new Date(camp.createdAt).toLocaleDateString()}</Text>
              </View>
            </View>
          ))}
        </SectionCard>
      )}
    </ScrollView>
  );

  const renderPayouts = () => {
    const pending = payoutsData.filter(p => p.status === 'pending');
    const completed = payoutsData.filter(p => p.status !== 'pending');
    const fmt = (v: number) => `₹${Math.round((v || 0) / 100).toLocaleString('en-IN')}`;
    const renderPayoutCard = (p: any) => (
      <View key={p.id} style={styles.listCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <Text style={styles.listCardTitle}>{p.teacherName || 'Unknown Teacher'}</Text>
          <View style={[styles.statusBadge, { backgroundColor: p.status === 'paid' ? '#34C75920' : p.status === 'rejected' ? '#FF3B3020' : '#FFD60A20' }]}>
            <Text style={[styles.statusText, { color: p.status === 'paid' ? '#34C759' : p.status === 'rejected' ? '#FF3B30' : '#FFD60A' }]}>{p.status}</Text>
          </View>
        </View>
        <Text style={styles.listCardSub}>Amount: {fmt(Math.round((p.amount || 0) / 100))}</Text>
        {p.upiId ? <Text style={styles.listCardMeta}>UPI: {p.upiId}</Text> : null}
        {p.notes ? <Text style={[styles.listCardMeta, { fontStyle: 'italic' }]}>{p.notes}</Text> : null}
        <Text style={styles.listCardMeta}>Requested: {new Date(p.requestedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
        {p.status === 'pending' && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <Pressable style={[styles.actionChip, { flex: 1, justifyContent: 'center', backgroundColor: '#34C75920' }]} disabled={payoutsUpdating === p.id}
              onPress={() => Alert.alert('Mark Paid', `Mark ${fmt(Math.round((p.amount || 0) / 100))} as paid?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Mark Paid', onPress: () => updatePayout(p.id, 'paid', '') }])}>
              {payoutsUpdating === p.id ? <ActivityIndicator size="small" color="#34C759" /> : <Text style={{ color: '#34C759', fontSize: 12, fontFamily: 'Inter_700Bold' }}>Mark Paid</Text>}
            </Pressable>
            <Pressable style={[styles.actionChip, { flex: 1, justifyContent: 'center', backgroundColor: '#FF3B3015' }]} disabled={payoutsUpdating === p.id}
              onPress={() => updatePayout(p.id, 'rejected', '')}>
              <Text style={{ color: '#FF3B30', fontSize: 12, fontFamily: 'Inter_700Bold' }}>Reject</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}
        refreshControl={<RefreshControl refreshing={payoutsLoading} onRefresh={fetchPayouts} tintColor={C.textTertiary} />}>
        {payoutsLoading && payoutsData.length === 0 ? (
          <ActivityIndicator color={PRIMARY} style={{ marginTop: 40 }} />
        ) : payoutsData.length === 0 ? (
          <View style={styles.emptyState}><Ionicons name="cash-outline" size={40} color={C.textTertiary} /><Text style={styles.emptyText}>No payout requests yet</Text></View>
        ) : (
          <>
            {pending.length > 0 && <><Text style={styles.sectionHeader}>Pending ({pending.length})</Text>{pending.map(renderPayoutCard)}</>}
            {completed.length > 0 && <><Text style={styles.sectionHeader}>Completed ({completed.length})</Text>{completed.map(renderPayoutCard)}</>}
          </>
        )}
      </ScrollView>
    );
  };

  const topInset = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Admin Panel</Text>
          <Text style={styles.headerSub}>{TABS.find(t => t.key === activeTab)?.label || 'Dashboard'}</Text>
        </View>
        <Pressable onPress={refreshData} style={styles.headerBack}>
          <Ionicons name="refresh-outline" size={20} color={C.textSecondary} />
        </Pressable>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarContent}>
          {TABS.map(tab => {
            const active = activeTab === tab.key;
            return (
              <Pressable key={tab.key} onPress={() => setActiveTab(tab.key)} style={[styles.tabItem, active && styles.tabItemActive]}>
                <Ionicons name={tab.icon} size={14} color={active ? '#FFF' : C.textSecondary} />
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Tab Content */}
      <View style={{ flex: 1 }}>
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'users' && renderUsers()}
        {activeTab === 'bookings' && renderBookings()}
        {activeTab === 'subscriptions' && renderSubscriptions()}
        {activeTab === 'insurance' && renderInsurance()}
        {activeTab === 'revenue' && renderRevenue()}
        {activeTab === 'posts' && renderPosts()}
        {activeTab === 'jobs' && renderJobs()}
        {activeTab === 'ads' && renderAds()}
        {activeTab === 'listings' && renderListings()}
        {activeTab === 'links' && renderLinks()}
        {activeTab === 'notifications' && renderNotifications()}
        {activeTab === 'email' && renderEmail()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  loadingScreen: {
    flex: 1, backgroundColor: C.background, justifyContent: 'center', alignItems: 'center', gap: 12,
  },
  loadingText: {
    color: C.textSecondary, fontFamily: 'Inter_500Medium', fontSize: 14,
  },
  accessDeniedScreen: {
    flex: 1, backgroundColor: C.background, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, gap: 12,
  },
  accessDeniedTitle: {
    fontSize: 22, fontFamily: 'Inter_700Bold', color: C.text,
  },
  accessDeniedText: {
    fontSize: 14, fontFamily: 'Inter_400Regular', color: C.textSecondary, textAlign: 'center',
  },
  accessDeniedBtn: {
    marginTop: 12, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: PRIMARY, borderRadius: 10,
  },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border, gap: 12,
  },
  headerBack: {
    padding: 6, borderRadius: 8, backgroundColor: C.surfaceElevated,
  },
  headerTitle: {
    fontSize: 18, fontFamily: 'Inter_700Bold', color: C.text,
  },
  headerSub: {
    fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textTertiary,
  },

  // Tab Bar
  tabBar: {
    backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  tabBarContent: {
    paddingHorizontal: 12, paddingVertical: 8, gap: 6,
  },
  tabItem: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: C.surfaceElevated, borderWidth: 1, borderColor: C.border,
  },
  tabItemActive: {
    backgroundColor: PRIMARY, borderColor: PRIMARY,
  },
  tabLabel: {
    fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.textSecondary,
  },
  tabLabelActive: {
    color: '#FFF',
  },

  // Tab Content
  tabContent: {
    padding: 12, paddingBottom: 80, gap: 12,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  statCard: {
    flex: 1, minWidth: '44%', backgroundColor: C.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: C.border, borderTopWidth: 3, gap: 6,
  },
  statIconWrap: {
    width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  statValue: {
    fontSize: 22, fontFamily: 'Inter_700Bold', color: C.text,
  },
  statLabel: {
    fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary,
  },

  // Section Card
  sectionCard: {
    backgroundColor: C.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border,
  },
  sectionCardTitle: {
    fontSize: 15, fontFamily: 'Inter_700Bold', color: C.text, marginBottom: 12,
  },
  sectionHeader: {
    fontSize: 14, fontFamily: 'Inter_700Bold', color: C.textSecondary,
    paddingHorizontal: 2, paddingVertical: 4, marginTop: 4,
  },

  // Role Stats
  roleRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: C.surfaceElevated,
  },
  roleLabel: {
    fontSize: 12, fontFamily: 'Inter_500Medium', color: C.textSecondary,
  },
  roleCount: {
    fontSize: 13, fontFamily: 'Inter_700Bold', minWidth: 28, textAlign: 'right',
  },
  roleIconWrap: {
    width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },

  // Activity
  activityRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.surfaceElevated,
  },
  activityLabel: {
    fontSize: 13, fontFamily: 'Inter_400Regular', color: C.text, flex: 1,
  },
  activityValue: {
    fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.text,
  },
  activityMeta: {
    fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textTertiary,
  },

  // User Cards
  userCard: {
    backgroundColor: C.surface, borderRadius: 14, marginBottom: 10,
    borderWidth: 1, borderColor: C.border, overflow: 'hidden',
  },
  userCardRow: {
    flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12,
  },
  userAvatar: {
    width: 44, height: 44, borderRadius: 22,
  },
  userAvatarFallback: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
  },
  userAvatarText: {
    fontSize: 14, fontFamily: 'Inter_700Bold',
  },
  userName: {
    fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.text, flex: 1,
  },
  userSub: {
    fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textTertiary,
  },
  userExpanded: {
    paddingHorizontal: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: C.surfaceElevated,
    paddingTop: 12,
  },
  expandedLabel: {
    fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.textTertiary, marginBottom: 6,
  },
  expandedDetail: {
    fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textSecondary,
  },

  // Role Picker
  rolePicker: {
    marginTop: 8, backgroundColor: C.surfaceElevated, borderRadius: 10, overflow: 'hidden',
    borderWidth: 1, borderColor: C.border,
  },
  rolePickerItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 11, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },

  // Badges
  badge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    backgroundColor: C.surfaceElevated,
  },
  badgeText: {
    fontSize: 11, fontFamily: 'Inter_600SemiBold', color: C.textSecondary,
  },

  // List Cards
  listCard: {
    backgroundColor: C.surface, borderRadius: 12, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: C.border,
  },
  listCardTitle: {
    fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.text,
  },
  listCardSub: {
    fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 4,
  },
  listCardMeta: {
    fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textTertiary, marginTop: 3,
  },

  // Status
  statusBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  statusText: {
    fontSize: 11, fontFamily: 'Inter_600SemiBold', textTransform: 'capitalize',
  },
  statusToggle: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 10, backgroundColor: C.surfaceElevated,
    borderWidth: 2, borderColor: 'transparent',
  },

  // Inputs
  inputLabel: {
    fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.textSecondary, marginBottom: 4,
  },
  input: {
    borderWidth: 1, borderColor: C.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
    color: C.text, backgroundColor: C.surface, fontFamily: 'Inter_400Regular',
  },

  // Subscription
  subAmountRow: {
    marginTop: 4,
  },

  // Search
  searchBar: {
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6, gap: 8, backgroundColor: C.surface,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  searchInputWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.surfaceElevated,
    borderRadius: 10, paddingHorizontal: 10, borderWidth: 1, borderColor: C.border,
  },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: C.surfaceElevated, borderWidth: 1, borderColor: C.border,
  },
  filterChipText: {
    fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.textSecondary,
  },
  resultCount: {
    fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textTertiary,
  },
  downloadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#1C3A57', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    borderWidth: 1, borderColor: '#2A5080',
  },

  // Action buttons
  actionBtn: {
    paddingVertical: 13, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 8,
  },
  actionBtnText: {
    color: '#FFF', fontSize: 15, fontFamily: 'Inter_700Bold',
  },
  actionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  },
  smallBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, alignSelf: 'flex-start',
  },

  // Notifications
  miniStatCard: {
    flex: 1, alignItems: 'center', backgroundColor: C.surfaceElevated, borderRadius: 10, padding: 12,
  },
  miniStatValue: {
    fontSize: 22, fontFamily: 'Inter_700Bold', color: C.text,
  },
  miniStatLabel: {
    fontSize: 10, fontFamily: 'Inter_400Regular', color: C.textTertiary, marginTop: 2,
  },
  resultBanner: {
    borderRadius: 8, padding: 10, marginBottom: 8,
  },

  // Email
  scheduleRow: {
    flexDirection: 'row', gap: 10, marginBottom: 12,
  },

  // Empty State
  emptyState: {
    alignItems: 'center', paddingVertical: 48, gap: 10,
  },
  emptyText: {
    fontSize: 14, fontFamily: 'Inter_400Regular', color: C.textSecondary,
  },

  // User card compatibility styles
  userInfo: { flex: 1, gap: 8 },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  registeredBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  registeredText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#34C759' },
  userMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userRoleBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  userRoleText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  userCityRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  userCity: { fontSize: 12, color: C.textTertiary, fontFamily: 'Inter_400Regular' },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  phoneText: { fontSize: 12, color: C.textTertiary, fontFamily: 'Inter_400Regular' },
  userAvatarImg: { width: 44, height: 44, borderRadius: 22 },
  userDetails: { padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: C.border },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  detailLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.textTertiary, minWidth: 80 },
  detailValue: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.text, flex: 1 },
  detailPostCount: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.textTertiary, marginTop: 8 },
  userCardTop: { flexDirection: 'row', alignItems: 'flex-start', padding: 12, gap: 12 },
});
