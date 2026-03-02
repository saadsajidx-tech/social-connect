import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

export interface IPost {
  postId: string;
  userId: string;
  content: string;
  images: {
    url: string;
    publicId: string;
    width: number;
    height: number;
    size: number;
  }[];
  visibility: 'public' | 'followers' | 'private';
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  hashtags: string[];
  mentions: string[];
  isEdited: boolean;
  createdAt: FirebaseFirestoreTypes.Timestamp;
  updatedAt: FirebaseFirestoreTypes.Timestamp;
}

export interface IPostWithUser extends Omit<IPost, 'createdAt' | 'updatedAt'> {
  user?: {
    userId: string;
    displayName: string;
    photoURL?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  isLiked?: boolean;
}

export interface ICreatePost {
  content: string;
  images?: {
    uri: string;
    type?: string;
    name?: string;
  }[];

  existingImages?: IPost['images'];
  visibility: 'public' | 'followers' | 'private';
}

export interface IImageProgress {
  uri: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  url?: string;
  error?: string;
}

export interface IPaginationParams {
  limit?: number;
  lastDoc?: FirebaseFirestoreTypes.DocumentSnapshot;
  userId?: string;
}

export interface IPaginatedPosts {
  posts: IPostWithUser[];
  lastDoc?: FirebaseFirestoreTypes.DocumentSnapshot;
  hasMore: boolean;
}
