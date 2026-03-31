import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Platform, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

const RED = '#EF4444';

const INJECTED_JS = `
  (function() {
    // Prevent all navigation within WebView
    document.addEventListener('click', function(e) {
      let target = e.target;
      while (target && target.tagName !== 'A') {
        target = target.parentElement;
      }
      if (target && target.tagName === 'A') {
        const href = target.getAttribute('href');
        if (href && !href.startsWith('javascript:')) {
          e.preventDefault();
          window.ReactNativeWebView.postMessage(JSON.stringify({type: 'link', href: href}));
        }
      }
    }, true);
  })();
`;

export default function LiveLinkScreen() {
  const insets = useSafeAreaInsets();
  const routeParams = useLocalSearchParams<{ link: string; title: string }>();
  
  // Get link and title from route params or URL query params
  let link = routeParams.link;
  let title = routeParams.title;
  
  // On web, also check URL query params
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    link = link || params.get('link') || '';
    title = title || params.get('title') || 'View Content';
  }
  
  const [loading, setLoading] = useState(true);

  if (!link) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </Pressable>
          <Text style={styles.headerTitle}>Live Link</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={RED} />
          <Text style={styles.errorText}>No link available</Text>
        </View>
      </View>
    );
  }

  const isWeb = typeof window !== 'undefined';

  if (isWeb) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>{title || 'Live Session'}</Text>
          <Pressable style={styles.openBtn} onPress={() => window.open(link, '_blank')}>
            <Ionicons name="open-outline" size={20} color={RED} />
          </Pressable>
        </View>
        <View style={{ flex: 1 }}>
          <iframe
            src={link}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              borderRadius: 0,
            }}
            allow="camera; microphone; accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            sandbox="allow-same-origin allow-scripts allow-forms allow-presentation allow-modals"
          />
        </View>
      </View>
    );
  }

  // Mobile: Use WebView
  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'link') {
        // User clicked a link - open it in browser or show dialog
        Alert.alert(
          'Open Link',
          'This will open in your browser',
          [
            { text: 'Cancel', onPress: () => {} },
            { 
              text: 'Open', 
              onPress: () => {
                if (typeof window !== 'undefined') {
                  window.open(data.href, '_blank');
                }
              }
            }
          ]
        );
      }
    } catch (e) {
      console.error('Error parsing WebView message:', e);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{title || 'Live Session'}</Text>
        <View style={{ width: 40 }} />
      </View>
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={RED} />
        </View>
      )}
      <WebView
        source={{ uri: link }}
        style={{ flex: 1 }}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={RED} />
          </View>
        )}
        injectedJavaScript={INJECTED_JS}
        onMessage={handleWebViewMessage}
        allowsFullscreenVideo
        javaScriptEnabled
        domStorageEnabled
        mediaPlaybackRequiresUserAction={false}
        onShouldStartLoadWithRequest={(request) => {
          // Allow loading from same domain, prevent external navigation
          const requestUrl = request.url;
          
          // Always allow initial link
          if (requestUrl === link) return true;
          
          // Allow same-domain requests (images, scripts, styles, etc)
          try {
            const originalDomain = new URL(link).hostname;
            const requestDomain = new URL(requestUrl).hostname;
            
            if (originalDomain === requestDomain) {
              return true;
            }
          } catch (e) {}
          
          // Allow data URLs (images embedded as base64)
          if (requestUrl.startsWith('data:')) return true;
          
          // Block external navigation
          return false;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F2F2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  openBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#000', flex: 1, textAlign: 'center' },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  errorText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#666' },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
