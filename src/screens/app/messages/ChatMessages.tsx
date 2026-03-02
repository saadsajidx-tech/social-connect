import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { HomeStackParamList } from '../../../navigation/HomeNavigator';
import { IMessage, IReplyTo } from '../../../interfaces/IChat';
import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Platform,
  KeyboardAvoidingView,
  Dimensions,
  ActivityIndicator,
  Image,
  Keyboard,
  Animated,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {
  ArrowLeft,
  MoreHorizontal,
  Send,
  Image as ImageIcon,
  Smile,
  Mic,
  Plus,
  Check,
  CheckCheck,
  X,
  Reply,
} from 'lucide-react-native';
import { Colors, Spacing, Radius, Shadow } from '../../../utilities/theme';
import { useUser } from '../../../Hooks/useUser';
import { useChat } from '../../../Hooks/useChat';
import { TransparentStatusBar } from '../../../component/common/TransparentStatusBar';

const { width } = Dimensions.get('window');
const BUBBLE_MAX = width * 0.72;

function computeLastSeen(isOnline: boolean, ts?: FirebaseFirestoreTypes.Timestamp | null): string {
  if (isOnline) return '● Online now';
  if (!ts) return 'Offline';

  const date = ts.toDate();
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'Last seen just now';
  if (diffMin < 60) return `Last seen ${diffMin}m ago`;
  if (diffHr < 24) return `Last seen ${diffHr}h ago`;
  if (diffDay === 1) {
    const hh = date.getHours().toString().padStart(2, '0');
    const mm = date.getMinutes().toString().padStart(2, '0');
    return `Last seen yesterday at ${hh}:${mm}`;
  }
  const dd = date.getDate().toString().padStart(2, '0');
  const mo = (date.getMonth() + 1).toString().padStart(2, '0');
  return `Last seen ${dd}/${mo}`;
}

function formatMessageTime(ts?: FirebaseFirestoreTypes.Timestamp | null): string {
  if (!ts) return '';
  const d = ts.toDate();
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function formatDateHeader(ts?: FirebaseFirestoreTypes.Timestamp | null): string {
  if (!ts) return '';
  const date = ts.toDate();
  const now = new Date();
  const diffDay = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diffDay === 0) return 'Today';
  if (diffDay === 1) return 'Yesterday';
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const SkeletonPulse = ({ style }: { style: any }) => {
  const anim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 850, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.3, duration: 850, useNativeDriver: true }),
      ]),
    ).start();
  }, [anim]);

  return (
    <Animated.View style={[style, { opacity: anim, backgroundColor: Colors.border.subtle }]} />
  );
};

const ChatSkeleton = ({ onBack }: { onBack: () => void }) => (
  <View style={skelS.root}>
    <View style={skelS.header}>
      <TouchableOpacity style={skelS.backBtn} onPress={onBack}>
        <ArrowLeft size={20} color={Colors.text.secondary} />
      </TouchableOpacity>
      <SkeletonPulse style={skelS.avatarCircle} />
      <View style={skelS.namePlaceholder}>
        <SkeletonPulse style={skelS.nameBar} />
        <SkeletonPulse style={skelS.statusBar} />
      </View>
    </View>

    <View style={skelS.body}>
      <View style={skelS.rowOther}>
        <SkeletonPulse style={skelS.bubbleSmall} />
      </View>
      <View style={skelS.rowOwn}>
        <SkeletonPulse style={skelS.bubbleMedium} />
      </View>
      <View style={skelS.rowOther}>
        <SkeletonPulse style={skelS.bubbleLarge} />
      </View>
      <View style={skelS.rowOwn}>
        <SkeletonPulse style={skelS.bubbleSmall} />
      </View>
      <View style={skelS.rowOther}>
        <SkeletonPulse style={skelS.bubbleMedium} />
      </View>
    </View>

    <View style={skelS.composer}>
      <SkeletonPulse style={skelS.composerBar} />
    </View>
  </View>
);

