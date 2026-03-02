import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabParamList } from '../../../navigation/BottomTabs';
import { HomeStackParamList } from '../../../navigation/HomeNavigator';

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {
  ArrowLeft,
  Settings,
  Grid3X3,
  List,
  Heart,
  MessageCircle,
  Edit3,
  Share2,
  MoreHorizontal,
  MapPin,
  Link2,
  Calendar,
  UserPlus,
  Check,
  Bookmark,
  Image as ImageIcon,
} from 'lucide-react-native';
import { Colors, Spacing, Radius, Shadow } from '../../../utilities/theme';
import { IPostWithUser } from '../../../interfaces/IPost';
import { useUser } from '../../../Hooks/useUser';
import { useProfile } from '../../../Hooks/useProfile';

const { width } = Dimensions.get('window');
const GRID_ITEM = (width - Spacing.lg * 2 - Spacing.sm * 2) / 3;

const fmt = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
};

const joinDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

const timeAgo = (date: Date) => {
  const s = (Date.now() - date.getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

const ProfileAvatar = ({
  photoURL,
  displayName,
  size = 88,
}: {
  photoURL?: string;
  displayName: string;
  size?: number;
}) => {
  const inner = size - 6;
  return (
    <LinearGradient
      colors={['#7C3AED', '#00E5C3']}
      style={{ width: size, height: size, borderRadius: size / 2, padding: 3, ...Shadow.brand }}>
      {photoURL ? (
        <Image
          source={{ uri: photoURL }}
          style={{
            width: inner,
            height: inner,
            borderRadius: inner / 2,
            borderWidth: 3,
            borderColor: Colors.bg.primary,
          }}
        />
      ) : (
        <View
          style={{
            width: inner,
            height: inner,
            borderRadius: inner / 2,
            backgroundColor: '#1A0A2E',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 3,
            borderColor: Colors.bg.primary,
          }}>
          <Text style={{ fontSize: inner * 0.4, fontWeight: '800', color: Colors.primaryLight }}>
            {displayName.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
    </LinearGradient>
  );
};

const StatItem = ({
  value,
  label,
  onPress,
}: {
  value: number;
  label: string;
  onPress?: () => void;
}) => (
  <TouchableOpacity style={statS.wrap} onPress={onPress} activeOpacity={0.7}>
    <Text style={statS.value}>{fmt(value)}</Text>
    <Text style={statS.label}>{label}</Text>
  </TouchableOpacity>
);
const statS = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm },
  value: { fontSize: 22, fontWeight: '800', color: Colors.text.primary, letterSpacing: -0.8 },
  label: { fontSize: 12, color: Colors.text.tertiary, fontWeight: '500', marginTop: 2 },
});

const GridPostCard = ({ post, onPress }: { post: IPostWithUser; onPress: () => void }) => {
  const thumb = post.images?.[0]?.url;
  return (
    <TouchableOpacity style={gridS.item} onPress={onPress} activeOpacity={0.8}>
      {thumb ? (
        <Image source={{ uri: thumb }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      ) : (
        <LinearGradient colors={['#12121E', '#1A1A2E']} style={gridS.placeholder}>
          <Text style={gridS.placeholderText} numberOfLines={4}>
            {post.content}
          </Text>
        </LinearGradient>
      )}
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.72)']} style={gridS.overlay}>
        <View style={gridS.stats}>
          <View style={gridS.stat}>
            <Heart size={10} color={Colors.white} fill={Colors.white} />
            <Text style={gridS.statText}>{fmt(post.likesCount)}</Text>
          </View>
          <View style={gridS.stat}>
            <MessageCircle size={10} color={Colors.white} />
            <Text style={gridS.statText}>{post.commentsCount}</Text>
          </View>
        </View>
      </LinearGradient>
      {post.images?.length > 1 && (
        <View style={gridS.badge}>
          <ImageIcon size={9} color={Colors.white} />
        </View>
      )}
    </TouchableOpacity>
  );
};
const gridS = StyleSheet.create({
  item: {
    width: GRID_ITEM,
    height: GRID_ITEM,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: '#12121E',
  },
  placeholder: { flex: 1, padding: 8, justifyContent: 'center' },
  placeholderText: { fontSize: 11, color: Colors.text.tertiary, lineHeight: 15 },
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
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const ListPostCard = ({ post, onPress }: { post: IPostWithUser; onPress: () => void }) => {
  const thumb = post.images?.[0]?.url;
  return (
    <TouchableOpacity style={listS.card} onPress={onPress} activeOpacity={0.8}>
      <LinearGradient colors={['#1A1A2E', '#12121E']} style={listS.grad}>
        <View style={listS.row}>
          {thumb ? (
            <Image source={{ uri: thumb }} style={listS.thumb} />
          ) : (
            <View style={listS.thumbFallback}>
              <ImageIcon size={18} color={Colors.text.tertiary} />
            </View>
          )}
          <View style={listS.info}>
            <Text style={listS.content} numberOfLines={2}>
              {post.content}
            </Text>
            {post.hashtags?.length > 0 && (
              <Text style={listS.tags} numberOfLines={1}>
                {post.hashtags.slice(0, 3).join(' ')}
              </Text>
            )}
            <View style={listS.footer}>
              <View style={listS.statsRow}>
                <Heart size={12} color={Colors.error} fill={post.isLiked ? Colors.error : 'none'} />
                <Text style={listS.stat}>{fmt(post.likesCount)}</Text>
                <MessageCircle size={12} color={Colors.text.tertiary} />
                <Text style={listS.stat}>{post.commentsCount}</Text>
              </View>
              <Text style={listS.time}>{timeAgo(post.createdAt)}</Text>
            </View>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};
const listS = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  grad: { padding: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  thumb: { width: 56, height: 56, borderRadius: Radius.md },
  thumbFallback: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Colors.bg.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, gap: 4 },
  content: { fontSize: 14, color: Colors.text.secondary, lineHeight: 20 },
  tags: { fontSize: 12, color: Colors.accent, fontWeight: '500' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  stat: { fontSize: 12, color: Colors.text.tertiary, fontWeight: '600', marginRight: 6 },
  time: { fontSize: 11, color: Colors.text.tertiary },
});

const EmptyState = ({
  icon,
  title,
  sub,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
}) => (
  <View style={emptyS.wrap}>
    <View style={emptyS.iconWrap}>{icon}</View>
    <Text style={emptyS.title}>{title}</Text>
    <Text style={emptyS.sub}>{sub}</Text>
  </View>
);
const emptyS = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: Spacing.xl },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.bg.glass,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: { fontSize: 16, fontWeight: '700', color: Colors.text.secondary, marginBottom: 6 },
  sub: { fontSize: 13, color: Colors.text.tertiary, textAlign: 'center', lineHeight: 20 },
});

const InlineLoader = ({ loading }: { loading: boolean }) => {
  if (!loading) return null;
  return (
    <View style={{ paddingVertical: Spacing.lg, alignItems: 'center' }}>
      <ActivityIndicator size="small" color={Colors.accent} />
    </View>
  );
};

type Props = CompositeScreenProps<
  BottomTabScreenProps<BottomTabParamList, 'TabProfile'>,
  NativeStackScreenProps<HomeStackParamList>
>;

type Tab = 'grid' | 'list' | 'liked' | 'bookmarked';

export default function TabProfile({ navigation, route }: Props) {
  const { user: currentUser, setUser } = useUser();
  const targetUserId = (route?.params as any)?.userId ?? currentUser?.userId ?? '';
  const isOwn = targetUserId === currentUser?.userId;

  const {
    profileData,
    loadingProfile,
    fetchProfile,
    posts,
    loadingPosts,
    hasMorePosts,
    fetchPosts,
    likedPosts,
    loadingLiked,
    hasMoreLiked,
    fetchLikedPosts,
    bookmarkedPosts,
    loadingBookmarked,
    hasMoreBookmarked,
    fetchBookmarkedPosts,
  } = useProfile();

  const [activeTab, setActiveTab] = useState<Tab>('grid');
  const [isFollowing, setIsFollowing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const displayUser = isOwn ? currentUser : profileData;

  const isMounted = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (isOwn) {
        fetchProfile(targetUserId).then(fresh => {
          if (fresh) setUser(fresh);
        });
      } else {
        fetchProfile(targetUserId);
      }

      fetchPosts(targetUserId, true);

      if (isMounted.current) {
        if (activeTab === 'liked') fetchLikedPosts(targetUserId, true);
        if (activeTab === 'bookmarked') fetchBookmarkedPosts(targetUserId, true);
      }
      isMounted.current = true;
    }, [targetUserId, activeTab]),
  );

  useEffect(() => {
    if (activeTab === 'liked' && likedPosts.length === 0 && !loadingLiked) {
      fetchLikedPosts(targetUserId, true);
    }
    if (activeTab === 'bookmarked' && bookmarkedPosts.length === 0 && !loadingBookmarked) {
      fetchBookmarkedPosts(targetUserId, true);
    }
  }, [activeTab]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const refreshes: Promise<any>[] = [fetchPosts(targetUserId, true)];
    if (!isOwn) refreshes.push(fetchProfile(targetUserId));
    if (activeTab === 'liked') refreshes.push(fetchLikedPosts(targetUserId, true));
    if (activeTab === 'bookmarked') refreshes.push(fetchBookmarkedPosts(targetUserId, true));
    await Promise.all(refreshes);
    setRefreshing(false);
  }, [activeTab, targetUserId, isOwn]);

  const handleLoadMore = () => {
    if (activeTab === 'grid' || activeTab === 'list') fetchPosts(targetUserId);
    else if (activeTab === 'liked') fetchLikedPosts(targetUserId);
    else if (activeTab === 'bookmarked') fetchBookmarkedPosts(targetUserId);
  };

  const isLoadingMore =
    activeTab === 'grid' || activeTab === 'list'
      ? loadingPosts && posts.length > 0
      : activeTab === 'liked'
        ? loadingLiked && likedPosts.length > 0
        : loadingBookmarked && bookmarkedPosts.length > 0;

  const tabHasMore =
    activeTab === 'grid' || activeTab === 'list'
      ? hasMorePosts
      : activeTab === 'liked'
        ? hasMoreLiked
        : hasMoreBookmarked;

  const isLoadingMoreRef = useRef(isLoadingMore);
  const tabHasMoreRef = useRef(tabHasMore);
  const handleLoadMoreRef = useRef(handleLoadMore);
  isLoadingMoreRef.current = isLoadingMore;
  tabHasMoreRef.current = tabHasMore;
  handleLoadMoreRef.current = handleLoadMore;

  const handleScroll = useCallback(({ nativeEvent }: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    if (distanceFromBottom < 300 && !isLoadingMoreRef.current && tabHasMoreRef.current) {
      handleLoadMoreRef.current();
    }
  }, []);
  const goToPost = (postId: string) => navigation?.navigate('PostDetail', { postId });

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={200}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent}
            colors={[Colors.accent]}
          />
        }>
        <View style={styles.coverWrapper}>
          <LinearGradient
            colors={['#2A1A4E', '#0A1628', '#0F0F1A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cover}>
            <View style={styles.coverOrb1} />
            <View style={styles.coverOrb2} />
          </LinearGradient>
          <View style={styles.coverTopBar}>
            <TouchableOpacity style={styles.coverBtn} onPress={() => navigation?.goBack()}>
              <ArrowLeft size={20} color={Colors.white} />
            </TouchableOpacity>
            <View style={styles.coverBtnGroup}>
              <TouchableOpacity style={styles.coverBtn}>
                <Share2 size={18} color={Colors.white} />
              </TouchableOpacity>
              {isOwn && (
                <TouchableOpacity
                  style={styles.coverBtn}
                  onPress={() => navigation?.navigate('Settings')}>
                  <Settings size={18} color={Colors.white} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {loadingProfile && !displayUser ? (
          <View style={styles.profileLoader}>
            <ActivityIndicator color={Colors.accent} />
          </View>
        ) : displayUser ? (
          <View style={styles.profileSection}>
            <View style={styles.avatarWrapper}>
              <ProfileAvatar
                photoURL={displayUser.photoURL}
                displayName={displayUser.displayName}
              />
            </View>

            <View style={styles.nameActionsRow}>
              <View>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{displayUser.displayName}</Text>
                  {displayUser.emailVerified && (
                    <View style={styles.verifiedBadge}>
                      <Check size={10} color={Colors.white} strokeWidth={3} />
                    </View>
                  )}
                </View>
                <Text style={styles.handle}>
                  @{displayUser.displayName.toLowerCase().replace(/\s+/g, '')}
                </Text>
              </View>

              {isOwn ? (
                <TouchableOpacity
                  style={styles.editProfileBtn}
                  onPress={() => navigation?.navigate('EditProfile')}>
                  <LinearGradient
                    colors={['rgba(124,58,237,0.2)', 'rgba(124,58,237,0.1)']}
                    style={styles.editProfileBtnGrad}>
                    <Edit3 size={14} color={Colors.primaryLight} />
                    <Text style={styles.editProfileText}>Edit Profile</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <View style={styles.followActions}>
                  <TouchableOpacity
                    style={styles.followBtnWrapper}
                    onPress={() => setIsFollowing(f => !f)}
                    activeOpacity={0.85}>
                    {isFollowing ? (
                      <View style={styles.followingBtn}>
                        <Text style={styles.followingText}>Following</Text>
                      </View>
                    ) : (
                      <LinearGradient colors={['#7C3AED', '#9D6FFF']} style={styles.followBtn}>
                        <UserPlus size={14} color={Colors.white} />
                        <Text style={styles.followText}>Follow</Text>
                      </LinearGradient>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.dmBtn}>
                    <MessageCircle size={16} color={Colors.text.secondary} />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {!!displayUser.bio && <Text style={styles.bio}>{displayUser.bio}</Text>}

            <View style={styles.metaRow}>
              {!!displayUser.location && (
                <View style={styles.metaItem}>
                  <MapPin size={13} color={Colors.text.tertiary} />
                  <Text style={styles.metaText}>{displayUser.location}</Text>
                </View>
              )}
              {!!displayUser.website && (
                <View style={styles.metaItem}>
                  <Link2 size={13} color={Colors.accent} />
                  <Text style={[styles.metaText, { color: Colors.accent }]}>
                    {displayUser.website.replace(/^https?:\/\//, '')}
                  </Text>
                </View>
              )}
              <View style={styles.metaItem}>
                <Calendar size={13} color={Colors.text.tertiary} />
                <Text style={styles.metaText}>Joined {joinDate(displayUser.createdAt)}</Text>
              </View>
            </View>

            <View style={styles.statsCard}>
              <LinearGradient
                colors={['rgba(124,58,237,0.08)', 'rgba(0,229,195,0.04)']}
                style={styles.statsGrad}>
                <StatItem value={displayUser.postsCount ?? 0} label="Posts" />
                <View style={styles.statsDivider} />
                <StatItem value={displayUser.followersCount ?? 0} label="Followers" />
                <View style={styles.statsDivider} />
                <StatItem value={displayUser.followingCount ?? 0} label="Following" />
              </LinearGradient>
            </View>
          </View>
        ) : null}

        <View style={styles.tabBar}>
          {[
            { key: 'grid' as Tab, Icon: Grid3X3 },
            { key: 'list' as Tab, Icon: List },
            { key: 'liked' as Tab, Icon: Heart },
            { key: 'bookmarked' as Tab, Icon: Bookmark },
          ].map(({ key, Icon }) => (
            <TouchableOpacity
              key={key}
              style={[styles.tabBtn, activeTab === key && styles.tabBtnActive]}
              onPress={() => setActiveTab(key)}>
              <Icon
                size={18}
                color={activeTab === key ? Colors.primary : Colors.text.tertiary}
                fill={key === 'liked' && activeTab === 'liked' ? Colors.primary : 'none'}
              />
              {activeTab === key && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'grid' && (
          <>
            {loadingPosts && posts.length === 0 ? (
              <View style={styles.tabLoader}>
                <ActivityIndicator color={Colors.accent} />
              </View>
            ) : posts.length === 0 ? (
              <EmptyState
                icon={<ImageIcon size={24} color={Colors.text.tertiary} />}
                title="No posts yet"
                sub="Posts you share will appear here"
              />
            ) : (
              <View style={styles.grid}>
                {posts.map(p => (
                  <GridPostCard key={p.postId} post={p} onPress={() => goToPost(p.postId)} />
                ))}
              </View>
            )}
          </>
        )}

        {activeTab === 'list' && (
          <>
            {loadingPosts && posts.length === 0 ? (
              <View style={styles.tabLoader}>
                <ActivityIndicator color={Colors.accent} />
              </View>
            ) : posts.length === 0 ? (
              <EmptyState
                icon={<List size={24} color={Colors.text.tertiary} />}
                title="No posts yet"
                sub="Posts you share will appear here"
              />
            ) : (
              <View style={styles.listContainer}>
                {posts.map(p => (
                  <ListPostCard key={p.postId} post={p} onPress={() => goToPost(p.postId)} />
                ))}
              </View>
            )}
          </>
        )}

        {activeTab === 'liked' && (
          <>
            {loadingLiked && likedPosts.length === 0 ? (
              <View style={styles.tabLoader}>
                <ActivityIndicator color={Colors.accent} />
              </View>
            ) : likedPosts.length === 0 ? (
              <EmptyState
                icon={<Heart size={24} color={Colors.text.tertiary} />}
                title="No liked posts"
                sub="Posts you like will appear here"
              />
            ) : (
              <View style={styles.listContainer}>
                {likedPosts.map(p => (
                  <ListPostCard key={p.postId} post={p} onPress={() => goToPost(p.postId)} />
                ))}
              </View>
            )}
          </>
        )}

        {activeTab === 'bookmarked' && (
          <>
            {loadingBookmarked && bookmarkedPosts.length === 0 ? (
              <View style={styles.tabLoader}>
                <ActivityIndicator color={Colors.accent} />
              </View>
            ) : bookmarkedPosts.length === 0 ? (
              <EmptyState
                icon={<Bookmark size={24} color={Colors.text.tertiary} />}
                title="No saved posts"
                sub="Bookmark posts to find them later"
              />
            ) : (
              <View style={styles.listContainer}>
                {bookmarkedPosts.map(p => (
                  <ListPostCard key={p.postId} post={p} onPress={() => goToPost(p.postId)} />
                ))}
              </View>
            )}
          </>
        )}

        <InlineLoader loading={isLoadingMore} />
        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg.primary },

  coverWrapper: { height: 180, position: 'relative' },
  cover: { flex: 1, overflow: 'hidden' },
  coverOrb1: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(124,58,237,0.3)',
  },
  coverOrb2: {
    position: 'absolute',
    bottom: -20,
    left: 40,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(0,229,195,0.15)',
  },
  coverTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: 52,
    paddingBottom: Spacing.sm,
  },
  coverBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverBtnGroup: { flexDirection: 'row', gap: Spacing.sm },

  profileSection: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  profileLoader: { paddingVertical: 60, alignItems: 'center' },

  avatarWrapper: {
    marginTop: -42,
    marginBottom: Spacing.md,
    alignSelf: 'flex-start',
    position: 'relative',
  },
  avatarEditBtn: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.bg.primary,
    ...Shadow.brand,
  },

  nameActionsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 22, fontWeight: '800', color: Colors.text.primary, letterSpacing: -0.6 },
  verifiedBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: { fontSize: 14, color: Colors.text.tertiary, marginTop: 2, fontWeight: '500' },

  editProfileBtn: {
    borderRadius: Radius.full,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.4)',
    marginTop: 4,
  },
  editProfileBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  editProfileText: { fontSize: 13, fontWeight: '700', color: Colors.primaryLight },

  followActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  followBtnWrapper: { borderRadius: Radius.full, overflow: 'hidden', ...Shadow.brand },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
  },
  followText: { fontSize: 14, fontWeight: '700', color: Colors.white },
  followingBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    backgroundColor: Colors.bg.tertiary,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    borderRadius: Radius.full,
  },
  followingText: { fontSize: 14, fontWeight: '700', color: Colors.text.secondary },
  dmBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.bg.glass,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bio: { fontSize: 14, color: Colors.text.secondary, lineHeight: 22, marginBottom: Spacing.md },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.lg },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 13, color: Colors.text.tertiary, fontWeight: '500' },

  statsCard: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    ...Shadow.soft,
  },
  statsGrad: { flexDirection: 'row', paddingVertical: Spacing.md },
  statsDivider: { width: 1, backgroundColor: Colors.border.subtle, marginVertical: 8 },

  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border.subtle,
    marginBottom: Spacing.md,
  },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, position: 'relative' },
  tabBtnActive: {},
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '20%',
    right: '20%',
    height: 2,
    backgroundColor: Colors.primary,
    borderRadius: 1,
  },

  tabLoader: { paddingVertical: 40, alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  listContainer: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
});
