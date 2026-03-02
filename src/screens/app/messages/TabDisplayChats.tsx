import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabParamList } from '../../../navigation/BottomTabs';
import { HomeStackParamList } from '../../../navigation/HomeNavigator';

import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Platform,
  TextInput,
  Image,
  ActivityIndicator,
  Animated,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {
  Search,
  Edit,
  Check,
  CheckCheck,
  Image as ImageIcon,
  Mic,
  Clock,
  X,
} from 'lucide-react-native';
import { Colors, Spacing, Radius, Shadow } from '../../../utilities/theme';
import { useUser } from '../../../Hooks/useUser';
import { TransparentStatusBar } from '../../../component/common/TransparentStatusBar';

const db = getFirestore();

type ChatMsgType = 'text' | 'image' | 'voice' | 'system';
type LastMsgStatusType = 'pending' | 'sent' | 'delivered' | 'read';

interface ChatListItem {
  chatId: string;
  targetUserId: string;
  targetDisplayName: string;
  targetPhotoURL: string;
  targetIsOnline: boolean;
  lastMessageText: string;
  lastMessageType: ChatMsgType;
  lastMessageSenderId: string;
  lastMessageTime: FirebaseFirestoreTypes.Timestamp | null;
  lastMessageStatus: LastMsgStatusType;
  unreadCount: number;
  updatedAt: FirebaseFirestoreTypes.Timestamp | null;
}

const VALID_MSG_TYPES = new Set<string>(['text', 'image', 'voice', 'system']);
const VALID_STATUSES = new Set<string>(['pending', 'sent', 'delivered', 'read']);

function docToListItem(
  d: FirebaseFirestoreTypes.QueryDocumentSnapshot<FirebaseFirestoreTypes.DocumentData>,
  currentUserId: string,
): ChatListItem | null {
  const data = d.data();

  const participants: string[] = data.participants ?? [];
  const targetUserId = participants.find((id: string) => id !== currentUserId);
  if (!targetUserId) return null;

  if (!data.lastMessage) return null;

  const targetDetail = (data.participantDetails ?? {})[targetUserId] ?? {};
  const lastMsg = data.lastMessage;

  const rawType: string = lastMsg?.type ?? 'text';
  const lastMessageType: ChatMsgType = VALID_MSG_TYPES.has(rawType)
    ? (rawType as ChatMsgType)
    : 'text';

  const rawStatus: string = lastMsg?.status ?? 'sent';
  const lastMessageStatus: LastMsgStatusType = VALID_STATUSES.has(rawStatus)
    ? (rawStatus as LastMsgStatusType)
    : 'sent';

  return {
    chatId: d.id,
    targetUserId,
    targetDisplayName: targetDetail.displayName ?? '',
    targetPhotoURL: targetDetail.photoURL ?? '',
    targetIsOnline: targetDetail.isOnline ?? false,
    lastMessageText: lastMsg?.text ?? '',
    lastMessageType,
    lastMessageSenderId: lastMsg?.senderId ?? '',
    lastMessageTime: lastMsg?.createdAt ?? null,
    lastMessageStatus,
    unreadCount: data.unreadCount?.[currentUserId] ?? 0,
    updatedAt: data.updatedAt ?? null,
  };
}

function formatConvTime(ts: FirebaseFirestoreTypes.Timestamp | null): string {
  if (!ts || typeof ts.toDate !== 'function') return '';
  const date = ts.toDate();
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHr < 24) return `${diffHr}h`;
  if (diffDay === 1) return 'Yesterday';
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
  }
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

