import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';

import React, { useState } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  ArrowRight,
  ArrowLeft,
  Check,
  Shield,
  Sparkles,
} from 'lucide-react-native';
import { Colors, Spacing, Radius, Shadow } from '../../utilities/theme';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useAuth } from '../../Hooks/useAuth';
import { TransparentStatusBar } from '../../component/common/TransparentStatusBar';

const { height } = Dimensions.get('window');
type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

const SignUpSchema = Yup.object().shape({
  name: Yup.string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .required('Full name is required'),
  email: Yup.string()
    .trim()
    .email('Please enter a valid email address')
    .required('Email is required'),
  password: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .matches(/[A-Z]/, 'Must include at least one uppercase letter')
    .matches(/[0-9]/, 'Must include at least one number')
    .matches(/[^A-Za-z0-9]/, 'Must include at least one special character')
    .required('Password is required'),
  confirm: Yup.string()
    .oneOf([Yup.ref('password')], 'Passwords do not match')
    .required('Please confirm your password'),
});

const PasswordStrength = ({ password }: { password: string }) => {
  const getStrength = () => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  };
  const score = getStrength();
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const barColors = ['#EF4444', '#F59E0B', '#10B981', '#00E5C3'];

  if (!password) return null;
  return (
    <View style={strengthStyles.container}>
      <View style={strengthStyles.bars}>
        {[0, 1, 2, 3].map(i => (
          <View
            key={i}
            style={[strengthStyles.bar, i < score && { backgroundColor: barColors[score - 1] }]}
          />
        ))}
      </View>
      {score > 0 && (
        <Text style={[strengthStyles.label, { color: barColors[score - 1] }]}>{labels[score]}</Text>
      )}
    </View>
  );
};

const strengthStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  bars: { flexDirection: 'row', gap: 4, flex: 1 },
  bar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.border.subtle,
  },
  label: { fontSize: 11, fontWeight: '600', marginLeft: 8, minWidth: 40 },
});

