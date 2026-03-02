import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import { ArrowLeft, MessageCirclePlus, Search, UserCheck, Users, X } from 'lucide-react-native';
import {
  collection,
  doc,
  getDoc,
  getFirestore,
  limit,
  onSnapshot,
  query,
  where,
} from '@react-native-firebase/firestore';

import { HomeStackParamList } from '../../../navigation/HomeNavigator';
import { Colors, Radius, Shadow, Spacing } from '../../../utilities/theme';
import { useUser } from '../../../Hooks/useUser';
import { TransparentStatusBar } from '../../../component/common/TransparentStatusBar';

type Props = NativeStackScreenProps<HomeStackParamList, 'NewChat'>;

interface Follower {
  userId: string;
  displayName: string;
  handle?: string;
  photoURL?: string;
  bio?: string;
}

const db = getFirestore();

const AVATAR_PALETTE = [
  '#7C3AED',
  '#00B89C',
  '#F59E0B',
  '#EF4444',
  '#3B82F6',
  '#EC4899',
  '#10B981',
  '#6366F1',
];

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function resolveHandle(user: Follower): string {
  if (user.handle) return user.handle.startsWith('@') ? user.handle : `@${user.handle}`;
  return `@${(user.displayName || 'user').toLowerCase().replace(/\s+/g, '')}`;
}

const Avatar = ({
  photoURL,
  displayName,
  size = 50,
}: {
  photoURL?: string;
  displayName: string;
  size?: number;
}) => {
  const [failed, setFailed] = useState(false);
  const color = avatarColor(displayName || '?');
  const letter = (displayName?.charAt(0) ?? '?').toUpperCase();
  const r = size / 2;

  if (photoURL && !failed) {
    return (
      <Image
        source={{ uri: photoURL }}
        style={{ width: size, height: size, borderRadius: r }}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: r,
        backgroundColor: color + '1A',
        borderWidth: 1.5,
        borderColor: color + '40',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ fontSize: size * 0.4, fontWeight: '800', color }}>{letter}</Text>
    </View>
  );
};

const SkeletonRow = () => (
  <View style={skelS.row}>
    <View style={skelS.avatar} />
    <View style={skelS.lines}>
      <View style={[skelS.line, { width: '44%' }]} />
      <View style={[skelS.line, { width: '28%', marginTop: 7, opacity: 0.6 }]} />
    </View>
    <View style={skelS.chip} />
  </View>
);

const skelS = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border.subtle,
  },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: Colors.bg.tertiary },
  lines: { flex: 1, marginHorizontal: Spacing.md },
  line: { height: 11, borderRadius: 6, backgroundColor: Colors.bg.tertiary },
  chip: { width: 88, height: 34, borderRadius: Radius.full, backgroundColor: Colors.bg.tertiary },
});

const UserRow = React.memo(
  ({ user, onPress, isLast }: { user: Follower; onPress: () => void; isLast: boolean }) => {
    const scale = useRef(new Animated.Value(1)).current;

    const onPressIn = () =>
      Animated.spring(scale, {
        toValue: 0.97,
        useNativeDriver: true,
        tension: 300,
        friction: 18,
      }).start();
    const onPressOut = () =>
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 300,
        friction: 18,
      }).start();

    return (
      <Animated.View style={{ transform: [{ scale }] }}>
        <TouchableOpacity
          style={[urS.row, !isLast && urS.separator]}
          onPress={onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          activeOpacity={1}>
          <View>
            <Avatar photoURL={user.photoURL} displayName={user.displayName} size={50} />
            <View style={urS.badge}>
              <UserCheck size={9} color="#fff" strokeWidth={2.5} />
            </View>
          </View>

          <View style={urS.info}>
            <Text style={urS.name} numberOfLines={1}>
              {user.displayName}
            </Text>
            <Text style={urS.handle} numberOfLines={1}>
              {resolveHandle(user)}
            </Text>
            {!!user.bio && (
              <Text style={urS.bio} numberOfLines={1}>
                {user.bio}
              </Text>
            )}
          </View>

          <LinearGradient
            colors={['#7C3AED', '#00B89C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={urS.cta}>
            <MessageCirclePlus size={13} color="#fff" strokeWidth={2} />
            <Text style={urS.ctaLabel}>Message</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  },
);

const urS = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 13,
    gap: Spacing.md,
  },
  separator: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border.subtle,
  },
  badge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.accent,
    borderWidth: 2,
    borderColor: Colors.bg.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: Colors.text.primary, letterSpacing: -0.3 },
  handle: { fontSize: 12, color: Colors.text.tertiary, fontWeight: '500', marginTop: 1 },
  bio: { fontSize: 12, color: Colors.text.tertiary, marginTop: 3 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  ctaLabel: { fontSize: 12, fontWeight: '700', color: '#fff' },
});