function nameToColor(name: string): string {
  const palette = [
    '#EC4899',
    '#00B89C',
    '#F59E0B',
    '#8B5CF6',
    '#3B82F6',
    '#10B981',
    '#6366F1',
    '#F97316',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

interface AvatarProps {
  photoURL?: string;
  displayName: string;
  size?: number;
  showOnline?: boolean;
}

const Avatar = ({ photoURL, displayName, size = 52, showOnline = false }: AvatarProps) => {
  const color = nameToColor(displayName);
  const initial = displayName ? displayName.charAt(0).toUpperCase() : '?';
  const r = size / 2;

  return (
    <View style={{ width: size, height: size }}>
      {photoURL ? (
        <Image source={{ uri: photoURL }} style={{ width: size, height: size, borderRadius: r }} />
      ) : (
        <View
          style={[
            avS.placeholder,
            { width: size, height: size, borderRadius: r, backgroundColor: color + '22' },
          ]}>
          <Text style={[avS.initial, { color, fontSize: size * 0.38 }]}>{initial}</Text>
        </View>
      )}
      {showOnline && (
        <View
          style={[
            avS.onlineDot,
            {
              width: size * 0.26,
              height: size * 0.26,
              borderRadius: size * 0.13,
              borderWidth: size * 0.05,
            },
          ]}
        />
      )}
    </View>
  );
};

const avS = StyleSheet.create({
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontWeight: '800' },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    backgroundColor: Colors.success,
    borderColor: Colors.bg.primary,
  },
});

const LastMsgStatusIcon = ({ status, isOwn }: { status: LastMsgStatusType; isOwn: boolean }) => {
  if (!isOwn) return null;
  const p = { size: 13 } as const;
  switch (status) {
    case 'pending':
      return <Clock {...p} color={Colors.text.tertiary} />;
    case 'sent':
      return <Check {...p} color={Colors.text.tertiary} />;
    case 'delivered':
      return <CheckCheck {...p} color={Colors.text.tertiary} />;
    case 'read':
      return <CheckCheck {...p} color={Colors.accent} />;
    default:
      return null;
  }
};

const TypeIcon = ({ type }: { type: ChatMsgType }) => {
  if (type === 'image') return <ImageIcon size={13} color={Colors.accent} />;
  if (type === 'voice') return <Mic size={13} color={Colors.success} />;
  return null;
};

function buildPreview(item: ChatListItem, currentUserId: string): string {
  const isOwn = item.lastMessageSenderId === currentUserId;
  const prefix = isOwn ? 'You: ' : '';
  if (item.lastMessageType === 'image') return `${prefix}📷 Photo`;
  if (item.lastMessageType === 'voice') return `${prefix}🎤 Voice message`;
  return `${prefix}${item.lastMessageText}`;
}

const ConvRow = React.memo(
  ({
    item,
    currentUserId,
    onPress,
  }: {
    item: ChatListItem;
    currentUserId: string;
    onPress: () => void;
  }) => {
    const isOwn = item.lastMessageSenderId === currentUserId;
    const hasUnread = item.unreadCount > 0;

    return (
      <TouchableOpacity
        style={[rowS.row, hasUnread && rowS.rowUnread]}
        onPress={onPress}
        activeOpacity={0.72}>
        <View style={rowS.avatarSlot}>
          <Avatar
            photoURL={item.targetPhotoURL}
            displayName={item.targetDisplayName}
            size={52}
            showOnline={item.targetIsOnline}
          />
        </View>

        <View style={rowS.content}>
          <View style={rowS.topRow}>
            <Text style={[rowS.name, hasUnread && rowS.nameUnread]} numberOfLines={1}>
              {item.targetDisplayName}
            </Text>
            <Text style={[rowS.time, hasUnread && rowS.timeUnread]}>
              {formatConvTime(item.lastMessageTime)}
            </Text>
          </View>

          <View style={rowS.bottomRow}>
            <View style={rowS.previewRow}>
              <LastMsgStatusIcon status={item.lastMessageStatus} isOwn={isOwn} />
              {item.lastMessageType !== 'text' && item.lastMessageType !== 'system' && (
                <TypeIcon type={item.lastMessageType} />
              )}
              <Text style={[rowS.preview, hasUnread && rowS.previewUnread]} numberOfLines={1}>
                {buildPreview(item, currentUserId)}
              </Text>
            </View>
            {hasUnread && (
              <View style={rowS.unreadBadge}>
                <Text style={rowS.unreadText}>
                  {item.unreadCount > 99 ? '99+' : item.unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  },
);

const rowS = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border.subtle,
  },
  rowUnread: { backgroundColor: 'rgba(0,229,195,0.035)' },
  avatarSlot: { marginRight: Spacing.md },
  content: { flex: 1 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.secondary,
    letterSpacing: -0.2,
    flex: 1,
    marginRight: 8,
  },
  nameUnread: { fontWeight: '800', color: Colors.text.primary },
  time: { fontSize: 11, color: Colors.text.tertiary, fontWeight: '500', flexShrink: 0 },
  timeUnread: { color: Colors.accent, fontWeight: '700' },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previewRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 8,
  },
  preview: { fontSize: 13, color: Colors.text.tertiary, flex: 1 },
  previewUnread: { color: Colors.text.secondary, fontWeight: '500' },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadText: { fontSize: 10, fontWeight: '800', color: Colors.bg.primary },
});

