import React, { useState, useCallback, useEffect } from 'react';
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
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {
  ArrowLeft,
  Camera,
  Check,
  User,
  FileText,
  MapPin,
  Link2,
  Zap,
  AlertTriangle,
} from 'lucide-react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { Colors, Spacing, Radius, Shadow } from '../../../utilities/theme';
import { useUser } from '../../../Hooks/useUser';
import { useProfile } from '../../../Hooks/useProfile';
import { TransparentStatusBar } from '../../../component/common/TransparentStatusBar';

type Props = NativeStackScreenProps<HomeStackParamList, 'EditProfile'>;

function validateFields(fields: { displayName: string; website: string }): string | null {
  if (fields.website.trim() && !/^(https?:\/\/)?[\w\-]+(\.[\w\-]+)+/.test(fields.website.trim())) {
    return 'Please enter a valid website URL.';
  }
  return null;
}

export default function EditProfile({ navigation }: Props) {
  const { user, setUser } = useUser();
  const {
    updating,
    uploadingPhoto,
    avatarProgress,
    updateProfile,
    updateProfileWithPhoto,
    deactivateAccount,
  } = useProfile();

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [location, setLocation] = useState(user?.location ?? '');
  const [website, setWebsite] = useState(user?.website ?? '');
  const [localPhotoURI, setLocalPhotoURI] = useState<string | null>(null); // preview only
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isDirty =
    displayName !== (user?.displayName ?? '') ||
    bio !== (user?.bio ?? '') ||
    location !== (user?.location ?? '') ||
    website !== (user?.website ?? '') ||
    localPhotoURI !== null;

  const handlePickPhoto = useCallback(() => {
    launchImageLibrary(
      { mediaType: 'photo', quality: 0.8, maxWidth: 800, maxHeight: 800 },
      response => {
        if (response.didCancel || response.errorCode) return;
        const asset = response.assets?.[0];
        if (asset?.uri) setLocalPhotoURI(asset.uri);
      },
    );
  }, []);

  const handleSave = useCallback(async () => {
    if (!user?.userId) return;

    const validationError = validateFields({ displayName, website });
    if (validationError) {
      Alert.alert('Invalid Input', validationError);
      return;
    }

    if (!isDirty) {
      navigation.goBack();
      return;
    }

    try {
      const fieldData = { displayName, bio, location, website };

      const updatedUser = localPhotoURI
        ? await updateProfileWithPhoto(user.userId, localPhotoURI, user.photoPublicId, fieldData)
        : await updateProfile(user.userId, fieldData);

      setUser(updatedUser);

      Alert.alert('Success', 'Profile updated successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to update profile. Please try again.');
    }
  }, [user, displayName, bio, location, website, localPhotoURI, isDirty]);

  const handleDeactivate = useCallback(() => {
    Alert.alert(
      'Deactivate Account',
      'Your profile will be hidden from other users. You can reactivate anytime by logging back in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            if (!user?.userId) return;
            try {
              await deactivateAccount(user.userId);
              setUser(undefined);
            } catch (err: any) {
              Alert.alert('Error', err?.message ?? 'Failed to deactivate account.');
            }
          },
        },
      ],
    );
  }, [user]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete Account',
      'This action is permanent and cannot be undone. All your data will be removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you absolutely sure?',
              'Type "DELETE" to confirm. This cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Delete My Account',
                  style: 'destructive',
                  onPress: async () => {
                    Alert.alert(
                      'Request Submitted',
                      'Your account deletion request has been submitted. Your account will be permanently deleted within 24 hours.',
                    );
                  },
                },
              ],
            );
          },
        },
      ],
    );
  }, []);

  const avatarSource = localPhotoURI
    ? { uri: localPhotoURI }
    : user?.photoURL
      ? { uri: user.photoURL }
      : null;

  const isLoading = updating || uploadingPhoto;

  const textFields = [
    {
      key: 'displayName',
      label: 'DISPLAY NAME',
      Icon: User,
      value: displayName,
      setter: setDisplayName,
      maxLength: 50,
      keyboardType: 'default' as const,
      placeholder: 'Your name',
    },
    {
      key: 'location',
      label: 'LOCATION',
      Icon: MapPin,
      value: location,
      setter: setLocation,
      maxLength: 80,
      keyboardType: 'default' as const,
      placeholder: 'City, Country',
    },
    {
      key: 'website',
      label: 'WEBSITE',
      Icon: Link2,
      value: website,
      setter: setWebsite,
      maxLength: 100,
      keyboardType: 'url' as const,
      placeholder: 'yoursite.com',
      autoCapitalize: 'none' as const,
    },
  ];

  return (
    <View style={styles.root}>
      <TransparentStatusBar />
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (isDirty) {
              Alert.alert(
                'Discard Changes?',
                'You have unsaved changes. Are you sure you want to leave?',
                [
                  { text: 'Stay', style: 'cancel' },
                  { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
                ],
              );
            } else {
              navigation.goBack();
            }
          }}>
          <ArrowLeft size={20} color={Colors.text.secondary} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Edit Profile</Text>

        <TouchableOpacity
          style={[styles.saveBtn, (!isDirty || isLoading) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={isLoading}
          activeOpacity={0.85}>
          <LinearGradient colors={['#7C3AED', '#9D6FFF']} style={styles.saveBtnGrad}>
            {isLoading ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                <Check size={16} color={Colors.white} />
                <Text style={styles.saveBtnText}>Save</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {uploadingPhoto && (
        <View style={styles.uploadBanner}>
          <ActivityIndicator size="small" color={Colors.accent} />
          <Text style={styles.uploadBannerText}>
            {avatarProgress?.progress != null && avatarProgress.progress < 100
              ? `Uploading photo… ${avatarProgress.progress}%`
              : 'Uploading photo…'}
          </Text>
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <View style={styles.avatarSection}>
            <View style={styles.avatarWrapper}>
              <LinearGradient colors={['#7C3AED', '#00E5C3']} style={styles.avatarRing}>
                <View style={styles.avatar}>
                  {avatarSource ? (
                    <Image source={avatarSource} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarText}>
                      {(user?.displayName ?? 'U').charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>
              </LinearGradient>

              <TouchableOpacity
                style={styles.cameraBtn}
                activeOpacity={0.8}
                onPress={handlePickPhoto}>
                <LinearGradient colors={['#7C3AED', '#9D6FFF']} style={styles.cameraBtnGrad}>
                  {uploadingPhoto ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Camera size={16} color={Colors.white} />
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={handlePickPhoto}>
              <Text style={styles.changeAvatarText}>Change profile photo</Text>
            </TouchableOpacity>
            {localPhotoURI && <Text style={styles.photoHint}>Photo selected — save to apply</Text>}
          </View>

          <View style={styles.formCard}>
            <LinearGradient
              colors={['rgba(124,58,237,0.07)', 'rgba(0,229,195,0.03)']}
              style={styles.formCardGrad}>
              {textFields.map(
                ({
                  key,
                  label,
                  Icon,
                  value,
                  setter,
                  maxLength,
                  keyboardType,
                  placeholder,
                  autoCapitalize,
                }) => (
                  <View key={key} style={styles.fieldWrapper}>
                    <Text style={styles.fieldLabel}>{label}</Text>
                    <View
                      style={[
                        styles.inputContainer,
                        focusedField === key && styles.inputFocused,
                        errors[key] ? styles.inputError : null,
                      ]}>
                      <View style={styles.inputIcon}>
                        <Icon
                          size={16}
                          color={
                            errors[key]
                              ? Colors.error
                              : focusedField === key
                                ? Colors.accent
                                : Colors.text.tertiary
                          }
                        />
                      </View>
                      <TextInput
                        style={styles.input}
                        value={value}
                        onChangeText={text => {
                          setter(text);
                          if (errors[key]) setErrors(e => ({ ...e, [key]: '' }));
                        }}
                        onFocus={() => setFocusedField(key)}
                        onBlur={() => setFocusedField(null)}
                        maxLength={maxLength}
                        keyboardType={keyboardType}
                        autoCapitalize={autoCapitalize ?? 'sentences'}
                        selectionColor={Colors.accent}
                        placeholderTextColor={Colors.text.tertiary}
                        placeholder={placeholder}
                        editable={!isLoading}
                      />
                      {value.length > 0 && (
                        <Text
                          style={[
                            styles.charCount,
                            maxLength - value.length < 10 && { color: Colors.warning },
                          ]}>
                          {maxLength - value.length}
                        </Text>
                      )}
                    </View>
                    {!!errors[key] && <Text style={styles.errorText}>{errors[key]}</Text>}
                  </View>
                ),
              )}

              <View style={styles.fieldWrapper}>
                <Text style={styles.fieldLabel}>EMAIL</Text>
                <View style={styles.inputContainer}>
                  <View style={styles.inputIcon}>
                    <User size={16} color={Colors.text.tertiary} />
                  </View>
                  <Text style={styles.readOnlyInput} numberOfLines={1}>
                    {user?.email ?? '—'}
                  </Text>
                  {user?.emailVerified && (
                    <View style={styles.verifiedBadgeInline}>
                      <Check size={10} color={Colors.accent} />
                      <Text style={styles.verifiedText}>Verified</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.fieldWrapper}>
                <View style={styles.bioLabelRow}>
                  <Text style={styles.fieldLabel}>BIO</Text>
                  <Text
                    style={[styles.bioCharCount, bio.length > 130 && { color: Colors.warning }]}>
                    {150 - bio.length}
                  </Text>
                </View>
                <View style={[styles.bioContainer, focusedField === 'bio' && styles.inputFocused]}>
                  <View style={styles.bioIconTop}>
                    <FileText
                      size={16}
                      color={focusedField === 'bio' ? Colors.accent : Colors.text.tertiary}
                    />
                  </View>
                  <TextInput
                    style={styles.bioInput}
                    value={bio}
                    onChangeText={setBio}
                    onFocus={() => setFocusedField('bio')}
                    onBlur={() => setFocusedField(null)}
                    multiline
                    maxLength={150}
                    placeholder="Tell the world about yourself…"
                    placeholderTextColor={Colors.text.tertiary}
                    textAlignVertical="top"
                    selectionColor={Colors.accent}
                    editable={!isLoading}
                  />
                </View>
              </View>
            </LinearGradient>
          </View>

          <View style={styles.readOnlyCard}>
            <View style={[styles.readOnlyRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.readOnlyLabel}>Member since</Text>
              <Text style={styles.readOnlyValue}>
                {user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString('en-US', {
                      month: 'long',
                      year: 'numeric',
                    })
                  : '—'}
              </Text>
            </View>
          </View>

          <View style={styles.dangerSection}>
            <Text style={styles.dangerTitle}>ACCOUNT ACTIONS</Text>

            <TouchableOpacity
              style={styles.dangerBtn}
              onPress={handleDeactivate}
              activeOpacity={0.75}>
              <View style={styles.dangerBtnInner}>
                <View style={styles.dangerIcon}>
                  <Zap size={16} color={Colors.warning} />
                </View>
                <View style={styles.dangerInfo}>
                  <Text style={styles.dangerLabel}>Deactivate Account</Text>
                  <Text style={styles.dangerDesc}>Temporarily disable your profile</Text>
                </View>
                <AlertTriangle size={16} color={Colors.warning} style={{ opacity: 0.6 }} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dangerBtn, styles.dangerBtnDelete]}
              onPress={handleDelete}
              activeOpacity={0.75}>
              <View style={styles.dangerBtnInner}>
                <View style={[styles.dangerIcon, styles.dangerIconDelete]}>
                  <Text style={{ fontSize: 16 }}>🗑️</Text>
                </View>
                <View style={styles.dangerInfo}>
                  <Text style={[styles.dangerLabel, { color: Colors.error }]}>Delete Account</Text>
                  <Text style={styles.dangerDesc}>Permanently remove your account</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    bottom: 200,
    left: -60,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(0,229,195,0.07)',
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
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: -0.3,
  },
  saveBtn: {
    borderRadius: Radius.full,
    overflow: 'hidden',
    ...Shadow.brand,
  },
  saveBtnDisabled: { opacity: 0.55 },
  saveBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    gap: 5,
    minWidth: 72,
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },

  uploadBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,229,195,0.08)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,229,195,0.15)',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 8,
    gap: Spacing.sm,
  },
  uploadBannerText: {
    fontSize: 13,
    color: Colors.accent,
    fontWeight: '600',
  },

  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: 60,
  },

  avatarSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: Spacing.md,
  },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    padding: 3,
    ...Shadow.brand,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#1A0A2E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.bg.primary,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 45,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.primaryLight,
  },
  cameraBtn: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.bg.primary,
    ...Shadow.brand,
  },
  cameraBtnGrad: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.accent,
  },
  photoHint: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.text.tertiary,
    fontStyle: 'italic',
  },

  formCard: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    marginBottom: Spacing.lg,
    ...Shadow.soft,
  },
  formCardGrad: { padding: Spacing.lg },
  fieldWrapper: { marginBottom: Spacing.md },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.8,
    color: Colors.text.tertiary,
    marginBottom: Spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.glass,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    height: 52,
    paddingHorizontal: 4,
  },
  inputFocused: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(0,229,195,0.05)',
  },
  inputError: {
    borderColor: Colors.error,
    backgroundColor: 'rgba(239,68,68,0.04)',
  },
  inputIcon: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputPrefix: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.tertiary,
    marginRight: 2,
  },
  input: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: 15,
    fontWeight: '500',
    height: '100%',
  },
  charCount: {
    fontSize: 11,
    color: Colors.text.tertiary,
    fontWeight: '600',
    paddingRight: Spacing.sm,
  },
  errorText: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.error,
    fontWeight: '500',
  },

  readOnlyInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: Colors.text.tertiary,
    paddingRight: Spacing.sm,
  },
  verifiedBadgeInline: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,229,195,0.12)',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: Spacing.sm,
    gap: 4,
  },

  bioLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  bioCharCount: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.tertiary,
  },
  bioContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.bg.glass,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    padding: 4,
    minHeight: 100,
  },
  bioIconTop: {
    width: 40,
    paddingTop: 14,
    alignItems: 'center',
  },
  bioInput: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    paddingTop: 10,
    paddingRight: Spacing.sm,
    minHeight: 90,
  },

  readOnlyCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    backgroundColor: Colors.bg.glass,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  readOnlyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
    gap: 8,
  },
  readOnlyLabel: {
    fontSize: 13,
    color: Colors.text.tertiary,
    fontWeight: '600',
    width: 110,
  },
  readOnlyValue: {
    flex: 1,
    fontSize: 14,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,229,195,0.12)',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  verifiedText: {
    fontSize: 11,
    color: Colors.accent,
    fontWeight: '700',
  },

  dangerSection: { marginBottom: Spacing.xl },
  dangerTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.8,
    color: Colors.text.tertiary,
    marginBottom: Spacing.md,
  },
  dangerBtn: {
    backgroundColor: Colors.bg.glass,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  dangerBtnDelete: {
    borderColor: 'rgba(239,68,68,0.2)',
    backgroundColor: 'rgba(239,68,68,0.04)',
  },
  dangerBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  dangerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(245,158,11,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerIconDelete: {
    backgroundColor: 'rgba(239,68,68,0.15)',
  },
  dangerInfo: { flex: 1 },
  dangerLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.warning,
    marginBottom: 2,
  },
  dangerDesc: {
    fontSize: 12,
    color: Colors.text.tertiary,
  },
});
