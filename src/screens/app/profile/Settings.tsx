import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
  Linking,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { HomeStackParamList } from '../../../navigation/HomeNavigator';
import LinearGradient from 'react-native-linear-gradient';
import {
  ArrowLeft,
  Bell,
  HelpCircle,
  LogOut,
  ChevronRight,
  Trash2,
  Star,
  MessageSquare,
  Zap,
  Check,
  Info,
  KeyRound,
  ShieldAlert,
  Edit3,
  Calendar,
} from 'lucide-react-native';
import { Colors, Spacing, Radius, Shadow } from '../../../utilities/theme';
import { useAuth } from '../../../Hooks/useAuth';
import { useUser } from '../../../Hooks/useUser';
import { TransparentStatusBar } from '../../../component/common/TransparentStatusBar';
import { getAuth, deleteUser } from '@react-native-firebase/auth';
import { getFirestore, doc, deleteDoc } from '@react-native-firebase/firestore';

const APP_VERSION = '1.0.0';
const APP_BUILD = '1';
const PLAY_STORE_ID = 'com.yourcompany.socialconnect';
const SUPPORT_EMAIL = 'support@socialconnect.app';
const FEEDBACK_EMAIL = 'feedback@socialconnect.app';

type Props = NativeStackScreenProps<HomeStackParamList, 'Settings'>;

const ProfileAvatar = ({
  photoURL,
  displayName,
  size = 72,
}: {
  photoURL?: string;
  displayName: string | undefined;
  size?: number;
}) => {
  const inner = size - 6;
  return (
    <LinearGradient
      colors={['#7C3AED', '#00E5C3']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size / 2, padding: 3, ...Shadow.brand }}>
      {photoURL ? (
        <Image
          source={{ uri: photoURL }}
          style={{
            width: inner,
            height: inner,
            borderRadius: inner / 2,
            borderWidth: 2,
            borderColor: '#08080F',
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
            borderWidth: 2,
            borderColor: '#08080F',
          }}>
          <Text style={{ fontSize: inner * 0.38, fontWeight: '800', color: Colors.primaryLight }}>
            {displayName?.charAt(0).toUpperCase() ?? '?'}
          </Text>
        </View>
      )}
    </LinearGradient>
  );
};

const SectionHeader = ({ title }: { title: string }) => (
  <View style={sectionStyles.header}>
    <Text style={sectionStyles.title}>{title}</Text>
  </View>
);

const sectionStyles = StyleSheet.create({
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.sm },
  title: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: Colors.text.tertiary },
});

interface SettingRowProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value?: string;
  badge?: string;
  badgeColor?: string;
  onPress?: () => void;
  destructive?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  loading?: boolean;
}

const SettingRow = ({
  icon,
  iconBg,
  label,
  value,
  badge,
  badgeColor,
  onPress,
  destructive,
  isFirst,
  isLast,
  loading,
}: SettingRowProps) => (
  <TouchableOpacity
    style={[
      rowStyles.row,
      isFirst && rowStyles.rowFirst,
      isLast && rowStyles.rowLast,
      !isLast && rowStyles.rowBorder,
    ]}
    onPress={onPress}
    activeOpacity={0.7}
    disabled={loading}>
    <View style={[rowStyles.iconWrapper, { backgroundColor: iconBg }]}>{icon}</View>
    <View style={rowStyles.labelBlock}>
      <Text style={[rowStyles.label, destructive && rowStyles.labelDestructive]}>{label}</Text>
      {value ? <Text style={rowStyles.value}>{value}</Text> : null}
    </View>
    <View style={rowStyles.rightBlock}>
      {badge ? (
        <View style={[rowStyles.badge, { backgroundColor: badgeColor || Colors.primary }]}>
          <Text style={rowStyles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      {loading ? (
        <ActivityIndicator size="small" color={Colors.text.tertiary} />
      ) : (
        <ChevronRight size={16} color={Colors.text.tertiary} />
      )}
    </View>
  </TouchableOpacity>
);

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    backgroundColor: Colors.bg.card,
  },
  rowFirst: { borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl },
  rowLast: { borderBottomLeftRadius: Radius.xl, borderBottomRightRadius: Radius.xl },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border.subtle },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  labelBlock: { flex: 1 },
  label: { fontSize: 15, fontWeight: '600', color: Colors.text.primary, letterSpacing: -0.2 },
  labelDestructive: { color: Colors.error },
  value: { fontSize: 12, color: Colors.text.tertiary, marginTop: 2, fontWeight: '400' },
  rightBlock: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.full },
  badgeText: { fontSize: 10, fontWeight: '800', color: Colors.white, letterSpacing: 0.3 },
});

