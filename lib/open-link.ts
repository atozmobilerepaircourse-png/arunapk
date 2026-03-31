import { Linking, Platform } from 'react-native';
import { router } from 'expo-router';

export function openLink(url: string, title?: string) {
  if (!url) return;
  if (url.startsWith('tel:') || url.startsWith('mailto:') || url.startsWith('sms:')) {
    Linking.openURL(url).catch(() => {});
    return;
  }
  
  // Always use router.push for consistent in-app navigation
  router.push({ pathname: '/live-link', params: { link: url, title: title || 'View Content' } });
}
