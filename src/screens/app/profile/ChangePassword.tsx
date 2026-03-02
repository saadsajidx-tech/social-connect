import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { HomeStackParamList } from '../../../navigation/HomeNavigator';
import LinearGradient from 'react-native-linear-gradient';
import { ArrowLeft, Lock, Eye, EyeOff, KeyRound, Check } from 'lucide-react-native';
import { Colors, Spacing, Radius, Shadow } from '../../../utilities/theme';
import { TransparentStatusBar } from '../../../component/common/TransparentStatusBar';
import {
  getAuth,
  reauthenticateWithCredential,
  updatePassword,
  EmailAuthProvider,
} from '@react-native-firebase/auth';
import { useFormik } from 'formik';
import * as Yup from 'yup';

const ChangePasswordSchema = Yup.object().shape({
  currentPassword: Yup.string().required('Current password is required'),
  newPassword: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .matches(/[A-Z]/, 'Include at least one uppercase letter')
    .matches(/[0-9]/, 'Include at least one number')
    .required('New password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('newPassword')], 'Passwords do not match')
    .required('Please confirm your new password'),
});

const StrengthBar = ({ password }: { password: string }) => {
  if (!password) return null;

  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const barColors = ['#EF4444', '#F59E0B', '#10B981', '#00E5C3'];
  const labels = ['Weak', 'Fair', 'Good', 'Strong'];

  return (
    <View style={strengthStyles.wrapper}>
      <View style={strengthStyles.bars}>
        {[0, 1, 2, 3].map(i => (
          <View
            key={i}
            style={[
              strengthStyles.bar,
              { backgroundColor: i < score ? barColors[score - 1] : Colors.border.subtle },
            ]}
          />
        ))}
      </View>
      <Text style={[strengthStyles.label, { color: barColors[score - 1] }]}>
        {labels[score - 1]}
      </Text>
    </View>
  );
};

const strengthStyles = StyleSheet.create({
  wrapper: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
  bars: { flex: 1, flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 3, borderRadius: 1.5 },
  label: { fontSize: 11, fontWeight: '700', minWidth: 40 },
});

type Props = NativeStackScreenProps<HomeStackParamList, 'ChangePassword'>;

export default function ChangePassword({ navigation }: Props) {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const formik = useFormik({
    initialValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    validationSchema: ChangePasswordSchema,
    validateOnChange: true,
    validateOnBlur: true,
    onSubmit: async values => {
      try {
        const auth = getAuth();
        const currentUser = auth.currentUser;

        if (!currentUser || !currentUser.email) {
          Alert.alert('Error', 'No authenticated user found. Please sign in again.');
          return;
        }

        const credential = EmailAuthProvider.credential(currentUser.email, values.currentPassword);
        await reauthenticateWithCredential(currentUser, credential);

        await updatePassword(currentUser, values.newPassword);

        Alert.alert('✓ Password Updated', 'Your password has been changed successfully.', [
          { text: 'OK', onPress: () => navigation?.goBack() },
        ]);
      } catch (error: any) {
        if (error?.code === 'auth/wrong-password' || error?.code === 'auth/invalid-credential') {
          formik.setFieldError('currentPassword', 'Incorrect current password');
        } else if (error?.code === 'auth/too-many-requests') {
          Alert.alert('Too Many Attempts', 'Please wait a moment and try again.');
        } else if (error?.code === 'auth/requires-recent-login') {
          Alert.alert(
            'Session Expired',
            'Please sign out and sign in again before changing your password.',
          );
        } else if (error?.code === 'auth/weak-password') {
          formik.setFieldError('newPassword', 'Password is too weak.');
        } else {
          Alert.alert('Error', 'Failed to update password. Please try again.');
        }
      }
    },
  });

  const currentError = formik.touched.currentPassword && formik.errors.currentPassword;
  const newError = formik.touched.newPassword && formik.errors.newPassword;
  const confirmError = formik.touched.confirmPassword && formik.errors.confirmPassword;

  const passwordsMatch =
    formik.values.confirmPassword.length > 0 &&
    formik.values.confirmPassword === formik.values.newPassword;

  return (
    <View style={styles.root}>
      <TransparentStatusBar />
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack()}>
          <ArrowLeft size={20} color={Colors.text.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Change Password</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <View style={styles.headerBlock}>
          <View style={styles.headerGlow} />
          <LinearGradient
            colors={['#7C3AED', '#00E5C3']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerIconRing}>
            <KeyRound size={24} color={Colors.white} />
          </LinearGradient>
          <Text style={styles.headerBlockTitle}>Change Password</Text>
          <Text style={styles.headerBlockDesc}>
            Confirm who you are, then set a new password for your account.
          </Text>
          <LinearGradient
            colors={['transparent', 'rgba(124,58,237,0.4)', 'rgba(0,229,195,0.3)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.headerDivider}
          />
        </View>

        <View style={styles.formCard}>
          <LinearGradient
            colors={['rgba(124,58,237,0.07)', 'rgba(0,229,195,0.03)']}
            style={styles.formGrad}>
            <View style={styles.fieldWrapper}>
              <Text style={styles.fieldLabel}>CURRENT PASSWORD</Text>
              <View
                style={[
                  styles.inputContainer,
                  focusedField === 'currentPassword' && styles.inputContainerFocused,
                  !!currentError && styles.inputContainerError,
                ]}>
                <View style={styles.inputIcon}>
                  <Lock
                    size={16}
                    color={
                      currentError
                        ? Colors.error
                        : focusedField === 'currentPassword'
                          ? Colors.accent
                          : Colors.text.tertiary
                    }
                  />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Enter current password"
                  placeholderTextColor={Colors.text.tertiary}
                  value={formik.values.currentPassword}
                  onChangeText={formik.handleChange('currentPassword')}
                  onFocus={() => setFocusedField('currentPassword')}
                  onBlur={e => {
                    setFocusedField(null);
                    formik.handleBlur('currentPassword')(e);
                  }}
                  secureTextEntry={!showCurrent}
                  selectionColor={Colors.accent}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowCurrent(s => !s)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  {showCurrent ? (
                    <Eye size={16} color={Colors.text.tertiary} />
                  ) : (
                    <EyeOff size={16} color={Colors.text.tertiary} />
                  )}
                </TouchableOpacity>
              </View>
              {currentError ? <Text style={styles.fieldError}>{currentError}</Text> : null}
            </View>

            <View style={styles.sectionDivider} />

            <View style={styles.fieldWrapper}>
              <Text style={styles.fieldLabel}>NEW PASSWORD</Text>
              <View
                style={[
                  styles.inputContainer,
                  focusedField === 'newPassword' && styles.inputContainerFocused,
                  !!newError && styles.inputContainerError,
                ]}>
                <View style={styles.inputIcon}>
                  <Lock
                    size={16}
                    color={
                      newError
                        ? Colors.error
                        : focusedField === 'newPassword'
                          ? Colors.accent
                          : Colors.text.tertiary
                    }
                  />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Create new password"
                  placeholderTextColor={Colors.text.tertiary}
                  value={formik.values.newPassword}
                  onChangeText={formik.handleChange('newPassword')}
                  onFocus={() => setFocusedField('newPassword')}
                  onBlur={e => {
                    setFocusedField(null);
                    formik.handleBlur('newPassword')(e);
                  }}
                  secureTextEntry={!showNew}
                  selectionColor={Colors.accent}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowNew(s => !s)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  {showNew ? (
                    <Eye size={16} color={Colors.text.tertiary} />
                  ) : (
                    <EyeOff size={16} color={Colors.text.tertiary} />
                  )}
                </TouchableOpacity>
              </View>
              {newError ? <Text style={styles.fieldError}>{newError}</Text> : null}
              <StrengthBar password={formik.values.newPassword} />
            </View>

            <View style={[styles.fieldWrapper, { marginBottom: 0 }]}>
              <Text style={styles.fieldLabel}>CONFIRM NEW PASSWORD</Text>
              <View
                style={[
                  styles.inputContainer,
                  focusedField === 'confirmPassword' && styles.inputContainerFocused,
                  !!confirmError && styles.inputContainerError,
                ]}>
                <View style={styles.inputIcon}>
                  <Lock
                    size={16}
                    color={
                      confirmError
                        ? Colors.error
                        : focusedField === 'confirmPassword'
                          ? Colors.accent
                          : Colors.text.tertiary
                    }
                  />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Re-enter new password"
                  placeholderTextColor={Colors.text.tertiary}
                  value={formik.values.confirmPassword}
                  onChangeText={formik.handleChange('confirmPassword')}
                  onFocus={() => setFocusedField('confirmPassword')}
                  onBlur={e => {
                    setFocusedField(null);
                    formik.handleBlur('confirmPassword')(e);
                  }}
                  secureTextEntry={!showConfirm}
                  selectionColor={Colors.accent}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowConfirm(s => !s)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  {showConfirm ? (
                    <Eye size={16} color={Colors.text.tertiary} />
                  ) : (
                    <EyeOff size={16} color={Colors.text.tertiary} />
                  )}
                </TouchableOpacity>
              </View>
              {confirmError ? (
                <Text style={styles.fieldError}>{confirmError}</Text>
              ) : passwordsMatch ? (
                <View style={styles.matchRow}>
                  <Check size={13} color={Colors.success} strokeWidth={3} />
                  <Text style={styles.matchText}>Passwords match</Text>
                </View>
              ) : null}
            </View>
          </LinearGradient>
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, !formik.isValid && styles.submitBtnDisabled]}
          onPress={() => formik.handleSubmit()}
          disabled={formik.isSubmitting}
          activeOpacity={0.85}>
          <LinearGradient
            colors={
              formik.isValid
                ? ['#7C3AED', '#9D6FFF', '#00E5C3']
                : [Colors.bg.tertiary, Colors.bg.tertiary]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.submitGrad}>
            {formik.isSubmitting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <KeyRound size={16} color={formik.isValid ? Colors.white : Colors.text.tertiary} />
                <Text style={[styles.submitText, !formik.isValid && styles.submitTextDisabled]}>
                  Update Password
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg.secondary,
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
    backgroundColor: 'rgba(124,58,237,0.10)',
  },
  orb2: {
    position: 'absolute',
    bottom: 300,
    left: -70,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(0,229,195,0.06)',
  },

  // ── Header
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text.primary,
    letterSpacing: -0.5,
  },

  scrollContent: {
    paddingBottom: 20,
    paddingTop: Spacing.lg,
  },

  headerBlock: {
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  headerGlow: {
    position: 'absolute',
    top: 10,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(124,58,237,0.18)',
  },
  headerIconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    ...Shadow.brand,
  },
  headerBlockTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text.primary,
    letterSpacing: -0.8,
    marginBottom: 8,
    textAlign: 'center',
  },
  headerBlockDesc: {
    fontSize: 14,
    color: Colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
  },
  headerDivider: {
    height: 1,
    width: '80%',
    borderRadius: 1,
  },

  formCard: {
    marginHorizontal: Spacing.lg,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    ...Shadow.soft,
  },
  formGrad: { padding: Spacing.lg },

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
  inputContainerFocused: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(0,229,195,0.05)',
  },
  inputContainerError: {
    borderColor: Colors.error,
    backgroundColor: 'rgba(239,68,68,0.04)',
  },
  inputIcon: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: 15,
    fontWeight: '500',
    height: '100%',
  },
  eyeBtn: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldError: {
    color: Colors.error,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
    marginLeft: 2,
  },

  sectionDivider: {
    height: 1,
    backgroundColor: Colors.border.subtle,
    marginBottom: Spacing.md,
  },

  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  matchText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.success,
  },

  submitBtn: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Shadow.brand,
  },
  submitBtnDisabled: {
    ...Shadow.soft,
  },
  submitGrad: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: 0.2,
  },
  submitTextDisabled: {
    color: Colors.text.tertiary,
  },
});
