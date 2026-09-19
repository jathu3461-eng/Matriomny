import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import { PhoneInput } from '@/components/PhoneInput';
import { Screen } from '@/components/Screen';
import { AnimatedLogo } from '@/components/AnimatedLogo';
import { authApi } from '@/api/auth';
import { extractError } from '@/api/client';
import {
  validateUsername,
  validateEmail,
  validatePhone,
  validatePassword,
  validateConfirmPassword,
  validateBusinessName,
  fieldError,
  HINTS,
} from '@/utils/validation';
import { useTheme } from '@/theme';
import { radius, spacing, typography, layout } from '@/theme';
import type { AuthStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AuthStackParamList>;

function RegisterHeader() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
      <Pressable
        onPress={() => navigation.goBack()}
        style={styles.backBtn}
        hitSlop={12}
      >
        <Ionicons name="arrow-back" size={22} color={colors.ink} />
      </Pressable>
      <Text style={[styles.headerTitle, { color: colors.ink }]}>Create Account</Text>
      <View style={styles.backBtn} />
    </View>
  );
}

export function RegisterScreen() {
  const navigation = useNavigation<Nav>();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  // phone stores full E.164 (e.g. "+94771234567"); PhoneInput manages the split
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [role, setRole] = useState<'regular' | 'broker'>('regular');
  const [businessName, setBusinessName] = useState('');

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const touch = (field: string) => setTouched((t) => ({ ...t, [field]: true }));

  const passwordStrength = useMemo(() => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
    return score;
  }, [password]);

  const errors = useMemo(
    () => ({
      username: fieldError(username, touched.username, validateUsername),
      email: fieldError(email, touched.email, validateEmail),
      phone: fieldError(phone, touched.phone, validatePhone),
      password: fieldError(password, touched.password, validatePassword),
      confirm: fieldError(confirm, touched.confirm, (v) => validateConfirmPassword(password, v)),
      businessName:
        role === 'broker'
          ? fieldError(businessName, touched.businessName, validateBusinessName)
          : null,
      terms: !acceptedTerms && touched.terms ? 'You must accept the terms & conditions' : null,
    }),
    [username, email, phone, password, confirm, role, businessName, touched, acceptedTerms]
  );

  const hasErrors = Object.values(errors).some(Boolean);

  const submit = async () => {
    setTouched({
      username: true,
      email: true,
      phone: true,
      password: true,
      confirm: true,
      businessName: true,
      terms: true,
    });
    if (hasErrors) return;

    setServerError(null);
    setLoading(true);
    try {
      const result = await authApi.signup({
        username: username.trim(),
        email: email.trim(),
        phone_number: phone.trim(),
        password,
        role,
        ...(role === 'broker' ? { business_name: businessName.trim() } : {}),
      });
      if (result.status === 'pending_approval') {
        setServerError(null);
        alert('Account created! Waiting for admin approval.');
      }
      navigation.navigate('Login');
    } catch (err) {
      setServerError(extractError(err, 'Unable to create account.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <RegisterHeader />

          <View style={styles.header}>
            <AnimatedLogo shape="hexagon" size={100} />
            <Text style={[styles.subtitle, { color: colors.inkFaint }]}>
              Start your journey to find the perfect match
            </Text>
          </View>

          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                shadowColor: colors.black,
              },
            ]}
          >
            <View style={styles.roleRow}>
              <Button
                title="Regular User"
                variant={role === 'regular' ? 'primary' : 'outline'}
                size="sm"
                style={styles.roleBtn}
                onPress={() => setRole('regular')}
              />
              <Button
                title="Broker"
                variant={role === 'broker' ? 'primary' : 'outline'}
                size="sm"
                style={styles.roleBtn}
                onPress={() => setRole('broker')}
              />
            </View>

            <FormField
              label="Username"
              value={username}
              onChangeText={setUsername}
              onBlur={() => touch('username')}
              placeholder="e.g. john_95"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={60}
              count
              error={errors.username}
              hint={HINTS.username}
            />
            <FormField
              label="Email"
              value={email}
              onChangeText={setEmail}
              onBlur={() => touch('email')}
              placeholder="e.g. john@gmail.com"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              error={errors.email}
              hint={HINTS.email}
            />
            <PhoneInput
              label="Mobile Number"
              value={phone}
              onChange={(e164) => {
                setPhone(e164);
                // mark as touched so validation shows
                touch('phone');
              }}
              onBlur={() => touch('phone')}
              error={errors.phone}
              hint="Sri Lanka (+94) selected by default"
            />
            <FormField
              label="Password"
              value={password}
              onChangeText={setPassword}
              onBlur={() => touch('password')}
              placeholder="Create a strong password"
              secure
              autoCapitalize="none"
              error={errors.password}
              hint={HINTS.password}
            />
            <FormField
              label="Confirm password"
              value={confirm}
              onChangeText={setConfirm}
              onBlur={() => touch('confirm')}
              placeholder="Re-enter password"
              secure
              autoCapitalize="none"
              error={errors.confirm}
              hint={HINTS.confirm}
            />

            {/* Password strength meter */}
            {password.length > 0 && (
              <View style={styles.strengthContainer}>
                <View style={styles.strengthBars}>
                  {[0, 1, 2].map((i) => (
                    <View
                      key={i}
                      style={[
                        styles.strengthBar,
                        {
                          backgroundColor:
                            i < passwordStrength
                              ? passwordStrength === 1
                                ? colors.error
                                : passwordStrength === 2
                                  ? colors.warning
                                  : colors.success
                              : colors.border,
                        },
                      ]}
                    />
                  ))}
                </View>
                <Text style={[styles.strengthText, { color: colors.inkFaint }]}>
                  {passwordStrength === 0
                    ? ''
                    : passwordStrength === 1
                      ? 'Weak'
                      : passwordStrength === 2
                        ? 'Good'
                        : 'Strong'}
                </Text>

                {/* Password checklist */}
                <View style={styles.checklist}>
                  {[
                    { label: 'At least 8 characters', ok: password.length >= 8 },
                    { label: '1 uppercase letter', ok: /[A-Z]/.test(password) },
                    { label: '1 special character', ok: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
                  ].map((rule) => (
                    <View key={rule.label} style={styles.checkRow}>
                      <Ionicons
                        name={rule.ok ? 'checkmark-circle' : 'ellipse-outline'}
                        size={14}
                        color={rule.ok ? colors.success : colors.inkFaint}
                      />
                      <Text
                        style={[
                          styles.checkText,
                          { color: rule.ok ? colors.success : colors.inkFaint },
                        ]}
                      >
                        {rule.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Terms & Conditions */}
            <View style={styles.termsRow}>
              <Pressable
                onPress={() => setAcceptedTerms((a) => !a)}
                hitSlop={8}
              >
                <Ionicons
                  name={acceptedTerms ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={errors.terms ? colors.error : acceptedTerms ? colors.primary : colors.inkFaint}
                />
              </Pressable>
              <Text style={[styles.termsText, { color: colors.inkSoft }]}>
                I agree to the{' '}
                <Text style={{ color: colors.primary, fontWeight: '600' }}>Terms & Conditions</Text>
                {' '}and{' '}
                <Text style={{ color: colors.primary, fontWeight: '600' }}>Privacy Policy</Text>
              </Text>
            </View>
            {errors.terms && (
              <Text style={[styles.termsError, { color: colors.error }]}>{errors.terms}</Text>
            )}

            {role === 'broker' && (
              <FormField
                label="Business name"
                value={businessName}
                onChangeText={setBusinessName}
                onBlur={() => touch('businessName')}
                placeholder="Your agency name"
                error={errors.businessName}
                hint={HINTS.businessName}
              />
            )}

            {serverError && (
              <View style={[styles.errorBox, { backgroundColor: colors.errorSoft }]}>
                <Ionicons name="alert-circle" size={16} color={colors.error} />
                <Text style={[styles.errorBoxText, { color: colors.error }]}>{serverError}</Text>
              </View>
            )}

            <Button title="Create Account" onPress={submit} loading={loading} size="lg" />
          </View>

          <View style={styles.footer}>
            <View style={styles.loginRow}>
              <Text style={[styles.loginText, { color: colors.inkSoft }]}>
                Already have an account?{' '}
              </Text>
              <Button
                title="Log in"
                variant="ghost"
                size="sm"
                titleStyle={{ fontWeight: '700' }}
                onPress={() => navigation.navigate('Login')}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: spacing.xl,
    paddingBottom: layout.bottomContentInset,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    marginTop: spacing.lg,
  },
  title: {
    ...typography.title,
  },
  subtitle: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: spacing.lg,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: spacing.lg,
  },
  roleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  roleBtn: {
    flex: 1,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: 10,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  errorBoxText: {
    ...typography.caption,
    flex: 1,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: spacing.md,
  },
  loginRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loginText: {
    ...typography.body,
  },
  strengthContainer: {
    marginBottom: spacing.md,
  },
  strengthBars: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 4,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthText: {
    ...typography.label,
    marginBottom: spacing.sm,
  },
  checklist: {
    gap: 4,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checkText: {
    ...typography.label,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  termsText: {
    ...typography.caption,
    flex: 1,
    lineHeight: 20,
  },
  termsError: {
    ...typography.label,
    marginBottom: spacing.sm,
  },
});
