import { useState, useCallback, useRef, useEffect } from 'react';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  writeBatch,
  increment,
  serverTimestamp,
  Timestamp,
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import { IPost } from '../interfaces/IPost';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FeedFilter = 'All' | 'Following' | 'Trending';

export interface IAuthor {
  userId: string;
  displayName: string;
  photoURL?: string;
  handle: string;
  verified?: boolean;
}

export interface IFeedPost {
  postId: string;
  userId: string;
  content: string;
  images: IPost['images'];
  visibility: IPost['visibility'];
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  hashtags: string[];
  mentions: string[];
  isEdited: boolean;
  hasMedia?: boolean;
  createdAt: Date;
  updatedAt: Date;
  author: IAuthor;
  isLiked: boolean;
  isBookmarked: boolean;
  _score?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * PAGE_SIZE  — posts rendered per page.
 * FETCH_SIZE — docs pulled from Firestore per query. 3× over-fetch creates a
 *              local look-ahead buffer so the next load-more often costs 0
 *              extra Firestore reads.
 */
const PAGE_SIZE = 5;
const FETCH_SIZE = 15;

// ─── Pure helpers ─────────────────────────────────────────────────────────────

const chunkArray = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const convertToDate = (ts: any): Date =>
  ts instanceof Timestamp ? ts.toDate() : ts?.toDate?.() ? ts.toDate() : new Date();

/**
 * Time-decayed engagement score used to re-rank All + Trending feeds.
 * Likes × 3, comments × 2, shares × 1 — divided by (ageHours + 2)^1.8.
 */
const computeScore = (data: any): number => {
  const ageHours = (Date.now() - convertToDate(data.createdAt).getTime()) / 3_600_000;
  const engagement =
    (data.likesCount ?? 0) * 3 + (data.commentsCount ?? 0) * 2 + (data.sharesCount ?? 0);
  return engagement / Math.pow(ageHours + 2, 1.8);
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useFeed = () => {
  const db = getFirestore();
  const postsCol = collection(db, 'Posts');
  const likesCol = collection(db, 'Likes');
  const followsCol = collection(db, 'Follows');

  // ── State ──────────────────────────────────────────────────────────────────

  const [posts, setPosts] = useState<IFeedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newPostsCount, setNewPostsCount] = useState(0);
  const [followingIds, setFollowingIds] = useState<string[]>([]);

  // ── Refs ───────────────────────────────────────────────────────────────────

  const lastDocCursorRef = useRef<FirebaseFirestoreTypes.DocumentSnapshot | null>(null);
  const lastDateCursorRef = useRef<Date | null>(null);
  const currentFilterRef = useRef<FeedFilter>('All');
  const currentUserIdRef = useRef<string>('');
  const postsSetRef = useRef<Set<string>>(new Set());
  const newPostsListenerRef = useRef<(() => void) | null>(null);
  const latestFetchTimeRef = useRef<Date>(new Date());

  /**
   * Persistent author-profile cache. Survives page boundaries so subsequent
   * load-more calls never re-read the same Users doc.
   */
  const userCacheRef = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    postsSetRef.current = new Set(posts.map(p => p.postId));
  }, [posts]);

  // ── Firestore helpers ──────────────────────────────────────────────────────

  const fetchFollowingIds = useCallback(
    async (userId: string): Promise<string[]> => {
      const snap = await getDocs(query(followsCol, where('followerId', '==', userId)));
      return snap.docs.map((d: any) => (d.data() as any).followingId as string);
    },
    [followsCol],
  );

  const checkLikeStatuses = useCallback(
    async (postIds: string[], userId: string): Promise<Set<string>> => {
      if (!postIds.length || !userId) return new Set();
      const snaps = await Promise.all(
        postIds.map(id => getDoc(doc(collection(db, 'Likes'), `${id}_${userId}`))),
      );
      const set = new Set<string>();
      snaps.forEach((snap, i) => {
        if (snap.exists()) set.add(postIds[i]);
      });
      return set;
    },
    [db],
  );

  const checkBookmarkStatuses = useCallback(
    async (postIds: string[], userId: string): Promise<Set<string>> => {
      if (!postIds.length || !userId) return new Set();
      const snaps = await Promise.all(
        postIds.map(id => getDoc(doc(collection(db, 'Bookmarks'), `${id}_${userId}`))),
      );
      const set = new Set<string>();
      snaps.forEach((snap, i) => {
        if (snap.exists()) set.add(postIds[i]);
      });
      return set;
    },
    [db],
  );

  /**
   * Only fetches Users docs not already in the cache.
   * Warm page (repeated scroll) → 0 extra Firestore reads for profiles.
   */
  const batchFetchUsers = useCallback(
    async (userIds: string[]): Promise<Map<string, any>> => {
      const unique = [...new Set(userIds.filter(Boolean))];
      const missing = unique.filter(id => !userCacheRef.current.has(id));
      if (missing.length) {
        const snaps = await Promise.all(
          missing.map(id => getDoc(doc(collection(db, 'Users'), id))),
        );
        snaps.forEach(snap => {
          if (snap.exists()) userCacheRef.current.set(snap.id, snap.data());
        });
      }
      const result = new Map<string, any>();
      unique.forEach(id => {
        const v = userCacheRef.current.get(id);
        if (v) result.set(id, v);
      });
      return result;
    },
    [db],
  );

  const mapDoc = useCallback(
    (
      docSnap: FirebaseFirestoreTypes.QueryDocumentSnapshot,
      likedSet: Set<string>,
      userMap: Map<string, any>,
      bookmarkSet: Set<string>,
    ): IFeedPost => {
      const data = docSnap.data() as any;
      const postId = data.postId || docSnap.id;
      const postUserId = data.userId ?? '';
      const userData = userMap.get(postUserId);

      const resolvedAuthor: IAuthor =
        data.author ??
        (userData
          ? {
              userId: postUserId,
              displayName: userData.displayName ?? userData.email?.split('@')[0] ?? 'User',
              photoURL: userData.photoURL ?? undefined,
              handle: userData.handle
                ? `@${userData.handle}`
                : `@${(userData.displayName ?? 'user').toLowerCase().replace(/\s+/g, '')}`,
              verified: userData.verified ?? false,
            }
          : {
              userId: postUserId,
              displayName: 'User',
              photoURL: undefined,
              handle: '@user',
              verified: false,
            });

      return {
        postId,
        userId: postUserId,
        content: data.content ?? '',
        images: data.images ?? [],
        visibility: data.visibility ?? 'public',
        likesCount: data.likesCount ?? 0,
        commentsCount: data.commentsCount ?? 0,
        sharesCount: data.sharesCount ?? 0,
        hashtags: data.hashtags ?? [],
        mentions: data.mentions ?? [],
        isEdited: data.isEdited ?? false,
        hasMedia: data.hasMedia ?? data.images?.length > 0,
        createdAt: convertToDate(data.createdAt),
        updatedAt: convertToDate(data.updatedAt),
        author: resolvedAuthor,
        isLiked: likedSet.has(postId),
        isBookmarked: bookmarkSet.has(postId),
        _score: computeScore(data),
      };
    },
    [],
  );

  /**
   * Merges public docs with the current user's own posts and deduplicates.
   * Own posts have no visibility constraint so private posts appear for the author.
   * Used by All and Trending only — Following is strictly followed-users-only.
   */
  const mergeWithOwnPosts = useCallback(
    (
      publicDocs: FirebaseFirestoreTypes.QueryDocumentSnapshot[],
      ownDocs: FirebaseFirestoreTypes.QueryDocumentSnapshot[],
      sortByDate = false,
    ): FirebaseFirestoreTypes.QueryDocumentSnapshot[] => {
      const seen = new Set<string>();
      const merged: FirebaseFirestoreTypes.QueryDocumentSnapshot[] = [];
      for (const d of [...publicDocs, ...ownDocs]) {
        const id = (d.data() as any).postId || d.id;
        if (!seen.has(id)) {
          seen.add(id);
          merged.push(d);
        }
      }
      if (sortByDate) {
        merged.sort(
          (a, b) =>
            convertToDate((b.data() as any).createdAt).getTime() -
            convertToDate((a.data() as any).createdAt).getTime(),
        );
      }
      return merged;
    },
    [],
  );

  // ── Core Fetcher ───────────────────────────────────────────────────────────

  const executeFetch = useCallback(
    async (
      filter: FeedFilter,
      userId: string,
      isLoadMore: boolean,
    ): Promise<{ feedPosts: IFeedPost[]; hasMore: boolean }> => {
      let rawDocs: FirebaseFirestoreTypes.QueryDocumentSnapshot[] = [];

      // ── All ───────────────────────────────────────────────────────────────
      if (filter === 'All') {
        const publicQ: any[] = [
          where('visibility', '==', 'public'),
          orderBy('createdAt', 'desc'),
          limit(FETCH_SIZE),
        ];
        if (isLoadMore && lastDocCursorRef.current)
          publicQ.push(startAfter(lastDocCursorRef.current));

        const [publicSnap, ownSnap] = await Promise.all([
          getDocs(query(postsCol, ...publicQ)),
          getDocs(
            query(
              postsCol,
              where('userId', '==', userId),
              orderBy('createdAt', 'desc'),
              limit(PAGE_SIZE),
            ),
          ),
        ]);

        rawDocs = mergeWithOwnPosts(
          publicSnap.docs as FirebaseFirestoreTypes.QueryDocumentSnapshot[],
          ownSnap.docs as FirebaseFirestoreTypes.QueryDocumentSnapshot[],
          true,
        );
        lastDocCursorRef.current = publicSnap.docs[publicSnap.docs.length - 1] ?? null;
      }

      // ── Trending ──────────────────────────────────────────────────────────
      else if (filter === 'Trending') {
        const publicQ: any[] = [
          where('visibility', '==', 'public'),
          orderBy('likesCount', 'desc'),
          orderBy('createdAt', 'desc'),
          limit(FETCH_SIZE),
        ];
        if (isLoadMore && lastDocCursorRef.current)
          publicQ.push(startAfter(lastDocCursorRef.current));

        const [publicSnap, ownSnap] = await Promise.all([
          getDocs(query(postsCol, ...publicQ)),
          getDocs(
            query(
              postsCol,
              where('userId', '==', userId),
              orderBy('createdAt', 'desc'),
              limit(PAGE_SIZE),
            ),
          ),
        ]);

        rawDocs = mergeWithOwnPosts(
          publicSnap.docs as FirebaseFirestoreTypes.QueryDocumentSnapshot[],
          ownSnap.docs as FirebaseFirestoreTypes.QueryDocumentSnapshot[],
        );
        lastDocCursorRef.current = publicSnap.docs[publicSnap.docs.length - 1] ?? null;
      }

      // ── Following ─────────────────────────────────────────────────────────
      else if (filter === 'Following') {
        let ids = followingIds;
        if (!isLoadMore) {
          ids = await fetchFollowingIds(userId);
          setFollowingIds(ids);
        }

        if (!ids.length) return { feedPosts: [], hasMore: false };

        const chunks = chunkArray(ids, 30);
        const dateCursor = isLoadMore ? lastDateCursorRef.current : null;
        const allRaw: FirebaseFirestoreTypes.QueryDocumentSnapshot[] = [];

        await Promise.all(
          chunks.map(async chunk => {
            const constraints: any[] = [
              where('userId', 'in', chunk),
              orderBy('createdAt', 'desc'),
              limit(FETCH_SIZE),
            ];
            if (dateCursor)
              constraints.push(where('createdAt', '<', Timestamp.fromDate(dateCursor)));
            const snap = await getDocs(query(postsCol, ...constraints));
            allRaw.push(...(snap.docs as FirebaseFirestoreTypes.QueryDocumentSnapshot[]));
          }),
        );

        allRaw.sort(
          (a, b) =>
            convertToDate((b.data() as any).createdAt).getTime() -
            convertToDate((a.data() as any).createdAt).getTime(),
        );
        rawDocs = allRaw.slice(0, FETCH_SIZE);

        if (rawDocs.length) {
          lastDateCursorRef.current = convertToDate(
            (rawDocs[rawDocs.length - 1].data() as any).createdAt,
          );
        }
      }

      if (!rawDocs.length) return { feedPosts: [], hasMore: false };

      const pageDocs = rawDocs.slice(0, PAGE_SIZE);

      // Likes + bookmarks + profiles in one parallel batch
      const postIds = pageDocs.map(d => (d.data() as any).postId || d.id);
      const postUserIds = pageDocs.map(d => (d.data() as any).userId ?? '');

      const [likedSet, bookmarkSet, userMap] = await Promise.all([
        checkLikeStatuses(postIds, userId),
        checkBookmarkStatuses(postIds, userId),
        batchFetchUsers(postUserIds),
      ]);

      let feedPosts = pageDocs.map(d => mapDoc(d, likedSet, userMap, bookmarkSet));

      if (filter === 'All' || filter === 'Trending') {
        feedPosts = feedPosts.sort((a, b) => (b._score ?? 0) - (a._score ?? 0));
      }

      return { feedPosts, hasMore: rawDocs.length >= FETCH_SIZE };
    },
    [
      followingIds,
      fetchFollowingIds,
      checkLikeStatuses,
      checkBookmarkStatuses,
      batchFetchUsers,
      mergeWithOwnPosts,
      mapDoc,
      postsCol,
    ],
  );

  // ── Public API ─────────────────────────────────────────────────────────────

  const fetchFeed = useCallback(
    async (filter: FeedFilter, userId: string) => {
      try {
        setLoading(true);
        setError(null);
        currentFilterRef.current = filter;
        currentUserIdRef.current = userId;
        lastDocCursorRef.current = null;
        lastDateCursorRef.current = null;
        // Clear immediately so skeletons render on tab switch right away
        setPosts([]);

        const { feedPosts, hasMore: more } = await executeFetch(filter, userId, false);

        latestFetchTimeRef.current = new Date();
        setPosts(feedPosts);
        setHasMore(more);
        setNewPostsCount(0);

        if (filter === 'All') setupNewPostsListener(userId);
        else teardownNewPostsListener();
      } catch (err: any) {
        console.error('[useFeed] fetchFeed:', err);
        setError(err.message ?? 'Failed to load posts');
      } finally {
        setLoading(false);
      }
    },
    [executeFetch], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const refresh = useCallback(
    async (filter: FeedFilter, userId: string) => {
      try {
        setRefreshing(true);
        setError(null);
        lastDocCursorRef.current = null;
        lastDateCursorRef.current = null;
        setFollowingIds([]);

        const { feedPosts, hasMore: more } = await executeFetch(filter, userId, false);

        latestFetchTimeRef.current = new Date();
        setPosts(feedPosts);
        setHasMore(more);
        setNewPostsCount(0);

        if (filter === 'All') setupNewPostsListener(userId);
        else teardownNewPostsListener();
      } catch (err: any) {
        console.error('[useFeed] refresh:', err);
        setError(err.message ?? 'Failed to refresh');
      } finally {
        setRefreshing(false);
      }
    },
    [executeFetch], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const loadMore = useCallback(
    async (filter: FeedFilter, userId: string) => {
      if (loadingMore || !hasMore) return;
      try {
        setLoadingMore(true);
        const { feedPosts, hasMore: more } = await executeFetch(filter, userId, true);
        setPosts(prev => {
          const existingIds = new Set(prev.map(p => p.postId));
          return [...prev, ...feedPosts.filter(p => !existingIds.has(p.postId))];
        });
        setHasMore(more);
      } catch (err: any) {
        console.error('[useFeed] loadMore:', err);
      } finally {
        setLoadingMore(false);
      }
    },
    [loadingMore, hasMore, executeFetch],
  );

  const toggleLike = useCallback(
    async (postId: string, userId: string, currentlyLiked: boolean) => {
      let originalCount: number | undefined;
      setPosts(prev =>
        prev.map(p => {
          if (p.postId !== postId) return p;
          originalCount = p.likesCount;
          return {
            ...p,
            isLiked: !currentlyLiked,
            likesCount: Math.max(0, p.likesCount + (currentlyLiked ? -1 : 1)),
          };
        }),
      );
      try {
        const batch = writeBatch(db);
        const likeRef = doc(likesCol, `${postId}_${userId}`);
        const postRef = doc(postsCol, postId);
        if (currentlyLiked) {
          batch.delete(likeRef);
          batch.update(postRef, { likesCount: increment(-1) });
        } else {
          batch.set(likeRef, {
            id: `${postId}_${userId}`,
            postId,
            userId,
            createdAt: serverTimestamp(),
          });
          batch.update(postRef, { likesCount: increment(1) });
        }
        await batch.commit();
      } catch (err) {
        console.error('[useFeed] toggleLike rollback:', err);
        setPosts(prev =>
          prev.map(p =>
            p.postId === postId
              ? {
                  ...p,
                  isLiked: currentlyLiked,
                  likesCount:
                    originalCount ?? Math.max(0, p.likesCount + (currentlyLiked ? 1 : -1)),
                }
              : p,
          ),
        );
      }
    },
    [db, likesCol, postsCol],
  );

  const toggleBookmark = useCallback(
    async (postId: string, userId: string, currentlyBookmarked: boolean) => {
      setPosts(prev =>
        prev.map(p => (p.postId === postId ? { ...p, isBookmarked: !currentlyBookmarked } : p)),
      );
      try {
        const batch = writeBatch(db);
        const bookmarkRef = doc(collection(db, 'Bookmarks'), `${postId}_${userId}`);
        if (currentlyBookmarked) {
          batch.delete(bookmarkRef);
        } else {
          batch.set(bookmarkRef, { postId, userId, createdAt: serverTimestamp() });
        }
        await batch.commit();
      } catch (err) {
        console.error('[useFeed] toggleBookmark rollback:', err);
        setPosts(prev =>
          prev.map(p => (p.postId === postId ? { ...p, isBookmarked: currentlyBookmarked } : p)),
        );
      }
    },
    [db],
  );

  const removePost = useCallback(
    (postId: string) => setPosts(prev => prev.filter(p => p.postId !== postId)),
    [],
  );

  const dismissNewPosts = useCallback(() => setNewPostsCount(0), []);
  const clearError = useCallback(() => setError(null), []);

  // ── Real-time new-posts listener (All filter only) ─────────────────────────

  const teardownNewPostsListener = useCallback(() => {
    newPostsListenerRef.current?.();
    newPostsListenerRef.current = null;
  }, []);

  const setupNewPostsListener = useCallback(
    (userId: string) => {
      teardownNewPostsListener();
      const fetchTime = latestFetchTimeRef.current;
      const unsub = onSnapshot(
        query(
          postsCol,
          where('visibility', '==', 'public'),
          where('createdAt', '>', Timestamp.fromDate(fetchTime)),
          orderBy('createdAt', 'desc'),
        ),
        snapshot => {
          if (snapshot.empty) return;
          const genuinelyNew = snapshot.docs.filter(
            (d: any) => !postsSetRef.current.has((d.data() as any).postId || d.id),
          );
          if (genuinelyNew.length > 0) setNewPostsCount(genuinelyNew.length);
        },
        err => console.warn('[useFeed] newPosts listener:', err),
      );
      newPostsListenerRef.current = unsub;
    },
    [teardownNewPostsListener, postsCol],
  );

  useEffect(() => {
    return () => teardownNewPostsListener();
  }, [teardownNewPostsListener]);

  return {
    posts,
    loading,
    refreshing,
    loadingMore,
    hasMore,
    error,
    newPostsCount,
    fetchFeed,
    refresh,
    loadMore,
    toggleLike,
    toggleBookmark,
    dismissNewPosts,
    clearError,
    removePost,
  };
};