const skelS = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
    gap: Spacing.sm,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.bg.glass,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircle: { width: 42, height: 42, borderRadius: 21 },
  namePlaceholder: { flex: 1, gap: 7 },
  nameBar: { height: 14, borderRadius: 7, width: '55%' },
  statusBar: { height: 10, borderRadius: 5, width: '30%' },
  body: {
    flex: 1,
    padding: Spacing.md,
    gap: 12,
    justifyContent: 'flex-end',
  },
  rowOther: { alignItems: 'flex-start' },
  rowOwn: { alignItems: 'flex-end' },
  bubbleSmall: { height: 38, borderRadius: 18, width: width * 0.38 },
  bubbleMedium: { height: 56, borderRadius: 18, width: width * 0.55 },
  bubbleLarge: { height: 72, borderRadius: 18, width: width * 0.65 },
  composer: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? 28 : Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
  },
  composerBar: { height: 44, borderRadius: 22 },
});

const StatusIcon = ({ status }: { status?: IMessage['status'] }) => {
  if (!status || status === 'pending') return <Check size={13} color={Colors.text.tertiary} />;
  if (status === 'sent') return <Check size={13} color={Colors.text.tertiary} />;
  if (status === 'delivered') return <CheckCheck size={13} color={Colors.text.tertiary} />;
  return <CheckCheck size={13} color={Colors.accent} />;
};

const Avatar = ({
  photoURL,
  displayName,
  color = '#EC4899',
  size = 30,
}: {
  photoURL?: string;
  displayName: string;
  color?: string;
  size?: number;
}) => {
  const initial = displayName ? displayName.charAt(0).toUpperCase() : '?';
  return photoURL ? (
    <Image
      source={{ uri: photoURL }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
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
      }}>
      <Text style={{ color, fontSize: size * 0.4, fontWeight: '800' }}>{initial}</Text>
    </View>
  );
};

const ReplySnippet = ({ replyTo, isOwn }: { replyTo: IReplyTo; isOwn: boolean }) => (
  <View style={[bubS.replySnippet, isOwn && bubS.replySnippetOwn]}>
    <View style={[bubS.replyBar, isOwn && bubS.replyBarOwn]} />
    <View style={bubS.replyContent}>
      <Text style={[bubS.replyName, isOwn && bubS.replyNameOwn]}>{replyTo.senderName}</Text>
      <Text style={bubS.replyText} numberOfLines={1}>
        {replyTo.text}
      </Text>
    </View>
  </View>
);

