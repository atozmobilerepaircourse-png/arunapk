import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, Platform, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/lib/context';
import { Alert } from 'react-native';

const PRIMARY = '#0084FF';
const C = {
  bg: '#FFFFFF',
  surface: '#F9FAFB',
  text: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  border: '#E5E7EB',
};

// ─── Pure component - NO hooks, just render wrapper ───
function UnauthorizedView() {
  const handleGoBack = () => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.history.back();
      }
    } else {
      // On mobile, we can't do anything without router hook
      // Will be handled by Alert in main component instead
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg }}>
      <Ionicons name="lock-closed" size={48} color={C.textSecondary} />
      <Text style={{ fontSize: 18, fontFamily: 'Inter_600SemiBold', color: C.text, marginTop: 16 }}>
        Admin Access Required
      </Text>
      <Pressable 
        onPress={handleGoBack}
        style={{ marginTop: 20, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: PRIMARY, borderRadius: 8 }}
      >
        <Text style={{ color: '#fff', fontFamily: 'Inter_600SemiBold' }}>Go Back</Text>
      </Pressable>
    </View>
  );
}

// ─── Main AdminScreen component - ALL hooks here, NO conditionals ───
export default function AdminScreen() {
  // ─── HOOKS: Declare ALL hooks FIRST, in exact same order every render ───
  const { profile, posts, allProfiles, refreshData } = useApp();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const isAdmin = useMemo(() => {
    if (!profile) return false;
    const cleanPhone = (profile.phone || '').replace(/\D/g, '');
    return (
      profile.role === 'admin' || 
      cleanPhone === '8179142535' || 
      cleanPhone === '9876543210' || 
      profile.email === 'atozmobilerepaircourse@gmail.com'
    );
  }, [profile]);

  // Only mark profile as loaded once (don't redirect on subsequent renders)
  useEffect(() => {
    if (profile && !profileLoaded) {
      setProfileLoaded(true);
      if (!isAdmin) {
        Alert.alert('Access Denied', 'Admin access required', [
          { text: 'Go Back', onPress: () => router.back() }
        ]);
      }
    }
  }, [isAdmin, profile, profileLoaded, router]);

  useEffect(() => {
    setTimeout(() => setLoading(false), 500);
  }, []);

  // ─── DATA: Derive data from hook results (NOT more hooks) ───
  const totalUsers = allProfiles?.length || 0;
  const totalPosts = posts?.length || 0;

  // ─── Conditional rendering AFTER all hooks ───
  if (!isAdmin) return <UnauthorizedView />;
  if (loading) return <LoadingView />;
  
  const handleBack = () => {
    if (Platform.OS === 'web') {
      window.history.back();
    } else {
      router.back();
    }
  };
  
  return (
    <AdminDashboardContent 
      totalUsers={totalUsers}
      totalPosts={totalPosts}
      onRefresh={refreshData}
      onBack={handleBack}
    />
  );
}

// ─── Pure loading view - NO hooks ───
function LoadingView() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg }}>
      <ActivityIndicator size="large" color={PRIMARY} />
    </View>
  );
}

// ─── Dashboard content - PURE component, NO hooks at all ───
function AdminDashboardContent(props: { 
  totalUsers: number; 
  totalPosts: number; 
  onRefresh: () => Promise<void>;
  onBack: () => void;
}) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ paddingHorizontal: 16, paddingVertical: 20 }}>
        <Text style={{ fontSize: 28, fontFamily: 'Inter_700Bold', color: C.text, marginBottom: 20 }}>
          Admin Dashboard
        </Text>

        {/* Stats */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
          <View style={{ flex: 1, backgroundColor: C.surface, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: C.border }}>
            <Text style={{ fontSize: 12, color: C.textSecondary, fontFamily: 'Inter_400Regular' }}>Total Users</Text>
            <Text style={{ fontSize: 28, fontFamily: 'Inter_700Bold', color: PRIMARY, marginTop: 8 }}>{props.totalUsers}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: C.surface, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: C.border }}>
            <Text style={{ fontSize: 12, color: C.textSecondary, fontFamily: 'Inter_400Regular' }}>Total Posts</Text>
            <Text style={{ fontSize: 28, fontFamily: 'Inter_700Bold', color: '#34C759', marginTop: 8 }}>{props.totalPosts}</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={{ gap: 10 }}>
          <Pressable
            onPress={async () => {
              try {
                await props.onRefresh();
                alert('Data refreshed');
              } catch (e) {
                alert('Refresh failed');
              }
            }}
            style={{ backgroundColor: PRIMARY, paddingVertical: 12, borderRadius: 8, alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontFamily: 'Inter_600SemiBold' }}>Refresh Data</Text>
          </Pressable>

          <Pressable
            onPress={props.onBack}
            style={{ backgroundColor: C.surface, paddingVertical: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: C.border }}
          >
            <Text style={{ color: C.text, fontFamily: 'Inter_600SemiBold' }}>Go Back</Text>
          </Pressable>
        </View>

        <Text style={{ fontSize: 12, color: C.textTertiary, fontFamily: 'Inter_400Regular', marginTop: 20, textAlign: 'center' }}>
          Admin Panel v1.0 - Core Features Only
        </Text>
      </View>
    </ScrollView>
  );
}
