import React, { useState, useRef, useEffect } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { HomeStackParamList } from '../../../navigation/HomeNavigator';

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {
  X,
  Image as ImageIcon,
  Globe,
  Users,
  Lock,
  ChevronDown,
  Check,
  Hash,
  AtSign,
  Trash2,
} from 'lucide-react-native';
import { launchImageLibrary, ImageLibraryOptions } from 'react-native-image-picker';
import { Colors, Spacing, Radius, Shadow } from '../../../utilities/theme';
import { useUser } from '../../../Hooks/useUser';
import { usePost } from '../../../Hooks/usePosts';
import { ICreatePost, IPost } from '../../../interfaces/IPost';
import Svg, { Circle } from 'react-native-svg';
import { TransparentStatusBar } from '../../../component/common/TransparentStatusBar';

const { width } = Dimensions.get('window');

const MAX_CHARS = 5000;
const MAX_IMAGES = 4;

type VisibilityKey = 'public' | 'followers' | 'private';

interface ISelectedImage {
  uri: string;
  type: string;
  name: string;
}

type IExistingImage = IPost['images'][number];

const VISIBILITY_OPTIONS = [
  { key: 'public' as VisibilityKey, label: 'Everyone', icon: '🌐', Icon: Globe, color: '#00E5C3' },
  {
    key: 'followers' as VisibilityKey,
    label: 'Followers',
    icon: '👥',
    Icon: Users,
    color: '#7C3AED',
  },
  { key: 'private' as VisibilityKey, label: 'Only Me', icon: '🔒', Icon: Lock, color: '#64748B' },
];

const HASHTAG_POOL: { keywords: string[]; tag: string }[] = [
  { keywords: ['react', 'native', 'rn', 'expo'], tag: '#ReactNative' },
  { keywords: ['firebase', 'firestore', 'storage'], tag: '#Firebase' },
  { keywords: ['app', 'mobile', 'ios', 'android'], tag: '#MobileDev' },
  {
    keywords: ['build', 'shipped', 'launch', 'update', 'release', 'pushed'],
    tag: '#BuildInPublic',
  },
  { keywords: ['design', 'ui', 'ux', 'figma'], tag: '#UIDesign' },
  { keywords: ['typescript', 'ts', 'javascript', 'js'], tag: '#TypeScript' },
  { keywords: ['ai', 'gpt', 'llm', 'claude', 'openai', 'model'], tag: '#AI' },
  { keywords: ['code', 'coding', 'dev', 'developer', 'programming', 'engineer'], tag: '#Dev' },
  { keywords: ['startup', 'saas', 'product', 'founder'], tag: '#Startup' },
  { keywords: ['cloud', 'aws', 'gcp', 'azure', 'serverless'], tag: '#Cloud' },
];

function getSuggestedTags(content: string, alreadyUsed: string[]): string[] {
  const lower = content.toLowerCase();
  const matched: string[] = [];
  for (const entry of HASHTAG_POOL) {
    if (
      entry.keywords.some(kw => lower.includes(kw)) &&
      !alreadyUsed.includes(entry.tag.toLowerCase())
    ) {
      matched.push(entry.tag);
    }
  }
  if (matched.length === 0) {
    return ['#BuildInPublic', '#Dev', '#MobileDev', '#TypeScript'].filter(
      t => !alreadyUsed.includes(t.toLowerCase()),
    );
  }
  return matched.slice(0, 6);
}

const VisibilityPicker = ({
  value,
  onChange,
  onClose,
}: {
  value: VisibilityKey;
  onChange: (v: VisibilityKey) => void;
  onClose: () => void;
}) => (
  <View style={visS.overlay}>
    <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />
    <View style={visS.picker}>
      <LinearGradient colors={['#1A1A2E', '#12121E']} style={visS.pickerGrad}>
        <Text style={visS.title}>Post Visibility</Text>
        {VISIBILITY_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.key}
            style={[visS.option, value === opt.key && visS.optionActive]}
            onPress={() => {
              onChange(opt.key);
              onClose();
            }}>
            <Text style={visS.optionEmoji}>{opt.icon}</Text>
            <Text style={[visS.optionText, value === opt.key && visS.optionTextActive]}>
              {opt.label}
            </Text>
            {value === opt.key && <Check size={16} color={Colors.accent} />}
          </TouchableOpacity>
        ))}
      </LinearGradient>
    </View>
  </View>
);

