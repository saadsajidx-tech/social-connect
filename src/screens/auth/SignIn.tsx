import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';

import React, { useRef, useState } from 'react';
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
  Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Eye, EyeOff, Mail, Lock, ArrowRight, Zap } from 'lucide-react-native';
import { Colors, Spacing, Radius, Shadow, Typography } from '../../utilities/theme';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useAuth } from '../../Hooks/useAuth';
import { images } from '../../assets/images';
import { TransparentStatusBar } from '../../component/common/TransparentStatusBar';

const { width, height } = Dimensions.get('window');
type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

const SignInSchema = Yup.object().shape({
  email: Yup.string()
    .trim()
    .email('Please enter a valid email address')
    .required('Email is required'),
  password: Yup.string()
    .min(6, 'Password must be at least 6 characters')
    .required('Password is required'),
});

export default function SignIn({ navigation }: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const { signIn, signInWithGoogle, loading, googleLoginLoading, error, clearError } = useAuth();

  const formik = useFormik({
    initialValues: { email: '', password: '' },
    validationSchema: SignInSchema,
    validateOnChange: true,
    validateOnBlur: true,
    onSubmit: async values => {
      clearError();
      await signIn({ email: values.email, password: values.password });
    },
  });

  const handleGoogleSignIn = async () => {
    clearError();
    await signInWithGoogle();
  };

  const emailError = formik.touched.email && formik.errors.email;
  const passwordError = formik.touched.password && formik.errors.password;
  console.log('hello world, delete me');

  return (
    <View style={styles.root}>
      <TransparentStatusBar />

      <View style={styles.orb1} />
      <View style={styles.orb2} />
      <View style={styles.orb3} />

      <View style={styles.dotGrid} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <View style={styles.logoSection}>
            <LinearGradient
              colors={['#7C3AED', '#00E5C3']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoGradient}>
              <Zap size={28} color={Colors.white} fill={Colors.white} />
            </LinearGradient>
            <Text style={styles.logoText}>SocialConnect</Text>
            <View style={styles.logoBadge}>
              <Text style={styles.logoBadgeText}>BETA</Text>
            </View>
          </View>

          <View style={styles.header}>
            <Text style={styles.welcomeBack}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to your universe</Text>
          </View>

          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.formCard}>
            <LinearGradient
              colors={['rgba(124,58,237,0.08)', 'rgba(0,229,195,0.04)']}
              style={styles.formCardGradient}>
              <View style={styles.fieldWrapper}>
                <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
                <View
                  style={[
                    styles.inputContainer,
                    emailFocused && styles.inputContainerFocused,
                    !!emailError && styles.inputContainerError,
                  ]}>
                  <View style={[styles.inputIcon, emailFocused && styles.inputIconFocused]}>
                    <Mail
                      size={16}
                      color={
                        emailFocused
                          ? Colors.accent
                          : emailError
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
                    onFocus={() => setEmailFocused(true)}
                    onBlur={e => {
                      setEmailFocused(false);
                      formik.handleBlur('email')(e);
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    selectionColor={Colors.accent}
                  />
                </View>
                {emailError ? <Text style={styles.fieldError}>{emailError}</Text> : null}
              </View>

              <View style={styles.fieldWrapper}>
                <Text style={styles.fieldLabel}>PASSWORD</Text>
                <View
                  style={[
                    styles.inputContainer,
                    passwordFocused && styles.inputContainerFocused,
                    !!passwordError && styles.inputContainerError,
                  ]}>
                  <View style={[styles.inputIcon, passwordFocused && styles.inputIconFocused]}>
                    <Lock
                      size={16}
                      color={
                        passwordFocused
                          ? Colors.accent
                          : passwordError
                            ? Colors.error
                            : Colors.text.tertiary
                      }
                    />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your password"
                    placeholderTextColor={Colors.text.tertiary}
                    value={formik.values.password}
                    onChangeText={formik.handleChange('password')}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={e => {
                      setPasswordFocused(false);
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
                {passwordError ? <Text style={styles.fieldError}>{passwordError}</Text> : null}
              </View>

              <TouchableOpacity
                style={styles.forgotContainer}
                onPress={() => navigation?.navigate('ForgetPassword')}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>

          <TouchableOpacity
            style={styles.signInBtnWrapper}
            activeOpacity={0.85}
            onPress={() => formik.handleSubmit()}
            disabled={loading}>
            <LinearGradient
              colors={['#7C3AED', '#9D6FFF', '#00E5C3']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.signInBtn}>
              {loading ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <>
                  <Text style={styles.signInBtnText}>Sign In</Text>
                  <View style={styles.arrowCircle}>
                    <ArrowRight size={18} color={Colors.primary} />
                  </View>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.googleBtn}
            activeOpacity={0.8}
            onPress={handleGoogleSignIn}
            disabled={googleLoginLoading}>
            <View style={styles.googleIconWrapper}>
              <Image style={styles.googleIcon} source={images.google} />
            </View>
            <Text style={styles.googleText}>Continue with Google</Text>
          </TouchableOpacity>

          <View style={styles.signUpRow}>
            <Text style={styles.signUpLabel}>New to SocialConnect? </Text>
            <TouchableOpacity onPress={() => navigation?.navigate('SignUp')}>
              <Text style={styles.signUpLink}>Create account</Text>
            </TouchableOpacity>
          </View>

          <LinearGradient
            colors={['transparent', Colors.primary, Colors.accent, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.bottomLine}
          />
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
    paddingTop: 60,
    paddingBottom: 40,
  },

  // Orbs
  orb1: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(124,58,237,0.18)',
  },
  orb2: {
    position: 'absolute',
    bottom: height * 0.25,
    left: -100,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(0,229,195,0.10)',
  },
  orb3: {
    position: 'absolute',
    top: height * 0.45,
    right: 40,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(124,58,237,0.12)',
  },
  dotGrid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.15,
  },

  // Logo
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  logoGradient: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.brand,
  },
  logoText: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text.primary,
    marginLeft: Spacing.sm,
    letterSpacing: -0.5,
  },
  logoBadge: {
    marginLeft: Spacing.sm,
    backgroundColor: 'rgba(0,229,195,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0,229,195,0.3)',
    borderRadius: Radius.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  logoBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.accent,
    letterSpacing: 1.5,
  },

  // Header
  header: {
    marginBottom: Spacing.xl,
  },
  welcomeBack: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.text.primary,
    letterSpacing: -1.5,
    lineHeight: 42,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.text.tertiary,
    marginTop: 6,
    letterSpacing: 0.2,
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
    marginBottom: Spacing.lg,
    ...Shadow.soft,
  },
  formCardGradient: {
    padding: Spacing.lg,
  },

  // Fields
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
  inputIconFocused: {},
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

  // Forgot
  forgotContainer: {
    alignSelf: 'flex-end',
    paddingVertical: 4,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primaryLight,
  },

  // Sign In Button
  signInBtnWrapper: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Shadow.brand,
    marginBottom: Spacing.lg,
  },
  signInBtn: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  signInBtnText: {
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

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border.subtle,
  },
  dividerText: {
    fontSize: 12,
    color: Colors.text.tertiary,
    paddingHorizontal: Spacing.md,
    fontWeight: '500',
  },

  // Google Button
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg.glass,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    height: 52,
    marginBottom: Spacing.xl,
  },
  googleIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  googleG: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4285F4',
  },
  googleIcon: {
    width: 16,
    height: 16,
    resizeMode: 'contain',
  },
  googleText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.secondary,
  },

  // Sign Up
  signUpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  signUpLabel: {
    fontSize: 14,
    color: Colors.text.tertiary,
  },
  signUpLink: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.accent,
  },

  // Bottom Line
  bottomLine: {
    height: 2,
    borderRadius: 1,
    opacity: 0.6,
  },
});
