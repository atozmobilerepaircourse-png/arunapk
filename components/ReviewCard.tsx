import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';

const C = Colors.light;

interface ReviewCardProps {
  reviewerName: string;
  reviewerAvatar?: string;
  rating: number;
  comment?: string;
  createdAt?: number;
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function ReviewCard({ reviewerName, reviewerAvatar, rating, comment, createdAt }: ReviewCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.reviewer}>
          {reviewerAvatar ? (
            <Image source={{ uri: reviewerAvatar }} style={styles.avatar} contentFit="cover" cachePolicy="memory-disk" />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{getInitials(reviewerName || 'A')}</Text>
            </View>
          )}
          <View style={styles.nameCol}>
            <Text style={styles.name} numberOfLines={1}>{reviewerName || 'Anonymous'}</Text>
            {createdAt ? (
              <Text style={styles.date}>
                {new Date(createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map(s => (
            <Ionicons
              key={s}
              name={s <= rating ? 'star' : 'star-outline'}
              size={14}
              color="#FFD60A"
            />
          ))}
        </View>
      </View>
      {comment ? (
        <Text style={styles.comment} numberOfLines={3}>{comment}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderTopWidth: 1,
    borderTopColor: C.borderLight,
    paddingTop: 12,
    paddingBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  reviewer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF6B2C18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: '#FF6B2C',
  },
  nameCol: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: C.text,
  },
  date: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: C.textTertiary,
    marginTop: 1,
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
  },
  comment: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: C.textSecondary,
    lineHeight: 18,
    marginLeft: 42,
  },
});
