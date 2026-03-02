import { useState, useCallback, useRef } from 'react';
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import { IUser } from '../interfaces/IUser';
import { IPost, IPostWithUser } from '../interfaces/IPost';
import { useCloudinary } from './useCloudinary';
import { ImageUploadProgress } from '../services/cloudinaryService';

const PAGE_SIZE = 12;

// ─── Types ────────────────────────────────────────────────────────────────────
export interface UpdateProfileInput {
  displayName?: string;
  bio?: string;
  location?: string;
  website?: string;
}

type Cursor = FirebaseFirestoreTypes.DocumentSnapshot | undefined;

function toDate(ts: any): Date {
  return ts?.toDate ? ts.toDate() : new Date();
}

function docToPost(snap: FirebaseFirestoreTypes.DocumentSnapshot): IPostWithUser {
  const data = snap.data() as IPost;
  return {
    ...data,
    postId: snap.id,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

function sanitizeWebsite(url: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://${url}`;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useProfile() {
  const db = getFirestore();
  const { uploadAvatar, deleteImage, isUploadingAvatar, avatarProgress } = useCloudinary();

  // ── Profile write state ──────────────────────────────────────────────────────
  const [updating, setUpdating] = useState(false);

  // ── Other user profile fetch state ──────────────────────────────────────────
  const [profileData, setProfileData] = useState<IUser | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // ── Owned posts ──────────────────────────────────────────────────────────────
  const [posts, setPosts] = useState<IPostWithUser[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const postsCursor = useRef<Cursor>(undefined);

  // ── Liked posts ──────────────────────────────────────────────────────────────
  const [likedPosts, setLikedPosts] = useState<IPostWithUser[]>([]);
  const [loadingLiked, setLoadingLiked] = useState(false);
  const [hasMoreLiked, setHasMoreLiked] = useState(true);
  const likedCursor = useRef<Cursor>(undefined);

  // ── Bookmarked posts ─────────────────────────────────────────────────────────
  const [bookmarkedPosts, setBookmarkedPosts] = useState<IPostWithUser[]>([]);
  const [loadingBookmarked, setLoadingBookmarked] = useState(false);
  const [hasMoreBookmarked, setHasMoreBookmarked] = useState(true);
  const bookmarkCursor = useRef<Cursor>(undefined);

  // ─── Fetch another user's profile ────────────────────────────────────────────
  const fetchProfile = useCallback(async (userId: string): Promise<IUser | null> => {
    setLoadingProfile(true);
    try {
      const snap = await getDoc(doc(db, 'Users', userId));
      const data = snap.exists() ? (snap.data() as IUser) : null;
      setProfileData(data);
      return data;
    } catch (e) {
      console.error('[useProfile] fetchProfile:', e);
      return null;
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  // ─── Fetch owned posts ────────────────────────────────────────────────────────
  const fetchPosts = useCallback(
    async (userId: string, refresh = false) => {
      if (loadingPosts) return;
      if (!refresh && !hasMorePosts) return;

      setLoadingPosts(true);
      if (refresh) {
        postsCursor.current = undefined;
        setHasMorePosts(true);
      }

      try {
        const constraints: any[] = [
          where('userId', '==', userId),
          orderBy('createdAt', 'desc'),
          limit(PAGE_SIZE),
        ];
        if (!refresh && postsCursor.current) {
          constraints.push(startAfter(postsCursor.current));
        }

        const snap = await getDocs(query(collection(db, 'Posts'), ...constraints));
        const fetched = snap.docs.map(docToPost);

        postsCursor.current = snap.docs[snap.docs.length - 1];
        setHasMorePosts(fetched.length === PAGE_SIZE);
        setPosts(prev => (refresh ? fetched : [...prev, ...fetched]));
      } catch (e) {
        console.error('[useProfile] fetchPosts:', e);
      } finally {
        setLoadingPosts(false);
      }
    },
    [loadingPosts, hasMorePosts],
  );

  // ─── Fetch liked posts ────────────────────────────────────────────────────────
  // Query Likes collection → batch-fetch the actual Post docs in parallel.
  // Mirrors the same pattern used in usePost.likePost (Likes doc id = postId_userId).
  const fetchLikedPosts = useCallback(
    async (userId: string, refresh = false) => {
      if (loadingLiked) return;
      if (!refresh && !hasMoreLiked) return;

      setLoadingLiked(true);
      if (refresh) {
        likedCursor.current = undefined;
        setHasMoreLiked(true);
      }

      try {
        const constraints: any[] = [
          where('userId', '==', userId),
          orderBy('createdAt', 'desc'),
          limit(PAGE_SIZE),
        ];
        if (!refresh && likedCursor.current) {
          constraints.push(startAfter(likedCursor.current));
        }

        const likesSnap = await getDocs(query(collection(db, 'Likes'), ...constraints));
        likedCursor.current = likesSnap.docs[likesSnap.docs.length - 1];
        setHasMoreLiked(likesSnap.docs.length === PAGE_SIZE);

        const postIds: string[] = likesSnap.docs.map((d: any) => d.data().postId as string);
        const postSnaps = await Promise.all(postIds.map(id => getDoc(doc(db, 'Posts', id))));

        const fetched = postSnaps
          .filter(s => s.exists())
          .map(s => ({ ...docToPost(s), isLiked: true }));

        setLikedPosts(prev => (refresh ? fetched : [...prev, ...fetched]));
      } catch (e) {
        console.error('[useProfile] fetchLikedPosts:', e);
      } finally {
        setLoadingLiked(false);
      }
    },
    [loadingLiked, hasMoreLiked],
  );

  // ─── Fetch bookmarked posts ───────────────────────────────────────────────────
  // Same pattern as liked — Bookmarks collection: { userId, postId, createdAt }
  const fetchBookmarkedPosts = useCallback(
    async (userId: string, refresh = false) => {
      if (loadingBookmarked) return;
      if (!refresh && !hasMoreBookmarked) return;

      setLoadingBookmarked(true);
      if (refresh) {
        bookmarkCursor.current = undefined;
        setHasMoreBookmarked(true);
      }

      try {
        const constraints: any[] = [
          where('userId', '==', userId),
          orderBy('createdAt', 'desc'),
          limit(PAGE_SIZE),
        ];
        if (!refresh && bookmarkCursor.current) {
          constraints.push(startAfter(bookmarkCursor.current));
        }

        const bookmarkSnap = await getDocs(query(collection(db, 'Bookmarks'), ...constraints));
        bookmarkCursor.current = bookmarkSnap.docs[bookmarkSnap.docs.length - 1];
        setHasMoreBookmarked(bookmarkSnap.docs.length === PAGE_SIZE);

        const postIds: string[] = bookmarkSnap.docs.map((d: any) => d.data().postId as string);
        const postSnaps = await Promise.all(postIds.map(id => getDoc(doc(db, 'Posts', id))));

        const fetched = postSnaps.filter(s => s.exists()).map(docToPost);
        setBookmarkedPosts(prev => (refresh ? fetched : [...prev, ...fetched]));
      } catch (e) {
        console.error('[useProfile] fetchBookmarkedPosts:', e);
      } finally {
        setLoadingBookmarked(false);
      }
    },
    [loadingBookmarked, hasMoreBookmarked],
  );

  // ─── Update profile fields ────────────────────────────────────────────────────
  const updateProfile = useCallback(
    async (userId: string, data: UpdateProfileInput): Promise<IUser> => {
      setUpdating(true);
      try {
        const userRef = doc(db, 'Users', userId);
        const payload: Record<string, unknown> = { updatedAt: new Date().toISOString() };
        if (data.displayName !== undefined) payload.displayName = data.displayName.trim();
        if (data.bio !== undefined) payload.bio = data.bio.trim();
        if (data.location !== undefined) payload.location = data.location.trim();
        if (data.website !== undefined) payload.website = sanitizeWebsite(data.website.trim());

        await updateDoc(userRef, payload);
        const snap = await getDoc(userRef);
        return snap.data() as IUser;
      } finally {
        setUpdating(false);
      }
    },
    [],
  );

  // ─── Update profile + upload new avatar ──────────────────────────────────────
  // 1. Delete old avatar from Cloudinary (fire-and-forget)
  // 2. Upload new avatar → { url, publicId }
  // 3. Single Firestore updateDoc with all fields + photoURL + photoPublicId
  const updateProfileWithPhoto = useCallback(
    async (
      userId: string,
      localUri: string,
      oldPublicId: string | undefined,
      data: UpdateProfileInput,
    ): Promise<IUser> => {
      setUpdating(true);
      try {
        if (oldPublicId) void deleteImage(oldPublicId);

        const uploaded = await uploadAvatar(userId, localUri);
        if (!uploaded) throw new Error('Failed to upload profile photo.');

        const userRef = doc(db, 'Users', userId);
        const payload: Record<string, unknown> = {
          updatedAt: new Date().toISOString(),
          photoURL: uploaded.url,
          photoPublicId: uploaded.publicId,
        };
        if (data.displayName !== undefined) payload.displayName = data.displayName.trim();
        if (data.bio !== undefined) payload.bio = data.bio.trim();
        if (data.location !== undefined) payload.location = data.location.trim();
        if (data.website !== undefined) payload.website = sanitizeWebsite(data.website.trim());

        await updateDoc(userRef, payload);
        const snap = await getDoc(userRef);
        return snap.data() as IUser;
      } finally {
        setUpdating(false);
      }
    },
    [uploadAvatar, deleteImage],
  );

  // ─── Deactivate account ───────────────────────────────────────────────────────
  const deactivateAccount = useCallback(async (userId: string): Promise<void> => {
    await updateDoc(doc(db, 'Users', userId), {
      isDeactivated: true,
      isOnline: false,
      updatedAt: new Date().toISOString(),
    });
  }, []);

  // ─── Delete account ───────────────────────────────────────────────────────────
  const deleteAccount = useCallback(
    async (userId: string, photoPublicId?: string): Promise<void> => {
      if (photoPublicId) void deleteImage(photoPublicId);
      await updateDoc(doc(db, 'Users', userId), {
        isDeleted: true,
        isOnline: false,
        displayName: 'Deleted User',
        email: `deleted_${userId}@deleted.com`,
        photoURL: null,
        photoPublicId: null,
        bio: null,
        location: null,
        website: null,
        updatedAt: new Date().toISOString(),
      });
    },
    [deleteImage],
  );

  return {
    // ── Profile read ──────────────────────────────────────────────────────────
    profileData,
    loadingProfile,
    fetchProfile,
    // ── Posts ─────────────────────────────────────────────────────────────────
    posts,
    loadingPosts,
    hasMorePosts,
    fetchPosts,
    // ── Liked posts ───────────────────────────────────────────────────────────
    likedPosts,
    loadingLiked,
    hasMoreLiked,
    fetchLikedPosts,
    // ── Bookmarked posts ──────────────────────────────────────────────────────
    bookmarkedPosts,
    loadingBookmarked,
    hasMoreBookmarked,
    fetchBookmarkedPosts,
    // ── Profile write ─────────────────────────────────────────────────────────
    updating,
    uploadingPhoto: isUploadingAvatar,
    avatarProgress,
    updateProfile,
    updateProfileWithPhoto,
    deactivateAccount,
    deleteAccount,
  };
}
