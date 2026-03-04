import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, Pressable, Platform,
  Modal, TextInput, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import { useApp } from '@/lib/context';
import JobCard from '@/components/JobCard';
import { apiRequest } from '@/lib/query-client';

const PRIMARY = '#007AFF';
const BG = '#000';
const SURFACE = '#1C1C1E';
const TEXT_COLOR = '#fff';
const TEXT_SECONDARY = '#EBEBF5';
const TEXT_TERTIARY = '#8E8E93';
const BORDER = '#38383A';

const C = Colors.light;

const JOB_TYPES = [
  { key: 'all', label: 'All Jobs' },
  { key: 'full_time', label: 'Full Time' },
  { key: 'part_time', label: 'Part Time' },
  { key: 'contract', label: 'Contract' },
];

const CATEGORIES = [
  'AC Repair', 'Refrigerator', 'Washing Machine', 'TV Repair',
  'Microwave', 'Electrician', 'Plumber', 'Mobile Repair',
  'Computer Repair', 'CCTV', 'Other',
];

interface ServiceRequest {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerAvatar?: string;
  title: string;
  description: string;
  category: string;
  city: string;
  state: string;
  responseCount?: number;
  responses?: ServiceResponse[];
  createdAt: string;
}

interface ServiceResponse {
  id: string;
  technicianId: string;
  technicianName: string;
  technicianPhone?: string;
  technicianAvatar?: string;
  message: string;
  createdAt: string;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function ServiceRequestCard({
  item,
  profile,
  onRespond,
  onViewResponses,
}: {
  item: ServiceRequest;
  profile: any;
  onRespond: (id: string) => void;
  onViewResponses: (item: ServiceRequest) => void;
}) {
  const isOwner = profile?.id === item.customerId;
  const isTechnician = profile?.role === 'technician';

  return (
    <Pressable
      style={styles.srCard}
      onPress={isOwner ? () => onViewResponses(item) : undefined}
    >
      <View style={styles.srCardHeader}>
        <View style={styles.srCategoryBadge}>
          <Text style={styles.srCategoryText}>{item.category}</Text>
        </View>
        <Text style={styles.srTimeText}>{timeAgo(item.createdAt)}</Text>
      </View>
      <Text style={styles.srTitle}>{item.title}</Text>
      <Text style={styles.srDescription} numberOfLines={3}>{item.description}</Text>
      <View style={styles.srFooter}>
        <View style={styles.srLocationRow}>
          <Ionicons name="location-outline" size={14} color={TEXT_TERTIARY} />
          <Text style={styles.srLocationText}>{item.city}, {item.state}</Text>
        </View>
        <View style={styles.srCustomerRow}>
          <Ionicons name="person-outline" size={14} color={TEXT_TERTIARY} />
          <Text style={styles.srCustomerText}>{item.customerName}</Text>
        </View>
      </View>
      <View style={styles.srActions}>
        <View style={styles.srResponseCount}>
          <Ionicons name="chatbubbles-outline" size={16} color={PRIMARY} />
          <Text style={styles.srResponseCountText}>
            {item.responseCount ?? 0} {(item.responseCount ?? 0) === 1 ? 'response' : 'responses'}
          </Text>
        </View>
        {isTechnician && !isOwner && (
          <Pressable style={styles.srRespondBtn} onPress={() => onRespond(item.id)}>
            <Ionicons name="send-outline" size={16} color="#fff" />
            <Text style={styles.srRespondBtnText}>Respond</Text>
          </Pressable>
        )}
        {isOwner && (
          <Pressable style={styles.srViewBtn} onPress={() => onViewResponses(item)}>
            <Ionicons name="eye-outline" size={16} color={PRIMARY} />
            <Text style={styles.srViewBtnText}>View</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

export default function JobsScreen() {
  const insets = useSafeAreaInsets();
  const { profile, jobs, refreshData, startConversation } = useApp();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<'jobs' | 'requests'>('jobs');
  const [typeFilter, setTypeFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const [respondModalVisible, setRespondModalVisible] = useState(false);
  const [respondRequestId, setRespondRequestId] = useState<string | null>(null);
  const [respondMessage, setRespondMessage] = useState('');

  const [postModalVisible, setPostModalVisible] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [postDescription, setPostDescription] = useState('');
  const [postCategory, setPostCategory] = useState(CATEGORIES[0]);
  const [postCity, setPostCity] = useState(profile?.city ?? '');
  const [postState, setPostState] = useState(profile?.state ?? '');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const [viewResponsesModal, setViewResponsesModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);

  const { data: serviceRequests = [], isLoading: srLoading, refetch: refetchSR } = useQuery<ServiceRequest[]>({
    queryKey: ['/api/service-requests'],
    enabled: activeTab === 'requests',
  });

  const respondMutation = useMutation({
    mutationFn: async ({ id, message }: { id: string; message: string }) => {
      await apiRequest('POST', `/api/service-requests/${id}/respond`, {
        technicianId: profile?.id,
        technicianName: profile?.name,
        technicianPhone: profile?.phone,
        technicianAvatar: profile?.avatar,
        message,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/service-requests'] });
      setRespondModalVisible(false);
      setRespondMessage('');
      setRespondRequestId(null);
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to send response');
    },
  });

  const postMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest('POST', '/api/service-requests', data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/service-requests'] });
      setPostModalVisible(false);
      setPostTitle('');
      setPostDescription('');
      setPostCategory(CATEGORIES[0]);
      setPostCity(profile?.city ?? '');
      setPostState(profile?.state ?? '');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to post request');
    },
  });

  const filtered = useMemo(() => {
    if (typeFilter === 'all') return jobs;
    return jobs.filter(j => j.type === typeFilter);
  }, [jobs, typeFilter]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (activeTab === 'jobs') {
      await refreshData();
    } else {
      await refetchSR();
    }
    setRefreshing(false);
  };

  const handleRespond = (id: string) => {
    setRespondRequestId(id);
    setRespondModalVisible(true);
  };

  const handleViewResponses = useCallback(async (item: ServiceRequest) => {
    try {
      const res = await apiRequest('GET', `/api/service-requests/${item.id}`);
      const data = await res.json();
      setSelectedRequest(data);
    } catch {
      setSelectedRequest(item);
    }
    setViewResponsesModal(true);
  }, []);

  const handleStartChat = async (techId: string, techName: string) => {
    try {
      const convoId = await startConversation(techId, techName, 'technician');
      setViewResponsesModal(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to start chat');
    }
  };

  const submitPost = () => {
    if (!postTitle.trim() || !postDescription.trim()) {
      Alert.alert('Required', 'Please fill in title and description');
      return;
    }
    postMutation.mutate({
      customerId: profile?.id,
      customerName: profile?.name,
      customerPhone: profile?.phone,
      customerAvatar: profile?.avatar,
      title: postTitle.trim(),
      description: postDescription.trim(),
      category: postCategory,
      city: postCity.trim() || profile?.city,
      state: postState.trim() || profile?.state,
    });
  };

  const submitRespond = () => {
    if (!respondMessage.trim() || !respondRequestId) return;
    respondMutation.mutate({ id: respondRequestId, message: respondMessage.trim() });
  };

  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const isCustomer = profile?.role === 'customer';

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: (Platform.OS === 'web' ? webTopInset : insets.top) + 12 }]}>
        <Text style={styles.headerTitle}>Jobs</Text>
        <Text style={styles.headerSubtitle}>Find opportunities & hire talent</Text>
      </View>

      <View style={styles.topTabs}>
        <Pressable
          style={[styles.topTab, activeTab === 'jobs' && styles.topTabActive]}
          onPress={() => setActiveTab('jobs')}
        >
          <Ionicons name="briefcase-outline" size={18} color={activeTab === 'jobs' ? PRIMARY : TEXT_TERTIARY} />
          <Text style={[styles.topTabText, activeTab === 'jobs' && styles.topTabTextActive]}>Jobs</Text>
        </Pressable>
        <Pressable
          style={[styles.topTab, activeTab === 'requests' && styles.topTabActive]}
          onPress={() => setActiveTab('requests')}
        >
          <Ionicons name="construct-outline" size={18} color={activeTab === 'requests' ? PRIMARY : TEXT_TERTIARY} />
          <Text style={[styles.topTabText, activeTab === 'requests' && styles.topTabTextActive]}>Service Requests</Text>
        </Pressable>
      </View>

      {activeTab === 'jobs' ? (
        <>
          <View style={styles.filtersContainer}>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={JOB_TYPES}
              contentContainerStyle={styles.filtersContent}
              keyExtractor={item => item.key}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.filterChip, typeFilter === item.key && styles.filterChipActive]}
                  onPress={() => setTypeFilter(item.key)}
                >
                  <Text style={[styles.filterText, typeFilter === item.key && styles.filterTextActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              )}
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={item => item.id}
            renderItem={({ item }) => <JobCard job={item} />}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: Platform.OS === 'web' ? 84 + 34 : 100 },
            ]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={C.primary}
                colors={[C.primary]}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="briefcase-outline" size={48} color={TEXT_TERTIARY} />
                <Text style={styles.emptyTitle}>No jobs posted yet</Text>
                <Text style={styles.emptyText}>Job listings will appear here</Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
          />
        </>
      ) : (
        <>
          {srLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={PRIMARY} />
            </View>
          ) : (
            <FlatList
              data={serviceRequests}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <ServiceRequestCard
                  item={item}
                  profile={profile}
                  onRespond={handleRespond}
                  onViewResponses={handleViewResponses}
                />
              )}
              contentContainerStyle={[
                styles.srListContent,
                { paddingBottom: Platform.OS === 'web' ? 84 + 34 : 100 },
              ]}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={PRIMARY}
                  colors={[PRIMARY]}
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="construct-outline" size={48} color={TEXT_TERTIARY} />
                  <Text style={styles.emptyTitle}>No service requests yet</Text>
                  <Text style={styles.emptyText}>
                    {isCustomer ? 'Post a request for technicians to respond' : 'Service requests from customers will appear here'}
                  </Text>
                </View>
              }
              showsVerticalScrollIndicator={false}
            />
          )}

          {isCustomer && (
            <Pressable
              style={[styles.fab, { bottom: Platform.OS === 'web' ? 84 + 34 + 16 : 100 + 16 }]}
              onPress={() => setPostModalVisible(true)}
            >
              <Ionicons name="add" size={28} color="#fff" />
            </Pressable>
          )}
        </>
      )}

      <Modal visible={respondModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Send Response</Text>
              <Pressable onPress={() => { setRespondModalVisible(false); setRespondMessage(''); }}>
                <Ionicons name="close" size={24} color={TEXT_COLOR} />
              </Pressable>
            </View>
            <TextInput
              style={styles.respondInput}
              placeholder="Describe how you can help..."
              placeholderTextColor={TEXT_TERTIARY}
              multiline
              value={respondMessage}
              onChangeText={setRespondMessage}
            />
            <Pressable
              style={[styles.submitBtn, (!respondMessage.trim() || respondMutation.isPending) && styles.submitBtnDisabled]}
              onPress={submitRespond}
              disabled={!respondMessage.trim() || respondMutation.isPending}
            >
              {respondMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Send Response</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={postModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Post Service Request</Text>
                <Pressable onPress={() => setPostModalVisible(false)}>
                  <Ionicons name="close" size={24} color={TEXT_COLOR} />
                </Pressable>
              </View>
              <TextInput
                style={styles.modalInput}
                placeholder="Title"
                placeholderTextColor={TEXT_TERTIARY}
                value={postTitle}
                onChangeText={setPostTitle}
              />
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                placeholder="Describe what you need..."
                placeholderTextColor={TEXT_TERTIARY}
                multiline
                value={postDescription}
                onChangeText={setPostDescription}
              />
              <Pressable style={styles.categorySelector} onPress={() => setShowCategoryPicker(!showCategoryPicker)}>
                <Text style={styles.categorySelectorText}>{postCategory}</Text>
                <Ionicons name={showCategoryPicker ? 'chevron-up' : 'chevron-down'} size={20} color={TEXT_TERTIARY} />
              </Pressable>
              {showCategoryPicker && (
                <View style={styles.categoryList}>
                  {CATEGORIES.map(cat => (
                    <Pressable
                      key={cat}
                      style={[styles.categoryItem, postCategory === cat && styles.categoryItemActive]}
                      onPress={() => { setPostCategory(cat); setShowCategoryPicker(false); }}
                    >
                      <Text style={[styles.categoryItemText, postCategory === cat && styles.categoryItemTextActive]}>
                        {cat}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
              <View style={styles.rowInputs}>
                <TextInput
                  style={[styles.modalInput, { flex: 1 }]}
                  placeholder="City"
                  placeholderTextColor={TEXT_TERTIARY}
                  value={postCity}
                  onChangeText={setPostCity}
                />
                <TextInput
                  style={[styles.modalInput, { flex: 1 }]}
                  placeholder="State"
                  placeholderTextColor={TEXT_TERTIARY}
                  value={postState}
                  onChangeText={setPostState}
                />
              </View>
              <Pressable
                style={[styles.submitBtn, (!postTitle.trim() || !postDescription.trim() || postMutation.isPending) && styles.submitBtnDisabled]}
                onPress={submitPost}
                disabled={!postTitle.trim() || !postDescription.trim() || postMutation.isPending}
              >
                {postMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Post Request</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={viewResponsesModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Responses</Text>
              <Pressable onPress={() => setViewResponsesModal(false)}>
                <Ionicons name="close" size={24} color={TEXT_COLOR} />
              </Pressable>
            </View>
            {selectedRequest && (
              <View style={styles.responsesRequestInfo}>
                <Text style={styles.responsesTitle}>{selectedRequest.title}</Text>
                <Text style={styles.responsesCategory}>{selectedRequest.category}</Text>
              </View>
            )}
            <ScrollView style={styles.responsesList}>
              {(selectedRequest?.responses ?? []).length === 0 ? (
                <View style={styles.emptyResponses}>
                  <Ionicons name="chatbubble-ellipses-outline" size={36} color={TEXT_TERTIARY} />
                  <Text style={styles.emptyResponsesText}>No responses yet</Text>
                </View>
              ) : (
                (selectedRequest?.responses ?? []).map((resp) => (
                  <View key={resp.id} style={styles.responseCard}>
                    <View style={styles.responseHeader}>
                      <View style={styles.responseInfo}>
                        <Ionicons name="person-circle-outline" size={24} color={PRIMARY} />
                        <Text style={styles.responseName}>{resp.technicianName}</Text>
                      </View>
                      <Text style={styles.responseTime}>{timeAgo(resp.createdAt)}</Text>
                    </View>
                    <Text style={styles.responseMessage}>{resp.message}</Text>
                    <Pressable
                      style={styles.chatBtn}
                      onPress={() => handleStartChat(resp.technicianId, resp.technicianName)}
                    >
                      <Ionicons name="chatbubble-outline" size={16} color={PRIMARY} />
                      <Text style={styles.chatBtnText}>Start Live Chat</Text>
                    </Pressable>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    color: C.text,
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
  },
  headerSubtitle: {
    color: C.textTertiary,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    marginTop: 4,
  },
  topTabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: SURFACE,
    padding: 4,
  },
  topTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  topTabActive: {
    backgroundColor: 'rgba(0,122,255,0.15)',
  },
  topTabText: {
    color: TEXT_TERTIARY,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  topTabTextActive: {
    color: PRIMARY,
  },
  filtersContainer: {
    marginBottom: 8,
  },
  filtersContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  filterChipActive: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  filterText: {
    color: C.textSecondary,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: C.text,
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
  },
  emptyText: {
    color: C.textTertiary,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  srListContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 12,
  },
  srCard: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  srCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  srCategoryBadge: {
    backgroundColor: 'rgba(0,122,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  srCategoryText: {
    color: PRIMARY,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  srTimeText: {
    color: TEXT_TERTIARY,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  srTitle: {
    color: TEXT_COLOR,
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 6,
  },
  srDescription: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
    marginBottom: 12,
  },
  srFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  srLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  srLocationText: {
    color: TEXT_TERTIARY,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  srCustomerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  srCustomerText: {
    color: TEXT_TERTIARY,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  srActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 12,
  },
  srResponseCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  srResponseCountText: {
    color: PRIMARY,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  srRespondBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: PRIMARY,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  srRespondBtnText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  srViewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: PRIMARY,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  srViewBtnText: {
    color: PRIMARY,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: SURFACE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: TEXT_COLOR,
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
  },
  modalInput: {
    backgroundColor: BG,
    borderRadius: 12,
    padding: 14,
    color: TEXT_COLOR,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 12,
  },
  modalTextArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  respondInput: {
    backgroundColor: BG,
    borderRadius: 12,
    padding: 14,
    color: TEXT_COLOR,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  categorySelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: BG,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 12,
  },
  categorySelectorText: {
    color: TEXT_COLOR,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  categoryList: {
    backgroundColor: BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 12,
    maxHeight: 200,
  },
  categoryItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  categoryItemActive: {
    backgroundColor: 'rgba(0,122,255,0.15)',
  },
  categoryItemText: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  categoryItemTextActive: {
    color: PRIMARY,
    fontFamily: 'Inter_600SemiBold',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  submitBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  responsesRequestInfo: {
    marginBottom: 16,
  },
  responsesTitle: {
    color: TEXT_COLOR,
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 4,
  },
  responsesCategory: {
    color: PRIMARY,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  responsesList: {
    maxHeight: 400,
  },
  emptyResponses: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyResponsesText: {
    color: TEXT_TERTIARY,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  responseCard: {
    backgroundColor: BG,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  responseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  responseInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  responseName: {
    color: TEXT_COLOR,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  responseTime: {
    color: TEXT_TERTIARY,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  responseMessage: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
    marginBottom: 10,
  },
  chatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-end',
    borderWidth: 1,
    borderColor: PRIMARY,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  chatBtnText: {
    color: PRIMARY,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
});
