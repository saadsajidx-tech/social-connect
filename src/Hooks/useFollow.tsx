/**
 * useProfileData.ts
 *
 * Single hook that drives the entire ViewUserProfile screen.
 *
 * Covers:
 *   • Real-time target user profile (onSnapshot)
 *   • Follow state: isFollowing, followsYouBack (one-time on mount)
 *   • Mutual followers (one-time on mount)
 *   • Follow / Unfollow actions (optimistic UI + atomic Firestore batch)
 *   • Target user's posts (cursor-based pagination)
 *
 * ─── Firestore structure ──────────────────────────────────────────
 *   users/{userId}                       → IUser
 *   follows/{followerId}_{followingId}   → IFollow
 *   posts/{postId}                       → IPost (filtered by userId)
 *
 * ─── Why "{followerId}_{followingId}" as the follow doc ID? ───────
 *   Deterministic IDs allow a single getDoc() to check follow state
 *   instead of running a query — O(1) read, no composite index needed.
 *   All counter updates go through writeBatch so counts never drift.
 *   FieldValue.increment avoids read-before-write on counters entirely.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FirebaseFirestoreTypes,
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  limit,
  query,
  serverTimestamp,
  startAfter,
  where,
  writeBatch,
  increment,
} from '@react-native-firebase/firestore';

import { IFollow, IMutualFollower, IUser } from '../interfaces/IUser';
import { IPost, IPostWithUser } from '../interfaces/IPost';

// ─── Constants ────────────────────────────────────────────────────

const db = getFirestore();
const POSTS_PAGE_SIZE = 12;

// ─── Internal helpers ─────────────────────────────────────────────

/** Deterministic follow document ID — O(1) existence checks, no query needed */
const followDocId = (followerId: string, followingId: string): string =>
  `${followerId}_${followingId}`;

/**
 * Converts a raw Firestore post document snapshot to IPostWithUser.
 *
 * The explicit generic on QueryDocumentSnapshot<IPost> tells TypeScript the
 * exact shape coming off the wire, so `.data()` returns `IPost` rather than
 * `DocumentData` and the spread satisfies the IPostWithUser return type.
 */
const snapshotToPost = (
  snap: FirebaseFirestoreTypes.QueryDocumentSnapshot<IPost>,
): IPostWithUser => {
  const data = snap.data();
  return {
    ...data,
    createdAt: data.createdAt?.toDate?.() ?? new Date(),
    updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
  };
};

// ─── Types ────────────────────────────────────────────────────────

export interface UseProfileDataState {
  profileUser: IUser | null;
  loadingProfile: boolean;
  profileError: string | null;

  isFollowing: boolean;
  followsYouBack: boolean;
  followLoading: boolean;
  mutualFollowers: IMutualFollower[];

  posts: IPostWithUser[];
  loadingPosts: boolean;
  hasMorePosts: boolean;
  loadingMorePosts: boolean;

  handleToggleFollow: () => Promise<void>;
  loadMorePosts: () => Promise<void>;
  refreshPosts: () => Promise<void>;
}

// ─── Hook ─────────────────────────────────────────────────────────

