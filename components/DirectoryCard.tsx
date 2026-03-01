import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { ROLE_LABELS, UserRole } from '@/lib/types';

const C = Colors.dark;

const ROLE_ICONS: Record<UserRole, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  technician: { name: 'construct', color: '#34C759' },
  teacher: { name: 'school', color: '#FFD60A' },
  supplier: { name: 'cube', color: '#FF6B2C' },
  job_provider: { name: 'briefcase', color: '#5E8BFF' },
  customer: { name: 'person', color: '#FF2D55' },
};

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

interface DirectoryCardProps {
  name: string;
  role: UserRole;
  city: string;
  skills: string[];
  experience?: string;
  avatar?: string;
  isOnline?: boolean;
  onPress?: () => void;
  onMessage?: () => void;
}

export default function DirectoryCard({ name, role, city, skills, experience, avatar, isOnline, onPress, onMessage }: DirectoryCardProps) {
  const icon = ROLE_ICONS[role];
  const cardScale = useSharedValue(1);
  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));

  return (
    <Animated.View style={[cardAnimStyle]}>
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
      onPress={onPress}
      onPressIn={() => { cardScale.value = withSpring(0.97); }}
      onPressOut={() => { cardScale.value = withSpring(1); }}
    >
      <View style={styles.avatarWrap}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatarImg} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, { backgroundColor: icon.color + '20' }]}>
            <Text style={[styles.avatarText, { color: icon.color }]}>{getInitials(name)}</Text>
          </View>
        )}
        {isOnline !== undefined && (
          <View style={[styles.onlineDot, { backgroundColor: isOnline ? '#34C759' : '#FF3B30' }]} />
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        <View style={styles.metaRow}>
          <Ionicons name={icon.name} size={13} color={icon.color} />
          <Text style={[styles.role, { color: icon.color }]}>{ROLE_LABELS[role]}</Text>
          {city.length > 0 && (
            <>
              <View style={styles.dot} />
              <Ionicons name="location-outline" size={12} color={C.textTertiary} />
              <Text style={styles.city}>{city}</Text>
            </>
          )}
        </View>
        {skills.length > 0 && (
          <View style={styles.skillsRow}>
            {skills.slice(0, 3).map((s, i) => (
              <View key={i} style={styles.skillTag}>
                <Text style={styles.skillText}>{s}</Text>
              </View>
            ))}
            {skills.length > 3 && (
              <Text style={styles.moreSkills}>+{skills.length - 3}</Text>
            )}
          </View>
        )}
      </View>
      {onMessage && (
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onMessage();
          }}
          hitSlop={8}
          style={[styles.msgBtn, { backgroundColor: icon.color + '15' }]}
        >
          <Ionicons name="chatbubble-outline" size={18} color={icon.color} />
        </Pressable>
      )}
    </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: C.surface,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    color: C.text,
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  role: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: C.textTertiary,
    marginHorizontal: 4,
  },
  city: {
    color: C.textTertiary,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    gap: 4,
  },
  skillTag: {
    backgroundColor: C.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  skillText: {
    color: C.textSecondary,
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  moreSkills: {
    color: C.textTertiary,
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    alignSelf: 'center',
  },
  msgBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});
