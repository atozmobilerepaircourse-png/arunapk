import { Linking, Platform } from 'react-native';
import { router } from 'expo-router';

export function openLink(url: string, title?: string) {
  if (!url) return;
  if (url.startsWith('tel:') || url.startsWith('mailto:') || url.startsWith('sms:')) {
    Linking.openURL(url).catch(() => {});
    return;
  }
  // Open all HTTP/HTTPS links inside the app using the live-link screen
  router.push({ pathname: '/live-link', params: { link: url, title: title || 'View Content' } });
}
