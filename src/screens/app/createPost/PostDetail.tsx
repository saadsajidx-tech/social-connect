/**
 * PostDetail.tsx — two targeted fixes applied to the user's working file:
 *
 *  FIX 1 — isOwnPost moved above follow state (resolves ts(2448) used-before-declaration)
 *  FIX 2 — Follow button fully wired: Follows/{followerId}_{followingId}, optimistic UI,
 *           atomic batch (follow doc + both users' counters + notification), Follow/Following/spinner
 *  FIX 3 — @mention stripped completely from reply input and Firestore.
 *           The "Replying to Saad" banner already communicates the context — the @Saad
 *           in the TextInput was redundant and was being saved to Firestore.
 *  FIX 4 — Follow status loading state added to prevent "Follow" button flicker.
 *           Button now stays disabled during initial Firestore check, then updates to actual state.
 */

import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Clipboard from '@react-native-clipboard/clipboard';
import {
  ArrowLeft,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  MoreHorizontal,
  Send,
  Check,
  Smile,
  Eye,
  TrendingUp,
  Edit3,
  Link2,
  Flag,
  Trash2,
  CornerDownRight,
  ChevronDown,
  AlertCircle,
  X,
  UserCheck,
  UserPlus,
} from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { formatDistanceToNow } from 'date-fns';

import { Colors, Spacing, Radius, Shadow } from '../../../utilities/theme';
import { HomeStackParamList } from '../../../navigation/HomeNavigator';

import {
  collection,
  doc,
  getDoc,
  getFirestore,
  increment,
  serverTimestamp,
  writeBatch,
} from '@react-native-firebase/firestore';
import { ICommentWithUser, ReportReason } from '../../../interfaces/IPostInteractions';
import { useUser } from '../../../Hooks/useUser';
import { usePost } from '../../../Hooks/usePosts';
import { IPostWithUser } from '../../../interfaces/IPost';
import { IUser } from '../../../interfaces/IUser';
import { usePostInteractions } from '../../../Hooks/usePostInteractions';
import { useComments } from '../../../Hooks/useComments';
import { TransparentStatusBar } from '../../../component/common/TransparentStatusBar';

type Props = NativeStackScreenProps<HomeStackParamList, 'PostDetail'>;

const AVATAR_PALETTE = [
  '#7C3AED',
  '#EC4899',
  '#00B89C',
  '#F59E0B',
  '#3B82F6',
  '#EF4444',
  '#10B981',
  '#6366F1',
  '#F97316',
  '#06B6D4',
];

const APP_BASE_URL = 'https://socialconnect.app';

const formatCount = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n ?? 0);
};

const timeAgo = (date: Date | string): string => {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return '';
  }
};

const friendlyDate = (date: Date | string): string => {
  try {
    const d = new Date(date);
    return (
      d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }) +
      ' · ' +
      d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    );
  } catch {
    return '';
  }
};

const colorFromId = (id: string): string => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
};

const getInitials = (name: string): string =>
  name
    .split(' ')
    .map(w => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();

interface UserAvatarProps {
  name: string;
  photoURL?: string;
  userId: string;
  size?: number;
}

const UserAvatar: React.FC<UserAvatarProps> = ({ name, photoURL, userId, size = 38 }) => {
  const [imgError, setImgError] = useState(false);
  const color = colorFromId(userId);
  const initials = getInitials(name);
  const borderRadius = size / 2;

  if (photoURL && !imgError) {
    return (
      <Image
        source={{ uri: photoURL }}
        style={[avS.image, { width: size, height: size, borderRadius }]}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <View
      style={[
        avS.fallback,
        { width: size, height: size, borderRadius, backgroundColor: color + '22' },
      ]}>
      <Text style={[avS.initials, { color, fontSize: size * 0.36 }]}>{initials}</Text>
    </View>
  );
};

const avS = StyleSheet.create({
  image: { resizeMode: 'cover' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { fontWeight: '800' },
});

interface StatBadgeProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  color: string;
}

const StatBadge: React.FC<StatBadgeProps> = ({ icon, value, label, color }) => (
  <View style={stS.wrapper}>
    <View style={[stS.iconWrapper, { backgroundColor: color + '18' }]}>{icon}</View>
    <Text style={stS.value}>{formatCount(value)}</Text>
    <Text style={stS.label}>{label}</Text>
  </View>
);

const stS = StyleSheet.create({
  wrapper: { flex: 1, alignItems: 'center', gap: 4 },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text.primary,
    letterSpacing: -0.5,
  },
  label: { fontSize: 11, color: Colors.text.tertiary, fontWeight: '500' },
});

interface CommentCardProps {
  comment: ICommentWithUser;
  currentUserId: string;
  isReply?: boolean;
  onLike: (id: string) => void;
  onReply: (comment: ICommentWithUser) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, newText: string) => Promise<boolean>;
  onReport: (id: string) => void;
  onLoadReplies: (id: string) => void;
}

