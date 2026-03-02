import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  increment,
  serverTimestamp,
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import { cloudinaryService } from '../services/cloudinaryService';
import {
  IPost,
  IPostWithUser,
  ICreatePost,
  IImageProgress,
  IPaginatedPosts,
  IPaginationParams,
} from '../interfaces/IPost';

// ─────────────────────────────────────────────────────────────────────────────
// Hashtags collection schema  (document ID = tag WITHOUT '#')
// ─────────────────────────────────────────────────────────────────────────────
//
//  Hashtags / buildinpublic
//  {
//    tag:        "#buildinpublic"   ← WITH #   for display & array-contains
//    tagLower:   "buildinpublic"    ← WITHOUT # for prefix-range search
//    count:       42                ← live post count; decremented on delete
//    createdAt:   Timestamp         ← written ONCE on first tag creation
//    lastUsedAt:  Timestamp         ← updated every time a post uses this tag
//  }
//
// Why pre-read before the batch (see checkNewTags):
//   set({ merge: true }) with createdAt in the payload ALWAYS overwrites it —
//   "merge" only means "don't delete unmentioned fields", not "skip existing values".
//   The only correct client-side fix: read each tag doc first, then only write
//   createdAt for tags whose documents don't exist yet.
// ─────────────────────────────────────────────────────────────────────────────

export interface IUsePostReturn {
  createPost: (userId: string, input: ICreatePost) => Promise<string | null>;
  creating: boolean;
  imageProgress: IImageProgress[];
  updatePost: (postId: string, userId: string, input: ICreatePost) => Promise<boolean>;
  updating: boolean;
  deletePost: (postId: string, userId: string) => Promise<boolean>;
  deleting: boolean;
  getPost: (postId: string) => Promise<IPostWithUser | null>;
  loading: boolean;
  getPostsFeed: (params?: IPaginationParams) => Promise<IPaginatedPosts>;
  feedLoading: boolean;
  likePost: (postId: string, userId: string) => Promise<boolean>;
  unlikePost: (postId: string, userId: string) => Promise<boolean>;
  likingPostId: string | null;
  error: string | null;
  clearError: () => void;
}

