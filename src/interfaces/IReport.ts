import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

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
