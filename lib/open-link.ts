import { Linking, Platform } from 'react-native';
import { router } from 'expo-router';

export function openLink(url: string, title?: string) {
  if (!url) return;
  if (url.startsWith('tel:') || url.startsWith('mailto:') || url.startsWith('sms:')) {
    Linking.openURL(url).catch(() => {});
    return;
  }
  
  // On web, use direct navigation to /live-link with URL parameters
  if (typeof window !== 'undefined' && Platform.OS === 'web') {
    const params = new URLSearchParams({
      link: url,
      title: title || 'View Content'
    });
    window.location.href = `/live-link?${params.toString()}`;
    return;
  }
  
  // On mobile, use router.push
  router.push({ pathname: '/live-link', params: { link: url, title: title || 'View Content' } });
}
