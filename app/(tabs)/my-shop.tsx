import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, Platform,
  Alert, RefreshControl, Dimensions, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Colors from '@/constants/colors';
import { useApp } from '@/lib/context';
import { apiRequest, getApiUrl } from '@/lib/query-client';
import { Product, Order, Course } from '@/lib/types';

const C = Colors.light;
const { width } = Dimensions.get('window');

export default function MyShopScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useApp();
  const [myProducts, setMyProducts] = useState<Product[]>([]);
  const [myCourses, setMyCourses] = useState<Course[]>([]);
  const [pendingOrders, setPendingOrders] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [teacherEarnings, setTeacherEarnings] = useState(0);
  const [teacherAvailable, setTeacherAvailable] = useState(0);
  const [teacherEnrollments, setTeacherEnrollments] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const isTeacher = profile?.role === 'teacher';
  const isSupplier = profile?.role === 'supplier';
  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const fetchMyProducts = useCallback(async () => {
    if (!profile) return;
    try {
      const fetches: Promise<Response>[] = [
        apiRequest('GET', `/api/products?userId=${profile.id}`),
        apiRequest('GET', `/api/orders?sellerId=${profile.id}`),
      ];
      if (isTeacher) {
        fetches.push(apiRequest('GET', `/api/courses?teacherId=${profile.id}`));
        fetches.push(apiRequest('GET', `/api/teacher/revenue/${profile.id}`));
      }
      const results = await Promise.all(fetches);
      const prodData = await results[0].json();
      const ordersData: Order[] = await results[1].json();
      setMyProducts(prodData);
      setTotalOrders(ordersData.length);
      setPendingOrders(ordersData.filter((o: Order) => o.status === 'pending').length);
      if (isTeacher && results[2]) {
        const coursesData = await results[2].json();
        setMyCourses(coursesData);
      }
      if (isTeacher && results[3]) {
        const rev = await results[3].json();
        if (rev.success !== false) {
          setTeacherEarnings(Math.round((rev.totalEarnings || 0) / 100));
          setTeacherAvailable(Math.round((rev.availableForWithdrawal || 0) / 100));
          setTeacherEnrollments(rev.totalEnrollments || 0);
        }
      }
    } catch (e) {
      console.warn('[MyShop] Failed to fetch data:', e);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchMyProducts();
    const interval = setInterval(fetchMyProducts, 15000);
    return () => clearInterval(interval);
  }, [fetchMyProducts]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMyProducts();
    setRefreshing(false);
  };

  const deleteProduct = (productId: string) => {
    Alert.alert('Delete Listing', 'Are you sure you want to remove this listing?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await apiRequest('DELETE', `/api/products/${productId}`);
            setMyProducts(prev => prev.filter(p => p.id !== productId));
          } catch (e) {
            Alert.alert('Error', 'Failed to delete listing');
          }
        }
      },
    ]);
  };

  const totalViews = myProducts.reduce((sum, p) => sum + (p.views || 0), 0);
  const totalLikes = myProducts.reduce((sum, p) => sum + (p.likes?.length || 0), 0);

  const renderProduct = ({ item }: { item: Product }) => {
    const hasImage = item.images && item.images.length > 0;
    return (
      <Pressable
        style={styles.productCard}
        onPress={() => router.push({ pathname: '/product-detail', params: { id: item.id } })}
      >
        {hasImage && (
          <Image source={{ uri: item.images[0].startsWith('/') ? `${getApiUrl()}${item.images[0]}` : item.images[0] }} style={styles.productImage} contentFit="cover" />
        )}
        <View style={styles.productInfo}>
          <View style={styles.productHeader}>
            <Text style={styles.productTitle} numberOfLines={2}>{item.title}</Text>
            <Pressable onPress={() => deleteProduct(item.id)} hitSlop={10}>
              <Ionicons name="trash-outline" size={18} color={C.error} />
            </Pressable>
          </View>
          <Text style={styles.productPrice}>Rs. {item.price}</Text>
          <View style={styles.productMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="eye-outline" size={14} color={C.textTertiary} />
              <Text style={styles.metaText}>{item.views || 0}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="heart-outline" size={14} color={C.textTertiary} />
              <Text style={styles.metaText}>{item.likes?.length || 0}</Text>
            </View>
            <View style={[styles.stockBadge, item.inStock ? styles.inStock : styles.outOfStock]}>
              <Text style={styles.stockText}>{item.inStock ? 'In Stock' : 'Out of Stock'}</Text>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  if (!isTeacher && !isSupplier) {
    return (
      <View style={[styles.container, { paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 20 }]}>
        <Text style={styles.headerTitle}>Shop</Text>
        <View style={styles.emptyState}>
          <Ionicons name="lock-closed-outline" size={48} color={C.textTertiary} />
          <Text style={styles.emptyTitle}>Not Available</Text>
          <Text style={styles.emptyText}>Only teachers and suppliers can manage a shop</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 12 }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>{isTeacher ? 'My Content' : 'My Products'}</Text>
            <Text style={styles.headerSubtitle}>
              {isTeacher ? 'Manage courses & products' : 'Sell parts & tools to technicians'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            {isTeacher && (
              <Pressable
                style={[styles.ordersButton, { marginRight: 0 }]}
                onPress={() => router.push('/go-live' as any)}
              >
                <Ionicons name="radio-outline" size={20} color="#FF3B30" />
              </Pressable>
            )}
            <Pressable
              style={styles.ordersButton}
              onPress={() => router.push('/seller-orders')}
            >
              <Ionicons name="receipt-outline" size={20} color={C.primary} />
            </Pressable>
            <Pressable
              style={styles.addButton}
              onPress={() => router.push(isTeacher ? '/create-course' as any : '/add-product')}
            >
              <Ionicons name="add" size={24} color="#FFF" />
            </Pressable>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{isTeacher ? myCourses.length : myProducts.length}</Text>
            <Text style={styles.statLabel}>{isTeacher ? 'Courses' : 'Listings'}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, !isTeacher && pendingOrders > 0 && { color: '#FF9F0A' }]}>
              {isTeacher ? teacherEnrollments : totalOrders}
            </Text>
            <Text style={styles.statLabel}>{isTeacher ? 'Enrolled' : (pendingOrders > 0 ? `${pendingOrders} new` : 'Orders')}</Text>
          </View>
          {isTeacher ? (
            <Pressable style={[styles.statBox, { borderColor: '#FFD60A40' }]} onPress={() => router.push('/teacher-revenue')}>
              <Text style={[styles.statNumber, { color: '#FFD60A', fontSize: 16 }]}>
                {'₹' + teacherEarnings.toLocaleString('en-IN')}
              </Text>
              <Text style={styles.statLabel}>Earned</Text>
            </Pressable>
          ) : (
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{totalViews}</Text>
              <Text style={styles.statLabel}>Views</Text>
            </View>
          )}
          {isTeacher ? (
            <Pressable style={[styles.statBox, { borderColor: '#34C75940' }]} onPress={() => router.push('/teacher-revenue')}>
              <Text style={[styles.statNumber, { color: '#34C759', fontSize: 16 }]}>
                {'₹' + teacherAvailable.toLocaleString('en-IN')}
              </Text>
              <Text style={styles.statLabel}>Available</Text>
            </Pressable>
          ) : (
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{totalLikes}</Text>
              <Text style={styles.statLabel}>Likes</Text>
            </View>
          )}
        </View>
      </View>

      {isTeacher ? (
        <ScrollView
          contentContainerStyle={[styles.coursesSection, { paddingBottom: Platform.OS === 'web' ? 84 + 34 : 100 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} colors={[C.primary]} />}
          showsVerticalScrollIndicator={false}
        >
          {myCourses.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="school-outline" size={56} color={C.textTertiary} />
              <Text style={styles.emptyTitle}>No courses yet</Text>
              <Text style={styles.emptyText}>Tap the + button to create your first course</Text>
              <Pressable style={styles.emptyButton} onPress={() => router.push('/create-course' as any)}>
                <Ionicons name="add-circle" size={20} color="#FFF" />
                <Text style={styles.emptyButtonText}>Create Course</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.coursesSectionHeader}>
                <Text style={styles.coursesSectionTitle}>My Courses</Text>
                <Pressable onPress={() => router.push('/create-course' as any)}>
                  <Ionicons name="add-circle-outline" size={22} color={C.primary} />
                </Pressable>
              </View>
              {myCourses.map(course => (
                <Pressable
                  key={course.id}
                  style={styles.courseCard}
                  onPress={() => router.push({ pathname: '/create-course' as any, params: { courseId: course.id } })}
                >
                  {course.coverImage ? (
                    <Image
                      source={{ uri: course.coverImage.startsWith('/') ? `${getApiUrl()}${course.coverImage}` : course.coverImage }}
                      style={styles.courseCover}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={[styles.courseCover, { backgroundColor: C.surfaceElevated, alignItems: 'center', justifyContent: 'center' }]}>
                      <Ionicons name="school" size={28} color={C.textTertiary} />
                    </View>
                  )}
                  <View style={styles.courseInfo}>
                    <View style={styles.courseTopRow}>
                      <Text style={styles.courseTitle} numberOfLines={2}>{course.title}</Text>
                      <View style={[styles.publishBadge, course.isPublished ? styles.publishedBadge : styles.draftBadge]}>
                        <Text style={[styles.publishBadgeText, course.isPublished ? styles.publishedText : styles.draftText]}>
                          {course.isPublished ? 'Published' : 'Draft'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.coursePrice}>Rs. {course.price}</Text>
                    <View style={styles.courseMeta}>
                      <View style={styles.metaItem}>
                        <Ionicons name="videocam-outline" size={14} color={C.textTertiary} />
                        <Text style={styles.metaText}>{course.totalVideos} videos</Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Ionicons name="people-outline" size={14} color={C.textTertiary} />
                        <Text style={styles.metaText}>{course.enrollmentCount} enrolled</Text>
                      </View>
                    </View>
                  </View>
                </Pressable>
              ))}
            </>
          )}
        </ScrollView>
      ) : (
        <FlatList
          data={myProducts}
          keyExtractor={item => item.id}
          renderItem={renderProduct}
          contentContainerStyle={[styles.listContent, { paddingBottom: Platform.OS === 'web' ? 84 + 34 : 100 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} colors={[C.primary]} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={56} color={C.textTertiary} />
              <Text style={styles.emptyTitle}>No listings yet</Text>
              <Text style={styles.emptyText}>Add your first product to start selling</Text>
              <Pressable style={styles.emptyButton} onPress={() => router.push('/add-product')}>
                <Ionicons name="add-circle" size={20} color="#FFF" />
                <Text style={styles.emptyButtonText}>Add Product</Text>
              </Pressable>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  ordersButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  headerTitle: { color: C.text, fontSize: 28, fontFamily: 'Inter_700Bold' },
  headerSubtitle: { color: C.textTertiary, fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 4 },
  addButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row', marginTop: 16, gap: 8,
  },
  statBox: {
    flex: 1, backgroundColor: C.surface, borderRadius: 12, padding: 12,
    alignItems: 'center', borderWidth: 1, borderColor: C.border,
  },
  statNumber: { color: C.text, fontSize: 22, fontFamily: 'Inter_700Bold' },
  statLabel: { color: C.textTertiary, fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
  listContent: { paddingTop: 8 },
  productCard: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 12,
    backgroundColor: C.surface, borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: C.border,
  },
  productImage: { width: 100, height: 100 },
  productInfo: { flex: 1, padding: 12, justifyContent: 'space-between' },
  productHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  productTitle: { color: C.text, fontSize: 15, fontFamily: 'Inter_600SemiBold', flex: 1 },
  productPrice: { color: C.primary, fontSize: 16, fontFamily: 'Inter_700Bold', marginTop: 4 },
  productMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: C.textTertiary, fontSize: 12, fontFamily: 'Inter_400Regular' },
  stockBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  inStock: { backgroundColor: 'rgba(52, 199, 89, 0.15)' },
  outOfStock: { backgroundColor: 'rgba(255, 59, 48, 0.15)' },
  stockText: { fontSize: 10, fontFamily: 'Inter_500Medium', color: C.success },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12, paddingHorizontal: 40 },
  emptyTitle: { color: C.text, fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  emptyText: { color: C.textTertiary, fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' as const },
  emptyButton: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, marginTop: 8,
  },
  emptyButtonText: { color: '#FFF', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  coursesSection: { paddingHorizontal: 16, marginBottom: 8 },
  coursesSectionHeader: {
    flexDirection: 'row' as const, justifyContent: 'space-between' as const,
    alignItems: 'center' as const, marginBottom: 10,
  },
  coursesSectionTitle: { color: C.text, fontSize: 18, fontFamily: 'Inter_700Bold' },
  courseCard: {
    flexDirection: 'row' as const, marginBottom: 12,
    backgroundColor: C.surface, borderRadius: 14, overflow: 'hidden' as const,
    borderWidth: 1, borderColor: C.border,
  },
  courseCover: { width: 100, height: 100 },
  courseInfo: { flex: 1, padding: 12, justifyContent: 'space-between' as const },
  courseTopRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'flex-start' as const, gap: 8 },
  courseTitle: { color: C.text, fontSize: 15, fontFamily: 'Inter_600SemiBold', flex: 1 },
  coursePrice: { color: C.primary, fontSize: 16, fontFamily: 'Inter_700Bold', marginTop: 4 },
  courseMeta: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, marginTop: 6 },
  publishBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  publishedBadge: { backgroundColor: 'rgba(52, 199, 89, 0.15)' },
  draftBadge: { backgroundColor: 'rgba(255, 159, 10, 0.15)' },
  publishBadgeText: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  publishedText: { color: '#34C759' },
  draftText: { color: '#FF9F0A' },
  sectionDivider: {
    flexDirection: 'row' as const, justifyContent: 'space-between' as const,
    alignItems: 'center' as const, paddingHorizontal: 16, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: C.border, marginTop: 4,
  },
  sectionDividerText: { color: C.textSecondary, fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
