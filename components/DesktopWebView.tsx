import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ActivityIndicator } from 'react-native';
import { WebView as RNWebView, WebViewMessageEvent } from 'react-native-webview';
import Colors from '@/constants/colors';

const C = Colors.light;

interface DesktopWebViewProps {
  uri: string;
  onLoad?: () => void;
  onError?: () => void;
  onLoadStart?: () => void;
  style?: any;
}

/**
 * Desktop WebView Component
 * Forces desktop mode with wide viewport and desktop user agent
 */
export default function DesktopWebView({
  uri,
  onLoad,
  onError,
  onLoadStart,
  style,
}: DesktopWebViewProps) {
  const webViewRef = useRef<any>(null);

  // Desktop Chrome user agent
  const desktopUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  // Inject JavaScript to disable mobile-specific CSS and force desktop layout
  const injectedJavaScript = `
(function() {
  // Remove viewport restrictions
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) {
    viewport.setAttribute('content', 'width=1024, initial-scale=0.5, user-scalable=yes');
  }
  
  // Hide mobile-only elements (common patterns)
  const styles = document.createElement('style');
  styles.textContent = \`
    @media (max-width: 768px) {
      [data-mobile-only], .mobile-only, .m-only { display: none !important; }
    }
    body { min-width: 1024px; }
  \`;
  document.head.appendChild(styles);
  
  true;
})();
`;

  return (
    <RNWebView
      ref={webViewRef}
      source={{ uri }}
      style={[styles.webview, style]}
      originWhitelist={['*']}
      onLoadStart={onLoadStart}
      onLoadEnd={onLoad}
      onError={onError}
      onHttpError={onError}
      javaScriptEnabled
      domStorageEnabled
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      startInLoadingState={false}
      scalesPageToFit
      allowsLinkPreview={false}
      mixedContentMode="always"
      userAgent={desktopUserAgent}
      injectedJavaScript={injectedJavaScript}
      injectedJavaScriptBeforeContentLoaded={injectedJavaScript}
      useWebKit
      // Android-specific props for desktop mode
      {...Platform.OS === 'android' && {
        nestedScrollEnabled: true,
        scrollEnabled: true,
      }}
      // iOS-specific props
      {...Platform.OS === 'ios' && {
        scrollEnabled: true,
      }}
    />
  );
}

const styles = StyleSheet.create({
  webview: {
    flex: 1,
    backgroundColor: '#FFF',
  },
});
