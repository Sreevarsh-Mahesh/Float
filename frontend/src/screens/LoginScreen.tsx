import React, { useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView,
  Platform, TouchableOpacity, Dimensions,
} from 'react-native';
import { apiClient } from '../api/client';
import { storage } from '../api/storage';
import { colors } from '../theme/colors';
import { typography, spacing, radius } from '../theme/constants';
import { ClayButton } from '../components/ClayButton';
import { FloatInput } from '../components/FloatInput';
import { Shield, Mail, Lock } from 'lucide-react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('admin@float.in');
  const [password, setPassword] = useState('admin1234');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.append('username', email.trim());
      params.append('password', password);
      const { data } = await apiClient.post('/auth/login', params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      await storage.setItem('access_token', data.access_token);
      await storage.setItem('refresh_token', data.refresh_token);
      navigation.replace('MainTabs');
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        {/* Brand */}
        <View style={styles.brandSection}>
          <View style={styles.logoCircle}>
            <Shield color={colors.textOnPrimary} size={32} />
          </View>
          <Text style={styles.brandName}>Float</Text>
          <Text style={styles.brandTagline}>Income protection for gig workers</Text>
        </View>

        {/* Form */}
        <View style={styles.formSection}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <FloatInput
            label="Email"
            placeholder="your@email.com"
            value={email}
            onChangeText={(t) => { setEmail(t); setError(''); }}
            autoCapitalize="none"
            keyboardType="email-address"
            icon={<Mail size={18} color={colors.textMuted} />}
          />

          <FloatInput
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={(t) => { setPassword(t); setError(''); }}
            secureTextEntry
            icon={<Lock size={18} color={colors.textMuted} />}
          />

          <ClayButton
            title="Sign In"
            onPress={handleLogin}
            loading={loading}
            style={styles.loginBtn}
          />
        </View>

        {/* Register link */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>New delivery partner? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.footerLink}>Create account</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.base,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  brandName: {
    fontSize: typography.xxxl,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -1,
  },
  brandTagline: {
    fontSize: typography.base,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  formSection: {
    marginBottom: spacing.xl,
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
  loginBtn: {
    marginTop: spacing.sm,
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