const visS = StyleSheet.create({
  overlay: {
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
    width: width - Spacing.xl * 2,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border.medium,
    ...Shadow.medium,
  },
  pickerGrad: { padding: Spacing.lg },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text.primary,
    marginBottom: Spacing.md,
    letterSpacing: -0.3,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
  },
  optionActive: { backgroundColor: 'rgba(0,229,195,0.1)' },
  optionEmoji: { fontSize: 20 },
  optionText: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text.secondary },
  optionTextActive: { color: Colors.text.primary, fontWeight: '700' },
});

const COMPOSER_INNER = width - Spacing.lg * 2 - 14 * 2;
const CARD_W = (COMPOSER_INNER - Spacing.sm) / 2;
const CARD_H = CARD_W * 0.68;

const ImageGridCard = ({
  sourceUri,
  sourceUrl,
  progress,
  onRemove,
  disabled,
}: {
  sourceUri?: string;
  sourceUrl?: string;
  progress: number;
  onRemove: () => void;
  disabled: boolean;
}) => {
  const imageSource = sourceUrl ? { uri: sourceUrl } : { uri: sourceUri! };
  const isUploading = !sourceUrl && disabled && progress < 100;
  return (
    <View style={igS.root}>
      <Image source={imageSource} style={igS.img} resizeMode="cover" />
      {isUploading && (
        <View style={igS.overlay}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={igS.pct}>{Math.round(progress)}%</Text>
          <View style={igS.barBg}>
            <View style={[igS.barFill, { width: `${progress}%` as any }]} />
          </View>
        </View>
      )}
      {!disabled && (
        <TouchableOpacity style={igS.remove} onPress={onRemove} activeOpacity={0.8}>
          <X size={10} color="#fff" strokeWidth={3} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const igS = StyleSheet.create({
  root: {
    flex: 1,
    height: CARD_H,
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  img: { width: '100%', height: '100%' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.58)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  pct: { fontSize: 12, fontWeight: '800', color: '#fff' },
  barBg: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  barFill: { height: '100%', backgroundColor: '#00E5C3', borderRadius: 2 },
  remove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

type Props = NativeStackScreenProps<HomeStackParamList, 'WritePost'>;
export default function WritePost({ navigation, route }: Props) {
  const { user } = useUser();
  const {
    createPost,
    updatePost,
    deletePost,
    getPost,
    creating,
    updating,
    deleting,
    loading: hookLoading,
    imageProgress,
  } = usePost();

  const postId = route?.params?.postId ?? null;
  const isEditMode = !!postId;

  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [originalContent, setOriginalContent] = useState('');
  const [originalVisibility, setOriginalVisibility] = useState<VisibilityKey>('public');
  const [lastEdited, setLastEdited] = useState<Date | null>(null);

  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<VisibilityKey>('public');
  const [attachedImages, setAttachedImages] = useState<ISelectedImage[]>([]);
  const [existingImages, setExistingImages] = useState<IExistingImage[]>([]);
  const [focused, setFocused] = useState(false);
  const [showVisPicker, setShowVisPicker] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!isEditMode || !postId) return;
    let cancelled = false;
    setFetchError(null);
    (async () => {
      try {
        const post = await getPost(postId);
        if (cancelled) return;
        if (!post) {
          setFetchError('Post not found.');
          return;
        }
        setContent(post.content);
        setOriginalContent(post.content);
        const vis = (post.visibility as VisibilityKey) ?? 'public';
        setVisibility(vis);
        setOriginalVisibility(vis);
        setLastEdited(post.updatedAt ?? post.createdAt ?? null);
        setExistingImages(post.images ?? []);
        setOriginalImageCount((post.images ?? []).length);
      } catch (e: any) {
        if (!cancelled) setFetchError(e?.message ?? 'Failed to load post.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [postId, retryKey]);

  const charCount = content.length;
  const charRemaining = MAX_CHARS - charCount;
  const charProgress = Math.min(charCount / MAX_CHARS, 1);
  const isOverLimit = charCount > MAX_CHARS;
  const charColor =
    charRemaining < 50 ? Colors.error : charRemaining < 200 ? Colors.warning : Colors.accent;

  const isProcessing = creating || updating || deleting;
  const canSubmit = content.trim().length > 0 && !isProcessing && !isOverLimit && !hookLoading;
  const [originalImageCount, setOriginalImageCount] = useState(0);
  const hasChanges = isEditMode
    ? content !== originalContent ||
      visibility !== originalVisibility ||
      attachedImages.length > 0 ||
      existingImages.length !== originalImageCount
    : content.trim().length > 0;

  const activeVis = VISIBILITY_OPTIONS.find(v => v.key === visibility)!;
  const progressFor = (uri: string) => imageProgress.find(p => p.uri === uri)?.progress ?? 0;

  const alreadyUsedTags = (content.match(/#[\w]+/g) ?? []).map(t => t.toLowerCase());
  const suggestedTags = content.trim().length > 2 ? getSuggestedTags(content, alreadyUsedTags) : [];

  const lastEditedLabel =
    isEditMode && lastEdited
      ? `Last edited ${lastEdited.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : null;

  const handlePickImages = async () => {
    const remaining = MAX_IMAGES - attachedImages.length - existingImages.length;
    if (remaining <= 0) {
      Alert.alert('Limit reached', `You can attach at most ${MAX_IMAGES} images.`);
      return;
    }
    const options: ImageLibraryOptions = {
      mediaType: 'photo',
      quality: 0.8,
      selectionLimit: remaining,
      includeBase64: false,
    };
    try {
      const result = await launchImageLibrary(options);
      if (result.didCancel) return;
      if (result.errorCode) {
        Alert.alert('Error', result.errorMessage || 'Failed to pick images');
        return;
      }
      if (result.assets) {
        const picked: ISelectedImage[] = result.assets.map(a => ({
          uri: a.uri!,
          type: a.type || 'image/jpeg',
          name: a.fileName || `img_${Date.now()}.jpg`,
        }));
        setAttachedImages(prev => [...prev, ...picked].slice(0, MAX_IMAGES));
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
      }
    } catch {
      Alert.alert('Error', 'Failed to pick images');
    }
  };

  const handleRemoveImage = (uri: string) =>
    setAttachedImages(prev => prev.filter(img => img.uri !== uri));

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in');
      return;
    }
    if (!content.trim()) {
      Alert.alert('Missing content', 'Write something first.');
      return;
    }

    const payload: ICreatePost = {
      content: content.trim(),
      images: attachedImages,
      existingImages: isEditMode ? existingImages : undefined,
      visibility,
    };

    if (isEditMode && postId) {
      const success = await updatePost(postId, user.userId, payload);
      if (success) navigation?.goBack();
    } else {
      const postId = await createPost(user.userId, payload);
      if (postId) {
        Alert.alert('Published!', 'Your post is live.', [
          {
            text: 'Great',
            onPress: () => {
              setContent('');
              setAttachedImages([]);
              setVisibility('public');
              navigation.navigate('BottomTabs', { screen: 'TabHome' });
            },
          },
        ]);
      }
    }
  };

  const handleDelete = async () => {
    if (!user || !postId) return;
    const success = await deletePost(postId, user.userId);
    if (success) navigation?.goBack();
  };

  const appendHashtag = (tag: string) => {
    setContent(prev => (prev === '' || prev.endsWith(' ') ? `${prev}${tag} ` : `${prev} ${tag} `));
  };

  if (isEditMode && hookLoading) {
    return (
      <View style={s.root}>
        <TransparentStatusBar />
        <View style={s.orb1} />
        <View style={s.orb2} />
        <View style={s.header}>
          <TouchableOpacity style={s.closeBtn} onPress={() => navigation?.goBack()}>
            <X size={18} color={Colors.text.secondary} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Edit Post</Text>
          <View style={[s.submitBtn, s.submitBtnOff]}>
            <View style={[s.submitBtnGrad, { backgroundColor: 'transparent' }]}>
              <Text style={s.submitBtnTextOff}>Update</Text>
            </View>
          </View>
        </View>
        <View style={sk.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={sk.label}>Loading post…</Text>
        </View>
      </View>
    );
  }

  if (fetchError) {
    return (
      <View style={s.root}>
        <TransparentStatusBar />
        <View style={s.header}>
          <TouchableOpacity style={s.closeBtn} onPress={() => navigation?.goBack()}>
            <X size={18} color={Colors.text.secondary} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Edit Post</Text>
          <View style={{ width: 70 }} />
        </View>
        <View style={sk.center}>
          <Text style={sk.errorIcon}>⚠️</Text>
          <Text style={sk.errorText}>{fetchError}</Text>
          <TouchableOpacity
            style={sk.retryBtn}
            onPress={() => {
              setFetchError(null);
              setRetryKey(k => k + 1);
            }}>
            <Text style={sk.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <TransparentStatusBar />
      <View style={s.orb1} />
      <View style={s.orb2} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={s.header}>
          <TouchableOpacity
            style={s.closeBtn}
            onPress={() => navigation?.goBack()}
            disabled={isProcessing}>
            <X size={18} color={Colors.text.secondary} />
          </TouchableOpacity>

          <Text style={s.headerTitle}>{isEditMode ? 'Edit Post' : 'New Post'}</Text>

          <TouchableOpacity
            style={[s.submitBtn, (!canSubmit || (isEditMode && !hasChanges)) && s.submitBtnOff]}
            onPress={handleSubmit}
            disabled={!canSubmit || (isEditMode && !hasChanges)}>
            <LinearGradient
              colors={
                canSubmit && (!isEditMode || hasChanges)
                  ? ['#00E5C3', '#7C3AED']
                  : ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.04)']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.submitBtnGrad}>
              {isProcessing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text
                  style={[
                    s.submitBtnText,
                    (!canSubmit || (isEditMode && !hasChanges)) && s.submitBtnTextOff,
                  ]}>
                  {isEditMode ? 'Update' : 'Publish'}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <View style={s.authorRow}>
            {user?.photoURL ? (
              <Image source={{ uri: user.photoURL }} style={s.avatar} />
            ) : (
              <LinearGradient colors={['#7C3AED', '#00E5C3']} style={s.avatar}>
                <Text style={s.avatarLetter}>
                  {user?.displayName?.charAt(0).toUpperCase() ?? 'U'}
                </Text>
              </LinearGradient>
            )}

            <View style={s.authorMeta}>
              <View style={s.nameRow}>
                <Text style={s.authorName}>{user?.displayName ?? 'You'}</Text>
                <View style={s.verifiedBadge}>
                  <Check size={8} color="#fff" strokeWidth={3} />
                </View>
              </View>

              <TouchableOpacity
                style={[s.visPill, { borderColor: activeVis.color + '55' }]}
                onPress={() => setShowVisPicker(true)}
                disabled={isProcessing}>
                <activeVis.Icon size={11} color={activeVis.color} />
                <Text style={[s.visPillLabel, { color: activeVis.color }]}>{activeVis.label}</Text>
                <ChevronDown size={11} color={activeVis.color} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={[s.composerBox, focused && s.composerBoxFocused]}>
            {focused && <View style={s.focusAccent} />}

            <TextInput
              style={s.textInput}
              placeholder="What's on your mind?"
              placeholderTextColor="rgba(255,255,255,0.18)"
              multiline
              value={content}
              onChangeText={setContent}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              maxLength={MAX_CHARS + 100}
              selectionColor={Colors.primary}
              textAlignVertical="top"
              editable={!isProcessing}
            />

            {(attachedImages.length > 0 || existingImages.length > 0) && (
              <View style={s.imagesWrap}>
                <View style={s.imagesHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <ImageIcon size={11} color="rgba(255,255,255,0.3)" />
                    <Text style={s.imagesHeaderText}>ATTACHED MEDIA</Text>
                  </View>
                  <Text style={s.imagesCount}>
                    {existingImages.length + attachedImages.length}/{MAX_IMAGES}
                  </Text>
                </View>

                {(() => {
                  const items: React.ReactNode[] = [
                    ...existingImages.map(img => (
                      <ImageGridCard
                        key={img.publicId}
                        sourceUrl={img.url}
                        progress={100}
                        onRemove={() =>
                          setExistingImages(prev => prev.filter(i => i.publicId !== img.publicId))
                        }
                        disabled={isProcessing}
                      />
                    )),
                    ...attachedImages.map(img => (
                      <ImageGridCard
                        key={img.uri}
                        sourceUri={img.uri}
                        progress={progressFor(img.uri)}
                        onRemove={() => handleRemoveImage(img.uri)}
                        disabled={isProcessing}
                      />
                    )),
                  ];
                  if (existingImages.length + attachedImages.length < MAX_IMAGES && !isProcessing) {
                    items.push(
                      <TouchableOpacity
                        key="add-more"
                        style={s.addMoreSlot}
                        onPress={handlePickImages}
                        activeOpacity={0.8}>
                        <View style={s.addMoreIcon}>
                          <Text style={{ fontSize: 18, color: Colors.primary, lineHeight: 20 }}>
                            ＋
                          </Text>
                        </View>
                        <Text style={s.addMoreText}>
                          Add more{'\n'}
                          {MAX_IMAGES - existingImages.length - attachedImages.length} left
                        </Text>
                      </TouchableOpacity>,
                    );
                  }
                  const rows: React.ReactNode[] = [];
                  for (let i = 0; i < items.length; i += 2) {
                    rows.push(
                      <View key={i} style={s.imagesRow}>
                        {items[i]}
                        {items[i + 1] ?? <View style={s.imgPlaceholder} />}
                      </View>,
                    );
                  }
                  return rows;
                })()}
              </View>
            )}

            <View style={s.composerFooter}>
              {lastEditedLabel ? (
                <View style={s.draftRow}>
                  <View style={s.draftDot} />
                  <Text style={s.draftText}>{lastEditedLabel}</Text>
                </View>
              ) : (
                <View />
              )}

              <View style={s.charCounter}>
                <View style={s.charRingWrap}>
                  <Svg width="28" height="28">
                    <Circle
                      cx="14"
                      cy="14"
                      r="11"
                      stroke={Colors.border.medium}
                      strokeWidth="2.5"
                      fill="none"
                    />
                    <Circle
                      cx="14"
                      cy="14"
                      r="11"
                      stroke={charColor}
                      strokeWidth="2.5"
                      fill="none"
                      strokeDasharray={`${charProgress * 69.1} 69.1`}
                      strokeLinecap="round"
                      transform="rotate(-90 14 14)"
                    />
                  </Svg>
                  {charCount > MAX_CHARS - 100 && (
                    <Text style={[s.charRingText, isOverLimit && { color: Colors.error }]}>
                      {MAX_CHARS - charCount}
                    </Text>
                  )}
                </View>
                <Text style={[s.charLabel, { color: charColor }]}>{charRemaining}</Text>
              </View>
            </View>
          </View>

          {suggestedTags.length > 0 && (
            <View style={s.hashtagRow}>
              <Text style={s.hashtagLabel}>SUGGESTED</Text>
              {suggestedTags.map(tag => (
                <TouchableOpacity
                  key={tag}
                  style={s.hashtagChip}
                  onPress={() => appendHashtag(tag)}>
                  <Text style={s.hashtagChipText}>{tag}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity
            activeOpacity={0.78}
            onPress={handlePickImages}
            disabled={existingImages.length + attachedImages.length >= MAX_IMAGES || isProcessing}
            style={[
              s.uploadBtn,
              attachedImages.length > 0 && s.uploadBtnHasImages,
              attachedImages.length >= MAX_IMAGES && s.uploadBtnMaxed,
            ]}>
            <LinearGradient
              colors={
                existingImages.length + attachedImages.length >= MAX_IMAGES || isProcessing
                  ? ['#111120', '#111120']
                  : attachedImages.length > 0
                    ? ['rgba(0,229,195,0.12)', 'rgba(124,58,237,0.16)']
                    : ['rgba(124,58,237,0.16)', 'rgba(0,229,195,0.08)']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.uploadBtnInner}>
              <View
                style={[
                  s.uploadIconCircle,
                  attachedImages.length > 0 && {
                    backgroundColor: 'rgba(0,229,195,0.18)',
                    borderColor: 'rgba(0,229,195,0.35)',
                  },
                  (attachedImages.length >= MAX_IMAGES || isProcessing) && {
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    borderColor: 'rgba(255,255,255,0.08)',
                  },
                ]}>
                <ImageIcon
                  size={22}
                  color={
                    attachedImages.length >= MAX_IMAGES || isProcessing
                      ? 'rgba(255,255,255,0.18)'
                      : attachedImages.length > 0
                        ? Colors.accent
                        : Colors.primary
                  }
                />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={[
                    s.uploadBtnTitle,
                    attachedImages.length > 0 && { color: Colors.accent },
                    (attachedImages.length >= MAX_IMAGES || isProcessing) && {
                      color: 'rgba(255,255,255,0.2)',
                    },
                  ]}>
                  {existingImages.length + attachedImages.length >= MAX_IMAGES
                    ? 'Maximum photos attached'
                    : existingImages.length + attachedImages.length > 0
                      ? `${existingImages.length + attachedImages.length} photo${existingImages.length + attachedImages.length > 1 ? 's' : ''} attached`
                      : 'Attach photos'}
                </Text>
                <Text
                  style={[
                    s.uploadBtnSub,
                    (attachedImages.length >= MAX_IMAGES || isProcessing) && {
                      color: 'rgba(255,255,255,0.1)',
                    },
                  ]}>
                  {existingImages.length + attachedImages.length >= MAX_IMAGES
                    ? 'Remove a photo to swap it out'
                    : existingImages.length + attachedImages.length > 0
                      ? `Tap to add more · ${MAX_IMAGES - existingImages.length - attachedImages.length} slot${MAX_IMAGES - existingImages.length - attachedImages.length !== 1 ? 's' : ''} left`
                      : `Open gallery · max ${MAX_IMAGES} photos`}
                </Text>
              </View>
              {attachedImages.length > 0 ? (
                <View
                  style={[
                    s.uploadCountPill,
                    attachedImages.length >= MAX_IMAGES && {
                      backgroundColor: 'rgba(239,68,68,0.15)',
                      borderColor: 'rgba(239,68,68,0.3)',
                    },
                  ]}>
                  <Text
                    style={[
                      s.uploadCountText,
                      attachedImages.length >= MAX_IMAGES && { color: Colors.error },
                    ]}>
                    {attachedImages.length}/{MAX_IMAGES}
                  </Text>
                </View>
              ) : (
                <View style={s.uploadChevron}>
                  <Text style={{ color: Colors.primary, fontSize: 20, lineHeight: 22 }}>›</Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {isProcessing && (
            <View style={s.uploadBanner}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={s.uploadBannerTitle}>{isEditMode ? 'Updating…' : 'Publishing…'}</Text>
                {attachedImages.length > 0 && (
                  <Text style={s.uploadBannerSub}>
                    Uploading {attachedImages.length} image
                    {attachedImages.length > 1 ? 's' : ''} to Cloudinary
                  </Text>
                )}
              </View>
            </View>
          )}

          {isEditMode && (
            <TouchableOpacity
              style={s.deleteBtn}
              onPress={handleDelete}
              activeOpacity={0.85}
              disabled={isProcessing}>
              <View style={s.deleteBtnInner}>
                <Trash2 size={16} color={Colors.error} />
                <Text style={s.deleteBtnText}>Delete Post</Text>
              </View>
            </TouchableOpacity>
          )}

          <View style={{ height: 120 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={s.toolbar}>
        <View style={[s.progressBar, { width: `${charProgress * 100}%` as any }]} />
        <View style={s.toolbarRow}>
          <TouchableOpacity style={s.toolbarIconBtn} onPress={() => setContent(prev => prev + '#')}>
            <Hash size={18} color={Colors.text.secondary} />
          </TouchableOpacity>
          <TouchableOpacity style={s.toolbarIconBtn} onPress={() => setContent(prev => prev + '@')}>
            <AtSign size={18} color={Colors.text.secondary} />
          </TouchableOpacity>
        </View>
      </View>

      {showVisPicker && (
        <VisibilityPicker
          value={visibility}
          onChange={setVisibility}
          onClose={() => setShowVisPicker(false)}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg.secondary, overflow: 'hidden' },

  orb1: {
    position: 'absolute',
    top: -60,
    right: -70,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(124,58,237,0.10)',
  },
  orb2: {
    position: 'absolute',
    bottom: 100,
    left: -80,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(0,229,195,0.06)',
  },

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
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.bg.glass,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.text.primary, letterSpacing: -0.5 },
  submitBtn: { borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.brand },
  submitBtnOff: { ...Shadow.soft },
  submitBtnGrad: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    minWidth: 86,
    alignItems: 'center',
  },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white, letterSpacing: 0.2 },
  submitBtnTextOff: { color: Colors.text.tertiary },

  scrollContent: { paddingBottom: 40 },

  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.accent,
  },
  avatarLetter: { fontSize: 20, fontWeight: '800', color: Colors.white },
  authorMeta: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 },
  authorName: { fontSize: 15, fontWeight: '700', color: Colors.text.primary, letterSpacing: -0.3 },
  verifiedBadge: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
  },
  visPillLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.1 },

  composerBox: {
    marginHorizontal: Spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    marginBottom: 10,
  },
  composerBoxFocused: {
    borderColor: 'rgba(124,58,237,0.45)',
    backgroundColor: 'rgba(124,58,237,0.03)',
  },
  focusAccent: {
    height: 2,
    marginHorizontal: 20,
    borderRadius: 1,
    backgroundColor: 'rgba(124,58,237,0.6)',
  },
  textInput: {
    fontSize: 16,
    color: '#fff',
    lineHeight: 25,
    minHeight: 120,
    padding: 18,
    textAlignVertical: 'top',
  },

  imagesWrap: { marginHorizontal: 14, marginBottom: 8 },
  imagesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  imagesHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: 'rgba(255,255,255,0.3)',
  },
  imagesCount: { fontSize: 11, fontWeight: '700', color: Colors.text.tertiary },
  imagesRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  imgPlaceholder: { flex: 1 },
  addMoreSlot: {
    flex: 1,
    height: CARD_H,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(124,58,237,0.3)',
    backgroundColor: 'rgba(124,58,237,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addMoreIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(124,58,237,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMoreText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(124,58,237,0.8)',
    textAlign: 'center',
  },

  composerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 14,
    paddingTop: 4,
  },
  draftRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  draftDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: Colors.success },
  draftText: { fontSize: 10, color: Colors.text.tertiary, fontWeight: '500' },
  charCounter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  charRingWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  charRingText: {
    position: 'absolute',
    fontSize: 8,
    fontWeight: '800',
    color: Colors.text.tertiary,
  },
  charLabel: { fontSize: 11, fontWeight: '700', minWidth: 34, textAlign: 'right' },

  hashtagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  hashtagLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, color: Colors.text.tertiary },
  hashtagChip: {
    backgroundColor: Colors.bg.glass,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  hashtagChipText: { fontSize: 12, fontWeight: '600', color: Colors.accent },

  uploadBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: Spacing.lg,
    padding: 14,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(124,58,237,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.25)',
    marginBottom: Spacing.md,
  },
  uploadBannerTitle: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  uploadBannerSub: { fontSize: 11, color: Colors.text.tertiary, marginTop: 2 },

  deleteBtn: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(239,68,68,0.3)',
    backgroundColor: 'rgba(239,68,68,0.08)',
    overflow: 'hidden',
  },
  deleteBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  deleteBtnText: { fontSize: 15, fontWeight: '700', color: Colors.error },

  toolbar: {
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
    backgroundColor: Colors.bg.primary,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? 28 : Spacing.sm,
    position: 'relative',
  },
  progressBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 2,
    backgroundColor: Colors.accent,
  },
  toolbarRow: { flexDirection: 'row', gap: Spacing.sm, paddingTop: 6 },

  uploadBtn: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.3)',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  uploadBtnHasImages: { borderColor: 'rgba(0,229,195,0.3)' },
  uploadBtnMaxed: { borderColor: 'rgba(255,255,255,0.06)' },
  uploadBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  uploadIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(124,58,237,0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(124,58,237,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadBtnTitle: { fontSize: 14, fontWeight: '700', color: Colors.primary, letterSpacing: -0.1 },
  uploadBtnSub: { fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.3)', marginTop: 1 },
  uploadCountPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(0,229,195,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0,229,195,0.3)',
  },
  uploadCountText: { fontSize: 12, fontWeight: '800', color: Colors.accent },
  uploadChevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(124,58,237,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  toolbarIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.bg.glass,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const sk = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 40,
  },
  label: { fontSize: 14, fontWeight: '600', color: Colors.text.secondary },
  errorIcon: { fontSize: 40 },
  errorText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  retryText: { fontSize: 14, fontWeight: '700', color: Colors.white },
});
