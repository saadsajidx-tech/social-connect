import React, { useState, useCallback, useContext, useRef } from 'react';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabParamList } from '../../../navigation/BottomTabs';
import { HomeStackParamList } from '../../../navigation/HomeNavigator';

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Image,
  RefreshControl,
  Modal,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {
  Search as SearchIcon,
  X,
  Users,
  FileText,
  ArrowLeft,
  AlertCircle,
  Clock,
  Heart,
  MessageCircle,
  Star,
  Hash,
  TrendingUp,
  Flame,
  Zap,
  ChevronRight,
  ArrowDown,
} from 'lucide-react-native';

import { Colors, Spacing, Radius, Shadow } from '../../../utilities/theme';
import { ISearchUser, ITagSuggestion, useSearch } from '../../../Hooks/useSearch';
import { IPostWithUser } from '../../../interfaces/IPost';
import { useUser } from '../../../Hooks/useUser';
import { TransparentStatusBar } from '../../../component/common/TransparentStatusBar';

const { width, height } = Dimensions.get('window');

const TABS = [
  { key: 'all', label: 'All', Icon: SearchIcon },
  { key: 'posts', label: 'Posts', Icon: FileText },
  { key: 'people', label: 'People', Icon: Users },
  { key: 'tags', label: 'Tags', Icon: Hash },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const TAGS_PREVIEW = 6;
const PEOPLE_PREVIEW = 4;

function hashColor(s: string): string {
  const p = [
    '#EC4899',
    '#00B89C',
    '#F59E0B',
    '#8B5CF6',
    '#3B82F6',
    '#EF4444',
    '#10B981',
    '#F97316',
  ];
  let h = 0;
  for (let i = 0; i < (s?.length ?? 0); i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return p[Math.abs(h) % p.length];
}

function fmtCount(n?: number): string {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

const BottomSheet = ({ visible, onClose, title, subtitle, children }: BottomSheetProps) => (
  <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <TouchableOpacity style={sh.backdrop} activeOpacity={1} onPress={onClose} />

    <View style={sh.sheet}>
      <View style={sh.handle} />

      <View style={sh.header}>
        <View style={{ flex: 1 }}>
          <Text style={sh.title}>{title}</Text>
          {subtitle ? <Text style={sh.subtitle}>{subtitle}</Text> : null}
        </View>
        <TouchableOpacity
          onPress={onClose}
          style={sh.closeBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <X size={17} color={Colors.text.secondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={sh.content}>
        {children}
      </ScrollView>
    </View>
  </Modal>
);

const sh = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.8,
    backgroundColor: '#0D0D1C',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    overflow: 'hidden',
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  title: { fontSize: 18, fontWeight: '800', color: Colors.text.primary, letterSpacing: -0.4 },
  subtitle: { fontSize: 12, color: Colors.text.tertiary, marginTop: 3 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: 56 },
});

const Avatar = ({ uri, name, size = 44 }: { uri?: string; name: string; size?: number }) => {
  const color = hashColor(name);
  if (uri)
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color + '22',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: color + '44',
      }}>
      <Text style={{ color, fontSize: size * 0.38, fontWeight: '800' }}>
        {name?.[0]?.toUpperCase() ?? '?'}
      </Text>
    </View>
  );
};

const TrendingTagCard = ({
  tag,
  rank,
  onPress,
}: {
  tag: ITagSuggestion;
  rank: number;
  onPress: () => void;
}) => {
  const color = hashColor(tag.tagLower);
  const isHot = rank <= 3;
  const CARD_W = (width - Spacing.lg * 2 - Spacing.sm) / 2;

  return (
    <TouchableOpacity style={[ttc.card, { width: CARD_W }]} onPress={onPress} activeOpacity={0.78}>
      <LinearGradient
        colors={[color + '28', color + '0C']}
        style={ttc.grad}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}>
        <View style={ttc.top}>
          <View style={[ttc.rankBadge, { backgroundColor: color + '30' }]}>
            <Text style={[ttc.rankTxt, { color }]}>#{rank}</Text>
          </View>
          {isHot && (
            <View
              style={[ttc.hotBadge, { backgroundColor: color + '25', borderColor: color + '55' }]}>
              <Flame size={8} color={color} />
              <Text style={[ttc.hotTxt, { color }]}>Hot</Text>
            </View>
          )}
        </View>

        <View style={ttc.nameRow}>
          <Hash size={13} color={color} strokeWidth={2.5} />
          <Text style={[ttc.name, { color }]} numberOfLines={1}>
            {tag.tagLower}
          </Text>
        </View>

        <Text style={ttc.count}>{fmtCount(tag.count)} posts</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const ttc = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: Spacing.sm,
  },
  grad: { padding: Spacing.md, minHeight: 100 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  rankBadge: { borderRadius: Radius.full, paddingHorizontal: 7, paddingVertical: 2 },
  rankTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  hotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  hotTxt: { fontSize: 9, fontWeight: '800' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 7 },
  name: { fontSize: 15, fontWeight: '800', letterSpacing: -0.4, flex: 1 },
  count: { fontSize: 11, color: 'rgba(255,255,255,0.38)', fontWeight: '500' },
});