export function useComments(
  targetUserId: string,
  currentUserId: string | undefined,
): UseProfileDataState {
  const [profileUser, setProfileUser] = useState<IUser | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [isFollowing, setIsFollowing] = useState(false);
  const [followsYouBack, setFollowsYouBack] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [mutualFollowers, setMutualFollowers] = useState<IMutualFollower[]>([]);

  const [posts, setPosts] = useState<IPostWithUser[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const [hasMorePosts, setHasMorePosts] = useState(false);

  // Cursor for pagination — kept in a ref so it never triggers re-renders
  const lastDocRef = useRef<FirebaseFirestoreTypes.QueryDocumentSnapshot<IPost> | null>(null);

  const isSelf = currentUserId === targetUserId;

  // ────────────────────────────────────────────────────────────────
  // 1. Real-time listener on target user's profile document.
  //    onSnapshot keeps follower/following counts live after any
  //    follow action without requiring an extra manual fetch.
  // ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!targetUserId) return;

    setLoadingProfile(true);
    setProfileError(null);

    const unsubscribe = onSnapshot(
      doc(db, 'Users', targetUserId),
      (snap: FirebaseFirestoreTypes.DocumentSnapshot<IUser>) => {
        if (snap.exists()) {
          setProfileUser(snap.data() as IUser);
        } else {
          setProfileError('User not found.');
        }
        setLoadingProfile(false);
      },
      (err: Error) => {
        console.error('[useProfileData] profile listener:', err);
        setProfileError('Failed to load profile.');
        setLoadingProfile(false);
      },
    );

    return unsubscribe;
  }, [targetUserId]);

  // ────────────────────────────────────────────────────────────────
  // 2. Follow state + mutual followers — all three fire in parallel
  //    with Promise.all so there is only one round-trip of latency.
  //
  //    isFollowing / followsYouBack: single getDoc() each — O(1)
  //    because of the deterministic document ID pattern.
  //
  //    Mutual followers: 2-step query.
  //      Step 1 — fetch up to 30 followers of the target.
  //      Step 2 — `in` query to find which of those currentUser
  //               also follows. Max 30 items is Firestore's limit
  //               and more than enough for the "X, Y +N others" badge.
  // ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUserId || !targetUserId || isSelf) return;

    const loadFollowState = async (): Promise<void> => {
      try {
        const [followingSnap, followsBackSnap, followersOfTargetSnap] = await Promise.all([
          getDoc(doc(db, 'Follows', followDocId(currentUserId, targetUserId))),
          getDoc(doc(db, 'Follows', followDocId(targetUserId, currentUserId))),
          getDocs(
            query(collection(db, 'Follows'), where('followingId', '==', targetUserId), limit(30)),
          ),
        ]);

        setIsFollowing(followingSnap.exists());
        setFollowsYouBack(followsBackSnap.exists());

        // ── Mutual followers ───────────────────────────────────
        const followerIds: string[] = followersOfTargetSnap.docs
          .map(
            (snap: FirebaseFirestoreTypes.QueryDocumentSnapshot) =>
              (snap.data() as IFollow).followerId,
          )
          .filter((id: string) => id !== currentUserId);

        if (followerIds.length === 0) return;

        const mutualSnap = await getDocs(
          query(
            collection(db, 'follows'),
            where('followerId', '==', currentUserId),
            where('followingId', 'in', followerIds.slice(0, 30)),
          ),
        );

        if (mutualSnap.empty) return;

        const mutualIds: string[] = mutualSnap.docs.map(
          (snap: FirebaseFirestoreTypes.QueryDocumentSnapshot) =>
            (snap.data() as IFollow).followingId,
        );

        // Fetch display info for up to 3 mutual followers in parallel
        const userSnaps = await Promise.all(
          mutualIds.slice(0, 3).map((uid: string) => getDoc(doc(db, 'Users', uid))),
        );

        const mutuals: IMutualFollower[] = userSnaps
          .filter((snap: FirebaseFirestoreTypes.DocumentSnapshot) => snap.exists())
          .map((snap: FirebaseFirestoreTypes.DocumentSnapshot) => {
            const u = snap.data() as IUser;
            return {
              userId: u.userId,
              displayName: u.displayName,
              photoURL: u.photoURL,
            };
          });

        setMutualFollowers(mutuals);
      } catch (err) {
        console.error('[useProfileData] follow state:', err);
      }
    };

    void loadFollowState();
  }, [targetUserId, currentUserId, isSelf]);

  // ────────────────────────────────────────────────────────────────
  // 3. Posts — first page.
  //    useCallback with [targetUserId] as the dep means this only
  //    re-creates when we're looking at a different user, not on
  //    every render.
  // ────────────────────────────────────────────────────────────────
  const fetchFirstPage = useCallback(async (): Promise<void> => {
    if (!targetUserId) return;

    try {
      const snap = (await getDocs(
        query(
          collection(db, 'Posts'),
          where('userId', '==', targetUserId),
          where('visibility', 'in', ['public', 'followers']),
          orderBy('createdAt', 'desc'),
          limit(POSTS_PAGE_SIZE),
        ),
      )) as FirebaseFirestoreTypes.QuerySnapshot<IPost>;

      lastDocRef.current = snap.docs[snap.docs.length - 1] ?? null;
      setHasMorePosts(snap.docs.length === POSTS_PAGE_SIZE);
      setPosts(snap.docs.map(snapshotToPost));
    } catch (err) {
      console.error('[useProfileData] fetchFirstPage:', err);
    }
  }, [targetUserId]);

  useEffect(() => {
    setLoadingPosts(true);
    fetchFirstPage().finally(() => setLoadingPosts(false));
  }, [fetchFirstPage]);

  // ────────────────────────────────────────────────────────────────
  // 4. Posts — load next page (cursor-based pagination via startAfter).
  //    Guards prevent duplicate in-flight requests.
  // ────────────────────────────────────────────────────────────────
  const loadMorePosts = useCallback(async (): Promise<void> => {
    if (!hasMorePosts || loadingMorePosts || !lastDocRef.current) return;

    setLoadingMorePosts(true);
    try {
      const snap = (await getDocs(
        query(
          collection(db, 'Posts'),
          where('userId', '==', targetUserId),
          where('visibility', 'in', ['public', 'followers']),
          orderBy('createdAt', 'desc'),
          startAfter(lastDocRef.current),
          limit(POSTS_PAGE_SIZE),
        ),
      )) as FirebaseFirestoreTypes.QuerySnapshot<IPost>;

      lastDocRef.current = snap.docs[snap.docs.length - 1] ?? lastDocRef.current;
      setHasMorePosts(snap.docs.length === POSTS_PAGE_SIZE);
      setPosts(prev => [...prev, ...snap.docs.map(snapshotToPost)]);
    } catch (err) {
      console.error('[useProfileData] loadMorePosts:', err);
    } finally {
      setLoadingMorePosts(false);
    }
  }, [targetUserId, hasMorePosts, loadingMorePosts]);

  // ────────────────────────────────────────────────────────────────
  // 5. Posts — refresh (pull-to-refresh or called after a follow
  //    action on a private account that just granted access).
  // ────────────────────────────────────────────────────────────────
  const refreshPosts = useCallback(async (): Promise<void> => {
    lastDocRef.current = null;
    setLoadingPosts(true);
    await fetchFirstPage();
    setLoadingPosts(false);
  }, [fetchFirstPage]);

  // ────────────────────────────────────────────────────────────────
  // 6. Follow / Unfollow
  //
  //    Optimistic UI: flip local state immediately so the button
  //    responds in zero latency. On Firestore error, roll back.
  //
  //    Atomic batch: the follow document and both users' counters
  //    update in a single commit — counts can never drift out of sync.
  //
  //    increment(±1) avoids a read-before-write for the counters;
  //    Firestore applies it server-side atomically.
  // ────────────────────────────────────────────────────────────────
  const handleToggleFollow = useCallback(async (): Promise<void> => {
    if (!currentUserId || followLoading || isSelf) return;

    const wasFollowing = isFollowing;

    // Optimistic update — UI responds instantly
    setIsFollowing(!wasFollowing);
    setFollowLoading(true);

    try {
      const followId = followDocId(currentUserId, targetUserId);
      const followRef = doc(db, 'Follows', followId);
      const batch = writeBatch(db);

      if (wasFollowing) {
        batch.delete(followRef);
        batch.update(doc(db, 'Users', targetUserId), { followersCount: increment(-1) });
        batch.update(doc(db, 'Users', currentUserId), { followingCount: increment(-1) });
      } else {
        const newFollow: IFollow = {
          id: followId,
          followerId: currentUserId,
          followingId: targetUserId,
          createdAt: serverTimestamp() as FirebaseFirestoreTypes.Timestamp,
        };
        batch.set(followRef, newFollow);
        batch.update(doc(db, 'Users', targetUserId), { followersCount: increment(1) });
        batch.update(doc(db, 'Users', currentUserId), { followingCount: increment(1) });
      }

      await batch.commit();
      // Counts update automatically via the onSnapshot listener — no manual refetch needed
    } catch (err) {
      console.error('[useProfileData] toggleFollow:', err);
      // Roll back optimistic update on failure
      setIsFollowing(wasFollowing);
    } finally {
      setFollowLoading(false);
    }
  }, [currentUserId, targetUserId, isFollowing, followLoading, isSelf]);

  // ────────────────────────────────────────────────────────────────

  return {
    profileUser,
    loadingProfile,
    profileError,
    isFollowing,
    followsYouBack,
    followLoading,
    mutualFollowers,
    posts,
    loadingPosts,
    hasMorePosts,
    loadingMorePosts,
    handleToggleFollow,
    loadMorePosts,
    refreshPosts,
  };
}
