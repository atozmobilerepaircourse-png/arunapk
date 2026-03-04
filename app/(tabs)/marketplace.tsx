import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Platform,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useApp } from '@/lib/context';
import { apiRequest, getApiUrl } from '@/lib/query-client';
import { openLink } from '@/lib/open-link';
import BuySellScreen from '@/app/buy-sell';
import ErrorState from '@/components/ErrorState';

const { width } = Dimensions.get('window');
const ORANGE = '#FF6B2C';
const BLUE = '#2C7AFF';
const YELLOW = '#FFD100';
const LIGHT_BG = '#F8F9FA';
const GRAY = '#666666';

const TEACH_TYPE_FILTERS = ['All', 'Software Repair', 'Hardware Repair', 'Mobile Repair', 'Laptop Repair', 'AC Repair'];
const SELL_TYPE_FILTERS = ['All', 'Spare Parts', 'Accessories', 'Tools', 'Software'];

interface ProfileData {
  id: string;
  name: string;
  role: string;
  city?: string;
  state?: string;
  avatar?: string;
  shopName?: string;
  skills?: string[];
  teachType?: string;
  sellType?: string;
  bio?: string;
  shopAddress?: string;
}

interface CourseData {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherAvatar?: string;
  title: string;
  description?: string;
  price: string;
  coverImage?: string;
  category?: string;
  language?: string;
  totalVideos?: number;
  enrollmentCount?: number;
  rating?: string;
}

interface ProductData {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  title: string;
  description?: string;
  price: string;
  category?: string;
  images?: string;
  city?: string;
  inStock?: number;
  views?: number;
}

function getImageUri(img: string): string {
  if (!img) return '';
  if (img.startsWith('/')) return `${getApiUrl()}${img}`;
  return img;
}