const TagsGrid = ({
  tags,
  startRank = 1,
  onPress,
}: {
  tags: ITagSuggestion[];
  startRank?: number;
  onPress: (tag: ITagSuggestion) => void;
}) => (
  <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
    <View style={{ flex: 1 }}>
      {tags
        .filter((_, i) => i % 2 === 0)
        .map((tag, i) => (
          <TrendingTagCard
            key={tag.tagLower}
            tag={tag}
            rank={startRank + i * 2}
            onPress={() => onPress(tag)}
          />
        ))}
    </View>
    <View style={{ flex: 1 }}>
      {tags
        .filter((_, i) => i % 2 !== 0)
        .map((tag, i) => (
          <TrendingTagCard
            key={tag.tagLower}
            tag={tag}
            rank={startRank + 1 + i * 2}
            onPress={() => onPress(tag)}
          />
        ))}
    </View>
  </View>
);

const TagPill = ({
  tag,
  onPress,
  active = false,
}: {
  tag: ITagSuggestion;
  onPress: () => void;
  active?: boolean;
}) => (
  <TouchableOpacity
    style={[tp.pill, active && tp.pillActive]}
    onPress={onPress}
    activeOpacity={0.75}>
    <Hash size={11} color={active ? Colors.accent : Colors.primaryLight} />
    <Text style={[tp.tag, active && tp.tagActive]}>{tag.tagLower}</Text>
    <View style={[tp.badge, active && tp.badgeActive]}>
      <Text style={[tp.cnt, active && tp.cntActive]}>{fmtCount(tag.count)}</Text>
    </View>
  </TouchableOpacity>
);

const tp = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(124,58,237,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.28)',
  },
  pillActive: { backgroundColor: 'rgba(0,229,195,0.12)', borderColor: 'rgba(0,229,195,0.45)' },
  tag: { fontSize: 13, fontWeight: '700', color: Colors.primaryLight },
  tagActive: { color: Colors.accent },
  badge: {
    backgroundColor: 'rgba(124,58,237,0.25)',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgeActive: { backgroundColor: 'rgba(0,229,195,0.25)' },
  cnt: { fontSize: 10, fontWeight: '700', color: Colors.primaryLight },
  cntActive: { color: Colors.accent },
});

const UserRow = ({
  user,
  onFollow,
  onUnfollow,
  inProgress,
  onPress,
  noBorder,
}: {
  user: ISearchUser;
  onFollow: (id: string) => void;
  onUnfollow: (id: string) => void;
  inProgress: boolean;
  onPress?: () => void;
  noBorder?: boolean;
}) => (
  <TouchableOpacity
    style={[ur.row, noBorder && { borderBottomWidth: 0 }]}
    onPress={onPress}
    activeOpacity={onPress ? 0.75 : 1}>
    <Avatar uri={user.photoURL} name={user.displayName} size={46} />
    <View style={ur.info}>
      <Text style={ur.name} numberOfLines={1}>
        {user.displayName}
      </Text>
      <Text style={ur.sub} numberOfLines={1}>
        {user.bio || `${fmtCount(user.followersCount)} followers · ${user.postsCount} posts`}
      </Text>
    </View>
    <TouchableOpacity
      style={[ur.btn, user.isFollowing && ur.btnOn]}
      onPress={() => (user.isFollowing ? onUnfollow(user.userId) : onFollow(user.userId))}
      disabled={inProgress}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
      {inProgress ? (
        <ActivityIndicator size={12} color={Colors.primaryLight} />
      ) : (
        <Text style={[ur.txt, user.isFollowing && ur.txtOn]}>
          {user.isFollowing ? 'Following' : 'Follow'}
        </Text>
      )}
    </TouchableOpacity>
  </TouchableOpacity>
);

