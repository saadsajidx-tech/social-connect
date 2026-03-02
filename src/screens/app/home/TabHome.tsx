import React, { useState, useCallback, useEffect, useRef } from 'react';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabParamList } from '../../../navigation/BottomTabs';
import type { HomeStackParamList } from '../../../navigation/HomeNavigator';

import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
  Animated,
  ScrollView,
  Share,
  Modal,
  Pressable,
  Platform,
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Clipboard from '@react-native-clipboard/clipboard';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  MoreHorizontal,
  Bell,
  Search,
  Plus,
  TrendingUp,
  Check,
  ChevronUp,
  AlertCircle,
  Users,
  Zap,
  Flag,
  Link,
  Pencil,
  Trash2,
  X,
} from 'lucide-react-native';
import {
  getFirestore,
  collection,
  doc,
  writeBatch,
  increment,
  serverTimestamp,
} from '@react-native-firebase/firestore';

import { Colors, Spacing, Radius, Shadow } from '../../../utilities/theme';
import { useUser } from '../../../Hooks/useUser';
import { useFeed } from '../../../Hooks/useFeed';
import type { IFeedPost, FeedFilter } from '../../../Hooks/useFeed';
import { usePost } from '../../../Hooks/usePosts';
import { TransparentStatusBar } from '../../../component/common/TransparentStatusBar';

const { width } = Dimensions.get('window');

type ReportReason =
  | 'spam'
  | 'harassment'
  | 'inappropriate_content'
  | 'misinformation'
  | 'hate_speech';

const getGreeting = (): string => {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 21) return 'Good evening';
  return 'Good night';
};

const formatRelativeTime = (date: Date): string => {
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatCount = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

const AVATAR_PALETTE = [
  '#7C3AED',
  '#00B89C',
  '#F59E0B',
  '#EF4444',
  '#3B82F6',
  '#EC4899',
  '#10B981',
];

interface UserAvatarProps {
  photoURL?: string;
  displayName: string;
  size?: number;
  style?: object;
}

const UserAvatar = ({ photoURL, displayName, size = 44, style }: UserAvatarProps) => {
  const [imgError, setImgError] = useState(false);
  const initial = (displayName?.charAt(0) ?? '?').toUpperCase();
  const avatarColor = AVATAR_PALETTE[(displayName?.charCodeAt(0) ?? 0) % AVATAR_PALETTE.length];

  if (photoURL && !imgError) {
    return (
      <Image
        source={{ uri: photoURL }}
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 1.5,
            borderColor: Colors.border.subtle,
          },
          style,
        ]}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: avatarColor + '25',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1.5,
          borderColor: Colors.border.subtle,
        },
        style,
      ]}>
      <Text style={{ fontSize: size * 0.4, fontWeight: '800', color: avatarColor }}>{initial}</Text>
    </View>
  );
};

interface MoreSheetProps {
  visible: boolean;
  post: IFeedPost | null;
  currentUserId: string;
  onClose: () => void;
  onEdit: (post: IFeedPost) => void;
  onDelete: (post: IFeedPost) => void;
  onReport: (post: IFeedPost) => void;
  onCopyLink: (post: IFeedPost) => void;
}

