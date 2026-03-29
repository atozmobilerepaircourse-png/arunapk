import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, Platform, Alert, ScrollView, TextInput, Switch, ActivityIndicator, RefreshControl, TouchableOpacity
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Colors from '@/constants/colors';
import { useApp } from '@/lib/context';
import { ROLE_LABELS, UserRole, ADMIN_PHONE, SubscriptionSetting } from '@/lib/types';
import { apiRequest, getApiUrl } from '@/lib/query-client';
import { openLink } from '@/lib/open-link';
import { invalidateInsuranceCache } from '@/lib/use-insurance-settings';

const C = Colors.light;
const PRIMARY = '#FF6B2C';

type AdminTab = 'dashboard' | 'users' | 'customers' | 'technicians' | 'teachers' | 'suppliers' | 'shopkeepers' | 'blocked-users' | 'deleted-users' | 'products' | 'orders' | 'reports' | 'settings' | 'posts' | 'jobs' | 'bookings' | 'subscriptions' | 'revenue' | 'links' | 'notifications' | 'payouts' | 'email' | 'insurance' | 'ads' | 'listings' | 'protection-plans' | 'protection-claims';

const ROLE_COLORS: Record<string, string> = {
  technician: '#34C759',
  teacher: '#FFD60A',
  supplier: '#FF6B2C',
  shopkeeper: '#8B5CF6',
  job_provider: '#5E8BFF',
  customer: '#FF2D55',
  admin: '#AF52DE',
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
  return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: keyof typeof Ionicons.glyphMap; color: string }) {
  return (
    <View style={[ss.statCard]}>
      <View style={[ss.statIconBox, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={ss.statValue}>{value}</Text>
      <Text style={ss.statLabel}>{label}</Text>
    </View>
  );
}

// ─── SectionCard ──────────────────────────────────────────────────────────────
function SectionCard({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[ss.sectionCard, style]}>{children}</View>;
}

// ─── InputField ───────────────────────────────────────────────────────────────
function InputField({ label, value, onChangeText, placeholder, multiline, keyboardType, autoCapitalize, autoCorrect }: any) {
  return (
    <View style={{ marginBottom: 12 }}>
      {label ? <Text style={ss.inputLabel}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.textTertiary}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize || 'none'}
        autoCorrect={autoCorrect ?? false}
        style={[ss.input, multiline && { minHeight: 100, textAlignVertical: 'top' }]}
      />
    </View>
  );
}

// ─── ActionButton ─────────────────────────────────────────────────────────────
function ActionButton({ label, onPress, color = PRIMARY, loading = false, icon, disabled = false, style }: any) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[ss.actionBtn, { backgroundColor: disabled || loading ? '#ccc' : color }, style]}
    >
      {loading
        ? <ActivityIndicator size="small" color="#FFF" />
        : icon ? <Ionicons name={icon} size={16} color="#FFF" style={{ marginRight: 6 }} /> : null}
      {!loading && <Text style={ss.actionBtnText}>{label}</Text>}
    </Pressable>
  );
}

