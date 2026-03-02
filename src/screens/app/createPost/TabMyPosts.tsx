import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabParamList } from '../../../navigation/BottomTabs';
import { HomeStackParamList } from '../../../navigation/HomeNavigator';

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Platform,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Modal,
  Animated,
  PanResponder,
  Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {
  ArrowLeft,
  Grid3X3,
  List,
  TrendingUp,
  Globe,
  Lock,
  Edit3,
  Trash2,
  Eye,
  Heart,
  MessageCircle,
  MoreVertical,
  PlusCircle,
  Plus,
  Image as ImageIcon,
  Users,
} from 'lucide-react-native';
import { Colors, Spacing, Radius, Shadow } from '../../../utilities/theme';
import { IPostWithUser } from '../../../interfaces/IPost';
import { useUser } from '../../../Hooks/useUser';
import { usePost } from '../../../Hooks/usePosts';
import { TransparentStatusBar } from '../../../component/common/TransparentStatusBar';

type ViewMode = 'grid' | 'list';
type FilterType = 'all' | 'public' | 'followers' | 'private';

const GRID_PLACEHOLDER = '__placeholder__';

const QuickStats = ({ posts }: { posts: IPostWithUser[] }) => {
  const totalLikes = posts.reduce((sum, p) => sum + p.likesCount, 0);
  const totalComments = posts.reduce((sum, p) => sum + p.commentsCount, 0);
  const totalShares = posts.reduce((sum, p) => sum + p.sharesCount, 0);

  const stats = [
    {
      label: 'Posts',
      value: posts.length,
      icon: <Grid3X3 size={14} color={Colors.primaryLight} />,
      color: Colors.primaryLight,
    },
    {
      label: 'Likes',
      value: totalLikes,
      icon: <Heart size={14} color={Colors.error} />,
      color: Colors.error,
    },
    {
      label: 'Comments',
      value: totalComments,
      icon: <MessageCircle size={14} color={Colors.info} />,
      color: Colors.info,
    },
    {
      label: 'Shares',
      value: totalShares,
      icon: <TrendingUp size={14} color={Colors.success} />,
      color: Colors.success,
    },
  ];

  return (
    <View style={statsS.wrapper}>
      {stats.map((stat, i) => (
        <View key={i} style={statsS.card}>
          <LinearGradient colors={[stat.color + '15', stat.color + '08']} style={statsS.cardGrad}>
            <View style={[statsS.iconWrapper, { backgroundColor: stat.color + '20' }]}>
              {stat.icon}
            </View>
            <Text style={statsS.value}>{stat.value}</Text>
            <Text style={statsS.label}>{stat.label}</Text>
          </LinearGradient>
        </View>
      ))}
    </View>
  );
};

