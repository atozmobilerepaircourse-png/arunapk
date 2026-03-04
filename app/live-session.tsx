import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ActivityIndicator, Linking, Share } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';

const C = Colors.light;

export default function LiveSessionWebView() {
  const { url, title } = useLocalSearchParams<{ url: string; title: string }>();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [webError, setWebError] = useState(false);
  const [progress, setProgress] = useState(0);
  const webViewRef = useRef<any>(null);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const openInBrowser = useCallback(() => {
    if (url) Linking.openURL(url).catch(() => {});
  }, [url]);

  const shareSession = useCallback(async () => {
    try {
      await Share.share({ message: `Join live session: ${title}\n${url}`, title: title || 'Live Session' });
    } catch {}
  }, [url, title]);

  const getEmbedUrl = (rawUrl: string): string => {
    if (!rawUrl) return '';
    try {
      const parsed = new URL(rawUrl);
      if (parsed.hostname.includes('youtube.com') || parsed.hostname.includes('youtu.be')) {
        let videoId = '';
        if (parsed.hostname.includes('youtu.be')) {
          videoId = parsed.pathname.slice(1).split('/')[0];
        } else {
          videoId = parsed.searchParams.get('v') || '';
          if (!videoId && parsed.pathname.includes('/live/')) {
            videoId = parsed.pathname.split('/live/')[1]?.split('/')[0] || '';
          }
        }
        if (videoId) {
          return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
        }
      }
    } catch {}
    return rawUrl;
  };

  if (Platform.OS === 'web') {
    const embedSrc = getEmbedUrl(url || '');
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: topPad + 8 }]}>
          <Pressable hitSlop={12} onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color={C.text} />
          </Pressable>
          <View style={styles.titleWrap}>
            <View style={styles.liveDot} />
            <Text style={styles.headerTitle} numberOfLines={1}>{title || 'Live Session'}</Text>
          </View>
          <Pressable hitSlop={12} onPress={openInBrowser} style={styles.headerBtn}>
            <Ionicons name="open-outline" size={20} color={C.text} />
          </Pressable>
        </View>
        <iframe
          src={embedSrc}
          style={{ flex: 1, border: 'none', width: '100%', height: '100%' } as any}
          allow="camera; microphone; display-capture; autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Pressable hitSlop={12} onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={C.text} />
        </Pressable>
        <View style={styles.titleWrap}>
          <View style={styles.liveDot} />
          <Text style={styles.headerTitle} numberOfLines={1}>{title || 'Live Session'}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <Pressable hitSlop={8} onPress={shareSession} style={styles.headerBtn}>
            <Ionicons name="share-outline" size={20} color={C.text} />
          </Pressable>
          <Pressable hitSlop={8} onPress={openInBrowser} style={styles.headerBtn}>
            <Ionicons name="open-outline" size={20} color={C.text} />
          </Pressable>
          <Pressable hitSlop={8} onPress={() => { setWebError(false); setLoading(true); webViewRef.current?.reload(); }} style={styles.headerBtn}>
            <Ionicons name="refresh" size={20} color={C.text} />
          </Pressable>
        </View>
      </View>

      {loading && !webError && (
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${Math.max(progress * 100, 10)}%` }]} />
        </View>
      )}

      {webError ? (
        <View style={styles.errorContainer}>
          <Ionicons name="globe-outline" size={52} color={C.textTertiary} />
          <Text style={styles.errorTitle}>Couldn't open in app</Text>
          <Text style={styles.errorSub}>This page will open in your browser instead.</Text>
          <Pressable style={styles.openBtn} onPress={openInBrowser}>
            <Ionicons name="open-outline" size={16} color="#FFF" />
            <Text style={styles.openBtnText}>Open in Browser</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} style={{ marginTop: 8 }}>
            <Text style={{ fontSize: 14, color: C.textSecondary }}>Go back</Text>
          </Pressable>
        </View>
      ) : (
        <WebView
          ref={webViewRef}
          source={{ uri: url || '' }}
          style={styles.webview}
          originWhitelist={['*']}
          onLoadStart={() => { setLoading(true); setWebError(false); setProgress(0); }}
          onLoadEnd={() => { setLoading(false); setProgress(1); }}
          onLoadProgress={({ nativeEvent }) => setProgress(nativeEvent.progress)}
          onError={() => { setLoading(false); setWebError(true); }}
          onHttpError={() => setLoading(false)}
          javaScriptEnabled
          domStorageEnabled
          allowsFullscreenVideo
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          startInLoadingState={false}
          scalesPageToFit
          allowsLinkPreview={false}
          mixedContentMode="always"
          cacheEnabled
          cacheMode="LOAD_DEFAULT"
          thirdPartyCookiesEnabled
          sharedCookiesEnabled
          allowsBackForwardNavigationGestures
          userAgent="Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
        />
      )}

      {loading && !webError && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FF3B30" />
          <Text style={styles.loadingText}>Opening live session...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
  },
  headerTitle: {
    color: C.text,
    fontSize: 16,
    fontWeight: '700',
    maxWidth: '80%',
  },
  progressBar: {
    height: 3,
    backgroundColor: '#F0F0F0',
  },
  progressFill: {
    height: 3,
    backgroundColor: '#FF3B30',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: C.textSecondary,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
    backgroundColor: '#FFF',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.text,
    textAlign: 'center',
  },
  errorSub: {
    fontSize: 14,
    color: C.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FF3B30',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  openBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
});