const ActiveNowStrip = React.memo(
  ({ users, onPress }: { users: ChatListItem[]; onPress: (item: ChatListItem) => void }) => {
    if (users.length === 0) return null;
    return (
      <View style={activeS.wrapper}>
        <Text style={activeS.label}>ACTIVE NOW</Text>
        <FlatList
          data={users}
          keyExtractor={u => u.chatId}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: Spacing.md, paddingHorizontal: 2 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={activeS.item} onPress={() => onPress(item)}>
              <Avatar
                photoURL={item.targetPhotoURL}
                displayName={item.targetDisplayName}
                size={46}
                showOnline
              />
              <Text style={activeS.name} numberOfLines={1}>
                {item.targetDisplayName.split(' ')[0]}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>
    );
  },
);

const activeS = StyleSheet.create({
  wrapper: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border.subtle,
    gap: 10,
  },
  label: { fontSize: 10, fontWeight: '700', color: Colors.text.tertiary, letterSpacing: 1.4 },
  item: { alignItems: 'center', gap: 5 },
  name: {
    fontSize: 11,
    color: Colors.text.secondary,
    fontWeight: '500',
    maxWidth: 50,
    textAlign: 'center',
  },
});

const EmptySearch = ({ q }: { q: string }) => (
  <View style={emptyS.wrapper}>
    <View style={emptyS.iconBox}>
      <Search size={28} color={Colors.text.tertiary} />
    </View>
    <Text style={emptyS.title}>No results for "{q}"</Text>
    <Text style={emptyS.desc}>Try a different name or keyword</Text>
  </View>
);

const EmptyInbox = () => (
  <View style={emptyS.wrapper}>
    <View style={emptyS.iconBox}>
      <Edit size={28} color={Colors.text.tertiary} />
    </View>
    <Text style={emptyS.title}>No conversations yet</Text>
    <Text style={emptyS.desc}>Tap the compose button to start chatting</Text>
  </View>
);

const emptyS = StyleSheet.create({
  wrapper: { alignItems: 'center', paddingTop: 72, gap: Spacing.md, paddingHorizontal: 40 },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.bg.glass,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  desc: { fontSize: 14, color: Colors.text.tertiary, textAlign: 'center', lineHeight: 20 },
});

type Props = CompositeScreenProps<
  BottomTabScreenProps<BottomTabParamList, 'TabDisplayChats'>,
  NativeStackScreenProps<HomeStackParamList>
>;