const Bubble = React.memo(
  ({
    msg,
    isOwn,
    targetPhotoURL,
    targetDisplayName,
    showAvatar,
    onLongPress,
    onSetReply,
  }: {
    msg: IMessage;
    isOwn: boolean;
    targetPhotoURL?: string;
    targetDisplayName: string;
    showAvatar: boolean;
    onLongPress: (msg: IMessage) => void;
    onSetReply: (msg: IMessage) => void;
  }) => {
    const { text, type, status, reactions, replyTo, voiceDuration, createdAt } = msg;
    const timeStr = formatMessageTime(createdAt);

    if (type === 'system') {
      return (
        <View style={bubS.systemRow}>
          <Text style={bubS.systemText}>{text}</Text>
        </View>
      );
    }

    return (
      <View style={[bubS.row, isOwn ? bubS.rowOwn : bubS.rowOther]}>
        {!isOwn && (
          <View style={bubS.avatarWrapper}>
            {showAvatar ? (
              <Avatar
                photoURL={targetPhotoURL}
                displayName={targetDisplayName}
                color="#EC4899"
                size={30}
              />
            ) : (
              <View style={{ width: 30 }} />
            )}
          </View>
        )}

        <View style={[bubS.bubbleGroup, isOwn ? bubS.bubbleGroupOwn : bubS.bubbleGroupOther]}>
          {replyTo && <ReplySnippet replyTo={replyTo} isOwn={isOwn} />}

          <TouchableOpacity
            style={[
              bubS.bubble,
              isOwn ? bubS.bubbleOwn : bubS.bubbleOther,
              type === 'image' && bubS.bubbleImage,
            ]}
            onLongPress={() => onLongPress(msg)}
            onPress={() => onSetReply(msg)}
            activeOpacity={0.85}>
            {type === 'image' && msg.imageUrl ? (
              <Image
                source={{ uri: msg.imageUrl }}
                style={bubS.imageAttachment}
                resizeMode="cover"
              />
            ) : type === 'image' ? (
              <LinearGradient colors={['#1A1A2E', '#0A0A1A']} style={bubS.imagePlaceholder}>
                <Text style={bubS.imageEmoji}>📷</Text>
                <Text style={bubS.imageLabel}>{text}</Text>
              </LinearGradient>
            ) : null}

            {type === 'voice' && (
              <View style={bubS.voiceRow}>
                <TouchableOpacity style={bubS.playBtn}>
                  <LinearGradient
                    colors={
                      isOwn
                        ? ['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']
                        : ['rgba(124,58,237,0.2)', 'rgba(124,58,237,0.1)']
                    }
                    style={bubS.playBtnGrad}>
                    <Text style={bubS.playIcon}>▶</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <View style={bubS.waveformWrapper}>
                  {Array.from({ length: 28 }).map((_, i) => (
                    <View
                      key={i}
                      style={[
                        bubS.waveBar,
                        { height: 4 + Math.sin(i * 0.7) * 10 },
                        isOwn
                          ? {
                              backgroundColor:
                                i < 14 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)',
                            }
                          : { backgroundColor: i < 14 ? Colors.accent : Colors.border.medium },
                      ]}
                    />
                  ))}
                </View>
                <Text style={[bubS.voiceDuration, isOwn && bubS.voiceDurationOwn]}>
                  {voiceDuration}
                </Text>
              </View>
            )}

            {type === 'text' && (
              <Text style={[bubS.text, isOwn ? bubS.textOwn : bubS.textOther]}>{text}</Text>
            )}

            <View style={bubS.metaRow}>
              <Text style={[bubS.time, isOwn ? bubS.timeOwn : bubS.timeOther]}>{timeStr}</Text>
              {isOwn && <StatusIcon status={status} />}
            </View>
          </TouchableOpacity>

          {reactions && reactions.length > 0 && (
            <View style={[bubS.reactionsRow, isOwn && bubS.reactionsRowOwn]}>
              {reactions.map((r, i) => (
                <View key={i} style={bubS.reactionBadge}>
                  <Text style={bubS.reactionEmoji}>{r.emoji}</Text>
                  {r.count > 1 && <Text style={bubS.reactionCount}>{r.count}</Text>}
                </View>
              ))}
            </View>
          )}
        </View>

        {isOwn && <View style={{ width: 8 }} />}
      </View>
    );
  },
);

const bubS = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingHorizontal: Spacing.md,
    alignItems: 'flex-end',
  },
  rowOwn: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  avatarWrapper: { marginRight: 8, marginBottom: 2 },
  bubbleGroup: { maxWidth: BUBBLE_MAX },
  bubbleGroupOwn: { alignItems: 'flex-end' },
  bubbleGroupOther: { alignItems: 'flex-start' },
  replySnippet: {
    flexDirection: 'row',
    backgroundColor: 'rgba(124,58,237,0.12)',
    borderRadius: Radius.md,
    padding: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.2)',
    maxWidth: BUBBLE_MAX,
  },
  replySnippetOwn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.15)',
  },
  replyBar: { width: 3, borderRadius: 1.5, backgroundColor: Colors.primaryLight, marginRight: 8 },
  replyBarOwn: { backgroundColor: 'rgba(255,255,255,0.6)' },
  replyContent: { flex: 1 },
  replyName: { fontSize: 11, fontWeight: '700', color: Colors.primaryLight, marginBottom: 2 },
  replyNameOwn: { color: 'rgba(255,255,255,0.8)' },
  replyText: { fontSize: 12, color: Colors.text.tertiary },
  bubble: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, overflow: 'hidden' },
  bubbleOwn: { backgroundColor: Colors.primary, borderBottomRightRadius: 6, ...Shadow.brand },
  bubbleOther: {
    backgroundColor: Colors.bg.card,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  bubbleImage: { padding: 4, minWidth: 180 },
  imageAttachment: { width: 200, height: 200, borderRadius: 16, marginBottom: 6 },
  imagePlaceholder: {
    width: 200,
    height: 150,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 6,
  },
  imageEmoji: { fontSize: 40 },
  imageLabel: { fontSize: 12, color: Colors.text.tertiary },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    minWidth: 200,
  },
  playBtn: { borderRadius: 18, overflow: 'hidden' },
  playBtnGrad: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  playIcon: { fontSize: 12, color: Colors.white },
  waveformWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2 },
  waveBar: { width: 2.5, borderRadius: 1.5, minHeight: 4 },
  voiceDuration: {
    fontSize: 11,
    color: Colors.text.tertiary,
    minWidth: 30,
    fontVariant: ['tabular-nums'],
  },
  voiceDurationOwn: { color: 'rgba(255,255,255,0.7)' },
  text: { fontSize: 15, lineHeight: 22 },
  textOwn: { color: Colors.white },
  textOther: { color: Colors.text.primary },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  time: { fontSize: 10, fontWeight: '500' },
  timeOwn: { color: 'rgba(255,255,255,0.6)' },
  timeOther: { color: Colors.text.tertiary },
  reactionsRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
    backgroundColor: Colors.bg.card,
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    alignSelf: 'flex-start',
  },
  reactionsRowOwn: { alignSelf: 'flex-end' },
  reactionBadge: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  reactionEmoji: { fontSize: 13 },
  reactionCount: { fontSize: 11, fontWeight: '700', color: Colors.text.secondary },
  systemRow: { alignItems: 'center', paddingVertical: Spacing.md },
  systemText: {
    fontSize: 11,
    color: Colors.text.tertiary,
    fontWeight: '600',
    letterSpacing: 0.3,
    backgroundColor: Colors.bg.card,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
});