const statsS = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  card: {
    flex: 1,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  cardGrad: { padding: Spacing.sm, alignItems: 'center', gap: 4 },
  iconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { fontSize: 16, fontWeight: '800', color: Colors.text.primary, letterSpacing: -0.5 },
  label: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

const FilterTabs = ({
  active,
  onChange,
  counts,
}: {
  active: FilterType;
  onChange: (f: FilterType) => void;
  counts: Record<FilterType, number>;
}) => {
  const tabs: {
    key: FilterType;
    label: string;
    Icon: any;
    accent: string;
    gradColors: [string, string];
  }[] = [
    {
      key: 'all',
      label: 'All Posts',
      Icon: Grid3X3,
      accent: Colors.primaryLight,
      gradColors: ['rgba(124,58,237,0.18)', 'rgba(124,58,237,0.06)'],
    },
    {
      key: 'public',
      label: 'Public',
      Icon: Globe,
      accent: Colors.accent,
      gradColors: ['rgba(0,229,195,0.18)', 'rgba(0,229,195,0.06)'],
    },
    {
      key: 'followers',
      label: 'Followers',
      Icon: Users,
      accent: '#A78BFA',
      gradColors: ['rgba(167,139,250,0.18)', 'rgba(167,139,250,0.06)'],
    },
    {
      key: 'private',
      label: 'Only Me',
      Icon: Lock,
      accent: '#64748B',
      gradColors: ['rgba(100,116,139,0.18)', 'rgba(100,116,139,0.06)'],
    },
  ];

  return (
    <View style={filterS.grid}>
      {tabs.map(tab => {
        const isActive = active === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={filterS.cardWrap}
            onPress={() => onChange(tab.key)}
            activeOpacity={0.75}>
            <LinearGradient
              colors={
                isActive ? tab.gradColors : ['rgba(255,255,255,0.03)', 'rgba(255,255,255,0.01)']
              }
              style={[filterS.card, isActive && { borderColor: tab.accent + 'AA' }]}>
              <View style={[filterS.iconBubble, { backgroundColor: tab.accent + '22' }]}>
                <tab.Icon size={15} color={isActive ? tab.accent : Colors.text.tertiary} />
              </View>
              <View style={filterS.textCol}>
                <Text style={[filterS.count, isActive && { color: tab.accent }]}>
                  {counts[tab.key]}
                </Text>
                <Text style={[filterS.label, isActive && { color: Colors.text.secondary }]}>
                  {tab.label}
                </Text>
              </View>
              {isActive && <View style={[filterS.activeDot, { backgroundColor: tab.accent }]} />}
            </LinearGradient>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const filterS = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  cardWrap: {
    width: '48.5%',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    position: 'relative',
    overflow: 'hidden',
  },
  iconBubble: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    gap: 1,
  },
  count: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text.primary,
    letterSpacing: -0.5,
    lineHeight: 22,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.tertiary,
    letterSpacing: 0.1,
  },
  activeDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

const GridPostCard = ({
  post,
  onPress,
  onLongPress,
}: {
  post: IPostWithUser;
  onPress: () => void;
  onLongPress: () => void;
}) => {
  const thumb = post.images?.[0]?.url;
  const hasMultipleImages = (post.images?.length ?? 0) > 1;

  return (
    <TouchableOpacity
      style={gridS.card}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.85}>
      {thumb ? (
        <Image source={{ uri: thumb }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      ) : (
        <LinearGradient colors={['#1A1030', '#0E0E1C']} style={gridS.placeholder}>
          <Text style={gridS.placeholderText} numberOfLines={5}>
            {post.content}
          </Text>
        </LinearGradient>
      )}

      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={gridS.overlay}>
        <View style={gridS.stats}>
          <View style={gridS.stat}>
            <Heart size={10} color={Colors.white} fill={Colors.white} />
            <Text style={gridS.statText}>{post.likesCount}</Text>
          </View>
          <View style={gridS.stat}>
            <MessageCircle size={10} color={Colors.white} />
            <Text style={gridS.statText}>{post.commentsCount}</Text>
          </View>
        </View>
      </LinearGradient>

      {hasMultipleImages && (
        <View style={gridS.imageBadge}>
          <ImageIcon size={9} color={Colors.white} />
          <Text style={gridS.imageBadgeText}>{post.images.length}</Text>
        </View>
      )}

      {post.isEdited && (
        <View style={gridS.editedBadge}>
          <Edit3 size={8} color={Colors.warning} />
        </View>
      )}
    </TouchableOpacity>
  );
};

const gridS = StyleSheet.create({
  card: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: '#0E0E1C',
  },
  placeholder: {
    flex: 1,
    padding: 8,
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 14,
    letterSpacing: 0.1,
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 36,
    justifyContent: 'flex-end',
    paddingHorizontal: 6,
    paddingBottom: 5,
  },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statText: { fontSize: 9, fontWeight: '700', color: Colors.white },
  imageBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  imageBadgeText: { fontSize: 9, fontWeight: '700', color: Colors.white },
  editedBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(245,158,11,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
  },
});

const ListPostCard = ({
  post,
  onPress,
  onMore,
}: {
  post: IPostWithUser;
  onPress: () => void;
  onMore: () => void;
}) => {
  const formatTimestamp = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const emojiMatch = post.content.match(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u);
  const emoji = emojiMatch ? emojiMatch[0] : null;

  return (
    <TouchableOpacity style={listS.card} onPress={onPress} activeOpacity={0.85}>
      <LinearGradient
        colors={['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.02)']}
        style={listS.cardGrad}>
        <View style={listS.header}>
          <View style={listS.leftHeader}>
            {emoji && <Text style={listS.emoji}>{emoji}</Text>}
            {post.images && post.images.length > 0 && (
              <View style={listS.imageBadge}>
                <Eye size={10} color={Colors.accent} />
                <Text style={listS.imageBadgeText}>{post.images.length}</Text>
              </View>
            )}
            {post.isEdited && (
              <View
                style={[
                  listS.statusBadge,
                  { backgroundColor: 'rgba(245,158,11,0.15)', borderColor: 'rgba(245,158,11,0.3)' },
                ]}>
                <Edit3 size={10} color={Colors.warning} />
                <Text style={[listS.statusText, { color: Colors.warning }]}>Edited</Text>
              </View>
            )}
          </View>
          <TouchableOpacity style={listS.moreBtn} onPress={onMore}>
            <MoreVertical size={16} color={Colors.text.tertiary} />
          </TouchableOpacity>
        </View>
        <Text style={listS.content} numberOfLines={2}>
          {post.content}
        </Text>
        <View style={listS.footer}>
          <Text style={listS.time}>{formatTimestamp(post.createdAt)}</Text>
          <View style={listS.metrics}>
            <View style={listS.metric}>
              <Heart size={11} color={Colors.error} />
              <Text style={listS.metricText}>{post.likesCount}</Text>
            </View>
            <View style={listS.metric}>
              <MessageCircle size={11} color={Colors.info} />
              <Text style={listS.metricText}>{post.commentsCount}</Text>
            </View>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const listS = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  cardGrad: { padding: Spacing.md },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  leftHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  emoji: { fontSize: 24 },
  imageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,229,195,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(0,229,195,0.3)',
  },
  imageBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.accent },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  statusText: { fontSize: 10, fontWeight: '700' },
  moreBtn: { padding: 4 },
  content: { fontSize: 14, color: Colors.text.secondary, lineHeight: 21, marginBottom: Spacing.sm },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  time: { fontSize: 11, color: Colors.text.tertiary, fontWeight: '500' },
  metrics: { flexDirection: 'row', gap: Spacing.sm },
  metric: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metricText: { fontSize: 11, fontWeight: '600', color: Colors.text.tertiary },
});

const PostActionMenu = ({
  visible,
  onClose,
  onEdit,
  onDelete,
}: {
  visible: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const translateY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, g) => {
        if (g.dy >= 0) {
          translateY.setValue(g.dy);
        } else {
          translateY.setValue(g.dy * 0.15);
        }
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.5) {
          Animated.timing(translateY, {
            toValue: 500,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            translateY.setValue(0);
            onClose();
          });
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 6,
          }).start();
        }
      },
    }),
  ).current;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={menuS.modalRoot}>
        <TouchableOpacity style={menuS.backdrop} activeOpacity={1} onPress={onClose} />

        <Animated.View style={[menuS.sheet, { transform: [{ translateY }] }]}>
          <LinearGradient colors={['#1E1E30', '#13131F']} style={menuS.sheetGrad}>
            <View style={menuS.handleArea} {...panResponder.panHandlers}>
              <View style={menuS.handle} />
            </View>

            <Text style={menuS.title}>Post Actions</Text>

            <TouchableOpacity style={menuS.row} onPress={onEdit} activeOpacity={0.7}>
              <View style={[menuS.iconW, { backgroundColor: 'rgba(124,58,237,0.15)' }]}>
                <Edit3 size={18} color={Colors.primaryLight} />
              </View>
              <Text style={menuS.rowText}>Edit Post</Text>
            </TouchableOpacity>

            <View style={menuS.divider} />

            <TouchableOpacity style={menuS.row} onPress={onDelete} activeOpacity={0.7}>
              <View style={[menuS.iconW, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
                <Trash2 size={18} color={Colors.error} />
              </View>
              <Text style={[menuS.rowText, { color: Colors.error }]}>Delete Post</Text>
            </TouchableOpacity>

            <View style={{ height: Platform.OS === 'ios' ? 48 : 32 }} />
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
};

const menuS = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 0,
    borderColor: Colors.border.medium,
  },
  sheetGrad: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  handleArea: {
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: 100,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border.medium,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text.primary,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 15,
    gap: Spacing.md,
  },
  iconW: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { fontSize: 15, fontWeight: '600', color: Colors.text.primary },
  divider: {
    height: 1,
    backgroundColor: Colors.border.subtle,
    marginHorizontal: Spacing.lg,
  },
});

