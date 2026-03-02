/**
 * useNotifications.ts
 *
 * Fetches the current user's notification inbox from Firestore.
 * Features:
 *  - Paginated loading (20 per page)
 *  - Unread count badge
 *  - Mark as read (single + mark all)
 *  - Real-time unread count via Firestore listener
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  doc,
  writeBatch,
  onSnapshot,
  getCountFromServer,
} from '@react-native-firebase/firestore';
import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

import { INotification } from '../interfaces/INotification';

const db = getFirestore();
const PAGE_SIZE = 20;

interface UseNotificationsReturn {
  notifications: INotification[];
  unreadCount: number;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  fetchMore: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useNotifications(currentUserId: string | undefined): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<INotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const lastDocRef = useRef<FirebaseFirestoreTypes.QueryDocumentSnapshot | null>(null);

  // ── Fetch first page ─────────────────────────────────────────────────────

  const fetchNotifications = useCallback(async () => {
    if (!currentUserId) return;
    setLoading(true);
    setError(null);

    try {
      const q = query(
        collection(db, 'Notifications'),
        where('recipientId', '==', currentUserId),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE),
      );

      const snap = await getDocs(q);
      const docs = snap.docs.map((d: any) => d.data() as INotification);

      lastDocRef.current = snap.docs[snap.docs.length - 1] ?? null;
      setHasMore(snap.docs.length === PAGE_SIZE);
      setNotifications(docs);
    } catch (e: any) {
      setError('Failed to load notifications.');
      console.error('[useNotifications] fetchNotifications:', e);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  // ── Fetch more (pagination) ──────────────────────────────────────────────

  const fetchMore = useCallback(async () => {
    if (!currentUserId || !hasMore || loadingMore || !lastDocRef.current) return;
    setLoadingMore(true);

    try {
      const q = query(
        collection(db, 'Notifications'),
        where('recipientId', '==', currentUserId),
        orderBy('createdAt', 'desc'),
        startAfter(lastDocRef.current),
        limit(PAGE_SIZE),
      );

      const snap = await getDocs(q);
      const docs = snap.docs.map((d: any) => d.data() as INotification);

      lastDocRef.current = snap.docs[snap.docs.length - 1] ?? null;
      setHasMore(snap.docs.length === PAGE_SIZE);
      setNotifications(prev => [...prev, ...docs]);
    } catch (e: any) {
      setError('Failed to load more notifications.');
    } finally {
      setLoadingMore(false);
    }
  }, [currentUserId, hasMore, loadingMore]);

  // ── Real-time unread count ────────────────────────────────────────────────

  useEffect(() => {
    if (!currentUserId) return;

    const q = query(
      collection(db, 'Notifications'),
      where('recipientId', '==', currentUserId),
      where('isRead', '==', false),
    );

    const unsub = onSnapshot(q, snap => {
      setUnreadCount(snap.size);
    });

    return unsub;
  }, [currentUserId]);

  // ── Initial fetch ─────────────────────────────────────────────────────────

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // ── Mark single notification as read ─────────────────────────────────────

  const markAsRead = useCallback(async (notificationId: string) => {
    // Optimistic
    setNotifications(prev => prev.map(n => (n.id === notificationId ? { ...n, isRead: true } : n)));

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'Notifications', notificationId), { isRead: true });
      await batch.commit();
    } catch (e) {
      // Roll back
      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, isRead: false } : n)),
      );
    }
  }, []);

  // ── Mark all as read ──────────────────────────────────────────────────────

  const markAllAsRead = useCallback(async () => {
    if (!currentUserId) return;

    // Optimistic
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));

    try {
      const q = query(
        collection(db, 'Notifications'),
        where('recipientId', '==', currentUserId),
        where('isRead', '==', false),
        limit(500), // Firestore batch max is 500
      );

      const snap = await getDocs(q);
      if (snap.empty) return;

      const batch = writeBatch(db);
      snap.docs.forEach((d: any) => {
        batch.update(d.ref, { isRead: true });
      });
      await batch.commit();
    } catch (e) {
      console.error('[useNotifications] markAllAsRead:', e);
    }
  }, [currentUserId]);

  return {
    notifications,
    unreadCount,
    loading,
    loadingMore,
    hasMore,
    error,
    fetchMore,
    markAsRead,
    markAllAsRead,
    refresh: fetchNotifications,
  };
}