export default function SignUp({ navigation }: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [agreedTouched, setAgreedTouched] = useState(false);

  const { signUp, loading, error, clearError } = useAuth();

  const formik = useFormik({
    initialValues: { name: '', email: '', password: '', confirm: '' },
    validationSchema: SignUpSchema,
    validateOnChange: true,
    validateOnBlur: true,
    onSubmit: async values => {
      setAgreedTouched(true);
      if (!agreed) return;
      clearError();
      await signUp({ name: values.name, email: values.email, password: values.password });
    },
  });

  const err = (field: keyof typeof formik.values) =>
    formik.touched[field] ? formik.errors[field] : undefined;

  return (
    <View style={styles.root}>
      <TransparentStatusBar />

      <View style={styles.orb1} />
      <View style={styles.orb2} />
      <View style={styles.orb3} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack()}>
            <ArrowLeft size={20} color={Colors.text.secondary} />
          </TouchableOpacity>

          <View style={styles.header}>
            <LinearGradient
              colors={['#7C3AED', '#00E5C3']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sparkleIcon}>
              <Sparkles size={22} color={Colors.white} />
            </LinearGradient>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join the conversation today</Text>
          </View>

          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.formCard}>
            <LinearGradient
              colors={['rgba(124,58,237,0.08)', 'rgba(0,229,195,0.03)']}
              style={styles.formCardGradient}>
              <View style={styles.fieldWrapper}>
                <Text style={styles.fieldLabel}>FULL NAME</Text>
                <View
                  style={[
                    styles.inputContainer,
                    focusedField === 'name' && styles.inputFocused,
                    !!err('name') && styles.inputError,
                  ]}>
                  <View style={styles.inputIcon}>
                    <User
                      size={16}
                      color={
                        focusedField === 'name'
                          ? Colors.accent
                          : err('name')
                            ? Colors.error
                            : Colors.text.tertiary
                      }
                    />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="John Doe"
                    placeholderTextColor={Colors.text.tertiary}
                    value={formik.values.name}
                    onChangeText={formik.handleChange('name')}
                    onFocus={() => setFocusedField('name')}
                    onBlur={e => {
                      setFocusedField(null);
                      formik.handleBlur('name')(e);
                    }}
                    autoCapitalize="words"
                    selectionColor={Colors.accent}
                  />
                  {formik.values.name.length > 0 && !err('name') && (
                    <View style={styles.checkBadge}>
                      <Check size={10} color={Colors.accent} />
                    </View>
                  )}
                </View>
                {err('name') ? <Text style={styles.fieldError}>{err('name')}</Text> : null}
              </View>

              <View style={styles.fieldWrapper}>
                <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
                <View
                  style={[
                    styles.inputContainer,
                    focusedField === 'email' && styles.inputFocused,
                    !!err('email') && styles.inputError,
                  ]}>
                  <View style={styles.inputIcon}>
                    <Mail
                      size={16}
                      color={
                        focusedField === 'email'
                          ? Colors.accent
                          : err('email')
                            ? Colors.error
                            : Colors.text.tertiary
                      }
                    />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="you@example.com"
                    placeholderTextColor={Colors.text.tertiary}
                    value={formik.values.email}
                    onChangeText={formik.handleChange('email')}
                    onFocus={() => setFocusedField('email')}
                    onBlur={e => {
                      setFocusedField(null);
                      formik.handleBlur('email')(e);
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    selectionColor={Colors.accent}
                  />
                  {formik.values.email.length > 0 && !err('email') && (
                    <View style={styles.checkBadge}>
                      <Check size={10} color={Colors.accent} />
                    </View>
                  )}
                </View>
                {err('email') ? <Text style={styles.fieldError}>{err('email')}</Text> : null}
              </View>

              <View style={styles.fieldWrapper}>
                <Text style={styles.fieldLabel}>PASSWORD</Text>
                <View
                  style={[
                    styles.inputContainer,
                    focusedField === 'password' && styles.inputFocused,
                    !!err('password') && styles.inputError,
                  ]}>
                  <View style={styles.inputIcon}>
                    <Lock
                      size={16}
                      color={
                        focusedField === 'password'
                          ? Colors.accent
                          : err('password')
                            ? Colors.error
                            : Colors.text.tertiary
                      }
                    />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Min. 8 characters"
                    placeholderTextColor={Colors.text.tertiary}
                    value={formik.values.password}
                    onChangeText={formik.handleChange('password')}
                    onFocus={() => setFocusedField('password')}
                    onBlur={e => {
                      setFocusedField(null);
                      formik.handleBlur('password')(e);
                    }}
                    secureTextEntry={!showPassword}
                    selectionColor={Colors.accent}
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowPassword(!showPassword)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    {showPassword ? (
                      <Eye size={16} color={Colors.text.tertiary} />
                    ) : (
                      <EyeOff size={16} color={Colors.text.tertiary} />
                    )}
                  </TouchableOpacity>
                </View>
                <PasswordStrength password={formik.values.password} />
                {err('password') ? <Text style={styles.fieldError}>{err('password')}</Text> : null}
              </View>

              <View style={styles.fieldWrapper}>
                <Text style={styles.fieldLabel}>CONFIRM PASSWORD</Text>
                <View
                  style={[
                    styles.inputContainer,
                    focusedField === 'confirm' && styles.inputFocused,
                    !!err('confirm') && styles.inputError,
                  ]}>
                  <View style={styles.inputIcon}>
                    <Lock
                      size={16}
                      color={
                        focusedField === 'confirm'
                          ? Colors.accent
                          : err('confirm')
                            ? Colors.error
                            : Colors.text.tertiary
                      }
                    />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Re-enter password"
                    placeholderTextColor={Colors.text.tertiary}
                    value={formik.values.confirm}
                    onChangeText={formik.handleChange('confirm')}
                    onFocus={() => setFocusedField('confirm')}
                    onBlur={e => {
                      setFocusedField(null);
                      formik.handleBlur('confirm')(e);
                    }}
                    secureTextEntry={!showConfirm}
                    selectionColor={Colors.accent}
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowConfirm(!showConfirm)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    {showConfirm ? (
                      <Eye size={16} color={Colors.text.tertiary} />
                    ) : (
                      <EyeOff size={16} color={Colors.text.tertiary} />
                    )}
                  </TouchableOpacity>
                </View>
                {formik.values.confirm.length > 0 && (
                  <Text
                    style={[
                      styles.matchText,
                      {
                        color:
                          formik.values.confirm === formik.values.password
                            ? Colors.success
                            : Colors.error,
                      },
                    ]}>
                    {formik.values.confirm === formik.values.password
                      ? '✓ Passwords match'
                      : '✗ Passwords do not match'}
                  </Text>
                )}
                {err('confirm') ? <Text style={styles.fieldError}>{err('confirm')}</Text> : null}
              </View>
            </LinearGradient>
          </View>

          <TouchableOpacity
            style={styles.termsRow}
            onPress={() => {
              setAgreed(!agreed);
              setAgreedTouched(true);
            }}
            activeOpacity={0.8}>
            <View
              style={[
                styles.checkbox,
                agreed && styles.checkboxActive,
                agreedTouched && !agreed && styles.checkboxError,
              ]}>
              {agreed && <Check size={12} color={Colors.white} />}
            </View>
            <Text style={styles.termsText}>
              I agree to the <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
              <Text style={styles.termsLink}>Privacy Policy</Text>
            </Text>
          </TouchableOpacity>
          {agreedTouched && !agreed && (
            <Text style={styles.fieldError}>You must agree to continue</Text>
          )}

          <View style={styles.privacyNote}>
            <Shield size={14} color={Colors.success} />
            <Text style={styles.privacyText}>Your data is encrypted and never sold</Text>
          </View>

          <TouchableOpacity
            style={styles.createBtnWrapper}
            activeOpacity={0.85}
            onPress={() => {
              setAgreedTouched(true);
              formik.handleSubmit();
            }}
            disabled={loading}>
            <LinearGradient
              colors={['#7C3AED', '#9D6FFF', '#00E5C3']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.createBtn}>
              {loading ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <>
                  <Text style={styles.createBtnText}>Create Account</Text>
                  <View style={styles.arrowCircle}>
                    <ArrowRight size={18} color={Colors.primary} />
                  </View>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.signInRow}>
            <Text style={styles.signInLabel}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation?.navigate('SignIn')}>
              <Text style={styles.signInLink}>Sign in</Text>
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: 56,
    paddingBottom: 40,
  },

  orb1: {
    position: 'absolute',
    top: -60,
    left: -80,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(124,58,237,0.16)',
  },
  orb2: {
    position: 'absolute',
    bottom: height * 0.2,
    right: -90,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(0,229,195,0.09)',
  },
  orb3: {
    position: 'absolute',
    top: height * 0.5,
    left: 20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(124,58,237,0.14)',
  },

  // Back Button
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.bg.glass,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },

  // Header
  header: {
    marginBottom: Spacing.xl,
  },
  sparkleIcon: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    ...Shadow.brand,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: Colors.text.primary,
    letterSpacing: -1.2,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.text.tertiary,
    marginTop: 6,
  },

  errorBanner: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    paddingHorizontal: 4,
    paddingVertical: 3,
    marginBottom: 4,
  },
  errorBannerText: { color: Colors.error, fontSize: 13, fontWeight: '500', textAlign: 'center' },

  // Form Card
  formCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    overflow: 'hidden',
    marginBottom: Spacing.md,
    ...Shadow.soft,
  },
  formCardGradient: {
    padding: Spacing.lg,
  },
  fieldWrapper: {
    marginBottom: Spacing.md,
  },
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
  checkBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,229,195,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  fieldError: {
    color: Colors.error,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
    marginLeft: 2,
  },
  matchText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },

  // Terms
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
    paddingHorizontal: 2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
    marginTop: 1,
  },
  checkboxActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkboxError: { borderColor: Colors.error },

  termsText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text.tertiary,
    lineHeight: 20,
  },
  termsLink: {
    color: Colors.primaryLight,
    fontWeight: '600',
  },

  // Privacy Note
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.2)',
    padding: Spacing.sm,
    marginBottom: Spacing.lg,
    gap: 8,
  },
  privacyText: {
    fontSize: 12,
    color: Colors.success,
    fontWeight: '500',
  },

  // Create Button
  createBtnWrapper: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Shadow.brand,
    marginBottom: Spacing.lg,
  },
  createBtn: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  createBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: 0.3,
    marginRight: Spacing.sm,
  },
  arrowCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Sign In
  signInRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signInLabel: {
    fontSize: 14,
    color: Colors.text.tertiary,
  },
  signInLink: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.accent,
  },
});
