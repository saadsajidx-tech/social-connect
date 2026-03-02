import { AppState, AppStateStatus } from 'react-native';
import { useEffect, useRef } from 'react';
import {
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  getFirestore,
} from '@react-native-firebase/firestore';
import { IUser } from '../interfaces/IUser';

const HEARTBEAT_INTERVAL = 30_000; // 30s

export function useActiveUserPresence(user?: IUser) {
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const db = getFirestore();

  useEffect(() => {
    if (!user?.userId) return;

    const activeUserRef = doc(db, 'ActiveUsers', user.userId);
    const userRef = doc(db, 'Users', user.userId);

    const setOnline = async () => {
      try {
        const timestamp = serverTimestamp();
        await setDoc(
          activeUserRef,
          { lastSeen: timestamp, isOnline: true, userId: user.userId },
          { merge: true },
        );
        await updateDoc(userRef, { lastSeen: timestamp, isOnline: true });
      } catch (e) {
        console.warn('[Presence] heartbeat failed:', e);
      }
    };

    const setOffline = async () => {
      try {
        const timestamp = serverTimestamp();
        await updateDoc(activeUserRef, { lastSeen: timestamp, isOnline: false });
        await updateDoc(userRef, { lastSeen: timestamp, isOnline: false });
      } catch (e) {
        console.warn('[Presence] setOffline failed:', e);
      }
    };

    const stopHeartbeat = () => {
      if (heartbeatRef.current !== null) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };

    const startHeartbeat = () => {
      stopHeartbeat();
      void setOnline();
      heartbeatRef.current = setInterval(() => void setOnline(), HEARTBEAT_INTERVAL);
    };

    startHeartbeat();

    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      const prev = appState.current;
      appState.current = next;

      if (next === 'background') {
        stopHeartbeat();
        void setOffline();
      } else if (next === 'active' && prev !== 'active') {
        startHeartbeat();
      }
    });

    return () => {
      stopHeartbeat();
      void setOffline();
      subscription.remove();
    };
  }, [user?.userId]);
}