const CommentCard: React.FC<CommentCardProps> = ({
  comment,
  currentUserId,
  isReply = false,
  onLike,
  onReply,
  onDelete,
  onEdit,
  onReport,
  onLoadReplies,
}) => {
  const [showOptions, setShowOptions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text);
  const [savingEdit, setSavingEdit] = useState(false);

  const isOwn = comment.userId === currentUserId;
  const liked = comment.isLiked ?? false;
  const hasReplies = (comment.repliesCount ?? 0) > 0;
  const repliesLoaded = (comment.replies?.length ?? 0) > 0;

  const handleSaveEdit = async () => {
    if (!editText.trim() || editText.trim() === comment.text) {
      setIsEditing(false);
      setEditText(comment.text);
      return;
    }
    setSavingEdit(true);
    const success = await onEdit(comment.id, editText);
    setSavingEdit(false);
    if (success) setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditText(comment.text);
  };

  return (
    <View style={[cS.wrapper, isReply && cS.replyWrapper]}>
      <View style={cS.card}>
        <View style={cS.leftCol}>
          <UserAvatar
            name={comment.user.displayName}
            photoURL={comment.user.photoURL}
            userId={comment.userId}
            size={isReply ? 28 : 36}
          />
          {!isReply && hasReplies && <View style={cS.threadLine} />}
        </View>

        <View style={cS.content}>
          <View style={cS.header}>
            <View style={cS.nameRow}>
              <Text style={cS.name}>{comment.user.displayName}</Text>
              {comment.user.isVerified && (
                <View style={cS.verifiedBadge}>
                  <Check size={7} color={Colors.white} strokeWidth={3} />
                </View>
              )}
              {comment.isEdited && !isEditing && <Text style={cS.editedLabel}>edited</Text>}
            </View>
            <View style={cS.headerRight}>
              <Text style={cS.time}>{timeAgo(comment.createdAt)}</Text>
              {!isEditing && (
                <TouchableOpacity
                  onPress={() => setShowOptions(v => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <MoreHorizontal size={14} color={Colors.text.tertiary} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {showOptions && (
            <View style={cS.optionsMenu}>
              {isOwn ? (
                <>
                  <TouchableOpacity
                    style={cS.optionRow}
                    activeOpacity={0.7}
                    onPress={() => {
                      setShowOptions(false);
                      setIsEditing(true);
                    }}>
                    <Edit3 size={13} color={Colors.primaryLight} />
                    <Text style={cS.optionText}>Edit</Text>
                  </TouchableOpacity>
                  <View style={cS.optionDivider} />
                  <TouchableOpacity
                    style={cS.optionRow}
                    activeOpacity={0.7}
                    onPress={() => {
                      setShowOptions(false);
                      onDelete(comment.id);
                    }}>
                    <Trash2 size={13} color={Colors.error} />
                    <Text style={[cS.optionText, { color: Colors.error }]}>Delete</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={cS.optionRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    setShowOptions(false);
                    onReport(comment.id);
                  }}>
                  <Flag size={13} color={Colors.error} />
                  <Text style={[cS.optionText, { color: Colors.error }]}>Report</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {isEditing ? (
            <View style={cS.editContainer}>
              <TextInput
                style={cS.editInput}
                value={editText}
                onChangeText={setEditText}
                multiline
                autoFocus
                maxLength={1000}
                selectionColor={Colors.accent}
                placeholderTextColor={Colors.text.tertiary}
              />
              <View style={cS.editActions}>
                <TouchableOpacity
                  style={cS.editCancelBtn}
                  onPress={handleCancelEdit}
                  activeOpacity={0.7}>
                  <X size={14} color={Colors.text.tertiary} />
                  <Text style={cS.editCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    cS.editSaveBtn,
                    (!editText.trim() || editText.trim() === comment.text) &&
                      cS.editSaveBtnDisabled,
                  ]}
                  onPress={handleSaveEdit}
                  disabled={savingEdit || !editText.trim()}
                  activeOpacity={0.7}>
                  {savingEdit ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Text style={cS.editSaveText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <Text style={cS.text}>{comment.text}</Text>
          )}

          {!isEditing && (
            <View style={cS.actions}>
              <TouchableOpacity
                style={cS.actionBtn}
                onPress={() => onLike(comment.id)}
                activeOpacity={0.7}>
                <Heart
                  size={13}
                  color={liked ? Colors.error : Colors.text.tertiary}
                  fill={liked ? Colors.error : 'none'}
                />
                {comment.likesCount > 0 && (
                  <Text style={[cS.actionText, liked && { color: Colors.error }]}>
                    {formatCount(comment.likesCount)}
                  </Text>
                )}
              </TouchableOpacity>

              {!isReply && (
                <TouchableOpacity
                  style={cS.actionBtn}
                  onPress={() => onReply(comment)}
                  activeOpacity={0.7}>
                  <CornerDownRight size={13} color={Colors.text.tertiary} />
                  <Text style={cS.actionText}>Reply</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {!isReply && hasReplies && !repliesLoaded && !isEditing && (
            <TouchableOpacity
              style={cS.loadRepliesBtn}
              onPress={() => onLoadReplies(comment.id)}
              activeOpacity={0.7}>
              {comment.loadingReplies ? (
                <ActivityIndicator size="small" color={Colors.primaryLight} />
              ) : (
                <>
                  <ChevronDown size={13} color={Colors.primaryLight} />
                  <Text style={cS.loadRepliesText}>
                    {comment.repliesCount} {comment.repliesCount === 1 ? 'reply' : 'replies'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {!isReply && repliesLoaded && (
        <View>
          {(comment.replies ?? []).map(reply => (
            <CommentCard
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              isReply
              onLike={onLike}
              onReply={onReply}
              onDelete={onDelete}
              onEdit={onEdit}
              onReport={onReport}
              onLoadReplies={onLoadReplies}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const cS = StyleSheet.create({
  wrapper: { marginBottom: 2 },
  replyWrapper: { paddingLeft: 44 },
  card: {
    flexDirection: 'row',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  leftCol: { alignItems: 'center', marginRight: Spacing.sm, width: 36 },
  threadLine: {
    flex: 1,
    width: 1.5,
    backgroundColor: Colors.border.subtle,
    marginTop: 6,
    marginBottom: -Spacing.md,
  },
  content: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  name: { fontSize: 13, fontWeight: '700', color: Colors.text.primary },
  verifiedBadge: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editedLabel: { fontSize: 10, color: Colors.text.tertiary, fontStyle: 'italic' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  time: { fontSize: 11, color: Colors.text.tertiary },
  optionsMenu: {
    backgroundColor: Colors.bg.glass,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    borderRadius: Radius.md,
    marginBottom: 6,
    overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  optionDivider: { height: 1, backgroundColor: Colors.border.subtle },
  optionText: { fontSize: 13, fontWeight: '600', color: Colors.text.primary },
  editContainer: { marginBottom: 8 },
  editInput: {
    backgroundColor: Colors.bg.glass,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.35)',
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 20,
    maxHeight: 120,
    marginBottom: 8,
  },
  editActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  editCancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.bg.glass,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  editCancelText: { fontSize: 12, fontWeight: '600', color: Colors.text.tertiary },
  editSaveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    minWidth: 56,
    alignItems: 'center',
  },
  editSaveBtnDisabled: { opacity: 0.4 },
  editSaveText: { fontSize: 12, fontWeight: '700', color: Colors.white },
  text: { fontSize: 14, color: Colors.text.secondary, lineHeight: 21, marginBottom: 8 },
  actions: { flexDirection: 'row', gap: Spacing.md },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: 12, color: Colors.text.tertiary, fontWeight: '600' },
  loadRepliesBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 4 },
  loadRepliesText: { fontSize: 12, fontWeight: '700', color: Colors.primaryLight },
});

interface PostMoreMenuProps {
  visible: boolean;
  onClose: () => void;
  isOwnPost: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onShare: () => void;
  onCopyLink: () => void;
  onReport: () => void;
}

const PostMoreMenu: React.FC<PostMoreMenuProps> = ({
  visible,
  onClose,
  isOwnPost,
  onEdit,
  onDelete,
  onShare,
  onCopyLink,
  onReport,
}) => {
  if (!visible) return null;

  return (
    <Pressable style={mmS.overlay} onPress={onClose}>
      <Pressable style={mmS.sheetWrap} onPress={e => e.stopPropagation()}>
        <LinearGradient colors={['#1A1A2E', '#12121E']} style={mmS.sheetGrad}>
          <View style={mmS.handle} />
          <Text style={mmS.title}>Post Options</Text>

          {isOwnPost ? (
            <>
              <TouchableOpacity style={mmS.row} onPress={onEdit} activeOpacity={0.7}>
                <View style={[mmS.iconWrap, { backgroundColor: 'rgba(124,58,237,0.15)' }]}>
                  <Edit3 size={18} color={Colors.primaryLight} />
                </View>
                <Text style={mmS.rowText}>Edit Post</Text>
              </TouchableOpacity>

              <TouchableOpacity style={mmS.row} onPress={onShare} activeOpacity={0.7}>
                <View style={[mmS.iconWrap, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
                  <Share2 size={18} color="#3B82F6" />
                </View>
                <Text style={mmS.rowText}>Share Post</Text>
              </TouchableOpacity>

              <TouchableOpacity style={mmS.row} onPress={onCopyLink} activeOpacity={0.7}>
                <View style={[mmS.iconWrap, { backgroundColor: 'rgba(0,229,195,0.15)' }]}>
                  <Link2 size={18} color={Colors.accent} />
                </View>
                <Text style={mmS.rowText}>Copy Link</Text>
              </TouchableOpacity>

              <View style={mmS.divider} />

              <TouchableOpacity style={mmS.row} onPress={onDelete} activeOpacity={0.7}>
                <View style={[mmS.iconWrap, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
                  <Trash2 size={18} color={Colors.error} />
                </View>
                <Text style={[mmS.rowText, { color: Colors.error }]}>Delete Post</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={mmS.row} onPress={onShare} activeOpacity={0.7}>
                <View style={[mmS.iconWrap, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
                  <Share2 size={18} color="#3B82F6" />
                </View>
                <Text style={mmS.rowText}>Share Post</Text>
              </TouchableOpacity>

              <TouchableOpacity style={mmS.row} onPress={onCopyLink} activeOpacity={0.7}>
                <View style={[mmS.iconWrap, { backgroundColor: 'rgba(0,229,195,0.15)' }]}>
                  <Link2 size={18} color={Colors.accent} />
                </View>
                <Text style={mmS.rowText}>Copy Link</Text>
              </TouchableOpacity>

              <View style={mmS.divider} />

              <TouchableOpacity style={mmS.row} onPress={onReport} activeOpacity={0.7}>
                <View style={[mmS.iconWrap, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
                  <Flag size={18} color={Colors.error} />
                </View>
                <Text style={[mmS.rowText, { color: Colors.error }]}>Report Post</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={mmS.cancelBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={mmS.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </LinearGradient>
      </Pressable>
    </Pressable>
  );
};

const mmS = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheetWrap: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border.medium,
    ...Shadow.medium,
  },
  sheetGrad: { paddingBottom: Platform.OS === 'ios' ? 34 : Spacing.lg },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border.medium,
    alignSelf: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text.primary,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    letterSpacing: -0.3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { fontSize: 15, fontWeight: '600', color: Colors.text.primary, flex: 1 },
  divider: {
    height: 1,
    backgroundColor: Colors.border.subtle,
    marginVertical: Spacing.sm,
    marginHorizontal: Spacing.lg,
  },
  cancelBtn: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bg.glass,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    alignItems: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '700', color: Colors.text.secondary },
});

const pickReportReason = (): Promise<ReportReason | null> =>
  new Promise(resolve => {
    Alert.alert(
      'Report',
      'Why are you reporting this?',
      [
        { text: 'Spam', onPress: () => resolve('spam') },
        { text: 'Harassment', onPress: () => resolve('harassment') },
        { text: 'Inappropriate Content', onPress: () => resolve('inappropriate_content') },
        { text: 'Misinformation', onPress: () => resolve('misinformation') },
        { text: 'Hate Speech', onPress: () => resolve('hate_speech') },
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });

export default function PostDetail({ navigation, route }: Props) {
  const { postId } = route.params;
  const { user: currentUser } = useUser();
  const db = getFirestore();
  const { getPost, deletePost } = usePost();
  const [post, setPost] = useState<IPostWithUser | null>(null);
  const [postAuthor, setPostAuthor] = useState<IUser | null>(null);
  const [loadingPost, setLoadingPost] = useState(true);
  const [postError, setPostError] = useState<string | null>(null);

  const updatePostCommentCount = useCallback((delta: number) => {
    setPost(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        commentsCount: Math.max(0, (prev.commentsCount ?? 0) + delta),
      };
    });
  }, []);

  const interactions = usePostInteractions(post, currentUser!, false);
  const commentsHook = useComments(
    postId,
    post?.userId ?? '',
    currentUser!,
    updatePostCommentCount,
  );

  const isOwnPost = post?.userId === currentUser?.userId;

  const [isFollowing, setIsFollowing] = useState(false);
  const [followInProgress, setFollowInProgress] = useState(false);
  const [followStatusLoading, setFollowStatusLoading] = useState(true);

  const handleToggleFollow = useCallback(async () => {
    if (!post?.userId || followInProgress || isOwnPost) return;

    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
    setFollowInProgress(true);

    try {
      const followDocId = `${currentUser!.userId}_${post.userId}`;
      const followRef = doc(db, 'Follows', followDocId);
      const now = serverTimestamp();
      const batch = writeBatch(db);

      if (wasFollowing) {
        batch.delete(followRef);
        batch.update(doc(db, 'Users', currentUser!.userId), { followingCount: increment(-1) });
        batch.update(doc(db, 'Users', post.userId), { followersCount: increment(-1) });
      } else {
        batch.set(followRef, {
          followerId: currentUser!.userId,
          followingId: post.userId,
          createdAt: now,
        });
        batch.update(doc(db, 'Users', currentUser!.userId), { followingCount: increment(1) });
        batch.update(doc(db, 'Users', post.userId), { followersCount: increment(1) });

        const notifRef = doc(collection(db, 'Notifications'));
        batch.set(notifRef, {
          id: notifRef.id,
          userId: post.userId,
          type: 'follow',
          fromUserId: currentUser!.userId,
          message: `${currentUser!.displayName} started following you`,
          isRead: false,
          createdAt: now,
        });
      }

      await batch.commit();
    } catch (e) {
      console.error('[PostDetail] handleToggleFollow:', e);
      setIsFollowing(wasFollowing);
    } finally {
      setFollowInProgress(false);
    }
  }, [post?.userId, isFollowing, followInProgress, currentUser, isOwnPost]);

  const [commentText, setCommentText] = useState('');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const inputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);

  const loadPost = useCallback(async () => {
    try {
      setPostError(null);
      const data = await getPost(postId);
      if (!data) {
        setPostError('This post no longer exists.');
        setLoadingPost(false);
        return;
      }
      setPost(data);

      const userSnap = await getDoc(doc(db, 'Users', data.userId));
      if (userSnap.exists()) {
        setPostAuthor(userSnap.data() as IUser);
      }

      if (currentUser?.userId && currentUser.userId !== data.userId) {
        const followDocId = `${currentUser.userId}_${data.userId}`;
        const followSnap = await getDoc(doc(db, 'Follows', followDocId));
        setIsFollowing(followSnap.exists());
      }
      setFollowStatusLoading(false);
    } catch {
      setPostError('Failed to load post. Please try again.');
      setFollowStatusLoading(false);
    } finally {
      setLoadingPost(false);
    }
  }, [postId, currentUser?.userId]);

  useEffect(() => {
    void loadPost();
  }, [loadPost]);

  useEffect(() => {
    if (post?.postId) void commentsHook.loadComments();
  }, [post?.postId]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadPost(), commentsHook.loadComments()]);
    setRefreshing(false);
  }, [loadPost, commentsHook.loadComments]);

  useEffect(() => {
    if (commentsHook.replyingTo) {
      setCommentText('');
      setTimeout(() => {
        inputRef.current?.focus();
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 200);
    }
  }, [commentsHook.replyingTo]);

  const handleSend = useCallback(async () => {
    if (!commentText.trim() || commentsHook.submittingComment) return;
    const text = commentText.trim();
    setCommentText('');
    if (commentsHook.replyingTo) {
      await commentsHook.submitReply(commentsHook.replyingTo.id, text);
    } else {
      await commentsHook.submitComment(text);
    }
  }, [commentText, commentsHook]);

  const handleCancelReply = useCallback(() => {
    commentsHook.setReplyingTo(null);
    setCommentText('');
  }, [commentsHook.setReplyingTo]);

  const handleDeletePost = useCallback(() => {
    setShowMoreMenu(false);
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deletePost(postId, currentUser!.userId);
            if (success) navigation.goBack();
          },
        },
      ],
    );
  }, [postId, currentUser, navigation]);

  const handleDeleteComment = useCallback(
    (commentId: string) => {
      Alert.alert('Delete Comment', 'Delete this comment? This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => commentsHook.deleteComment(commentId),
        },
      ]);
    },
    [commentsHook.deleteComment],
  );

  const handleCopyLink = useCallback(() => {
    setShowMoreMenu(false);
    const url = `${APP_BASE_URL}/post/${postId}`;
    Clipboard.setString(url);
    Alert.alert('Link Copied', 'Post link has been copied to your clipboard.');
  }, [postId]);

  const handleReportPost = useCallback(async () => {
    setShowMoreMenu(false);
    const reason = await pickReportReason();
    if (!reason) return;
    if (!interactions.reportPost) return;
    const success = await interactions.reportPost(reason);
    if (success) {
      Alert.alert(
        'Report Submitted',
        'Thank you for your report. We will review it and take appropriate action.',
      );
    } else {
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    }
  }, [interactions.reportPost]);

  const handleReportComment = useCallback(
    async (commentId: string) => {
      const reason = await pickReportReason();
      if (!reason) return;
      const success = await commentsHook.reportComment(commentId, reason);
      if (success) {
        Alert.alert(
          'Report Submitted',
          'Thank you for your report. We will review it and take appropriate action.',
        );
      } else {
        Alert.alert('Error', 'Failed to submit report. Please try again.');
      }
    },
    [commentsHook.reportComment],
  );

  const formatContent = (text: string) =>
    text.split(/(\s+)/).map((word, i) => {
      if (word.startsWith('#'))
        return (
          <Text key={i} style={s.hashtag}>
            {word}
          </Text>
        );
      if (word.startsWith('@'))
        return (
          <Text key={i} style={s.mention}>
            {word}
          </Text>
        );
      return <Text key={i}>{word}</Text>;
    });

  if (loadingPost) {
    return (
      <View style={[s.root, s.centered]}>
        <TransparentStatusBar />
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={s.loadingLabel}>Loading post…</Text>
      </View>
    );
  }

  if (postError || !post) {
    return (
      <View style={[s.root, s.centered]}>
        <TransparentStatusBar />
        <TouchableOpacity
          style={s.backBtnAbs}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}>
          <ArrowLeft size={20} color={Colors.text.secondary} />
        </TouchableOpacity>
        <AlertCircle size={40} color={Colors.text.tertiary} />
        <Text style={s.errorText}>{postError ?? 'Post not found.'}</Text>
        <TouchableOpacity style={s.retryBtn} onPress={loadPost} activeOpacity={0.8}>
          <Text style={s.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const authorName = postAuthor?.displayName ?? 'Unknown';
  const authorPhotoURL = postAuthor?.photoURL;
  const authorIsVerified = postAuthor?.isVerified ?? false;

  return (
    <View style={s.root}>
      <TransparentStatusBar />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <ArrowLeft size={20} color={Colors.text.secondary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Post</Text>
        <TouchableOpacity
          style={s.moreBtn}
          onPress={() => setShowMoreMenu(true)}
          activeOpacity={0.7}>
          <MoreHorizontal size={20} color={Colors.text.secondary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          ref={scrollRef}
          style={s.flex}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primaryLight}
              colors={[Colors.primary]}
            />
          }
          onScrollEndDrag={({ nativeEvent }) => {
            const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
            const nearBottom =
              layoutMeasurement.height + contentOffset.y >= contentSize.height - 100;
            if (nearBottom && commentsHook.hasMoreComments && !commentsHook.loadingMoreComments) {
              void commentsHook.loadMoreComments();
            }
          }}>
          <View style={s.authorSection}>
            <TouchableOpacity
              style={s.authorRow}
              activeOpacity={0.8}
              onPress={() => {
                if (!postAuthor?.userId) return;

                navigation.navigate('ViewUserProfile', {
                  userId: postAuthor.userId,
                });
              }}>
              <UserAvatar
                name={authorName}
                photoURL={authorPhotoURL}
                userId={post.userId}
                size={50}
              />
              <View>
                <View style={s.nameRow}>
                  <Text style={s.authorName}>{authorName}</Text>
                  {authorIsVerified && (
                    <View style={s.verifiedBadge}>
                      <Check size={9} color={Colors.white} strokeWidth={3} />
                    </View>
                  )}
                </View>
                <Text style={s.authorHandle}>{timeAgo(post.createdAt)}</Text>
              </View>
            </TouchableOpacity>

            {!isOwnPost && (
              <TouchableOpacity
                style={s.followBtn}
                onPress={handleToggleFollow}
                disabled={followInProgress || followStatusLoading}
                activeOpacity={0.85}>
                {followStatusLoading || followInProgress ? (
                  <View style={[s.followBtnInner, s.followBtnOutlined]}>
                    <ActivityIndicator size="small" color={Colors.primaryLight} />
                  </View>
                ) : isFollowing ? (
                  <View style={[s.followBtnInner, s.followBtnOutlined]}>
                    <UserCheck size={14} color={Colors.text.secondary} />
                    <Text style={s.followBtnTextOut}>Following</Text>
                  </View>
                ) : (
                  <LinearGradient colors={['#7C3AED', '#9D6FFF']} style={s.followBtnInner}>
                    <UserPlus size={14} color={Colors.white} />
                    <Text style={s.followBtnTextFill}>Follow</Text>
                  </LinearGradient>
                )}
              </TouchableOpacity>
            )}
          </View>

          <Text style={s.postContent}>{formatContent(post.content)}</Text>

          <Text style={s.timestamp}>
            {friendlyDate(post.createdAt)}
            {post.isEdited && <Text style={s.editedLabel}> · edited</Text>}
          </Text>

          <View style={s.statsCard}>
            <LinearGradient
              colors={['rgba(124,58,237,0.08)', 'rgba(0,229,195,0.04)']}
              style={s.statsGrad}>
              <StatBadge
                icon={<Heart size={16} color={Colors.error} fill={Colors.error} />}
                value={interactions.likesCount}
                label="Likes"
                color={Colors.error}
              />
              <View style={s.statDivider} />
              <StatBadge
                icon={<MessageCircle size={16} color={Colors.primaryLight} />}
                value={post.commentsCount}
                label="Comments"
                color={Colors.primary}
              />
              <View style={s.statDivider} />
              <StatBadge
                icon={<Share2 size={16} color={Colors.accent} />}
                value={interactions.sharesCount}
                label="Shares"
                color={Colors.accent}
              />
              <View style={s.statDivider} />
              <StatBadge
                icon={<Eye size={16} color={Colors.warning} />}
                value={interactions.viewsCount}
                label="Views"
                color={Colors.warning}
              />
            </LinearGradient>
          </View>

          <View style={s.actionBar}>
            <TouchableOpacity
              style={[s.actionBtn, interactions.isLiked && s.actionBtnActive]}
              onPress={interactions.toggleLike}
              disabled={interactions.likingInProgress}
              activeOpacity={0.7}>
              {interactions.likingInProgress ? (
                <ActivityIndicator size="small" color={Colors.error} />
              ) : (
                <Heart
                  size={20}
                  color={interactions.isLiked ? Colors.error : Colors.text.secondary}
                  fill={interactions.isLiked ? Colors.error : 'none'}
                />
              )}
              <Text style={[s.actionBtnText, interactions.isLiked && { color: Colors.error }]}>
                {interactions.isLiked ? 'Liked' : 'Like'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.actionBtn}
              onPress={interactions.handleShare}
              disabled={interactions.sharingInProgress}
              activeOpacity={0.7}>
              {interactions.sharingInProgress ? (
                <ActivityIndicator size="small" color={Colors.text.secondary} />
              ) : (
                <Share2 size={20} color={Colors.text.secondary} />
              )}
              <Text style={s.actionBtnText}>Share</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.actionBtn, interactions.isSaved && s.actionBtnSaved]}
              onPress={interactions.toggleSave}
              disabled={interactions.savingInProgress}
              activeOpacity={0.7}>
              {interactions.savingInProgress ? (
                <ActivityIndicator size="small" color={Colors.accent} />
              ) : (
                <Bookmark
                  size={20}
                  color={interactions.isSaved ? Colors.accent : Colors.text.secondary}
                  fill={interactions.isSaved ? Colors.accent : 'none'}
                />
              )}
              <Text style={[s.actionBtnText, interactions.isSaved && { color: Colors.accent }]}>
                {interactions.isSaved ? 'Saved' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={s.commentsSectionHeader}>
            <Text style={s.commentsTitle}>
              Comments
              <Text style={s.commentsCount}> · {post.commentsCount}</Text>
            </Text>
            <TouchableOpacity style={s.sortBtn} activeOpacity={0.7}>
              <TrendingUp size={14} color={Colors.text.tertiary} />
              <Text style={s.sortText}>Latest</Text>
            </TouchableOpacity>
          </View>

          {commentsHook.error && (
            <View style={s.errorBanner}>
              <AlertCircle size={14} color={Colors.error} />
              <Text style={s.errorBannerText}>{commentsHook.error}</Text>
              <TouchableOpacity
                onPress={commentsHook.clearError}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={14} color={Colors.error} />
              </TouchableOpacity>
            </View>
          )}

          {commentsHook.loadingComments ? (
            <View style={s.commentsLoader}>
              <ActivityIndicator size="small" color={Colors.primaryLight} />
              <Text style={s.loadingText}>Loading comments…</Text>
            </View>
          ) : commentsHook.comments.length === 0 ? (
            <View style={s.emptyComments}>
              <MessageCircle size={32} color={Colors.text.tertiary} />
              <Text style={s.emptyTitle}>No comments yet</Text>
              <Text style={s.emptySubtitle}>Be the first to share your thoughts!</Text>
            </View>
          ) : (
            commentsHook.comments.map(comment => (
              <CommentCard
                key={comment.id}
                comment={comment}
                currentUserId={currentUser!.userId}
                onLike={commentsHook.toggleCommentLike}
                onReply={commentsHook.setReplyingTo}
                onDelete={handleDeleteComment}
                onEdit={commentsHook.editComment}
                onReport={handleReportComment}
                onLoadReplies={commentsHook.loadReplies}
              />
            ))
          )}

          {commentsHook.hasMoreComments && !commentsHook.loadingComments && (
            <TouchableOpacity
              style={s.loadMoreBtn}
              onPress={commentsHook.loadMoreComments}
              activeOpacity={0.7}>
              {commentsHook.loadingMoreComments ? (
                <ActivityIndicator size="small" color={Colors.primaryLight} />
              ) : (
                <Text style={s.loadMoreText}>Load more comments</Text>
              )}
            </TouchableOpacity>
          )}

          <View style={{ height: 90 }} />
        </ScrollView>

        <View style={s.commentInputWrapper}>
          {commentsHook.replyingTo && (
            <View style={s.replyIndicator}>
              <CornerDownRight size={13} color={Colors.primaryLight} />
              <Text style={s.replyIndicatorText} numberOfLines={1}>
                Replying to{' '}
                <Text style={{ color: Colors.primaryLight, fontWeight: '700' }}>
                  {commentsHook.replyingTo.user.displayName}
                </Text>
              </Text>
              <TouchableOpacity
                onPress={handleCancelReply}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={14} color={Colors.text.tertiary} />
              </TouchableOpacity>
            </View>
          )}

          <View style={s.commentInputInner}>
            <UserAvatar
              name={currentUser?.displayName ?? 'U'}
              photoURL={currentUser?.photoURL}
              userId={currentUser?.userId ?? ''}
              size={36}
            />

            <View style={[s.commentInput, commentText.length > 0 && s.commentInputActive]}>
              <TextInput
                ref={inputRef}
                style={s.commentTextInput}
                placeholder={
                  commentsHook.replyingTo
                    ? `Reply to ${commentsHook.replyingTo.user.displayName}…`
                    : 'Add a comment…'
                }
                placeholderTextColor={Colors.text.tertiary}
                value={commentText}
                onChangeText={setCommentText}
                multiline
                maxLength={1000}
                selectionColor={Colors.accent}
                returnKeyType="default"
                blurOnSubmit={false}
              />
              <TouchableOpacity style={s.emojiBtn} activeOpacity={0.7}>
                <Smile size={18} color={Colors.text.tertiary} />
              </TouchableOpacity>
            </View>

            {commentText.trim().length > 0 && (
              <TouchableOpacity
                style={s.sendBtn}
                onPress={handleSend}
                disabled={commentsHook.submittingComment}
                activeOpacity={0.85}>
                {commentsHook.submittingComment ? (
                  <View style={[s.sendBtnGrad, { backgroundColor: Colors.primary }]}>
                    <ActivityIndicator size="small" color={Colors.white} />
                  </View>
                ) : (
                  <LinearGradient colors={['#7C3AED', '#00E5C3']} style={s.sendBtnGrad}>
                    <Send size={16} color={Colors.white} />
                  </LinearGradient>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      <PostMoreMenu
        visible={showMoreMenu}
        onClose={() => setShowMoreMenu(false)}
        isOwnPost={isOwnPost}
        onEdit={() => {
          setShowMoreMenu(false);
          navigation.navigate('WritePost', { postId: post.postId });
        }}
        onDelete={handleDeletePost}
        onShare={() => {
          setShowMoreMenu(false);
          interactions.handleShare();
        }}
        onCopyLink={handleCopyLink}
        onReport={handleReportPost}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg.primary },
  flex: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: Colors.bg.primary,
  },
  loadingLabel: { fontSize: 14, color: Colors.text.tertiary, marginTop: 8 },
  errorText: {
    fontSize: 15,
    color: Colors.text.tertiary,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
  retryBtn: {
    marginTop: 4,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(124,58,237,0.15)',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  retryText: { color: Colors.primaryLight, fontWeight: '700', fontSize: 14 },
  backBtnAbs: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 20,
    left: Spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.bg.glass,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.bg.glass,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.text.primary, letterSpacing: -0.3 },
  moreBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: { paddingBottom: 20 },
  authorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  authorName: { fontSize: 16, fontWeight: '700', color: Colors.text.primary, letterSpacing: -0.3 },
  verifiedBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorHandle: { fontSize: 13, color: Colors.text.tertiary, marginTop: 2 },

  followBtn: { borderRadius: Radius.full, overflow: 'hidden', ...Shadow.brand },
  followBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    minWidth: 104,
    justifyContent: 'center',
  },
  followBtnOutlined: {
    backgroundColor: Colors.bg.glass,
    borderWidth: 1,
    borderColor: Colors.border.medium,
  },
  followBtnTextFill: { fontSize: 13, fontWeight: '700', color: Colors.white },
  followBtnTextOut: { fontSize: 13, fontWeight: '700', color: Colors.text.secondary },

  postContent: {
    fontSize: 18,
    lineHeight: 28,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  hashtag: { color: Colors.primaryLight, fontWeight: '600' },
  mention: { color: Colors.accent, fontWeight: '600' },
  timestamp: {
    fontSize: 13,
    color: Colors.text.tertiary,
    marginBottom: Spacing.lg,
    fontWeight: '500',
    paddingHorizontal: Spacing.lg,
  },
  editedLabel: { fontSize: 12, color: Colors.text.tertiary, fontStyle: 'italic' },
  statsCard: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    marginBottom: Spacing.lg,
    marginHorizontal: Spacing.lg,
    ...Shadow.soft,
  },
  statsGrad: { flexDirection: 'row', paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm },
  statDivider: { width: 1, backgroundColor: Colors.border.subtle, marginVertical: 4 },
  actionBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border.subtle,
    marginBottom: Spacing.lg,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: 6,
  },
  actionBtnActive: { backgroundColor: 'rgba(239,68,68,0.06)' },
  actionBtnSaved: { backgroundColor: 'rgba(0,229,195,0.06)' },
  actionBtnText: { fontSize: 14, fontWeight: '600', color: Colors.text.secondary },
  commentsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  commentsTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text.primary,
    letterSpacing: -0.4,
  },
  commentsCount: { color: Colors.text.tertiary, fontWeight: '400' },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.bg.glass,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  sortText: { fontSize: 12, fontWeight: '600', color: Colors.text.tertiary },
  commentsLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 32,
  },
  loadingText: { fontSize: 14, color: Colors.text.tertiary },
  emptyComments: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.text.secondary, marginTop: 4 },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.text.tertiary,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  loadMoreBtn: { paddingVertical: Spacing.lg, alignItems: 'center' },
  loadMoreText: { fontSize: 14, fontWeight: '600', color: Colors.primaryLight },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.sm,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  errorBannerText: { fontSize: 13, color: Colors.error, flex: 1 },
  commentInputWrapper: {
    backgroundColor: Colors.bg.primary,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? 30 : 12,
  },
  replyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  replyIndicatorText: { flex: 1, fontSize: 12, color: Colors.text.tertiary },
  commentInputInner: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  commentInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: Colors.bg.glass,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    maxHeight: 120,
  },
  commentInputActive: {
    borderColor: 'rgba(124,58,237,0.4)',
    backgroundColor: 'rgba(124,58,237,0.04)',
  },
  commentTextInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text.primary,
    maxHeight: 100,
    lineHeight: 20,
  },
  emojiBtn: { paddingBottom: 2, paddingLeft: 6 },
  sendBtn: { borderRadius: 18, overflow: 'hidden', ...Shadow.brand },
  sendBtnGrad: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
