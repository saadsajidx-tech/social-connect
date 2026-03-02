import React, { useEffect, useRef, useState, useCallback } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  ActivityIndicator,
  Animated,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {
  ArrowLeft,
  Mail,
  ArrowRight,
  RefreshCw,
  CheckCircle,
  AlertCircle,
} from 'lucide-react-native';
import { Colors, Spacing, Radius, Shadow } from '../../utilities/theme';
import { TransparentStatusBar } from '../../component/common/TransparentStatusBar';
import { useAuth } from '../../Hooks/useAuth';

const { height } = Dimensions.get('window');

// ─── Constants ──────────────────────────────────────────────────────────────
const RESEND_COOLDOWN_SECONDS = 60;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── Types ──────────────────────────────────────────────────────────────────
type Step = 'email' | 'sent';

// ─── Email Validation ────────────────────────────────────────────────────────
function validateEmail(value: string): string | null {
  if (!value.trim()) return 'Email address is required.';
  if (!EMAIL_REGEX.test(value.trim())) return 'Please enter a valid email address.';
  return null;
}

// ─── Shake Animation Hook ────────────────────────────────────────────────────
function useShakeAnimation() {
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  return { shakeAnim, shake };
}

// ─── Resend Cooldown Hook ────────────────────────────────────────────────────
function useResendCooldown(initialSeconds = RESEND_COOLDOWN_SECONDS) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCountdown = useCallback(() => {
    setSeconds(initialSeconds);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [initialSeconds]);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
    },
    [],
  );

  return { seconds, canResend: seconds === 0, startCountdown };
}

// ─── Error Banner ────────────────────────────────────────────────────────────
const ErrorBanner = ({ message }: { message: string }) => (
  <Animated.View style={styles.errorBanner}>
    <AlertCircle size={14} color="#F87171" />
    <Text style={styles.errorBannerText}>{message}</Text>
  </Animated.View>
);

// ─── Step 1: Email ───────────────────────────────────────────────────────────
interface EmailStepProps {
  email: string;
  setEmail: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
  error: string | null;
  fieldError: string | null;
}