const ur = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  info: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: '700', color: Colors.text.primary },
  sub: { fontSize: 12, color: Colors.text.tertiary, marginTop: 2 },
  btn: {
    minWidth: 84,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,58,237,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.3)',
  },
  btnOn: { backgroundColor: Colors.bg.tertiary, borderColor: Colors.border.medium },
  txt: { fontSize: 13, fontWeight: '700', color: Colors.primaryLight },
  txtOn: { color: Colors.text.tertiary },
});

const PostCard = ({
  post,
  activeTag,
  onPress,
}: {
  post: IPostWithUser;
  activeTag?: string | null;
  onPress: () => void;
}) => (
  <TouchableOpacity style={pc.card} onPress={onPress} activeOpacity={0.82}>
    <LinearGradient colors={['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.01)']} style={pc.grad}>
      <View style={pc.header}>
        <Avatar uri={post.user?.photoURL} name={post.user?.displayName ?? '?'} size={34} />
        <View style={pc.hInfo}>
          <Text style={pc.author}>{post.user?.displayName ?? 'Unknown'}</Text>
          <Text style={pc.time}>{timeAgo(post.createdAt)}</Text>
        </View>
        {post.visibility !== 'public' && (
          <Text style={pc.vis}>{post.visibility === 'followers' ? '👥' : '🔒'}</Text>
        )}
      </View>

      <Text style={pc.content} numberOfLines={4}>
        {post.content}
      </Text>

      {post.images?.length > 0 && (
        <View style={pc.imgRow}>
          {post.images.slice(0, 3).map(img => (
            <Image
              key={img.publicId}
              source={{ uri: img.url }}
              style={[pc.thumb, post.images.length === 1 && { flex: 1, width: undefined }]}
            />
          ))}
          {post.images.length > 3 && (
            <View style={pc.moreBox}>
              <Text style={pc.moreTxt}>+{post.images.length - 3}</Text>
            </View>
          )}
        </View>
      )}

      {post.hashtags?.length > 0 && (
        <View style={pc.tagsRow}>
          {post.hashtags.slice(0, 5).map(tag => (
            <View key={tag} style={[pc.htag, activeTag === tag && pc.htagActive]}>
              <Text style={[pc.htagTxt, activeTag === tag && pc.htagTxtActive]}>{tag}</Text>
            </View>
          ))}
          {post.hashtags.length > 5 && <Text style={pc.htagMore}>+{post.hashtags.length - 5}</Text>}
        </View>
      )}

      <View style={pc.stats}>
        <View style={pc.stat}>
          <Heart size={13} color={Colors.text.tertiary} />
          <Text style={pc.statTxt}>{fmtCount(post.likesCount)}</Text>
        </View>
        <View style={pc.stat}>
          <MessageCircle size={13} color={Colors.text.tertiary} />
          <Text style={pc.statTxt}>{fmtCount(post.commentsCount)}</Text>
        </View>
      </View>
    </LinearGradient>
  </TouchableOpacity>
);

const pc = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    marginBottom: Spacing.sm,
  },
  grad: { padding: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 10 },
  hInfo: { flex: 1 },
  author: { fontSize: 13, fontWeight: '700', color: Colors.text.primary },
  time: { fontSize: 11, color: Colors.text.tertiary, marginTop: 1 },
  vis: { fontSize: 14 },
  content: { fontSize: 14, color: Colors.text.secondary, lineHeight: 22 },
  imgRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 10,
    height: 90,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  thumb: { width: 90, height: 90, borderRadius: Radius.sm, backgroundColor: Colors.bg.tertiary },
  moreBox: {
    width: 60,
    height: 90,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 10 },
  htag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(124,58,237,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.2)',
  },
  htagActive: { backgroundColor: 'rgba(0,229,195,0.12)', borderColor: 'rgba(0,229,195,0.4)' },
  htagTxt: { fontSize: 11, fontWeight: '600', color: Colors.primaryLight },
  htagTxtActive: { color: Colors.accent, fontWeight: '700' },
  htagMore: { fontSize: 11, color: Colors.text.tertiary, alignSelf: 'center' },
  stats: { flexDirection: 'row', gap: Spacing.md, marginTop: 10 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statTxt: { fontSize: 12, color: Colors.text.tertiary },
});