const REACTIONS = ['❤️', '👍', '😂', '🔥', '😮', '😢', '👏', '🎉'];
const ReactionPicker = ({
  onPick,
  onClose,
}: {
  onPick: (e: string) => void;
  onClose: () => void;
}) => (
  <View style={rpS.wrapper}>
    <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} />
    <View style={rpS.picker}>
      <LinearGradient colors={['#1A1A2E', '#12121E']} style={rpS.pickerGrad}>
        {REACTIONS.map(e => (
          <TouchableOpacity
            key={e}
            style={rpS.emojiBtn}
            onPress={() => {
              onPick(e);
              onClose();
            }}>
            <Text style={rpS.emoji}>{e}</Text>
          </TouchableOpacity>
        ))}
      </LinearGradient>
    </View>
  </View>
);

const rpS = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99,
    justifyContent: 'center',
    alignItems: 'center',
  },
  picker: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border.medium,
    ...Shadow.medium,
  },
  pickerGrad: { flexDirection: 'row', padding: Spacing.sm, gap: 4 },
  emojiBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  emoji: { fontSize: 26 },
});

const TypingIndicator = ({ photoURL, displayName }: { photoURL?: string; displayName: string }) => (
  <View style={typS.row}>
    <Avatar photoURL={photoURL} displayName={displayName} color="#EC4899" size={30} />
    <View style={typS.bubble}>
      <View style={typS.dots}>
        {[0, 1, 2].map(i => (
          <View key={i} style={typS.dot} />
        ))}
      </View>
    </View>
  </View>
);

const typS = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: 8,
  },
  bubble: {
    backgroundColor: Colors.bg.card,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  dots: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.text.tertiary },
});

const ReplyBanner = ({ replyTo, onCancel }: { replyTo: IReplyTo; onCancel: () => void }) => (
  <View style={rbS.wrapper}>
    <Reply size={16} color={Colors.primaryLight} style={{ marginRight: 8 }} />
    <View style={rbS.content}>
      <Text style={rbS.name}>{replyTo.senderName}</Text>
      <Text style={rbS.text} numberOfLines={1}>
        {replyTo.text}
      </Text>
    </View>
    <TouchableOpacity onPress={onCancel} style={rbS.closeBtn}>
      <X size={16} color={Colors.text.tertiary} />
    </TouchableOpacity>
  </View>
);

const rbS = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(124,58,237,0.08)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(124,58,237,0.2)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  content: { flex: 1 },
  name: { fontSize: 12, fontWeight: '700', color: Colors.primaryLight, marginBottom: 2 },
  text: { fontSize: 12, color: Colors.text.tertiary },
  closeBtn: { padding: 4 },
});