export default function Settings({ navigation }: Props) {
  const { logOut } = useAuth();
  const { user } = useUser();
  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await logOut();
          } catch {
            Alert.alert('Error', 'Failed to sign out. Please try again.');
          }
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              'Are you absolutely sure?',
              'All your posts, followers, and profile data will be erased forever.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Delete Everything',
                  style: 'destructive',
                  onPress: performDeleteAccount,
                },
              ],
            ),
        },
      ],
    );
  };

  const performDeleteAccount = async () => {
    if (!user?.userId) return;
    setDeletingAccount(true);
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('No authenticated user');
      const db = getFirestore();
      await deleteDoc(doc(db, 'users', user.userId));
      await deleteUser(currentUser);
      await logOut();
    } catch (error: any) {
      setDeletingAccount(false);
      if (error?.code === 'auth/requires-recent-login') {
        Alert.alert(
          'Re-authentication Required',
          'For security, please sign out and sign in again before deleting your account.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Sign Out',
              onPress: async () => {
                try {
                  await logOut();
                } catch {}
              },
            },
          ],
        );
      } else {
        Alert.alert('Error', 'Failed to delete account. Please try again.');
      }
    }
  };

  const handleRateApp = async () => {
    const url = `https://play.google.com/store/apps/details?id=${PLAY_STORE_ID}`;
    if (await Linking.canOpenURL(url)) await Linking.openURL(url);
    else Alert.alert('Error', 'Unable to open the Play Store.');
  };

  const handleHelpSupport = async () => {
    const url = `mailto:${SUPPORT_EMAIL}?subject=Help%20%26%20Support%20-%20SocialConnect`;
    if (await Linking.canOpenURL(url)) await Linking.openURL(url);
    else Alert.alert('Help & Support', `Email us at:\n${SUPPORT_EMAIL}`);
  };

  const handleFeedback = async () => {
    const url = `mailto:${FEEDBACK_EMAIL}?subject=Feedback%20-%20SocialConnect%20v${APP_VERSION}`;
    if (await Linking.canOpenURL(url)) await Linking.openURL(url);
    else Alert.alert('Send Feedback', `Email us at:\n${FEEDBACK_EMAIL}`);
  };

  const handleAbout = () => {
    Alert.alert(
      'SocialConnect',
      `Version ${APP_VERSION} (build ${APP_BUILD})\n\nMade with ❤️\n\n© ${new Date().getFullYear()} SocialConnect. All rights reserved.`,
      [{ text: 'OK' }],
    );
  };

  const joinedDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  return (
    <View style={styles.root}>
      <TransparentStatusBar />
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      <View style={styles.navBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack()}>
          <ArrowLeft size={20} color={Colors.text.secondary} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.profileBlock}>
          <View style={styles.profileGlow} />

          <View style={styles.profileAvatarRing}>
            <ProfileAvatar photoURL={user?.photoURL} displayName={user?.displayName} size={80} />
          </View>

          <View style={styles.profileNameRow}>
            <Text style={styles.profileDisplayName} numberOfLines={1}>
              {user?.displayName ?? 'User'}
            </Text>
            {user?.isVerified && (
              <LinearGradient colors={['#7C3AED', '#00E5C3']} style={styles.verifiedBadge}>
                <Check size={8} color={Colors.white} strokeWidth={3} />
              </LinearGradient>
            )}
          </View>

          <Text style={styles.profileEmail} numberOfLines={1}>
            {user?.email ?? ''}
          </Text>

          {joinedDate && (
            <View style={styles.profileJoinedRow}>
              <Calendar size={11} color={Colors.text.tertiary} />
              <Text style={styles.profileJoinedText}>Joined {joinedDate}</Text>
            </View>
          )}

          <TouchableOpacity
            onPress={() => navigation?.navigate('EditProfile')}
            activeOpacity={0.8}
            style={styles.editPillTouchable}>
            <LinearGradient
              colors={['rgba(124,58,237,0.20)', 'rgba(0,229,195,0.12)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.editPill}>
              <Edit3 size={12} color={Colors.accent} />
              <Text style={styles.editPillText}>Edit Profile</Text>
            </LinearGradient>
          </TouchableOpacity>

          <LinearGradient
            colors={['transparent', 'rgba(124,58,237,0.4)', 'rgba(0,229,195,0.3)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.profileDivider}
          />
        </View>

        <SectionHeader title="ACCOUNT" />
        <View style={styles.group}>
          <SettingRow
            icon={<KeyRound size={18} color="#7C3AED" />}
            iconBg="rgba(124,58,237,0.15)"
            label="Change Password"
            value="Update your current password"
            onPress={() => navigation?.navigate('ChangePassword')}
            isFirst
            isLast
          />
        </View>

        <SectionHeader title="NOTIFICATIONS" />
        <View style={styles.group}>
          <SettingRow
            icon={<Bell size={18} color="#F59E0B" />}
            iconBg="rgba(245,158,11,0.15)"
            label="Notification Preferences"
            value="Likes, comments, follows & more"
            onPress={() => navigation?.navigate('NotificationSettings')}
            isFirst
            isLast
          />
        </View>

        <SectionHeader title="ABOUT & SUPPORT" />
        <View style={styles.group}>
          <SettingRow
            icon={<Star size={18} color="#F59E0B" />}
            iconBg="rgba(245,158,11,0.15)"
            label="Rate the App"
            value="Enjoying SocialConnect? Leave a review"
            onPress={handleRateApp}
            isFirst
          />
          <SettingRow
            icon={<HelpCircle size={18} color="#0EA5E9" />}
            iconBg="rgba(14,165,233,0.15)"
            label="Help & Support"
            value={SUPPORT_EMAIL}
            onPress={handleHelpSupport}
          />
          <SettingRow
            icon={<MessageSquare size={18} color="#EC4899" />}
            iconBg="rgba(236,72,153,0.15)"
            label="Send Feedback"
            value="Share ideas or report issues"
            onPress={handleFeedback}
          />
          <SettingRow
            icon={<Info size={18} color={Colors.text.tertiary} />}
            iconBg={Colors.bg.tertiary}
            label="About SocialConnect"
            value={`Version ${APP_VERSION} (build ${APP_BUILD})`}
            onPress={handleAbout}
            isLast
          />
        </View>

        <View style={styles.appInfoStrip}>
          <LinearGradient
            colors={['rgba(124,58,237,0.08)', 'rgba(0,229,195,0.04)']}
            style={styles.appInfoGrad}>
            <View style={styles.appInfoLeft}>
              <LinearGradient colors={['#7C3AED', '#00E5C3']} style={styles.appInfoLogo}>
                <Zap size={16} color={Colors.white} fill={Colors.white} />
              </LinearGradient>
              <View>
                <Text style={styles.appInfoName}>SocialConnect</Text>
                <Text style={styles.appInfoVersion}>v{APP_VERSION} · Beta</Text>
              </View>
            </View>
            <View style={styles.appInfoLinks}>
              <TouchableOpacity
                onPress={() => Linking.openURL('https://socialconnect.app/privacy')}>
                <Text style={styles.appInfoLink}>Privacy</Text>
              </TouchableOpacity>
              <Text style={styles.appInfoDot}>·</Text>
              <TouchableOpacity onPress={() => Linking.openURL('https://socialconnect.app/terms')}>
                <Text style={styles.appInfoLink}>Terms</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>

        <SectionHeader title="SESSION" />
        <View style={styles.group}>
          <SettingRow
            icon={<LogOut size={18} color={Colors.error} />}
            iconBg="rgba(239,68,68,0.15)"
            label="Sign Out"
            onPress={handleLogout}
            isFirst
            isLast
          />
        </View>

        <SectionHeader title="DANGER ZONE" />
        <View style={[styles.group, styles.dangerGroup]}>
          <SettingRow
            icon={
              deletingAccount ? (
                <ActivityIndicator size="small" color={Colors.error} />
              ) : (
                <Trash2 size={18} color={Colors.error} />
              )
            }
            iconBg="rgba(239,68,68,0.10)"
            label="Delete Account"
            value="Permanently remove all your data"
            destructive
            onPress={handleDeleteAccount}
            loading={deletingAccount}
            isFirst
            isLast
          />
        </View>

        <View style={styles.dangerNote}>
          <ShieldAlert size={13} color={Colors.error} style={{ opacity: 0.6 }} />
          <Text style={styles.dangerNoteText}>
            Account deletion is permanent and cannot be undone.
          </Text>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg.secondary, overflow: 'hidden' },
  flex: { flex: 1 },

  orb1: {
    position: 'absolute',
    top: -60,
    right: -70,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(124,58,237,0.10)',
  },
  orb2: {
    position: 'absolute',
    top: 500,
    left: -80,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(0,229,195,0.06)',
  },

  // ── Nav Bar
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.bg.secondary,
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
  navTitle: { fontSize: 18, fontWeight: '800', color: Colors.text.primary, letterSpacing: -0.5 },

  scrollContent: { paddingBottom: 20 },

  profileBlock: {
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  profileGlow: {
    position: 'absolute',
    top: 10,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(124,58,237,0.18)',
  },
  profileAvatarRing: {
    position: 'relative',
    marginBottom: Spacing.md,
  },

  editMicroGrad: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },

  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 5,
  },
  profileDisplayName: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text.primary,
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  verifiedBadge: {
    width: 17,
    height: 17,
    borderRadius: 8.5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  profileEmail: {
    fontSize: 14,
    color: Colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 4,
  },

  profileJoinedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.lg,
  },
  profileJoinedText: {
    fontSize: 12,
    color: Colors.text.tertiary,
    fontWeight: '500',
  },

  editPillTouchable: {
    marginBottom: Spacing.lg,
  },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: Radius.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,229,195,0.25)',
  },
  editPillText: { fontSize: 13, fontWeight: '700', color: Colors.accent },

  profileDivider: {
    height: 1,
    width: '80%',
    borderRadius: 1,
  },

  group: {
    marginHorizontal: Spacing.lg,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    ...Shadow.soft,
  },
  dangerGroup: { borderColor: 'rgba(239,68,68,0.15)' },

  appInfoStrip: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  appInfoGrad: { padding: Spacing.md, gap: Spacing.sm },
  appInfoLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  appInfoLogo: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appInfoName: { fontSize: 14, fontWeight: '800', color: Colors.text.primary, letterSpacing: -0.3 },
  appInfoVersion: { fontSize: 11, color: Colors.text.tertiary, fontWeight: '500' },
  appInfoLinks: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  appInfoLink: { fontSize: 12, fontWeight: '600', color: Colors.text.tertiary },
  appInfoDot: { fontSize: 12, color: Colors.border.medium },

  dangerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
  },
  dangerNoteText: { fontSize: 11, color: Colors.text.tertiary, flex: 1 },
});
