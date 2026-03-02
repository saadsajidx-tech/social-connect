import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

export interface IUserContext {
  user?: IUser;
  setUser: (user: IUser | undefined) => void;
  loadingSession?: boolean;
}
export interface IUser {
  userId: string;
  email: string;
  emailVerified?: boolean;
  displayName: string;
  userTagId?: string;
  photoURL?: string;
  photoPublicId?: string;
  bio?: string;
  location?: string;
  website?: string;
  isVerified?: boolean;
  isPrivate?: boolean;
  postsCount?: number;
  followersCount?: number;
  followingCount?: number;
  likesCount?: number;
  createdAt: string;
  updatedAt: string;
  phoneNumber?: string | null;
  isOnline?: boolean;
  isDeactivated?: boolean;
  isDeleted?: boolean;
  preferences?: {
    notifications: {
      enabled: boolean;
      likes: boolean;
      comments: boolean;
      quietHours: {
        enabled: boolean;
        start: string;
        end: string;
      };
      sound: string;
      vibration: boolean;
    };
  };
}

export interface IUserPreferences {
  notifications: {
    enabled: boolean;
    likes: boolean;
    comments: boolean;
    quietHours: {
      enabled: boolean;
      start: string;
      end: string;
    };
    sound: string;
    vibration: boolean;
  };
  privacy: {
    profileVisibility: 'public' | 'followers' | 'private';
    showEmail: boolean;
    showActivity: boolean;
  };
  appearance: {
    theme: 'light' | 'dark' | 'auto';
    language: string;
  };
}

export interface UpdateProfileInput {
  displayName?: string;
  userTagId?: string;
  bio?: string;
  photoURL?: string;
  location?: string;
  website?: string;
}

export interface IFollow {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: FirebaseFirestoreTypes.Timestamp;
}
export interface IMutualFollower {
  userId: string;
  displayName: string;
  photoURL?: string;
}
