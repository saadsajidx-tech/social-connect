/**
 * NotificationSettings.tsx
 *
 * Persists preferences to:
 *  - Firestore users/{userId}.preferences.notifications
 *  - Local user context (AsyncStorage via your existing setUser)
 *
 * Reads initial state from the authenticated user context.
 */

import React, { useState, useCallback, useRef } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { HomeStackParamList } from '../../../navigation/HomeNavigator';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Switch,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {
  ArrowLeft,
  Bell,
  BellOff,
  Heart,
  MessageCircle,
  Volume2,
  VolumeX,
  Vibrate,
  Moon,
  Info,
  Check,
} from 'lucide-react-native';
import { getFirestore, doc, updateDoc } from '@react-native-firebase/firestore';
import { Colors, Spacing, Radius, Shadow } from '../../../utilities/theme';
import { TransparentStatusBar } from '../../../component/common/TransparentStatusBar';
import { useUser } from '../../../Hooks/useUser';
import {
  DEFAULT_NOTIFICATION_PREFS,
  INotificationPreferences,
} from '../../../interfaces/INotification';

const db = getFirestore();
const { width } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<HomeStackParamList, 'NotificationSettings'>;

// ─── Sub-components ──────────────────────────────────────────────

const SectionHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <View style={sectionStyles.header}>
    <Text style={sectionStyles.title}>{title}</Text>
    {subtitle && <Text style={sectionStyles.subtitle}>{subtitle}</Text>}
  </View>
);

const sectionStyles = StyleSheet.create({
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.sm },
  title: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: Colors.text.tertiary },
  subtitle: { fontSize: 12, color: Colors.text.tertiary, marginTop: 3, lineHeight: 18 },
});

interface NotifRowProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  desc?: string;
  toggleValue: boolean;
  onToggle: (v: boolean) => void;
  disabled?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
}

const NotifRow = ({
  icon,
  iconBg,
  label,
  desc,
  toggleValue,
  onToggle,
  disabled,
  isFirst,
  isLast,
}: NotifRowProps) => (
  <View
    style={[
      notifRowStyles.row,
      isFirst && notifRowStyles.rowFirst,
      isLast && notifRowStyles.rowLast,
      !isLast && notifRowStyles.rowBorder,
      disabled && notifRowStyles.rowDisabled,
    ]}>
    <View
      style={[
        notifRowStyles.iconWrapper,
        { backgroundColor: disabled ? Colors.bg.tertiary : iconBg },
      ]}>
      {icon}
    </View>
    <View style={notifRowStyles.textBlock}>
      <Text style={[notifRowStyles.label, disabled && notifRowStyles.labelDisabled]}>{label}</Text>
      {desc && <Text style={notifRowStyles.desc}>{desc}</Text>}
    </View>
    <Switch
      value={!disabled ? toggleValue : false}
      onValueChange={disabled ? undefined : onToggle}
      trackColor={{ false: Colors.border.medium, true: Colors.primaryLight }}
      thumbColor={!disabled && toggleValue ? Colors.white : Colors.text.tertiary}
      ios_backgroundColor={Colors.border.medium}
      disabled={disabled}
    />
  </View>
);

const notifRowStyles = StyleSheet.create({
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
  rowDisabled: { opacity: 0.45 },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  textBlock: { flex: 1 },
  label: { fontSize: 15, fontWeight: '600', color: Colors.text.primary, letterSpacing: -0.2 },
  labelDisabled: { color: Colors.text.tertiary },
  desc: { fontSize: 12, color: Colors.text.tertiary, marginTop: 2, lineHeight: 17 },
});

// ─── Sound Selector ───────────────────────────────────────────────

const SOUND_OPTIONS = ['default', 'chime', 'ping', 'pulse', 'none'];
const SOUND_LABELS: Record<string, string> = {
  default: 'Default',
  chime: 'Chime',
  ping: 'Ping',
  pulse: 'Pulse',
  none: 'None',
};

