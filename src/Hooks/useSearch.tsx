import { useState, useCallback, useEffect, useRef } from 'react';
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  writeBatch,
  increment,
  serverTimestamp,
  getDoc,
  startAfter,
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IUser } from '../interfaces/IUser';
import { IPost, IPostWithUser } from '../interfaces/IPost';

// ─── Constants ────────────────────────────────────────────────────────────────

const RECENT_KEY = '@search:recent_v2';
const MAX_RECENT = 10;
const DEBOUNCE_MS = 300;
const PAGE_SIZE = 10;
const DISCOVERY_LIMIT = 20;
const TAG_LIMIT = 8; // max autocomplete suggestions
const SUGGESTED_LIMIT = 8; // max suggested users
const TRENDING_LIMIT = 12; // trending tags shown in discovery

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ISearchUser {
  userId: string;
  displayName: string;
  photoURL?: string;
  bio?: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isFollowing: boolean;
}

/**
 * A single entry from the Hashtags collection.
 * The UI shows these as tappable suggestion pills while the user is typing.
 */
export interface ITagSuggestion {
  tag: string; // "#buildinpublic"  (with #, for display + array-contains query)
  tagLower: string; // "buildinpublic"   (without #, used as doc ID and range key)
  count: number; // number of live posts currently using this tag
}

/** Alias — trending tags have the same shape as search suggestions */
export type ITrendingTag = ITagSuggestion;

export type SearchPhase =
  | 'idle' // nothing typed
  | 'suggesting' // typing — showing tag suggestions + user results
  | 'tag_selected'; // user tapped a tag — showing that tag's posts

export interface ISearchState {
  phase: SearchPhase;
  users: ISearchUser[];
  tagSuggestions: ITagSuggestion[];
  selectedTag: ITagSuggestion | null; // the tag whose posts are currently shown
  posts: IPostWithUser[];
}

export interface IUseSearchReturn {
  // ── Query ─────────────────────────────────────────────────────────────────
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  activeTab: 'all' | 'posts' | 'people' | 'tags';
  setActiveTab: (t: 'all' | 'posts' | 'people' | 'tags') => void;

  // ── Results ───────────────────────────────────────────────────────────────
  state: ISearchState;
  searching: boolean;
  hasResults: boolean;

  /** Called when the user taps one of the tag suggestion pills */
  selectTag: (tag: ITagSuggestion) => Promise<void>;

  // ── Discovery (idle) ──────────────────────────────────────────────────────
  /** Top tags by post count — shown on discovery screen, no query needed */
  trendingTags: ITrendingTag[];
  trendingLoading: boolean;
  suggestedUsers: ISearchUser[];
  suggestedLoading: boolean;

  // ── Recent searches ───────────────────────────────────────────────────────
  recentSearches: string[];
  addRecentSearch: (term: string) => Promise<void>;
  removeRecentSearch: (term: string) => Promise<void>;
  clearRecentSearches: () => Promise<void>;

  // ── Follow ────────────────────────────────────────────────────────────────
  followUser: (id: string) => Promise<boolean>;
  unfollowUser: (id: string) => Promise<boolean>;
  followingInProgress: Set<string>;

  // ── Pagination ────────────────────────────────────────────────────────────
  loadMorePosts: () => Promise<void>;
  hasMorePosts: boolean;
  loadingMorePosts: boolean;

