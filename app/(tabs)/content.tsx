import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, Pressable, Platform, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useApp } from '@/lib/context';
import { T } from '@/constants/techTheme';
import Colors from '@/constants/colors';

const C = Colors.light;
const webTopInset = Platform.OS === 'web' ? 67 : 0;

export default function ContentScreen() {
  const insets = useSafeAreaInsets();
  const { profile, posts, refreshData } = useApp();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

  const teacherPosts = posts.filter(p => p.userId === profile?.id && p.category === 'training');

  return (
    <View style={[styles.container, { backgroundColor: T.bg }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 16 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Training Content</Text>
          <Pressable onPress={() => router.push('/create' as any)}>
            <Ionicons name="add-circle" size={28} color={T.accent} />
          </Pressable>
        </View>

        {teacherPosts.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="book-outline" size={64} color={T.muted} />
            <Text style={styles.emptyText}>No training content yet</Text>
            <Text style={styles.emptySubtext}>Create courses and training videos to share with students</Text>
            <Pressable onPress={() => router.push('/create' as any)} style={styles.createBtn}>
              <Text style={styles.createBtnText}>Create Content</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            scrollEnabled={false}
            data={teacherPosts}
            keyExtractor={p => p.id}
            renderItem={({ item }) => (
              <Pressable onPress={() => router.push(`/posts/${item.id}` as any)} style={styles.postCard}>
                <Text style={styles.postTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.postCategory}>{item.category}</Text>
              </Pressable>
            )}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 120 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '700', color: T.text },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 18, fontWeight: '600', color: T.text, marginTop: 16 },
  emptySubtext: { fontSize: 14, color: T.muted, marginTop: 8, textAlign: 'center', marginHorizontal: 16 },
  createBtn: { marginTop: 24, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: T.accent, borderRadius: 8 },
  createBtnText: { color: '#FFF', fontWeight: '600', fontSize: 16 },
  postCard: { backgroundColor: T.card, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: T.border },
  postTitle: { fontSize: 16, fontWeight: '600', color: T.text },
  postCategory: { fontSize: 12, color: T.accent, marginTop: 8, fontWeight: '500' },
});