const SoundSelector = ({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) => (
  <View style={[soundStyles.wrapper, disabled && { opacity: 0.4 }]}>
    {SOUND_OPTIONS.map(opt => (
      <TouchableOpacity
        key={opt}
        style={[soundStyles.option, value === opt && soundStyles.optionActive]}
        onPress={() => !disabled && onChange(opt)}
        activeOpacity={0.75}>
        {value === opt ? (
          <LinearGradient colors={['#7C3AED', '#9D6FFF']} style={soundStyles.optionGrad}>
            <Text style={soundStyles.optionTextActive}>{SOUND_LABELS[opt]}</Text>
          </LinearGradient>
        ) : (
          <Text style={soundStyles.optionText}>{SOUND_LABELS[opt]}</Text>
        )}
      </TouchableOpacity>
    ))}
  </View>
);

const soundStyles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  option: {
    borderRadius: Radius.full,
    backgroundColor: Colors.bg.glass,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    overflow: 'hidden',
  },
  optionActive: { borderColor: Colors.primaryLight, ...Shadow.brand },
  optionGrad: { paddingHorizontal: Spacing.md, paddingVertical: 8 },
  optionText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.tertiary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  optionTextActive: { fontSize: 13, fontWeight: '700', color: Colors.white },
});

// ─── Quiet Hours ──────────────────────────────────────────────────

const TIME_SLOTS = ['19:00', '20:00', '21:00', '22:00', '23:00'];
const WAKE_SLOTS = ['05:00', '06:00', '07:00', '08:00', '09:00'];

const QuietHoursCard = ({
  enabled,
  start,
  end,
  onStartChange,
  onEndChange,
}: {
  enabled: boolean;
  start: string;
  end: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
}) => {
  if (!enabled) return null;

  return (
    <View style={quietStyles.card}>
      <LinearGradient
        colors={['rgba(124,58,237,0.08)', 'rgba(99,102,241,0.04)']}
        style={quietStyles.cardGrad}>
        <View style={quietStyles.timeBlock}>
          <Text style={quietStyles.timeLabel}>SILENCE FROM</Text>
          <View style={quietStyles.timeOptions}>
            {TIME_SLOTS.map(t => (
              <TouchableOpacity
                key={t}
                style={[quietStyles.timePill, start === t && quietStyles.timePillActive]}
                onPress={() => onStartChange(t)}>
                <Text
                  style={[quietStyles.timePillText, start === t && quietStyles.timePillTextActive]}>
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={quietStyles.divider} />
        <View style={quietStyles.timeBlock}>
          <Text style={quietStyles.timeLabel}>WAKE AT</Text>
          <View style={quietStyles.timeOptions}>
            {WAKE_SLOTS.map(t => (
              <TouchableOpacity
                key={t}
                style={[quietStyles.timePill, end === t && quietStyles.timePillActive]}
                onPress={() => onEndChange(t)}>
                <Text
                  style={[quietStyles.timePillText, end === t && quietStyles.timePillTextActive]}>
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={quietStyles.summary}>
          <Moon size={14} color={Colors.primaryLight} />
          <Text style={quietStyles.summaryText}>
            No notifications from <Text style={quietStyles.summaryHighlight}>{start}</Text> to{' '}
            <Text style={quietStyles.summaryHighlight}>{end}</Text>
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
};

const quietStyles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.lg,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.2)',
    ...Shadow.soft,
  },
  cardGrad: { padding: Spacing.md },
  timeBlock: { gap: Spacing.sm },
  timeLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.8, color: Colors.text.tertiary },
  timeOptions: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  timePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.bg.glass,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  timePillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  timePillText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.tertiary,
    fontVariant: ['tabular-nums'],
  },
  timePillTextActive: { color: Colors.white, fontWeight: '700' },
  divider: { height: 1, backgroundColor: Colors.border.subtle, marginVertical: Spacing.md },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(124,58,237,0.1)',
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.2)',
  },
  summaryText: { fontSize: 12, color: Colors.text.tertiary, flex: 1, lineHeight: 18 },
  summaryHighlight: {
    color: Colors.primaryLight,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});

// ─── Main Screen ──────────────────────────────────────────────────

