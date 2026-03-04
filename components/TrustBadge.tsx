import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type TrustLevel = 'New' | 'Trusted' | 'Pro' | 'Expert';

const BADGE_CONFIG: Record<TrustLevel, { color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  New: { color: '#999', icon: 'person-outline' },
  Trusted: { color: '#007AFF', icon: 'shield-checkmark' },
  Pro: { color: '#FF9500', icon: 'shield-checkmark' },
  Expert: { color: '#34C759', icon: 'shield-checkmark' },
};

export function getTrustLevel(score: number): TrustLevel {
  if (score >= 85) return 'Expert';
  if (score >= 60) return 'Pro';
  if (score >= 30) return 'Trusted';
  return 'New';
}

export function getTrustColor(level: TrustLevel): string {
  return BADGE_CONFIG[level].color;
}

interface TrustBadgeProps {
  score: number;
  size?: 'small' | 'medium' | 'large';
  showScore?: boolean;
}

export function calculateTrustScore(profile: any, averageRating: number = 0, totalReviews: number = 0): number {
  let score = 0;

  // Profile completion (40 points max)
  if (profile.avatar) score += 10;
  if (profile.bio && profile.bio.length > 20) score += 10;
  if (profile.skills && JSON.parse(profile.skills || '[]').length > 0) score += 10;
  if (profile.city && profile.state) score += 10;

  // Verification & Activity (30 points max)
  // Phone is always verified via OTP
  score += 10;
  if (profile.subscriptionActive) score += 20;

  // Ratings (30 points max)
  if (totalReviews > 0) {
    score += (averageRating / 5) * 30;
  }

  return Math.min(Math.round(score), 100);
}

export default function TrustBadge({ score, size = 'small', showScore = false }: TrustBadgeProps) {
  const level = getTrustLevel(score);
  const config = BADGE_CONFIG[level];

  if (size === 'small') {
    return (
      <View style={[styles.smallBadge, { backgroundColor: config.color + '20', borderColor: config.color }]}>
        <Ionicons name={config.icon} size={9} color={config.color} />
        <Text style={[styles.smallText, { color: config.color }]}>{level}</Text>
      </View>
    );
  }

  if (size === 'large') {
    return (
      <View style={styles.largeContainer}>
        <View style={[styles.largeBadge, { backgroundColor: config.color + '18' }]}>
          <Ionicons name={config.icon} size={16} color={config.color} />
          <Text style={[styles.largeText, { color: config.color }]}>{level}</Text>
        </View>
        {showScore && (
          <Text style={styles.scoreText}>{score}/100</Text>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.mediumBadge, { backgroundColor: config.color + '18' }]}>
      <Ionicons name={config.icon} size={13} color={config.color} />
      <Text style={[styles.mediumText, { color: config.color }]}>{level}</Text>
      {showScore && (
        <Text style={[styles.mediumScore, { color: config.color }]}>{score}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  smallBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    gap: 3,
  },
  smallText: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
  },
  mediumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  mediumText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  mediumScore: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    opacity: 0.7,
  },
  largeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  largeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  largeText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  scoreText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: '#8E8E93',
  },
});
