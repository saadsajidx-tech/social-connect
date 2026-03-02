import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  writeBatch,
  increment,
  serverTimestamp,
  Timestamp,
} from '@react-native-firebase/firestore';
import { useUser } from './useUser'; // adjust path as needed
import {
  IChat,
  IChatParticipantDetail,
  ILastMessage,
  IMessage,
  IReplyTo,
  IUseChatReturn,
  MessageStatus,
} from '../interfaces/IChat';

// ─── DB instance (obtained once, reused everywhere) ───────────────────────────

const db = getFirestore();

// ─── Typed ref helpers ────────────────────────────────────────────────────────

const chatDocRef = (chatId: string) => doc(db, 'Chats', chatId);
const messagesColRef = (chatId: string) => collection(db, 'Chats', chatId, 'messages');
const userDocRef = (userId: string) => doc(db, 'Users', userId);

// ─── Deterministic chatId ─────────────────────────────────────────────────────

const buildChatId = (uid1: string, uid2: string): string => [uid1, uid2].sort().join('_');

// ─── Firestore-safe sanitiser ─────────────────────────────────────────────────
// Firestore throws "Unsupported field value: undefined" for ANY key whose value
// is undefined — including optional/nested fields. Strip before every write.
// Skips Firestore sentinel values (serverTimestamp, increment, etc.) and
// Timestamp instances (they have a toDate method).

