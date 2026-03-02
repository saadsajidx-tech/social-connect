/**
 * notificationService.ts
 *
 * Handles writing notifications to:
 *  - Firestore  → persistent storage / notification inbox
 *  - RTDB       → low-latency real-time signal (triggers notifee while app is alive)
 *
 * NOTE: This is called CLIENT-SIDE from toggleLike / submitComment / submitReply.
 * No Cloud Functions needed — works on Firebase Spark plan.
 */

import {
  getFirestore,
  doc,
  collection,
  setDoc,
  serverTimestamp,
  getDoc,
} from '@react-native-firebase/firestore';
import { getDatabase, ref, set } from '@react-native-firebase/database';
import { INotification, IRTDBSignal, NotificationType } from '../interfaces/INotification';

const db = getFirestore();
const rtdb = getDatabase(
  undefined,
  'https://socialconnect-a8f32-default-rtdb.asia-southeast1.firebasedatabase.app',
);
// ─── Collection references ─────────────────────────────────────────────────

const notifCol = () => collection(db, 'Notifications');
const userDoc = (uid: string) => doc(db, 'Users', uid);

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Checks the recipient's notification preferences before sending.
 * Respects: master toggle, per-type toggle, quiet hours.
 */
async function recipientWantsNotification(
  recipientId: string,
  type: NotificationType,
): Promise<boolean> {
  try {
    const snap = await getDoc(userDoc(recipientId));
    if (!snap.exists()) return true; // fail-open

    const prefs = snap.data()?.preferences?.notifications;
    if (!prefs) return true;

    // Master toggle
    if (prefs.enabled === false) return false;

    // Per-type
    if ((type === 'like_post' || type === 'like_comment') && prefs.likes === false) return false;
    if ((type === 'comment' || type === 'reply') && prefs.comments === false) return false;

    // Quiet hours
    if (prefs.quietHours?.enabled) {
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      const [startH, startM] = (prefs.quietHours.start as string).split(':').map(Number);
      const [endH, endM] = (prefs.quietHours.end as string).split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      // Handles overnight ranges e.g. 22:00 → 07:00
      const inQuiet =
        startMinutes > endMinutes
          ? nowMinutes >= startMinutes || nowMinutes < endMinutes
          : nowMinutes >= startMinutes && nowMinutes < endMinutes;

      if (inQuiet) return false;
    }

    return true;
  } catch {
    return true; // fail-open — don't block the main action
  }
}

// ─── Core writer ───────────────────────────────────────────────────────────

interface SendNotificationPayload {
  type: NotificationType;
  recipientId: string;
  senderId: string;
  senderDisplayName: string;
  senderPhotoURL?: string | null;
  postId?: string;
  commentId?: string;
  message: string;
}

/**
 * Writes one notification to Firestore + RTDB signal.
 * Always call this AFTER the main write (like/comment batch) has committed.
 */
// ─── Utility: remove all undefined values Firestore/RTDB reject them ──────
function stripUndefined(obj: Record<string, any>): Record<string, any> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

// ─── Core writer ───────────────────────────────────────────────────────────
export async function sendNotification(payload: SendNotificationPayload): Promise<void> {
  if (payload.recipientId === payload.senderId) return;

  const allowed = await recipientWantsNotification(payload.recipientId, payload.type);
  if (!allowed) return;

  try {
    const notifRef = doc(notifCol());
    const notifId = notifRef.id;
    console.log('true payload', payload);
    // ── 1. Firestore ─────────────────────────────────────────────────────
    await setDoc(
      notifRef,
      stripUndefined({
        id: notifId,
        type: payload.type,
        recipientId: payload.recipientId,
        senderId: payload.senderId,
        senderDisplayName: payload.senderDisplayName,
        senderPhotoURL: payload.senderPhotoURL ?? null, // null is valid, undefined is not
        postId: payload.postId,
        commentId: payload.commentId,
        message: payload.message,
        isRead: false,
        createdAt: serverTimestamp(),
      }),
    );

    // ── 2. RTDB signal ───────────────────────────────────────────────────
    await set(
      ref(rtdb, `signals/${payload.recipientId}/${notifId}`),
      stripUndefined({
        notificationId: notifId,
        type: payload.type,
        senderId: payload.senderId,
        senderDisplayName: payload.senderDisplayName,
        senderPhotoURL: payload.senderPhotoURL ?? null,
        postId: payload.postId,
        message: payload.message,
        createdAt: Date.now(),
      }),
    );
  } catch (error) {
    console.warn('[notificationService] sendNotification failed silently:', error);
    console.warn('Error case', payload, 'its error', error);
  }
}

// ─── Convenience wrappers ──────────────────────────────────────────────────

export async function sendLikePostNotification(params: {
  recipientId: string;
  senderId: string;
  senderDisplayName: string;
  senderPhotoURL?: string | null;
  postId: string;
}): Promise<void> {
  return sendNotification({
    type: 'like_post',
    recipientId: params.recipientId,
    senderId: params.senderId,
    senderDisplayName: params.senderDisplayName,
    senderPhotoURL: params.senderPhotoURL,
    postId: params.postId,
    message: `${params.senderDisplayName} liked your post`,
  });
}

export async function sendLikeCommentNotification(params: {
  recipientId: string;
  senderId: string;
  senderDisplayName: string;
  senderPhotoURL?: string | null;
  postId: string;
  commentId: string;
}): Promise<void> {
  return sendNotification({
    type: 'like_comment',
    recipientId: params.recipientId,
    senderId: params.senderId,
    senderDisplayName: params.senderDisplayName,
    senderPhotoURL: params.senderPhotoURL,
    postId: params.postId,
    commentId: params.commentId,
    message: `${params.senderDisplayName} liked your comment`,
  });
}

export async function sendCommentNotification(params: {
  recipientId: string;
  senderId: string;
  senderDisplayName: string;
  senderPhotoURL?: string | null;
  postId: string;
  commentId: string;
}): Promise<void> {
  return sendNotification({
    type: 'comment',
    recipientId: params.recipientId,
    senderId: params.senderId,
    senderDisplayName: params.senderDisplayName,
    senderPhotoURL: params.senderPhotoURL,
    postId: params.postId,
    commentId: params.commentId,
    message: `${params.senderDisplayName} commented on your post`,
  });
}

export async function sendReplyNotification(params: {
  recipientId: string;
  senderId: string;
  senderDisplayName: string;
  senderPhotoURL?: string | null;
  postId: string;
  commentId: string;
}): Promise<void> {
  return sendNotification({
    type: 'reply',
    recipientId: params.recipientId,
    senderId: params.senderId,
    senderDisplayName: params.senderDisplayName,
    senderPhotoURL: params.senderPhotoURL,
    postId: params.postId,
    commentId: params.commentId,
    message: `${params.senderDisplayName} replied to your comment`,
  });
}