const DateSeparator = ({ label }: { label: string }) => (
  <View style={dsS.row}>
    <Text style={dsS.label}>{label}</Text>
  </View>
);

const dsS = StyleSheet.create({
  row: { alignItems: 'center', paddingVertical: Spacing.md },
  label: {
    fontSize: 11,
    color: Colors.text.tertiary,
    fontWeight: '600',
    letterSpacing: 0.3,
    backgroundColor: Colors.bg.card,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
});

type ListItem =
  | { kind: 'separator'; id: string; label: string }
  | { kind: 'message'; id: string; msg: IMessage };

type Props = NativeStackScreenProps<HomeStackParamList, 'ChatMessages'>;
const TARGET_USER_ID = 'aY2l5rV5aWbK1t8UyjXhHROm74J3';

export default function ChatMessages({ navigation, route }: Props) {
  const { user: currentUser } = useUser();
  const targetUserId: string = (route?.params as any)?.targetUserId ?? TARGET_USER_ID;

  const {
    messages,
    targetUser,
    isLoading,
    isSending,
    isTargetTyping,
    sendMessage,
    setTyping,
    markAllRead,
  } = useChat(targetUserId);

  const isReady = !isLoading && targetUser !== null;
  const [lastSeenLabel, setLastSeenLabel] = useState('');

  useEffect(() => {
    const refresh = () => {
      if (!targetUser) return;
      setLastSeenLabel(computeLastSeen(targetUser.isOnline, targetUser.lastSeen ?? null));
    };
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [targetUser]);

  useFocusEffect(
    useCallback(() => {
      if (isReady) void markAllRead();
    }, [isReady, markAllRead]),
  );

  const [inputText, setInputText] = useState('');
  const [replyTo, setReplyTo] = useState<IReplyTo | undefined>(undefined);
  const [showReactions, setShowReactions] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<IMessage | null>(null);
  const flatRef = useRef<FlatList>(null);

  const listItems = useMemo<ListItem[]>(() => {
    const items: ListItem[] = [];
    let lastLabel = '';
    messages.forEach(msg => {
      const label = msg.createdAt ? formatDateHeader(msg.createdAt) : '';
      if (label && label !== lastLabel) {
        lastLabel = label;
        items.push({ kind: 'separator', id: `sep_${msg.messageId}`, label });
      }
      items.push({ kind: 'message', id: msg.messageId, msg });
    });
    return items;
  }, [messages]);

  const showAvatarForIndex = useCallback(
    (index: number, item: ListItem): boolean => {
      if (item.kind !== 'message') return false;
      const next = listItems[index + 1];
      if (!next || next.kind !== 'message') return true;
      return next.msg.senderId !== item.msg.senderId;
    },
    [listItems],
  );

  const handleSend = useCallback(async () => {
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText('');
    setReplyTo(undefined);
    Keyboard.dismiss();
    await sendMessage(text, replyTo);
  }, [inputText, replyTo, sendMessage]);

  const handleInputChange = useCallback(
    (text: string) => {
      setInputText(text);
      setTyping(text.length > 0);
    },
    [setTyping],
  );

  const handleLongPress = useCallback((msg: IMessage) => {
    setSelectedMsg(msg);
    setShowReactions(true);
  }, []);

  const handleSetReply = useCallback(
    (msg: IMessage) => {
      if (!msg || msg.type === 'system') return;
      const isOwn = msg.senderId === currentUser?.userId;
      setReplyTo({
        messageId: msg.messageId,
        senderId: msg.senderId,
        senderName: isOwn ? 'You' : (targetUser?.displayName ?? 'User'),
        text: msg.text,
        type: msg.type,
      });
    },
    [currentUser?.userId, targetUser?.displayName],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: ListItem; index: number }) => {
      if (item.kind === 'separator') {
        return <DateSeparator key={item.id} label={item.label} />;
      }
      const { msg } = item;
      const isOwn = msg.senderId === currentUser?.userId;
      const showAvatar = !isOwn && showAvatarForIndex(index, item);

      return (
        <Bubble
          key={msg.messageId}
          msg={msg}
          isOwn={isOwn}
          targetPhotoURL={targetUser?.photoURL}
          targetDisplayName={targetUser?.displayName ?? ''}
          showAvatar={showAvatar}
          onLongPress={handleLongPress}
          onSetReply={handleSetReply}
        />
      );
    },
    [currentUser?.userId, targetUser, showAvatarForIndex, handleLongPress, handleSetReply],
  );

  if (!isReady) {
    return (
      <>
        <TransparentStatusBar />
        <ChatSkeleton onBack={() => navigation?.goBack()} />
      </>
    );
  }

  return (
    <View style={styles.root}>
      <TransparentStatusBar />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack()}>
          <ArrowLeft size={20} color={Colors.text.secondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.userInfo}
          onPress={() => navigation?.navigate('ViewUserProfile', { userId: targetUserId })}>
          <View style={styles.avatarWrapper}>
            <Avatar
              photoURL={targetUser.photoURL}
              displayName={targetUser.displayName}
              color="#EC4899"
              size={42}
            />
            {targetUser.isOnline && <View style={styles.onlineDot} />}
          </View>
          <View style={styles.userTextBlock}>
            <Text style={styles.userName} numberOfLines={1}>
              {targetUser.displayName}
            </Text>
            <Text style={[styles.userStatus, !targetUser.isOnline && styles.userStatusOffline]}>
              {lastSeenLabel}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <FlatList
          ref={flatRef}
          data={listItems}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
          onLayout={() => flatRef.current?.scrollToEnd({ animated: false })}
          ListFooterComponent={
            isTargetTyping ? (
              <TypingIndicator
                photoURL={targetUser.photoURL}
                displayName={targetUser.displayName}
              />
            ) : null
          }
        />

        {replyTo && <ReplyBanner replyTo={replyTo} onCancel={() => setReplyTo(undefined)} />}

        <View style={styles.composer}>
          <View style={[styles.inputWrapper, inputText.length > 0 && styles.inputWrapperActive]}>
            <TextInput
              style={styles.input}
              placeholder="Message..."
              placeholderTextColor={Colors.text.tertiary}
              value={inputText}
              onChangeText={handleInputChange}
              multiline
              maxLength={1000}
              selectionColor={Colors.accent}
              returnKeyType="default"
              enablesReturnKeyAutomatically={false}
            />
          </View>

          <TouchableOpacity
            style={[styles.sendBtn, isSending && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={isSending}
            activeOpacity={0.85}>
            <LinearGradient
              colors={['#7C3AED', '#00E5C3']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sendBtnGrad}>
              {isSending ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Send size={18} color={Colors.white} />
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {showReactions && (
        <ReactionPicker
          onPick={_emoji => {}}
          onClose={() => {
            setShowReactions(false);
            setSelectedMsg(null);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg.primary },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
    gap: Spacing.sm,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.bg.glass,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatarWrapper: { position: 'relative' },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: Colors.success,
    borderWidth: 2,
    borderColor: Colors.bg.primary,
  },
  userTextBlock: { flex: 1 },
  userName: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text.primary,
    letterSpacing: -0.3,
  },
  userStatus: { fontSize: 11, color: Colors.success, fontWeight: '500', marginTop: 1 },
  userStatusOffline: { color: Colors.text.tertiary },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg.glass,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  messagesList: { paddingVertical: Spacing.md, paddingBottom: Spacing.lg },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? 28 : Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
    backgroundColor: Colors.bg.primary,
  },
  attachBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.bg.glass,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: Colors.bg.glass,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    paddingLeft: Spacing.md,
    paddingRight: 4,
    paddingVertical: 6,
    maxHeight: 120,
  },
  inputWrapperActive: {
    borderColor: 'rgba(124,58,237,0.4)',
    backgroundColor: 'rgba(124,58,237,0.04)',
  },
  input: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: 15,
    lineHeight: 22,
    maxHeight: 100,
    paddingVertical: 4,
  },
  emojiBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  mediaBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  sendBtn: { borderRadius: 20, overflow: 'hidden', ...Shadow.brand },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnGrad: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