function stripUndefined<T extends Record<string, any>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => {
        if (
          v !== null &&
          typeof v === 'object' &&
          !Array.isArray(v) &&
          typeof v.toDate !== 'function' && // Timestamp
          typeof v.isEqual !== 'function' && // DocumentReference
          !('_methodName' in v) // FieldValue sentinels
        ) {
          return [k, stripUndefined(v)];
        }
        return [k, v];
      }),
  ) as T;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useChat(targetUserId: string): IUseChatReturn {
  const { user: currentUser } = useUser();
  const currentUserId = currentUser?.userId ?? '';

  const chatId = useMemo(
    () => buildChatId(currentUserId, targetUserId),
    [currentUserId, targetUserId],
  );

  // ── State ────────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [chat, setChat] = useState<IChat | null>(null);
  const [targetUser, setTargetUser] = useState<IChatParticipantDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isTargetTyping, setIsTargetTyping] = useState(false);

  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatInitialised = useRef(false);

  // ── Initialise chat document (create on first conversation) ──────────────
  const initialiseChatDoc = useCallback(async () => {
    if (!currentUserId || !targetUserId || chatInitialised.current) return;
    chatInitialised.current = true;

    const ref = chatDocRef(chatId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      const [currentSnap, targetSnap] = await Promise.all([
        getDoc(userDocRef(currentUserId)),
        getDoc(userDocRef(targetUserId)),
      ]);

      const cd = currentSnap.data() ?? {};
      const td = targetSnap.data() ?? {};
      const now = Timestamp.now();

      // Build participant details — stripUndefined handles missing Firestore fields
      const currentDetail = stripUndefined<IChatParticipantDetail>({
        userId: currentUserId,
        displayName: cd.displayName ?? '',
        photoURL: cd.photoURL ?? '',
        isOnline: cd.isOnline ?? false,
        lastSeen: cd.lastSeen ?? null,
      });

      const targetDetail = stripUndefined<IChatParticipantDetail>({
        userId: targetUserId,
        displayName: td.displayName ?? '',
        photoURL: td.photoURL ?? '',
        isOnline: td.isOnline ?? false,
        lastSeen: td.lastSeen ?? null,
      });

      // 'lastMessage' is intentionally OMITTED — Firestore rejects undefined.
      // It will be populated on the first sendMessage call.
      const newChat = {
        chatId,
        participants: [currentUserId, targetUserId],
        participantDetails: {
          [currentUserId]: currentDetail,
          [targetUserId]: targetDetail,
        },
        unreadCount: { [currentUserId]: 0, [targetUserId]: 0 },
        typingStatus: { [currentUserId]: false, [targetUserId]: false },
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(ref, newChat);
    }
  }, [chatId, currentUserId, targetUserId]);

  // ── Listener: chat document ───────────────────────────────────────────────
  useEffect(() => {
    if (!chatId || !currentUserId) return;

    void initialiseChatDoc();

    const unsub = onSnapshot(
      chatDocRef(chatId),
      snap => {
        if (!snap.exists()) return;
        const data = snap.data() as IChat;
        setChat(data);

        const td = data?.participantDetails?.[targetUserId];
        if (td) setTargetUser(td);

        setIsTargetTyping(data?.typingStatus?.[targetUserId] === true);
      },
      err => console.warn('[useChat] chat doc listener:', err),
    );

    return unsub;
  }, [chatId, currentUserId, targetUserId, initialiseChatDoc]);

  // ── Listener: target user document (isOnline / lastSeen) ─────────────────
  useEffect(() => {
    if (!targetUserId || !chatId || !currentUserId) return;

    const unsub = onSnapshot(
      userDocRef(targetUserId),
      async snap => {
        if (!snap.exists()) return;
        const data = snap.data() ?? {};
        const isOnline = Boolean(data.isOnline);

        setTargetUser(prev =>
          prev
            ? { ...prev, isOnline, lastSeen: data.lastSeen ?? prev.lastSeen }
            : {
                userId: targetUserId,
                displayName: data.displayName ?? '',
                photoURL: data.photoURL ?? '',
                isOnline,
                lastSeen: data.lastSeen ?? null,
              },
        );

        // ── Delivered promotion ───────────────────────────────────────────
        // When target comes online promote all MY 'sent' messages → 'delivered'
        if (!isOnline) return;

        try {
          const sentQuery = query(
            messagesColRef(chatId),
            where('senderId', '==', currentUserId),
            where('status', '==', 'sent' as MessageStatus),
          );

          const sentDocs = await new Promise<any[]>((resolve, reject) => {
            const unsubOnce = onSnapshot(
              sentQuery,
              s => {
                unsubOnce();
                resolve(s.docs);
              },
              reject,
            );
          });

          if (sentDocs.length === 0) return;

          const batch = writeBatch(db);
          const now = Timestamp.now();

          sentDocs.forEach(d => {
            batch.update(d.ref, { status: 'delivered' as MessageStatus, updatedAt: now });
          });

          await batch.commit();
        } catch (err) {
          console.warn('[useChat] delivered promotion:', err);
        }
      },
      err => console.warn('[useChat] target user listener:', err),
    );

    return unsub;
  }, [targetUserId, chatId, currentUserId]);

  // ── Listener: messages subcollection ─────────────────────────────────────
  useEffect(() => {
    if (!chatId || !currentUserId) return;

    const msgsQuery = query(messagesColRef(chatId), orderBy('createdAt', 'asc'));

    const unsub = onSnapshot(
      msgsQuery,
      snap => {
        const msgs: IMessage[] = snap.docs.map((d: any) => ({
          ...(d.data() as IMessage),
          messageId: d.id,
        }));
        setMessages(msgs);
        setIsLoading(false);
      },
      err => {
        console.warn('[useChat] messages listener:', err);
        setIsLoading(false);
      },
    );

    return unsub;
  }, [chatId, currentUserId]);

  // ── markAllRead ───────────────────────────────────────────────────────────
  const markAllRead = useCallback(async () => {
    if (!chatId || !currentUserId || !targetUserId) return;

    try {
      const unreadQuery = query(
        messagesColRef(chatId),
        where('senderId', '==', targetUserId),
        where('status', '!=', 'read' as MessageStatus),
      );

      const unreadDocs = await new Promise<any[]>((resolve, reject) => {
        const unsubOnce = onSnapshot(
          unreadQuery,
          s => {
            unsubOnce();
            resolve(s.docs);
          },
          reject,
        );
      });

      if (unreadDocs.length === 0) return;

      const batch = writeBatch(db);
      const now = Timestamp.now();

      unreadDocs.forEach(d => {
        batch.update(d.ref, { status: 'read' as MessageStatus, updatedAt: now });
      });

      batch.update(chatDocRef(chatId), {
        [`unreadCount.${currentUserId}`]: 0,
        updatedAt: now,
      });

      await batch.commit();
    } catch (err) {
      console.warn('[useChat] markAllRead:', err);
    }
  }, [chatId, currentUserId, targetUserId]);

  // ── sendMessage ───────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (text: string, replyTo?: IReplyTo) => {
      const trimmed = text.trim();
      if (!trimmed || !currentUserId || isSending) return;

      setIsSending(true);
      setTypingField(false);

      const targetIsOnline = targetUser?.isOnline ?? false;
      const initialStatus: MessageStatus = targetIsOnline ? 'delivered' : 'sent';

      // ── Optimistic bubble ────────────────────────────────────────────────
      const tempId = `tmp_${Date.now()}`;

      // Build optimistic message — strip undefined so React state stays clean too
      const optimisticMsg = stripUndefined<IMessage>({
        messageId: tempId,
        chatId,
        senderId: currentUserId,
        text: trimmed,
        type: 'text',
        status: 'pending',
        createdAt: null,
        ...(replyTo ? { replyTo } : {}),
      } as IMessage);

      setMessages(prev => [...prev, optimisticMsg]);

      try {
        const newMsgRef = doc(messagesColRef(chatId));

        // Strip undefined from every Firestore payload before writing
        const newMessage = stripUndefined({
          chatId,
          senderId: currentUserId,
          text: trimmed,
          type: 'text',
          status: initialStatus,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          ...(replyTo ? { replyTo } : {}),
        });

        const lastMsg = stripUndefined<ILastMessage>({
          messageId: newMsgRef.id,
          text: trimmed,
          senderId: currentUserId,
          type: 'text',
          createdAt: serverTimestamp() as any,
        });

        const batch = writeBatch(db);

        batch.set(newMsgRef, newMessage);

        batch.update(chatDocRef(chatId), {
          lastMessage: lastMsg,
          [`unreadCount.${targetUserId}`]: increment(1),
          [`typingStatus.${currentUserId}`]: false,
          [`participantDetails.${currentUserId}.isOnline`]: true,
          updatedAt: serverTimestamp(),
        });

        await batch.commit();

        // Real-time listener will add the persisted message; remove the optimistic copy
        setMessages(prev => prev.filter(m => m.messageId !== tempId));
      } catch (err) {
        console.warn('[useChat] sendMessage:', err);
        setMessages(prev => prev.filter(m => m.messageId !== tempId));
      } finally {
        setIsSending(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chatId, currentUserId, targetUserId, targetUser, isSending],
  );

  // ── Typing indicator ──────────────────────────────────────────────────────

  const setTypingField = useCallback(
    (typing: boolean) => {
      if (!chatId || !currentUserId) return;
      if (typingTimer.current) clearTimeout(typingTimer.current);

      updateDoc(chatDocRef(chatId), {
        [`typingStatus.${currentUserId}`]: typing,
      }).catch(() => {});

      if (typing) {
        typingTimer.current = setTimeout(() => {
          updateDoc(chatDocRef(chatId), {
            [`typingStatus.${currentUserId}`]: false,
          }).catch(() => {});
        }, 3000);
      }
    },
    [chatId, currentUserId],
  );

  const setTyping = setTypingField;

  // Clear typing flag when leaving the screen
  useEffect(() => {
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (chatId && currentUserId) {
        updateDoc(chatDocRef(chatId), {
          [`typingStatus.${currentUserId}`]: false,
        }).catch(() => {});
      }
    };
  }, [chatId, currentUserId]);

  // ── Return ────────────────────────────────────────────────────────────────
  return {
    messages,
    chat,
    targetUser,
    isLoading,
    isSending,
    isTargetTyping,
    sendMessage,
    setTyping,
    markAllRead,
  };
}