const MoreSheet = ({
  visible,
  post,
  currentUserId,
  onClose,
  onEdit,
  onDelete,
  onReport,
  onCopyLink,
}: MoreSheetProps) => {
  const translateY = useRef(new Animated.Value(300)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          tension: 80,
          friction: 12,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 300, duration: 220, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, translateY, backdropOpacity]);

  if (!post) return null;

  const isOwnPost = post.userId === currentUserId;

  interface SheetAction {
    icon: React.ReactNode;
    label: string;
    onPress: () => void;
    destructive?: boolean;
  }

  const ownActions: SheetAction[] = [
    {
      icon: <Pencil size={20} color={Colors.text.secondary} />,
      label: 'Edit post',
      onPress: () => {
        onClose();
        onEdit(post);
      },
    },
    {
      icon: <Link size={20} color={Colors.text.secondary} />,
      label: 'Copy link',
      onPress: () => {
        onClose();
        onCopyLink(post);
      },
    },
    {
      icon: <Trash2 size={20} color={Colors.error} />,
      label: 'Delete post',
      destructive: true,
      onPress: () => {
        onClose();
        onDelete(post);
      },
    },
  ];

  const otherActions: SheetAction[] = [
    {
      icon: <Link size={20} color={Colors.text.secondary} />,
      label: 'Copy link',
      onPress: () => {
        onClose();
        onCopyLink(post);
      },
    },
    {
      icon: <Flag size={20} color={Colors.warning} />,
      label: 'Report post',
      onPress: () => {
        onClose();
        onReport(post);
      },
    },
  ];

  const actions = isOwnPost ? ownActions : otherActions;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[moreStyles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[moreStyles.sheet, { transform: [{ translateY }] }]}>
        <View style={moreStyles.handle} />

        <View style={moreStyles.preview}>
          <UserAvatar
            photoURL={post.author.photoURL}
            displayName={post.author.displayName}
            size={38}
          />
          <View style={moreStyles.previewText}>
            <Text style={moreStyles.previewName} numberOfLines={1}>
              {post.author.displayName}
            </Text>
            <Text style={moreStyles.previewContent} numberOfLines={1}>
              {post.content.slice(0, 60)}
              {post.content.length > 60 ? '…' : ''}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={moreStyles.closeBtn} activeOpacity={0.7}>
            <X size={18} color={Colors.text.tertiary} />
          </TouchableOpacity>
        </View>

        <View style={moreStyles.divider} />

        {actions.map((action, i) => (
          <TouchableOpacity
            key={i}
            style={moreStyles.actionRow}
            onPress={action.onPress}
            activeOpacity={0.7}>
            <View
              style={[
                moreStyles.actionIcon,
                action.destructive && { backgroundColor: 'rgba(239,68,68,0.1)' },
              ]}>
              {action.icon}
            </View>
            <Text style={[moreStyles.actionLabel, action.destructive && { color: Colors.error }]}>
              {action.label}
            </Text>
          </TouchableOpacity>
        ))}

        <View style={{ height: Platform.OS === 'ios' ? 28 : 16 }} />
      </Animated.View>
    </Modal>
  );
};

const moreStyles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.bg.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    paddingTop: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border.medium,
    alignSelf: 'center',
    marginBottom: 16,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: 14,
    gap: Spacing.sm,
  },
  previewText: { flex: 1 },
  previewName: { fontSize: 14, fontWeight: '700', color: Colors.text.primary, letterSpacing: -0.2 },
  previewContent: { fontSize: 12, color: Colors.text.tertiary, marginTop: 2 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.bg.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { height: 1, backgroundColor: Colors.border.subtle, marginBottom: 8 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    gap: Spacing.md,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.bg.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { fontSize: 15, fontWeight: '600', color: Colors.text.primary },
});

interface PostCardProps {
  post: IFeedPost;
  currentUserId: string;
  onLike: (postId: string, currentlyLiked: boolean) => void;
  onBookmark: (postId: string, currentlyBookmarked: boolean) => void;
  onMorePress: (post: IFeedPost) => void;
  navigation: any;
}

