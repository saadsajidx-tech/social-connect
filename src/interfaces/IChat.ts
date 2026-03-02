import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read';
export type MessageType = 'text' | 'image' | 'voice' | 'system';
export interface IReaction {
  emoji: string;
  count: number;
  userIds: string[];
}

export interface IReplyTo {
  messageId: string;
  senderId: string;
  senderName: string;
  text: string;
  type: MessageType;
}

export interface IMessage {
  messageId: string;
  chatId: string;
  senderId: string;
  text: string;
  type: MessageType;
  status: MessageStatus;
  createdAt: FirebaseFirestoreTypes.Timestamp | null;
  updatedAt?: FirebaseFirestoreTypes.Timestamp;
  replyTo?: IReplyTo;
  reactions?: IReaction[];
  voiceDuration?: string;
  voiceUrl?: string;
  imageUrl?: string;
  imagePublicId?: string;
  isDeleted?: boolean;
  deletedAt?: FirebaseFirestoreTypes.Timestamp;
}

export interface IChatParticipantDetail {
  userId: string;
  displayName: string;
  photoURL?: string;
  isOnline: boolean;
  lastSeen?: FirebaseFirestoreTypes.Timestamp;
}

export interface ILastMessage {
  messageId: string;
  text: string;
  senderId: string;
  type: MessageType;
  createdAt: FirebaseFirestoreTypes.Timestamp | null;
}

export interface IChat {
  chatId: string;
  participants: string[];
  participantDetails: Record<string, IChatParticipantDetail>;
  lastMessage?: ILastMessage;
  unreadCount: Record<string, number>;
  typingStatus: Record<string, boolean>;
  createdAt: FirebaseFirestoreTypes.Timestamp;
  updatedAt: FirebaseFirestoreTypes.Timestamp;
}

export interface IUseChatReturn {
  messages: IMessage[];
  chat: IChat | null;
  targetUser: IChatParticipantDetail | null;
  isLoading: boolean;
  isSending: boolean;
  isTargetTyping: boolean;
  sendMessage: (text: string, replyTo?: IReplyTo) => Promise<void>;
  setTyping: (typing: boolean) => void;
  markAllRead: () => Promise<void>;
}
