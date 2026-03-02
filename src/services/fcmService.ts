/**
 * fcmService.ts — @react-native-firebase v22+ Modular API ONLY
 */

import {
  getMessaging,
  getToken,
  deleteToken,
  onMessage,
  setBackgroundMessageHandler,
  requestPermission,
  AuthorizationStatus,
} from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, AndroidVisibility, EventType } from '@notifee/react-native';
import {
  getFirestore,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';
import { IFCMToken } from '../interfaces/INotification';

const db = getFirestore();
const auth = getAuth();

// ─── Channel IDs ───────────────────────────────────────────────────────────

export const CHANNEL_IDS = {
  LIKES: 'likes_channel',
  COMMENTS: 'comments_channel',
  DEFAULT: 'default_channel',
} as const;

// ─── Create Android Notification Channels ─────────────────────────────────

export async function createNotificationChannels(): Promise<void> {
  await notifee.createChannels([
    {
      id: CHANNEL_IDS.LIKES,
      name: 'Likes',
      description: 'Notifications for post and comment likes',
      importance: AndroidImportance.DEFAULT,
      visibility: AndroidVisibility.PUBLIC,
      sound: 'default',
      vibration: true,
      vibrationPattern: [100, 200, 100, 200], // ✅ all positive
    },
    {
      id: CHANNEL_IDS.COMMENTS,
      name: 'Comments & Replies',
      description: 'Notifications for comments and replies',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      sound: 'default',
      vibration: true,
      vibrationPattern: [100, 300, 100, 300], // ✅ all positive
    },
    {
      id: CHANNEL_IDS.DEFAULT,
      name: 'General',
      description: 'General app notifications',
      importance: AndroidImportance.DEFAULT,
      visibility: AndroidVisibility.PUBLIC,
      sound: 'default',
      vibration: true,
      // no vibrationPattern = system default ✅
    },
  ]);
}

// ─── Request Permissions ───────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  // notifee handles Android 13+ POST_NOTIFICATIONS dialog
  await notifee.requestPermission();

  // messaging permission (required for FCM token)
  const messaging = getMessaging();
  const status = await requestPermission(messaging);

  return status === AuthorizationStatus.AUTHORIZED || status === AuthorizationStatus.PROVISIONAL;
}

// ─── FCM Token ─────────────────────────────────────────────────────────────

export async function saveFCMToken(): Promise<string | null> {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) return null;

    const messaging = getMessaging();
    const token = await getToken(messaging);
    if (!token) return null;

    const tokenId = token.substring(0, 16); // stable per-device doc ID

    const tokenData: IFCMToken = {
      token,
      platform: 'android',
      createdAt: serverTimestamp() as any,
      updatedAt: serverTimestamp() as any,
    };

    await setDoc(doc(db, 'Users', userId, 'fcmTokens', tokenId), tokenData, { merge: true });

    return token;
  } catch (error) {
    console.warn('[fcmService] saveFCMToken failed:', error);
    return null;
  }
}

export async function removeFCMToken(): Promise<void> {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const messaging = getMessaging();
    const token = await getToken(messaging);
    if (!token) return;

    const tokenId = token.substring(0, 16);
    await deleteDoc(doc(db, 'Users', userId, 'fcmTokens', tokenId));
    await deleteToken(messaging);
  } catch (error) {
    console.warn('[fcmService] removeFCMToken failed:', error);
  }
}

// ─── Display Local Notification via notifee ───────────────────────────────

interface DisplayNotifPayload {
  title: string;
  body: string;
  channelId: string;
  data?: Record<string, string>;
}

export async function displayLocalNotification(payload: DisplayNotifPayload): Promise<void> {
  try {
    await notifee.displayNotification({
      title: payload.title,
      body: payload.body,
      android: {
        channelId: payload.channelId,
        smallIcon: 'ic_notification',
        pressAction: { id: 'default' },
        showTimestamp: true,
      },
      data: payload.data,
    });
  } catch (error) {
    console.warn('[fcmService] displayLocalNotification failed:', error);
  }
}

// ─── Map type → channel ────────────────────────────────────────────────────

export function getChannelForType(type: string): string {
  switch (type) {
    case 'like_post':
    case 'like_comment':
      return CHANNEL_IDS.LIKES;
    case 'comment':
    case 'reply':
      return CHANNEL_IDS.COMMENTS;
    default:
      return CHANNEL_IDS.DEFAULT;
  }
}

// ─── FCM Foreground Handler ────────────────────────────────────────────────
// Call inside a useEffect in your authenticated navigator. Returns unsubscribe.

export function setupFCMForegroundHandler(): () => void {
  const messaging = getMessaging();

  const unsubscribe = onMessage(messaging, async remoteMessage => {
    const { notification, data } = remoteMessage;
    if (!notification?.title || !notification?.body) return;

    await displayLocalNotification({
      title: notification.title,
      body: notification.body,
      channelId: getChannelForType((data?.type as string) ?? ''),
      data: data as Record<string, string>,
    });
  });

  return unsubscribe;
}

// ─── FCM Background Handler ────────────────────────────────────────────────
// Call at the TOP of index.js, outside AppRegistry. Never inside a component.

export function registerFCMBackgroundHandler(): void {
  const messaging = getMessaging();

  setBackgroundMessageHandler(messaging, async remoteMessage => {
    const { notification, data } = remoteMessage;
    if (!notification?.title || !notification?.body) return;

    await displayLocalNotification({
      title: notification.title,
      body: notification.body,
      channelId: getChannelForType((data?.type as string) ?? ''),
      data: data as Record<string, string>,
    });
  });
}

// ─── Notifee Press Event (foreground) ─────────────────────────────────────
// Call inside a useEffect. Returns unsubscribe.

export function setupNotifeeEventHandler(
  onPress: (data: Record<string, string | undefined>) => void,
): () => void {
  return notifee.onForegroundEvent(({ type, detail }) => {
    if (type === EventType.PRESS) {
      const data = detail.notification?.data as Record<string, string | undefined>;
      if (data) onPress(data);
    }
  });
}

// ─── Notifee Background Handler ───────────────────────────────────────────
// Call at the TOP of index.js. Never inside a component.

export function registerNotifeeBackgroundHandler(
  onPress: (data: Record<string, string | undefined>) => void,
): void {
  notifee.onBackgroundEvent(async ({ type, detail }) => {
    if (type === EventType.PRESS) {
      const data = detail.notification?.data as Record<string, string | undefined>;
      if (data) onPress(data);
    }
  });
}