  error: string | null;
  clearError: () => void;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/** "#BuildInPublic" | "build in public" → "buildinpublic" (doc ID format) */
const toTagId = (raw: string): string => raw.replace(/^#+/, '').replace(/\s+/g, '').toLowerCase();

/** any raw input → "#buildinpublic" (stored format in Posts.hashtags) */
const toHashtag = (raw: string): string => '#' + toTagId(raw);

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useSearch = (currentUserId: string): IUseSearchReturn => {
  const db = getFirestore();
  const postsCol = collection(db, 'Posts');
  const usersCol = collection(db, 'Users');
  const followsCol = collection(db, 'Follows');
  const hashtagsCol = collection(db, 'Hashtags');

  // ── State ──────────────────────────────────────────────────────────────────

  const idleState: ISearchState = {
    phase: 'idle',
    users: [],
    tagSuggestions: [],
    selectedTag: null,
    posts: [],
  };

  const [searchQuery, setSearchQueryRaw] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'posts' | 'people' | 'tags'>('all');
  const [state, setState] = useState<ISearchState>(idleState);
  const [searching, setSearching] = useState(false);

  const [trendingTags, setTrendingTags] = useState<ITrendingTag[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [suggestedUsers, setSuggestedUsers] = useState<ISearchUser[]>([]);
  const [suggestedLoading, setSuggestedLoading] = useState(false);

  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [followingInProgress, setFollowingInProgress] = useState<Set<string>>(new Set());

  const [lastPostDoc, setLastPostDoc] = useState<FirebaseFirestoreTypes.DocumentSnapshot | null>(
    null,
  );
  const [hasMorePosts, setHasMorePosts] = useState(false);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchVersion = useRef(0);

  // ── Internal helpers ───────────────────────────────────────────────────────

  const toDate = (ts: any): Date => (ts?.toDate ? ts.toDate() : new Date(ts ?? Date.now()));

  /** Attach author user data to posts (batches unique uid lookups). */
  const hydratePosts = async (posts: IPostWithUser[]): Promise<IPostWithUser[]> => {
    if (!posts.length) return [];
    const uids = [...new Set<string>(posts.map(p => p.userId))];
    const snaps = await Promise.all(
      uids.map(uid =>
        getDoc(doc(usersCol, uid))
          .then(s => (s.exists() ? (s.data() as IUser) : null))
          .catch(() => null),
      ),
    );
    const map = new Map<string, IUser>();
    snaps.forEach(u => u && map.set(u.userId, u));
    return posts.map(p => ({
      ...p,
      user: map.has(p.userId)
        ? {
            userId: p.userId,
            displayName: map.get(p.userId)!.displayName,
            photoURL: map.get(p.userId)!.photoURL,
          }
        : undefined,
    }));
  };

  /** Returns which of the given uids the current user follows. */
  const getFollowingSet = useCallback(
    async (uids: string[]): Promise<Set<string>> => {
      if (!uids.length) return new Set();
      const results = await Promise.all(
        uids.map(uid =>
          getDoc(doc(followsCol, `${currentUserId}_${uid}`))
            .then(s => (s.exists() ? uid : null))
            .catch(() => null),
        ),
      );
      return new Set(results.filter(Boolean) as string[]);
    },
    [currentUserId],
  );

  const toSearchUser = (u: IUser, followingSet: Set<string>): ISearchUser => ({
    userId: u.userId,
    displayName: u.displayName,
    photoURL: u.photoURL,
    bio: u.bio,
    followersCount: u.followersCount ?? 0,
    followingCount: u.followingCount ?? 0,
    postsCount: u.postsCount ?? 0,
    isFollowing: followingSet.has(u.userId),
  });

  const syncFollow = (targetId: string, isFollowing: boolean) => {
    const patch = (u: ISearchUser): ISearchUser =>
      u.userId !== targetId
        ? u
        : {
            ...u,
            isFollowing,
            followersCount: isFollowing
              ? (u.followersCount ?? 0) + 1
              : Math.max(0, (u.followersCount ?? 1) - 1),
          };
    setSuggestedUsers(p => p.map(patch));
    setState(p => ({ ...p, users: p.users.map(patch) }));
  };

  // ── Recent searches ────────────────────────────────────────────────────────

  const persist = useCallback(async (list: string[]) => {
    try {
      await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(list));
    } catch {}
  }, []);

  const loadRecentSearches = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(RECENT_KEY);
      if (raw) setRecentSearches(JSON.parse(raw));
    } catch {}
  }, []);

  const addRecentSearch = useCallback(
    async (term: string) => {
      if (!term.trim()) return;
      setRecentSearches(prev => {
        const next = [term, ...prev.filter(s => s !== term)].slice(0, MAX_RECENT);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const removeRecentSearch = useCallback(
    async (term: string) => {
      setRecentSearches(prev => {
        const next = prev.filter(s => s !== term);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const clearRecentSearches = useCallback(async () => {
    setRecentSearches([]);
    await AsyncStorage.removeItem(RECENT_KEY);
  }, []);

  // ── Discovery ──────────────────────────────────────────────────────────────

  // ── Trending tags ─────────────────────────────────────────────────────────
  // Reads the Hashtags collection ordered by count desc — O(1) per tag doc,
  // no post scan needed. This is why we maintain the counter cache in usePost.
  const fetchTrendingTags = useCallback(async () => {
    try {
      setTrendingLoading(true);
      const snap = await getDocs(
        query(hashtagsCol, orderBy('count', 'desc'), limit(TRENDING_LIMIT)),
      );
      const tags: ITrendingTag[] = snap.docs
        .map((d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => ({
          tag: d.data().tag as string,
          tagLower: d.data().tagLower as string,
          count: d.data().count as number,
        }))
        .filter((t: any) => (t.count ?? 0) > 0);
      setTrendingTags(tags);
    } catch (e: any) {
      console.warn('Trending tags:', e?.message);
    } finally {
      setTrendingLoading(false);
    }
  }, []);

  const fetchSuggestedUsers = useCallback(async () => {
    try {
      setSuggestedLoading(true);
      const snap = await getDocs(query(usersCol, orderBy('followersCount', 'desc'), limit(20)));
      const raw = snap.docs
        .map((d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => d.data() as IUser)
        .filter((u: IUser) => u.userId !== currentUserId && !u.isDeactivated && !u.isDeleted)
        .slice(0, SUGGESTED_LIMIT);
      const fs = await getFollowingSet(raw.map((u: any) => u.userId));
      setSuggestedUsers(raw.map((u: any) => toSearchUser(u, fs)));
    } catch (e: any) {
      console.warn('Suggested users:', e?.message);
    } finally {
      setSuggestedLoading(false);
    }
  }, [currentUserId, getFollowingSet]);

  // ── Layer 1: Hashtags collection prefix query ──────────────────────────────
  //
  // This is the FAST autocomplete layer. We query the Hashtags collection
  // (maintained atomically by usePost) using a range query on tagLower.
  // Results are sorted by count so the most popular tags appear first.
  //
  // Index required: Hashtags / tagLower ASC  (single-field, auto-created)
  //
  // Example: user types "build"
  // → queries tagLower >= "build" AND tagLower <= "build\uf8ff"
  // → returns: buildinpublic(42), buildweekly(7), buildlog(3)

  const fetchTagSuggestions = useCallback(async (raw: string): Promise<ITagSuggestion[]> => {
    const tagId = toTagId(raw);
    if (!tagId) return [];

    try {
      const snap = await getDocs(
        query(
          hashtagsCol,
          where('tagLower', '>=', tagId),
          where('tagLower', '<=', tagId + '\uf8ff'),
          orderBy('tagLower'), // required by Firestore for range queries
          limit(20), // fetch 20, sort by count client-side
        ),
      );

      return snap.docs
        .map((d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => ({
          tag: d.data().tag as string,
          tagLower: d.data().tagLower as string,
          count: d.data().count as number,
        }))
        .filter((t: any) => (t.count ?? 0) > 0) // exclude zeroed-out tags
        .sort((a: any, b: any) => b.count - a.count) // most popular first
        .slice(0, TAG_LIMIT);
    } catch (e: any) {
      // Range query on tagLower requires a single-field index.
      // Firestore creates this automatically — if it fails during index
      // build, return empty and fall back gracefully.
      console.warn('fetchTagSuggestions:', e?.message);
      return [];
    }
  }, []);

  // ── Layer 2: Posts by hashtag (array-contains) ────────────────────────────
  //
  // Called when the user selects a tag suggestion.
  // Uses Firestore array-contains — O(1) regardless of total post count.
  //
  // Composite index required (create once in Firebase Console):
  //   Collection: Posts | hashtags: Arrays | createdAt: Descending
  //   → Firestore will print the exact console link on first failed query.

  const fetchPostsByTag = useCallback(
    async (
      tag: string,
      afterDoc?: FirebaseFirestoreTypes.DocumentSnapshot,
    ): Promise<{
      posts: IPostWithUser[];
      lastDoc?: FirebaseFirestoreTypes.DocumentSnapshot;
      hasMore: boolean;
    }> => {
      const snap = await getDocs(
        query(
          postsCol,
          where('hashtags', 'array-contains', tag),
          orderBy('createdAt', 'desc'),
          limit(PAGE_SIZE),
          ...(afterDoc ? [startAfter(afterDoc)] : []),
        ),
      );

      const raw: IPostWithUser[] = snap.docs.map(
        (d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => {
          const data = d.data() as IPost;
          return {
            ...data,
            createdAt: toDate(data.createdAt),
            updatedAt: toDate(data.updatedAt),
          } as IPostWithUser;
        },
      );

      return {
        posts: await hydratePosts(raw),
        lastDoc: snap.docs[snap.docs.length - 1],
        hasMore: snap.docs.length === PAGE_SIZE,
      };
    },
    [],
  );

  // ── Layer 3: People search (displayName prefix) ────────────────────────────
  //
  // Three parallel prefix queries to handle case variations.
  // No composite index needed.

  const fetchUsers = useCallback(
    async (raw: string): Promise<ISearchUser[]> => {
      const lower = raw.toLowerCase();
      const cap = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();

      const [sLower, sRaw, sCap] = await Promise.all([
        getDocs(
          query(
            usersCol,
            where('displayNameLower', '>=', lower),
            where('displayNameLower', '<=', lower + '\uf8ff'),
            limit(15),
          ),
        ).catch(() => null),
        getDocs(
          query(
            usersCol,
            where('displayName', '>=', raw),
            where('displayName', '<=', raw + '\uf8ff'),
            limit(15),
          ),
        ).catch(() => null),
        getDocs(
          query(
            usersCol,
            where('displayName', '>=', cap),
            where('displayName', '<=', cap + '\uf8ff'),
            limit(15),
          ),
        ).catch(() => null),
      ]);

      const seen = new Set<string>();
      const merged: IUser[] = [];
      [sLower, sRaw, sCap].forEach(snap => {
        snap?.docs.forEach((d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => {
          const u = d.data() as IUser;
          if (
            !seen.has(u.userId) &&
            u.userId !== currentUserId &&
            !u.isDeactivated &&
            !u.isDeleted
          ) {
            seen.add(u.userId);
            merged.push(u);
          }
        });
      });

      const fs = await getFollowingSet(merged.map(u => u.userId));
      return merged.map(u => toSearchUser(u, fs));
    },
    [currentUserId, getFollowingSet],
  );

  // ── Main search executor ───────────────────────────────────────────────────
  //
  // Flow on every debounced keystroke:
  //   1. Query Hashtags (fast prefix lookup) + Users (parallel)
  //   2. Show tag suggestion pills + user rows immediately
  //   3. If query is an exact match to the #1 tag, pre-load its posts
  //      so the user doesn't have to tap anything
  //
  // When the user TAPS a tag pill, selectTag() runs fetchPostsByTag directly.

  const runSearch = useCallback(
    async (raw: string) => {
      const v = ++searchVersion.current;
      setSearching(true);
      setError(null);

      try {
        const [tagSuggestions, users] = await Promise.all([
          fetchTagSuggestions(raw),
          fetchUsers(raw),
        ]);

        if (v !== searchVersion.current) return;

        // Pre-load posts if the query is an exact match to the top suggestion
        const exactTag = tagSuggestions.find(t => t.tagLower === toTagId(raw));
        let posts: IPostWithUser[] = [];
        let lastDoc: FirebaseFirestoreTypes.DocumentSnapshot | undefined;
        let hasMore = false;

        if (exactTag) {
          const result = await fetchPostsByTag(exactTag.tag);
          if (v !== searchVersion.current) return;
          posts = result.posts;
          lastDoc = result.lastDoc;
          hasMore = result.hasMore;
        }

        setState({
          phase: 'suggesting',
          users,
          tagSuggestions,
          selectedTag: exactTag ?? null,
          posts,
        });
        setLastPostDoc(lastDoc ?? null);
        setHasMorePosts(hasMore);
      } catch (e: any) {
        if (v !== searchVersion.current) return;
        setError(e.message || 'Search failed. Try again.');
      } finally {
        if (v === searchVersion.current) setSearching(false);
      }
    },
    [fetchTagSuggestions, fetchUsers, fetchPostsByTag],
  );

  const setSearchQuery = useCallback(
    (q: string) => {
      setSearchQueryRaw(q);
      setActiveTab('all' as any);
      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (!q.trim()) {
        setState(idleState);
        setSearching(false);
        return;
      }

      debounceRef.current = setTimeout(() => runSearch(q), DEBOUNCE_MS);
    },
    [runSearch],
  );

  // ── selectTag: user taps a suggestion pill ─────────────────────────────────
  //
  // This is the primary path for loading posts. We set phase to
  // 'tag_selected' and replace the suggestion list with just the chosen tag.

  const selectTag = useCallback(
    async (tag: ITagSuggestion) => {
      // Update the input text to the selected tag so the user sees what's active
      setSearchQueryRaw(tag.tagLower);
      setActiveTab('posts');
      setSearching(true);
      setError(null);

      try {
        const result = await fetchPostsByTag(tag.tag);
        setState(prev => ({
          ...prev,
          phase: 'tag_selected',
          selectedTag: tag,
          tagSuggestions: [tag],
          posts: result.posts,
        }));
        setLastPostDoc(result.lastDoc ?? null);
        setHasMorePosts(result.hasMore);
        // Save tag to recent only after successful load
        addRecentSearch(tag.tagLower);
      } catch (e: any) {
        setError(e.message || 'Failed to load posts for this tag.');
      } finally {
        setSearching(false);
      }
    },
    [fetchPostsByTag, addRecentSearch],
  );

  // ── Load more posts ────────────────────────────────────────────────────────

  const loadMorePosts = useCallback(async () => {
    const tag = state.selectedTag;
    if (!tag || !hasMorePosts || loadingMorePosts || !lastPostDoc) return;
    try {
      setLoadingMorePosts(true);
      const result = await fetchPostsByTag(tag.tag, lastPostDoc);
      setState(prev => ({ ...prev, posts: [...prev.posts, ...result.posts] }));
      setLastPostDoc(result.lastDoc ?? null);
      setHasMorePosts(result.hasMore);
    } catch (e: any) {
      setError(e.message || 'Failed to load more posts.');
    } finally {
      setLoadingMorePosts(false);
    }
  }, [state.selectedTag, hasMorePosts, loadingMorePosts, lastPostDoc, fetchPostsByTag]);

  // ── Follow / Unfollow ──────────────────────────────────────────────────────

  const followUser = useCallback(
    async (targetId: string): Promise<boolean> => {
      if (followingInProgress.has(targetId)) return false;
      setFollowingInProgress(p => new Set([...p, targetId]));
      syncFollow(targetId, true);
      try {
        const batch = writeBatch(db);
        const now = serverTimestamp();
        batch.set(doc(followsCol, `${currentUserId}_${targetId}`), {
          followerId: currentUserId,
          followingId: targetId,
          createdAt: now,
        });
        batch.update(doc(usersCol, currentUserId), {
          followingCount: increment(1),
          updatedAt: now,
        });
        batch.update(doc(usersCol, targetId), { followersCount: increment(1), updatedAt: now });
        await batch.commit();
        return true;
      } catch (e: any) {
        syncFollow(targetId, false);
        setError(e.message || 'Failed to follow.');
        return false;
      } finally {
        setFollowingInProgress(p => {
          const s = new Set(p);
          s.delete(targetId);
          return s;
        });
      }
    },
    [currentUserId, followingInProgress],
  );

  const unfollowUser = useCallback(
    async (targetId: string): Promise<boolean> => {
      if (followingInProgress.has(targetId)) return false;
      setFollowingInProgress(p => new Set([...p, targetId]));
      syncFollow(targetId, false);
      try {
        const batch = writeBatch(db);
        const now = serverTimestamp();
        batch.delete(doc(followsCol, `${currentUserId}_${targetId}`));
        batch.update(doc(usersCol, currentUserId), {
          followingCount: increment(-1),
          updatedAt: now,
        });
        batch.update(doc(usersCol, targetId), { followersCount: increment(-1), updatedAt: now });
        await batch.commit();
        return true;
      } catch (e: any) {
        syncFollow(targetId, true);
        setError(e.message || 'Failed to unfollow.');
        return false;
      } finally {
        setFollowingInProgress(p => {
          const s = new Set(p);
          s.delete(targetId);
          return s;
        });
      }
    },
    [currentUserId, followingInProgress],
  );

  // ── Backfill displayNameLower ──────────────────────────────────────────────

  const backfillDisplayNameLower = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const snap = await getDoc(doc(usersCol, currentUserId));
      if (!snap.exists()) return;
      const data = snap.data() as IUser;
      if (!(data as any).displayNameLower && data.displayName) {
        const b = writeBatch(db);
        b.update(doc(usersCol, currentUserId), {
          displayNameLower: data.displayName.toLowerCase(),
        });
        await b.commit();
      }
    } catch {}
  }, [currentUserId]);

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  useEffect(() => {
    loadRecentSearches();
    fetchTrendingTags();
    fetchSuggestedUsers();
    backfillDisplayNameLower();
  }, []);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const hasResults =
    state.users.length > 0 || state.posts.length > 0 || state.tagSuggestions.length > 0;

  return {
    searchQuery,
    setSearchQuery,
    activeTab,
    setActiveTab,
    state,
    searching,
    hasResults,
    selectTag,
    trendingTags,
    trendingLoading,
    suggestedUsers,
    suggestedLoading,
    recentSearches,
    addRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
    followUser,
    unfollowUser,
    followingInProgress,
    loadMorePosts,
    hasMorePosts,
    loadingMorePosts,
    error,
    clearError: () => setError(null),
  };
};