// ─── UserDetailCard ───────────────────────────────────────────────────────────
function UserDetailCard({ user, onBlock, onVerify, onDelete, blockingId, verifyingId, deletingId }: {
  user: any;
  onBlock: (id: string, name: string, blocked: boolean) => void;
  onVerify: (id: string, name: string, verified: boolean) => void;
  onDelete: (id: string, name: string) => void;
  blockingId?: string;
  verifyingId?: string;
  deletingId?: string;
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
  const isBlockingThisUser = blockingId === user.id;
  const isVerifyingThisUser = verifyingId === user.id;
  const isDeletingThisUser = deletingId === user.id;

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

  const ROLES_LIST: UserRole[] = ['admin', 'technician', 'teacher', 'supplier', 'shopkeeper', 'customer', 'job_provider'];

  const handleCardPress = () => {
    console.log('📋 [USER CARD] Toggling expand for:', user.name, '| was expanded:', expanded);
    setShowRolePicker(false); 
    setExpanded(!expanded);
  };

  const handleDeletePress = (e: any) => {
    console.log('=== DELETE HANDLER CALLED ===');
    console.log('Event:', e);
    console.log('User ID:', user.id);
    console.log('User Name:', user.name);
    console.log('onDelete function exists:', typeof onDelete);
    try {
      if (e?.stopPropagation) {
        e.stopPropagation();
        console.log('✓ Event propagation stopped');
      }
      console.log('Calling onDelete with:', user.id, user.name);
      onDelete(user.id, user.name);
      console.log('✓ onDelete called successfully');
    } catch (err) {
      console.error('❌ Error in handleDeletePress:', err);
    }
  };

  return (
    <View style={[ss.userCard, isBlocked && { borderColor: '#FF3B30', borderWidth: 1.5 }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <TouchableOpacity activeOpacity={0.7} onPress={handleCardPress} style={{ flex: 1 }}>
          <View style={ss.userCardTop}>
            {profile?.avatar
              ? <Image source={{ uri: profile.avatar }} style={[ss.userAvatarImg, isBlocked && { opacity: 0.5 }]} contentFit="cover" />
              : <View style={[ss.userAvatar, { backgroundColor: roleColor + '20' }, isBlocked && { opacity: 0.5 }]}>
                <Text style={[ss.userAvatarText, { color: roleColor }]}>{getInitials(user.name)}</Text>
              </View>}
            <View style={ss.userCardInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={ss.userName} numberOfLines={1}>{user.name}</Text>
                {isVerified && <Ionicons name="checkmark-circle" size={14} color="#34C759" />}
                {isBlocked && <View style={{ backgroundColor: '#FF3B3020', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                  <Text style={{ fontSize: 9, color: '#FF3B30', fontFamily: 'Inter_700Bold' }}>BLOCKED</Text>
                </View>}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <View style={[ss.roleBadge, { backgroundColor: roleColor + '20' }]}>
                  <Text style={[ss.roleBadgeText, { color: roleColor }]}>{ROLE_LABELS[user.role as UserRole] || user.role}</Text>
                </View>
                {user.city ? <Text style={ss.userCity}>{user.city}</Text> : null}
              </View>
            </View>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={C.textTertiary} />
          </View>
        </TouchableOpacity>

        {/* Delete button - RIGHT SIDE */}
        <TouchableOpacity 
          onPress={() => {
            console.log('DELETE PRESSED FOR USER:', user.id, user.name);
            handleDeletePress(null);
          }}
          activeOpacity={0.6}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{
            padding: 12,
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 999,
            width: 50,
            height: 50
          }}
        >
          <Ionicons name="trash-outline" size={18} color="#FF3B30" />
        </TouchableOpacity>
      </View>

      {expanded && (
        <View style={ss.userCardExpanded}>
          <View style={ss.userInfoRow}>
            <Ionicons name="call-outline" size={13} color={C.textTertiary} />
            <Text style={ss.userInfoText}>{profile?.phone || 'No phone'}</Text>
          </View>
          {profile?.email
            ? <View style={ss.userInfoRow}>
              <Ionicons name="mail-outline" size={13} color={C.textTertiary} />
              <Text style={ss.userInfoText}>{profile.email}</Text>
            </View> : null}
          {user.isRegistered
            ? <View style={ss.userInfoRow}>
              <Ionicons name="checkmark-circle-outline" size={13} color="#34C759" />
              <Text style={[ss.userInfoText, { color: '#34C759' }]}>Registered</Text>
            </View>
            : <View style={ss.userInfoRow}>
              <Ionicons name="time-outline" size={13} color="#FFD60A" />
              <Text style={[ss.userInfoText, { color: '#FFD60A' }]}>Not Registered</Text>
            </View>}

          {roleStatus && (
            <View style={{ backgroundColor: roleStatus.ok ? '#34C75915' : '#FF3B3015', padding: 8, borderRadius: 8, marginBottom: 8 }}>
              <Text style={{ fontSize: 12, color: roleStatus.ok ? '#34C759' : '#FF3B30', fontFamily: 'Inter_500Medium' }}>{roleStatus.msg}</Text>
            </View>
          )}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
            <TouchableOpacity activeOpacity={0.7}
              onPress={() => setShowRolePicker(!showRolePicker)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.surfaceElevated, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: C.border }}
            >
              {changingRole ? <ActivityIndicator size="small" color={PRIMARY} /> : <Ionicons name="swap-horizontal" size={13} color={PRIMARY} />}
              <Text style={{ fontSize: 12, color: PRIMARY, fontFamily: 'Inter_600SemiBold' }}>Change Role</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.7}
              onPress={() => onBlock(user.id, user.name, !isBlocked)}
              disabled={isBlockingThisUser}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: isBlocked ? '#34C75915' : '#FF3B3015', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: isBlocked ? '#34C75940' : '#FF3B3040', opacity: isBlockingThisUser ? 0.6 : 1 }}
            >
              {isBlockingThisUser ? <ActivityIndicator size="small" color={isBlocked ? '#34C759' : '#FF3B30'} /> : <Ionicons name={isBlocked ? 'lock-open-outline' : 'ban-outline'} size={13} color={isBlocked ? '#34C759' : '#FF3B30'} />}
              <Text style={{ fontSize: 12, color: isBlocked ? '#34C759' : '#FF3B30', fontFamily: 'Inter_600SemiBold' }}>{isBlockingThisUser ? 'Working...' : (isBlocked ? 'Unblock' : 'Block')}</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.7}
              onPress={() => onVerify(user.id, user.name, !isVerified)}
              disabled={isVerifyingThisUser}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: isVerified ? '#5E8BFF15' : '#34C75915', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: isVerified ? '#5E8BFF40' : '#34C75940', opacity: isVerifyingThisUser ? 0.6 : 1 }}
            >
              {isVerifyingThisUser ? <ActivityIndicator size="small" color={isVerified ? '#5E8BFF' : '#34C759'} /> : <Ionicons name={isVerified ? 'close-circle-outline' : 'checkmark-circle-outline'} size={13} color={isVerified ? '#5E8BFF' : '#34C759'} />}
              <Text style={{ fontSize: 12, color: isVerified ? '#5E8BFF' : '#34C759', fontFamily: 'Inter_600SemiBold' }}>{isVerifyingThisUser ? 'Working...' : (isVerified ? 'Unverify' : 'Verify')}</Text>
            </TouchableOpacity>
            <Pressable
              onPress={() => {
                console.log('🗑️ [DELETE BUTTON] Clicked for user:', { id: user.id, name: user.name });
                onDelete(user.id, user.name);
              }}
              disabled={isDeletingThisUser}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FF3B3010', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#FF3B3030', opacity: isDeletingThisUser ? 0.6 : (pressed ? 0.7 : 1) })}
            >
              {isDeletingThisUser ? <ActivityIndicator size="small" color="#FF3B30" /> : <Ionicons name="trash-outline" size={13} color="#FF3B30" />}
              <Text style={{ fontSize: 12, color: '#FF3B30', fontFamily: 'Inter_600SemiBold' }}>{isDeletingThisUser ? 'Deleting...' : 'Delete'}</Text>
            </Pressable>
          </View>

          {showRolePicker && (
            <View style={{ marginTop: 10, backgroundColor: C.surfaceElevated, borderRadius: 10, padding: 10, gap: 6, borderWidth: 1, borderColor: C.border }}>
              <Text style={{ fontSize: 11, color: C.textTertiary, fontFamily: 'Inter_600SemiBold', marginBottom: 2 }}>SELECT NEW ROLE</Text>
              {ROLES_LIST.map(r => (
                <TouchableOpacity key={r} activeOpacity={0.7} onPress={() => changeRole(r)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: 8, backgroundColor: user.role === r ? ROLE_COLORS[r] + '15' : 'transparent' }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ROLE_COLORS[r] }} />
                  <Text style={{ fontSize: 13, color: user.role === r ? ROLE_COLORS[r] : C.text, fontFamily: user.role === r ? 'Inter_600SemiBold' : 'Inter_400Regular' }}>
                    {ROLE_LABELS[r]}
                  </Text>
                  {user.role === r && <Ionicons name="checkmark" size={14} color={ROLE_COLORS[r]} style={{ marginLeft: 'auto' }} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Main AdminScreen ──────────────────────────────────────────────────────────
export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const { profile, posts, jobs, conversations, deletePost, allProfiles, refreshData } = useApp();
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [refreshing, setRefreshing] = useState(false);

  // Subscription state
  const [subscriptions, setSubscriptions] = useState<SubscriptionSetting[]>([]);
  const [subLoading, setSubLoading] = useState(false);

  // Links state
  const [liveUrl, setLiveUrl] = useState('');
  const [schematicsUrl, setSchematicsUrl] = useState('');
  const [webToolsUrl, setWebToolsUrl] = useState('');
  const [whatsappSupportUrl, setWhatsappSupportUrl] = useState('');
  const [linksLoading, setLinksLoading] = useState(false);

  // User management
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | UserRole>('all');

  // Revenue
  const [revenueData, setRevenueData] = useState<any>(null);
  const [revenueLoading, setRevenueLoading] = useState(false);

  // Payouts
  const [payoutsData, setPayoutsData] = useState<any[]>([]);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [payoutsUpdating, setPayoutsUpdating] = useState<string | null>(null);

  // Active subscriptions
  const [activeSubsList, setActiveSubsList] = useState<any[]>([]);
  const [activeSubsLoading, setActiveSubsLoading] = useState(false);

  // Protection Plans
  const [protectionPlans, setProtectionPlans] = useState<any[]>([]);
  const [protectionPlansLoading, setProtectionPlansLoading] = useState(false);
  const [protectionClaims, setProtectionClaims] = useState<any[]>([]);
  const [protectionClaimsLoading, setProtectionClaimsLoading] = useState(false);
  const [protectionPlanFilter, setProtectionPlanFilter] = useState<string>('all');
  const [protectionPlanSearchQuery, setProtectionPlanSearchQuery] = useState('');
  const [protectionClaimFilter, setProtectionClaimFilter] = useState<string>('all');

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
  const [insuranceYearlyPrice, setInsuranceYearlyPrice] = useState('1499');
  const [insuranceMonthlyPrice, setInsuranceMonthlyPrice] = useState('199');
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

  // Repair bookings
  const [repairBookings, setRepairBookings] = useState<any[]>([]);
  const [repairLoading, setRepairLoading] = useState(false);
  const [repairFilter, setRepairFilter] = useState<'all' | 'pending' | 'assigned' | 'completed' | 'cancelled'>('all');
  const [assigningBooking, setAssigningBooking] = useState<any>(null);
  const [technicianSearch, setTechnicianSearch] = useState('');

  // User action tracking (for loading states)
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [blockingUserId, setBlockingUserId] = useState<string | null>(null);
  const [verifyingUserId, setVerifyingUserId] = useState<string | null>(null);

  const webTopInset = Platform.OS === 'web' ? 67 : insets.top;
  const isMobile = Platform.OS !== 'web' || (typeof window !== 'undefined' && window.innerWidth < 768);

  // ── Admin check ──
  const cleanProfilePhone = (profile?.phone || '').replace(/\D/g, '');
  const isAdmin = profile?.role === 'admin' || cleanProfilePhone === '8179142535' || cleanProfilePhone === '9876543210';

  useEffect(() => {
    if (profile && !isAdmin) {
      Alert.alert('Access Denied', 'You do not have admin access.');
      router.back();
    }
  }, [isAdmin, profile]);

  // ── Fetch functions ──
  const fetchRepairBookings = useCallback(async () => {
    setRepairLoading(true);
    try {
      const res = await apiRequest('GET', '/api/repair-bookings');
      const data = await res.json();
      if (Array.isArray(data)) setRepairBookings(data);
    } catch (err) { console.warn('repair bookings:', err); }
    finally { setRepairLoading(false); }
  }, []);

  const updateBookingStatus = async (id: string, status: string) => {
    try {
      await apiRequest('PATCH', `/api/repair-bookings/${id}/status`, { status });
      fetchRepairBookings();
    } catch { Alert.alert('Error', 'Failed to update booking status'); }
  };

  const assignTechnician = async (bookingId: string, technician: any) => {
    try {
      await apiRequest('PATCH', `/api/repair-bookings/${bookingId}/status`, {
        status: 'assigned', technicianId: technician.id, technicianName: technician.name, technicianPhone: technician.phone || '',
      });
      setAssigningBooking(null);
      setTechnicianSearch('');
      fetchRepairBookings();
      Alert.alert('Success', `Assigned ${technician.name} to booking`);
    } catch { Alert.alert('Error', 'Failed to assign technician'); }
  };

  const fetchAds = async () => {
    setAdsLoading(true);
    try {
      const res = await apiRequest('GET', '/api/ads');
      const data = await res.json();
      if (Array.isArray(data)) setAdsList(data);
    } catch { } finally { setAdsLoading(false); }
  };

  const fetchAllProducts = async () => {
    setListingsLoading(true);
    try {
      const res = await apiRequest('GET', '/api/products');
      const data = await res.json();
      console.log('[Admin] Products fetch response:', { ok: res.ok, dataLength: Array.isArray(data) ? data.length : typeof data, data });
      if (Array.isArray(data)) {
        setAllProducts(data);
      } else {
        console.warn('[Admin] Products response is not an array:', data);
        setAllProducts([]);
      }
    } catch (e) {
      console.error('[Admin] Products fetch error:', e);
      Alert.alert('Error', 'Failed to load products');
    } finally {
      setListingsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'bookings' || activeTab === 'orders') fetchRepairBookings();
    if (activeTab === 'ads') fetchAds();
    if (activeTab === 'products' || activeTab === 'listings') fetchAllProducts();
  }, [activeTab]);

  const createAd = async () => {
    if (!newAdTitle.trim()) { Alert.alert('Error', 'Title is required'); return; }
    setAdSaving(true);
    try {
      await apiRequest('POST', '/api/ads', { title: newAdTitle, description: newAdDescription, imageUrl: newAdImageUrl, linkUrl: newAdLinkUrl });
      setNewAdTitle(''); setNewAdDescription(''); setNewAdImageUrl(''); setNewAdLinkUrl('');
      await fetchAds();
    } catch (e) { Alert.alert('Error', 'Failed to create ad'); }
    finally { setAdSaving(false); }
  };

  const toggleAd = async (id: string, active: boolean) => {
    try {
      await apiRequest('PATCH', `/api/ads/${id}`, { active: !active });
      await fetchAds();
    } catch { Alert.alert('Error', 'Failed to toggle ad'); }
  };

  const deleteAd = async (id: string) => {
    Alert.alert('Delete Ad', 'Remove this ad?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          try { await apiRequest('DELETE', `/api/ads/${id}`); await fetchAds(); }
          catch { Alert.alert('Error', 'Failed to delete ad'); }
        }},
    ]);
  };

  const deleteListing = async (id: string) => {
    console.log('[Delete] deleteListing called with id:', id);
    Alert.alert('Delete Listing', 'Remove this listing permanently?', [
      { text: 'Cancel', style: 'cancel', onPress: () => console.log('[Delete] Cancelled') },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          console.log('[Delete] Delete confirmed for product:', id);
          try {
            const res = await apiRequest('DELETE', `/api/admin/products/${id}`);
            const data = await res.json();
            console.log('[Delete] Response:', { status: res.status, data });
            if (data.success || res.status === 404) {
              console.log('[Delete] Success! Refreshing products list');
              await fetchAllProducts();
              Alert.alert('Success', 'Listing deleted');
            } else {
              Alert.alert('Error', data.message || 'Failed to delete');
            }
          } catch (e) {
            console.error('[Delete] Error:', e);
            Alert.alert('Error', 'Failed to delete listing');
          }
        }},
    ]);
  };

  const fetchInsuranceSettings = useCallback(async () => {
    setInsuranceLoading(true);
    try {
      const res = await apiRequest('GET', '/api/settings/insurance');
      const data = await res.json();
      if (data.settings) {
        const s = data.settings;
        if (s.planName) setInsurancePlanName(s.planName);
        if (s.protectionPlanPrice) setInsurancePlanPrice(String(s.protectionPlanPrice));
        if (s.yearlyPrice) setInsuranceYearlyPrice(String(s.yearlyPrice));
        if (s.monthlyPrice) setInsuranceMonthlyPrice(String(s.monthlyPrice));
        if (s.repairDiscount) setInsuranceDiscount(String(s.repairDiscount));
        if (s.status) setInsuranceStatus(s.status);
      }
    } catch (e) { console.warn('insurance settings:', e); }
    finally { setInsuranceLoading(false); }
  }, []);

  useEffect(() => {
    if (activeTab === 'insurance') fetchInsuranceSettings();
  }, [activeTab, fetchInsuranceSettings]);

  const saveInsuranceSettings = async () => {
    setInsuranceSaving(true);
    try {
      await apiRequest('PUT', '/api/admin/settings/insurance', {
        planName: insurancePlanName,
        protectionPlanPrice: parseInt(insurancePlanPrice, 10),
        yearlyPrice: parseInt(insuranceYearlyPrice, 10),
        monthlyPrice: parseInt(insuranceMonthlyPrice, 10),
        repairDiscount: parseInt(insuranceDiscount, 10),
        status: insuranceStatus,
      });
      // Clear frontend cache so it fetches fresh prices
      invalidateInsuranceCache();
      setInsuranceSaved(true);
      setTimeout(() => setInsuranceSaved(false), 2500);
    } catch (e: any) { Alert.alert('Error', e.message || 'Failed to save settings'); }
    finally { setInsuranceSaving(false); }
  };

  const fetchSubscriptions = useCallback(async () => {
    setSubLoading(true);
    try {
      const res = await apiRequest('GET', '/api/subscription-settings');
      const data = await res.json();
      setSubscriptions(data);
    } catch (e) { console.warn('subscriptions:', e); }
    finally { setSubLoading(false); }
  }, []);

  useEffect(() => {
    if (activeTab === 'subscriptions') fetchSubscriptions();
    if (activeTab === 'subscriptions') fetchActiveSubscriptions();
  }, [activeTab, fetchSubscriptions]);

  const toggleSubscription = async (role: string, enabled: boolean) => {
    try {
      await apiRequest('PATCH', `/api/subscription-settings/${role}`, { enabled: enabled ? 1 : 0 });
      await fetchSubscriptions();
    } catch { Alert.alert('Error', 'Failed to update subscription'); }
  };

  const updateSubAmount = async (role: string, amount: string) => {
    try { await apiRequest('PATCH', `/api/subscription-settings/${role}`, { amount }); }
    catch { console.warn('update sub amount:', role); }
  };

  const fetchLinks = useCallback(async () => {
    setLinksLoading(true);
    try {
      const res = await apiRequest('GET', '/api/app-settings');
      const data = await res.json();
      setLiveUrl(data.live_url || '');
      setSchematicsUrl(data.schematics_url || '');
      setWebToolsUrl(data.web_tools_url || '');
      setWhatsappSupportUrl(data.whatsapp_support_link || '');
    } catch (err) { console.warn('links:', err); }
    finally { setLinksLoading(false); }
  }, []);

  useEffect(() => {
    if (activeTab === 'links') fetchLinks();
  }, [activeTab]);

  const fetchPushStats = useCallback(async () => {
    setPushStatsLoading(true);
    try {
      const baseUrl = getApiUrl();
      const res = await fetch(`${baseUrl}/api/admin/push-stats?phone=${ADMIN_PHONE}`);
      const data = await res.json();
      setPushStats(data);
    } catch (e) { console.warn('push stats:', e); }
    finally { setPushStatsLoading(false); }
  }, []);

  useEffect(() => {
    if (activeTab === 'notifications') fetchPushStats();
  }, [activeTab, fetchPushStats]);

  const fetchRevenue = useCallback(async () => {
    setRevenueLoading(true);
    try {
      const res = await apiRequest('GET', '/api/admin/revenue');
      const data = await res.json();
      if (data.success) setRevenueData(data);
    } catch (err) { console.warn('revenue:', err); }
    finally { setRevenueLoading(false); }
  }, []);

  const fetchActiveSubscriptions = useCallback(async () => {
    setActiveSubsLoading(true);
    try {
      const res = await apiRequest('GET', '/api/admin/active-subscriptions');
      const data = await res.json();
      if (Array.isArray(data)) setActiveSubsList(data);
    } catch (err) { console.warn('active subs:', err); }
    finally { setActiveSubsLoading(false); }
  }, []);

  const fetchPayouts = useCallback(async () => {
    setPayoutsLoading(true);
    try {
      const res = await apiRequest('GET', '/api/admin/teacher-payouts');
      const data = await res.json();
      if (Array.isArray(data)) setPayoutsData(data);
    } catch (err) { console.warn('payouts:', err); }
    finally { setPayoutsLoading(false); }
  }, []);

  useEffect(() => {
    if (activeTab === 'revenue') { fetchRevenue(); fetchActiveSubscriptions(); }
    if (activeTab === 'payouts') fetchPayouts();
  }, [activeTab]);

  const updatePayout = async (id: string, status: string, adminNotes: string) => {
    setPayoutsUpdating(id);
    try {
      await apiRequest('PATCH', `/api/admin/teacher-payouts/${id}`, { status, adminNotes });
      await fetchPayouts();
    } catch { Alert.alert('Error', 'Failed to update payout'); }
    finally { setPayoutsUpdating(null); }
  };

  const fetchEmailStats = useCallback(async () => {
    setEmailStatsLoading(true);
    try {
      const res = await apiRequest('GET', '/api/admin/email-stats');
      const data = await res.json();
      if (data.stats) setEmailStats(data.stats);
      if (Array.isArray(data.campaigns)) setEmailCampaignList(data.campaigns);
    } catch (err) { console.warn('email stats:', err); }
    finally { setEmailStatsLoading(false); }
  }, []);

  useEffect(() => {
    if (activeTab === 'email') fetchEmailStats();
  }, [activeTab, fetchEmailStats]);

  // ── Protection Plans ──
  const fetchProtectionPlans = useCallback(async () => {
    setProtectionPlansLoading(true);
    try {
      const res = await apiRequest('GET', `/api/admin/protection/plans?status=${protectionPlanFilter}`);
      const data = await res.json();
      console.log('[Admin] Protection plans fetched:', data);
      if (Array.isArray(data) && data.length > 0) {
        console.log('[Admin] First plan:', data[0]);
        console.log('[Admin] Image URLs - Front:', data[0].frontImage, 'Back:', data[0].backImage);
      }
      setProtectionPlans(Array.isArray(data) ? data : []);
    } catch (e: any) { 
      console.error('[Admin] Error fetching plans:', e);
      setProtectionPlans([]); 
    }
    finally { setProtectionPlansLoading(false); }
  }, [protectionPlanFilter]);

  const fetchProtectionClaims = useCallback(async () => {
    setProtectionClaimsLoading(true);
    try {
      const res = await apiRequest('GET', `/api/admin/protection/claims?status=${protectionClaimFilter}`);
      const data = await res.json();
      setProtectionClaims(Array.isArray(data) ? data : []);
    } catch { setProtectionClaims([]); }
    finally { setProtectionClaimsLoading(false); }
  }, [protectionClaimFilter]);

  useEffect(() => {
    if (activeTab === 'protection-plans') fetchProtectionPlans();
    if (activeTab === 'protection-claims') fetchProtectionClaims();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'protection-plans') {
      const timer = setTimeout(fetchProtectionPlans, 300);
      return () => clearTimeout(timer);
    }
  }, [protectionPlanFilter]);

  useEffect(() => {
    if (activeTab === 'protection-claims') {
      const timer = setTimeout(fetchProtectionClaims, 300);
      return () => clearTimeout(timer);
    }
  }, [protectionClaimFilter]);

  const handleProtectionPlanAction = useCallback(async (planId: string, action: 'approve' | 'reject', reason?: string) => {
    try {
      console.log('[Admin] Executing plan action:', { planId, action, reason });
      const res = await apiRequest('PUT', `/api/admin/protection/plan/${planId}`, { 
        action, 
        rejectionReason: reason || '' 
      });
      
      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }
      
      const data = await res.json();
      console.log('[Admin] Plan action response:', data);
      
      Alert.alert('Success', action === 'approve' ? 'Plan approved!' : 'Plan rejected.');
      fetchProtectionPlans();
    } catch (e: any) { 
      console.error('[Admin] Plan action error:', e);
      Alert.alert('Error', e.message || `Failed to ${action} plan`); 
    }
  }, [fetchProtectionPlans]);

  const handleProtectionClaimAction = useCallback(async (claimId: string, action: string, extra?: any) => {
    try {
      console.log('[Admin] Executing claim action:', { claimId, action, extra });
      const res = await apiRequest('PUT', `/api/admin/protection/claim/${claimId}`, { action, ...extra });
      
      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }
      
      const data = await res.json();
      console.log('[Admin] Claim action response:', data);
      
      Alert.alert('Success', `Claim ${action} successful!`);
      fetchProtectionClaims();
    } catch (e: any) { 
      console.error('[Admin] Claim action error:', e);
      Alert.alert('Error', e.message || `Failed to ${action} claim`); 
    }
  }, [fetchProtectionClaims]);

  // ── User management ──
  const allUsers = useMemo(() => {
    const userMap = new Map<string, any>();
    if (allProfiles) {
      allProfiles.forEach(p => {
        userMap.set(p.id, {
          id: p.id, name: p.name || 'Unknown', role: p.role || 'customer',
          city: p.city, isRegistered: true, fullProfile: p,
        });
      });
    }
    posts?.forEach(post => {
      if (!userMap.has(post.userId)) {
        userMap.set(post.userId, { id: post.userId, name: post.userName, role: 'customer', isRegistered: false, fullProfile: null });
      }
    });
    return Array.from(userMap.values());
  }, [allProfiles, posts]);

  const filteredUsers = useMemo(() => {
    let users = allUsers;
    if (userRoleFilter !== 'all') users = users.filter(u => u.role === userRoleFilter);
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

  const stats = useMemo(() => ({
    totalUsers: allUsers.length,
    registeredUsers: allUsers.filter(u => u.isRegistered).length,
    totalPosts: posts?.length || 0,
    totalJobs: jobs?.length || 0,
    totalChats: conversations?.length || 0,
    totalLikes: posts?.reduce((sum, p) => sum + (p.likes?.length || 0), 0) || 0,
    totalComments: posts?.reduce((sum, p) => sum + (p.comments?.length || 0), 0) || 0,
    roleBreakdown: {
      technician: allUsers.filter(u => u.role === 'technician').length,
      teacher: allUsers.filter(u => u.role === 'teacher').length,
      supplier: allUsers.filter(u => u.role === 'supplier').length,
      shopkeeper: allUsers.filter(u => u.role === 'shopkeeper').length,
      job_provider: allUsers.filter(u => u.role === 'job_provider').length,
      customer: allUsers.filter(u => u.role === 'customer').length,
    },
  }), [allUsers, posts, jobs, conversations]);

  // ── Action handlers ──
  const handleDeletePost = (postId: string, userName: string) => {
    Alert.alert('Delete Post', `Delete post by ${userName}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          const url = new URL(`/api/posts/${postId}`, 'https://repair-backendarun-iaz6jex5fa-el.a.run.app');
          url.searchParams.set('userId', profile?.id || '');
          const res = await fetch(url.toString(), { method: 'DELETE' });
          
          const data = await res.json().catch(() => ({}));
          
          // Check for authorization errors
          if (res.status === 401) {
            Alert.alert('Authentication Error', 'Your session has expired. Please log in again.');
            return;
          }
          if (res.status === 403) {
            Alert.alert('Permission Denied', 'You cannot delete this post. Only the post owner or admin can delete it.');
            return;
          }
          
          if (res.ok || data.success) {
            await refreshData();
            Alert.alert('Deleted', 'Post removed successfully.');
          } else {
            Alert.alert('Error', data.message || 'Failed to delete post');
          }
        } catch (e: any) {
          Alert.alert('Error', e.message || 'Failed to delete post');
        }
      }},
    ]);
  };

  const executeBlockUser = async (userId: string, userName: string, block: boolean) => {
    setBlockingUserId(userId);
    try {
      console.log(`🚫 ${block ? 'Blocking' : 'Unblocking'} user:`, userId);
      const res = await apiRequest('POST', '/api/admin/block-user', { userId, blocked: block });
      console.log('Block response status:', res.status);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      console.log('Block response:', data);
      if (data.success) {
        Alert.alert('Success', `${userName} has been ${block ? 'blocked' : 'unblocked'}.`);
        await refreshData();
      } else { 
        Alert.alert('Error', data.message || 'Failed to block user'); 
      }
    } catch (e: any) { 
      console.error('Block error:', e);
      Alert.alert('Error', e.message || 'Failed to block user. Check your connection.'); 
    } finally {
      setBlockingUserId(null);
    }
  };

  const executeVerifyUser = async (userId: string, userName: string, verify: boolean) => {
    setVerifyingUserId(userId);
    try {
      const res = await apiRequest('PATCH', `/api/profiles/${userId}/verify`, { verified: verify ? 1 : 0 });
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      if (data.success) { 
        Alert.alert('Success', `${userName} ${verify ? 'verified' : 'unverified'}.`);
        await refreshData();
      } else {
        Alert.alert('Error', data.message || 'Failed to verify user');
      }
    } catch (e: any) { 
      Alert.alert('Error', e.message || 'Failed to verify user. Check your connection.'); 
    } finally {
      setVerifyingUserId(null);
    }
  };

  const executeDeleteUser = async (userId: string, userName: string) => {
    console.log('=== EXECUTE DELETE USER CALLED ===');
    console.log('userId:', userId, 'userName:', userName);
    setDeletingUserId(userId);
    try {
      console.log('✓ deletingUserId state updated');
      console.log('Making API request to /api/admin/delete-user...');
      
      const res = await apiRequest('POST', '/api/admin/delete-user', { userId });
      
      console.log('✓ API Response received:');
      console.log('  Status:', res.status);
      console.log('  OK:', res.ok);
      console.log('  StatusText:', res.statusText);
      
      let data;
      try {
        data = await res.json();
        console.log('✓ Response JSON parsed:', data);
      } catch (parseErr) {
        console.error('❌ Failed to parse JSON:', parseErr);
        throw parseErr;
      }
      
      if (res.status === 401) {
        console.error('❌ 401 Unauthorized');
        Alert.alert('Authentication Error', 'Your session has expired. Please log in again.');
        setDeletingUserId(null);
        return;
      }
      if (res.status === 403) {
        console.error('❌ 403 Forbidden');
        Alert.alert('Permission Denied', 'You do not have permission to delete users. Only admins can delete users.');
        setDeletingUserId(null);
        return;
      }
      
      if (data?.success) {
        console.log('✅ DELETE SUCCESSFUL - Calling refreshData()');
        Alert.alert('Success', `${userName} has been permanently deleted.`);
        await refreshData();
        console.log('✅ Data refreshed');
      } else {
        console.error('❌ Server returned success: false', data?.message);
        Alert.alert('Deletion Failed', data?.message || 'Failed to delete user from database');
      }
    } catch (e: any) {
      console.error('❌ EXCEPTION CAUGHT:', {
        name: e.name,
        message: e.message,
        stack: e.stack
      });
      Alert.alert('Deletion Error', e.message || 'Network error. Please try again.');
    } finally {
      console.log('Setting deletingUserId to null');
      setDeletingUserId(null);
    }
  };

  // Permanently delete a user from deleted users tab
  const executePermanentlyDeleteUser = async (userId: string, userName: string) => {
    setDeletingUserId(userId);
    try {
      console.log('🗑️ [PERM DELETE] Permanently deleting:', { userId, userName });
      const res = await apiRequest('POST', '/api/admin/permanently-delete-user', { userId });
      const data = await res.json();
      
      if (data.success) {
        console.log('✅ [PERM DELETE] Success');
        Alert.alert('Success', `${userName} has been permanently deleted from database.`);
        fetchDeletedUsers();
      } else {
        Alert.alert('Error', data.message || 'Failed to permanently delete user');
      }
    } catch (e: any) {
      console.error('❌ [PERM DELETE] Error:', e.message);
      Alert.alert('Error', e.message || 'Network error');
    } finally {
      setDeletingUserId(null);
    }
  };

  // Restore a deleted user
  const executeRestoreUser = async (userId: string, userName: string) => {
    setDeletingUserId(userId);
    try {
      console.log('↩️ [RESTORE] Restoring user:', { userId, userName });
      const res = await apiRequest('POST', '/api/admin/restore-user', { userId });
      const data = await res.json();
      
      if (data.success) {
        console.log('✅ [RESTORE] Success');
        Alert.alert('Success', `${userName} has been restored.`);
        fetchDeletedUsers();
      } else {
        Alert.alert('Error', data.message || 'Failed to restore user');
      }
    } catch (e: any) {
      console.error('❌ [RESTORE] Error:', e.message);
      Alert.alert('Error', e.message || 'Network error');
    } finally {
      setDeletingUserId(null);
    }
  };

  // Unblock a user from blocked users tab
  const executeUnblockUserFromTab = async (userId: string, userName: string) => {
    setBlockingUserId(userId);
    try {
      console.log('🔓 [UNBLOCK] Unblocking from tab:', { userId, userName });
      const res = await apiRequest('POST', '/api/admin/unblock-user-restore', { userId });
      const data = await res.json();
      
      if (data.success) {
        console.log('✅ [UNBLOCK] Success');
        Alert.alert('Success', `${userName} has been unblocked.`);
        fetchBlockedUsersData();
      } else {
        Alert.alert('Error', data.message || 'Failed to unblock user');
      }
    } catch (e: any) {
      console.error('❌ [UNBLOCK] Error:', e.message);
      Alert.alert('Error', e.message || 'Network error');
    } finally {
      setBlockingUserId(null);
    }
  };

  const handleDeleteUser = (userId: string, userName: string) => {
    console.log('⚠️ [HANDLE DELETE] Alert about to show for:', { userId, userName });
    const message = `Permanently delete ${userName}? This cannot be undone.`;
    
    // On web, use confirm dialog as fallback for Alert.alert
    if (typeof window !== 'undefined' && window.confirm(message)) {
      console.log('✅ [DELETE] Web confirm - executing delete');
      executeDeleteUser(userId, userName);
      return;
    }
    
    // On native, use Alert.alert
    Alert.alert('Delete User', message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => console.log('❌ [DELETE] Cancelled') },
        { text: 'Delete', style: 'destructive', onPress: () => {
          console.log('✅ [DELETE] Native alert confirmed - executing delete');
          executeDeleteUser(userId, userName);
        }},
      ]
    );
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshData();
    } catch (e: any) {
      console.error('Refresh error:', e);
      Alert.alert('Refresh Error', e.message || 'Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  };

  const handleGoBack = () => {
    try {
      router.back();
    } catch (e: any) {
      console.error('Navigate back error:', e);
      router.replace('/(tabs)');
    }
  };

  const handleBlockUser = (userId: string, userName: string, block: boolean) => {
    Alert.alert(block ? 'Block User' : 'Unblock User',
      block ? `Block ${userName}? They won't be able to log in.` : `Unblock ${userName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: block ? 'Block' : 'Unblock', style: block ? 'destructive' : 'default', onPress: () => executeBlockUser(userId, userName, block) },
      ]
    );
  };

  const downloadUsersCSV = () => openLink(`${getApiUrl()}/api/admin/export-users`, 'Export');

  const handleEndAllLive = async () => {
    try {
      const res = await apiRequest('POST', '/api/admin/end-all-live', {});
      const data = await res.json();
      if (data.success) {
        Alert.alert('Success', `Ended ${data.endedCount} live session(s)`);
      } else {
        Alert.alert('Error', data.message || 'Failed to end live sessions');
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to end live sessions');
    }
  };

  const saveLink = async (key: string, value: string) => {
    try {
      await apiRequest('PUT', `/api/app-settings/${key}`, { value });
      refreshData();
      Alert.alert('Saved', 'Link updated successfully');
    } catch { Alert.alert('Error', 'Failed to save link'); }
  };

  const sendNotificationToAll = useCallback(async () => {
    if (!notifTitle.trim() || !notifBody.trim()) { Alert.alert('Error', 'Please enter title and message.'); return; }
    setNotifSending(true);
    setNotifResult(null);
    try {
      const baseUrl = getApiUrl();
      const endpoint = notifTargetRole === 'all' ? '/api/admin/notify-all' : '/api/admin/notify-role';
      const payload: any = { phone: ADMIN_PHONE, title: notifTitle.trim(), body: notifBody.trim() };
      if (notifTargetRole !== 'all') payload.role = notifTargetRole;
      const res = await fetch(`${baseUrl}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.success) {
        setNotifResult(`✅ Sent to ${data.sent} device${data.sent !== 1 ? 's' : ''}`);
        setNotifTitle(''); setNotifBody('');
      } else { setNotifResult(`❌ Failed: ${data.message || 'Unknown error'}`); }
    } catch { setNotifResult('❌ Network error'); }
    finally { setNotifSending(false); }
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
      if (data.success) {
        setSmsResult(`✅ Sent ${data.sent}${data.failed ? `, failed ${data.failed}` : ''}`);
        setSmsBody('');
      } else { setSmsResult(`❌ Failed: ${data.message || 'Unknown'}`); }
    } catch { setSmsResult('❌ Network error'); }
    finally { setSmsSending(false); }
  }, [smsBody, smsTargetRole]);

  const sendBulkEmail = useCallback(async (scheduled?: boolean) => {
    if (!emailSubject.trim()) { Alert.alert('Error', 'Enter email subject.'); return; }
    if (!emailBody.trim()) { Alert.alert('Error', 'Enter email message.'); return; }
    if (scheduled && (!emailScheduleDate.trim() || !emailScheduleTime.trim())) {
      Alert.alert('Error', 'Enter date and time to schedule.'); return;
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
        if (data.scheduled) setEmailResult(`✅ Scheduled! Sends to ${data.total} users`);
        else setEmailResult(`✅ Sending to ${data.total} users (ID: ${data.campaignId})`);
        setEmailSubject(''); setEmailBody(''); setEmailScheduleDate(''); setEmailScheduleTime('');
        setTimeout(() => fetchEmailStats(), 2000);
      } else { setEmailResult(`❌ Failed: ${data.message || 'Unknown'}`); }
    } catch { setEmailResult('❌ Network error'); }
    finally { setEmailSending(false); }
  }, [emailSubject, emailBody, emailTargetRole, emailScheduleDate, emailScheduleTime, fetchEmailStats]);

  // ── Tabs config ──
  const tabs: { key: AdminTab; label: string; icon: keyof typeof Ionicons.glyphMap; group?: string }[] = [
    // Primary sections
    { key: 'dashboard', label: 'Dashboard', icon: 'grid-outline', group: 'main' },
    { key: 'users', label: 'All Users', icon: 'people-outline', group: 'main' },
    { key: 'customers', label: 'Customers', icon: 'person-outline', group: 'roles' },
    { key: 'technicians', label: 'Technicians', icon: 'construct-outline', group: 'roles' },
    { key: 'teachers', label: 'Teachers', icon: 'school-outline', group: 'roles' },
    { key: 'suppliers', label: 'Suppliers', icon: 'cube-outline', group: 'roles' },
    { key: 'shopkeepers', label: 'Shopkeepers', icon: 'storefront-outline', group: 'roles' },
    { key: 'blocked-users', label: 'Blocked Users', icon: 'ban-outline', group: 'main' },
    { key: 'deleted-users', label: 'Deleted Users', icon: 'trash-outline', group: 'main' },
    { key: 'products', label: 'Products', icon: 'pricetag-outline', group: 'main' },
    { key: 'orders', label: 'Orders', icon: 'calendar-outline', group: 'main' },
    { key: 'reports', label: 'Reports', icon: 'bar-chart-outline', group: 'main' },
    { key: 'settings', label: 'Settings', icon: 'settings-outline', group: 'main' },
    // Extra existing tabs
    { key: 'subscriptions', label: 'Subscriptions', icon: 'card-outline' },
    { key: 'insurance', label: 'Insurance', icon: 'shield-checkmark-outline' },
    { key: 'revenue', label: 'Revenue', icon: 'trending-up-outline' },
    { key: 'posts', label: 'Posts', icon: 'newspaper-outline' },
    { key: 'jobs', label: 'Jobs', icon: 'briefcase-outline' },
    { key: 'ads', label: 'Ads & Shop', icon: 'megaphone-outline' },
    { key: 'listings', label: 'Listings', icon: 'cube-outline' },
    { key: 'links', label: 'Links', icon: 'link-outline' },
    { key: 'notifications', label: 'Notify', icon: 'notifications-outline' },
    { key: 'email', label: 'Email', icon: 'mail-outline' },
    { key: 'payouts', label: 'Payouts', icon: 'cash-outline' },
    { key: 'protection-plans', label: 'Protect Plans', icon: 'shield-checkmark-outline' },
    { key: 'protection-claims', label: 'Protect Claims', icon: 'alert-circle-outline' },
  ];

  // ─── RENDER FUNCTIONS ──────────────────────────────────────────────────────

  const renderDashboard = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: isMobile ? 12 : 16, paddingBottom: 40 }}>
      {/* Stats grid */}
      <Text style={ss.sectionTitle}>Overview</Text>
      <View style={ss.statsGrid}>
        <StatCard label="Total Users" value={stats.totalUsers} icon="people" color={PRIMARY} />
        <StatCard label="Registered" value={stats.registeredUsers} icon="person-add" color="#34C759" />
        <StatCard label="Posts" value={stats.totalPosts} icon="newspaper" color="#5E8BFF" />
        <StatCard label="Jobs" value={stats.totalJobs} icon="briefcase" color="#FFD60A" />
        <StatCard label="Chats" value={stats.totalChats} icon="chatbubbles" color="#FF6B2C" />
        <StatCard label="Total Likes" value={stats.totalLikes} icon="heart" color="#FF3B30" />
      </View>

      {/* Role breakdown */}
      <Text style={[ss.sectionTitle, { marginTop: 20 }]}>Users by Role</Text>
      <SectionCard>
        {(Object.entries(stats.roleBreakdown) as [UserRole, number][]).map(([role, count], idx, arr) => (
          <View key={role} style={[{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }, idx < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border }]}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: ROLE_COLORS[role], marginRight: 10 }} />
            <Text style={{ flex: 1, color: C.text, fontSize: 14, fontFamily: 'Inter_500Medium' }}>{ROLE_LABELS[role]}</Text>
            <View style={{ width: 80, height: 6, backgroundColor: C.surfaceElevated, borderRadius: 3, marginRight: 10 }}>
              <View style={{ width: `${Math.max((count / Math.max(stats.totalUsers, 1)) * 100, 5)}%`, height: 6, borderRadius: 3, backgroundColor: ROLE_COLORS[role] }} />
            </View>
            <Text style={{ color: C.textSecondary, fontSize: 13, fontFamily: 'Inter_600SemiBold', width: 28, textAlign: 'right' }}>{count}</Text>
          </View>
        ))}
      </SectionCard>

      {/* Activity */}
      <Text style={[ss.sectionTitle, { marginTop: 20 }]}>Activity</Text>
      <SectionCard>
        {[
          { label: 'Total Comments', value: stats.totalComments },
          { label: 'Avg Likes / Post', value: stats.totalPosts > 0 ? (stats.totalLikes / stats.totalPosts).toFixed(1) : '0' },
          { label: 'Most Active Role', value: ROLE_LABELS[Object.entries(stats.roleBreakdown).sort((a, b) => b[1] - a[1])[0]?.[0] as UserRole || 'technician'] },
        ].map((item, idx, arr) => (
          <View key={item.label} style={[{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 }, idx < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border }]}>
            <Text style={{ color: C.textSecondary, fontSize: 14, fontFamily: 'Inter_400Regular' }}>{item.label}</Text>
            <Text style={{ color: C.text, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>{item.value}</Text>
          </View>
        ))}
      </SectionCard>

      {/* Role Management Shortcuts */}
      <Text style={[ss.sectionTitle, { marginTop: 20 }]}>Manage by Role</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
        {[
          { label: 'Customers', icon: 'person-outline' as any, color: '#FF2D55', tab: 'customers' as AdminTab, count: stats.roleBreakdown?.customer || 0 },
          { label: 'Technicians', icon: 'construct-outline' as any, color: '#34C759', tab: 'technicians' as AdminTab, count: stats.roleBreakdown?.technician || 0 },
          { label: 'Teachers', icon: 'school-outline' as any, color: '#FFD60A', tab: 'teachers' as AdminTab, count: stats.roleBreakdown?.teacher || 0 },
          { label: 'Suppliers', icon: 'cube-outline' as any, color: '#FF6B2C', tab: 'suppliers' as AdminTab, count: stats.roleBreakdown?.supplier || 0 },
          { label: 'Shopkeepers', icon: 'storefront-outline' as any, color: '#8B5CF6', tab: 'shopkeepers' as AdminTab, count: stats.roleBreakdown?.shopkeeper || 0 },
        ].map(item => (
          <Pressable key={item.label} onPress={() => setActiveTab(item.tab)}
            style={{ flex: 1, minWidth: '46%', backgroundColor: item.color + '10', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: item.color + '30', gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: item.color + '20', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={item.icon} size={15} color={item.color} />
              </View>
              <Text style={{ fontSize: 18, fontFamily: 'Inter_700Bold', color: item.color }}>{item.count}</Text>
            </View>
            <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.text }}>{item.label}</Text>
            <Text style={{ fontSize: 10, fontFamily: 'Inter_400Regular', color: item.color }}>Manage →</Text>
          </Pressable>
        ))}
      </View>

      {/* Quick actions */}
      <Text style={[ss.sectionTitle, { marginTop: 20 }]}>Quick Actions</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {[
          { label: 'Export Users', icon: 'download-outline' as any, color: '#5E8BFF', action: downloadUsersCSV },
          { label: 'End All Live', icon: 'stop-circle-outline' as any, color: '#FF3B30', action: handleEndAllLive },
          { label: 'Reports', icon: 'bar-chart-outline' as any, color: PRIMARY, action: () => setActiveTab('reports') },
          { label: 'Email Campaign', icon: 'mail-outline' as any, color: '#34C759', action: () => setActiveTab('email') },
          { label: 'Settings', icon: 'settings-outline' as any, color: '#FFD60A', action: () => setActiveTab('settings') },
        ].map(qa => (
          <Pressable key={qa.label} onPress={qa.action}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: qa.color + '15', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: qa.color + '40' }}>
            <Ionicons name={qa.icon} size={15} color={qa.color} />
            <Text style={{ fontSize: 13, color: qa.color, fontFamily: 'Inter_600SemiBold' }}>{qa.label}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );

  const USER_ROLE_FILTERS: { key: 'all' | UserRole; label: string; color: string }[] = [
    { key: 'all', label: 'All', color: '#007AFF' },
    { key: 'admin', label: 'Admins', color: '#AF52DE' },
    { key: 'technician', label: 'Techs', color: '#34C759' },
    { key: 'teacher', label: 'Teachers', color: '#FFD60A' },
    { key: 'supplier', label: 'Suppliers', color: '#FF6B2C' },
    { key: 'job_provider', label: 'Jobs', color: '#5E8BFF' },
    { key: 'customer', label: 'Customers', color: '#FF2D55' },
  ];

  const renderUsers = () => (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: C.border }}>
          <Ionicons name="search" size={16} color={C.textTertiary} />
          <TextInput value={userSearchQuery} onChangeText={setUserSearchQuery}
            placeholder="Search name, phone, city..."
            placeholderTextColor={C.textTertiary}
            style={{ flex: 1, color: C.text, paddingVertical: 10, paddingHorizontal: 8, fontFamily: 'Inter_400Regular', fontSize: 14 }}
            clearButtonMode="while-editing" />
          {userSearchQuery.length > 0 && (
            <Pressable onPress={() => setUserSearchQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={C.textTertiary} />
            </Pressable>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 6 }}>
          {USER_ROLE_FILTERS.map(f => {
            const active = userRoleFilter === f.key;
            return (
              <Pressable key={f.key} onPress={() => setUserRoleFilter(f.key)}
                style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: active ? f.color : C.surface, borderWidth: 1, borderColor: active ? f.color : C.border }}>
                <Text style={{ color: active ? '#fff' : C.textSecondary, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: C.textTertiary, fontSize: 12, fontFamily: 'Inter_400Regular' }}>
            {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
          </Text>
          <Pressable onPress={downloadUsersCSV}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#5E8BFF15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: '#5E8BFF40' }}>
            <Ionicons name="download-outline" size={14} color="#5E8BFF" />
            <Text style={{ color: '#5E8BFF', fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>Export CSV</Text>
          </Pressable>
        </View>
      </View>
      <FlatList
        data={filteredUsers}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === 'web' ? 34 : 40, paddingHorizontal: 16 }}
        renderItem={({ item }) => (
          <UserDetailCard user={item} onBlock={handleBlockUser} onVerify={executeVerifyUser} onDelete={handleDeleteUser} blockingId={blockingUserId} verifyingId={verifyingUserId} deletingId={deletingUserId} />
        )}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', padding: 40 }}>
            <Ionicons name="people-outline" size={40} color={C.textTertiary} />
            <Text style={{ color: C.textTertiary, fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: 8 }}>
              {userSearchQuery || userRoleFilter !== 'all' ? 'No users match your search' : 'No users found'}
            </Text>
          </View>
        }
      />
    </View>
  );

  // ── Role-filtered user views ──
  const renderRoleUsers = (role: string, label: string, icon: keyof typeof Ionicons.glyphMap, color: string) => {
    const roleUsers = (allProfiles || []).filter(p => p.role === role);
    const searched = userSearchQuery
      ? roleUsers.filter(p =>
          (p.name || '').toLowerCase().includes(userSearchQuery.toLowerCase()) ||
          (p.phone || '').includes(userSearchQuery) ||
          (p.city || '').toLowerCase().includes(userSearchQuery.toLowerCase())
        )
      : roleUsers;
    return (
      <View style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: color + '15', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: color + '30' }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: color + '25', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={icon} size={18} color={color} />
            </View>
            <View>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 15, color: C.text }}>{label}s</Text>
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: C.textSecondary }}>{roleUsers.length} registered</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: C.border }}>
            <Ionicons name="search" size={16} color={C.textTertiary} />
            <TextInput value={userSearchQuery} onChangeText={setUserSearchQuery}
              placeholder={`Search ${label.toLowerCase()}s...`}
              placeholderTextColor={C.textTertiary}
              style={{ flex: 1, color: C.text, paddingVertical: 10, paddingHorizontal: 8, fontFamily: 'Inter_400Regular', fontSize: 14 }} />
            {userSearchQuery.length > 0 && (
              <Pressable onPress={() => setUserSearchQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={C.textTertiary} />
              </Pressable>
            )}
          </View>
          <Text style={{ color: C.textTertiary, fontSize: 12, fontFamily: 'Inter_400Regular' }}>{searched.length} result{searched.length !== 1 ? 's' : ''}</Text>
        </View>
        <FlatList
          data={searched}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 16 }}
          renderItem={({ item }) => (
            <UserDetailCard user={{ id: item.id, name: item.name || 'Unknown', role: item.role, city: item.city, isRegistered: true, fullProfile: item }}
              onBlock={handleBlockUser} onVerify={executeVerifyUser} onDelete={handleDeleteUser} blockingId={blockingUserId} verifyingId={verifyingUserId} deletingId={deletingUserId} />
          )}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', padding: 40 }}>
              <Ionicons name={icon} size={40} color={C.textTertiary} />
              <Text style={{ color: C.textTertiary, fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: 8 }}>
                {userSearchQuery ? `No ${label.toLowerCase()}s match your search` : `No ${label.toLowerCase()}s yet`}
              </Text>
            </View>
          }
        />
      </View>
    );
  };

  // ── Fetch deleted/blocked users from admin endpoints ──
  const [deletedUsers, setDeletedUsers] = useState<any[]>([]);
  const [blockedUsersData, setBlockedUsersData] = useState<any[]>([]);
  const [deletedLoading, setDeletedLoading] = useState(false);

  const fetchDeletedUsers = useCallback(async () => {
    setDeletedLoading(true);
    try {
      console.log('📋 Fetching deleted users...');
      const res = await apiRequest('GET', '/api/admin/deleted-users');
      const data = await res.json();
      setDeletedUsers(Array.isArray(data) ? data : []);
      console.log('✅ Deleted users fetched:', data.length);
    } catch (e) { 
      console.error('Failed to fetch deleted users:', e);
      setDeletedUsers([]);
    } finally {
      setDeletedLoading(false);
    }
  }, []);

  const fetchBlockedUsersData = useCallback(async () => {
    try {
      console.log('🚫 Fetching blocked users...');
      const res = await apiRequest('GET', '/api/admin/blocked-users');
      const data = await res.json();
      setBlockedUsersData(Array.isArray(data) ? data : []);
      console.log('✅ Blocked users fetched:', data.length);
    } catch (e) { 
      console.error('Failed to fetch blocked users:', e);
      setBlockedUsersData([]);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'deleted-users') fetchDeletedUsers();
    if (activeTab === 'blocked-users') fetchBlockedUsersData();
  }, [activeTab, fetchDeletedUsers, fetchBlockedUsersData]);

  // ── Blocked users view ──
  const renderBlockedUsers = () => {
    const searched = userSearchQuery
      ? blockedUsersData.filter(p =>
          (p.name || '').toLowerCase().includes(userSearchQuery.toLowerCase()) ||
          (p.phone || '').includes(userSearchQuery) ||
          (p.city || '').toLowerCase().includes(userSearchQuery.toLowerCase())
        )
      : blockedUsersData;
    return (
      <View style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FF3B3015', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#FF3B3030' }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FF3B3025', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="ban-outline" size={18} color="#FF3B30" />
            </View>
            <View>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 15, color: C.text }}>Blocked Users</Text>
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: C.textSecondary }}>{blockedUsersData.length} blocked</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: C.border }}>
            <Ionicons name="search" size={16} color={C.textTertiary} />
            <TextInput value={userSearchQuery} onChangeText={setUserSearchQuery}
              placeholder="Search blocked users..."
              placeholderTextColor={C.textTertiary}
              style={{ flex: 1, color: C.text, paddingVertical: 10, paddingHorizontal: 8, fontFamily: 'Inter_400Regular', fontSize: 14 }} />
            {userSearchQuery.length > 0 && (
              <Pressable onPress={() => setUserSearchQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={C.textTertiary} />
              </Pressable>
            )}
          </View>
          <Text style={{ color: C.textTertiary, fontSize: 12, fontFamily: 'Inter_400Regular' }}>{searched.length} result{searched.length !== 1 ? 's' : ''}</Text>
        </View>
        <FlatList
          data={searched}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 16 }}
          renderItem={({ item }) => (
            <View style={{ marginBottom: 12 }}>
              <UserDetailCard user={{ id: item.id, name: item.name || 'Unknown', role: item.role, city: item.city, isRegistered: true, fullProfile: item }}
                onBlock={handleBlockUser} onVerify={executeVerifyUser} onDelete={handleDeleteUser} blockingId={blockingUserId} verifyingId={verifyingUserId} deletingId={deletingUserId} />
              {/* Custom action buttons for blocked users */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, paddingHorizontal: 12 }}>
                <Pressable 
                  onPress={() => Alert.alert('Unblock User', `Unblock ${item.name}?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Unblock', onPress: () => executeUnblockUserFromTab(item.id, item.name) }
                  ])}
                  style={{ flex: 1, backgroundColor: '#34C759', paddingVertical: 10, borderRadius: 8, alignItems: 'center' }}
                >
                  <Text style={{ color: 'white', fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>Unblock</Text>
                </Pressable>
                <Pressable 
                  onPress={() => Alert.alert('Delete User', `Delete ${item.name} from database?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => executePermanentlyDeleteUser(item.id, item.name) }
                  ])}
                  style={{ flex: 1, backgroundColor: '#FF3B30', paddingVertical: 10, borderRadius: 8, alignItems: 'center' }}
                >
                  <Text style={{ color: 'white', fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>Delete</Text>
                </Pressable>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', padding: 40 }}>
              <Ionicons name="ban-outline" size={40} color={C.textTertiary} />
              <Text style={{ color: C.textTertiary, fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: 8 }}>
                {userSearchQuery ? 'No blocked users match your search' : 'No blocked users'}
              </Text>
            </View>
          }
        />
      </View>
    );
  };

  // ── Deleted users view ──
  const renderDeletedUsers = () => {
    const searched = userSearchQuery
      ? deletedUsers.filter(p =>
          (p.name || '').toLowerCase().includes(userSearchQuery.toLowerCase()) ||
          (p.phone || '').includes(userSearchQuery) ||
          (p.city || '').toLowerCase().includes(userSearchQuery.toLowerCase())
        )
      : deletedUsers;
    return (
      <View style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FF3B3015', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#FF3B3030' }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FF3B3025', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="trash-outline" size={18} color="#FF3B30" />
            </View>
            <View>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 15, color: C.text }}>Deleted Users</Text>
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: C.textSecondary }}>{deletedUsers.length} deleted</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: C.border }}>
            <Ionicons name="search" size={16} color={C.textTertiary} />
            <TextInput value={userSearchQuery} onChangeText={setUserSearchQuery}
              placeholder="Search deleted users..."
              placeholderTextColor={C.textTertiary}
              style={{ flex: 1, color: C.text, paddingVertical: 10, paddingHorizontal: 8, fontFamily: 'Inter_400Regular', fontSize: 14 }} />
            {userSearchQuery.length > 0 && (
              <Pressable onPress={() => setUserSearchQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={C.textTertiary} />
              </Pressable>
            )}
          </View>
          <Text style={{ color: C.textTertiary, fontSize: 12, fontFamily: 'Inter_400Regular' }}>{searched.length} result{searched.length !== 1 ? 's' : ''}</Text>
        </View>
        <FlatList
          data={searched}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 16 }}
          renderItem={({ item }) => (
            <View style={{ marginBottom: 12 }}>
              <UserDetailCard user={{ id: item.id, name: item.name || 'Unknown', role: item.role, city: item.city, isRegistered: true, fullProfile: item }}
                onBlock={handleBlockUser} onVerify={executeVerifyUser} onDelete={handleDeleteUser} blockingId={blockingUserId} verifyingId={verifyingUserId} deletingId={deletingUserId} />
              {/* Custom action buttons for deleted users */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, paddingHorizontal: 12 }}>
                <Pressable 
                  onPress={() => Alert.alert('Restore User', `Restore ${item.name}?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Restore', onPress: () => executeRestoreUser(item.id, item.name) }
                  ])}
                  style={{ flex: 1, backgroundColor: '#34C759', paddingVertical: 10, borderRadius: 8, alignItems: 'center' }}
                >
                  <Text style={{ color: 'white', fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>Restore</Text>
                </Pressable>
                <Pressable 
                  onPress={() => Alert.alert('Permanently Delete', `Permanently delete ${item.name} from database?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => executePermanentlyDeleteUser(item.id, item.name) }
                  ])}
                  style={{ flex: 1, backgroundColor: '#FF3B30', paddingVertical: 10, borderRadius: 8, alignItems: 'center' }}
                >
                  <Text style={{ color: 'white', fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>Delete Forever</Text>
                </Pressable>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', padding: 40 }}>
              <Ionicons name="trash-outline" size={40} color={C.textTertiary} />
              <Text style={{ color: C.textTertiary, fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: 8 }}>
                {userSearchQuery ? 'No deleted users match your search' : 'No deleted users'}
              </Text>
            </View>
          }
        />
      </View>
    );
  };

  const renderReports = () => {
    const roleBreakdown = stats.roleBreakdown;
    const totalUsers = stats.totalUsers || 1;
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={ss.sectionTitle}>Platform Overview</Text>
        <View style={[ss.statsGrid, { marginBottom: 16 }]}>
          <StatCard label="Total Users" value={stats.totalUsers} icon="people" color={PRIMARY} />
          <StatCard label="Registered" value={stats.registeredUsers} icon="person-add" color="#34C759" />
          <StatCard label="Total Posts" value={stats.totalPosts} icon="newspaper" color="#5E8BFF" />
          <StatCard label="Total Jobs" value={stats.totalJobs} icon="briefcase" color="#FFD60A" />
          <StatCard label="Total Chats" value={stats.totalChats} icon="chatbubbles" color="#FF6B2C" />
          <StatCard label="Total Likes" value={stats.totalLikes} icon="heart" color="#FF3B30" />
        </View>

        <Text style={[ss.sectionTitle, { marginTop: 4 }]}>User Distribution by Role</Text>
        <SectionCard style={{ marginTop: 10 }}>
          {Object.entries(roleBreakdown).map(([role, count], idx, arr) => {
            const pct = Math.round(((count as number) / totalUsers) * 100);
            const col = ROLE_COLORS[role] || '#8E8E93';
            return (
              <View key={role} style={[{ paddingVertical: 12 }, idx < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: col, marginRight: 8 }} />
                  <Text style={{ flex: 1, color: C.text, fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>{ROLE_LABELS[role as UserRole] || role}</Text>
                  <Text style={{ color: col, fontSize: 13, fontFamily: 'Inter_700Bold' }}>{count as number}</Text>
                  <Text style={{ color: C.textTertiary, fontSize: 11, fontFamily: 'Inter_400Regular', marginLeft: 6, width: 32, textAlign: 'right' }}>{pct}%</Text>
                </View>
                <View style={{ height: 6, backgroundColor: C.surfaceElevated, borderRadius: 3 }}>
                  <View style={{ width: `${Math.max(pct, 3)}%`, height: 6, borderRadius: 3, backgroundColor: col }} />
                </View>
              </View>
            );
          })}
        </SectionCard>

        <Text style={[ss.sectionTitle, { marginTop: 20 }]}>Engagement Metrics</Text>
        <SectionCard style={{ marginTop: 10 }}>
          {[
            { label: 'Total Comments', value: stats.totalComments, icon: 'chatbubble-outline' as any },
            { label: 'Avg Likes / Post', value: stats.totalPosts > 0 ? (stats.totalLikes / stats.totalPosts).toFixed(1) : '0', icon: 'heart-outline' as any },
            { label: 'Most Active Role', value: ROLE_LABELS[Object.entries(roleBreakdown).sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0] as UserRole] || '-', icon: 'star-outline' as any },
            { label: 'Registration Rate', value: `${stats.totalUsers > 0 ? Math.round((stats.registeredUsers / stats.totalUsers) * 100) : 0}%`, icon: 'trending-up-outline' as any },
          ].map((m, idx, arr) => (
            <View key={m.label} style={[{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }, idx < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border }]}>
              <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: PRIMARY + '15', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                <Ionicons name={m.icon} size={15} color={PRIMARY} />
              </View>
              <Text style={{ flex: 1, color: C.textSecondary, fontSize: 13, fontFamily: 'Inter_400Regular' }}>{m.label}</Text>
              <Text style={{ color: C.text, fontSize: 14, fontFamily: 'Inter_700Bold' }}>{m.value}</Text>
            </View>
          ))}
        </SectionCard>
      </ScrollView>
    );
  };

  const renderSettings = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={ss.sectionTitle}>App Settings</Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
        {[
          { label: 'Subscriptions', icon: 'card-outline' as any, color: '#5E8BFF', tab: 'subscriptions' as AdminTab },
          { label: 'Insurance', icon: 'shield-checkmark-outline' as any, color: '#34C759', tab: 'insurance' as AdminTab },
          { label: 'App Links', icon: 'link-outline' as any, color: '#FF6B2C', tab: 'links' as AdminTab },
          { label: 'Notifications', icon: 'notifications-outline' as any, color: '#AF52DE', tab: 'notifications' as AdminTab },
          { label: 'Email Campaigns', icon: 'mail-outline' as any, color: '#FFD60A', tab: 'email' as AdminTab },
          { label: 'Payouts', icon: 'cash-outline' as any, color: '#34C759', tab: 'payouts' as AdminTab },
          { label: 'Revenue', icon: 'trending-up-outline' as any, color: '#FF3B30', tab: 'revenue' as AdminTab },
          { label: 'Ads & Shop', icon: 'megaphone-outline' as any, color: '#FF6B2C', tab: 'ads' as AdminTab },
        ].map(item => (
          <Pressable key={item.label} onPress={() => setActiveTab(item.tab)}
            style={{ flex: 1, minWidth: '46%', backgroundColor: item.color + '10', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: item.color + '30', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: item.color + '20', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={item.icon} size={20} color={item.color} />
            </View>
            <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.text, textAlign: 'center' }}>{item.label}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 11, color: item.color, fontFamily: 'Inter_500Medium' }}>Manage</Text>
              <Ionicons name="arrow-forward" size={11} color={item.color} />
            </View>
          </Pressable>
        ))}
      </View>

      <Text style={[ss.sectionTitle, { marginTop: 24 }]}>Admin Info</Text>
      <SectionCard style={{ marginTop: 10 }}>
        {[
          { label: 'Super Admin Phone', value: '8179142535' },
          { label: 'Admin Role', value: 'Full Access' },
          { label: 'API Security', value: 'Protected' },
        ].map((item, idx, arr) => (
          <View key={item.label} style={[{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 }, idx < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border }]}>
            <Text style={{ color: C.textSecondary, fontSize: 13, fontFamily: 'Inter_400Regular' }}>{item.label}</Text>
            <Text style={{ color: C.text, fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>{item.value}</Text>
          </View>
        ))}
      </SectionCard>
    </ScrollView>
  );

  const renderBookings = () => (
    <ScrollView showsVerticalScrollIndicator={false}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={repairLoading} onRefresh={fetchRepairBookings} tintColor={PRIMARY} />}>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {(['all', 'pending', 'assigned', 'completed', 'cancelled'] as const).map(f => (
          <Pressable key={f} onPress={() => setRepairFilter(f)}
            style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
              backgroundColor: repairFilter === f ? PRIMARY : C.surface,
              borderWidth: 1, borderColor: repairFilter === f ? PRIMARY : C.border }}>
            <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: repairFilter === f ? '#FFF' : C.textSecondary, textTransform: 'capitalize' }}>{f}</Text>
          </Pressable>
        ))}
      </View>
      {repairLoading ? (
        <View style={{ alignItems: 'center', paddingTop: 40 }}><ActivityIndicator size="large" color={PRIMARY} /></View>
      ) : repairBookings.filter(b => repairFilter === 'all' || b.status === repairFilter).length === 0 ? (
        <View style={{ alignItems: 'center', padding: 40 }}>
          <Ionicons name="calendar-outline" size={40} color={C.textTertiary} />
          <Text style={{ color: C.textTertiary, fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: 8 }}>No bookings found</Text>
        </View>
      ) : (
        repairBookings
          .filter(b => repairFilter === 'all' || b.status === repairFilter)
          .map((b: any) => {
            const statusColor = b.status === 'completed' ? '#34C759' : b.status === 'pending' ? '#FFD60A' : b.status === 'assigned' ? '#5E8BFF' : b.status === 'cancelled' ? '#FF3B30' : PRIMARY;
            return (
              <SectionCard key={b.id} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Inter_600SemiBold', color: C.text, fontSize: 15 }}>{b.customerName || 'Customer'}</Text>
                    <View style={{ backgroundColor: statusColor + '20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, alignSelf: 'flex-start', marginTop: 4 }}>
                      <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: statusColor, textTransform: 'capitalize' }}>{b.status}</Text>
                    </View>
                  </View>
                  <View
                    onClick={() => {
                      Alert.alert('Delete Booking', `Delete booking for ${b.customerName}? This cannot be undone.`, [
                        { text: 'Cancel', style: 'cancel' },
                        { 
                          text: 'Delete', 
                          style: 'destructive', 
                          onPress: async () => {
                            try {
                              const res = await apiRequest('DELETE', `/api/repair-bookings/${b.id}`);
                              if (res.ok) {
                                await fetchRepairBookings();
                                Alert.alert('Success', 'Booking deleted successfully');
                              } else {
                                Alert.alert('Error', 'Failed to delete booking');
                              }
                            } catch (e) {
                              Alert.alert('Error', 'Failed to delete booking');
                            }
                          }
                        }
                      ]);
                    }}
                    style={{ backgroundColor: '#FF3B3015', padding: 8, borderRadius: 8, cursor: 'pointer' } as any}
                  >
                    <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                  </View>
                </View>
                <Text style={{ color: C.textSecondary, fontSize: 13, fontFamily: 'Inter_400Regular' }}>{b.deviceType} — {b.issue}</Text>
                <Text style={{ color: C.textTertiary, fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 4 }}>
                  {b.phone} · {b.createdAt ? new Date(b.createdAt).toLocaleDateString('en-IN') : ''}
                </Text>
                {b.status === 'pending' && (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <Pressable onPress={() => updateBookingStatus(b.id, 'assigned')}
                      style={{ flex: 1, backgroundColor: '#5E8BFF', paddingVertical: 8, borderRadius: 8, alignItems: 'center' }}>
                      <Text style={{ color: '#FFF', fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>Assign</Text>
                    </Pressable>
                    <Pressable onPress={() => updateBookingStatus(b.id, 'cancelled')}
                      style={{ flex: 1, backgroundColor: '#FF3B3015', paddingVertical: 8, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#FF3B3040' }}>
                      <Text style={{ color: '#FF3B30', fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>Cancel</Text>
                    </Pressable>
                  </View>
                )}
                {b.status === 'assigned' && (
                  <Pressable onPress={() => updateBookingStatus(b.id, 'completed')}
                    style={{ marginTop: 10, backgroundColor: '#34C759', paddingVertical: 8, borderRadius: 8, alignItems: 'center' }}>
                    <Text style={{ color: '#FFF', fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>Mark Completed</Text>
                  </Pressable>
                )}
              </SectionCard>
            );
          })
      )}
    </ScrollView>
  );

  const renderSubscriptions = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={ss.sectionSubtitle}>Enable or disable subscriptions for each role and set pricing.</Text>

      {subLoading ? (
        <View style={{ alignItems: 'center', paddingTop: 40 }}><ActivityIndicator size="large" color={PRIMARY} /></View>
      ) : (
        (['technician', 'teacher', 'supplier', 'shopkeeper'] as const).map(role => {
          const sub = subscriptions.find(s => s.role === role);
          const enabled = sub?.enabled === 1;
          const roleColor = ROLE_COLORS[role];
          return (
            <SectionCard key={role} style={{ marginBottom: 12, borderLeftWidth: 4, borderLeftColor: roleColor }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: roleColor + '20', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={role === 'technician' ? 'construct' : role === 'teacher' ? 'school' : role === 'shopkeeper' ? 'storefront' : 'cube'} size={20} color={roleColor} />
                  </View>
                  <View>
                    <Text style={{ fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.text }}>{ROLE_LABELS[role]}</Text>
                    <Text style={{ fontSize: 11, color: enabled ? '#34C759' : C.textTertiary, fontFamily: 'Inter_500Medium', marginTop: 1 }}>
                      {enabled ? 'Active' : 'Disabled'}
                    </Text>
                  </View>
                </View>
                <Switch value={enabled} onValueChange={(val) => toggleSubscription(role, val)}
                  trackColor={{ false: C.surfaceElevated, true: roleColor + '60' }}
                  thumbColor={enabled ? roleColor : C.textTertiary} />
              </View>
              {enabled && (
                <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12 }}>
                  <Text style={ss.inputLabel}>{role === 'teacher' ? 'Commission on Sales (%)' : 'Monthly Amount (₹)'}</Text>
                  <TextInput
                    style={ss.input}
                    value={role === 'teacher' ? (sub?.commissionPercent || '30') : (sub?.amount || '0')}
                    onChangeText={(val) => setSubscriptions(prev => prev.map(s => s.role === role
                      ? role === 'teacher' ? { ...s, commissionPercent: val } : { ...s, amount: val }
                      : s))}
                    onBlur={() => role === 'teacher'
                      ? apiRequest('PATCH', `/api/subscription-settings/${role}`, { commissionPercent: sub?.commissionPercent || '30' }).catch(() => {})
                      : updateSubAmount(role, sub?.amount || '0')}
                    keyboardType="number-pad"
                    placeholder={role === 'technician' ? '99' : role === 'teacher' ? '30' : '999'}
                    placeholderTextColor={C.textTertiary}
                  />
                </View>
              )}
            </SectionCard>
          );
        })
      )}

      {/* Active subscribers */}
      <Text style={[ss.sectionTitle, { marginTop: 8 }]}>Active Subscribers</Text>
      <SectionCard>
        {activeSubsLoading ? (
          <View style={{ alignItems: 'center', padding: 20 }}><ActivityIndicator size="small" color={PRIMARY} /></View>
        ) : activeSubsList.length === 0 ? (
          <Text style={{ color: C.textTertiary, fontSize: 13, textAlign: 'center', paddingVertical: 16 }}>No active subscribers</Text>
        ) : (
          activeSubsList.map((sub, i) => {
            const roleColor = ROLE_COLORS[sub.role as UserRole] || C.textSecondary;
            const daysLeft = sub.subscriptionEnd ? Math.max(0, Math.ceil((sub.subscriptionEnd - Date.now()) / 86400000)) : 0;
            return (
              <View key={sub.id} style={[{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }, i < activeSubsList.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border }]}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: roleColor + '20', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                  <Text style={{ color: roleColor, fontSize: 13, fontFamily: 'Inter_700Bold' }}>{getInitials(sub.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>{sub.name}</Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
                    <View style={{ backgroundColor: roleColor + '20', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                      <Text style={{ color: roleColor, fontSize: 10, fontFamily: 'Inter_500Medium' }}>{ROLE_LABELS[sub.role as UserRole]}</Text>
                    </View>
                    {sub.city ? <Text style={{ color: C.textTertiary, fontSize: 11 }}>{sub.city}</Text> : null}
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: daysLeft <= 7 ? '#FF3B30' : '#34C759', fontSize: 11, fontFamily: 'Inter_600SemiBold' }}>{daysLeft}d left</Text>
                  <Text style={{ color: C.textTertiary, fontSize: 10, marginTop: 1 }}>{sub.phone}</Text>
                </View>
              </View>
            );
          })
        )}
      </SectionCard>
    </ScrollView>
  );

  const renderInsurance = () => (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
      <Text style={ss.sectionSubtitle}>Changes instantly affect prices across the app and in Razorpay checkout.</Text>

      {insuranceLoading ? (
        <View style={{ alignItems: 'center', paddingTop: 40 }}><ActivityIndicator size="large" color={PRIMARY} /></View>
      ) : (
        <>
          <SectionCard style={{ marginBottom: 14 }}>
            <Text style={ss.cardTitle}>Plan Details</Text>
            <InputField label="Plan Name" value={insurancePlanName} onChangeText={setInsurancePlanName} placeholder="Mobile Protection Plan" />
            
            <InputField label="Yearly Plan Price (₹)" value={insuranceYearlyPrice} onChangeText={setInsuranceYearlyPrice} keyboardType="numeric" placeholder="1499" />
            <Text style={{ fontSize: 11, color: C.textTertiary, fontFamily: 'Inter_400Regular', marginTop: -8, marginBottom: 12 }}>
              Yearly subscription price: ₹{insuranceYearlyPrice || '0'}
            </Text>
            
            <InputField label="Monthly Plan Price (₹)" value={insuranceMonthlyPrice} onChangeText={setInsuranceMonthlyPrice} keyboardType="numeric" placeholder="199" />
            <Text style={{ fontSize: 11, color: C.textTertiary, fontFamily: 'Inter_400Regular', marginTop: -8, marginBottom: 12 }}>
              Monthly subscription price: ₹{insuranceMonthlyPrice || '0'}
            </Text>
            
            <InputField label="Repair Discount (₹)" value={insuranceDiscount} onChangeText={setInsuranceDiscount} keyboardType="numeric" placeholder="500" />
          </SectionCard>

          <SectionCard style={{ marginBottom: 14 }}>
            <Text style={ss.cardTitle}>Plan Status</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              {(['active', 'disabled'] as const).map(s => (
                <Pressable key={s} onPress={() => setInsuranceStatus(s)}
                  style={{ flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
                    backgroundColor: insuranceStatus === s ? (s === 'active' ? '#34C75920' : '#FF3B3020') : C.surfaceElevated,
                    borderWidth: 2, borderColor: insuranceStatus === s ? (s === 'active' ? '#34C759' : '#FF3B30') : C.border }}>
                  <Ionicons name={s === 'active' ? 'checkmark-circle' : 'close-circle'} size={22}
                    color={s === 'active' ? '#34C759' : '#FF3B30'} />
                  <Text style={{ marginTop: 4, fontFamily: 'Inter_600SemiBold', fontSize: 13,
                    color: s === 'active' ? '#34C759' : '#FF3B30', textTransform: 'capitalize' }}>
                    {s === 'active' ? 'Active' : 'Disabled'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </SectionCard>

          <SectionCard style={{ backgroundColor: PRIMARY + '08', borderColor: PRIMARY + '30', borderWidth: 1, marginBottom: 16 }}>
            <Text style={[ss.cardTitle, { color: PRIMARY }]}>Live Preview</Text>
            <Text style={{ color: C.textSecondary, fontSize: 13, marginTop: 8 }}>
              {insurancePlanName}
            </Text>
            <Text style={{ color: C.textSecondary, fontSize: 12, marginTop: 8 }}>
              Yearly: ₹{insuranceYearlyPrice} | Monthly: ₹{insuranceMonthlyPrice}
            </Text>
            <Text style={{ color: C.textSecondary, fontSize: 12, marginTop: 4 }}>
              + ₹{insuranceDiscount} off on repairs
            </Text>
          </SectionCard>

          <ActionButton
            label={insuranceSaved ? 'Saved!' : 'Save Changes'}
            onPress={saveInsuranceSettings}
            loading={insuranceSaving}
            color={insuranceSaved ? '#34C759' : PRIMARY}
            icon={insuranceSaved ? 'checkmark' : 'save-outline'}
          />
        </>
      )}
    </ScrollView>
  );

  const renderRevenue = () => {
    const rd = revenueData;
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {revenueLoading ? (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <ActivityIndicator size="large" color={PRIMARY} />
            <Text style={{ color: C.textSecondary, fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 12 }}>Loading revenue data...</Text>
          </View>
        ) : rd ? (
          <>
            <View style={ss.statsGrid}>
              <View style={[ss.statCard, { width: '100%', borderLeftWidth: 4, borderLeftColor: '#34C759' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <View>
                    <Text style={ss.statLabel}>Total Revenue</Text>
                    <Text style={[ss.statValue, { fontSize: 28, color: '#34C759' }]}>
                      ₹{rd.totalRevenue?.toLocaleString('en-IN', { maximumFractionDigits: 0 }) || '0'}
                    </Text>
                  </View>
                  <View style={[ss.statIconBox, { backgroundColor: '#34C75920' }]}>
                    <Ionicons name="trending-up" size={28} color="#34C759" />
                  </View>
                </View>
              </View>
              <StatCard label="Subscription Revenue" value={`₹${rd.subscriptionRevenue?.toLocaleString('en-IN', { maximumFractionDigits: 0 }) || '0'}`} icon="card" color="#5E8BFF" />
              <StatCard label="Course Commission" value={`₹${rd.platformCourseRevenue?.toLocaleString('en-IN', { maximumFractionDigits: 0 }) || '0'}`} icon="school" color="#FFD60A" />
              <StatCard label="Active Subscribers" value={rd.activeSubscribers || 0} icon="people" color={PRIMARY} />
              <StatCard label="Paid Enrollments" value={rd.totalEnrollments || 0} icon="play-circle" color="#FF2D55" />
              <StatCard label="Free Enrollments" value={rd.freeEnrollments || 0} icon="gift" color="#34C759" />
            </View>

            <Text style={[ss.sectionTitle, { marginTop: 20 }]}>Revenue by Role</Text>
            <SectionCard>
              {[
                { role: 'technician', label: 'Technicians', color: '#34C759' },
                { role: 'teacher', label: 'Teachers', color: '#FFD60A' },
                { role: 'supplier', label: 'Suppliers', color: '#FF6B2C' },
              ].map(({ role, label, color }, idx, arr) => {
                const count = rd.activeSubscribersByRole?.[role] || 0;
                const rev = rd.subscriptionRevenueByRole?.[role] || 0;
                return (
                  <View key={role} style={[{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }, idx < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border }]}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginRight: 10 }} />
                    <Text style={{ flex: 1, color: C.textSecondary, fontSize: 14 }}>{label} ({count} active)</Text>
                    <Text style={{ color, fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>₹{rev.toLocaleString('en-IN')}</Text>
                  </View>
                );
              })}
            </SectionCard>

            {rd.teacherRevenue?.length > 0 && (
              <>
                <Text style={[ss.sectionTitle, { marginTop: 20 }]}>Top Teacher Earnings</Text>
                <SectionCard>
                  {rd.teacherRevenue.map((t: any, i: number) => (
                    <View key={t.teacherId} style={[{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }, i < rd.teacherRevenue.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: C.text, fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>{t.name || 'Unknown'}</Text>
                        <Text style={{ color: C.textTertiary, fontSize: 11 }}>{t.enrollments} enrollments · {t.courseCount} courses</Text>
                      </View>
                      <Text style={{ color: '#FFD60A', fontFamily: 'Inter_600SemiBold' }}>₹{t.amount?.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                    </View>
                  ))}
                </SectionCard>
              </>
            )}
          </>
        ) : (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Ionicons name="trending-up-outline" size={48} color={C.textTertiary} />
            <Text style={{ color: C.textTertiary, fontSize: 15, marginTop: 12, fontFamily: 'Inter_500Medium' }}>No revenue data yet</Text>
            <ActionButton label="Refresh" onPress={fetchRevenue} style={{ marginTop: 16 }} icon="refresh-outline" />
          </View>
        )}
      </ScrollView>
    );
  };

  const renderPosts = () => (
    <FlatList
      data={posts}
      keyExtractor={item => item.id}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ padding: 16, paddingBottom: Platform.OS === 'web' ? 34 : 40 }}
      ListEmptyComponent={
        <View style={{ alignItems: 'center', padding: 40 }}>
          <Ionicons name="newspaper-outline" size={40} color={C.textTertiary} />
          <Text style={{ color: C.textTertiary, fontSize: 14, marginTop: 8 }}>No posts yet</Text>
        </View>
      }
      renderItem={({ item }) => (
        <SectionCard style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={{ color: C.text, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>{item.userName}</Text>
              <Text style={{ color: C.textTertiary, fontSize: 11, marginTop: 1 }}>{timeAgo(item.createdAt)}</Text>
            </View>
            <Pressable hitSlop={12} onPress={() => handleDeletePost(item.id, item.userName)}
              style={{ backgroundColor: '#FF3B3015', padding: 8, borderRadius: 8 }}>
              <Ionicons name="trash-outline" size={16} color="#FF3B30" />
            </Pressable>
          </View>
          <Text style={{ color: C.textSecondary, fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 8, lineHeight: 18 }} numberOfLines={3}>{item.text}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="heart" size={13} color="#FF3B30" />
              <Text style={{ fontSize: 12, color: C.textSecondary }}>{item.likes.length}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="chatbubble" size={13} color="#5E8BFF" />
              <Text style={{ fontSize: 12, color: C.textSecondary }}>{item.comments.length}</Text>
            </View>
            <View style={{ backgroundColor: C.surfaceElevated, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
              <Text style={{ fontSize: 11, color: C.textSecondary }}>{item.category}</Text>
            </View>
          </View>
        </SectionCard>
      )}
    />
  );

  const renderJobs = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {!jobs || jobs.length === 0 ? (
        <View style={{ alignItems: 'center', padding: 40 }}>
          <Ionicons name="briefcase-outline" size={40} color={C.textTertiary} />
          <Text style={{ color: C.textTertiary, fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: 8 }}>No jobs posted yet</Text>
        </View>
      ) : (
        jobs.map((job: any) => (
          <SectionCard key={job.id} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={{ fontFamily: 'Inter_600SemiBold', color: C.text, fontSize: 15 }}>{job.title}</Text>
                {job.description ? <Text style={{ color: C.textSecondary, fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 4 }}>{job.description}</Text> : null}
                <Text style={{ color: C.textTertiary, fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 6 }}>
                  {job.location ? `${job.location} · ` : ''}{job.createdAt ? new Date(job.createdAt).toLocaleDateString('en-IN') : ''}
                </Text>
              </View>
              <View
                onClick={() => {
                  Alert.alert('Delete Job', `Delete job "${job.title}"? This cannot be undone.`, [
                    { text: 'Cancel', style: 'cancel' },
                    { 
                      text: 'Delete', 
                      style: 'destructive', 
                      onPress: async () => {
                        try {
                          const res = await apiRequest('DELETE', `/api/jobs/${job.id}`);
                          if (res.ok) {
                            await refreshData();
                            Alert.alert('Success', 'Job deleted successfully');
                          } else {
                            Alert.alert('Error', 'Failed to delete job');
                          }
                        } catch (e) {
                          Alert.alert('Error', 'Failed to delete job');
                        }
                      }
                    }
                  ]);
                }}
                style={{ backgroundColor: '#FF3B3015', padding: 8, borderRadius: 8, cursor: 'pointer' } as any}
              >
                <Ionicons name="trash-outline" size={16} color="#FF3B30" />
              </View>
            </View>
          </SectionCard>
        ))
      )}
    </ScrollView>
  );

  const renderAds = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <SectionCard style={{ marginBottom: 16 }}>
        <Text style={ss.cardTitle}>Create New Ad</Text>
        <InputField label="Title *" value={newAdTitle} onChangeText={setNewAdTitle} placeholder="Ad title" />
        <InputField label="Description" value={newAdDescription} onChangeText={setNewAdDescription} placeholder="Short description" multiline />
        <InputField label="Image URL" value={newAdImageUrl} onChangeText={setNewAdImageUrl} placeholder="https://example.com/image.jpg" />
        <InputField label="Link URL" value={newAdLinkUrl} onChangeText={setNewAdLinkUrl} placeholder="https://example.com" />
        <ActionButton label="Create Ad" onPress={createAd} loading={adSaving} icon="add-circle-outline" />
      </SectionCard>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={ss.sectionTitle}>All Ads ({adsList.length})</Text>
        <Pressable onPress={fetchAds} style={{ padding: 6 }}>
          <Ionicons name="refresh" size={18} color={C.textSecondary} />
        </Pressable>
      </View>

      {adsLoading ? (
        <View style={{ alignItems: 'center', paddingTop: 20 }}><ActivityIndicator size="large" color={PRIMARY} /></View>
      ) : adsList.length === 0 ? (
        <View style={{ alignItems: 'center', padding: 32 }}>
          <Ionicons name="megaphone-outline" size={40} color={C.textTertiary} />
          <Text style={{ color: C.textTertiary, fontSize: 14, marginTop: 8 }}>No ads yet</Text>
        </View>
      ) : (
        adsList.map((ad: any) => (
          <SectionCard key={ad.id} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text }}>{ad.title}</Text>
                {ad.description ? <Text style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>{ad.description}</Text> : null}
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable onPress={() => toggleAd(ad.id, ad.active)}
                  style={{ backgroundColor: ad.active ? '#34C75920' : C.surfaceElevated, padding: 6, borderRadius: 8 }}>
                  <Ionicons name={ad.active ? 'eye' : 'eye-off'} size={16} color={ad.active ? '#34C759' : C.textTertiary} />
                </Pressable>
                <Pressable onPress={() => deleteAd(ad.id)}
                  style={{ backgroundColor: '#FF3B3015', padding: 6, borderRadius: 8 }}>
                  <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                </Pressable>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <View style={{ backgroundColor: ad.active ? '#34C75915' : C.surfaceElevated, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                <Text style={{ fontSize: 11, color: ad.active ? '#34C759' : C.textTertiary, fontFamily: 'Inter_600SemiBold' }}>
                  {ad.active ? 'Active' : 'Hidden'}
                </Text>
              </View>
            </View>
          </SectionCard>
        ))
      )}
    </ScrollView>
  );

  const filteredListings = allProducts.filter(p =>
    !listingsSearch.trim() ||
    (p.name || p.title || '').toLowerCase().includes(listingsSearch.toLowerCase()) ||
    (p.description || '').toLowerCase().includes(listingsSearch.toLowerCase())
  );

  const renderListings = () => (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: C.border }}>
          <Ionicons name="search" size={16} color={C.textTertiary} />
          <TextInput value={listingsSearch} onChangeText={setListingsSearch}
            placeholder="Search listings..."
            placeholderTextColor={C.textTertiary}
            style={{ flex: 1, color: C.text, paddingVertical: 10, paddingHorizontal: 8, fontFamily: 'Inter_400Regular', fontSize: 14 }} />
        </View>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={listingsLoading} onRefresh={fetchAllProducts} tintColor={PRIMARY} />}>
        {listingsLoading ? (
          <View style={{ alignItems: 'center', paddingTop: 40 }}><ActivityIndicator size="large" color={PRIMARY} /></View>
        ) : filteredListings.length === 0 ? (
          <View style={{ alignItems: 'center', padding: 40 }}>
            <Ionicons name="cube-outline" size={40} color={C.textTertiary} />
            <Text style={{ color: C.textTertiary, fontSize: 14, marginTop: 8 }}>No listings found</Text>
          </View>
        ) : (
          filteredListings.map((p: any) => (
            <SectionCard key={p.id} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text }}>{p.name || p.title || 'Unnamed'}</Text>
                  {p.description ? <Text style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }} numberOfLines={2}>{p.description}</Text> : null}
                  <Text style={{ fontSize: 12, color: PRIMARY, fontFamily: 'Inter_600SemiBold', marginTop: 4 }}>
                    {p.price ? `₹${p.price}` : 'No price'}
                  </Text>
                </View>
                <Pressable onPress={() => deleteListing(p.id)}
                  style={{ backgroundColor: '#FF3B3015', padding: 8, borderRadius: 8 }}>
                  <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                </Pressable>
              </View>
            </SectionCard>
          ))
        )}
      </ScrollView>
    </View>
  );

  const renderLinks = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={ss.sectionSubtitle}>Manage links that appear in the app for users to access content.</Text>

      {linksLoading ? (
        <View style={{ alignItems: 'center', paddingTop: 40 }}><ActivityIndicator size="large" color={PRIMARY} /></View>
      ) : (
        [
          { key: 'live_url', label: 'Mobi Live Link', desc: 'Opens inside the app when users tap Mobi Live.', value: liveUrl, setter: setLiveUrl, color: '#FF3B30', icon: 'radio-outline' as any, placeholder: 'https://youtube.com/live/...' },
          { key: 'schematics_url', label: 'Schematics Link', desc: 'Opens when users tap the Schematics button.', value: schematicsUrl, setter: setSchematicsUrl, color: '#FFD60A', icon: 'document-text-outline' as any, placeholder: 'https://...' },
          { key: 'web_tools_url', label: 'Web Tools Link', desc: 'Opens when users tap the Tools button.', value: webToolsUrl, setter: setWebToolsUrl, color: '#5E8BFF', icon: 'globe-outline' as any, placeholder: 'https://example.com/tools' },
          { key: 'whatsapp_support_link', label: 'WhatsApp Support', desc: 'Opens WhatsApp when users tap Contact Us.', value: whatsappSupportUrl, setter: setWhatsappSupportUrl, color: '#25D366', icon: 'logo-whatsapp' as any, placeholder: 'https://wa.link/...' },
        ].map(link => (
          <SectionCard key={link.key} style={{ marginBottom: 14, borderLeftWidth: 4, borderLeftColor: link.color }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: link.color + '20', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={link.icon} size={18} color={link.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text }}>{link.label}</Text>
                <Text style={{ fontSize: 11, color: C.textTertiary }}>{link.desc}</Text>
              </View>
            </View>
            <TextInput
              style={[ss.input, { marginBottom: 10 }]}
              placeholder={link.placeholder}
              placeholderTextColor={C.textTertiary}
              value={link.value}
              onChangeText={link.setter}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={() => saveLink(link.key, link.value)}
                style={{ flex: 1, backgroundColor: link.color, borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}>
                <Text style={{ color: ['#FFD60A'].includes(link.color) ? '#000' : '#FFF', fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>Save</Text>
              </Pressable>
              {link.value ? (
                <Pressable onPress={() => { link.setter(''); saveLink(link.key, ''); }}
                  style={{ paddingHorizontal: 14, backgroundColor: '#FF3B3015', borderRadius: 10, justifyContent: 'center', borderWidth: 1, borderColor: '#FF3B3030' }}>
                  <Text style={{ color: '#FF3B30', fontSize: 13, fontFamily: 'Inter_500Medium' }}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
          </SectionCard>
        ))
      )}
    </ScrollView>
  );

  const renderNotifications = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

      {/* Push stats */}
      <SectionCard style={{ marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={ss.cardTitle}>Push Token Stats</Text>
          <Pressable onPress={fetchPushStats} style={{ padding: 6 }}>
            <Ionicons name="refresh" size={16} color={PRIMARY} />
          </Pressable>
        </View>
        {pushStatsLoading ? (
          <View style={{ alignItems: 'center', padding: 12 }}><ActivityIndicator size="small" color={PRIMARY} /></View>
        ) : pushStats ? (
          <>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {[
                { label: 'Registered', value: pushStats.withToken, color: '#34C759' },
                { label: 'Total Users', value: pushStats.total, color: C.text },
                { label: 'Coverage', value: `${pushStats.total > 0 ? Math.round((pushStats.withToken / pushStats.total) * 100) : 0}%`, color: '#FF9F0A' },
              ].map(stat => (
                <View key={stat.label} style={{ flex: 1, backgroundColor: C.surfaceElevated, borderRadius: 10, padding: 12, alignItems: 'center' }}>
                  <Text style={{ fontSize: 22, fontFamily: 'Inter_700Bold', color: stat.color }}>{stat.value}</Text>
                  <Text style={{ fontSize: 10, color: C.textTertiary, marginTop: 2 }}>{stat.label}</Text>
                </View>
              ))}
            </View>
            {pushStats.byRole && Object.keys(pushStats.byRole).length > 0 && (
              <View style={{ marginTop: 12, gap: 6 }}>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: C.textTertiary }}>BY ROLE</Text>
                {Object.entries(pushStats.byRole).map(([role, count]) => {
                  const opt = NOTIF_ROLE_OPTIONS.find(o => o.key === role);
                  return (
                    <View key={role} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: opt?.color || C.textTertiary }} />
                        <Text style={{ fontSize: 12, color: C.textSecondary }}>{opt?.label || role}</Text>
                      </View>
                      <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.text }}>{count}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        ) : (
          <Pressable onPress={fetchPushStats}>
            <Text style={{ fontSize: 13, color: PRIMARY }}>Tap refresh to load stats</Text>
          </Pressable>
        )}
      </SectionCard>

      {/* Send push notification */}
      <SectionCard style={{ marginBottom: 14 }}>
        <Text style={ss.cardTitle}>Send Push Notification</Text>
        <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.textSecondary, marginTop: 12, marginBottom: 8 }}>Target Audience</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 14 }}>
          {NOTIF_ROLE_OPTIONS.map(opt => (
            <Pressable key={opt.key} onPress={() => setNotifTargetRole(opt.key)}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
                backgroundColor: notifTargetRole === opt.key ? opt.color : C.surfaceElevated,
                borderWidth: 1, borderColor: notifTargetRole === opt.key ? opt.color : C.border }}>
              <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: notifTargetRole === opt.key ? '#FFF' : C.textSecondary }}>{opt.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <InputField label="Title" value={notifTitle} onChangeText={setNotifTitle} placeholder="e.g. New Feature Available!" />
        <InputField label="Message" value={notifBody} onChangeText={setNotifBody} placeholder="Type your notification message..." multiline />
        {notifResult && (
          <View style={{ backgroundColor: notifResult.startsWith('✅') ? '#34C75920' : '#FF3B3020', borderRadius: 8, padding: 10, marginBottom: 12 }}>
            <Text style={{ fontSize: 13, color: notifResult.startsWith('✅') ? '#34C759' : '#FF3B30', fontFamily: 'Inter_500Medium' }}>{notifResult}</Text>
          </View>
        )}
        <ActionButton
          label={notifSending ? 'Sending...' : notifTargetRole === 'all' ? 'Send to All Users' : `Send to ${NOTIF_ROLE_OPTIONS.find(o => o.key === notifTargetRole)?.label}`}
          onPress={sendNotificationToAll}
          loading={notifSending}
          icon="send"
          color={PRIMARY}
        />
      </SectionCard>

      {/* SMS */}
      <SectionCard>
        <Text style={ss.cardTitle}>Send SMS</Text>
        <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.textSecondary, marginTop: 12, marginBottom: 8 }}>Target Audience</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 14 }}>
          {NOTIF_ROLE_OPTIONS.map(opt => (
            <Pressable key={opt.key} onPress={() => setSmsTargetRole(opt.key)}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
                backgroundColor: smsTargetRole === opt.key ? opt.color : C.surfaceElevated,
                borderWidth: 1, borderColor: smsTargetRole === opt.key ? opt.color : C.border }}>
              <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: smsTargetRole === opt.key ? '#FFF' : C.textSecondary }}>{opt.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <InputField label="SMS Message" value={smsBody} onChangeText={setSmsBody} placeholder="Type your SMS..." multiline />
        {smsResult && (
          <View style={{ backgroundColor: smsResult.startsWith('✅') ? '#34C75920' : '#FF3B3020', borderRadius: 8, padding: 10, marginBottom: 12 }}>
            <Text style={{ fontSize: 13, color: smsResult.startsWith('✅') ? '#34C759' : '#FF3B30', fontFamily: 'Inter_500Medium' }}>{smsResult}</Text>
          </View>
        )}
        <ActionButton
          label={smsSending ? 'Sending...' : `Send SMS`}
          onPress={sendSMS}
          loading={smsSending}
          icon="chatbubble-ellipses"
          color="#34C759"
        />
      </SectionCard>
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
    sending: '#FFD60A', sent: '#34C759', scheduled: '#5E8BFF', pending: '#888', failed: '#FF3B30',
  };

  const renderEmail = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {/* Stats */}
      {emailStatsLoading ? (
        <ActivityIndicator color={PRIMARY} style={{ marginBottom: 16 }} />
      ) : emailStats ? (
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'With Email', value: emailStats.totalWithEmail, color: '#5E8BFF' },
            { label: 'Subscribed', value: emailStats.subscribed, color: '#34C759' },
            { label: 'Unsubscribed', value: emailStats.unsubscribed, color: '#FF3B30' },
          ].map(stat => (
            <View key={stat.label} style={{ flex: 1, backgroundColor: C.surface, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: C.border }}>
              <Text style={{ fontSize: 22, fontFamily: 'Inter_700Bold', color: stat.color }}>{stat.value}</Text>
              <Text style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>{stat.label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Compose */}
      <SectionCard style={{ marginBottom: 16 }}>
        <Text style={ss.cardTitle}>Compose Campaign</Text>
        <Text style={{ fontSize: 11, color: C.textTertiary, marginTop: 2, marginBottom: 14 }}>Sends in batches of 50 · 2s delay between batches</Text>

        <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.textSecondary, marginBottom: 8 }}>Target Audience</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 14 }}>
          {EMAIL_TARGET_OPTIONS.map(opt => (
            <Pressable key={opt.key} onPress={() => setEmailTargetRole(opt.key)}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
                backgroundColor: emailTargetRole === opt.key ? opt.color : C.surfaceElevated,
                borderWidth: 1, borderColor: emailTargetRole === opt.key ? opt.color : C.border }}>
              <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: emailTargetRole === opt.key ? '#FFF' : C.textSecondary }}>{opt.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <InputField label="Subject Line" value={emailSubject} onChangeText={setEmailSubject} placeholder="e.g. Exciting Update from Mobi!" />
        <InputField label="Message Body" value={emailBody} onChangeText={setEmailBody} placeholder="Write your email here..." multiline />

        <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12, marginBottom: 14 }}>
          <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.textSecondary, marginBottom: 8 }}>Schedule (optional)</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TextInput value={emailScheduleDate} onChangeText={setEmailScheduleDate} placeholder="YYYY-MM-DD"
              placeholderTextColor={C.textTertiary}
              style={[ss.input, { flex: 1, marginBottom: 0 }]} />
            <TextInput value={emailScheduleTime} onChangeText={setEmailScheduleTime} placeholder="HH:MM"
              placeholderTextColor={C.textTertiary}
              style={[ss.input, { width: 90, marginBottom: 0 }]} />
          </View>
          <Text style={{ fontSize: 11, color: C.textTertiary, marginTop: 6 }}>Leave blank to send immediately</Text>
        </View>

        {emailResult && (
          <View style={{ backgroundColor: emailResult.startsWith('✅') ? '#34C75920' : '#FF3B3020', borderRadius: 8, padding: 10, marginBottom: 12 }}>
            <Text style={{ fontSize: 13, color: emailResult.startsWith('✅') ? '#34C759' : '#FF3B30', fontFamily: 'Inter_500Medium' }}>{emailResult}</Text>
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable onPress={() => sendBulkEmail(false)} disabled={emailSending}
            style={{ flex: 1, backgroundColor: emailSending ? '#ccc' : '#5E8BFF', borderRadius: 12, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
            {emailSending ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="send" size={15} color="#FFF" />}
            <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: '#FFF' }}>{emailSending ? 'Sending...' : 'Send Now'}</Text>
          </Pressable>
          <Pressable onPress={() => sendBulkEmail(true)} disabled={emailSending}
            style={{ flex: 1, backgroundColor: emailSending ? '#ccc' : '#FF9500', borderRadius: 12, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
            <Ionicons name="time" size={15} color="#FFF" />
            <Text style={{ fontSize: 14, fontFamily: 'Inter_700Bold', color: '#FFF' }}>Schedule</Text>
          </Pressable>
        </View>
      </SectionCard>

      {/* Campaign history */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={ss.sectionTitle}>Campaign History</Text>
        <Pressable onPress={fetchEmailStats} style={{ padding: 6 }}>
          <Ionicons name="refresh" size={16} color={C.textSecondary} />
        </Pressable>
      </View>
      {emailCampaignList.length === 0 ? (
        <View style={{ alignItems: 'center', padding: 32 }}>
          <Ionicons name="mail-open-outline" size={40} color={C.textTertiary} />
          <Text style={{ color: C.textTertiary, fontSize: 14, marginTop: 8 }}>No campaigns yet</Text>
        </View>
      ) : (
        emailCampaignList.map(camp => (
          <SectionCard key={camp.id} style={{ marginBottom: 10, borderLeftWidth: 4, borderLeftColor: CAMPAIGN_STATUS_COLOR[camp.status] || '#888' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text }} numberOfLines={1}>{camp.subject}</Text>
                <Text style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }} numberOfLines={2}>{camp.message}</Text>
              </View>
              <View style={{ backgroundColor: (CAMPAIGN_STATUS_COLOR[camp.status] || '#888') + '25', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 }}>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: CAMPAIGN_STATUS_COLOR[camp.status] || '#888', textTransform: 'capitalize' }}>{camp.status}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 14, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="people-outline" size={13} color={C.textTertiary} />
                <Text style={{ fontSize: 11, color: C.textSecondary }}>{camp.targetRole === 'all' ? 'All Users' : camp.targetRole}</Text>
              </View>
              {camp.total > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="checkmark-circle-outline" size={13} color="#34C759" />
                  <Text style={{ fontSize: 11, color: C.textSecondary }}>{camp.sent}/{camp.total}</Text>
                </View>
              )}
              <Text style={{ fontSize: 11, color: C.textTertiary, marginLeft: 'auto' }}>
                {camp.sentAt ? new Date(camp.sentAt).toLocaleDateString() : camp.scheduledAt ? `Sched: ${new Date(camp.scheduledAt).toLocaleDateString()}` : new Date(camp.createdAt).toLocaleDateString()}
              </Text>
            </View>
          </SectionCard>
        ))
      )}
    </ScrollView>
  );

  const renderDeviceLock = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <SectionCard style={{ marginBottom: 14 }}>
        <Text style={ss.cardTitle}>Device Lock Settings</Text>
        <View style={{ marginTop: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text }}>Enable Device Lock</Text>
            <Text style={{ fontSize: 11, color: C.textTertiary, marginTop: 2 }}>Allow users to lock accounts to one device</Text>
          </View>
          <Switch value={deviceLockEnabled} onValueChange={toggleDeviceLock}
            trackColor={{ false: C.surfaceElevated, true: PRIMARY + '60' }}
            thumbColor={deviceLockEnabled ? PRIMARY : C.textTertiary} />
        </View>
        {deviceLockEnabled && (
          <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12 }}>
            <InputField label="Lock Price (₹)" value={deviceLockPrice} onChangeText={setDeviceLockPrice} keyboardType="numeric" placeholder="100" />
          </View>
        )}
      </SectionCard>

      <Text style={[ss.sectionTitle, { marginBottom: 12 }]}>Locked Users ({lockNotifications.length})</Text>
      {lockNotifLoading ? (
        <View style={{ alignItems: 'center', paddingTop: 20 }}><ActivityIndicator size="large" color={PRIMARY} /></View>
      ) : lockNotifications.length === 0 ? (
        <View style={{ alignItems: 'center', padding: 40 }}>
          <Ionicons name="lock-open-outline" size={40} color={C.textTertiary} />
          <Text style={{ color: C.textTertiary, fontSize: 14, marginTop: 8 }}>No locked accounts</Text>
        </View>
      ) : (
        lockNotifications.map((notif: any) => (
          <SectionCard key={notif.userId} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <View>
                <Text style={{ color: C.text, fontSize: 14, fontFamily: 'Inter_600SemiBold' }}>{notif.userName || 'Unknown User'}</Text>
                <Text style={{ color: C.textSecondary, fontSize: 11, marginTop: 2 }}>{notif.phone}</Text>
              </View>
              <View style={{ backgroundColor: '#FF3B3020', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                <Text style={{ color: '#FF3B30', fontSize: 11, fontFamily: 'Inter_600SemiBold' }}>LOCKED</Text>
              </View>
            </View>
            {notif.lockedDevice && (
              <View style={{ backgroundColor: C.surfaceElevated, borderRadius: 8, padding: 10, marginBottom: 10 }}>
                <Text style={{ fontSize: 11, color: C.textSecondary }}>{notif.lockedDevice}</Text>
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                style={{ flex: 1, backgroundColor: PRIMARY, borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}
                disabled={unlockingUserId === notif.userId}
                onPress={() => unlockUser(notif.userId, notif.userName)}>
                {unlockingUserId === notif.userId ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={{ color: '#FFF', fontFamily: 'Inter_700Bold', fontSize: 13 }}>Unlock Account</Text>
                )}
              </Pressable>
              <Pressable
                style={{ flex: 1, backgroundColor: '#34C75915', borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#34C75940' }}
                onPress={() => resetUserDevice(notif.userId, notif.userName)}>
                <Text style={{ color: '#34C759', fontFamily: 'Inter_700Bold', fontSize: 13 }}>Reset Device</Text>
              </Pressable>
            </View>
          </SectionCard>
        ))
      )}
    </ScrollView>
  );

  const renderProtectionPlans = () => {
    const PLAN_FILTERS = ['all', 'pending_verification', 'approved_pending_payment', 'active', 'rejected'];
    const statusLabel: Record<string, string> = {
      all: 'All', pending_verification: 'Pending', approved_pending_payment: 'Approved',
      active: 'Active', rejected: 'Rejected',
    };
    const statusColor: Record<string, string> = {
      pending_verification: '#F59E0B', approved_pending_payment: '#4A90D9',
      active: '#27AE60', rejected: '#E53E3E',
    };

    // Filter plans by status and search query
    const filteredPlans = protectionPlans.filter(plan => {
      const statusMatch = protectionPlanFilter === 'all' || plan.status === protectionPlanFilter;
      const searchLower = protectionPlanSearchQuery.toLowerCase();
      const searchMatch = !searchLower || 
        (plan.userName && plan.userName.toLowerCase().includes(searchLower)) ||
        (plan.userPhone && plan.userPhone.includes(searchLower)) ||
        (plan.userEmail && plan.userEmail.toLowerCase().includes(searchLower)) ||
        (plan.brand && plan.brand.toLowerCase().includes(searchLower)) ||
        (plan.model && plan.model.toLowerCase().includes(searchLower)) ||
        (plan.imei && plan.imei.includes(searchLower));
      return statusMatch && searchMatch;
    });

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={protectionPlansLoading} onRefresh={fetchProtectionPlans} tintColor={PRIMARY} />}>
        <Text style={ss.sectionTitle}>Mobile Protection Plans</Text>

        {/* Search input */}
        <TextInput
          placeholder="Search by name, phone, email, brand, model, or IMEI..."
          placeholderTextColor={C.textSecondary}
          value={protectionPlanSearchQuery}
          onChangeText={setProtectionPlanSearchQuery}
          style={{ 
            backgroundColor: C.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
            color: C.text, fontSize: 14, marginBottom: 14, borderWidth: 1, borderColor: C.border
          }}
        />

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {PLAN_FILTERS.map(f => (
              <TouchableOpacity key={f}
                style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5,
                  borderColor: protectionPlanFilter === f ? PRIMARY : C.border,
                  backgroundColor: protectionPlanFilter === f ? '#FFF3ED' : C.surface }}
                onPress={() => setProtectionPlanFilter(f)}>
                <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: protectionPlanFilter === f ? PRIMARY : C.textSecondary }}>
                  {statusLabel[f]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {protectionPlansLoading ? <ActivityIndicator color={PRIMARY} style={{ marginTop: 40 }} /> :
          filteredPlans.length === 0 ? (
            <SectionCard><Text style={{ color: C.textSecondary, textAlign: 'center', padding: 20 }}>No plans found</Text></SectionCard>
          ) : (
            filteredPlans.map(plan => (
              <SectionCard key={plan.id} style={{ marginBottom: 10 }}>
                {/* Status badge */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text style={{ color: C.text, fontFamily: 'Inter_700Bold', fontSize: 16 }}>
                    {plan.devices && plan.devices.length > 0 
                      ? `${plan.devices[0].brand} ${plan.devices[0].model}` 
                      : plan.brand ? `${plan.brand} ${plan.model}` : 'Device'}
                  </Text>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: `${statusColor[plan.status] || '#999'}20` }}>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: statusColor[plan.status] || '#999' }}>
                      {statusLabel[plan.status] || plan.status}
                    </Text>
                  </View>
                </View>

                {/* User info section */}
                <View style={{ backgroundColor: '#F8F8F8', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                  <Text style={{ color: C.text, fontFamily: 'Inter_600SemiBold', fontSize: 13, marginBottom: 8 }}>Customer Details</Text>
                  <Text style={{ color: C.text, fontSize: 13, marginBottom: 6 }}>
                    <Text style={{ fontFamily: 'Inter_600SemiBold' }}>Name: </Text>
                    {plan.userName || 'N/A'}
                  </Text>
                  <Text style={{ color: C.text, fontSize: 13, marginBottom: 6 }}>
                    <Text style={{ fontFamily: 'Inter_600SemiBold' }}>Mobile: </Text>
                    {plan.userPhone || 'N/A'}
                  </Text>
                  <Text style={{ color: C.text, fontSize: 13 }}>
                    <Text style={{ fontFamily: 'Inter_600SemiBold' }}>Email: </Text>
                    {plan.userEmail || 'N/A'}
                  </Text>
                </View>

                {/* Device details - show first device or fallback to root properties */}
                {plan.devices && Array.isArray(plan.devices) && plan.devices.length > 0 ? (
                  <View>
                    <Text style={{ color: C.textSecondary, fontSize: 12, marginBottom: 2 }}>IMEI: {plan.devices[0].imei || 'N/A'}</Text>
                    <Text style={{ color: C.textSecondary, fontSize: 12, marginBottom: 2 }}>Model No: {plan.devices[0].modelNumber || 'N/A'}</Text>
                  </View>
                ) : (
                  <View>
                    <Text style={{ color: C.textSecondary, fontSize: 12, marginBottom: 2 }}>IMEI: {plan.imei || 'N/A'}</Text>
                    <Text style={{ color: C.textSecondary, fontSize: 12, marginBottom: 2 }}>Model No: {plan.modelNumber || 'N/A'}</Text>
                  </View>
                )}
                <Text style={{ color: C.textSecondary, fontSize: 12, marginBottom: 2 }}>Plan: {plan.planType === 'yearly' ? 'Yearly ₹1499' : 'Monthly ₹447'} | Claim: {plan.claimUsed ? 'Used' : 'Available'}</Text>
                <Text style={{ color: C.textSecondary, fontSize: 11, marginBottom: 12 }}>{new Date(plan.createdAt).toLocaleString('en-IN')}</Text>

                {/* Device images section - show first device images */}
                {plan.devices && Array.isArray(plan.devices) && plan.devices.length > 0 && (plan.devices[0].frontImage || plan.devices[0].backImage) ? (
                  <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border }}>
                    <Text style={{ color: C.text, fontFamily: 'Inter_600SemiBold', fontSize: 12, marginBottom: 8 }}>Device 1 Images:</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {plan.devices[0].frontImage ? (
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: C.textSecondary, fontSize: 11, marginBottom: 4 }}>Front</Text>
                          <Image source={{ uri: plan.devices[0].frontImage }} style={{ width: '100%', height: 100, borderRadius: 8, backgroundColor: '#F0F0F0' }} resizeMode="cover" />
                        </View>
                      ) : (
                        <View style={{ flex: 1, height: 100, backgroundColor: C.surfaceElevated, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: C.textSecondary, fontSize: 11 }}>No front image</Text>
                        </View>
                      )}
                      {plan.devices[0].backImage ? (
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: C.textSecondary, fontSize: 11, marginBottom: 4 }}>Back</Text>
                          <Image source={{ uri: plan.devices[0].backImage }} style={{ width: '100%', height: 100, borderRadius: 8, backgroundColor: '#F0F0F0' }} resizeMode="cover" />
                        </View>
                      ) : (
                        <View style={{ flex: 1, height: 100, backgroundColor: C.surfaceElevated, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: C.textSecondary, fontSize: 11 }}>No back image</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ) : (plan.frontImage || plan.backImage) ? (
                  <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border }}>
                    <Text style={{ color: C.text, fontFamily: 'Inter_600SemiBold', fontSize: 12, marginBottom: 8 }}>Device Images:</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {plan.frontImage ? (
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: C.textSecondary, fontSize: 11, marginBottom: 4 }}>Front</Text>
                          <Image source={{ uri: plan.frontImage }} style={{ width: '100%', height: 100, borderRadius: 8, backgroundColor: '#F0F0F0' }} resizeMode="cover" />
                        </View>
                      ) : (
                        <View style={{ flex: 1, height: 100, backgroundColor: C.surfaceElevated, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: C.textSecondary, fontSize: 11 }}>No front image</Text>
                        </View>
                      )}
                      {plan.backImage ? (
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: C.textSecondary, fontSize: 11, marginBottom: 4 }}>Back</Text>
                          <Image source={{ uri: plan.backImage }} style={{ width: '100%', height: 100, borderRadius: 8, backgroundColor: '#F0F0F0' }} resizeMode="cover" />
                        </View>
                      ) : (
                        <View style={{ flex: 1, height: 100, backgroundColor: C.surfaceElevated, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: C.textSecondary, fontSize: 11 }}>No back image</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ) : (
                  <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border }}>
                    <Text style={{ color: C.text, fontFamily: 'Inter_600SemiBold', fontSize: 12, marginBottom: 8 }}>Device Images:</Text>
                    <View style={{ padding: 12, backgroundColor: C.surfaceElevated, borderRadius: 8, alignItems: 'center' }}>
                      <Text style={{ color: C.textSecondary, fontSize: 12 }}>📸 No images uploaded</Text>
                    </View>
                  </View>
                )}

                {/* Additional devices section */}
                {plan.devices && plan.devices.length > 0 && (() => {
                  try {
                    const devices = typeof plan.devices === 'string' ? JSON.parse(plan.devices) : plan.devices;
                    if (devices && devices.length > 0) {
                      return (
                        <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border }}>
                          <Text style={{ color: C.text, fontFamily: 'Inter_600SemiBold', fontSize: 12, marginBottom: 8 }}>Additional Devices ({devices.length}):</Text>
                          {devices.map((device: any, idx: number) => (
                            <View key={idx} style={{ backgroundColor: '#F8F8F8', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                              <Text style={{ color: C.text, fontFamily: 'Inter_600SemiBold', fontSize: 12, marginBottom: 4 }}>Device {idx + 2}</Text>
                              <Text style={{ color: C.textSecondary, fontSize: 12 }}>Brand: {device.brand || '—'}</Text>
                              <Text style={{ color: C.textSecondary, fontSize: 12 }}>Model: {device.model || '—'}</Text>
                              <Text style={{ color: C.textSecondary, fontSize: 12 }}>Model No: {device.modelNumber || '—'}</Text>
                              <Text style={{ color: C.textSecondary, fontSize: 12 }}>IMEI: {device.imei || '—'}</Text>
                              {(device.frontImage || device.backImage) && (
                                <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                                  {device.frontImage ? (
                                    <View style={{ flex: 1 }}>
                                      <Text style={{ color: C.textSecondary, fontSize: 10, marginBottom: 2 }}>Front</Text>
                                      <Image source={{ uri: device.frontImage }} style={{ width: '100%', height: 60, borderRadius: 6, backgroundColor: '#F0F0F0' }} resizeMode="cover" />
                                    </View>
                                  ) : null}
                                  {device.backImage ? (
                                    <View style={{ flex: 1 }}>
                                      <Text style={{ color: C.textSecondary, fontSize: 10, marginBottom: 2 }}>Back</Text>
                                      <Image source={{ uri: device.backImage }} style={{ width: '100%', height: 60, borderRadius: 6, backgroundColor: '#F0F0F0' }} resizeMode="cover" />
                                    </View>
                                  ) : null}
                                </View>
                              )}
                            </View>
                          ))}
                        </View>
                      );
                    }
                  } catch (e) {
                    console.warn('Error parsing devices:', e);
                  }
                  return null;
                })()}

                {plan.status === 'pending_verification' && (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <TouchableOpacity 
                      style={{ flex: 1, padding: 10, borderRadius: 8, backgroundColor: '#E8F5ED', alignItems: 'center', justifyContent: 'center', minHeight: 40 }}
                      onPress={() => {
                        const isWeb = typeof window !== 'undefined';
                        if (isWeb) {
                          // Web: Use browser confirm
                          const confirmed = window.confirm('Approve this Mobile Protection Plan application?');
                          if (confirmed) {
                            console.log('[Admin] Approve button pressed for plan:', plan.id);
                            handleProtectionPlanAction(plan.id, 'approve');
                          }
                        } else {
                          // Mobile: Use Alert.alert
                          Alert.alert('Approve Plan', 'Approve this Mobile Protection Plan application?', [
                            { text: 'Cancel', style: 'cancel' },
                            { 
                              text: 'Approve', 
                              style: 'default', 
                              onPress: () => {
                                console.log('[Admin] Approve button pressed for plan:', plan.id);
                                handleProtectionPlanAction(plan.id, 'approve');
                              },
                            },
                          ]);
                        }
                      }}
                      activeOpacity={0.7}>
                      <Text style={{ color: '#27AE60', fontFamily: 'Inter_700Bold', fontSize: 13 }}>✓ Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={{ flex: 1, padding: 10, borderRadius: 8, backgroundColor: '#FFEEEE', alignItems: 'center', justifyContent: 'center', minHeight: 40 }}
                      onPress={() => {
                        const isWeb = typeof window !== 'undefined';
                        if (isWeb) {
                          // Web: Use browser prompt
                          const reason = window.prompt('Enter reason for rejection:', 'Does not meet eligibility criteria');
                          if (reason !== null) {
                            console.log('[Admin] Reject button pressed for plan:', plan.id);
                            handleProtectionPlanAction(plan.id, 'reject', reason);
                          }
                        } else {
                          // Mobile: Use Alert.alert with custom message
                          Alert.alert('Reject Plan', 'This plan will be rejected. Are you sure?', [
                            { text: 'Cancel', style: 'cancel' },
                            { 
                              text: 'Reject', 
                              style: 'destructive',
                              onPress: () => {
                                console.log('[Admin] Reject button pressed for plan:', plan.id);
                                handleProtectionPlanAction(plan.id, 'reject', 'Does not meet eligibility criteria');
                              },
                            },
                          ]);
                        }
                      }}
                      activeOpacity={0.7}>
                      <Text style={{ color: '#E53E3E', fontFamily: 'Inter_700Bold', fontSize: 13 }}>✗ Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </SectionCard>
            ))
          )
        }
      </ScrollView>
    );
  };

  const renderProtectionClaims = () => {
    const CLAIM_FILTERS = ['all', 'claim_pending', 'under_review', 'approved', 'assigned', 'completed', 'rejected'];
    const statusLabel: Record<string, string> = {
      all: 'All', claim_pending: 'Pending', under_review: 'Under Review',
      approved: 'Approved', assigned: 'Assigned', completed: 'Completed', rejected: 'Rejected',
    };
    const statusColor: Record<string, string> = {
      claim_pending: '#F59E0B', under_review: '#4A90D9', approved: '#27AE60',
      assigned: '#FF6B2C', completed: '#27AE60', rejected: '#E53E3E',
    };
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={protectionClaimsLoading} onRefresh={fetchProtectionClaims} tintColor={PRIMARY} />}>
        <Text style={ss.sectionTitle}>Protection Plan Claims</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {CLAIM_FILTERS.map(f => (
              <TouchableOpacity key={f}
                style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5,
                  borderColor: protectionClaimFilter === f ? PRIMARY : C.border,
                  backgroundColor: protectionClaimFilter === f ? '#FFF3ED' : C.surface }}
                onPress={() => setProtectionClaimFilter(f)}>
                <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: protectionClaimFilter === f ? PRIMARY : C.textSecondary }}>
                  {statusLabel[f]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {protectionClaimsLoading ? <ActivityIndicator color={PRIMARY} style={{ marginTop: 40 }} /> :
          protectionClaims.length === 0 ? (
            <SectionCard><Text style={{ color: C.textSecondary, textAlign: 'center', padding: 20 }}>No claims found</Text></SectionCard>
          ) : (
            protectionClaims.map(claim => (
              <SectionCard key={claim.id} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ color: C.text, fontFamily: 'Inter_700Bold', fontSize: 15 }}>{claim.issue}</Text>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: `${statusColor[claim.status] || '#999'}20` }}>
                    <Text style={{ fontSize: 11, fontFamily: 'Inter_700Bold', color: statusColor[claim.status] || '#999' }}>
                      {statusLabel[claim.status] || claim.status}
                    </Text>
                  </View>
                </View>
                <Text style={{ color: C.textSecondary, fontSize: 12, marginBottom: 2 }}>Device: {claim.model} ({claim.imei})</Text>
                <Text style={{ color: C.textSecondary, fontSize: 12, marginBottom: 2 }}>Description: {claim.description || '—'}</Text>
                {claim.technicianName && <Text style={{ color: C.textSecondary, fontSize: 12, marginBottom: 2 }}>Technician: {claim.technicianName}</Text>}
                <Text style={{ color: C.textSecondary, fontSize: 11, marginBottom: 8 }}>{new Date(claim.createdAt).toLocaleString('en-IN')}</Text>

                {/* Damage image section */}
                <View style={{ paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border }}>
                  <Text style={{ color: C.text, fontFamily: 'Inter_600SemiBold', fontSize: 12, marginBottom: 8 }}>Damage Image:</Text>
                  {claim.damageImage ? (
                    <Image source={{ uri: claim.damageImage }} style={{ width: '100%', height: 120, borderRadius: 8, backgroundColor: '#F0F0F0' }} resizeMode="cover" />
                  ) : (
                    <View style={{ width: '100%', height: 120, backgroundColor: C.surfaceElevated, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: C.textSecondary, fontSize: 12 }}>📸 No damage image uploaded</Text>
                    </View>
                  )}
                </View>

                {/* Actions */}
                {claim.status === 'claim_pending' && (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <TouchableOpacity 
                      style={{ flex: 1, padding: 10, borderRadius: 8, backgroundColor: '#EBF4FF', alignItems: 'center', justifyContent: 'center', minHeight: 40 }}
                      onPress={() => {
                        console.log('[Admin] Under Review button pressed for claim:', claim.id);
                        handleProtectionClaimAction(claim.id, 'under_review');
                      }}
                      activeOpacity={0.7}>
                      <Text style={{ color: '#4A90D9', fontFamily: 'Inter_700Bold', fontSize: 12 }}>Under Review</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={{ flex: 1, padding: 10, borderRadius: 8, backgroundColor: '#FFEEEE', alignItems: 'center', justifyContent: 'center', minHeight: 40 }}
                      onPress={() => {
                        console.log('[Admin] Reject button pressed for claim:', claim.id);
                        handleProtectionClaimAction(claim.id, 'reject', { rejectionReason: 'Claim not eligible' });
                      }}
                      activeOpacity={0.7}>
                      <Text style={{ color: '#E53E3E', fontFamily: 'Inter_700Bold', fontSize: 12 }}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {claim.status === 'under_review' && (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <TouchableOpacity 
                      style={{ flex: 1, padding: 10, borderRadius: 8, backgroundColor: '#E8F5ED', alignItems: 'center', justifyContent: 'center', minHeight: 40 }}
                      onPress={() => {
                        console.log('[Admin] Approve claim button pressed:', claim.id);
                        handleProtectionClaimAction(claim.id, 'approve');
                      }}
                      activeOpacity={0.7}>
                      <Text style={{ color: '#27AE60', fontFamily: 'Inter_700Bold', fontSize: 12 }}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={{ flex: 1, padding: 10, borderRadius: 8, backgroundColor: '#FFEEEE', alignItems: 'center', justifyContent: 'center', minHeight: 40 }}
                      onPress={() => {
                        console.log('[Admin] Reject claim button pressed:', claim.id);
                        handleProtectionClaimAction(claim.id, 'reject', { rejectionReason: 'Claim rejected after review' });
                      }}
                      activeOpacity={0.7}>
                      <Text style={{ color: '#E53E3E', fontFamily: 'Inter_700Bold', fontSize: 12 }}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {claim.status === 'approved' && (
                  <TouchableOpacity 
                    style={{ marginTop: 10, padding: 12, borderRadius: 8, backgroundColor: '#FFF3ED', alignItems: 'center', justifyContent: 'center', minHeight: 44 }}
                    onPress={() => {
                      const isWeb = typeof window !== 'undefined';
                      if (isWeb) {
                        const name = window.prompt('Enter technician name:', 'Technician Name');
                        if (name) {
                          console.log('[Admin] Assign technician button pressed for claim:', claim.id);
                          handleProtectionClaimAction(claim.id, 'assign', { technicianName: name });
                        }
                      } else {
                        Alert.prompt('Assign Technician', 'Enter technician name:', [(name) => {
                          if (name) {
                            console.log('[Admin] Assign technician button pressed for claim:', claim.id);
                            handleProtectionClaimAction(claim.id, 'assign', { technicianName: name });
                          }
                        }]);
                      }
                    }}
                    activeOpacity={0.7}>
                    <Text style={{ color: PRIMARY, fontFamily: 'Inter_700Bold', fontSize: 13 }}>Assign Technician</Text>
                  </TouchableOpacity>
                )}
                {claim.status === 'assigned' && (
                  <TouchableOpacity 
                    style={{ marginTop: 10, padding: 12, borderRadius: 8, backgroundColor: '#E8F5ED', alignItems: 'center', justifyContent: 'center', minHeight: 44 }}
                    onPress={() => {
                      console.log('[Admin] Mark Completed button pressed for claim:', claim.id);
                      handleProtectionClaimAction(claim.id, 'complete');
                    }}
                    activeOpacity={0.7}>
                    <Text style={{ color: '#27AE60', fontFamily: 'Inter_700Bold', fontSize: 13 }}>Mark Completed</Text>
                  </TouchableOpacity>
                )}
              </SectionCard>
            ))
          )
        }
      </ScrollView>
    );
  };

  const renderPayouts = () => {
    const pending = payoutsData.filter(p => p.status === 'pending');
    const completed = payoutsData.filter(p => p.status !== 'pending');
    const formatINR = (v: number) => `₹${Math.round((v || 0) / 100).toLocaleString('en-IN')}`;

    const renderCard = (p: any) => (
      <SectionCard key={p.id} style={{ marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ color: C.text, fontFamily: 'Inter_700Bold', fontSize: 15 }}>{p.teacherName || 'Unknown Teacher'}</Text>
          <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: p.status === 'paid' ? '#34C75920' : p.status === 'rejected' ? '#FF3B3020' : '#FFD60A20' }}>
            <Text style={{ color: p.status === 'paid' ? '#34C759' : p.status === 'rejected' ? '#FF3B30' : '#FFD60A', fontSize: 11, fontFamily: 'Inter_600SemiBold', textTransform: 'capitalize' }}>{p.status}</Text>
          </View>
        </View>
        <Text style={{ color: C.textSecondary, fontSize: 14, marginBottom: 4 }}>Amount: <Text style={{ color: C.text, fontFamily: 'Inter_600SemiBold' }}>{formatINR(Math.round((p.amount || 0) / 100))}</Text></Text>
        {p.upiId ? <Text style={{ color: C.textSecondary, fontSize: 12, marginBottom: 2 }}>UPI: {p.upiId}</Text> : null}
        {p.bankDetails ? <Text style={{ color: C.textSecondary, fontSize: 12, marginBottom: 2 }}>Bank: {p.bankDetails}</Text> : null}
        <Text style={{ color: C.textTertiary, fontSize: 11, marginBottom: p.status === 'pending' ? 10 : 0 }}>
          Requested: {new Date(p.requestedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </Text>
        {p.status === 'pending' && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              style={{ flex: 1, backgroundColor: '#34C759', borderRadius: 10, paddingVertical: 9, alignItems: 'center' }}
              disabled={payoutsUpdating === p.id}
              onPress={() => Alert.alert('Mark Paid', `Mark ${formatINR(Math.round((p.amount || 0) / 100))} as paid to ${p.teacherName}?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Mark Paid', onPress: () => updatePayout(p.id, 'paid', p.adminNotes || '') },
              ])}>
              {payoutsUpdating === p.id ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 13 }}>Mark Paid</Text>}
            </Pressable>
            <Pressable
              style={{ flex: 1, backgroundColor: '#FF3B3015', borderRadius: 10, paddingVertical: 9, alignItems: 'center', borderWidth: 1, borderColor: '#FF3B3040' }}
              disabled={payoutsUpdating === p.id}
              onPress={() => updatePayout(p.id, 'rejected', '')}>
              <Text style={{ color: '#FF3B30', fontFamily: 'Inter_700Bold', fontSize: 13 }}>Reject</Text>
            </Pressable>
          </View>
        )}
      </SectionCard>
    );

    return (
      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={payoutsLoading} onRefresh={fetchPayouts} tintColor={PRIMARY} />}>
        {payoutsLoading ? (
          <View style={{ alignItems: 'center', paddingTop: 40 }}><ActivityIndicator size="large" color={PRIMARY} /></View>
        ) : payoutsData.length === 0 ? (
          <View style={{ alignItems: 'center', padding: 40 }}>
            <Ionicons name="cash-outline" size={40} color={C.textTertiary} />
            <Text style={{ color: C.textTertiary, fontSize: 14, marginTop: 8 }}>No payout requests</Text>
          </View>
        ) : (
          <>
            {pending.length > 0 && (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Text style={ss.sectionTitle}>Pending ({pending.length})</Text>
                  <View style={{ backgroundColor: '#FFD60A20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 }}>
                    <Text style={{ fontSize: 11, color: '#FFD60A', fontFamily: 'Inter_600SemiBold' }}>Action required</Text>
                  </View>
                </View>
                {pending.map(renderCard)}
              </>
            )}
            {completed.length > 0 && (
              <>
                <Text style={[ss.sectionTitle, { marginTop: 16, marginBottom: 12 }]}>Completed ({completed.length})</Text>
                {completed.map(renderCard)}
              </>
            )}
          </>
        )}
      </ScrollView>
    );
  };

  // ── MAIN RENDER ──
  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      {/* Header */}
      <View style={{ paddingTop: webTopInset, backgroundColor: PRIMARY }}>
        <View style={{ paddingHorizontal: isMobile ? 12 : 16, paddingVertical: isMobile ? 10 : 14, flexDirection: 'row', alignItems: 'center', gap: isMobile ? 8 : 12 }}>
          <Pressable onPress={handleGoBack}
            style={{ width: isMobile ? 34 : 38, height: isMobile ? 34 : 38, borderRadius: isMobile ? 17 : 19, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="arrow-back" size={isMobile ? 18 : 20} color="#FFF" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: isMobile ? 18 : 22, fontFamily: 'Inter_700Bold', color: '#FFF' }}>Admin</Text>
            <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', fontFamily: 'Inter_400Regular' }}>
              {stats.totalUsers} users · {stats.totalPosts} posts
            </Text>
          </View>
          <Pressable onPress={handleRefresh} disabled={refreshing}
            style={{ width: isMobile ? 34 : 38, height: isMobile ? 34 : 38, borderRadius: isMobile ? 17 : 19, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', opacity: refreshing ? 0.6 : 1 }}>
            {refreshing ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="refresh-outline" size={isMobile ? 16 : 18} color="#FFF" />
            )}
          </Pressable>
        </View>

        {/* Tab bar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: isMobile ? 4 : 6, paddingHorizontal: isMobile ? 12 : 16, paddingBottom: isMobile ? 10 : 12 }}>
          {tabs.map(tab => {
            const active = activeTab === tab.key;
            return (
              <Pressable key={tab.key} onPress={() => setActiveTab(tab.key)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: isMobile ? 3 : 5,
                  paddingHorizontal: isMobile ? 8 : 12, paddingVertical: isMobile ? 6 : 8, borderRadius: 20,
                  backgroundColor: active ? '#FFF' : 'rgba(255,255,255,0.15)',
                  borderWidth: active ? 0 : 1, borderColor: 'rgba(255,255,255,0.25)' }}>
                <Ionicons name={tab.icon} size={isMobile ? 11 : 13} color={active ? PRIMARY : '#FFF'} />
                <Text style={{ fontSize: isMobile ? 10 : 12, fontFamily: 'Inter_600SemiBold', color: active ? PRIMARY : '#FFF' }}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'users' && renderUsers()}
        {activeTab === 'customers' && renderRoleUsers('customer', 'Customer', 'person-outline', '#FF2D55')}
        {activeTab === 'technicians' && renderRoleUsers('technician', 'Technician', 'construct-outline', '#34C759')}
        {activeTab === 'teachers' && renderRoleUsers('teacher', 'Teacher', 'school-outline', '#FFD60A')}
        {activeTab === 'suppliers' && renderRoleUsers('supplier', 'Supplier', 'cube-outline', '#FF6B2C')}
        {activeTab === 'shopkeepers' && renderRoleUsers('shopkeeper', 'Shopkeeper', 'storefront-outline', '#8B5CF6')}
        {activeTab === 'blocked-users' && renderBlockedUsers()}
        {activeTab === 'deleted-users' && renderDeletedUsers()}
        {activeTab === 'products' && renderListings()}
        {activeTab === 'orders' && renderBookings()}
        {activeTab === 'reports' && renderReports()}
        {activeTab === 'settings' && renderSettings()}
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
        {activeTab === 'payouts' && renderPayouts()}
        {activeTab === 'protection-plans' && renderProtectionPlans()}
        {activeTab === 'protection-claims' && renderProtectionClaims()}
      </View>
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const isMobileSS = Platform.OS !== 'web' || (typeof window !== 'undefined' && window.innerWidth < 768);

const ss = StyleSheet.create({
  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: isMobileSS ? 8 : 10 },
  statCard: {
    flex: 1, minWidth: '45%', backgroundColor: C.surface, borderRadius: 12,
    padding: isMobileSS ? 10 : 14, borderWidth: 1, borderColor: C.border,
    alignItems: 'flex-start', gap: 5,
  },
  statIconBox: { width: isMobileSS ? 36 : 44, height: isMobileSS ? 36 : 44, borderRadius: isMobileSS ? 18 : 22, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: isMobileSS ? 18 : 24, fontFamily: 'Inter_700Bold', color: C.text },
  statLabel: { fontSize: 10, fontFamily: 'Inter_500Medium', color: C.textSecondary },

  // Sections
  sectionCard: {
    backgroundColor: C.surface, borderRadius: 12, padding: isMobileSS ? 11 : 14,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  sectionTitle: { fontSize: isMobileSS ? 13 : 15, fontFamily: 'Inter_700Bold', color: C.text },
  sectionSubtitle: { fontSize: isMobileSS ? 11 : 13, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginBottom: 16, lineHeight: 18 },
  cardTitle: { fontSize: isMobileSS ? 13 : 15, fontFamily: 'Inter_700Bold', color: C.text },

  // Input
  inputLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: C.textSecondary, marginBottom: 5 },
  input: {
    backgroundColor: C.surfaceElevated, color: C.text, borderRadius: 10,
    paddingHorizontal: isMobileSS ? 12 : 14, paddingVertical: isMobileSS ? 9 : 11, fontSize: isMobileSS ? 13 : 14,
    fontFamily: 'Inter_400Regular', borderWidth: 1, borderColor: C.border,
  },

  // Action button
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 12, paddingVertical: isMobileSS ? 11 : 13, paddingHorizontal: isMobileSS ? 14 : 16,
  },
  actionBtnText: { fontSize: isMobileSS ? 13 : 15, fontFamily: 'Inter_700Bold', color: '#FFF' },

  // User card
  userCard: {
    backgroundColor: C.surface, borderRadius: 12, marginBottom: 8,
    borderWidth: 1, borderColor: C.border, overflow: 'hidden',
  },
  userCardTop: { flexDirection: 'row', alignItems: 'center', padding: isMobileSS ? 10 : 12, gap: 8 },
  userAvatar: { width: isMobileSS ? 36 : 40, height: isMobileSS ? 36 : 40, borderRadius: isMobileSS ? 18 : 20, alignItems: 'center', justifyContent: 'center' },
  userAvatarImg: { width: isMobileSS ? 36 : 40, height: isMobileSS ? 36 : 40, borderRadius: isMobileSS ? 18 : 20 },
  userAvatarText: { fontSize: isMobileSS ? 12 : 14, fontFamily: 'Inter_700Bold' },
  userCardInfo: { flex: 1, minWidth: 0 },
  userName: { fontSize: isMobileSS ? 12 : 14, fontFamily: 'Inter_600SemiBold', color: C.text },
  userCity: { fontSize: 10, color: C.textTertiary, fontFamily: 'Inter_400Regular' },
  roleBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  roleBadgeText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  userCardExpanded: { paddingHorizontal: isMobileSS ? 10 : 12, paddingBottom: isMobileSS ? 10 : 12, borderTopWidth: 1, borderTopColor: C.border },
  userInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  userInfoText: { fontSize: isMobileSS ? 12 : 13, color: C.textSecondary, fontFamily: 'Inter_400Regular' },
});
