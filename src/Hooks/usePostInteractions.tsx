import { useCallback, useEffect, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  getFirestore,
  increment,
  serverTimestamp,
  writeBatch,
} from '@react-native-firebase/firestore';
import { Share } from 'react-native';
import { IUser } from '../interfaces/IUser';
import { IPostWithUser } from '../interfaces/IPost';
import { IUsePostInteractionsReturn } from '../interfaces/IPostInteractions';
import { ReportReason } from '../interfaces/IReport';
import { sendLikePostNotification } from '../services/notificationService';

// ─── Hook ──────────────────────────────────────────────────────────────────────

export const usePostInteractions = (
  post: IPostWithUser | null,
  currentUser: IUser,
  initialIsLiked = false,
): IUsePostInteractionsReturn => {
  const db = getFirestore();
  const likesCol = collection(db, 'Likes');
  const postViewsCol = collection(db, 'PostViews');
  const bookmarksCol = collection(db, 'Bookmarks');
  const reportsCol = collection(db, 'Reports');
  const postsCol = collection(db, 'Posts');

  // ── State ─────────────────────────────────────────────────────────────────

  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [likesCount, setLikesCount] = useState(post?.likesCount ?? 0);
  const [sharesCount, setSharesCount] = useState(post?.sharesCount ?? 0);
  const [viewsCount, setViewsCount] = useState((post as any)?.viewsCount ?? 0);
  const [isSaved, setIsSaved] = useState(false);

  const [likingInProgress, setLikingInProgress] = useState(false);
  const [sharingInProgress, setSharingInProgress] = useState(false);
  const [savingInProgress, setSavingInProgress] = useState(false);

  // Sync counts when the post prop updates (e.g. pull-to-refresh)
  useEffect(() => {
    if (!post) return;
    setLikesCount(post.likesCount ?? 0);
    setSharesCount(post.sharesCount ?? 0);
    setViewsCount((post as any).viewsCount ?? 0);
  }, [post?.postId]);

  // ── On mount: check like state, saved state, then record view ─────────────

  useEffect(() => {
    if (!post?.postId || !currentUser?.userId) return;

    const checkStates = async () => {
      try {
        // Run all three checks in parallel — single round-trip latency
        const [likeSnap, bookmarkSnap] = await Promise.all([
          getDoc(doc(likesCol, `${post.postId}_${currentUser.userId}`)),
          getDoc(doc(bookmarksCol, `${post.postId}_${currentUser.userId}`)),
        ]);
        setIsLiked(likeSnap.exists());
        setIsSaved(bookmarkSnap.exists());
      } catch (e) {
        console.warn('[usePostInteractions] checkStates:', e);
      }
    };

    // View tracking — fire-and-forget, never blocks UI
    const recordView = async () => {
      try {
        const viewDocId = `${post.postId}_${currentUser.userId}`;
        const viewRef = doc(postViewsCol, viewDocId);
        const existing = await getDoc(viewRef);
        if (existing.exists()) return; // Already counted, skip

        const batch = writeBatch(db);
        batch.set(viewRef, {
          postId: post.postId,
          userId: currentUser.userId,
          viewedAt: serverTimestamp(),
        });
        batch.update(doc(postsCol, post.postId), {
          viewsCount: increment(1),
        });
        await batch.commit();
        setViewsCount((prev: number) => prev + 1);
      } catch (e) {
        // Non-critical — silently ignore
        console.warn('[usePostInteractions] recordView:', e);
      }
    };

    void checkStates();
    void recordView();
  }, [post?.postId, currentUser?.userId]);

  // ── toggleLike ─────────────────────────────────────────────────────────────

  const toggleLike = useCallback(async () => {
    if (!post || likingInProgress) return;

    const wasLiked = isLiked;
    // Optimistic UI — instant response
    setIsLiked(!wasLiked);
    setLikesCount(prev => (wasLiked ? Math.max(0, prev - 1) : prev + 1));
    setLikingInProgress(true);

    try {
      const likeDocId = `${post.postId}_${currentUser.userId}`;
      const now = serverTimestamp();
      const batch = writeBatch(db);

      if (wasLiked) {
        batch.delete(doc(likesCol, likeDocId));
        batch.update(doc(postsCol, post.postId), {
          likesCount: increment(-1),
          updatedAt: now,
        });
      } else {
        batch.set(doc(likesCol, likeDocId), {
          postId: post.postId,
          userId: currentUser.userId,
          createdAt: now,
        });
        batch.update(doc(postsCol, post.postId), {
          likesCount: increment(1),
          updatedAt: now,
        });
      }

      await batch.commit();
      if (!wasLiked) {
        sendLikePostNotification({
          recipientId: post.userId,
          senderId: currentUser.userId,
          senderDisplayName: currentUser.displayName,
          senderPhotoURL: currentUser.photoURL ?? null,
          postId: post.postId,
        });
      }
    } catch (e: any) {
      console.error('[usePostInteractions] toggleLike:', e);
      // Roll back optimistic update
      setIsLiked(wasLiked);
      setLikesCount(prev => (wasLiked ? prev + 1 : Math.max(0, prev - 1)));
    } finally {
      setLikingInProgress(false);
    }
  }, [post, isLiked, likingInProgress, currentUser]);

  // ── toggleSave ─────────────────────────────────────────────────────────────
  //
  // Bookmarks collection: Bookmarks/{postId}_{userId}
  // No counter on the post document — bookmarks are purely user-personal.

  const toggleSave = useCallback(async () => {
    if (!post || savingInProgress) return;

    const wasSaved = isSaved;
    // Optimistic UI
    setIsSaved(!wasSaved);
    setSavingInProgress(true);

    try {
      const bookmarkDocId = `${post.postId}_${currentUser.userId}`;
      const now = serverTimestamp();
      const batch = writeBatch(db);

      if (wasSaved) {
        batch.delete(doc(bookmarksCol, bookmarkDocId));
      } else {
        batch.set(doc(bookmarksCol, bookmarkDocId), {
          postId: post.postId,
          userId: currentUser.userId,
          createdAt: now,
        });
      }

      await batch.commit();
    } catch (e: any) {
      console.error('[usePostInteractions] toggleSave:', e);
      // Roll back
      setIsSaved(wasSaved);
    } finally {
      setSavingInProgress(false);
    }
  }, [post, isSaved, savingInProgress, currentUser]);

  // ── handleShare ────────────────────────────────────────────────────────────
  //
  // sharesCount is incremented only when the user completes the share
  // (result.action === Share.sharedAction).

  const handleShare = useCallback(async () => {
    if (!post || sharingInProgress) return;
    setSharingInProgress(true);

    try {
      const result = await Share.share(
        {
          message: `${post.user?.displayName ?? 'Someone'} on SocialConnect:\n\n${post.content}`,
          url: `https://socialconnect.app/post/${post.postId}`,
          title: 'Check out this post',
        },
        {
          dialogTitle: 'Share this post',
          subject: `Post by ${post.user?.displayName ?? 'someone'}`,
        },
      );

      if (result.action === Share.sharedAction) {
        const now = serverTimestamp();
        const batch = writeBatch(db);
        batch.update(doc(postsCol, post.postId), {
          sharesCount: increment(1),
          updatedAt: now,
        });
        await batch.commit();
        setSharesCount(prev => prev + 1);
      }
    } catch (e: any) {
      // User dismissed the sheet — not an error
      console.warn('[usePostInteractions] handleShare:', e);
    } finally {
      setSharingInProgress(false);
    }
  }, [post, sharingInProgress]);

  // ── reportPost ─────────────────────────────────────────────────────────────
  //
  // Writes a Reports document. We don't prevent multiple reports from the
  // same user here — enforce that in Firestore security rules if needed.

  const reportPost = useCallback(
    async (reason: ReportReason): Promise<boolean> => {
      if (!post) return false;

      try {
        const reportRef = doc(reportsCol);
        const batch = writeBatch(db);
        batch.set(reportRef, {
          id: reportRef.id,
          type: 'post',
          targetPostId: post.postId,
          targetUserId: post.userId,
          reportedBy: currentUser.userId,
          reason,
          createdAt: serverTimestamp(),
        });
        await batch.commit();
        return true;
      } catch (e: any) {
        console.error('[usePostInteractions] reportPost:', e);
        return false;
      }
    },
    [post, currentUser.userId],
  );

  // ── Return ─────────────────────────────────────────────────────────────────

  return {
    isLiked,
    likesCount,
    likingInProgress,
    toggleLike,
    sharesCount,
    sharingInProgress,
    handleShare,
    viewsCount,
    isSaved,
    savingInProgress,
    toggleSave,
    reportPost,
  };
};