export default function NotificationSettings({ navigation }: Props) {
  const { user, setUser } = useUser();

  // Initialize from user context — fall back to defaults
  const savedPrefs = user?.preferences?.notifications;
  const [prefs, setPrefs] = useState<INotificationPreferences>({
    enabled: savedPrefs?.enabled ?? DEFAULT_NOTIFICATION_PREFS.enabled,
    likes: savedPrefs?.likes ?? DEFAULT_NOTIFICATION_PREFS.likes,
    comments: savedPrefs?.comments ?? DEFAULT_NOTIFICATION_PREFS.comments,
    sound: savedPrefs?.sound ?? DEFAULT_NOTIFICATION_PREFS.sound,
    vibration: savedPrefs?.vibration ?? DEFAULT_NOTIFICATION_PREFS.vibration,
    quietHours: {
      enabled: savedPrefs?.quietHours?.enabled ?? DEFAULT_NOTIFICATION_PREFS.quietHours.enabled,
      start: savedPrefs?.quietHours?.start ?? DEFAULT_NOTIFICATION_PREFS.quietHours.start,
      end: savedPrefs?.quietHours?.end ?? DEFAULT_NOTIFICATION_PREFS.quietHours.end,
    },
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef<number | null>(null);
  // ── Debounced save to Firestore ────────────────────────────────

  const persistPrefs = useCallback(
    async (newPrefs: INotificationPreferences) => {
      if (!user?.userId) return;

      setSaving(true);
      setSaved(false);

      try {
        await updateDoc(doc(db, 'Users', user.userId), {
          'preferences.notifications': {
            enabled: newPrefs.enabled,
            likes: newPrefs.likes,
            comments: newPrefs.comments,
            sound: newPrefs.sound,
            vibration: newPrefs.vibration,
            quietHours: newPrefs.quietHours,
          },
        });

        // Update local context so rest of app sees changes immediately
        setUser({
          ...user,
          preferences: {
            ...user.preferences,
            notifications: {
              ...user.preferences?.notifications,
              ...newPrefs,
            } as any,
          },
        });

        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (e) {
        console.error('[NotificationSettings] persistPrefs error:', e); // ADD THIS
      } finally {
        setSaving(false);
      }
    },
    [user, setUser],
  );

  const update = useCallback(
    (patch: Partial<INotificationPreferences>) => {
      const newPrefs = { ...prefs, ...patch };
      setPrefs(newPrefs);

      // Debounce saves — wait 800ms after last change
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => persistPrefs(newPrefs), 800);
    },
    [prefs, persistPrefs],
  );

  const updateQuietHours = useCallback(
    (patch: Partial<INotificationPreferences['quietHours']>) => {
      const newPrefs = { ...prefs, quietHours: { ...prefs.quietHours, ...patch } };
      setPrefs(newPrefs);

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => persistPrefs(newPrefs), 800);
    },
    [prefs, persistPrefs],
  );

  const allOff = !prefs.enabled;

  return (
    <View style={styles.root}>
      <TransparentStatusBar />
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack()}>
          <ArrowLeft size={20} color={Colors.text.secondary} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View
            style={[
              styles.headerStatus,
              prefs.enabled ? styles.headerStatusOn : styles.headerStatusOff,
            ]}>
            <View style={[styles.headerStatusDot, prefs.enabled ? styles.dotOn : styles.dotOff]} />
            <Text
              style={[
                styles.headerStatusText,
                prefs.enabled ? styles.statusTextOn : styles.statusTextOff,
              ]}>
              {prefs.enabled ? 'ON' : 'OFF'}
            </Text>
          </View>
        </View>

        {/* Save indicator */}
        <View style={styles.saveIndicator}>
          {saving && <ActivityIndicator size="small" color={Colors.primaryLight} />}
          {saved && !saving && <Check size={18} color={Colors.accent} />}
        </View>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Master Toggle */}
        <View style={styles.masterCard}>
          <LinearGradient
            colors={
              prefs.enabled
                ? ['rgba(124,58,237,0.16)', 'rgba(0,229,195,0.08)']
                : ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.masterCardGrad}>
            <View style={styles.masterLeft}>
              <View
                style={[
                  styles.masterIconWrapper,
                  prefs.enabled ? styles.masterIconOn : styles.masterIconOff,
                ]}>
                {prefs.enabled ? (
                  <Bell size={24} color={Colors.primaryLight} />
                ) : (
                  <BellOff size={24} color={Colors.text.tertiary} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.masterLabel}>All Notifications</Text>
                <Text style={styles.masterDesc}>
                  {prefs.enabled
                    ? 'You will receive all enabled alerts'
                    : 'All notifications are silenced'}
                </Text>
              </View>
            </View>
            <Switch
              value={prefs.enabled}
              onValueChange={v => update({ enabled: v })}
              trackColor={{ false: Colors.border.medium, true: Colors.primaryLight }}
              thumbColor={prefs.enabled ? Colors.white : Colors.text.tertiary}
              ios_backgroundColor={Colors.border.medium}
            />
          </LinearGradient>
        </View>

        {/* Activity */}
        <SectionHeader title="ACTIVITY" subtitle="Control what activity triggers notifications" />
        <View style={styles.group}>
          <NotifRow
            icon={<Heart size={18} color={Colors.error} fill={Colors.error} />}
            iconBg="rgba(239,68,68,0.15)"
            label="Likes"
            desc="Post likes and comment likes"
            toggleValue={prefs.likes}
            onToggle={v => update({ likes: v })}
            disabled={allOff}
            isFirst
          />
          <NotifRow
            icon={<MessageCircle size={18} color="#7C3AED" />}
            iconBg="rgba(124,58,237,0.15)"
            label="Comments & Replies"
            desc="New comments on your posts and replies to your comments"
            toggleValue={prefs.comments}
            onToggle={v => update({ comments: v })}
            disabled={allOff}
            isLast
          />
        </View>

        {/* Sound & Haptics */}
        <SectionHeader title="SOUND & HAPTICS" />
        <View style={styles.group}>
          <NotifRow
            icon={
              prefs.sound !== 'none' ? (
                <Volume2 size={18} color="#8B5CF6" />
              ) : (
                <VolumeX size={18} color="#8B5CF6" />
              )
            }
            iconBg="rgba(139,92,246,0.15)"
            label="Sound"
            desc="Notification alert sound"
            toggleValue={prefs.sound !== 'none'}
            onToggle={v => update({ sound: v ? 'default' : 'none' })}
            disabled={allOff}
            isFirst
          />
          <NotifRow
            icon={<Vibrate size={18} color="#EC4899" />}
            iconBg="rgba(236,72,153,0.15)"
            label="Vibration"
            desc="Vibrate for incoming notifications"
            toggleValue={prefs.vibration}
            onToggle={v => update({ vibration: v })}
            disabled={allOff}
            isLast
          />
        </View>

        {/* Sound picker */}
        {prefs.sound !== 'none' && !allOff && (
          <>
            <SectionHeader title="NOTIFICATION SOUND" />
            <SoundSelector
              value={prefs.sound}
              onChange={v => update({ sound: v })}
              disabled={allOff}
            />
          </>
        )}

        {/* Quiet Hours */}
        <SectionHeader title="QUIET HOURS" subtitle="Silence notifications while you rest" />
        <View style={styles.group}>
          <NotifRow
            icon={<Moon size={18} color="#6366F1" />}
            iconBg="rgba(99,102,241,0.15)"
            label="Quiet Hours"
            desc="Pause all notifications during set hours"
            toggleValue={prefs.quietHours.enabled}
            onToggle={v => updateQuietHours({ enabled: v })}
            disabled={allOff}
            isFirst
            isLast
          />
        </View>

        <QuietHoursCard
          enabled={prefs.quietHours.enabled && !allOff}
          start={prefs.quietHours.start}
          end={prefs.quietHours.end}
          onStartChange={v => updateQuietHours({ start: v })}
          onEndChange={v => updateQuietHours({ end: v })}
        />

        {/* Info */}
        <View style={styles.infoBanner}>
          <Info size={16} color={Colors.info} />
          <Text style={styles.infoText}>
            Changes are saved automatically. Quiet hours check happens when a notification is
            triggered.
          </Text>
        </View>

        <View style={{ height: 40 }} />
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
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(124,58,237,0.10)',
  },
  orb2: {
    position: 'absolute',
    top: 600,
    left: -80,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(0,229,195,0.06)',
  },
  header: {
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
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.text.primary, letterSpacing: -0.5 },
  headerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  headerStatusOn: { backgroundColor: 'rgba(0,229,195,0.12)', borderColor: 'rgba(0,229,195,0.3)' },
  headerStatusOff: { backgroundColor: 'rgba(239,68,68,0.10)', borderColor: 'rgba(239,68,68,0.2)' },
  headerStatusDot: { width: 6, height: 6, borderRadius: 3 },
  dotOn: { backgroundColor: Colors.accent },
  dotOff: { backgroundColor: Colors.error },
  headerStatusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  statusTextOn: { color: Colors.accent },
  statusTextOff: { color: Colors.error },
  saveIndicator: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingBottom: 20 },
  masterCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: Colors.border.brand,
    ...Shadow.brand,
  },
  masterCardGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  masterLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  masterIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  masterIconOn: { backgroundColor: 'rgba(124,58,237,0.2)' },
  masterIconOff: { backgroundColor: Colors.bg.tertiary },
  masterLabel: { fontSize: 17, fontWeight: '800', color: Colors.text.primary, letterSpacing: -0.4 },
  masterDesc: { fontSize: 12, color: Colors.text.tertiary, marginTop: 3 },
  group: {
    marginHorizontal: Spacing.lg,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    ...Shadow.soft,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)',
  },
  infoText: { flex: 1, fontSize: 12, color: Colors.info, lineHeight: 18, fontWeight: '500' },
});
