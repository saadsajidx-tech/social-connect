import { useCallback, useEffect, useState } from 'react';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  GoogleAuthProvider,
  signInWithCredential,
} from '@react-native-firebase/auth';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc } from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useUser } from './useUser';
import { IUser } from '../interfaces/IUser';

export interface SignInParams {
  email: string;
  password: string;
}

export interface SignUpParams {
  name: string;
  email: string;
  password: string;
}

// ─── Auth error → human-readable string ───────────────────────────────────────

function mapAuthError(err: unknown): string {
  const e = err as FirebaseAuthTypes.NativeFirebaseAuthError;
  switch (e?.code) {
    case 'auth/invalid-email':
      return 'The email address is not valid.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/user-not-found':
      return 'No account found with this email.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again.';
    case 'auth/invalid-credential':
      return 'Email or password is incorrect.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    case 'CANCELED':
    case 'auth/google-sign-in-cancelled':
      return 'Sign-in was cancelled.';
    case 'NETWORK_ERROR':
      return 'Network error. Please check your connection.';
    default:
      return e?.message ?? 'An unexpected error occurred.';
  }
}

async function fetchProfile(uid: string): Promise<IUser | null> {
  const snap = await getDoc(doc(getFirestore(), 'Users', uid));
  return snap.exists() ? (snap.data() as IUser) : null;
}

async function createProfile(
  uid: string,
  email: string,
  displayName: string,
  photoURL?: string,
): Promise<IUser> {
  const now = new Date().toISOString();
  const profile: IUser = {
    userId: uid,
    email,
    displayName,
    ...(photoURL ? { photoURL } : {}),
    createdAt: now,
    updatedAt: now,
    emailVerified: false,
    phoneNumber: null,
    postsCount: 0,
    followersCount: 0,
    followingCount: 0,
    preferences: {
      notifications: {
        enabled: true,
        likes: true,
        comments: true,
        quietHours: { enabled: false, start: '22:00', end: '07:00' },
        sound: 'default',
        vibration: true,
      },
    },
  };
  await setDoc(doc(getFirestore(), 'Users', uid), profile);
  return profile;
}

async function setOnlineStatus(uid: string, isOnline: boolean): Promise<void> {
  await updateDoc(doc(getFirestore(), 'Users', uid), {
    isOnline,
    updatedAt: new Date().toISOString(),
  });
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth() {
  const auth = getAuth();
  const { setUser } = useUser();

  const [loading, setLoading] = useState(false);
  const [googleLoginLoading, setGoogleLoginLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    GoogleSignin.configure({
      scopes: ['email', 'profile'],
      webClientId: '629097268558-cb4l54q5uvhk402mh57ppcau2bk78oph.apps.googleusercontent.com',
    });
  }, []);
  const clearError = useCallback(() => setError(null), []);

  // ── SIGN UP — Email / Password ─────────────────────────────────────────────
  const signUp = useCallback(
    async ({ name, email, password }: SignUpParams): Promise<IUser | null> => {
      setLoading(true);
      setError(null);
      try {
        const { user: fbUser } = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(fbUser, { displayName: name });

        // Create Firestore doc with isOnline:true
        const profile = await createProfile(
          fbUser.uid,
          email,
          name,
          fbUser.photoURL || undefined, // pass undefined if null/empty
        );
        await updateDoc(doc(getFirestore(), 'Users', fbUser.uid), { isOnline: true });

        setUser({ ...profile, isOnline: true } as IUser);
        return profile;
      } catch (err) {
        setError(mapAuthError(err));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [auth, setUser],
  );

  // ── SIGN IN — Email / Password ─────────────────────────────────────────────
  const signIn = useCallback(
    async ({ email, password }: SignInParams): Promise<IUser | null> => {
      setLoading(true);
      setError(null);
      try {
        const { user: fbUser } = await signInWithEmailAndPassword(auth, email, password);

        // Fetch the full Firestore profile — includes bio, counters, preferences, etc.
        let profile = await fetchProfile(fbUser.uid);

        // Defensive: doc missing (e.g. manual DB wipe) — recreate it
        if (!profile) {
          profile = await createProfile(
            fbUser.uid,
            fbUser.email ?? email,
            fbUser.displayName ?? '',
            fbUser.photoURL || undefined,
          );
        }

        await setOnlineStatus(fbUser.uid, true);
        setUser({ ...profile, isOnline: true } as IUser);
        return profile;
      } catch (err) {
        setError(mapAuthError(err));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [auth, setUser],
  );

  // ── SIGN IN — Google ───────────────────────────────────────────────────────
  const signInWithGoogle = useCallback(async (): Promise<IUser | null> => {
    setGoogleLoginLoading(true);
    setError(null);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const { data } = await GoogleSignin.signIn();
      if (!data?.idToken) throw new Error('No ID token returned from Google.');

      const googleCredential = GoogleAuthProvider.credential(data.idToken);
      const { user: fbUser } = await signInWithCredential(auth, googleCredential);
      // Fetch existing profile or create on first Google sign-in
      let profile = await fetchProfile(fbUser.uid);
      if (!profile) {
        profile = await createProfile(
          fbUser.uid,
          fbUser.email ?? '',
          fbUser.displayName ?? '',
          fbUser.photoURL || undefined,
        );
      }

      await setOnlineStatus(fbUser.uid, true);
      setUser({ ...profile, isOnline: true } as IUser);
      return profile;
    } catch (err) {
      setError(mapAuthError(err));
      return null;
    } finally {
      setGoogleLoginLoading(false);
    }
  }, [auth, setUser]);

  // ── FORGOT PASSWORD ────────────────────────────────────────────────────────
  const forgotPassword = useCallback(
    async (email: string, onSuccess?: () => void): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        await sendPasswordResetEmail(auth, email);
        onSuccess?.();
      } catch (err) {
        setError(mapAuthError(err));
      } finally {
        setLoading(false);
      }
    },
    [auth],
  );

  // ── LOG OUT ────────────────────────────────────────────────────────────────
  const logOut = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const uid = auth.currentUser?.uid;

      // Mark offline — best-effort, never blocks logout
      if (uid) {
        try {
          await setOnlineStatus(uid, false);
        } catch {
          /* non-fatal */
        }
      }

      // Revoke Google session if that was the provider
      const providerId = auth.currentUser?.providerData[0]?.providerId;
      if (providerId === 'google.com') {
        try {
          const googleUser = await GoogleSignin.getCurrentUser();
          if (googleUser) {
            await GoogleSignin.revokeAccess();
            await GoogleSignin.signOut();
          }
        } catch {
          /* already cleared */
        }
      }

      await signOut(auth);

      // setUser(undefined) → UserProvider.useEffect detects falsy user
      // Note: UserProvider only calls saveUser when user is truthy,
      // so AsyncStorage retains the last session — users expect to stay
      // logged out. Remove it explicitly here.
      await AsyncStorage.removeItem('userData');
      setUser(undefined);
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  }, [auth, setUser]);

  return {
    loading,
    googleLoginLoading,
    error,
    clearError,
    signUp,
    signIn,
    signInWithGoogle,
    forgotPassword,
    logOut,
  };
}