export default function TabDisplayChats({ navigation }: Props) {
  const { user: currentUser } = useUser();
  const currentUserId = currentUser?.userId ?? '';

  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUserId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'Chats'),
      where('participants', 'array-contains', currentUserId),
      orderBy('updatedAt', 'desc'),
    );

    const unsub = onSnapshot(
      q,
      snapshot => {
        const items: ChatListItem[] = [];
        snapshot.docs.forEach((d: any) => {
          const item = docToListItem(d, currentUserId);
          if (item) items.push(item);
        });
        setChats(items);
        setLoading(false);
      },
      err => {
        console.warn('[TabDisplayChats] listener error:', err);
        setLoading(false);
      },
    );

    return unsub;
  }, [currentUserId]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const focusAnim = useRef(new Animated.Value(0)).current;

  const handleSearchFocus = useCallback(() => {
    setSearchFocused(true);
    Animated.timing(focusAnim, { toValue: 1, duration: 180, useNativeDriver: false }).start();
  }, [focusAnim]);

  const handleSearchBlur = useCallback(() => {
    setSearchFocused(false);
    Animated.timing(focusAnim, { toValue: 0, duration: 180, useNativeDriver: false }).start();
  }, [focusAnim]);

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.border.medium, Colors.accent],
  });

  const trimmedQuery = searchQuery.trim().toLowerCase();

  const filteredChats = useMemo(() => {
    if (!trimmedQuery) return chats;
    return chats.filter(
      c =>
        c.targetDisplayName.toLowerCase().includes(trimmedQuery) ||
        c.lastMessageText.toLowerCase().includes(trimmedQuery),
    );
  }, [chats, trimmedQuery]);

  const onlineUsers = useMemo(() => chats.filter(c => c.targetIsOnline), [chats]);
  const totalUnread = useMemo(() => chats.reduce((s, c) => s + c.unreadCount, 0), [chats]);

  const openChat = useCallback(
    (item: ChatListItem) => {
      (navigation as any).navigate('ChatMessages', { targetUserId: item.targetUserId });
    },
    [navigation],
  );

  const openNewChat = useCallback(() => {
    (navigation as any).navigate('NewChat');
  }, [navigation]);

  const renderItem = useCallback(
    ({ item }: { item: ChatListItem }) => (
      <ConvRow item={item} currentUserId={currentUserId} onPress={() => openChat(item)} />
    ),
    [currentUserId, openChat],
  );

  const keyExtractor = useCallback((item: ChatListItem) => item.chatId, []);

  const ListHeader = useMemo(() => {
    if (trimmedQuery) return null;
    return <ActiveNowStrip users={onlineUsers} onPress={openChat} />;
  }, [trimmedQuery, onlineUsers, openChat]);

  const ListEmpty = useMemo(() => {
    if (isLoading) return null;
    if (trimmedQuery) return <EmptySearch q={searchQuery} />;
    return <EmptyInbox />;
  }, [isLoading, trimmedQuery, searchQuery]);

  return (
    <View style={styles.root}>
      <TransparentStatusBar />
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Messages</Text>
          {totalUnread > 0 && (
            <View style={styles.unreadBubble}>
              <Text style={styles.unreadBubbleText}>{totalUnread > 99 ? '99+' : totalUnread}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={styles.composeBtn} onPress={openNewChat} activeOpacity={0.85}>
          <LinearGradient
            colors={['#7C3AED', '#00E5C3']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.composeBtnGrad}>
            <Edit size={16} color={Colors.white} />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrapper}>
        <Animated.View style={[styles.searchBar, { borderColor }]}>
          <Search size={16} color={searchFocused ? Colors.accent : Colors.text.tertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search messages..."
            placeholderTextColor={Colors.text.tertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
            selectionColor={Colors.accent}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <View style={styles.clearBtn}>
                <X size={11} color={Colors.text.tertiary} />
              </View>
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>

      {isLoading ? (
        <View style={styles.loadingWrapper}>
          <ActivityIndicator color={Colors.accent} size="small" />
        </View>
      ) : (
        <FlatList
          data={filteredChats}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={ListEmpty}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          removeClippedSubviews={Platform.OS === 'android'}
          maxToRenderPerBatch={12}
          windowSize={10}
          initialNumToRender={12}
          getItemLayout={(_, index) => ({ length: 79, offset: 79 * index, index })}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg.primary, overflow: 'hidden' },
  orb1: {
    position: 'absolute',
    top: -40,
    right: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(124,58,237,0.08)',
  },
  orb2: {
    position: 'absolute',
    top: 400,
    left: -70,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(0,229,195,0.05)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: Spacing.md,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: Colors.text.primary, letterSpacing: -1 },
  unreadBubble: {
    height: 22,
    minWidth: 22,
    borderRadius: 11,
    backgroundColor: Colors.bg.glass,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBubbleText: { fontSize: 11, fontWeight: '700', color: Colors.text.secondary },
  composeBtn: { borderRadius: 20, overflow: 'hidden', ...Shadow.brand },
  composeBtnGrad: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  searchWrapper: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.bg.glass,
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 15, color: Colors.text.primary, fontWeight: '500' },
  clearBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingWrapper: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingBottom: 100 },
});
