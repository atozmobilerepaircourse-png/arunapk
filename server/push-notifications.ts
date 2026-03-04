import { db } from './db';
import { profiles } from '../shared/schema';
import { ne, eq, and, gt, lt, isNotNull } from 'drizzle-orm';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  badge?: number;
}

async function sendExpoPushNotifications(tokens: string[], message: PushMessage): Promise<void> {
  const validTokens = tokens.filter(t => t && t.startsWith('ExponentPushToken'));
  if (validTokens.length === 0) return;

  const chunkSize = 100;
  for (let i = 0; i < validTokens.length; i += chunkSize) {
    const chunk = validTokens.slice(i, i + chunkSize);
    const messages = chunk.map(token => ({
      to: token,
      title: message.title,
      body: message.body,
      data: message.data || {},
      sound: message.sound ?? 'default',
      badge: message.badge ?? 1,
    }));
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
    const rows = await db.select({ id: profiles.id, pushToken: profiles.pushToken }).from(profiles).where(ne(profiles.pushToken, ''));
    const tokens = rows
      .filter(r => r.id !== excludeUserId)
      .map(r => r.pushToken || '')
      .filter(t => t.startsWith('ExponentPushToken'));
    if (tokens.length === 0) return 0;
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

export async function checkSubscriptionExpiry(): Promise<number> {
  try {
    const now = Date.now();
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    const warningThreshold = now + threeDaysMs;

    const expiringUsers = await db.select({
      id: profiles.id,
      name: profiles.name,
      pushToken: profiles.pushToken,
      subscriptionEnd: profiles.subscriptionEnd,
      subscriptionActive: profiles.subscriptionActive,
    }).from(profiles).where(
      and(
        eq(profiles.subscriptionActive, 1),
        gt(profiles.subscriptionEnd, now),
        lt(profiles.subscriptionEnd, warningThreshold),
        ne(profiles.pushToken, '')
      )
    );

    let notified = 0;
    for (const user of expiringUsers) {
      if (!user.pushToken || !user.pushToken.startsWith('ExponentPushToken')) continue;
      const daysLeft = Math.ceil(((user.subscriptionEnd || 0) - now) / (24 * 60 * 60 * 1000));
      const dayText = daysLeft <= 1 ? 'today' : `in ${daysLeft} days`;
      try {
        await sendExpoPushNotifications([user.pushToken], {
          title: 'Subscription Expiring Soon',
          body: `Your subscription expires ${dayText}. Renew now to keep access.`,
          data: { type: 'subscription_expiry', daysLeft },
        });
        notified++;
      } catch (err) {
        console.warn(`[Push] Failed to notify user ${user.id} about expiry:`, err);
      }
    }

    const expiredUsers = await db.select({
      id: profiles.id,
      pushToken: profiles.pushToken,
      subscriptionEnd: profiles.subscriptionEnd,
      subscriptionActive: profiles.subscriptionActive,
    }).from(profiles).where(
      and(
        eq(profiles.subscriptionActive, 1),
        lt(profiles.subscriptionEnd, now),
        ne(profiles.pushToken, '')
      )
    );

    for (const user of expiredUsers) {
      if (!user.pushToken || !user.pushToken.startsWith('ExponentPushToken')) continue;
      try {
        await sendExpoPushNotifications([user.pushToken], {
          title: 'Subscription Expired',
          body: 'Your subscription has expired. Contact admin to renew.',
          data: { type: 'subscription_expired' },
        });
        notified++;
      } catch (err) {
        console.warn(`[Push] Failed to notify user ${user.id} about expired sub:`, err);
      }
    }

    console.log(`[Push] Subscription expiry check: ${notified} users notified (${expiringUsers.length} expiring, ${expiredUsers.length} expired)`);
    return notified;
  } catch (err) {
    console.error('[Push] checkSubscriptionExpiry error:', err);
    return 0;
  }
}
