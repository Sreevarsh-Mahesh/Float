import React, { useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView,
  Platform, TouchableOpacity, Dimensions, ScrollView,
} from 'react-native';
import { apiClient } from '../api/client';
import { colors } from '../theme/colors';
import { typography, spacing, radius } from '../theme/constants';
import { ClayButton } from '../components/ClayButton';
import { FloatInput } from '../components/FloatInput';
import {
  User, Mail, Phone, Lock, Truck, MapPin,
  ChevronLeft, ChevronRight, Check,
} from 'lucide-react-native';

const PLATFORMS = [
  { id: 'zomato', label: 'Zomato', emoji: '🍕' },
  { id: 'swiggy', label: 'Swiggy', emoji: '🛵' },
  { id: 'other', label: 'Other', emoji: '📦' },
];

const TOTAL_STEPS = 3;

export default function RegisterScreen({ navigation }: any) {
  // Step tracking
  const [step, setStep] = useState(1);

  // Step 1: Personal info
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  // Step 2: Account
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Step 3: Work details
  const [platform, setPlatform] = useState('zomato');
  const [driverId, setDriverId] = useState('');
  const [h3HomeCell, setH3HomeCell] = useState('891e35b1177ffff');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validateStep = (): boolean => {
    setError('');
    if (step === 1) {
      if (!fullName.trim()) { setError('Enter your name'); return false; }
      if (!/^\d{10}$/.test(phone)) { setError('Phone must be 10 digits'); return false; }
    }
    if (step === 2) {
      if (!email.trim() || !email.includes('@')) { setError('Enter a valid email'); return false; }
      if (password.length < 8) { setError('Password must be 8+ characters'); return false; }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep()) {
      setStep(Math.min(step + 1, TOTAL_STEPS));
    }
  };

  const handleBack = () => {
    setError('');
    if (step > 1) setStep(step - 1);
    else navigation.goBack();
  };

  const handleRegister = async () => {
    if (!validateStep()) return;
    setLoading(true);
    setError('');
    try {
      await apiClient.post('/auth/register', {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone,
        password,
        platform,
        platform_driver_id: driverId.trim() || undefined,
        h3_home_cell: h3HomeCell.trim() || undefined,
      });
      navigation.navigate('Login');
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Registration failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStepTitle = () => {
    if (step === 1) return 'Your Details';
    if (step === 2) return 'Create Account';
    return 'Work Info';
  };

  const getStepSubtitle = () => {
    if (step === 1) return 'Tell us a bit about yourself';
    if (step === 2) return 'Set up your login credentials';
    return 'Which platform do you deliver for?';
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>

          {/* Step indicator */}
          <View style={styles.stepRow}>
            {[1, 2, 3].map((s) => (
              <View key={s} style={styles.stepItem}>
                <View style={[
                  styles.stepCircle,
                  s < step && styles.stepCompleted,
                  s === step && styles.stepActive,
                ]}>
                  {s < step ? (
                    <Check size={14} color={colors.textOnPrimary} />
                  ) : (
                    <Text style={[
                      styles.stepNum,
                      s === step && styles.stepNumActive,
                    ]}>{s}</Text>
                  )}
                </View>
                {s < 3 && (
                  <View style={[
                    styles.stepLine,
                    s < step && styles.stepLineActive,
                  ]} />
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>{getStepTitle()}</Text>
          <Text style={styles.subtitle}>{getStepSubtitle()}</Text>
        </View>

        {/* Error */}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Step 1: Personal */}
        {step === 1 && (
          <View style={styles.formSection}>
            <FloatInput
              label="Full Name"
              placeholder="e.g. Rajesh Kumar"
              value={fullName}
              onChangeText={(t) => { setFullName(t); setError(''); }}
              icon={<User size={18} color={colors.textMuted} />}
            />
            <FloatInput
              label="Phone Number"
              placeholder="10-digit mobile number"
              value={phone}
              onChangeText={(t) => { setPhone(t.replace(/\D/g, '').slice(0, 10)); setError(''); }}
              keyboardType="phone-pad"
              maxLength={10}
              icon={<Phone size={18} color={colors.textMuted} />}
            />
          </View>
        )}

        {/* Step 2: Account */}
        {step === 2 && (
          <View style={styles.formSection}>
            <FloatInput
              label="Email Address"
              placeholder="your@email.com"
              value={email}
              onChangeText={(t) => { setEmail(t); setError(''); }}
              autoCapitalize="none"
              keyboardType="email-address"
              icon={<Mail size={18} color={colors.textMuted} />}
            />
            <FloatInput
              label="Password"
              placeholder="Minimum 8 characters"
              value={password}
              onChangeText={(t) => { setPassword(t); setError(''); }}
              secureTextEntry
              icon={<Lock size={18} color={colors.textMuted} />}
            />
          </View>
        )}

        {/* Step 3: Work Details */}
        {step === 3 && (
          <View style={styles.formSection}>
            <Text style={styles.fieldLabel}>Delivery Platform</Text>
            <View style={styles.platformRow}>
              {PLATFORMS.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.platformCard,
                    platform === p.id && styles.platformCardActive,
                  ]}
                  onPress={() => setPlatform(p.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.platformEmoji}>{p.emoji}</Text>
                  <Text style={[
                    styles.platformLabel,
                    platform === p.id && styles.platformLabelActive,
                  ]}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <FloatInput
              label="Driver ID (optional)"
              placeholder="e.g. ZMT-1234"
              value={driverId}
              onChangeText={setDriverId}
              icon={<Truck size={18} color={colors.textMuted} />}
            />
            <FloatInput
              label="Coverage Zone (H3 Cell)"
              placeholder="Auto-detected in production"
              value={h3HomeCell}
              onChangeText={setH3HomeCell}
              icon={<MapPin size={18} color={colors.textMuted} />}
            />
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionSection}>
          {step < TOTAL_STEPS ? (
            <ClayButton
              title="Continue"
              onPress={handleNext}
              icon={<ChevronRight size={18} color={colors.textOnPrimary} />}
            />
          ) : (
            <ClayButton
              title="Create Account"
              onPress={handleRegister}
              loading={loading}
            />
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.footerLink}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: spacing.xxxl,
  },
  header: {
    marginBottom: spacing.xxl,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  stepActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepCompleted: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  stepNum: {
    fontSize: typography.sm,
    fontWeight: '700',
    color: colors.textMuted,
  },
  stepNumActive: {
    color: colors.textOnPrimary,
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
  },
  stepLineActive: {
    backgroundColor: colors.success,
  },
  titleSection: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.xxl,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.base,
    color: colors.textMuted,
  },
  formSection: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: typography.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.md,
    letterSpacing: 0.2,
  },
  platformRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  platformCard: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  platformCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  platformEmoji: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  platformLabel: {
    fontSize: typography.sm,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  platformLabelActive: {
    color: colors.primary,
  },
  errorBox: {
    backgroundColor: colors.dangerLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.sm,
    fontWeight: '500',
    textAlign: 'center',
  },
  actionSection: {
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: colors.textMuted,
    fontSize: typography.base,
  },
  footerLink: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: typography.base,
  },
});