function getInitials(name: string): string {
  if (!name) return '??';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

type TabKey = 'courses' | 'spare' | 'suppliers' | 'buysell' | 'ads' | 'live';

interface LiveSession {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherAvatar?: string;
  title: string;
  description?: string;
  platform: 'youtube' | 'zoom' | 'meet' | 'other';
  link: string;
  isLive: boolean;
  startedAt: number;
  latestImage?: string;
  latestImageAt?: number;
}

export default function MarketplaceScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useApp();
  const isCustomer = profile?.role === 'customer';

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const topPad = (Platform.OS === 'web' ? webTopInset : insets.top) + 12;
  const webBottomInset = Platform.OS === 'web' ? 84 : 0;

  const [activeTab, setActiveTab] = useState<TabKey>('live');
  const [search, setSearch] = useState('');
  const [teachFilter, setTeachFilter] = useState('All');
  const [sellFilter, setSellFilter] = useState('All');

  const [profiles, setProfiles] = useState<ProfileData[]>([]);
  const [courses, setCourses] = useState<CourseData[]>([]);
  const [products, setProducts] = useState<ProductData[]>([]);
  const [adsList, setAdsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveUrl, setLiveUrl] = useState('');
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (liveUrl) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [liveUrl]);

  const fetchLiveUrl = useCallback(async () => {
    try {
      const res = await apiRequest('GET', '/api/app-settings/live_url');
      const data = await res.json();
      if (data.value) setLiveUrl(data.value);
      else setLiveUrl('');
    } catch (e) {
      setLiveUrl('');
    }
  }, []);

  useEffect(() => {
    fetchLiveUrl();
  }, [fetchLiveUrl]);

  interface RecommendedCourse {
    id: string;
    title: string;
    price: string;
    coverImage?: string;
    teacherName: string;
    totalVideos?: number;
    reason: string;
  }
  const [recommendations, setRecommendations] = useState<RecommendedCourse[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  const fetchLiveSessions = useCallback(async () => {
    setLiveLoading(true);
    try {
      const res = await apiRequest('GET', '/api/teacher/live-sessions');
      const data = await res.json();
      if (data.sessions) setLiveSessions(data.sessions);
    } catch (e) {
      console.warn('[Live] Fetch error:', e);
    } finally {
      setLiveLoading(false);
    }
  }, []);

  const fetchRecommendations = useCallback(async () => {
    if (!profile?.id) return;
    setRecsLoading(true);
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 900, useNativeDriver: false }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 900, useNativeDriver: false }),
      ])
    ).start();
    try {
      const res = await apiRequest('GET', `/api/courses/personalized-recommendations?userId=${profile.id}`);
      const data = await res.json();
      if (data.recommendations) setRecommendations(data.recommendations);
    } catch (e) {
      console.warn('[Recommendations] fetch error:', e);
    } finally {
      setRecsLoading(false);
      shimmerAnim.stopAnimation();
    }
  }, [profile?.id, shimmerAnim]);

  const fetchAll = useCallback(async () => {
    setFetchError(null);
    try {
      const [profRes, courseRes, prodRes, adsRes] = await Promise.all([
        apiRequest('GET', '/api/profiles'),
        apiRequest('GET', '/api/courses'),
        apiRequest('GET', '/api/products'),
        apiRequest('GET', '/api/ads/active').catch(() => null),
      ]);
      const [profData, courseData, prodData] = await Promise.all([
        profRes.json(),
        courseRes.json(),
        prodRes.json(),
      ]);
      if (Array.isArray(profData)) setProfiles(profData);
      if (Array.isArray(courseData)) setCourses(courseData);
      if (Array.isArray(prodData)) setProducts(prodData);
      if (adsRes) {
        const adsData = await adsRes.json();
        if (Array.isArray(adsData)) setAdsList(adsData);
      }
    } catch (e: any) {
      console.warn('[Shop] fetch error:', e);
      setFetchError('Could not load shop data. Check your connection and try again.');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchAll().finally(() => setLoading(false));
  }, [fetchAll]);

  useEffect(() => {
    if (activeTab === 'courses' && profile?.id && recommendations.length === 0) {
      fetchRecommendations();
    }
    if (activeTab === 'live') {
      fetchLiveSessions();
    }
  }, [activeTab, profile?.id]);

  // Auto-refresh live sessions every 10s when on the live tab so shared photos appear
  useEffect(() => {
    if (activeTab !== 'live') return;
    const liveRefreshInterval = setInterval(fetchLiveSessions, 10000);
    return () => clearInterval(liveRefreshInterval);
  }, [activeTab, fetchLiveSessions]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  const courseCounts = useMemo(() => {
    const map: Record<string, number> = {};
    courses.forEach(c => {
      map[c.teacherId] = (map[c.teacherId] || 0) + 1;
    });
    return map;
  }, [courses]);

  const productCounts = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach(p => {
      map[p.userId] = (map[p.userId] || 0) + 1;
    });
    return map;
  }, [products]);

  const suppliers = useMemo(() => {
    const q = search.toLowerCase().trim();
    return profiles
      .filter(p => p.role === 'supplier')
      .filter(p => {
        if (q) {
          const hay = [p.name, p.city, p.shopName, ...(p.skills || []), p.sellType].filter(Boolean).join(' ').toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (sellFilter !== 'All' && p.sellType !== sellFilter) return false;
        return true;
      });
  }, [profiles, search, sellFilter]);

  const filteredCourses = useMemo(() => {
    const q = search.toLowerCase().trim();
    return courses.filter(c => {
      if (q) {
        const hay = [c.title, c.teacherName, c.category, c.language].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (teachFilter !== 'All') {
        const cat = (c.category || '').replace(/_/g, ' ').toLowerCase();
        if (!cat.includes(teachFilter.toLowerCase())) return false;
      }
      return true;
    });
  }, [courses, search, teachFilter]);

  const spareProducts = useMemo(() => {
    const q = search.toLowerCase().trim();
    return products.filter(p => {
      const cat = p.category || '';
      const isSpare = ['spare_part', 'tool', 'component', 'accessory'].includes(cat) || !['course', 'tutorial', 'ebook'].includes(cat);
      if (!isSpare) return false;
      if (q) {
        const hay = [p.title, p.userName, p.city, p.category].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (sellFilter !== 'All') {
        const catMap: Record<string, string[]> = {
          'Spare Parts': ['spare_part', 'component'],
          'Accessories': ['accessory'],
          'Tools': ['tool'],
          'Software': ['software'],
        };
        const allowed = catMap[sellFilter] || [];
        if (allowed.length > 0 && !allowed.includes(cat)) return false;
      }
      return true;
    });
  }, [products, search, sellFilter]);

  if (isCustomer) {
    return <BuySellScreen isEmbedded />;
  }

  const renderCourseCard = (c: CourseData) => {
    const priceNum = parseFloat(c.price || '0');
    return (
      <Pressable
        key={c.id}
        style={s.courseCard}
        onPress={() => router.push(`/course-detail?courseId=${c.id}` as any)}
      >
        <View style={s.courseImageWrap}>
          {c.coverImage ? (
            <Image source={{ uri: getImageUri(c.coverImage) }} style={s.courseImage} contentFit="cover" />
          ) : (
            <View style={[s.courseImage, { backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="videocam" size={40} color="#000" />
            </View>
          )}
          <View style={s.priceBadge}>
            <Text style={s.priceBadgeText}>{priceNum > 0 ? `₹${priceNum}` : 'FREE'}</Text>
          </View>
        </View>
        <View style={s.courseInfo}>
          <Text style={s.courseTitle} numberOfLines={2}>{c.title}</Text>
          <View style={s.metaRowCompact}>
            <Ionicons name="person" size={12} color={ORANGE} />
            <Text style={s.metaTextCompact}>{c.teacherName}</Text>
            <View style={s.dot} />
            <Ionicons name="play-circle" size={12} color={GRAY} />
            <Text style={s.metaTextCompact}>{c.totalVideos || 0} Videos</Text>
          </View>
        </View>
      </Pressable>
    );
  };

  const renderProductCard = (p: ProductData) => {
    const priceNum = parseFloat(p.price || '0');
    let imgs: string[] = [];
    try {
      if (Array.isArray(p.images)) imgs = p.images;
      else if (typeof p.images === 'string') imgs = JSON.parse(p.images || '[]');
    } catch {}
    const firstImg = imgs.length > 0 ? getImageUri(imgs[0]) : null;
    return (
      <Pressable
        key={p.id}
        style={s.productCard}
        onPress={() => router.push(`/product-detail?productId=${p.id}` as any)}
      >
        <View style={s.productImageWrap}>
          {firstImg ? (
            <Image source={{ uri: firstImg }} style={s.productImage} contentFit="cover" />
          ) : (
            <View style={[s.productImage, { backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="cube" size={30} color={BLUE} />
            </View>
          )}
        </View>
        <View style={s.productInfo}>
          <Text style={s.productTitle} numberOfLines={2}>{p.title}</Text>
          <Text style={s.productPrice}>{priceNum > 0 ? `₹${priceNum}` : 'FREE'}</Text>
          {p.city && (
            <View style={s.metaRowCompact}>
              <Ionicons name="location" size={10} color={GRAY} />
              <Text style={s.metaTextCompact}>{p.city}</Text>
            </View>
          )}
        </View>
      </Pressable>
    );
  };

  const renderSupplierCard = (sup: ProfileData) => (
    <Pressable key={sup.id} style={s.card} onPress={() => router.push(`/supplier-store?id=${sup.id}` as any)}>
      <View style={s.cardRow}>
        {sup.avatar ? (
          <Image source={{ uri: getImageUri(sup.avatar) }} style={s.avatar} contentFit="cover" />
        ) : (
          <View style={[s.avatar, s.avatarPlaceholder, { backgroundColor: '#EEE' }]}>
            <Text style={s.initials}>{getInitials(sup.name)}</Text>
          </View>
        )}
        <View style={s.cardInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={s.cardName}>{sup.name}</Text>
            {(sup.city || sup.state) && (
              <View style={s.locationBadge}>
                <Ionicons name="location" size={10} color={BLUE} />
                <Text style={s.locationBadgeText}>{sup.city || sup.state}</Text>
              </View>
            )}
          </View>
          <Text style={s.metaText}>{sup.shopName || 'Supplier'}</Text>
          <View style={s.metaRowCompact}>
            <Ionicons name="cube" size={12} color={BLUE} />
            <Text style={s.metaTextCompact}>{productCounts[sup.id] || 0} Products</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#CCC" />
      </View>
    </Pressable>
  );

  const renderFilterChips = (items: string[], selected: string, onSelect: (v: string) => void, color: string) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow} style={s.chipScroll}>
      {items.map(item => (
        <Pressable
          key={item}
          style={[s.chip, selected === item && { backgroundColor: color, borderColor: color }]}
          onPress={() => onSelect(item)}
        >
          <Text style={[s.chipText, selected === item && s.chipTextActive]}>{item}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: topPad }]}>
        <Text style={s.headerTitle}>Shop</Text>
        <View style={s.searchWrap}>
          <Ionicons name="search" size={18} color="#999" />
          <TextInput
            style={s.searchInput}
            placeholder="Search courses, spare parts..."
            placeholderTextColor="#999"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
        <View style={s.tabContainer}>
          {[
            { key: 'live', label: liveUrl ? 'Mobi Live' : 'Live', icon: 'radio', color: '#FF3B30' },
            { key: 'spare', label: 'Spare Parts', icon: 'cube' },
            { key: 'suppliers', label: 'Suppliers', icon: 'construct' },
            { key: 'buysell', label: 'Buy & Sell', icon: 'pricetags' },
            { key: 'ads', label: 'Ads', icon: 'megaphone' },
          ].map(tab => {
            const isActive = activeTab === tab.key;
            const isLive = tab.key === 'live';
            return (
              <Pressable
                key={tab.key}
                style={[s.tabPill, isActive && (isLive ? s.tabPillLive : s.tabPillActive)]}
                onPress={() => setActiveTab(tab.key as TabKey)}
              >
                {isLive && (
                  <Animated.View style={[s.liveDot, liveUrl ? { transform: [{ scale: pulseAnim }] } : null]} />
                )}
                <Ionicons name={tab.icon as any} size={14} color={isActive ? '#FFF' : (isLive ? '#FF3B30' : '#666')} />
                <Text style={[s.tabPillText, isActive && s.tabPillTextActive]}>{tab.label}</Text>
                {isLive && liveSessions.length > 0 && (
                  <View style={s.liveCountBadge}><Text style={s.liveCountText}>{liveSessions.length}</Text></View>
                )}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {activeTab === 'buysell' ? (
        <BuySellScreen isEmbedded />
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: webBottomInset + 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ORANGE} />}
        >
          {activeTab === 'spare' && (
            <>
              {renderFilterChips(SELL_TYPE_FILTERS, sellFilter, setSellFilter, BLUE)}
              <View style={s.grid2}>
                {spareProducts.map(renderProductCard)}
                {spareProducts.length === 0 && !loading && (
                  <View style={s.emptyWrap}><Ionicons name="cube-outline" size={48} color="#DDD" /><Text style={s.emptyText}>No products found</Text></View>
                )}
              </View>
            </>
          )}

          {activeTab === 'suppliers' && (
            <View style={{ paddingVertical: 10 }}>
              {suppliers.map(renderSupplierCard)}
              {suppliers.length === 0 && !loading && (
                <View style={s.emptyWrap}><Ionicons name="construct-outline" size={48} color="#DDD" /><Text style={s.emptyText}>No suppliers found</Text></View>
              )}
            </View>
          )}

          {activeTab === 'live' && (
            <View style={{ padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={s.liveHeaderDot} />
                  <Text style={{ fontSize: 20, fontWeight: '800' as const, color: '#000' }}>Live Now</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable onPress={fetchLiveSessions} style={{ backgroundColor: '#F2F2F2', padding: 8, borderRadius: 10 }}>
                    <Ionicons name="refresh" size={18} color="#666" />
                  </Pressable>
                  {profile?.role === 'teacher' && (
                    <Pressable
                      style={s.goLiveBtn}
                      onPress={() => router.push('/go-live' as any)}
                    >
                      <View style={s.goLiveDot} />
                      <Text style={s.goLiveBtnText}>Go Live</Text>
                    </Pressable>
                  )}
                </View>
              </View>
              {liveLoading ? (
                <ActivityIndicator size="large" color="#FF3B30" style={{ marginTop: 40 }} />
              ) : liveSessions.length === 0 ? (
                <View style={s.emptyWrap}>
                  <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                    <Ionicons name="radio-outline" size={40} color="#FF3B30" />
                  </View>
                  <Text style={{ fontSize: 17, fontWeight: '700' as const, color: '#000', marginBottom: 4 }}>No Live Sessions</Text>
                  <Text style={s.emptyText}>Teachers will appear here when they go live</Text>
                  {profile?.role === 'teacher' && (
                    <Pressable style={[s.goLiveBtn, { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12 }]} onPress={() => router.push('/go-live' as any)}>
                      <View style={s.goLiveDot} />
                      <Text style={s.goLiveBtnText}>Start Streaming</Text>
                    </Pressable>
                  )}
                </View>
              ) : (
                liveSessions.map(session => {
                  const platformColors: Record<string, string> = { youtube: '#FF0000', zoom: '#2D8CFF', meet: '#00897B', other: '#FF3B30' };
                  const platformIcons: Record<string, string> = { youtube: 'logo-youtube', zoom: 'videocam', meet: 'videocam', other: 'radio' };
                  const platformNames: Record<string, string> = { youtube: 'YouTube', zoom: 'Zoom', meet: 'Google Meet', other: 'Live' };
                  const color = platformColors[session.platform] || '#FF3B30';
                  const iconName = platformIcons[session.platform] || 'radio';
                  const platformName = platformNames[session.platform] || 'Live';
                  const elapsed = Math.floor((Date.now() - session.startedAt) / 60000);
                  const elapsedText = elapsed < 60 ? `${elapsed}m ago` : `${Math.floor(elapsed / 60)}h ago`;
                  return (
                    <Pressable
                      key={session.id}
                      style={s.liveCard}
                      onPress={() => router.push({ pathname: '/live-session', params: { url: session.link, title: session.title } } as any)}
                    >
                      {session.latestImage ? (
                        <View style={{ position: 'relative', marginBottom: 10 }}>
                          <Image
                            source={{ uri: getImageUri(session.latestImage) }}
                            style={{ width: '100%', height: 180, borderRadius: 10 }}
                            contentFit="cover"
                          />
                          <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF3B30' }} />
                            <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' as const }}>LIVE</Text>
                          </View>
                        </View>
                      ) : null}
                      <View style={s.liveCardHeader}>
                        <View style={[s.livePlatformBadge, { backgroundColor: color + '15', borderColor: color + '30' }]}>
                          <Ionicons name={iconName as any} size={14} color={color} />
                          <Text style={[s.livePlatformText, { color }]}>{platformName}</Text>
                        </View>
                        {!session.latestImage && (
                          <View style={s.liveActiveBadge}>
                            <View style={s.liveActiveDot} />
                            <Text style={s.liveActiveText}>LIVE</Text>
                          </View>
                        )}
                      </View>
                      <Text style={s.liveCardTitle} numberOfLines={2}>{session.title}</Text>
                      {session.description ? (
                        <Text style={s.liveCardDesc} numberOfLines={2}>{session.description}</Text>
                      ) : null}
                      <View style={s.liveCardFooter}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: color + '20', alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color, fontSize: 11, fontWeight: '700' as const }}>{getInitials(session.teacherName)}</Text>
                          </View>
                          <Text style={s.liveTeacherName}>{session.teacherName}</Text>
                        </View>
                        <Text style={s.liveElapsed}>Started {elapsedText}</Text>
                      </View>
                      <View style={[s.joinLiveBtn, { backgroundColor: color }]}>
                        <Ionicons name="play" size={14} color="#FFF" />
                        <Text style={s.joinLiveBtnText}>Join Session</Text>
                      </View>
                    </Pressable>
                  );
                })
              )}
            </View>
          )}

          {activeTab === 'ads' && (
            <View style={{ padding: 16 }}>
              {adsList.map(ad => (
                <Pressable key={ad.id} style={s.adCard} onPress={() => ad.link_url && openLink(ad.link_url)}>
                  <Image source={{ uri: getImageUri(ad.image_url) }} style={s.adImage} contentFit="cover" />
                  <View style={s.adOverlay}><Text style={s.adTitle}>{ad.title}</Text></View>
                </Pressable>
              ))}
              {adsList.length === 0 && !loading && (
                <View style={s.emptyWrap}><Ionicons name="megaphone-outline" size={48} color="#DDD" /><Text style={s.emptyText}>No active ads</Text></View>
              )}
            </View>
          )}

          {loading && <ActivityIndicator size="large" color={ORANGE} style={{ marginTop: 20 }} />}
          {!loading && fetchError && <ErrorState message={fetchError} onRetry={() => { setLoading(true); fetchAll().finally(() => setLoading(false)); }} />}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { paddingHorizontal: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F0', paddingBottom: 12 },
  headerTitle: { fontSize: 28, fontWeight: '800' as const, color: '#000', marginBottom: 12 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F2F2F2', borderRadius: 12, paddingHorizontal: 12, height: 44 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: '#000' },
  tabContainer: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  tabPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F2F2F2' },
  tabPillActive: { backgroundColor: '#000' },
  tabPillText: { fontSize: 13, fontWeight: '600' as const, color: '#666' },
  tabPillTextActive: { color: '#FFF' },
  chipScroll: { maxHeight: 50, marginBottom: 8 },
  chipRow: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F2F2F2', borderWidth: 1, borderColor: '#EEE' },
  chipText: { fontSize: 13, fontWeight: '600' as const, color: '#666' },
  chipTextActive: { color: '#FFF' },
  grid: { padding: 16, gap: 16 },
  grid2: { padding: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  courseCard: { backgroundColor: '#FFF', borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  courseImageWrap: { width: '100%', height: 180, position: 'relative' },
  courseImage: { width: '100%', height: '100%' },
  priceBadge: { position: 'absolute', top: 12, left: 12, backgroundColor: '#000', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  priceBadgeText: { color: '#FFF', fontSize: 14, fontWeight: '800' as const },
  courseInfo: { padding: 16, gap: 8 },
  courseTitle: { fontSize: 18, fontWeight: '700' as const, color: '#000', lineHeight: 24 },
  productCard: { width: (width - 44) / 2, backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#F0F0F0' },
  productImageWrap: { width: '100%', height: 140 },
  productImage: { width: '100%', height: '100%' },
  productInfo: { padding: 10, gap: 4 },
  productTitle: { fontSize: 14, fontWeight: '600' as const, color: '#000', height: 36 },
  productPrice: { fontSize: 16, fontWeight: '800' as const, color: BLUE },
  card: { marginHorizontal: 16, marginBottom: 12, backgroundColor: '#FFF', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#F0F0F0' },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 16, fontWeight: '700' as const, color: '#666' },
  cardInfo: { flex: 1, gap: 2 },
  cardName: { fontSize: 16, fontWeight: '700' as const, color: '#000' },
  metaRowCompact: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaTextCompact: { fontSize: 12, color: GRAY, fontWeight: '500' as const },
  metaText: { fontSize: 13, color: GRAY },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#CCC', marginHorizontal: 2 },
  adCard: { marginBottom: 16, borderRadius: 16, overflow: 'hidden', height: 160, position: 'relative' },
  adImage: { width: '100%', height: '100%' },
  adOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: 'rgba(0,0,0,0.5)' },
  adTitle: { color: '#FFF', fontSize: 16, fontWeight: '700' as const },
  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 12, width: '100%' },
  emptyText: { fontSize: 15, color: '#999', fontWeight: '500' as const },
  allCoursesLabel: { fontSize: 18, fontWeight: '700' as const, color: '#000', marginTop: 8 },
  recSection: { marginBottom: 8, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  recHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  recHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sparkleIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFF0E8', alignItems: 'center', justifyContent: 'center' },
  recTitle: { fontSize: 17, fontWeight: '700' as const, color: '#000' },
  refreshBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF0E8', alignItems: 'center', justifyContent: 'center' },
  recCardSkeleton: { width: 180, height: 220, borderRadius: 16, backgroundColor: '#F0F0F0' },
  recCard: { width: 180, backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#F0F0F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 },
  recImageWrap: { width: '100%', height: 110, position: 'relative' },
  recImage: { width: '100%', height: '100%' },
  recPriceBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  recPriceBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '800' as const },
  recCardBody: { padding: 10, gap: 6 },
  recCardTitle: { fontSize: 13, fontWeight: '700' as const, color: '#000', lineHeight: 18 },
  recAiReason: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, backgroundColor: '#FFF8F5', padding: 6, borderRadius: 8 },
  recReasonText: { fontSize: 10, color: '#FF6B2C', lineHeight: 14, flex: 1, fontWeight: '500' as const },
  recMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  recMetaText: { fontSize: 10, color: GRAY, flex: 1 },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F0FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 2,
  },
  locationBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: BLUE,
  },
  tabPillLive: { backgroundColor: '#FF3B30' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF3B30' },
  liveCountBadge: { backgroundColor: '#FF3B30', borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  liveCountText: { color: '#FFF', fontSize: 9, fontWeight: '700' as const },
  goLiveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FF3B30', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  goLiveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFF' },
  goLiveBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' as const },
  liveHeaderDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF3B30' },
  liveCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#FFE0E0', shadowColor: '#FF3B30', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 4 },
  liveCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  livePlatformBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  livePlatformText: { fontSize: 12, fontWeight: '700' as const },
  liveActiveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FF3B3015', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  liveActiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF3B30' },
  liveActiveText: { fontSize: 10, fontWeight: '800' as const, color: '#FF3B30', letterSpacing: 1 },
  liveCardTitle: { fontSize: 18, fontWeight: '800' as const, color: '#000', marginBottom: 6, lineHeight: 24 },
  liveCardDesc: { fontSize: 13, color: '#666', lineHeight: 18, marginBottom: 12 },
  liveCardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  liveTeacherName: { fontSize: 13, fontWeight: '600' as const, color: '#333' },
  liveElapsed: { fontSize: 11, color: '#999' },
  joinLiveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 14 },
  joinLiveBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' as const },
});
