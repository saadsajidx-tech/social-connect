/**
 * useRTDBNotificationListener.ts
 *
 * Listens to RTDB /signals/{currentUserId}
 * When a signal arrives:
 *  1. Shows a local notifee notification
 *  2. Deletes the signal from RTDB (keep RTDB lean)
 *
 * This works for FOREGROUND and BACKGROUND states.
 * For terminated state → FCM push from your server is needed.
 *
 * Mount this hook inside your authenticated root navigator or AppNavigator.
 */

import { useEffect } from 'react';
import { getDatabase, ref, onChildAdded, remove } from '@react-native-firebase/database';
import { displayLocalNotification, getChannelForType } from '../services/fcmService';
import { IRTDBSignal } from '../interfaces/INotification';

const rtdb = getDatabase(
  undefined,
  'https://socialconnect-a8f32-default-rtdb.asia-southeast1.firebasedatabase.app',
);
/**
 * @param currentUserId — the logged-in user's UID
 * @param enabled — pass false to pause listening (e.g. user disabled notifs)
 */
export function useRTDBNotificationListener(
  currentUserId: string | undefined,
  enabled: boolean = true,
): void {
  useEffect(() => {
    if (!currentUserId || !enabled) return;

    const signalsRef = ref(rtdb, `signals/${currentUserId}`);

    // onChildAdded fires for each new child AND existing children on mount.
    // We use a timestamp gate to ignore stale signals.
    const mountTime = Date.now();

    const unsubscribe = onChildAdded(signalsRef, async snapshot => {
      if (!snapshot.exists()) return;

      const signal = snapshot.val() as IRTDBSignal;
      const signalKey = snapshot.key;

      // Skip signals older than 30 seconds (stale from before app opened)
      if (!signal.createdAt || Date.now() - signal.createdAt > 30_000) {
        // Still clean up stale signals
        if (signalKey) {
          await remove(ref(rtdb, `signals/${currentUserId}/${signalKey}`)).catch(() => {});
        }
        return;
      }

      // Only process signals that arrived AFTER this hook mounted
      if (signal.createdAt < mountTime) {
        if (signalKey) {
          await remove(ref(rtdb, `signals/${currentUserId}/${signalKey}`)).catch(() => {});
        }
        return;
      }

      // 1. Show local notification
      await displayLocalNotification({
        title: 'SocialConnect',
        body: signal.message,
        channelId: getChannelForType(signal.type),
        data: {
          type: signal.type,
          notificationId: signal.notificationId,
          senderId: signal.senderId,
          postId: signal.postId ?? '',
        },
      });

      // 2. Delete signal from RTDB — prevents re-showing on app restart
      if (signalKey) {
        await remove(ref(rtdb, `signals/${currentUserId}/${signalKey}`)).catch(() => {});
      }
    });

    return () => {
      unsubscribe();
    };
  }, [currentUserId, enabled]);
}
