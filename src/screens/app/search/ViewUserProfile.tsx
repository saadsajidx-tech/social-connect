import React, { useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { HomeStackParamList } from '../../../navigation/HomeNavigator';

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {
  ArrowLeft,
  MessageCircle,
  UserPlus,
  UserCheck,
  Check,
  Heart,
  MapPin,
  Link2,
  Calendar,
  Grid3X3,
  Image as ImageIcon,
  Bell,
  BellOff,
  Lock,
  AlertCircle,
} from 'lucide-react-native';
import { Colors, Spacing, Radius, Shadow } from '../../../utilities/theme';
import { IMutualFollower } from '../../../interfaces/IUser';
import { IPostWithUser } from '../../../interfaces/IPost';
import { useUser } from '../../../Hooks/useUser';
import { useComments } from '../../../Hooks/useFollow';

const { width } = Dimensions.get('window');
const GRID_ITEM = (width - Spacing.lg * 2 - Spacing.sm * 2) / 3;

const formatNum = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
};

const formatJoinDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

const buildMutualLabel = (mutuals: IMutualFollower[]): string => {
  const names = mutuals.slice(0, 2).map(m => m.displayName.split(' ')[0]);
  const extra = mutuals.length - names.length;
  return extra > 0 ? `${names.join(', ')} +${extra} others` : names.join(', ');
};

const ACCENT_PALETTE = ['#EC4899', '#7C3AED', '#3B82F6', '#10B981', '#F59E0B', '#EF4444'];
const accentFromId = (id: string): string => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return ACCENT_PALETTE[Math.abs(hash) % ACCENT_PALETTE.length];
};

const StatPill = ({
  value,
  label,
  onPress,
}: {
  value: number;
  label: string;
  onPress?: () => void;
}) => (
  <TouchableOpacity style={statS.wrapper} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
    <Text style={statS.value}>{formatNum(value)}</Text>
    <Text style={statS.label}>{label}</Text>
  </TouchableOpacity>
);

const statS = StyleSheet.create({
  wrapper: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm },
  value: { fontSize: 21, fontWeight: '800', color: Colors.text.primary, letterSpacing: -0.8 },
  label: { fontSize: 12, color: Colors.text.tertiary, fontWeight: '500', marginTop: 2 },
});

const UserAvatar = ({
  photoURL,
  displayName,
  color,
  size = 74,
}: {
  photoURL?: string;
  displayName: string;
  color: string;
  size?: number;
}) =>
  photoURL ? (
    <Image
      source={{ uri: photoURL }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 3,
        borderColor: Colors.bg.primary,
      }}
    />
  ) : (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color + '22',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: Colors.bg.primary,
      }}>
      <Text style={{ fontSize: size * 0.4, fontWeight: '800', color }}>
        {(displayName?.[0] ?? '?').toUpperCase()}
      </Text>
    </View>
  );

const GridPost = ({ post, navigation }: { post: IPostWithUser; navigation: any }) => {
  const firstImage = post.images?.[0];
  return (
    <TouchableOpacity
      style={gridS.item}
      onPress={() => navigation?.navigate('PostDetail', { postId: post.postId })}
      activeOpacity={0.8}>
      {firstImage ? (
        <Image
          source={{ uri: firstImage.url }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
        />
      ) : (
        <LinearGradient colors={['#12121E', '#1A1A2E']} style={gridS.itemGrad}>
          <Text style={gridS.textPreview} numberOfLines={3}>
            {post.content}
          </Text>
        </LinearGradient>
      )}
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.65)']} style={gridS.overlay}>
        <View style={gridS.stat}>
          <Heart size={10} color={Colors.white} fill={Colors.white} />
          <Text style={gridS.statText}>{formatNum(post.likesCount)}</Text>
        </View>
      </LinearGradient>
      {post.images?.length > 1 && (
        <View style={gridS.multiBadge}>
          <ImageIcon size={8} color={Colors.white} />
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
    position: 'relative',
    backgroundColor: '#12121E',
  },
  itemGrad: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 6 },
  textPreview: { fontSize: 9, color: Colors.text.secondary, textAlign: 'center', lineHeight: 13 },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 34,
    justifyContent: 'flex-end',
    paddingHorizontal: 6,
    paddingBottom: 5,
  },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statText: { fontSize: 9, fontWeight: '700', color: Colors.white },
  multiBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 16,
    height: 16,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const ProfileSkeleton = () => (
  <View style={skelS.root}>
    <View style={skelS.avatarRow}>
      <View style={skelS.avatar} />
      <View style={skelS.btnPlaceholder} />
    </View>
    {([140, 80, '100%', '90%', '70%'] as const).map((w, i) => (
      <View
        key={i}
        style={[skelS.line, { width: w as any, marginTop: i === 0 ? Spacing.md : 8 }]}
      />
    ))}
  </View>
);

const skelS = StyleSheet.create({
  root: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  avatarRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.bg.tertiary },
  btnPlaceholder: {
    width: 100,
    height: 38,
    borderRadius: Radius.full,
    backgroundColor: Colors.bg.tertiary,
  },
  line: { height: 14, borderRadius: 7, backgroundColor: Colors.bg.tertiary },
});