export const usePost = (): IUsePostReturn => {
  const [creating, setCreating] = useState(false);
  const [imageProgress, setImageProgress] = useState<IImageProgress[]>([]);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedLoading, setFeedLoading] = useState(false);
  const [likingPostId, setLikingPostId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const db = getFirestore();
  const postsCol = collection(db, 'Posts');
  const usersCol = collection(db, 'Users');
  const likesCol = collection(db, 'Likes');
  const hashtagsCol = collection(db, 'Hashtags');

  // ─── Content parsers ────────────────────────────────────────────────────────

  const extractHashtags = (content: string): string[] => {
    const matches = content.match(/#[\w\u0590-\u05ff]+/g);
    return matches ? [...new Set(matches.map(t => t.toLowerCase()))] : [];
  };

  const extractMentions = (content: string): string[] => {
    const matches = content.match(/@([\w.]+)/g);
    return matches ? [...new Set(matches.map(m => m.substring(1).toLowerCase()))] : [];
  };

  const toDate = (ts: any): Date => (ts?.toDate ? ts.toDate() : new Date());

  const mapStatus = (s: 'idle' | 'uploading' | 'success' | 'error'): IImageProgress['status'] =>
    s === 'idle' ? 'pending' : s === 'success' ? 'completed' : s;

  // ─── Pre-read: detect brand-new tags ─────────────────────────────────────
  //
  // This is called BEFORE the batch so we can decide per-tag whether to
  // include createdAt in the write.
  //
  // WHY NOT just use { merge: true } with createdAt always?
  //   Because Firestore's merge semantics mean every field you include in the
  //   payload is written unconditionally. createdAt resets on every post. Bug.
  //
  // WHY NOT { mergeFields: ['createdAt'] }?
  //   mergeFields controls WHICH fields to write, not WHETHER to write them.
  //   It still overwrites createdAt on every call. Same bug.
  //
  // CORRECT SOLUTION: read the doc first. If it doesn't exist → new tag →
  // include createdAt. If it exists → omit createdAt from payload → merge
  // leaves the existing value completely untouched.

  const checkNewTags = async (tags: string[]): Promise<Set<string>> => {
    if (!tags.length) return new Set();
    const results = await Promise.all(
      tags.map(async tag => {
        const id = tag.replace(/^#/, '');
        const snap = await getDoc(doc(hashtagsCol, id));
        return snap.exists() ? null : id; // null = already exists
      }),
    );
    return new Set(results.filter((id): id is string => id !== null));
  };

  // ─── Hashtag batch helpers ────────────────────────────────────────────────

  /**
   * Adds +1 counter operations to an existing batch.
   * newTagIds: Set of tagLower IDs that do not yet exist in Firestore.
   * - New tags:      writes tag, tagLower, count, lastUsedAt, createdAt
   * - Existing tags: writes tag, tagLower, count, lastUsedAt only
   *                  → createdAt is omitted from payload → untouched by merge ✓
   */
  const batchAddTags = (
    batch: ReturnType<typeof writeBatch>,
    tags: string[],
    newTagIds: Set<string>,
    now: ReturnType<typeof serverTimestamp>,
  ) => {
    tags.forEach(tag => {
      const id = tag.replace(/^#/, '');
      const isNew = newTagIds.has(id);

      batch.set(
        doc(hashtagsCol, id),
        {
          tag,
          tagLower: id,
          count: increment(1),
          lastUsedAt: now,
          // Spread createdAt only for brand-new tags.
          // For existing tags: field is absent from payload →
          // merge:true leaves the original createdAt intact. ✓
          ...(isNew && { createdAt: now }),
        },
        { merge: true },
      );
    });
  };

  /**
   * Adds -1 counter operations to an existing batch.
   * Does NOT touch createdAt or lastUsedAt — those reflect history.
   */
  const batchRemoveTags = (batch: ReturnType<typeof writeBatch>, tags: string[]) => {
    tags.forEach(tag => {
      const id = tag.replace(/^#/, '');
      batch.set(doc(hashtagsCol, id), { count: increment(-1) }, { merge: true });
    });
  };

  const diffTags = (prev: string[], next: string[]): { added: string[]; removed: string[] } => {
    const prevSet = new Set(prev);
    const nextSet = new Set(next);
    return {
      added: next.filter(t => !prevSet.has(t)),
      removed: prev.filter(t => !nextSet.has(t)),
    };
  };

  // ─── CREATE ─────────────────────────────────────────────────────────────────

  const createPost = useCallback(
    async (userId: string, input: ICreatePost): Promise<string | null> => {
      try {
        setCreating(true);
        setError(null);

        if (!input.content.trim()) throw new Error('Post content cannot be empty');
        if (input.images && input.images.length > 4) throw new Error('Maximum 4 images allowed');

        const postRef = doc(postsCol);
        const postId = postRef.id;

        // 1. Upload images (network — outside batch)
        let uploadedImages: IPost['images'] = [];
        if (input.images?.length) {
          setImageProgress(
            input.images.map(img => ({ uri: img.uri, progress: 0, status: 'pending' })),
          );
          uploadedImages = await cloudinaryService.uploadPostImages(
            userId,
            postId,
            input.images,
            (index, p) =>
              setImageProgress(prev =>
                prev.map((item, i) =>
                  i === index
                    ? { ...item, progress: p.progress, status: mapStatus(p.status), url: p.url }
                    : item,
                ),
              ),
          );
          setImageProgress(prev =>
            prev.map(item => ({ ...item, status: 'completed', progress: 100 })),
          );
        }

        const hashtags = extractHashtags(input.content);
        const mentions = extractMentions(input.content);

        // 2. Pre-read: which hashtags are brand new?
        const newTagIds = await checkNewTags(hashtags);

        const now = serverTimestamp();

        // 3. Single atomic batch
        const batch = writeBatch(db);

        batch.set(postRef, {
          postId,
          userId,
          content: input.content.trim(),
          images: uploadedImages,
          visibility: input.visibility,
          likesCount: 0,
          commentsCount: 0,
          sharesCount: 0,
          hashtags,
          mentions,
          isEdited: false,
          createdAt: now,
          updatedAt: now,
        });

        batch.update(doc(usersCol, userId), {
          postsCount: increment(1),
          updatedAt: now,
        });

        batchAddTags(batch, hashtags, newTagIds, now);

        await batch.commit();

        setCreating(false);
        setImageProgress([]);
        return postId;
      } catch (err: any) {
        console.error('[usePost] createPost:', err);
        setError(err.message || 'Failed to create post');
        setCreating(false);
        setImageProgress([]);
        Alert.alert('Error', err.message || 'Failed to create post');
        return null;
      }
    },
    [],
  );

  // ─── UPDATE ─────────────────────────────────────────────────────────────────

  const updatePost = useCallback(
    async (postId: string, userId: string, input: ICreatePost): Promise<boolean> => {
      try {
        setUpdating(true);
        setError(null);

        if (!input.content.trim()) throw new Error('Post content cannot be empty');

        const postRef = doc(postsCol, postId);
        const postSnap = await getDoc(postRef);
        if (!postSnap.exists()) throw new Error('Post not found');

        const existing = postSnap.data() as IPost;
        if (existing.userId !== userId) throw new Error('You can only edit your own posts');

        // Upload newly added images
        let newlyUploaded: IPost['images'] = [];
        if (input.images?.length) {
          setImageProgress(
            input.images.map(img => ({ uri: img.uri, progress: 0, status: 'pending' })),
          );
          newlyUploaded = await cloudinaryService.uploadPostImages(
            userId,
            postId,
            input.images,
            (index, p) =>
              setImageProgress(prev =>
                prev.map((item, i) =>
                  i === index
                    ? { ...item, progress: p.progress, status: mapStatus(p.status), url: p.url }
                    : item,
                ),
              ),
          );
          setImageProgress(prev =>
            prev.map(item => ({ ...item, status: 'completed', progress: 100 })),
          );
        }

        const keptImages = input.existingImages ?? existing.images ?? [];
        const finalImages = [...keptImages, ...newlyUploaded];

        if (input.existingImages !== undefined) {
          const keptIds = new Set(keptImages.map(img => img.publicId));
          const removedIds = (existing.images ?? [])
            .filter(img => !keptIds.has(img.publicId))
            .map(img => img.publicId);
          if (removedIds.length)
            cloudinaryService.deleteMultipleImages(removedIds).catch(console.error);
        }

        const newHashtags = extractHashtags(input.content);
        const newMentions = extractMentions(input.content);
        const oldHashtags = existing.hashtags ?? [];
        const { added, removed } = diffTags(oldHashtags, newHashtags);

        // Pre-read only for tags being newly added (they might be new to the system)
        const newTagIds = added.length ? await checkNewTags(added) : new Set<string>();

        const now = serverTimestamp();

        const batch = writeBatch(db);

        batch.update(postRef, {
          content: input.content.trim(),
          images: finalImages,
          hashtags: newHashtags,
          mentions: newMentions,
          visibility: input.visibility,
          isEdited: true,
          updatedAt: now,
        });

        if (added.length) batchAddTags(batch, added, newTagIds, now);
        if (removed.length) batchRemoveTags(batch, removed);

        await batch.commit();

        setUpdating(false);
        setImageProgress([]);
        return true;
      } catch (err: any) {
        console.error('[usePost] updatePost:', err);
        setError(err.message || 'Failed to update post');
        setUpdating(false);
        setImageProgress([]);
        Alert.alert('Error', err.message || 'Failed to update post');
        return false;
      }
    },
    [],
  );

  // ─── DELETE ─────────────────────────────────────────────────────────────────

  const deletePost = useCallback(async (postId: string, userId: string): Promise<boolean> => {
    return new Promise(resolve => {
      Alert.alert('Delete Post', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              setError(null);

              const postRef = doc(postsCol, postId);
              const postSnap = await getDoc(postRef);
              if (!postSnap.exists()) throw new Error('Post not found');

              const existing = postSnap.data() as IPost;
              if (existing.userId !== userId) throw new Error('You can only delete your own posts');

              const now = serverTimestamp();

              const batch = writeBatch(db);
              batch.delete(postRef);
              batch.update(doc(usersCol, userId), {
                postsCount: increment(-1),
                updatedAt: now,
              });
              batchRemoveTags(batch, existing.hashtags ?? []);
              await batch.commit();

              if (existing.images?.length) {
                cloudinaryService
                  .deletePostFolder(
                    existing.userId,
                    postId,
                    existing.images.map(i => i.publicId),
                  )
                  .catch(e => console.error('[usePost] Cloudinary cleanup:', e));
              }

              setDeleting(false);
              resolve(true);
            } catch (err: any) {
              console.error('[usePost] deletePost:', err);
              setError(err.message || 'Failed to delete post');
              setDeleting(false);
              Alert.alert('Error', err.message || 'Failed to delete post');
              resolve(false);
            }
          },
        },
      ]);
    });
  }, []);

  // ─── GET SINGLE POST ─────────────────────────────────────────────────────────

  const getPost = useCallback(async (postId: string): Promise<IPostWithUser | null> => {
    try {
      setLoading(true);
      setError(null);
      const snap = await getDoc(doc(postsCol, postId));
      if (!snap.exists()) {
        setLoading(false);
        return null;
      }
      const data = snap.data() as IPost;
      setLoading(false);
      return { ...data, createdAt: toDate(data.createdAt), updatedAt: toDate(data.updatedAt) };
    } catch (err: any) {
      console.error('[usePost] getPost:', err);
      setError(err.message || 'Failed to load post');
      setLoading(false);
      return null;
    }
  }, []);

  // ─── GET FEED ────────────────────────────────────────────────────────────────

  const getPostsFeed = useCallback(
    async (params: IPaginationParams = {}): Promise<IPaginatedPosts> => {
      try {
        setFeedLoading(true);
        setError(null);

        const { limit: pageLimit = 10, lastDoc, userId } = params;
        const constraints: any[] = [orderBy('createdAt', 'desc'), limit(pageLimit)];
        if (userId) constraints.unshift(where('userId', '==', userId));
        if (lastDoc) constraints.push(startAfter(lastDoc));

        const snap = await getDocs(query(postsCol, ...constraints));
        const posts: IPostWithUser[] = snap.docs.map(
          (d: FirebaseFirestoreTypes.QueryDocumentSnapshot) => {
            const data = d.data() as IPost;
            return {
              ...data,
              createdAt: toDate(data.createdAt),
              updatedAt: toDate(data.updatedAt),
            };
          },
        );

        setFeedLoading(false);
        return {
          posts,
          lastDoc: snap.docs[snap.docs.length - 1],
          hasMore: snap.docs.length === pageLimit,
        };
      } catch (err: any) {
        console.error('[usePost] getPostsFeed:', err);
        setError(err.message || 'Failed to load posts');
        setFeedLoading(false);
        return { posts: [], hasMore: false };
      }
    },
    [],
  );

  // ─── LIKE / UNLIKE ───────────────────────────────────────────────────────────

  const likePost = useCallback(async (postId: string, userId: string): Promise<boolean> => {
    try {
      setLikingPostId(postId);
      const batch = writeBatch(db);
      batch.set(doc(likesCol, `${postId}_${userId}`), {
        postId,
        userId,
        createdAt: serverTimestamp(),
      });
      batch.update(doc(postsCol, postId), { likesCount: increment(1) });
      await batch.commit();
      setLikingPostId(null);
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to like post');
      setLikingPostId(null);
      return false;
    }
  }, []);

  const unlikePost = useCallback(async (postId: string, userId: string): Promise<boolean> => {
    try {
      setLikingPostId(postId);
      const batch = writeBatch(db);
      batch.delete(doc(likesCol, `${postId}_${userId}`));
      batch.update(doc(postsCol, postId), { likesCount: increment(-1) });
      await batch.commit();
      setLikingPostId(null);
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to unlike post');
      setLikingPostId(null);
      return false;
    }
  }, []);

  return {
    createPost,
    creating,
    imageProgress,
    updatePost,
    updating,
    deletePost,
    deleting,
    getPost,
    loading,
    getPostsFeed,
    feedLoading,
    likePost,
    unlikePost,
    likingPostId,
    error,
    clearError: () => setError(null),
  };
};
