import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getApiUrl } from './query-client';

// Fully lazy loading of expo-notifications to avoid crashes in Expo Go at module load time
let Notifications: any = null;
const getNotifications = () => {
  if (Platform.OS === 'web') return null;
  if (!Notifications) {
    try {
      Notifications = require('expo-notifications');
      if (Notifications && (Platform.OS === 'ios' || (Platform.OS === 'android' && !Constants.appOwnership?.includes('expo')))) {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: false,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });
      }
    } catch (e) {
      console.warn('Failed to load expo-notifications:', e);
    }
  }
  return Notifications;
};

// Lazy-load expo-av Audio to avoid crashes on devices where it fails to initialize
let AudioLib: any = null;
const getAudio = (): any | null => {
  if (Platform.OS === 'web') return null;
  if (!AudioLib) {
    try {
      const av = require('expo-av');
      AudioLib = av?.Audio ?? null;
    } catch (e) {
      console.warn('[Notification] expo-av load failed:', e);
    }
  }
  return AudioLib;
};

let messageSoundObj: any = null;
let orderSoundObj: any = null;

const MESSAGE_SOUND_URI = 'https://cdn.pixabay.com/audio/2022/12/12/audio_e8c0ecad29.mp3';
const ORDER_SOUND_URI = 'https://cdn.pixabay.com/audio/2022/11/17/audio_f3b9130043.mp3';

async function ensureAudioMode() {
  try {
    const Audio = getAudio();
    if (!Audio?.setAudioModeAsync) return;
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
  } catch {}
}

export async function playMessageSound() {
  try {
    const Audio = getAudio();
    if (!Audio?.Sound?.createAsync) return;
    await ensureAudioMode();
    if (messageSoundObj) {
      await messageSoundObj.replayAsync().catch(() => {});
    } else {
      const { sound } = await Audio.Sound.createAsync(
        { uri: MESSAGE_SOUND_URI },
        { shouldPlay: true, volume: 0.8 }
      );
      messageSoundObj = sound;
    }
  } catch (e) {
    console.warn('[Notification] Message sound error:', e);
  }
}

export async function playOrderSound() {
  try {
    const Audio = getAudio();
    if (!Audio?.Sound?.createAsync) return;
    await ensureAudioMode();
    if (orderSoundObj) {
      await orderSoundObj.replayAsync().catch(() => {});
    } else {
      const { sound } = await Audio.Sound.createAsync(
        { uri: ORDER_SOUND_URI },
        { shouldPlay: true, volume: 1.0 }
      );
      orderSoundObj = sound;
    }
  } catch (e) {
    console.warn('[Notification] Order sound error:', e);
  }
}

export async function showMessageNotification(senderName: string, messageText: string) {
  const Notifs = getNotifications();
  if (!Notifs) return;
  try {
    await Notifs.scheduleNotificationAsync({
      content: {
        title: senderName,
        body: messageText || 'Sent an image',
        sound: true,
      },
      trigger: null,
    });
  } catch (e) {
    console.warn('[Notification] Show message notification error:', e);
  }
}

export async function showOrderNotification(buyerName: string, productTitle: string) {
  const Notifs = getNotifications();
  if (!Notifs) return;
  try {
    await Notifs.scheduleNotificationAsync({
      content: {
        title: 'New Order Received!',
        body: `${buyerName} ordered "${productTitle}"`,
        sound: true,
      },
      trigger: null,
    });
  } catch (e) {
    console.warn('[Notification] Show order notification error:', e);
  }
}

export async function requestNotificationPermission() {
  const Notifs = getNotifications();
  if (!Notifs) return;
  try {
    const { status } = await Notifs.getPermissionsAsync();
    if (status !== 'granted') {
      await Notifs.requestPermissionsAsync();
    }
  } catch {}
}

export async function registerPushToken(userId: string): Promise<void> {
  const Notifs = getNotifications();
  if (Platform.OS === 'web' || !Notifs) {
    console.log('[Push] Skipped (web or no notifications)', { platform: Platform.OS, hasNotifs: !!Notifs });
    return;
  }
  try {
    console.log('[Push] Starting registration for user:', userId);
    const { status: existingStatus } = await Notifs.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifs.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.warn('[Push] Notification permission not granted:', finalStatus);
      return;
    }

    let token: string | undefined;
    try {
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ||
        Constants.easConfig?.projectId ||
        '7be1219b-c06b-4e67-876b-28796859e211';
      const tokenData = await Notifs.getExpoPushTokenAsync({ projectId });
      token = tokenData.data;
    } catch (e1) {
      console.warn('[Push] getExpoPushTokenAsync with projectId failed, trying without:', e1);
      try {
        const tokenData = await Notifs.getExpoPushTokenAsync();
        token = tokenData.data;
      } catch (e2) {
        console.warn('[Push] getExpoPushTokenAsync failed entirely:', e2);
        return;
      }
    }

    if (!token) {
      console.warn('[Push] No token generated');
      return;
    }
    console.log('[Push] Got token:', token.slice(0, 30) + '...');
    const baseUrl = getApiUrl();
    const response = await fetch(`${baseUrl}/api/notifications/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, token }),
    });
    const result = await response.json();
    console.log('[Push] Token registration response:', result);
    console.log('[Push] Token registered for user:', userId);
  } catch (e) {
    console.warn('[Push] Token registration error:', e);
  }
}

export function cleanupSounds() {
  messageSoundObj?.unloadAsync().catch(() => {});
  orderSoundObj?.unloadAsync().catch(() => {});
  messageSoundObj = null;
  orderSoundObj = null;
}
