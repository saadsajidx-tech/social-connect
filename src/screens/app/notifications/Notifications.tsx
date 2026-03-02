import React, { useState } from 'react';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabParamList } from '../../../navigation/BottomTabs';
import { HomeStackParamList } from '../../../navigation/HomeNavigator';

import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {
  ArrowLeft,
  Bell,
  Heart,
  MessageCircle,
  UserPlus,
  AtSign,
  MessageSquare,
  Settings,
  Check,
  X,
  Zap,
} from 'lucide-react-native';
import { Colors, Spacing, Radius, Shadow } from '../../../utilities/theme';
import { TransparentStatusBar } from '../../../component/common/TransparentStatusBar';

type NotifType = 'like' | 'comment' | 'follow' | 'mention' | 'reply' | 'system';

interface Notification {
  id: string;
  type: NotifType;
  user: { name: string; avatar: string; color: string; verified: boolean };
  content: string;
  preview?: string;
  time: string;
  isRead: boolean;
  postThumb?: string;
}

const NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    type: 'like',
    user: { name: 'Marcus Webb', avatar: 'M', color: '#00B89C', verified: false },
    content: 'liked your post',
    preview: 'Just shipped a massive feature...',
    time: '2m ago',
    isRead: false,
    postThumb: '🚀',
  },
  {
    id: '2',
    type: 'comment',
    user: { name: 'Priya Patel', avatar: 'P', color: '#EC4899', verified: true },
    content: 'commented on your post',
    preview: '"The Firebase integration looks clean. Would love to see..."',
    time: '8m ago',
    isRead: false,
    postThumb: '🚀',
  },
  {
    id: '3',
    type: 'follow',
    user: { name: 'Jordan Kim', avatar: 'J', color: '#F59E0B', verified: false },
    content: 'started following you',
    time: '25m ago',
    isRead: false,
  },
  {
    id: '4',
    type: 'mention',
    user: { name: 'Sam Rivers', avatar: 'S', color: '#3B82F6', verified: false },
    content: 'mentioned you in a post',
    preview: '"...working with @alexc on this next-gen platform..."',
    time: '1h ago',
    isRead: true,
    postThumb: '💻',
  },
  {
    id: '5',
    type: 'like',
    user: { name: 'Casey Morgan', avatar: 'C', color: '#EC4899', verified: true },
    content: 'and 14 others liked your post',
    preview: 'Hot take: The best code...',
    time: '2h ago',
    isRead: true,
    postThumb: '⚡',
  },
  {
    id: '6',
    type: 'reply',
    user: { name: 'Alex Russo', avatar: 'AR', color: '#8B5CF6', verified: false },
    content: 'replied to your comment',
    preview: '"Totally agree! The performance gains are incredible..."',
    time: '3h ago',
    isRead: true,
  },
  {
    id: '7',
    type: 'system',
    user: { name: 'SocialConnect', avatar: '⚡', color: '#7C3AED', verified: true },
    content: 'Your post reached 1,000 impressions! 🎉',
    preview: 'Just shipped a massive feature...',
    time: '5h ago',
    isRead: true,
    postThumb: '🚀',
  },
  {
    id: '8',
    type: 'follow',
    user: { name: 'Riley Tang', avatar: 'R', color: '#10B981', verified: false },
    content: 'started following you',
    time: 'Yesterday',
    isRead: true,
  },
];

const TYPE_CONFIG: Record<NotifType, { Icon: any; color: string; bgColor: string; label: string }> =
  {
    like: { Icon: Heart, color: Colors.error, bgColor: 'rgba(239,68,68,0.15)', label: 'Like' },
    comment: {
      Icon: MessageCircle,
      color: Colors.primaryLight,
      bgColor: 'rgba(124,58,237,0.15)',
      label: 'Comment',
    },
    follow: {
      Icon: UserPlus,
      color: Colors.accent,
      bgColor: 'rgba(0,229,195,0.15)',
      label: 'Follow',
    },
    mention: {
      Icon: AtSign,
      color: Colors.warning,
      bgColor: 'rgba(245,158,11,0.15)',
      label: 'Mention',
    },
    reply: {
      Icon: MessageSquare,
      color: Colors.info,
      bgColor: 'rgba(59,130,246,0.15)',
      label: 'Reply',
    },
    system: { Icon: Zap, color: Colors.primary, bgColor: 'rgba(124,58,237,0.15)', label: 'System' },
  };

