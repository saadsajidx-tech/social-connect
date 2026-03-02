import { useCallback, useRef, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  where,
  writeBatch,
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import { IUser } from '../interfaces/IUser';
import { ICommentWithUser, IUseCommentsReturn } from '../interfaces/IPostInteractions';
import { ReportReason } from '../interfaces/IReport';
import {
  sendCommentNotification,
  sendLikeCommentNotification,
  sendReplyNotification,
} from '../services/notificationService';

// ─── Raw Firestore document shape ─────────────────────────────────────────────
// Typed so every snap.docs.map callback gets a concrete type for `d`,
// eliminating the implicit `any` TypeScript error on d.data().

interface IRawComment {
  commentId: string;
  postId: string;
  userId: string;
  text: string;
  parentCommentId: string | null;
  likesCount: number;
  repliesCount: number;
  isEdited: boolean;
  createdAt: FirebaseFirestoreTypes.Timestamp;
  updatedAt: FirebaseFirestoreTypes.Timestamp;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;
const REPLY_PAGE_SIZE = 10;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useComments = (
  postId: string,
  postAuthorId: string,
  currentUser: IUser,
  onCommentCountChange?: (delta: number) => void,
): IUseCommentsReturn => {
  const db = getFirestore();
  const commentsCol = collection(db, 'Comments');
  const commentLikesCol = collection(db, 'CommentLikes');
  const usersCol = collection(db, 'Users');
  const postsCol = collection(db, 'Posts');
  const reportsCol = collection(db, 'Reports');

  // ── State ──────────────────────────────────────────────────────────────────

  const [comments, setComments] = useState<ICommentWithUser[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [loadingMoreComments, setLoadingMoreComments] = useState(false);
  const [hasMoreComments, setHasMoreComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ICommentWithUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lastDocRef = useRef<FirebaseFirestoreTypes.QueryDocumentSnapshot | null>(null);

  // ── Internal: hydrate a raw Firestore comment with user profile data ───────

  const hydrateComment = useCallback(
    async (commentData: IRawComment, likedSet: Set<string>): Promise<ICommentWithUser> => {
      const userSnap = await getDoc(doc(usersCol, commentData.userId));
      const u = userSnap.exists() ? (userSnap.data() as IUser) : null;

      return {
        ...commentData,
        id: commentData.commentId,
        createdAt: commentData.createdAt?.toDate?.() ?? new Date(),
        updatedAt: commentData.updatedAt?.toDate?.() ?? new Date(),
        isLiked: likedSet.has(commentData.commentId),
        user: {
          userId: commentData.userId,
          displayName: u?.displayName ?? 'Unknown',
          photoURL: u?.photoURL,
          isVerified: u?.isVerified,
        },
        replies: [],
        hasMoreReplies: (commentData.repliesCount ?? 0) > 0,
        loadingReplies: false,
      };
    },
    [],
  );

  /**
   * Batch-check which comments the current user has already liked.
   * Deterministic IDs: {commentId}_{userId} → O(1) per check, no query.
   */
  const fetchLikedSet = useCallback(
    async (commentIds: string[]): Promise<Set<string>> => {
      if (!commentIds.length) return new Set();
      const results = await Promise.all(
        commentIds.map(cid =>
          getDoc(doc(commentLikesCol, `${cid}_${currentUser.userId}`))
            .then(s => (s.exists() ? cid : null))
            .catch(() => null),
        ),
      );
      return new Set(results.filter(Boolean) as string[]);
    },
    [currentUser.userId],
  );

  // ── loadComments ───────────────────────────────────────────────────────────

  const loadComments = useCallback(async () => {
    if (!postId) return;
    setLoadingComments(true);
    setError(null);

    try {
      const snap = (await getDocs(
        query(
          commentsCol,
          where('postId', '==', postId),
          where('parentCommentId', '==', null),
          orderBy('createdAt', 'desc'),
          limit(PAGE_SIZE),
        ),
      )) as FirebaseFirestoreTypes.QuerySnapshot<IRawComment>;

      lastDocRef.current = snap.docs[snap.docs.length - 1] ?? null;
      setHasMoreComments(snap.docs.length === PAGE_SIZE);

      const rawIds = snap.docs.map(
        (d: FirebaseFirestoreTypes.QueryDocumentSnapshot<IRawComment>) => d.data().commentId,
      );
      const likedSet = await fetchLikedSet(rawIds);

      const hydrated = await Promise.all(
        snap.docs.map((d: FirebaseFirestoreTypes.QueryDocumentSnapshot<IRawComment>) =>
          hydrateComment(d.data(), likedSet),
        ),
      );

      setComments(hydrated);
    } catch (e: any) {
      console.error('[useComments] loadComments:', e);
      setError('Failed to load comments.');
    } finally {
      setLoadingComments(false);
    }
  }, [postId, fetchLikedSet, hydrateComment]);

  // ── loadMoreComments ───────────────────────────────────────────────────────

  const loadMoreComments = useCallback(async () => {
    if (!hasMoreComments || loadingMoreComments || !lastDocRef.current) return;
    setLoadingMoreComments(true);

    try {
      const snap = (await getDocs(
        query(
          commentsCol,
          where('postId', '==', postId),
          where('parentCommentId', '==', null),
          orderBy('createdAt', 'desc'),
          startAfter(lastDocRef.current),
          limit(PAGE_SIZE),
        ),
      )) as FirebaseFirestoreTypes.QuerySnapshot<IRawComment>;

      lastDocRef.current = snap.docs[snap.docs.length - 1] ?? lastDocRef.current;
      setHasMoreComments(snap.docs.length === PAGE_SIZE);

      const rawIds = snap.docs.map(
        (d: FirebaseFirestoreTypes.QueryDocumentSnapshot<IRawComment>) => d.data().commentId,
      );
      const likedSet = await fetchLikedSet(rawIds);

      const hydrated = await Promise.all(
        snap.docs.map((d: FirebaseFirestoreTypes.QueryDocumentSnapshot<IRawComment>) =>
          hydrateComment(d.data(), likedSet),
        ),
      );

      setComments(prev => [...prev, ...hydrated]);
    } catch (e: any) {
      console.error('[useComments] loadMoreComments:', e);
      setError('Failed to load more comments.');
    } finally {
      setLoadingMoreComments(false);
    }
  }, [postId, hasMoreComments, loadingMoreComments, fetchLikedSet, hydrateComment]);

  // ── loadReplies ────────────────────────────────────────────────────────────

  const loadReplies = useCallback(
    async (parentCommentId: string) => {
      setComments(prev =>
        prev.map(c => (c.id === parentCommentId ? { ...c, loadingReplies: true } : c)),
      );

      try {
        const snap = (await getDocs(
          query(
            commentsCol,
            where('postId', '==', postId),
            where('parentCommentId', '==', parentCommentId),
            orderBy('createdAt', 'asc'),
            limit(REPLY_PAGE_SIZE),
          ),
        )) as FirebaseFirestoreTypes.QuerySnapshot<IRawComment>;

        const replyIds = snap.docs.map(
          (d: FirebaseFirestoreTypes.QueryDocumentSnapshot<IRawComment>) => d.data().commentId,
        );
        const likedSet = await fetchLikedSet(replyIds);

        const replies = await Promise.all(
          snap.docs.map((d: FirebaseFirestoreTypes.QueryDocumentSnapshot<IRawComment>) =>
            hydrateComment(d.data(), likedSet),
          ),
        );

        setComments(prev =>
          prev.map(c =>
            c.id === parentCommentId
              ? {
                  ...c,
                  replies,
                  loadingReplies: false,
                  hasMoreReplies: snap.docs.length === REPLY_PAGE_SIZE,
                }
              : c,
          ),
        );
      } catch (e: any) {
        console.error('[useComments] loadReplies:', e);
        setComments(prev =>
          prev.map(c => (c.id === parentCommentId ? { ...c, loadingReplies: false } : c)),
        );
      }
    },
    [postId, fetchLikedSet, hydrateComment],
  );

  // ── submitComment ──────────────────────────────────────────────────────────

  const submitComment = useCallback(
    async (text: string): Promise<boolean> => {
      const trimmed = text.trim();
      if (!trimmed) return false;

      setSubmittingComment(true);
      setError(null);

      const tempId = `temp_${Date.now()}`;
      const optimistic: ICommentWithUser = {
        id: tempId,
        commentId: tempId,
        postId,
        userId: currentUser.userId,
        text: trimmed,
        parentCommentId: null,
        likesCount: 0,
        repliesCount: 0,
        isEdited: false,
        isLiked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          userId: currentUser.userId,
          displayName: currentUser.displayName,
          photoURL: currentUser.photoURL,
          isVerified: currentUser.isVerified,
        },
        replies: [],
        hasMoreReplies: false,
        loadingReplies: false,
      };

      setComments(prev => [optimistic, ...prev]);

      try {
        const now = serverTimestamp();
        const commentRef = doc(commentsCol);
        const commentId = commentRef.id;
        const batch = writeBatch(db);

        batch.set(commentRef, {
          commentId,
          postId,
          userId: currentUser.userId,
          text: trimmed,
          parentCommentId: null,
          likesCount: 0,
          repliesCount: 0,
          isEdited: false,
          createdAt: now,
          updatedAt: now,
        });

        batch.update(doc(postsCol, postId), {
          commentsCount: increment(1),
          updatedAt: now,
        });

        await batch.commit();

        // Fire-and-forget — writes Firestore notification + RTDB signal
        sendCommentNotification({
          recipientId: postAuthorId,
          senderId: currentUser.userId,
          senderDisplayName: currentUser.displayName,
          senderPhotoURL: currentUser.photoURL ?? null,
          postId,
          commentId,
        });

        // ✓ Callback: Update post comment count in real-time
        onCommentCountChange?.(1);

        setComments(prev =>
          prev.map(c =>
            c.id === tempId
              ? { ...optimistic, id: commentId, commentId, createdAt: new Date() }
              : c,
          ),
        );

        setSubmittingComment(false);
        return true;
      } catch (e: any) {
        console.error('[useComments] submitComment:', e);
        setComments(prev => prev.filter(c => c.id !== tempId));
        setError('Failed to post comment.');
        setSubmittingComment(false);
        return false;
      }
    },
    [postId, postAuthorId, currentUser, onCommentCountChange],
  );

  // ── submitReply ────────────────────────────────────────────────────────────

  const submitReply = useCallback(
    async (parentCommentId: string, text: string): Promise<boolean> => {
      const trimmed = text.trim();
      if (!trimmed) return false;

      setSubmittingComment(true);
      setError(null);

      const tempId = `temp_reply_${Date.now()}`;
      const optimisticReply: ICommentWithUser = {
        id: tempId,
        commentId: tempId,
        postId,
        userId: currentUser.userId,
        text: trimmed,
        parentCommentId,
        likesCount: 0,
        repliesCount: 0,
        isEdited: false,
        isLiked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          userId: currentUser.userId,
          displayName: currentUser.displayName,
          photoURL: currentUser.photoURL,
          isVerified: currentUser.isVerified,
        },
      };

      setComments(prev =>
        prev.map(c =>
          c.id === parentCommentId
            ? {
                ...c,
                repliesCount: c.repliesCount + 1,
                replies: [...(c.replies ?? []), optimisticReply],
              }
            : c,
        ),
      );

      try {
        const now = serverTimestamp();
        const replyRef = doc(commentsCol);
        const replyId = replyRef.id;

        const parentSnap = await getDoc(doc(commentsCol, parentCommentId));
        const parentAuthorId = parentSnap.exists()
          ? (parentSnap.data() as IRawComment).userId
          : null;

        const batch = writeBatch(db);

        batch.set(replyRef, {
          commentId: replyId,
          postId,
          userId: currentUser.userId,
          text: trimmed,
          parentCommentId,
          likesCount: 0,
          repliesCount: 0,
          isEdited: false,
          createdAt: now,
          updatedAt: now,
        });

        batch.update(doc(commentsCol, parentCommentId), {
          repliesCount: increment(1),
          updatedAt: now,
        });

        batch.update(doc(postsCol, postId), {
          commentsCount: increment(1),
          updatedAt: now,
        });

        await batch.commit();

        // Fire-and-forget
        if (parentAuthorId) {
          sendReplyNotification({
            recipientId: parentAuthorId,
            senderId: currentUser.userId,
            senderDisplayName: currentUser.displayName,
            senderPhotoURL: currentUser.photoURL ?? null,
            postId,
            commentId: replyId,
          });
        }
        // ✓ Callback: Update post comment count in real-time
        onCommentCountChange?.(1);

        setComments(prev =>
          prev.map(c =>
            c.id === parentCommentId
              ? {
                  ...c,
                  replies: (c.replies ?? []).map(r =>
                    r.id === tempId
                      ? {
                          ...optimisticReply,
                          id: replyId,
                          commentId: replyId,
                          createdAt: new Date(),
                        }
                      : r,
                  ),
                }
              : c,
          ),
        );

        setReplyingTo(null);
        setSubmittingComment(false);
        return true;
      } catch (e: any) {
        console.error('[useComments] submitReply:', e);
        setComments(prev =>
          prev.map(c =>
            c.id === parentCommentId
              ? {
                  ...c,
                  repliesCount: Math.max(0, c.repliesCount - 1),
                  replies: (c.replies ?? []).filter(r => r.id !== tempId),
                }
              : c,
          ),
        );
        setError('Failed to post reply.');
        setSubmittingComment(false);
        return false;
      }
    },
    [postId, currentUser, onCommentCountChange],
  );

  // ── toggleCommentLike ──────────────────────────────────────────────────────

  const toggleCommentLike = useCallback(
    async (commentId: string) => {
      // Find comment — could be top-level or a reply
      let isReply = false;
      let parentId: string | null = null;
      let currentComment: ICommentWithUser | undefined;

      for (const c of comments) {
        if (c.id === commentId) {
          currentComment = c;
          break;
        }
        const reply = c.replies?.find(r => r.id === commentId);
        if (reply) {
          currentComment = reply;
          isReply = true;
          parentId = c.id;
          break;
        }
      }

      if (!currentComment) return;

      const wasLiked = currentComment.isLiked ?? false;
      const likeDocId = `${commentId}_${currentUser.userId}`;

      const patchComment = (c: ICommentWithUser): ICommentWithUser =>
        c.id === commentId
          ? {
              ...c,
              isLiked: !wasLiked,
              likesCount: wasLiked ? Math.max(0, c.likesCount - 1) : c.likesCount + 1,
            }
          : c;

      // Optimistic update
      if (isReply && parentId) {
        setComments(prev =>
          prev.map(c =>
            c.id === parentId ? { ...c, replies: (c.replies ?? []).map(patchComment) } : c,
          ),
        );
      } else {
        setComments(prev => prev.map(patchComment));
      }

      try {
        const batch = writeBatch(db);
        const now = serverTimestamp();

        if (wasLiked) {
          batch.delete(doc(commentLikesCol, likeDocId));
          batch.update(doc(commentsCol, commentId), { likesCount: increment(-1) });
        } else {
          batch.set(doc(commentLikesCol, likeDocId), {
            commentId,
            userId: currentUser.userId,
            postId,
            createdAt: now,
          });
          batch.update(doc(commentsCol, commentId), { likesCount: increment(1) });
        }

        await batch.commit();
        // Fire-and-forget — only send when liking, not unliking
        if (!wasLiked) {
          sendLikeCommentNotification({
            recipientId: currentComment.userId,
            senderId: currentUser.userId,
            senderDisplayName: currentUser.displayName,
            senderPhotoURL: currentUser.photoURL ?? null,
            postId,
            commentId,
          });
        }
      } catch (e: any) {
        console.error('[useComments] toggleCommentLike:', e);
        // Roll back
        const rollback = (c: ICommentWithUser): ICommentWithUser =>
          c.id === commentId
            ? {
                ...c,
                isLiked: wasLiked,
                likesCount: wasLiked ? c.likesCount + 1 : Math.max(0, c.likesCount - 1),
              }
            : c;

        if (isReply && parentId) {
          setComments(prev =>
            prev.map(c =>
              c.id === parentId ? { ...c, replies: (c.replies ?? []).map(rollback) } : c,
            ),
          );
        } else {
          setComments(prev => prev.map(rollback));
        }
      }
    },
    [comments, currentUser, postId],
  );

  // ── deleteComment ──────────────────────────────────────────────────────────

  const deleteComment = useCallback(
    async (commentId: string): Promise<boolean> => {
      try {
        const commentSnap = await getDoc(doc(commentsCol, commentId));
        if (!commentSnap.exists()) return false;

        const data = commentSnap.data() as IRawComment;
        if (data.userId !== currentUser.userId) return false;

        const now = serverTimestamp();
        const batch = writeBatch(db);

        batch.delete(doc(commentsCol, commentId));
        batch.update(doc(postsCol, postId), {
          commentsCount: increment(-1),
          updatedAt: now,
        });

        if (data.parentCommentId) {
          batch.update(doc(commentsCol, data.parentCommentId), {
            repliesCount: increment(-1),
          });
          setComments(prev =>
            prev.map(c =>
              c.id === data.parentCommentId
                ? {
                    ...c,
                    repliesCount: Math.max(0, c.repliesCount - 1),
                    replies: (c.replies ?? []).filter(r => r.id !== commentId),
                  }
                : c,
            ),
          );
        } else {
          setComments(prev => prev.filter(c => c.id !== commentId));
        }

        await batch.commit();

        // ✓ Callback: Update post comment count in real-time
        onCommentCountChange?.(-1);

        return true;
      } catch (e: any) {
        console.error('[useComments] deleteComment:', e);
        setError('Failed to delete comment.');
        return false;
      }
    },
    [postId, currentUser.userId, onCommentCountChange],
  );

  // ── editComment ────────────────────────────────────────────────────────────

  const editComment = useCallback(async (commentId: string, newText: string): Promise<boolean> => {
    const trimmed = newText.trim();
    if (!trimmed) return false;

    try {
      const now = serverTimestamp();
      const batch = writeBatch(db);
      batch.update(doc(commentsCol, commentId), {
        text: trimmed,
        isEdited: true,
        updatedAt: now,
      });
      await batch.commit();

      const patch = (c: ICommentWithUser): ICommentWithUser =>
        c.id === commentId ? { ...c, text: trimmed, isEdited: true } : c;

      setComments(prev =>
        prev.map(c => ({
          ...patch(c),
          replies: (c.replies ?? []).map(patch),
        })),
      );

      return true;
    } catch (e: any) {
      console.error('[useComments] editComment:', e);
      setError('Failed to edit comment.');
      return false;
    }
  }, []);

  // ── reportComment ──────────────────────────────────────────────────────────

  const reportComment = useCallback(
    async (commentId: string, reason: ReportReason): Promise<boolean> => {
      try {
        // Fetch the comment to get its author
        const commentSnap = await getDoc(doc(commentsCol, commentId));
        if (!commentSnap.exists()) return false;

        const data = commentSnap.data() as IRawComment;
        const reportRef = doc(reportsCol);
        const batch = writeBatch(db);

        batch.set(reportRef, {
          id: reportRef.id,
          type: 'comment',
          targetId: commentId,
          targetUserId: data.userId,
          reportedBy: currentUser.userId,
          reason,
          createdAt: serverTimestamp(),
        });

        await batch.commit();
        return true;
      } catch (e: any) {
        console.error('[useComments] reportComment:', e);
        setError('Failed to submit report.');
        return false;
      }
    },
    [currentUser.userId],
  );

  // ── Return ─────────────────────────────────────────────────────────────────

  return {
    comments,
    loadingComments,
    loadingMoreComments,
    hasMoreComments,
    submittingComment,
    error,
    loadComments,
    loadMoreComments,
    submitComment,
    submitReply,
    loadReplies,
    toggleCommentLike,
    deleteComment,
    editComment,
    reportComment,
    replyingTo,
    setReplyingTo,
    clearError: () => setError(null),
  };
};
