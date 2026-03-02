import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { IUser } from './IUser';

export interface IComment {
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

export interface ICommentWithUser extends Omit<IComment, 'createdAt' | 'updatedAt'> {
  id: string;
  user: {
    userId: string;
    displayName: string;
    photoURL?: string;
    isVerified?: boolean;
  };
  isLiked?: boolean;
  createdAt: Date;
  updatedAt: Date;
  replies?: ICommentWithUser[];
  loadingReplies?: boolean;
  hasMoreReplies?: boolean;
}

export interface ICommentLike {
  commentId: string;
  userId: string;
  postId: string;
  createdAt: FirebaseFirestoreTypes.Timestamp;
}

export interface IPostLike {
  postId: string;
  userId: string;
  createdAt: FirebaseFirestoreTypes.Timestamp;
}

export interface IPostView {
  postId: string;
  userId: string;
  viewedAt: FirebaseFirestoreTypes.Timestamp;
}

export interface IBookmark {
  postId: string;
  userId: string;
  createdAt: FirebaseFirestoreTypes.Timestamp;
}

export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'inappropriate_content'
  | 'misinformation'
  | 'hate_speech'
  | 'violence'
  | 'other';

export type ReportTargetType = 'post' | 'comment';

export interface IReport {
  id: string;
  type: ReportTargetType;
  targetId: string;
  targetUserId: string;
  reportedBy: string;
  reason: ReportReason;
  createdAt: FirebaseFirestoreTypes.Timestamp;
}

export type NotificationType = 'like' | 'comment' | 'reply' | 'comment_like' | 'follow' | 'mention';

export interface INotification {
  id: string;
  userId: string;
  type: NotificationType;
  fromUserId: string;
  fromUser?: Pick<IUser, 'userId' | 'displayName' | 'photoURL'>;
  postId?: string;
  commentId?: string;
  message: string;
  isRead: boolean;
  createdAt: FirebaseFirestoreTypes.Timestamp;
}

export interface IUseCommentsReturn {
  comments: ICommentWithUser[];
  loadingComments: boolean;
  loadingMoreComments: boolean;
  hasMoreComments: boolean;
  submittingComment: boolean;
  error: string | null;
  loadComments: () => Promise<void>;
  loadMoreComments: () => Promise<void>;
  submitComment: (text: string) => Promise<boolean>;
  submitReply: (parentCommentId: string, text: string) => Promise<boolean>;
  loadReplies: (parentCommentId: string) => Promise<void>;
  toggleCommentLike: (commentId: string) => Promise<void>;
  deleteComment: (commentId: string) => Promise<boolean>;
  editComment: (commentId: string, newText: string) => Promise<boolean>;
  reportComment: (commentId: string, reason: ReportReason) => Promise<boolean>;
  replyingTo: ICommentWithUser | null;
  setReplyingTo: (comment: ICommentWithUser | null) => void;

  clearError: () => void;
}

export interface IUsePostInteractionsReturn {
  isLiked: boolean;
  likesCount: number;
  likingInProgress: boolean;
  toggleLike: () => Promise<void>;
  sharesCount: number;
  sharingInProgress: boolean;
  handleShare: () => Promise<void>;
  viewsCount: number;
  isSaved: boolean;
  savingInProgress: boolean;
  toggleSave: () => Promise<void>;
  reportPost: (reason: ReportReason) => Promise<boolean>;
}

export interface IPaginatedComments {
  comments: ICommentWithUser[];
  lastDoc?: FirebaseFirestoreTypes.QueryDocumentSnapshot;
  hasMore: boolean;
}