const PostCard = React.memo(
  ({ post, currentUserId, onLike, onBookmark, onMorePress, navigation }: PostCardProps) => {
    const db = getFirestore();
    const likeScale = useRef(new Animated.Value(1)).current;
    const bookmarkScale = useRef(new Animated.Value(1)).current;
    const [sharingInProgress, setSharingInProgress] = useState(false);

    const handleLike = useCallback(() => {
      Animated.sequence([
        Animated.timing(likeScale, { toValue: 1.4, duration: 100, useNativeDriver: true }),
        Animated.spring(likeScale, { toValue: 1, useNativeDriver: true }),
      ]).start();
      onLike(post.postId, post.isLiked);
    }, [post.postId, post.isLiked, onLike, likeScale]);

    const handleBookmark = useCallback(() => {
      Animated.sequence([
        Animated.timing(bookmarkScale, { toValue: 1.3, duration: 100, useNativeDriver: true }),
        Animated.spring(bookmarkScale, { toValue: 1, useNativeDriver: true }),
      ]).start();
      onBookmark(post.postId, post.isBookmarked);
    }, [post.postId, post.isBookmarked, onBookmark, bookmarkScale]);

    const handleShare = useCallback(async () => {
      if (sharingInProgress) return;
      setSharingInProgress(true);
      try {
        const result = await Share.share(
          {
            message: `${post.author.displayName} on the app:\n\n${post.content}`,
            url: `https://yourapp.com/post/${post.postId}`,
            title: 'Check out this post',
          },
          { dialogTitle: 'Share this post', subject: `Post by ${post.author.displayName}` },
        );
        if (result.action === Share.sharedAction) {
          const batch = writeBatch(db);
          batch.update(doc(collection(db, 'Posts'), post.postId), {
            sharesCount: increment(1),
            updatedAt: serverTimestamp(),
          });
          await batch.commit();
        }
      } catch {
      } finally {
        setSharingInProgress(false);
      }
    }, [post.postId, post.author.displayName, post.content, sharingInProgress, db]);

    const renderContent = useCallback(
      () => (
        <Text style={postStyles.content}>
          {post.content.split(' ').map((word, i) => {
            if (word.startsWith('#'))
              return (
                <Text key={i} style={postStyles.hashtag}>
                  {word}{' '}
                </Text>
              );
            if (word.startsWith('@'))
              return (
                <Text key={i} style={postStyles.mention}>
                  {word}{' '}
                </Text>
              );
            return (
              <Text key={i} style={postStyles.contentText}>
                {word}{' '}
              </Text>
            );
          })}
        </Text>
      ),
      [post.content],
    );

    const renderImages = useCallback(() => {
      const imgs = post.images ?? [];
      if (!imgs.length) return null;
      if (imgs.length === 1) {
        return (
          <View style={postStyles.singleImageWrapper}>
            <Image
              source={{ uri: imgs[0].url }}
              style={postStyles.singleImage}
              resizeMode="cover"
            />
          </View>
        );
      }
      if (imgs.length === 2) {
        return (
          <View style={postStyles.twoImages}>
            {imgs.map((img, i) => (
              <Image
                key={i}
                source={{ uri: img.url }}
                style={postStyles.halfImage}
                resizeMode="cover"
              />
            ))}
          </View>
        );
      }
      return (
        <View style={postStyles.multiGrid}>
          <Image source={{ uri: imgs[0].url }} style={postStyles.gridMain} resizeMode="cover" />
          <View style={postStyles.gridSide}>
            {imgs.slice(1, 4).map((img, i) => {
              const showOverlay = i === 2 && imgs.length > 4;
              return (
                <View key={i} style={postStyles.gridSmallWrapper}>
                  <Image
                    source={{ uri: img.url }}
                    style={postStyles.gridSmall}
                    resizeMode="cover"
                  />
                  {showOverlay && (
                    <View style={postStyles.moreOverlay}>
                      <Text style={postStyles.moreOverlayText}>+{imgs.length - 3}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      );
    }, [post.images]);

    return (
      <View style={postStyles.card}>
        <View style={postStyles.header}>
          <TouchableOpacity
            style={postStyles.userRow}
            activeOpacity={0.75}
            onPress={() => navigation.navigate('ViewUserProfile', { userId: post.author.userId })}>
            <UserAvatar
              photoURL={post.author.photoURL}
              displayName={post.author.displayName}
              size={44}
              style={postStyles.avatarSpacing}
            />
            <View style={postStyles.userInfo}>
              <View style={postStyles.nameRow}>
                <Text style={postStyles.name} numberOfLines={1}>
                  {post.author.displayName}
                </Text>
                {post.author.verified && (
                  <View style={postStyles.verifiedBadge}>
                    <Check size={9} color="#fff" strokeWidth={3} />
                  </View>
                )}
              </View>
              <View style={postStyles.metaRow}>
                <Text style={postStyles.handle}>{post.author.handle}</Text>
                <Text style={postStyles.dot}>·</Text>
                <Text style={postStyles.time}>{formatRelativeTime(post.createdAt)}</Text>
                {post.isEdited && (
                  <>
                    <Text style={postStyles.dot}>·</Text>
                    <Text style={postStyles.edited}>Edited</Text>
                  </>
                )}
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={postStyles.moreBtn}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => onMorePress(post)}>
            <MoreHorizontal size={20} color={Colors.text.tertiary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => navigation.navigate('PostDetail', { postId: post.postId })}>
          {renderContent()}
          {renderImages()}
        </TouchableOpacity>

        {(post.likesCount > 0 || post.commentsCount > 0) && (
          <View style={postStyles.statsRow}>
            {post.likesCount > 0 && (
              <View style={postStyles.statItem}>
                <Heart size={12} color={Colors.error} fill={Colors.error} />
                <Text style={postStyles.statText}>{formatCount(post.likesCount)}</Text>
              </View>
            )}
            {post.commentsCount > 0 && (
              <View style={postStyles.statItem}>
                <MessageCircle size={12} color={Colors.text.tertiary} />
                <Text style={postStyles.statText}>{formatCount(post.commentsCount)}</Text>
              </View>
            )}
          </View>
        )}

        <View style={postStyles.divider} />

        <View style={postStyles.actions}>
          <Animated.View style={{ transform: [{ scale: likeScale }], flex: 1 }}>
            <TouchableOpacity style={postStyles.actionBtn} onPress={handleLike} activeOpacity={0.7}>
              <Heart
                size={19}
                color={post.isLiked ? Colors.error : Colors.text.tertiary}
                fill={post.isLiked ? Colors.error : 'none'}
              />
              <Text style={[postStyles.actionText, post.isLiked && { color: Colors.error }]}>
                Like
              </Text>
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity
            style={postStyles.actionBtn}
            onPress={() => navigation.navigate('PostDetail', { postId: post.postId })}
            activeOpacity={0.7}>
            <MessageCircle size={19} color={Colors.text.tertiary} />
            <Text style={postStyles.actionText}>Comment</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={postStyles.actionBtn}
            onPress={handleShare}
            activeOpacity={0.7}
            disabled={sharingInProgress}>
            <Share2
              size={19}
              color={sharingInProgress ? Colors.text.tertiary + '60' : Colors.text.tertiary}
            />
            <Text style={[postStyles.actionText, sharingInProgress && { opacity: 0.4 }]}>
              Share
            </Text>
          </TouchableOpacity>

          <Animated.View style={{ transform: [{ scale: bookmarkScale }] }}>
            <TouchableOpacity
              style={postStyles.actionBtn}
              onPress={handleBookmark}
              activeOpacity={0.7}>
              <Bookmark
                size={19}
                color={post.isBookmarked ? Colors.accent : Colors.text.tertiary}
                fill={post.isBookmarked ? Colors.accent : 'none'}
              />
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    );
  },
);

const postStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bg.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    marginBottom: Spacing.md,
    overflow: 'hidden',
    ...Shadow.soft,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  userRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatarSpacing: { marginRight: Spacing.sm },
  userInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  verifiedBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  handle: { fontSize: 12, color: Colors.text.tertiary, fontWeight: '500' },
  dot: { fontSize: 12, color: Colors.text.tertiary },
  time: { fontSize: 12, color: Colors.text.tertiary },
  edited: { fontSize: 11, color: Colors.warning, fontWeight: '600' },
  moreBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    fontSize: 15,
    lineHeight: 23,
    color: Colors.text.secondary,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  contentText: { fontSize: 15, lineHeight: 23, color: Colors.text.secondary },
  hashtag: { color: Colors.primaryLight, fontWeight: '600' },
  mention: { color: Colors.accent, fontWeight: '600' },
  singleImageWrapper: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  singleImage: { width: '100%', height: 220 },
  twoImages: {
    flexDirection: 'row',
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    gap: 4,
    height: 180,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  halfImage: { flex: 1, borderRadius: Radius.md },
  multiGrid: {
    flexDirection: 'row',
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    gap: 4,
    height: 220,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  gridMain: { flex: 1.6, borderRadius: Radius.md },
  gridSide: { flex: 1, gap: 4 },
  gridSmallWrapper: { flex: 1, position: 'relative' },
  gridSmall: { width: '100%', height: '100%', borderRadius: Radius.sm },
  moreOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreOverlayText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 12, color: Colors.text.tertiary, fontWeight: '500' },
  divider: { height: 1, backgroundColor: Colors.border.subtle, marginHorizontal: Spacing.md },
  actions: { flexDirection: 'row', paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    gap: 5,
    borderRadius: Radius.sm,
  },
  actionText: { fontSize: 13, fontWeight: '600', color: Colors.text.tertiary },
});

const SkeletonCard = () => (
  <View style={skeletonStyles.card}>
    <View style={skeletonStyles.header}>
      <View style={skeletonStyles.avatar} />
      <View style={skeletonStyles.lines}>
        <View style={[skeletonStyles.line, { width: '52%' }]} />
        <View style={[skeletonStyles.line, { width: '32%', marginTop: 7 }]} />
      </View>
    </View>
    <View style={[skeletonStyles.line, { width: '100%', marginBottom: 8 }]} />
    <View style={[skeletonStyles.line, { width: '86%', marginBottom: 8 }]} />
    <View style={[skeletonStyles.line, { width: '65%' }]} />
    <View style={skeletonStyles.actionsRow}>
      <View style={skeletonStyles.actionPill} />
      <View style={skeletonStyles.actionPill} />
      <View style={skeletonStyles.actionPill} />
    </View>
  </View>
);

const skeletonStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bg.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.bg.tertiary,
    marginRight: Spacing.sm,
  },
  lines: { flex: 1 },
  line: { height: 12, borderRadius: 6, backgroundColor: Colors.bg.tertiary },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
  },
  actionPill: { flex: 1, height: 28, borderRadius: Radius.sm, backgroundColor: Colors.bg.tertiary },
});