type Props = CompositeScreenProps<
  BottomTabScreenProps<BottomTabParamList, 'TabMyPosts'>,
  NativeStackScreenProps<HomeStackParamList>
>;

export default function TabMyPosts({ navigation }: Props) {
  const { user } = useUser();
  const { getPostsFeed, deletePost, feedLoading, deleting } = usePost();

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filter, setFilter] = useState<FilterType>('all');
  const [posts, setPosts] = useState<IPostWithUser[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPost, setSelectedPost] = useState<IPostWithUser | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    if (!user) return;
    try {
      const result = await getPostsFeed({ userId: user.userId, limit: 50 });
      setPosts(result.posts);
    } catch (err) {
      console.error('Error fetching posts:', err);
    } finally {
      setInitialLoading(false);
    }
  }, [user, getPostsFeed]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  };

  const filteredPosts = posts.filter(p => {
    if (filter === 'all') return true;
    return p.visibility === filter;
  });

  const counts: Record<FilterType, number> = {
    all: posts.length,
    public: posts.filter(p => p.visibility === 'public').length,
    followers: posts.filter(p => p.visibility === 'followers').length,
    private: posts.filter(p => p.visibility === 'private').length,
  };

  const gridData: (IPostWithUser | typeof GRID_PLACEHOLDER)[] =
    viewMode === 'grid'
      ? (() => {
          const padded = [...filteredPosts] as (IPostWithUser | typeof GRID_PLACEHOLDER)[];
          const remainder = filteredPosts.length % 3;
          if (remainder !== 0) {
            for (let i = 0; i < 3 - remainder; i++) padded.push(GRID_PLACEHOLDER);
          }
          return padded;
        })()
      : filteredPosts;

  const handlePostPress = (post: IPostWithUser) => {
    navigation?.navigate('PostDetail', { postId: post.postId });
  };

  const handlePostLongPress = (post: IPostWithUser) => {
    setSelectedPost(post);
    setShowMenu(true);
  };

  const handleEdit = () => {
    setShowMenu(false);
    if (selectedPost) {
      navigation?.navigate('WritePost', { postId: selectedPost.postId });
    }
  };

  const handleDelete = async () => {
    setShowMenu(false);
    if (!user || !selectedPost) return;
    const success = await deletePost(selectedPost.postId, user.userId);
    if (success) {
      setPosts(prev => prev.filter(p => p.postId !== selectedPost.postId));
      setSelectedPost(null);
    }
  };

  if (initialLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={styles.loadingText}>Loading your posts...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <TransparentStatusBar />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack()}>
          <ArrowLeft size={20} color={Colors.text.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Posts</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.viewBtn, viewMode === 'grid' && styles.viewBtnActive]}
            onPress={() => setViewMode('grid')}>
            <Grid3X3
              size={16}
              color={viewMode === 'grid' ? Colors.primaryLight : Colors.text.tertiary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewBtn, viewMode === 'list' && styles.viewBtnActive]}
            onPress={() => setViewMode('list')}>
            <List
              size={16}
              color={viewMode === 'list' ? Colors.primaryLight : Colors.text.tertiary}
            />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={viewMode === 'grid' ? gridData : filteredPosts}
        keyExtractor={(item, index) =>
          item === GRID_PLACEHOLDER ? `placeholder_${index}` : (item as IPostWithUser).postId
        }
        numColumns={viewMode === 'grid' ? 3 : 1}
        key={viewMode}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
        }
        ListHeaderComponent={
          <>
            <QuickStats posts={posts} />
            <FilterTabs active={filter} onChange={setFilter} counts={counts} />
          </>
        }
        renderItem={({ item }) => {
          if (item === GRID_PLACEHOLDER) {
            return <View style={styles.gridPlaceholder} />;
          }

          const post = item as IPostWithUser;
          return viewMode === 'grid' ? (
            <GridPostCard
              post={post}
              onPress={() => handlePostPress(post)}
              onLongPress={() => handlePostLongPress(post)}
            />
          ) : (
            <ListPostCard
              post={post}
              onPress={() => handlePostPress(post)}
              onMore={() => {
                setSelectedPost(post);
                setShowMenu(true);
              }}
            />
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Grid3X3 size={32} color={Colors.text.tertiary} />
            </View>
            <Text style={styles.emptyTitle}>
              {filter === 'all' ? 'No posts yet' : 'No posts found'}
            </Text>
            <Text style={styles.emptyDesc}>
              {filter === 'all'
                ? 'Start sharing your thoughts with the world'
                : 'Try changing the filter'}
            </Text>
            {filter === 'all' && (
              <TouchableOpacity
                style={styles.createBtn}
                onPress={() => navigation?.navigate('WritePost')}>
                <LinearGradient colors={['#7C3AED', '#00E5C3']} style={styles.createBtnGrad}>
                  <PlusCircle size={16} color={Colors.white} />
                  <Text style={styles.createBtnText}>Create Post</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        }
        columnWrapperStyle={viewMode === 'grid' ? styles.gridRow : null}
      />

      {selectedPost && (
        <PostActionMenu
          visible={showMenu}
          onClose={() => setShowMenu(false)}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation?.navigate('WritePost')}
        activeOpacity={0.85}>
        <LinearGradient
          colors={['#7C3AED', '#9D6FFF', '#00E5C3']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabGrad}>
          <Plus size={26} color={Colors.white} strokeWidth={2.5} />
        </LinearGradient>
      </TouchableOpacity>

      {deleting && (
        <View style={styles.deletingOverlay}>
          <View style={styles.deletingBox}>
            <ActivityIndicator size="large" color={Colors.white} />
            <Text style={styles.deletingText}>Deleting post...</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg.primary },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: { fontSize: 14, color: Colors.text.tertiary, fontWeight: '600' },
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
  headerTitle: { fontSize: 20, fontWeight: '800', color: Colors.text.primary, letterSpacing: -0.5 },
  headerActions: { flexDirection: 'row', gap: 4 },
  viewBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.bg.glass,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewBtnActive: { backgroundColor: 'rgba(124,58,237,0.15)', borderColor: Colors.primaryLight },
  listContent: { paddingTop: Spacing.lg, paddingBottom: 100 },

  gridRow: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  gridPlaceholder: { flex: 1, aspectRatio: 1 },

  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: Spacing.xl },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.bg.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  emptyDesc: {
    fontSize: 14,
    color: Colors.text.tertiary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  createBtn: { borderRadius: Radius.full, overflow: 'hidden', ...Shadow.brand },
  createBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
  },
  createBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white },
  fab: {
    position: 'absolute',
    bottom: 90,
    right: Spacing.lg,
    borderRadius: 28,
    overflow: 'hidden',
    ...Shadow.brand,
    elevation: 8,
  },
  fabGrad: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  deletingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  deletingBox: {
    backgroundColor: Colors.bg.card,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.medium,
  },
  deletingText: { fontSize: 15, fontWeight: '600', color: Colors.text.primary },
});
