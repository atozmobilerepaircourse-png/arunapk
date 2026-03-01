import { Linking, Platform } from 'react-native';
import { router } from 'expo-router';

export function openLink(url: string, title?: string) {
  if (!url) return;
  if (url.startsWith('tel:') || url.startsWith('mailto:') || url.startsWith('sms:')) {
    Linking.openURL(url).catch(() => {});
    return;
  }
  if (Platform.OS === 'web') {
    window.open(url, '_blank');
    return;
  }
  router.push({ pathname: '/webview', params: { url, title: title || '' } });
}