const NotifCard = ({ notif, onPress }: { notif: Notification; onPress?: () => void }) => {
  const config = TYPE_CONFIG[notif.type];

  return (
    <TouchableOpacity
      style={[styles.notifCard, !notif.isRead && styles.notifCardUnread]}
      onPress={onPress}
      activeOpacity={0.8}>
      {/* Unread indicator */}
      {!notif.isRead && <View style={styles.unreadDot} />}

      {/* Avatar + Type Icon */}
      <View style={styles.notifAvatarWrapper}>
        <View style={[styles.notifAvatar, { backgroundColor: notif.user.color + '22' }]}>
          {notif.type === 'system' ? (
            <Text style={{ fontSize: 18 }}>{notif.user.avatar}</Text>
          ) : (
            <Text style={[styles.notifAvatarText, { color: notif.user.color }]}>
              {notif.user.avatar}
            </Text>
          )}
        </View>
        <View style={[styles.notifTypeIcon, { backgroundColor: config.bgColor }]}>
          <config.Icon
            size={10}
            color={config.color}
            fill={notif.type === 'like' ? config.color : 'none'}
          />
        </View>
      </View>

      {/* Content */}
      <View style={styles.notifContent}>
        <Text style={styles.notifText} numberOfLines={2}>
          <Text style={styles.notifUsername}>{notif.user.name} </Text>
          <Text style={styles.notifAction}>{notif.content}</Text>
        </Text>
        {notif.preview && (
          <Text style={styles.notifPreview} numberOfLines={1}>
            {notif.preview}
          </Text>
        )}
        <Text style={styles.notifTime}>{notif.time}</Text>
      </View>

      {/* Post Thumbnail or Follow Button */}
      {notif.postThumb ? (
        <View style={styles.postThumb}>
          <LinearGradient colors={['#1A1A2E', '#0A0A1A']} style={styles.postThumbGrad}>
            <Text style={styles.postThumbEmoji}>{notif.postThumb}</Text>
          </LinearGradient>
        </View>
      ) : notif.type === 'follow' ? (
        <TouchableOpacity style={styles.followBackBtn}>
          <Text style={styles.followBackText}>Follow</Text>
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
};

const FILTER_TABS = ['All', 'Likes', 'Comments', 'Follows', 'Mentions'];

type Props = NativeStackScreenProps<HomeStackParamList, 'Notifications'>;
export default function Notifications({ navigation }: Props) {
  const [activeFilter, setActiveFilter] = useState('All');
  const unreadCount = NOTIFICATIONS.filter(n => !n.isRead).length;

  const filtered =
    activeFilter === 'All'
      ? NOTIFICATIONS
      : NOTIFICATIONS.filter(n => {
          if (activeFilter === 'Likes') return n.type === 'like';
          if (activeFilter === 'Comments') return n.type === 'comment' || n.type === 'reply';
          if (activeFilter === 'Follows') return n.type === 'follow';
          if (activeFilter === 'Mentions') return n.type === 'mention';
          return true;
        });

  const todayNotifs = filtered.filter(
    n => !n.time.includes('Yesterday') && !n.time.includes('day'),
  );
  const olderNotifs = filtered.filter(n => n.time.includes('Yesterday') || n.time.includes('day'));

  return (
    <View style={styles.root}>
      <TransparentStatusBar />

      {/* Orbs */}
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack()}>
          <ArrowLeft size={20} color={Colors.text.secondary} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconBtn}>
            <Check size={16} color={Colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation?.navigate('NotificationSettings')}>
            <Settings size={18} color={Colors.text.secondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScrollView}
        contentContainerStyle={styles.filterContent}>
        {FILTER_TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveFilter(tab)}
            style={styles.filterTabWrapper}
            activeOpacity={0.8}>
            {activeFilter === tab ? (
              <LinearGradient colors={['#7C3AED', '#9D6FFF']} style={styles.filterTabActive}>
                <Text style={styles.filterTabTextActive}>{tab}</Text>
                {tab !== 'All' && (
                  <View style={styles.filterCount}>
                    <Text style={styles.filterCountText}>
                      {
                        NOTIFICATIONS.filter(n => {
                          if (tab === 'Likes') return n.type === 'like';
                          if (tab === 'Comments') return n.type === 'comment' || n.type === 'reply';
                          if (tab === 'Follows') return n.type === 'follow';
                          if (tab === 'Mentions') return n.type === 'mention';
                          return false;
                        }).filter(n => !n.isRead).length
                      }
                    </Text>
                  </View>
                )}
              </LinearGradient>
            ) : (
              <View style={styles.filterTab}>
                <Text style={styles.filterTabText}>{tab}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Today Section */}
        {todayNotifs.length > 0 && (
          <View>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionDot} />
              <Text style={styles.sectionTitle}>TODAY</Text>
            </View>
            {todayNotifs.map(n => (
              <NotifCard
                key={n.id}
                notif={n}
                onPress={() => {
                  if (n.type !== 'follow') navigation?.navigate('PostDetail', { postId: '1' });
                  else navigation?.navigate('ViewUserProfile', { userId: n.user.name });
                }}
              />
            ))}
          </View>
        )}

        {/* Earlier Section */}
        {olderNotifs.length > 0 && (
          <View>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: Colors.text.tertiary }]} />
              <Text style={[styles.sectionTitle, { color: Colors.text.tertiary }]}>EARLIER</Text>
            </View>
            {olderNotifs.map(n => (
              <NotifCard key={n.id} notif={n} />
            ))}
          </View>
        )}

        {/* Empty State */}
        {filtered.length === 0 && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrapper}>
              <LinearGradient colors={['#1A1A2E', '#12121E']} style={styles.emptyIconGrad}>
                <Bell size={32} color={Colors.text.tertiary} />
              </LinearGradient>
            </View>
            <Text style={styles.emptyTitle}>No notifications</Text>
            <Text style={styles.emptyDesc}>
              You're all caught up! Check back later for new activity.
            </Text>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
    overflow: 'hidden',
  },
  flex: { flex: 1 },

  orb1: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(124,58,237,0.12)',
  },
  orb2: {
    position: 'absolute',
    top: 300,
    left: -80,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(0,229,195,0.07)',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: 56,
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
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text.primary,
    letterSpacing: -0.4,
  },
  unreadBadge: {
    backgroundColor: Colors.error,
    borderRadius: Radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
  },
  unreadBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.white,
  },
  headerRight: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.bg.glass,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Filter
  filterScrollView: {
    maxHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  filterContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  filterTabWrapper: {},
  filterTabActive: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: Radius.full,
    gap: 5,
    ...Shadow.brand,
  },
  filterTab: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.bg.glass,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.tertiary,
  },
  filterTabTextActive: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
  },
  filterCount: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 16,
    alignItems: 'center',
  },
  filterCountText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.white,
  },

  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },

  // Section
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  sectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.8,
    color: Colors.accent,
  },

  // Notif Card
  notifCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.xl,
    marginBottom: Spacing.sm,
    position: 'relative',
    backgroundColor: Colors.bg.glass,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  notifCardUnread: {
    backgroundColor: 'rgba(124,58,237,0.05)',
    borderColor: 'rgba(124,58,237,0.15)',
  },
  unreadDot: {
    position: 'absolute',
    top: Spacing.md,
    left: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },

  // Avatar
  notifAvatarWrapper: {
    position: 'relative',
    marginRight: Spacing.md,
  },
  notifAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifAvatarText: {
    fontSize: 18,
    fontWeight: '800',
  },
  notifTypeIcon: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.bg.primary,
  },

  // Content
  notifContent: {
    flex: 1,
    gap: 2,
  },
  notifText: {
    fontSize: 14,
    lineHeight: 20,
  },
  notifUsername: {
    fontWeight: '700',
    color: Colors.text.primary,
  },
  notifAction: {
    color: Colors.text.secondary,
    fontWeight: '400',
  },
  notifPreview: {
    fontSize: 12,
    color: Colors.text.tertiary,
    fontStyle: 'italic',
  },
  notifTime: {
    fontSize: 11,
    color: Colors.text.tertiary,
    fontWeight: '500',
    marginTop: 2,
  },

  // Post Thumb
  postThumb: {
    marginLeft: Spacing.sm,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  postThumbGrad: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postThumbEmoji: {
    fontSize: 20,
  },

  // Follow Back
  followBackBtn: {
    marginLeft: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.bg.tertiary,
    borderWidth: 1,
    borderColor: Colors.border.medium,
  },
  followBackText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.secondary,
  },

  // Empty
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    gap: Spacing.md,
  },
  emptyIconWrapper: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...Shadow.soft,
  },
  emptyIconGrad: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text.primary,
    letterSpacing: -0.5,
  },
  emptyDesc: {
    fontSize: 14,
    color: Colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.xxl,
  },
});
