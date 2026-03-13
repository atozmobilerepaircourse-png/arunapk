import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getApiUrl } from './query-client';
import { getDeviceId } from './device-fingerprint';

interface SecurityStatus {
  status: 'ok' | 'locked' | 'subscription_expired' | 'checking';
  supportNumber: string;
  whatsappLink: string;
  reason?: string;
}

interface SecurityContextValue {
  securityStatus: SecurityStatus;
  recheckSecurity: () => Promise<void>;
}

const SecurityContext = createContext<SecurityContextValue | null>(null);

export function useSecurityContext() {
  const ctx = useContext(SecurityContext);
  if (!ctx) throw new Error('useSecurityContext must be used inside SecurityProvider');
  return ctx;
}

async function fetchSecurityStatus(userId: string): Promise<SecurityStatus> {
  try {
    const baseUrl = getApiUrl();
    const url = new URL('/api/security/check', baseUrl);
    const deviceId = await getDeviceId();
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, deviceId }),
    });
    if (!res.ok) return { status: 'ok', supportNumber: '+918179142535', whatsappLink: 'https://wa.me/918179142535' };
    const data = await res.json();
    return {
      status: data.status || 'ok',
      supportNumber: data.supportNumber || '+918179142535',
      whatsappLink: data.whatsappLink || 'https://wa.me/918179142535',
      reason: data.reason,
    };
  } catch (e) {
    return { status: 'ok', supportNumber: '+918179142535', whatsappLink: 'https://wa.me/918179142535' };
  }
}

function LockedOverlay({ supportNumber, whatsappLink, reason, recheckSecurity }: { supportNumber: string; whatsappLink: string; reason?: string; recheckSecurity?: () => void }) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const openWhatsApp = () => {
    const msg = encodeURIComponent('Hello, my Mobi account has been locked. Please help me unlock it.');
    const link = `${whatsappLink}?text=${msg}`;
    Linking.openURL(link).catch(() => Linking.openURL(`https://wa.me/${supportNumber.replace(/\D/g, '')}?text=${msg}`));
  };

  const callSupport = () => {
    Linking.openURL(`tel:${supportNumber}`);
  };

  const handleRefresh = async () => {
    if (!recheckSecurity) return;
    setIsRefreshing(true);
    await recheckSecurity();
    setIsRefreshing(false);
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.lockCard}>
        <View style={styles.lockIconWrap}>
          <Ionicons name="lock-closed" size={48} color="#FF3B30" />
        </View>
        <Text style={styles.lockTitle}>Account Locked</Text>
        <Text style={styles.lockSubtitle}>
          {reason || 'Your account has been locked by the admin.'}
        </Text>
        <Text style={styles.lockHint}>
          Please contact support to unlock your account.
        </Text>
        <TouchableOpacity style={styles.whatsappBtn} onPress={openWhatsApp}>
          <Ionicons name="logo-whatsapp" size={22} color="#fff" />
          <Text style={styles.whatsappBtnText}>Contact on WhatsApp</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.callBtn} onPress={callSupport}>
          <Ionicons name="call" size={20} color="#007AFF" />
          <Text style={styles.callBtnText}>Call Support</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.callBtn, { backgroundColor: '#F2F2F7', marginTop: 8, borderColor: '#007AFF' }]} 
          onPress={handleRefresh}
          disabled={isRefreshing}
        >
          <Ionicons name="refresh" size={20} color={isRefreshing ? '#ccc' : '#007AFF'} />
          <Text style={[styles.callBtnText, { color: isRefreshing ? '#ccc' : '#007AFF' }]}>
            {isRefreshing ? 'Checking...' : 'Refresh Status'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.phoneText}>{supportNumber}</Text>
      </View>
    </View>
  );
}

function SubscriptionExpiredOverlay({ supportNumber, whatsappLink }: { supportNumber: string; whatsappLink: string }) {
  const openWhatsApp = () => {
    const msg = encodeURIComponent('Hello, I want to renew my Mobi subscription. Please help me.');
    const link = `${whatsappLink}?text=${msg}`;
    Linking.openURL(link).catch(() => Linking.openURL(`https://wa.me/${supportNumber.replace(/\D/g, '')}?text=${msg}`));
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.lockCard}>
        <View style={[styles.lockIconWrap, { backgroundColor: '#FF9F0A20' }]}>
          <Ionicons name="time" size={48} color="#FF9F0A" />
        </View>
        <Text style={styles.lockTitle}>Subscription Expired</Text>
        <Text style={styles.lockSubtitle}>
          Your Mobi subscription has expired.{'\n'}Renew to continue using the app.
        </Text>
        <Text style={styles.lockHint}>
          Contact our team to renew your plan.
        </Text>
        <TouchableOpacity style={styles.whatsappBtn} onPress={openWhatsApp}>
          <Ionicons name="logo-whatsapp" size={22} color="#fff" />
          <Text style={styles.whatsappBtnText}>Renew via WhatsApp</Text>
        </TouchableOpacity>
        <Text style={styles.phoneText}>{supportNumber}</Text>
      </View>
    </View>
  );
}

export function SecurityProvider({ children, userId }: { children: ReactNode; userId: string | null }) {
  const [securityStatus, setSecurityStatus] = useState<SecurityStatus>({
    status: 'checking',
    supportNumber: '+918179142535',
    whatsappLink: 'https://wa.me/918179142535',
  });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const recheckSecurity = useCallback(async () => {
    if (!userId) {
      setSecurityStatus({ status: 'ok', supportNumber: '+918179142535', whatsappLink: 'https://wa.me/918179142535' });
      return;
    }
    const result = await fetchSecurityStatus(userId);
    setSecurityStatus(result);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setSecurityStatus({ status: 'ok', supportNumber: '+918179142535', whatsappLink: 'https://wa.me/918179142535' });
      return;
    }

    recheckSecurity();

    pollRef.current = setInterval(recheckSecurity, 30000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [userId, recheckSecurity]);

  const showLocked = securityStatus.status === 'locked';
  const showExpired = securityStatus.status === 'subscription_expired';

  return (
    <SecurityContext.Provider value={{ securityStatus, recheckSecurity }}>
      {children}
      {showLocked && (
        <LockedOverlay
          supportNumber={securityStatus.supportNumber}
          whatsappLink={securityStatus.whatsappLink}
          reason={securityStatus.reason}
          recheckSecurity={recheckSecurity}
        />
      )}
      {showExpired && (
        <SubscriptionExpiredOverlay
          supportNumber={securityStatus.supportNumber}
          whatsappLink={securityStatus.whatsappLink}
        />
      )}
    </SecurityContext.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000CC',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 9999,
  },
  lockCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  lockIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FF3B3020',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  lockTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 10,
    textAlign: 'center',
  },
  lockSubtitle: {
    fontSize: 15,
    color: '#3A3A3C',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  lockHint: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 28,
  },
  whatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25D366',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 12,
  },
  whatsappBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#007AFF',
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 24,
    width: '100%',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  callBtnText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  phoneText: {
    fontSize: 13,
    color: '#8E8E93',
  },
});
