import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LiveSessionWebView() {
  const { url, title } = useLocalSearchParams<{ url: string; title: string }>();
  const insets = useSafeAreaInsets();
  
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{title || 'Live Session'}</Text>
        <View style={{ width: 40 }} />
      </View>
      
      {Platform.OS === 'web' ? (
        <iframe 
          src={url} 
          style={{ flex: 1, border: 'none' }} 
          allow="camera; microphone; display-capture; autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        />
      ) : (
        <WebView 
          source={{ uri: url }} 
          style={{ flex: 1 }}
          allowsFullscreenVideo
          allowsInlineMediaPlayback
          javaScriptEnabled
          domStorageEnabled
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backBtn: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 12,
  },
});