interface HomeHeaderProps {
  navigation: any;
  displayName: string;
  photoURL?: string;
  onProfilePress: () => void;
}

const HomeHeader = ({ navigation, displayName, photoURL, onProfilePress }: HomeHeaderProps) => (
  <View style={headerStyles.container}>
    <TouchableOpacity
      style={headerStyles.leftSection}
      activeOpacity={0.75}
      onPress={onProfilePress}>
      <UserAvatar photoURL={photoURL} displayName={displayName} size={38} />
      <View>
        <Text style={headerStyles.greeting}>{getGreeting()} 👋</Text>
        <Text style={headerStyles.name} numberOfLines={1}>
          {displayName}
        </Text>
      </View>
    </TouchableOpacity>
    <View style={headerStyles.actions}>
      <TouchableOpacity
        style={headerStyles.iconBtn}
        onPress={() => navigation.navigate('WritePost')}
        activeOpacity={0.75}>
        <Plus size={20} color={Colors.text.secondary} />
      </TouchableOpacity>
      <TouchableOpacity
        style={headerStyles.iconBtn}
        onPress={() => navigation.navigate('TabSearch')}
        activeOpacity={0.75}>
        <Search size={20} color={Colors.text.secondary} />
      </TouchableOpacity>
      <TouchableOpacity
        style={headerStyles.iconBtn}
        onPress={() => navigation.navigate('Notifications')}
        activeOpacity={0.75}>
        <Bell size={20} color={Colors.text.secondary} />
        <View style={headerStyles.notifBadge} />
      </TouchableOpacity>
    </View>
  </View>
);

const headerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
  },
  leftSection: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  greeting: { fontSize: 12, color: Colors.text.tertiary, fontWeight: '500' },
  name: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text.primary,
    letterSpacing: -0.4,
    maxWidth: width * 0.32,
  },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.bg.glass,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.error,
    borderWidth: 1.5,
    borderColor: Colors.bg.primary,
  },
});

const ALL_FILTERS: FeedFilter[] = ['All', 'Following', 'Trending'];

const FilterTabs = ({
  active,
  onChange,
}: {
  active: FeedFilter;
  onChange: (f: FeedFilter) => void;
}) => (
  <View style={filterStyles.container}>
    {ALL_FILTERS.map(tab => {
      const isActive = active === tab;
      return (
        <TouchableOpacity
          key={tab}
          onPress={() => onChange(tab)}
          activeOpacity={0.8}
          style={filterStyles.tabWrapper}>
          {isActive ? (
            <LinearGradient colors={['#7C3AED', '#9D6FFF']} style={filterStyles.tabActive}>
              {tab === 'Following' && <Users size={12} color="#fff" />}
              {tab === 'Trending' && <TrendingUp size={12} color="#fff" />}
              <Text style={filterStyles.tabTextActive}>{tab}</Text>
            </LinearGradient>
          ) : (
            <View style={filterStyles.tab}>
              {tab === 'Following' && <Users size={12} color={Colors.text.tertiary} />}
              {tab === 'Trending' && <TrendingUp size={12} color={Colors.text.tertiary} />}
              <Text style={filterStyles.tabText}>{tab}</Text>
            </View>
          )}
        </TouchableOpacity>
      );
    })}
  </View>
);

const filterStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  tabWrapper: { flex: 1 },
  tabActive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: Radius.full,
    gap: 5,
    ...Shadow.brand,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.bg.glass,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    gap: 5,
  },
  tabText: { fontSize: 13, fontWeight: '600', color: Colors.text.tertiary },
  tabTextActive: { fontSize: 13, fontWeight: '700', color: '#fff' },
});

const NewPostsBanner = ({ count, onPress }: { count: number; onPress: () => void }) => {
  const translateY = useRef(new Animated.Value(-56)).current;
  useEffect(() => {
    Animated.spring(translateY, {
      toValue: 0,
      tension: 80,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, [translateY]);

  return (
    <Animated.View style={[bannerStyles.wrapper, { transform: [{ translateY }] }]}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
        <LinearGradient
          colors={['#7C3AED', '#00B89C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={bannerStyles.pill}>
          <ChevronUp size={14} color="#fff" strokeWidth={2.5} />
          <Text style={bannerStyles.text}>
            {count} new {count === 1 ? 'post' : 'posts'}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

const bannerStyles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 12, left: 0, right: 0, alignItems: 'center', zIndex: 99 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: Radius.full,
    ...Shadow.brand,
  },
  text: { fontSize: 13, fontWeight: '700', color: '#fff' },
});

const EMPTY_COPY: Record<FeedFilter, { icon: React.ReactNode; title: string; sub: string }> = {
  All: {
    icon: <Zap size={32} color={Colors.text.tertiary} />,
    title: 'Nothing here yet',
    sub: 'Be the first to post something for everyone to see.',
  },
  Following: {
    icon: <Users size={32} color={Colors.text.tertiary} />,
    title: 'Your following feed is empty',
    sub: 'Follow people to see their latest posts here.',
  },
  Trending: {
    icon: <TrendingUp size={32} color={Colors.text.tertiary} />,
    title: 'No trending posts yet',
    sub: 'Check back soon — popular posts will appear here.',
  },
};

const EmptyFeed = ({ filter, onCreatePost }: { filter: FeedFilter; onCreatePost: () => void }) => {
  const { icon, title, sub } = EMPTY_COPY[filter];
  return (
    <View style={emptyStyles.container}>
      <View style={emptyStyles.iconWrapper}>{icon}</View>
      <Text style={emptyStyles.title}>{title}</Text>
      <Text style={emptyStyles.sub}>{sub}</Text>
      {filter === 'All' && (
        <TouchableOpacity
          onPress={onCreatePost}
          activeOpacity={0.82}
          style={emptyStyles.ctaWrapper}>
          <LinearGradient colors={['#7C3AED', '#9D6FFF']} style={emptyStyles.cta}>
            <Plus size={15} color="#fff" />
            <Text style={emptyStyles.ctaText}>Create a post</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
};

const emptyStyles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', paddingTop: 56, paddingHorizontal: Spacing.xl },
  iconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.bg.glass,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: -0.3,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  sub: { fontSize: 14, color: Colors.text.tertiary, textAlign: 'center', lineHeight: 20 },
  ctaWrapper: { marginTop: Spacing.lg, borderRadius: Radius.full, overflow: 'hidden' },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  ctaText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

const ErrorBanner = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <View style={errorStyles.container}>
    <AlertCircle size={18} color={Colors.error} />
    <Text style={errorStyles.msg} numberOfLines={2}>
      {message}
    </Text>
    <TouchableOpacity onPress={onRetry} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Text style={errorStyles.retry}>Retry</Text>
    </TouchableOpacity>
  </View>
);

const errorStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.22)',
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  msg: { flex: 1, fontSize: 13, color: Colors.error, fontWeight: '500' },
  retry: { fontSize: 13, fontWeight: '700', color: Colors.error },
});

const LoadMoreFooter = ({ loading, hasMore }: { loading: boolean; hasMore: boolean }) => {
  if (loading)
    return (
      <View style={footerStyles.loader}>
        <ActivityIndicator size="small" color={Colors.accent} />
      </View>
    );
  if (!hasMore) {
    return (
      <View style={footerStyles.end}>
        <View style={footerStyles.line} />
        <Text style={footerStyles.endText}>You're all caught up 🎉</Text>
        <View style={footerStyles.line} />
      </View>
    );
  }
  return <View style={{ height: Spacing.lg }} />;
};

const footerStyles = StyleSheet.create({
  loader: { paddingVertical: Spacing.lg, alignItems: 'center' },
  end: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  line: { flex: 1, height: 1, backgroundColor: Colors.border.subtle },
  endText: { fontSize: 12, color: Colors.text.tertiary, fontWeight: '500' },
});

const FEED_LABELS: Record<FeedFilter, string> = {
  All: 'Latest Posts',
  Following: 'Following',
  Trending: 'Trending',
};

type Props = CompositeScreenProps<
  BottomTabScreenProps<BottomTabParamList, 'TabHome'>,
  NativeStackScreenProps<HomeStackParamList>
>;

const pickReportReason = (): Promise<ReportReason | null> =>
  new Promise(resolve => {
    Alert.alert(
      'Report Post',
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

export default function TabHome({ navigation }: Props) {
  const { user } = useUser();
  const db = getFirestore();
  const [activeFilter, setActiveFilter] = useState<FeedFilter>('All');
  const [moreSheetPost, setMoreSheetPost] = useState<IFeedPost | null>(null);
  const [moreSheetVisible, setMoreSheetVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const {
    posts,
    loading,
    refreshing,
    loadingMore,
    hasMore,
    error,
    newPostsCount,
    fetchFeed,
    refresh,
    loadMore,
    toggleLike,
    toggleBookmark,
    dismissNewPosts,
    removePost,
  } = useFeed();

  const { deletePost } = usePost();

  useEffect(() => {
    if (!user?.userId) return;
    fetchFeed(activeFilter, user.userId);
  }, [activeFilter, user?.userId]);

  const handleFilterChange = useCallback(
    (filter: FeedFilter) => {
      if (filter === activeFilter) return;
      setActiveFilter(filter);
      flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
    },
    [activeFilter],
  );

  const handleRefresh = useCallback(() => {
    if (!user?.userId) return;
    refresh(activeFilter, user.userId);
  }, [activeFilter, user?.userId, refresh]);

  const handleLoadMore = useCallback(() => {
    if (!user?.userId || loadingMore || !hasMore) return;
    loadMore(activeFilter, user.userId);
  }, [activeFilter, user?.userId, loadingMore, hasMore, loadMore]);

  const handleLike = useCallback(
    (postId: string, currentlyLiked: boolean) => {
      if (!user?.userId) return;
      toggleLike(postId, user.userId, currentlyLiked);
    },
    [user?.userId, toggleLike],
  );

  const handleBookmark = useCallback(
    (postId: string, currentlyBookmarked: boolean) => {
      if (!user?.userId) return;
      toggleBookmark(postId, user.userId, currentlyBookmarked);
    },
    [user?.userId, toggleBookmark],
  );

  const handleMorePress = useCallback((post: IFeedPost) => {
    setMoreSheetPost(post);
    setMoreSheetVisible(true);
  }, []);

  const handleMoreClose = useCallback(() => setMoreSheetVisible(false), []);

  const handleNewPostsBanner = useCallback(() => {
    dismissNewPosts();
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    if (user?.userId) refresh(activeFilter, user.userId);
  }, [dismissNewPosts, activeFilter, user?.userId, refresh]);

  const handleCreatePost = useCallback(() => navigation.navigate('WritePost'), [navigation]);

  const handleProfilePress = useCallback(() => {
    if (user?.userId) navigation.navigate('ViewUserProfile', { userId: user.userId });
  }, [navigation, user?.userId]);

  const handleEdit = useCallback(
    (post: IFeedPost) => navigation.navigate('WritePost', { postId: post.postId }),
    [navigation],
  );

  const handleDelete = useCallback(
    async (post: IFeedPost) => {
      if (!user?.userId) return;
      const success = await deletePost(post.postId, user.userId);
      if (success) removePost(post.postId);
    },
    [user?.userId, deletePost, removePost],
  );

  const handleReport = useCallback(
    async (post: IFeedPost) => {
      if (!user?.userId) return;
      const reason = await pickReportReason();
      if (!reason) return;
      try {
        const reportRef = doc(collection(db, 'Reports'));
        const batch = writeBatch(db);
        batch.set(reportRef, {
          id: reportRef.id,
          type: 'post',
          targetPostId: post.postId,
          targetUserId: post.userId,
          reportedBy: user.userId,
          reason,
          createdAt: serverTimestamp(),
        });
        await batch.commit();
        Alert.alert('Report Submitted', 'Thank you. We will review and take appropriate action.');
      } catch (e) {
        console.error('[TabHome] handleReport:', e);
        Alert.alert('Error', 'Failed to submit report. Please try again.');
      }
    },
    [user?.userId, db],
  );

  const handleCopyLink = useCallback((post: IFeedPost) => {
    Clipboard.setString(`https://yourapp.com/post/${post.postId}`);
    Alert.alert('Link Copied', 'The post link has been copied to your clipboard.');
  }, []);

  const renderPost = useCallback(
    ({ item }: { item: IFeedPost }) => (
      <PostCard
        post={item}
        currentUserId={user?.userId ?? ''}
        onLike={handleLike}
        onBookmark={handleBookmark}
        onMorePress={handleMorePress}
        navigation={navigation}
      />
    ),
    [user?.userId, handleLike, handleBookmark, handleMorePress, navigation],
  );

  const keyExtractor = useCallback((item: IFeedPost) => item.postId, []);

  const ListHeader = useCallback(
    () => (
      <View>
        <HomeHeader
          navigation={navigation}
          displayName={user?.displayName ?? ''}
          photoURL={user?.photoURL}
          onProfilePress={handleProfilePress}
        />
        <FilterTabs active={activeFilter} onChange={handleFilterChange} />
        {error && <ErrorBanner message={error} onRetry={handleRefresh} />}
        <View style={styles.feedHeader}>
          <Text style={styles.feedTitle}>{FEED_LABELS[activeFilter]}</Text>
        </View>
      </View>
    ),
    [navigation, user, activeFilter, handleFilterChange, error, handleRefresh, handleProfilePress],
  );

  const ListEmpty = useCallback(
    () =>
      loading ? (
        <View>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : (
        <EmptyFeed filter={activeFilter} onCreatePost={handleCreatePost} />
      ),
    [loading, activeFilter, handleCreatePost],
  );

  const ListFooter = useCallback(
    () => (posts.length > 0 ? <LoadMoreFooter loading={loadingMore} hasMore={hasMore} /> : null),
    [posts.length, loadingMore, hasMore],
  );

  return (
    <View style={styles.root}>
      <TransparentStatusBar />
      <LinearGradient
        colors={[Colors.bg.primary, Colors.bg.secondary]}
        style={StyleSheet.absoluteFillObject}
      />

      {newPostsCount > 0 && <NewPostsBanner count={newPostsCount} onPress={handleNewPostsBanner} />}

      <FlatList
        ref={flatListRef}
        data={posts}
        keyExtractor={keyExtractor}
        renderItem={renderPost}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        ListFooterComponent={ListFooter}
        contentContainerStyle={[styles.listContent, !posts.length && styles.listContentGrow]}
        showsVerticalScrollIndicator={false}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.accent}
            colors={[Colors.primary, Colors.accent]}
            progressBackgroundColor={Colors.bg.card}
          />
        }
        removeClippedSubviews
        maxToRenderPerBatch={5}
        windowSize={8}
        initialNumToRender={5}
        updateCellsBatchingPeriod={40}
      />

      <MoreSheet
        visible={moreSheetVisible}
        post={moreSheetPost}
        currentUserId={user?.userId ?? ''}
        onClose={handleMoreClose}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onReport={handleReport}
        onCopyLink={handleCopyLink}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg.primary },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
  listContentGrow: { flexGrow: 1 },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  feedTitle: { fontSize: 18, fontWeight: '800', color: Colors.text.primary, letterSpacing: -0.4 },
});