const EmailStep = ({ email, setEmail, onSubmit, loading, error, fieldError }: EmailStepProps) => {
  const [focused, setFocused] = useState(false);
  const { shakeAnim, shake } = useShakeAnimation();

  const hasError = !!(fieldError || error);

  // Expose shake to parent via ref pattern is complex; simpler: call shake on render when error
  const prevError = useRef<string | null>(null);
  useEffect(() => {
    if ((fieldError || error) && (fieldError || error) !== prevError.current) {
      shake();
    }
    prevError.current = fieldError ?? error;
  }, [fieldError, error, shake]);

  return (
    <View>
      <View style={styles.stepHeader}>
        <View style={styles.stepIconWrapper}>
          <LinearGradient colors={['#7C3AED', '#A855F7']} style={styles.stepIcon}>
            <Mail size={24} color={Colors.white} />
          </LinearGradient>
          <View style={styles.stepIconGlow} />
        </View>
        <Text style={styles.stepTitle}>Forgot Password?</Text>
        <Text style={styles.stepDesc}>
          Enter the email linked to your account and we'll send you a reset link.
        </Text>
      </View>

      {/* API Error */}
      {error && <ErrorBanner message={error} />}

      {/* Email Field */}
      <View style={styles.fieldWrapper}>
        <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
        <Animated.View
          style={[
            styles.inputContainer,
            focused && styles.inputFocused,
            hasError && styles.inputError,
            { transform: [{ translateX: shakeAnim }] },
          ]}>
          <View style={styles.inputIcon}>
            <Mail
              size={16}
              color={hasError ? '#F87171' : focused ? Colors.accent : Colors.text.tertiary}
            />
          </View>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={Colors.text.tertiary}
            value={email}
            onChangeText={text => setEmail(text)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            returnKeyType="send"
            onSubmitEditing={onSubmit}
            selectionColor={Colors.accent}
            editable={!loading}
          />
        </Animated.View>
        {fieldError ? <Text style={styles.fieldError}>{fieldError}</Text> : null}
      </View>

      <TouchableOpacity
        style={[styles.primaryBtnWrapper, loading && styles.btnDisabled]}
        onPress={onSubmit}
        activeOpacity={0.85}
        disabled={loading}>
        <LinearGradient
          colors={['#7C3AED', '#9D6FFF', '#00E5C3']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.primaryBtn}>
          {loading ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <>
              <Text style={styles.primaryBtnText}>Send Reset Link</Text>
              <View style={styles.arrowCircle}>
                <ArrowRight size={18} color={Colors.primary} />
              </View>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

// ─── Step 2: Sent Confirmation ───────────────────────────────────────────────
interface SentStepProps {
  email: string;
  onResend: () => void;
  onBack: () => void;
  resendLoading: boolean;
  resendError: string | null;
  seconds: number;
  canResend: boolean;
}

const SentStep = ({
  email,
  onResend,
  onBack,
  resendLoading,
  resendError,
  seconds,
  canResend,
}: SentStepProps) => (
  <View style={styles.sentContainer}>
    {/* Icon */}
    <View style={styles.successIconWrapper}>
      <LinearGradient colors={['#10B981', '#00E5C3']} style={styles.successIconGradient}>
        <Mail size={40} color={Colors.white} />
      </LinearGradient>
      <View style={styles.successGlow} />
    </View>

    <Text style={styles.successTitle}>Check your inbox</Text>
    <Text style={styles.sentDesc}>We've sent a password reset link to</Text>
    <Text style={styles.emailHighlight}>{email}</Text>
    <Text style={styles.sentSubDesc}>
      Open the link in your email to reset your password. It expires in 1 hour.
    </Text>

    {/* Resend error */}
    {resendError ? <ErrorBanner message={resendError} /> : null}

    {/* Resend Button */}
    <View style={styles.resendBlock}>
      <Text style={styles.resendLabel}>Didn't receive it?</Text>
      {canResend ? (
        <TouchableOpacity
          style={styles.resendBtn}
          onPress={onResend}
          disabled={resendLoading}
          activeOpacity={0.7}>
          {resendLoading ? (
            <ActivityIndicator size="small" color={Colors.primaryLight} />
          ) : (
            <>
              <RefreshCw size={13} color={Colors.primaryLight} />
              <Text style={styles.resendText}> Resend link</Text>
            </>
          )}
        </TouchableOpacity>
      ) : (
        <Text style={styles.resendCooldown}>Resend in {seconds}s</Text>
      )}
    </View>

    {/* Wrong email? Go back */}
    <TouchableOpacity style={styles.wrongEmailBtn} onPress={onBack} activeOpacity={0.7}>
      <Text style={styles.wrongEmailText}>Wrong email? Try a different one</Text>
    </TouchableOpacity>

    {/* Tips */}
    <View style={styles.tipBox}>
      <Text style={styles.tipTitle}>Can't find the email?</Text>
      <Text style={styles.tipItem}>• Check your spam or junk folder</Text>
      <Text style={styles.tipItem}>• Make sure the email address above is correct</Text>
      <Text style={styles.tipItem}>• Allow a few minutes for delivery</Text>
    </View>
  </View>
);

// ─── Main Screen ─────────────────────────────────────────────────────────────
type Props = NativeStackScreenProps<AuthStackParamList, 'ForgetPassword'>;

export default function ForgetPassword({ navigation }: Props) {
  const { forgotPassword, loading, error, clearError } = useAuth();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);

  // Resend state (separate from initial send state)
  const [resendLoading, setResendLoading] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const { seconds, canResend, startCountdown } = useResendCooldown();

  // Clear errors when email changes
  const handleEmailChange = useCallback(
    (text: string) => {
      setEmail(text);
      if (fieldError) setFieldError(null);
      if (error) clearError();
    },
    [fieldError, error, clearError],
  );

  // ── Initial send ────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    // Client-side validation first
    const validationError = validateEmail(email);
    if (validationError) {
      setFieldError(validationError);
      return;
    }
    setFieldError(null);

    await forgotPassword(email.trim().toLowerCase(), () => {
      // onSuccess: move to sent step and start cooldown
      setStep('sent');
      startCountdown();
    });
    // If forgotPassword failed, `error` in useAuth is set automatically.
    // The ErrorBanner in EmailStep will display it.
  }, [email, forgotPassword, startCountdown]);

  // ── Resend ──────────────────────────────────────────────────────────────
  const handleResend = useCallback(async () => {
    setResendLoading(true);
    setResendError(null);
    try {
      // Call Firebase directly via useAuth's forgotPassword
      // We pass a no-op onSuccess and handle locally
      await forgotPassword(email.trim().toLowerCase(), () => {
        startCountdown();
      });
      // Note: if it fails, useAuth sets its error — but we also want a local
      // resend error. We'll derive it after the call.
      // Since forgotPassword sets `error` in useAuth context on failure,
      // we mirror it locally for the resend banner.
    } catch {
      setResendError('Failed to resend. Please try again.');
    } finally {
      setResendLoading(false);
    }
  }, [email, forgotPassword, startCountdown]);

  // When global error updates and we're on sent step, show it as resendError
  useEffect(() => {
    if (step === 'sent' && error) {
      setResendError(error);
      clearError();
    }
  }, [error, step, clearError]);

  // ── Back navigation ─────────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    if (step === 'sent') {
      setStep('email');
      clearError();
      setResendError(null);
    } else {
      navigation?.goBack();
    }
  }, [step, navigation, clearError]);

  const progressPercent = step === 'email' ? 50 : 100;

  return (
    <View style={styles.root}>
      <TransparentStatusBar />

      {/* Background orbs */}
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.container}>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
              <ArrowLeft size={20} color={Colors.text.secondary} />
            </TouchableOpacity>

            <View style={styles.stepDots}>
              {(['email', 'sent'] as Step[]).map((s, i) => (
                <View
                  key={s}
                  style={[
                    styles.stepDot,
                    (step === 'email' ? 0 : 1) >= i && styles.stepDotActive,
                    step === s && styles.stepDotCurrent,
                  ]}
                />
              ))}
            </View>

            <View style={{ width: 40 }} />
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBarBg}>
            <LinearGradient
              colors={['#7C3AED', '#00E5C3']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressBarFill, { width: `${progressPercent}%` }]}
            />
          </View>

          {/* Content */}
          <View style={styles.content}>
            {step === 'email' && (
              <EmailStep
                email={email}
                setEmail={handleEmailChange}
                onSubmit={handleSend}
                loading={loading}
                error={error}
                fieldError={fieldError}
              />
            )}
            {step === 'sent' && (
              <SentStep
                email={email}
                onResend={handleResend}
                onBack={() => {
                  setStep('email');
                  clearError();
                  setResendError(null);
                }}
                resendLoading={resendLoading}
                resendError={resendError}
                seconds={seconds}
                canResend={canResend}
              />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
    overflow: 'hidden',
  },
  flex: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: 52,
  },
  content: {
    flex: 1,
    paddingTop: Spacing.xl,
  },

  // Orbs
  orb1: {
    position: 'absolute',
    top: -100,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(124,58,237,0.15)',
  },
  orb2: {
    position: 'absolute',
    bottom: 100,
    left: -80,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(0,229,195,0.08)',
  },

  // Top Bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
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
  stepDots: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border.subtle,
  },
  stepDotActive: {
    backgroundColor: Colors.primaryLight,
  },
  stepDotCurrent: {
    width: 24,
    backgroundColor: Colors.accent,
  },

  // Progress Bar
  progressBarBg: {
    height: 2,
    backgroundColor: Colors.border.subtle,
    borderRadius: 1,
    marginBottom: Spacing.xl,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 1,
  },

  // Step Header
  stepHeader: {
    marginBottom: Spacing.xl,
  },
  stepIconWrapper: {
    alignSelf: 'flex-start',
    marginBottom: Spacing.lg,
    position: 'relative',
  },
  stepIcon: {
    width: 60,
    height: 60,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.brand,
  },
  stepIconGlow: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: -8,
    bottom: -8,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(124,58,237,0.2)',
    zIndex: -1,
  },
  stepTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.text.primary,
    letterSpacing: -1,
    marginBottom: 8,
  },
  stepDesc: {
    fontSize: 15,
    color: Colors.text.tertiary,
    lineHeight: 22,
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
  inputFocused: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(0,229,195,0.05)',
  },
  inputError: {
    borderColor: '#F87171',
    backgroundColor: 'rgba(248,113,113,0.04)',
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
  fieldError: {
    fontSize: 12,
    color: '#F87171',
    marginTop: 6,
    marginLeft: 4,
  },

  // Error Banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(248,113,113,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.25)',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginBottom: Spacing.md,
  },
  errorBannerText: {
    fontSize: 13,
    color: '#F87171',
    flex: 1,
    lineHeight: 18,
  },

  // Primary Button
  primaryBtnWrapper: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Shadow.brand,
    marginTop: Spacing.sm,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  primaryBtn: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  primaryBtnText: {
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

  // Sent / Success Step
  sentContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: Spacing.lg,
  },
  successIconWrapper: {
    position: 'relative',
    marginBottom: Spacing.xl,
  },
  successIconGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.accent,
  },
  successGlow: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: -10,
    bottom: -10,
    borderRadius: 50,
    backgroundColor: 'rgba(0,229,195,0.2)',
    zIndex: -1,
  },
  successTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.text.primary,
    letterSpacing: -1,
    textAlign: 'center',
    marginBottom: 8,
  },
  sentDesc: {
    fontSize: 15,
    color: Colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 22,
  },
  emailHighlight: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.accent,
    marginTop: 4,
    marginBottom: 8,
    textAlign: 'center',
  },
  sentSubDesc: {
    fontSize: 13,
    color: Colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },

  // Resend
  resendBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.md,
  },
  resendLabel: {
    fontSize: 13,
    color: Colors.text.tertiary,
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  resendText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primaryLight,
  },
  resendCooldown: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.tertiary,
    fontVariant: ['tabular-nums'],
  },

  // Wrong email
  wrongEmailBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: Spacing.xl,
  },
  wrongEmailText: {
    fontSize: 13,
    color: Colors.text.tertiary,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },

  // Tips box
  tipBox: {
    width: '100%',
    backgroundColor: Colors.bg.glass,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 6,
  },
  tipTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.secondary,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  tipItem: {
    fontSize: 12,
    color: Colors.text.tertiary,
    lineHeight: 18,
  },
});