const EmptyFollowers = () => (
  <View style={emS.wrap}>
    <View style={emS.iconBox}>
      <Users size={26} color={Colors.text.tertiary} />
    </View>
    <Text style={emS.title}>No followers yet</Text>
    <Text style={emS.sub}>
      When someone follows you they'll appear here and you can message them.
    </Text>
  </View>
);

const EmptySearch = ({ q }: { q: string }) => (
  <View style={emS.wrap}>
    <View style={emS.iconBox}>
      <Search size={26} color={Colors.text.tertiary} />
    </View>
    <Text style={emS.title}>No match for "{q}"</Text>
    <Text style={emS.sub}>Try searching by name or username.</Text>
  </View>
);

const emS = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: 64, paddingHorizontal: 40, gap: Spacing.md },
  iconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.bg.glass,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  sub: { fontSize: 13, color: Colors.text.tertiary, textAlign: 'center', lineHeight: 19 },
});

export default function NewChatScreen({ navigation }: Props) {
  const { user: currentUser } = useUser();
  const currentUserId = currentUser?.userId ?? '';

  const [followers, setFollowers] = useState<Follower[]>([]);
  const [loading, setLoading] = useState(true);
  const userCacheRef = useRef<Map<string, Follower>>(new Map());

  useEffect(() => {
    if (!currentUserId) {
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(
      query(collection(db, 'Follows'), where('followingId', '==', currentUserId), limit(200)),
      async snapshot => {
        const changes = snapshot.docChanges();
        const removedIds = new Set<string>();
        changes
          .filter((c: any) => c.type === 'removed')
          .forEach((c: any) => {
            const followerId = (c.doc.data() as any).followerId as string;
            if (followerId) {
              removedIds.add(followerId);
              userCacheRef.current.delete(followerId);
            }
          });

        const addedIds: string[] = changes
          .filter((c: any) => c.type === 'added')
          .map((c: any) => (c.doc.data() as any).followerId as string)
          .filter((id: any) => id && id !== currentUserId);

        const uncachedIds = addedIds.filter(id => !userCacheRef.current.has(id));

        if (uncachedIds.length > 0) {
          try {
            const userSnaps = await Promise.all(
              uncachedIds.map(uid => getDoc(doc(collection(db, 'Users'), uid))),
            );

            userSnaps.forEach(snap => {
              if (!snap.exists()) return;
              const d = snap.data() as any;
              userCacheRef.current.set(snap.id, {
                userId: snap.id,
                displayName: d.displayName ?? d.email?.split('@')[0] ?? 'User',
                handle: d.handle ?? undefined,
                photoURL: d.photoURL ?? undefined,
                bio: d.bio ?? undefined,
              });
            });
          } catch (err) {
            console.error('[NewChatScreen] fetchUserDocs:', err);
          }
        }

        const allFollowerIds: string[] = snapshot.docs
          .map((d: any) => (d.data() as any).followerId as string)
          .filter((id: any) => id && id !== currentUserId);

        const all: Follower[] = allFollowerIds
          .map(id => userCacheRef.current.get(id))
          .filter((u): u is Follower => u !== undefined)
          .sort((a, b) => a.displayName.localeCompare(b.displayName));

        setFollowers(all);
        setLoading(false);
      },
      err => {
        console.error('[NewChatScreen] follows listener:', err);
        setLoading(false);
      },
    );

    return unsub;
  }, [currentUserId]);

  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const focusAnim = useRef(new Animated.Value(0)).current;

  const onFocus = useCallback(() => {
    setSearchFocused(true);
    Animated.timing(focusAnim, { toValue: 1, duration: 170, useNativeDriver: false }).start();
  }, [focusAnim]);

  const onBlur = useCallback(() => {
    setSearchFocused(false);
    Animated.timing(focusAnim, { toValue: 0, duration: 170, useNativeDriver: false }).start();
  }, [focusAnim]);

  const searchBorder = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.border.medium, Colors.accent],
  });

  const trimmed = search.trim().toLowerCase();

  const displayed = useMemo(() => {
    if (!trimmed) return followers;
    return followers.filter(
      u =>
        u.displayName.toLowerCase().includes(trimmed) ||
        (u.handle ?? '').toLowerCase().includes(trimmed),
    );
  }, [followers, trimmed]);

  const handleSelect = useCallback(
    (targetUserId: string) => {
      navigation.navigate('ChatMessages', { targetUserId });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Follower; index: number }) => (
      <UserRow
        user={item}
        onPress={() => handleSelect(item.userId)}
        isLast={index === displayed.length - 1}
      />
    ),
    [displayed.length, handleSelect],
  );

  const keyExtractor = useCallback((f: Follower) => f.userId, []);

  const ListHeader = useMemo(() => {
    if (!followers.length) return null;
    return (
      <View style={s.listHeader}>
        <Text style={s.listHeaderLabel}>
          {followers.length} follower{followers.length !== 1 ? 's' : ''}
        </Text>
        {trimmed && displayed.length > 0 && (
          <Text style={s.listHeaderCount}>
            {displayed.length} result{displayed.length !== 1 ? 's' : ''}
          </Text>
        )}
      </View>
    );
  }, [followers.length, trimmed, displayed.length]);

  const ListEmpty = useMemo(() => {
    if (loading) return null;
    return trimmed ? <EmptySearch q={search} /> : <EmptyFollowers />;
  }, [loading, trimmed, search]);

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TransparentStatusBar />
      <View style={s.orb1} />
      <View style={s.orb2} />

      <View style={s.header}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}>
          <ArrowLeft size={20} color={Colors.text.secondary} />
        </TouchableOpacity>

        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>New Message</Text>
          <Text style={s.headerSub}>Choose someone who follows you</Text>
        </View>

        <View style={s.backBtn} />
      </View>

      <View style={s.headerDivider} />

      <View style={s.searchWrap}>
        <Animated.View style={[s.searchBar, { borderColor: searchBorder }]}>
          <Search size={15} color={searchFocused ? Colors.accent : Colors.text.tertiary} />
          <TextInput
            style={s.searchInput}
            placeholder="Search by name or username…"
            placeholderTextColor={Colors.text.tertiary}
            value={search}
            onChangeText={setSearch}
            onFocus={onFocus}
            onBlur={onBlur}
            selectionColor={Colors.accent}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearch('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <View style={s.clearBtn}>
                <X size={10} color={Colors.text.tertiary} />
              </View>
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>

      {loading ? (
        <View style={s.skeletonWrap}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </View>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={ListEmpty}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          maxToRenderPerBatch={12}
          initialNumToRender={12}
          windowSize={8}
          removeClippedSubviews={Platform.OS === 'android'}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg.primary },

  orb1: {
    position: 'absolute',
    top: -40,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(124,58,237,0.07)',
  },
  orb2: {
    position: 'absolute',
    bottom: 80,
    left: -70,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(0,229,195,0.05)',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: Spacing.md,
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
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.text.primary, letterSpacing: -0.4 },
  headerSub: { fontSize: 12, color: Colors.text.tertiary, fontWeight: '500', marginTop: 1 },
  headerDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border.subtle },

  searchWrap: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
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

  skeletonWrap: { flex: 1 },
  listContent: { paddingBottom: Platform.OS === 'ios' ? 48 : 24 },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    paddingTop: 2,
  },
  listHeaderLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text.tertiary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  listHeaderCount: { fontSize: 11, fontWeight: '600', color: Colors.accent },
});