const UsersBlock = ({
  users,
  onFollow,
  onUnfollow,
  inProgress,
  onPressUser,
}: {
  users: ISearchUser[];
  onFollow: (id: string) => void;
  onUnfollow: (id: string) => void;
  inProgress: Set<string>;
  onPressUser: (id: string) => void;
}) => (
  <View style={s.usersCard}>
    <LinearGradient colors={['rgba(124,58,237,0.06)', 'rgba(0,229,195,0.03)']} style={s.usersGrad}>
      {users.map((u, idx) => (
        <UserRow
          key={u.userId}
          user={u}
          onFollow={onFollow}
          onUnfollow={onUnfollow}
          inProgress={inProgress.has(u.userId)}
          noBorder={idx === users.length - 1}
          onPress={() => onPressUser(u.userId)}
        />
      ))}
    </LinearGradient>
  </View>
);

const SectionHeader = ({
  icon,
  title,
  right,
}: {
  icon: React.ReactNode;
  title: string;
  right?: React.ReactNode;
}) => (
  <View style={s.sectionHeader}>
    <View style={s.sectionLeft}>
      {icon}
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
    {right}
  </View>
);

const Loader = ({ text }: { text: string }) => (
  <View
    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: Spacing.lg }}>
    <ActivityIndicator size="small" color={Colors.accent} />
    <Text style={{ fontSize: 14, color: Colors.text.tertiary }}>{text}</Text>
  </View>
);

const ViewAllBtn = ({
  icon,
  label,
  count,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  onPress: () => void;
}) => (
  <TouchableOpacity style={s.viewAllBtn} onPress={onPress} activeOpacity={0.8}>
    <LinearGradient
      colors={['rgba(124,58,237,0.16)', 'rgba(0,229,195,0.10)']}
      style={s.viewAllGrad}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}>
      <View style={s.viewAllLeft}>
        {icon}
        <Text style={s.viewAllTxt}>{label}</Text>
        {count !== undefined && (
          <View style={s.viewAllBadge}>
            <Text style={s.viewAllBadgeTxt}>{count}</Text>
          </View>
        )}
      </View>
      <ChevronRight size={16} color={Colors.accent} />
    </LinearGradient>
  </TouchableOpacity>
);

type Props = CompositeScreenProps<
  BottomTabScreenProps<BottomTabParamList, 'TabSearch'>,
  NativeStackScreenProps<HomeStackParamList>
>;

