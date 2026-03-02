import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

// ─── Notification Types ────────────────────────────────────────────────────

export type NotificationType =
  | 'like_post' // Someone liked your post
  | 'like_comment' // Someone liked your comment
  | 'comment' // Someone commented on your post
  | 'reply'; // Someone replied to your comment

// ─── Firestore Document ────────────────────────────────────────────────────

export interface INotification {
  id: string;
  type: NotificationType;

  // Who receives this notification
  recipientId: string;

  // Who triggered this notification
  senderId: string;
  senderDisplayName: string;
  senderPhotoURL?: string | null;

  // Context references
  postId?: string;
  commentId?: string;

  // Display message — pre-built on write e.g. "Saad liked your post"
  message: string;

  // State
  isRead: boolean;

  createdAt: FirebaseFirestoreTypes.Timestamp;
}

// ─── RTDB Signal (lightweight ping for real-time delivery) ─────────────────
// Written to: /signals/{recipientUserId}/{notificationId}
// Deleted after read to keep RTDB clean

export interface IRTDBSignal {
  notificationId: string; // Firestore doc ID — client fetches full data from FS
  type: NotificationType;
  senderId: string;
  senderDisplayName: string;
  senderPhotoURL?: string | null;
  postId?: string;
  message: string;
  createdAt: number; // unix ms — RTDB uses numbers not Timestamps
}

// ─── FCM Token Document ────────────────────────────────────────────────────
// Stored at: users/{userId}/fcmTokens/{tokenId}

export interface IFCMToken {
  token: string;
  platform: 'android';
  createdAt: FirebaseFirestoreTypes.Timestamp;
  updatedAt: FirebaseFirestoreTypes.Timestamp;
}

// ─── Notification Preferences (mirrors IUser.preferences.notifications) ────

export interface INotificationPreferences {
  enabled: boolean;
  likes: boolean;
  comments: boolean;
  sound: string; // 'default' | 'chime' | 'ping' | 'pulse' | 'none'
  vibration: boolean;
  quietHours: {
    enabled: boolean;
    start: string; // 'HH:mm' e.g. '22:00'
    end: string; // 'HH:mm' e.g. '07:00'
  };
}

export const DEFAULT_NOTIFICATION_PREFS: INotificationPreferences = {
  enabled: true,
  likes: true,
  comments: true,
  sound: 'default',
  vibration: true,
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '07:00',
  },
};
