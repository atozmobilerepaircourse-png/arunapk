import { db } from './db';
import { profiles } from '../shared/schema';
import { ne, eq } from 'drizzle-orm';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  badge?: number;
  bigPicture?: string; // Android: image URL
  largeIcon?: string; // Android: small icon
  image?: string; // iOS: image URL
}

async function sendExpoPushNotifications(tokens: string[], message: PushMessage): Promise<void> {
  const validTokens = tokens.filter(t => t && t.startsWith('ExponentPushToken'));
  if (validTokens.length === 0) return;

  const chunkSize = 100;
  for (let i = 0; i < validTokens.length; i += chunkSize) {
    const chunk = validTokens.slice(i, i + chunkSize);
    const messages = chunk.map(token => {
      const msg: any = {
        to: token,
        title: message.title,
        body: message.body,
        data: message.data || {},
        sound: message.sound ?? 'default',
        badge: message.badge ?? 1,
      };
      if (message.image) msg.image = message.image; // iOS
      if (message.bigPicture) msg.bigPicture = message.bigPicture; // Android
      if (message.largeIcon) msg.largeIcon = message.largeIcon; // Android
      return msg;
    });
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });
      const result = await res.json() as any;
      console.log(`[Push] Sent ${chunk.length} notifications, status:`, res.status);
      if (result.errors) {
        console.warn('[Push] Errors:', result.errors);
      }
    } catch (err) {
      console.error('[Push] Send error:', err);
    }
  }
}

export async function notifyAllUsers(message: PushMessage, excludeUserId?: string): Promise<number> {
  try {
    const rows = await db.select({ pushToken: profiles.pushToken }).from(profiles).where(ne(profiles.pushToken, ''));
    const tokens = rows
      .map(r => r.pushToken || '')
      .filter(t => t.startsWith('ExponentPushToken'));
    await sendExpoPushNotifications(tokens, message);
    console.log(`[Push] Broadcast sent to ${tokens.length} users`);
    return tokens.length;
  } catch (err) {
    console.error('[Push] notifyAllUsers error:', err);
    return 0;
  }
}

export async function notifyUser(userId: string, message: PushMessage): Promise<boolean> {
  try {
    const [row] = await db.select({ pushToken: profiles.pushToken }).from(profiles).where(eq(profiles.id, userId));
    if (!row?.pushToken || !row.pushToken.startsWith('ExponentPushToken')) return false;
    await sendExpoPushNotifications([row.pushToken], message);
    return true;
  } catch (err) {
    console.error('[Push] notifyUser error:', err);
    return false;
  }
}

export async function notifyNewPost(postText: string, authorName: string, authorId: string): Promise<void> {
  const preview = postText.length > 60 ? postText.slice(0, 60) + '...' : postText;
  await notifyAllUsers({
    title: `New post by ${authorName}`,
    body: preview || 'Shared a new post',
    data: { type: 'new_post' },
  }, authorId);
}

export async function notifyLiveChat(senderName: string, messageText: string, senderId: string): Promise<void> {
  const preview = messageText.length > 60 ? messageText.slice(0, 60) + '...' : messageText;
  await notifyAllUsers({
    title: `💬 ${senderName} in Live Chat`,
    body: preview || 'Sent a message',
    data: { type: 'live_chat_message' },
  }, senderId);
}