export default function TabSearch({ navigation }: Props) {
  const { user } = useUser();
  const inputRef = useRef<TextInput>(null);

  const [focused, setFocused] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [tagsModal, setTagsModal] = useState(false);
  const [peopleModal, setPeopleModal] = useState(false);

  const {
    searchQuery,
    setSearchQuery,
    activeTab,
    setActiveTab,
    state,
    searching,
    hasResults,
    selectTag,
    trendingTags,
    trendingLoading,
    suggestedUsers,
    suggestedLoading,
    recentSearches,
    addRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
    followUser,
    unfollowUser,
    followingInProgress,
    loadMorePosts,
    hasMorePosts,
    loadingMorePosts,
    error,
    clearError,
  } = useSearch(user?.userId ?? '');

  const isActive = searchQuery.length > 0;
  const showPeople = activeTab === 'all' || activeTab === 'people';
  const showPosts = activeTab === 'all' || activeTab === 'posts';
  const showTags = activeTab === 'all' || activeTab === 'tags';

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setFocused(false);
    inputRef.current?.blur();
  }, [setSearchQuery]);

  const goToUser = (userId: string) => navigation?.navigate('ViewUserProfile', { userId });

  const goToPost = (postId: string) => navigation?.navigate('PostDetail', { postId });

  const handleSelectTag = useCallback(
    (tag: ITagSuggestion) => {
      setTagsModal(false);
      inputRef.current?.blur();
      selectTag(tag);
    },
    [selectTag],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (searchQuery) setSearchQuery(searchQuery);
    await new Promise<void>(r => setTimeout(r, 500));
    setRefreshing(false);
  }, [searchQuery, setSearchQuery]);

  const TagsModal = () => (
    <BottomSheet
      visible={tagsModal}
      onClose={() => setTagsModal(false)}
      title="All Trending Tags"
      subtitle={`${trendingTags.length} tags · sorted by popularity`}>
      <TagsGrid tags={trendingTags} startRank={1} onPress={handleSelectTag} />
    </BottomSheet>
  );

  const PeopleModal = () => (
    <BottomSheet
      visible={peopleModal}
      onClose={() => setPeopleModal(false)}
      title="Who to Follow"
      subtitle={`${suggestedUsers.length} suggested people`}>
      {suggestedUsers.map((u, idx) => (
        <UserRow
          key={u.userId}
          user={u}
          onFollow={followUser}
          onUnfollow={unfollowUser}
          inProgress={followingInProgress.has(u.userId)}
          noBorder={idx === suggestedUsers.length - 1}
          onPress={() => {
            setPeopleModal(false);
            goToUser(u.userId);
          }}
        />
      ))}
    </BottomSheet>
  );

  const FocusedEmptyScreen = () => (
    <>
      {recentSearches.length > 0 ? (
        <View style={s.section}>
          <SectionHeader
            icon={<Clock size={14} color={Colors.text.tertiary} />}
            title="Recent Searches"
            right={
              <TouchableOpacity
                onPress={clearRecentSearches}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={s.action}>Clear all</Text>
              </TouchableOpacity>
            }
          />
          {recentSearches.map(term => (
            <TouchableOpacity
              key={term}
              style={s.recentRow}
              onPress={() => setSearchQuery(term)}
              activeOpacity={0.7}>
              <View style={s.recentIcon}>
                <Clock size={14} color={Colors.text.tertiary} />
              </View>
              <Text style={s.recentTxt} numberOfLines={1}>
                {term}
              </Text>
              <TouchableOpacity
                onPress={() => removeRecentSearch(term)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <X size={13} color={Colors.text.tertiary} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View style={s.centered}>
          <View style={s.emptyIcon}>
            <SearchIcon size={26} color={Colors.text.tertiary} />
          </View>
          <Text style={s.emptyTitle}>Search anything</Text>
          <Text style={s.emptySub}>
            Try a name like <Text style={s.emptyHL}>User</Text> or a topic like{' '}
            <Text style={s.emptyHL}>Future</Text>
          </Text>
        </View>
      )}
      <View style={{ height: 120 }} />
    </>
  );

  const DiscoveryScreen = () => {
    const previewTags = trendingTags.slice(0, TAGS_PREVIEW);
    const previewPeople = suggestedUsers.slice(0, PEOPLE_PREVIEW);
    const moreTags = trendingTags.length > TAGS_PREVIEW;
    const morePeople = suggestedUsers.length > PEOPLE_PREVIEW;

    return (
      <>
        <View style={s.section}>
          <SectionHeader
            icon={<TrendingUp size={16} color={Colors.accent} />}
            title="Trending Tags"
          />
          {trendingLoading ? (
            <Loader text="Loading trending…" />
          ) : trendingTags.length === 0 ? (
            <View style={s.emptyInline}>
              <Hash size={28} color={Colors.text.tertiary} strokeWidth={1.5} />
              <Text style={s.emptyInlineTitle}>No trending tags yet</Text>
              <Text style={s.emptyInlineSub}>Tags appear here as people post with hashtags</Text>
            </View>
          ) : (
            <>
              <TagsGrid tags={previewTags} startRank={1} onPress={handleSelectTag} />
              {moreTags && (
                <ViewAllBtn
                  icon={<TrendingUp size={14} color={Colors.accent} />}
                  label="View all trending tags"
                  count={trendingTags.length}
                  onPress={() => setTagsModal(true)}
                />
              )}
            </>
          )}
        </View>

        <View style={s.section}>
          <SectionHeader icon={<Star size={15} color={Colors.warning} />} title="Who to Follow" />
          {suggestedLoading ? (
            <Loader text="Finding people…" />
          ) : suggestedUsers.length === 0 ? (
            <Text style={s.emptyLine}>No suggestions right now.</Text>
          ) : (
            <>
              <UsersBlock
                users={previewPeople}
                onFollow={followUser}
                onUnfollow={unfollowUser}
                inProgress={followingInProgress}
                onPressUser={goToUser}
              />
              {morePeople && (
                <ViewAllBtn
                  icon={<Users size={14} color={Colors.accent} />}
                  label="View more people"
                  count={suggestedUsers.length - PEOPLE_PREVIEW}
                  onPress={() => setPeopleModal(true)}
                />
              )}
            </>
          )}
        </View>

        <View style={{ height: 120 }} />
      </>
    );
  };

  const ResultsScreen = () => {
    if (searching && !hasResults) {
      return (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={s.centeredSub}>Searching…</Text>
        </View>
      );
    }

    if (!searching && !hasResults) {
      return (
        <View style={s.centered}>
          <View style={s.emptyIcon}>
            <SearchIcon size={28} color={Colors.text.tertiary} />
          </View>
          <Text style={s.emptyTitle}>No results</Text>
          <Text style={s.emptySub}>
            Try a name like <Text style={s.emptyHL}>User</Text> or a topic like{' '}
            <Text style={s.emptyHL}>Future</Text>
          </Text>
        </View>
      );
    }

    return (
      <>
        {showTags && state.tagSuggestions.length > 0 && (
          <View style={s.section}>
            <View style={s.tagRow}>
              <Hash size={12} color={Colors.text.tertiary} />
              <Text style={s.sectionLabel}>
                {state.phase === 'tag_selected' ? 'ACTIVE TAG' : 'MATCHING TAGS'}
              </Text>
              {state.phase === 'tag_selected' && state.selectedTag && (
                <View style={s.liveChip}>
                  <Zap size={9} color={Colors.accent} />
                  <Text style={s.liveTxt}>{fmtCount(state.selectedTag.count)} posts</Text>
                </View>
              )}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -Spacing.lg }}
              contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: 8 }}>
              {state.tagSuggestions.map(tag => (
                <TagPill
                  key={tag.tagLower}
                  tag={tag}
                  active={state.selectedTag?.tagLower === tag.tagLower}
                  onPress={() => handleSelectTag(tag)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {showPeople && state.users.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>PEOPLE</Text>
            <UsersBlock
              users={state.users}
              onFollow={followUser}
              onUnfollow={unfollowUser}
              inProgress={followingInProgress}
              onPressUser={goToUser}
            />
          </View>
        )}

        {showPosts && (
          <View style={s.section}>
            {state.posts.length > 0 ? (
              <>
                <View style={s.postsLabelRow}>
                  <Text style={s.sectionLabel}>POSTS</Text>
                  {searching && (
                    <ActivityIndicator size={11} color={Colors.accent} style={{ marginLeft: 6 }} />
                  )}
                </View>

                {state.posts.map(post => (
                  <PostCard
                    key={post.postId}
                    post={post}
                    activeTag={state.selectedTag?.tag}
                    onPress={() => goToPost(post.postId)}
                  />
                ))}

                {hasMorePosts && (
                  <ViewAllBtn
                    icon={
                      loadingMorePosts ? (
                        <ActivityIndicator size={14} color={Colors.accent} />
                      ) : (
                        <ArrowDown size={14} color={Colors.accent} />
                      )
                    }
                    label={loadingMorePosts ? 'Loading more posts…' : 'Load more posts'}
                    onPress={loadMorePosts}
                  />
                )}
              </>
            ) : (
              state.tagSuggestions.length > 0 &&
              state.phase === 'suggesting' &&
              !searching && (
                <View style={s.tapHint}>
                  <Hash size={14} color={Colors.text.tertiary} />
                  <Text style={s.tapHintTxt}>Tap a tag above to see its posts</Text>
                </View>
              )
            )}
          </View>
        )}

        <View style={{ height: 120 }} />
      </>
    );
  };

  return (
    <View style={s.root}>
      <TransparentStatusBar />
      <View style={s.orb1} />
      <View style={s.orb2} />

      <TagsModal />
      <PeopleModal />

      <View style={s.header}>
        {(focused || isActive) && (
          <TouchableOpacity style={s.backBtn} onPress={clearSearch}>
            <ArrowLeft size={20} color={Colors.text.secondary} />
          </TouchableOpacity>
        )}
        <View style={[s.bar, (focused || isActive) && s.barFocused]}>
          {searching ? (
            <ActivityIndicator size={16} color={Colors.accent} />
          ) : (
            <SearchIcon size={17} color={focused ? Colors.accent : Colors.text.tertiary} />
          )}
          <TextInput
            ref={inputRef}
            style={s.input}
            placeholder="Search people or topics…"
            placeholderTextColor={Colors.text.tertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onSubmitEditing={() => {
              if (searchQuery.trim()) {
                addRecentSearch(searchQuery.trim());
                inputRef.current?.blur();
              }
            }}
            returnKeyType="search"
            selectionColor={Colors.accent}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {isActive && (
            <TouchableOpacity
              onPress={clearSearch}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={16} color={Colors.text.tertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isActive && (
        <View style={s.tabBar}>
          {TABS.map(tab => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[s.tab, active && s.tabActive]}
                onPress={() => setActiveTab(tab.key as TabKey)}>
                <tab.Icon size={13} color={active ? Colors.primary : Colors.text.tertiary} />
                <Text style={[s.tabTxt, active && s.tabTxtActive]}>{tab.label}</Text>
                {active && <View style={s.tabLine} />}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {error && (
        <TouchableOpacity style={s.errorBanner} onPress={clearError}>
          <AlertCircle size={14} color="#EF4444" />
          <Text style={s.errorTxt} numberOfLines={1}>
            {error}
          </Text>
          <X size={13} color="#EF4444" />
        </TouchableOpacity>
      )}

      <FlatList
        data={[]}
        renderItem={null}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
        }
        ListHeaderComponent={
          <View style={s.body}>
            {isActive ? <ResultsScreen /> : focused ? <FocusedEmptyScreen /> : <DiscoveryScreen />}
          </View>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg.primary, overflow: 'hidden' },
  orb1: {
    position: 'absolute',
    top: -40,
    right: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(124,58,237,0.10)',
  },
  orb2: {
    position: 'absolute',
    bottom: 200,
    left: -60,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(0,229,195,0.06)',
  },

  // Search bar
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: 56,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
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
  bar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.glass,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    paddingHorizontal: Spacing.md,
    height: 46,
    gap: Spacing.sm,
  },
  barFocused: { borderColor: Colors.accent, backgroundColor: 'rgba(0,229,195,0.05)' },
  input: { flex: 1, fontSize: 15, color: Colors.text.primary, fontWeight: '500', height: '100%' },

  // Tab bar
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border.subtle },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 11,
    position: 'relative',
  },
  tabActive: {},
  tabTxt: { fontSize: 11, fontWeight: '600', color: Colors.text.tertiary },
  tabTxtActive: { color: Colors.primary },
  tabLine: {
    position: 'absolute',
    bottom: 0,
    left: '10%',
    right: '10%',
    height: 2,
    backgroundColor: Colors.primary,
    borderRadius: 1,
  },

  // Error
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: Spacing.lg,
    marginBottom: 4,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
  },
  errorTxt: { flex: 1, fontSize: 13, color: '#EF4444', fontWeight: '500' },

  // Body + sections
  body: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  section: { marginBottom: Spacing.xl },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sectionLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text.primary,
    letterSpacing: -0.3,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.8,
    color: Colors.text.tertiary,
  },
  action: { fontSize: 13, fontWeight: '600', color: Colors.accent },

  viewAllBtn: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,229,195,0.22)',
  },
  viewAllGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
  },
  viewAllLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  viewAllTxt: { fontSize: 14, fontWeight: '700', color: Colors.accent },
  viewAllBadge: {
    backgroundColor: 'rgba(0,229,195,0.18)',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,229,195,0.3)',
  },
  viewAllBadgeTxt: { fontSize: 11, fontWeight: '800', color: Colors.accent },

  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 6,
    backgroundColor: 'rgba(0,229,195,0.1)',
    borderRadius: Radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,229,195,0.25)',
  },
  liveTxt: { fontSize: 10, fontWeight: '700', color: Colors.accent },

  postsLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },

  tapHint: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: Spacing.md },
  tapHintTxt: { fontSize: 13, color: Colors.text.tertiary },

  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  recentIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.bg.glass,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentTxt: { flex: 1, fontSize: 15, fontWeight: '500', color: Colors.text.secondary },

  usersCard: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    ...Shadow.soft,
  },
  usersGrad: { paddingHorizontal: Spacing.md },

  emptyInline: { alignItems: 'center', paddingVertical: 36, gap: 8 },
  emptyInlineTitle: { fontSize: 15, fontWeight: '700', color: Colors.text.secondary },
  emptyInlineSub: { fontSize: 13, color: Colors.text.tertiary, textAlign: 'center' },
  emptyLine: { fontSize: 14, color: Colors.text.tertiary, paddingVertical: Spacing.lg },

  centered: { alignItems: 'center', paddingVertical: 56, gap: 12 },
  centeredSub: { fontSize: 14, color: Colors.text.tertiary, fontWeight: '500' },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(124,58,237,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.2)',
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Colors.text.primary },
  emptySub: {
    fontSize: 14,
    color: Colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  emptyHL: { color: Colors.accent, fontWeight: '700' },
});
