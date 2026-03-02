import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, Platform, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Colors from '@/constants/colors';
import { apiRequest } from '@/lib/query-client';
import { useApp } from '@/lib/context';

const C = Colors.dark;

export default function NotificationPreferencesScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const [prefs, setPrefs] = useState({
    orders: true,
    messages: true,
    marketing: true,
    system: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.notificationPrefs) {
      try {
        setPrefs(JSON.parse(user.notificationPrefs));
      } catch (e) {
        console.error('Failed to parse prefs', e);
      }
    }
  }, [user]);

  const toggleSwitch = async (key: keyof typeof prefs) => {
    const newPrefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(newPrefs);
    
    try {
      setSaving(true);
      await apiRequest('PATCH', '/api/profile', {
        notificationPrefs: JSON.stringify(newPrefs)
      });
    } catch (error) {
      console.error('Failed to update prefs', error);
      // Revert on error
      setPrefs(prefs);
    } finally {
      setSaving(false);
    }
  };

  const renderItem = (key: keyof typeof prefs, title: string, description: string, icon: keyof typeof Ionicons.glyphMap) => (
    <View style={styles.item}>
      <View style={styles.itemIcon}>
        <Ionicons name={icon} size={22} color={C.primary} />
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle}>{title}</Text>
        <Text style={styles.itemDescription}>{description}</Text>
      </View>
      <Switch
        value={prefs[key]}
        onValueChange={() => toggleSwitch(key)}
        trackColor={{ false: '#3A3A3C', true: C.primary }}
        thumbColor={Platform.OS === 'ios' ? '#FFFFFF' : prefs[key] ? '#FFFFFF' : '#AEAEB2'}
      />
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={C.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transactional</Text>
          {renderItem('orders', 'Order Updates', 'Receive alerts about your purchases and sales', 'cart-outline')}
          {renderItem('messages', 'Messages', 'Get notified when you receive a new message', 'chatbubble-outline')}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Updates</Text>
          {renderItem('marketing', 'Promotions', 'Special offers, discounts and news', 'megaphone-outline')}
          {renderItem('system', 'System Alerts', 'Security alerts and app updates', 'shield-checkmark-outline')}
        </View>
        
        {saving && (
          <Text style={styles.savingText}>Saving changes...</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: C.text,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 13,
    color: C.textTertiary,
    textTransform: 'uppercase',
    marginBottom: 12,
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemContent: {
    flex: 1,
    marginRight: 12,
  },
  itemTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: C.text,
    marginBottom: 2,
  },
  itemDescription: {
    fontSize: 13,
    color: C.textSecondary,
  },
  savingText: {
    textAlign: 'center',
    color: C.primary,
    fontSize: 12,
    marginTop: -16,
    marginBottom: 32,
  }
});