type Props = NativeStackScreenProps<HomeStackParamList, 'ViewUserProfile'>;
export default function ViewUserProfile({ navigation, route }: Props) {
  const { userId: targetUserId } = route.params as { userId: string };
  const { user: currentUser } = useUser();

  const {
    profileUser,
    loadingProfile,
    profileError,
    isFollowing,
    followsYouBack,
    followLoading,
    mutualFollowers,
    posts,
    loadingPosts,
    hasMorePosts,
    loadingMorePosts,
    handleToggleFollow,
    loadMorePosts,
  } = useComments(targetUserId, currentUser?.userId);

  const [notifOn, setNotifOn] = useState(false);

  const accentColor = profileUser ? accentFromId(profileUser.userId) : '#7C3AED';
  const isSelf = currentUser?.userId === targetUserId;
  const isPrivate = profileUser?.isPrivate ?? false;
  const canViewPosts = !isPrivate || isFollowing || isSelf;

  if (!loadingProfile && profileError) {
    return (
      <View style={styles.centerState}>
        <AlertCircle size={48} color={Colors.text.tertiary} />
        <Text style={styles.errorText}>{profileError}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.errorBack}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const nearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 400;
          if (nearBottom && hasMorePosts && !loadingMorePosts) void loadMorePosts();
        }}
        scrollEventThrottle={400}>
        <View style={styles.coverWrapper}>
          <LinearGradient
            colors={[accentColor + '55', '#0A1228', '#0F0F1A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cover}>
            <View style={[styles.coverOrb1, { backgroundColor: accentColor + '30' }]} />
            <View style={styles.coverOrb2} />
          </LinearGradient>

          <View style={styles.coverBar}>
            <TouchableOpacity style={styles.coverBtn} onPress={() => navigation.goBack()}>
              <ArrowLeft size={20} color={Colors.white} />
            </TouchableOpacity>
            <View style={styles.coverBtnRow}>
              {isFollowing && !isSelf && (
                <TouchableOpacity style={styles.coverBtn} onPress={() => setNotifOn(n => !n)}>
                  {notifOn ? (
                    <Bell size={18} color={Colors.accent} />
                  ) : (
                    <BellOff size={18} color={Colors.white} />
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {loadingProfile && <ProfileSkeleton />}

        {!loadingProfile && profileUser && (
          <View style={styles.profileSection}>
            <View style={styles.topRow}>
              <LinearGradient colors={[accentColor, accentColor + 'AA']} style={styles.avatarRing}>
                <UserAvatar
                  photoURL={profileUser.photoURL}
                  displayName={profileUser.displayName}
                  color={accentColor}
                  size={74}
                />
              </LinearGradient>

              {!isSelf && (
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={styles.followBtnWrapper}
                    onPress={handleToggleFollow}
                    disabled={followLoading}
                    activeOpacity={0.85}>
                    {followLoading ? (
                      <View style={styles.followingBtn}>
                        <ActivityIndicator size="small" color={Colors.accent} />
                      </View>
                    ) : isFollowing ? (
                      <View style={styles.followingBtn}>
                        <UserCheck size={15} color={Colors.accent} />
                        <Text style={styles.followingText}>Following</Text>
                      </View>
                    ) : (
                      <LinearGradient colors={['#7C3AED', '#9D6FFF']} style={styles.followBtn}>
                        <UserPlus size={15} color={Colors.white} />
                        <Text style={styles.followText}>Follow</Text>
                      </LinearGradient>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.dmBtn}
                    onPress={() =>
                      navigation.navigate('ChatMessages', {
                        targetUserId: profileUser.userId,
                      })
                    }>
                    <MessageCircle size={18} color={Colors.text.secondary} />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.nameBlock}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{profileUser.displayName}</Text>
                {profileUser.isVerified && (
                  <View style={styles.verifiedBadge}>
                    <Check size={10} color={Colors.white} strokeWidth={3} />
                  </View>
                )}
                {isPrivate && <Lock size={14} color={Colors.text.tertiary} />}
              </View>

              {profileUser.userTagId && <Text style={styles.tag}>@{profileUser.userTagId}</Text>}

              {!isSelf && followsYouBack && (
                <View style={styles.followsYouBadge}>
                  <Text style={styles.followsYouText}>Follows you</Text>
                </View>
              )}
            </View>

            {profileUser.bio ? <Text style={styles.bio}>{profileUser.bio}</Text> : null}

            {!isSelf && mutualFollowers.length > 0 && (
              <View style={styles.mutualRow}>
                <View style={styles.mutualAvatars}>
                  {mutualFollowers.slice(0, 2).map((m, i) => (
                    <View
                      key={m.userId}
                      style={[
                        styles.mutualAvatar,
                        {
                          marginLeft: i > 0 ? -8 : 0,
                          backgroundColor: i === 0 ? '#7C3AED22' : '#00B89C22',
                        },
                      ]}>
                      {m.photoURL ? (
                        <Image
                          source={{ uri: m.photoURL }}
                          style={{ width: 18, height: 18, borderRadius: 9 }}
                        />
                      ) : (
                        <Text
                          style={[
                            styles.mutualAvatarText,
                            { color: i === 0 ? '#7C3AED' : '#00B89C' },
                          ]}>
                          {m.displayName[0].toUpperCase()}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
                <Text style={styles.mutualText}>
                  Followed by{' '}
                  <Text style={styles.mutualNames}>{buildMutualLabel(mutualFollowers)}</Text>
                </Text>
              </View>
            )}

            {/* Location / website / join date */}
            <View style={styles.metaRow}>
              {profileUser.location && (
                <View style={styles.metaItem}>
                  <MapPin size={12} color={Colors.text.tertiary} />
                  <Text style={styles.metaText}>{profileUser.location}</Text>
                </View>
              )}
              {profileUser.website && (
                <View style={styles.metaItem}>
                  <Link2 size={12} color={Colors.accent} />
                  <Text style={[styles.metaText, { color: Colors.accent }]}>
                    {profileUser.website}
                  </Text>
                </View>
              )}
              <View style={styles.metaItem}>
                <Calendar size={12} color={Colors.text.tertiary} />
                <Text style={styles.metaText}>Joined {formatJoinDate(profileUser.createdAt)}</Text>
              </View>
            </View>

            <View style={styles.statsCard}>
              <LinearGradient
                colors={[accentColor + '10', accentColor + '06']}
                style={styles.statsGrad}>
                <StatPill value={profileUser.postsCount ?? 0} label="Posts" />
                <View style={styles.statDivider} />
                <StatPill value={profileUser.followersCount ?? 0} label="Followers" />
                <View style={styles.statDivider} />
                <StatPill value={profileUser.followingCount ?? 0} label="Following" />
                <View style={styles.statDivider} />
                <StatPill value={profileUser.likesCount ?? 0} label="Likes" />
              </LinearGradient>
            </View>
          </View>
        )}

        {!loadingProfile && profileUser && isPrivate && !canViewPosts && (
          <View style={styles.privateNotice}>
            <LinearGradient
              colors={['rgba(124,58,237,0.1)', 'rgba(124,58,237,0.05)']}
              style={styles.privateGrad}>
              <Lock size={32} color={Colors.text.tertiary} />
              <Text style={styles.privateTitle}>This account is private</Text>
              <Text style={styles.privateDesc}>Follow to see their posts and content</Text>
            </LinearGradient>
          </View>
        )}

        {!loadingProfile && canViewPosts && (
          <>
            <View style={styles.postsHeader}>
              <Grid3X3 size={16} color={Colors.text.secondary} />
              <Text style={styles.postsHeaderText}>Posts</Text>
            </View>

            {loadingPosts ? (
              <View style={styles.centered}>
                <ActivityIndicator color={Colors.accent} />
              </View>
            ) : posts.length === 0 ? (
              <View style={styles.centered}>
                <Text style={styles.emptyText}>No posts yet</Text>
              </View>
            ) : (
              <View style={styles.grid}>
                {posts.map(post => (
                  <GridPost key={post.postId} post={post} navigation={navigation} />
                ))}
              </View>
            )}

            {loadingMorePosts && (
              <View style={styles.centered}>
                <ActivityIndicator size="small" color={Colors.accent} />
              </View>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg.primary },

  centerState: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: Spacing.xl,
  },
  errorText: { fontSize: 16, color: Colors.text.secondary, textAlign: 'center' },
  errorBack: { fontSize: 15, color: Colors.accent, fontWeight: '600', marginTop: 4 },

  coverWrapper: { height: 170, position: 'relative' },
  cover: { flex: 1, overflow: 'hidden' },
  coverOrb1: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  coverOrb2: {
    position: 'absolute',
    bottom: -20,
    left: 40,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(124,58,237,0.15)',
  },
  coverBar: {
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
  coverBtnRow: { flexDirection: 'row', gap: Spacing.sm },

  // Profile section
  profileSection: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: -36,
    marginBottom: Spacing.md,
  },
  avatarRing: { width: 80, height: 80, borderRadius: 40, padding: 3, ...Shadow.accent },
  actionButtons: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', paddingBottom: 4 },
  followBtnWrapper: { borderRadius: Radius.full, overflow: 'hidden', ...Shadow.brand },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    gap: 5,
  },
  followText: { fontSize: 14, fontWeight: '700', color: Colors.white },
  followingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    gap: 5,
    backgroundColor: 'rgba(0,229,195,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(0,229,195,0.3)',
    borderRadius: Radius.full,
    minWidth: 105,
  },
  followingText: { fontSize: 14, fontWeight: '700', color: Colors.accent },
  dmBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.bg.glass,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },

  nameBlock: { marginBottom: Spacing.sm },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  name: { fontSize: 24, fontWeight: '800', color: Colors.text.primary, letterSpacing: -0.8 },
  verifiedBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tag: { fontSize: 14, color: Colors.text.tertiary, fontWeight: '500' },
  followsYouBadge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: Colors.bg.tertiary,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  followsYouText: { fontSize: 11, fontWeight: '600', color: Colors.text.tertiary },

  bio: { fontSize: 14, color: Colors.text.secondary, lineHeight: 22, marginBottom: Spacing.md },

  mutualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  mutualAvatars: { flexDirection: 'row' },
  mutualAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.bg.primary,
  },
  mutualAvatarText: { fontSize: 9, fontWeight: '800' },
  mutualText: { fontSize: 12, color: Colors.text.tertiary, flex: 1, lineHeight: 17 },
  mutualNames: { fontWeight: '700', color: Colors.text.secondary },

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
  statDivider: { width: 1, backgroundColor: Colors.border.subtle, marginVertical: 8 },

  privateNotice: {
    marginHorizontal: Spacing.lg,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border.medium,
  },
  privateGrad: { padding: Spacing.xxl, alignItems: 'center', gap: Spacing.md },
  privateTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text.primary,
    letterSpacing: -0.3,
  },
  privateDesc: { fontSize: 14, color: Colors.text.tertiary, textAlign: 'center' },

  postsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border.subtle,
    marginBottom: Spacing.md,
  },
  postsHeaderText: { fontSize: 14, fontWeight: '700', color: Colors.text.primary, flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  centered: { padding: Spacing.xl, alignItems: 'center' },
  emptyText: { fontSize: 14, color: Colors.text.tertiary },
});
