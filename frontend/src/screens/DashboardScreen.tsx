import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, RefreshControl, ScrollView,
  TouchableOpacity, Dimensions, Platform,
} from 'react-native';
import { apiClient } from '../api/client';
import { storage } from '../api/storage';
import { colors } from '../theme/colors';
import { typography, spacing, radius } from '../theme/constants';
import { ClayCard } from '../components/ClayCard';
import { StatusBadge } from '../components/StatusBadge';
import {
  Shield, ShieldCheck, ShieldX, MapPin, TrendingUp,
  AlertTriangle, Clock, IndianRupee, LogOut, Zap,
} from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function DashboardScreen({ navigation }: any) {
  const [user, setUser] = useState<any>(null);
  const [policy, setPolicy] = useState<any>(null);
  const [claims, setClaims] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [totalPayout, setTotalPayout] = useState(0);

  const fetchData = async () => {
    try {
      const [uRes, pRes, cRes] = await Promise.all([
        apiClient.get('/users/me'),
        apiClient.get('/policies/me'),
        apiClient.get('/claims/me?limit=5'),
      ]);
      setUser(uRes.data);
      setPolicy(pRes.data);
      setClaims(cRes.data || []);

      // Get total payouts
      try {
        const payRes = await apiClient.get('/claims/me/payouts?limit=50');
        const total = (payRes.data || []).reduce(
          (sum: number, p: any) => sum + (p.final_amount || 0), 0
        );
        setTotalPayout(total);
      } catch { /* payouts might be empty */ }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, []);

  const handleLogout = async () => {
    await storage.deleteItem('access_token');
    await storage.deleteItem('refresh_token');
    navigation.replace('Login');
  };

  if (!user) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const firstName = user.full_name?.split(' ')[0] || 'Driver';
  const hasCoverage = !!policy;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hi, {firstName} 👋</Text>
          <Text style={styles.platformText}>
            {user.platform?.charAt(0).toUpperCase() + user.platform?.slice(1)} Partner
          </Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <LogOut size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Coverage Status — Hero Card */}
      <ClayCard variant="elevated" style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={[styles.heroIcon, hasCoverage ? styles.heroIconActive : styles.heroIconInactive]}>
            {hasCoverage
              ? <ShieldCheck size={28} color={colors.success} />
              : <ShieldX size={28} color={colors.danger} />
            }
          </View>
          <StatusBadge status={hasCoverage ? 'active' : 'inactive'} size="md" />
        </View>

        <Text style={styles.heroTitle}>
          {hasCoverage ? 'You\'re Protected' : 'No Active Coverage'}
        </Text>
        <Text style={styles.heroSubtitle}>
          {hasCoverage
            ? 'Float is monitoring your zone for disruptions'
            : 'Subscribe to a plan to start earning protection'
          }
        </Text>

        {hasCoverage && policy && (
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Plan</Text>
              <Text style={styles.heroStatValue}>
                {policy.tier.charAt(0).toUpperCase() + policy.tier.slice(1)}
              </Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Coverage</Text>
              <Text style={styles.heroStatValue}>
                {Math.round(policy.coverage_pct * 100)}%
              </Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Premium</Text>
              <Text style={styles.heroStatValue}>₹{policy.weekly_premium}/wk</Text>
            </View>
          </View>
        )}
      </ClayCard>

      {/* Quick Stats */}
      <View style={styles.statsRow}>
        <ClayCard style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: colors.successBg }]}>
            <IndianRupee size={18} color={colors.success} />
          </View>
          <Text style={styles.statValue}>₹{totalPayout.toFixed(0)}</Text>
          <Text style={styles.statLabel}>Total Payouts</Text>
        </ClayCard>

        <ClayCard style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: colors.primaryLight }]}>
            <Zap size={18} color={colors.primary} />
          </View>
          <Text style={styles.statValue}>{claims.length}</Text>
          <Text style={styles.statLabel}>Recent Claims</Text>
        </ClayCard>
      </View>

      {/* Zone Info */}
      <ClayCard style={styles.zoneCard}>
        <View style={styles.zoneRow}>
          <View style={[styles.statIcon, { backgroundColor: colors.accentLight }]}>
            <MapPin size={18} color={colors.accent} />
          </View>
          <View style={styles.zoneText}>
            <Text style={styles.zoneTitle}>Active Zone</Text>
            <Text style={styles.zoneCell}>{user.h3_home_cell || 'Not set'}</Text>
          </View>
        </View>
        <Text style={styles.zoneInfo}>
          Our AI monitors weather, AQI, and road conditions in your zone 24/7
        </Text>
      </ClayCard>

      {/* Recent Claims */}
      {claims.length > 0 && (
        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {claims.slice(0, 3).map((claim) => {
            const date = new Date(claim.created_at).toLocaleDateString(undefined, {
              month: 'short', day: 'numeric',
            });
            return (
              <ClayCard key={claim.id} variant="outlined" style={styles.claimMini}>
                <View style={styles.claimMiniRow}>
                  <View style={styles.claimMiniLeft}>
                    <Text style={styles.claimMiniTitle}>Claim #{claim.id}</Text>
                    <Text style={styles.claimMiniDate}>{date}</Text>
                  </View>
                  <View style={styles.claimMiniRight}>
                    <StatusBadge status={claim.status} />
                    <Text style={styles.claimMiniAmount}>
                      ₹{claim.payout_estimate?.toFixed(0) || '0'}
                    </Text>
                  </View>
                </View>
              </ClayCard>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    paddingBottom: 100,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: typography.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  greeting: {
    fontSize: typography.xxl,
    fontWeight: '800',
    color: colors.text,
  },
  platformText: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Hero Card
  heroCard: {
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconActive: {
    backgroundColor: colors.successBg,
  },
  heroIconInactive: {
    backgroundColor: colors.dangerBg,
  },
  heroTitle: {
    fontSize: typography.xl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: typography.sm,
    color: colors.textMuted,
    lineHeight: 20,
  },
  heroStats: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.base,
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
  },
  heroDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  heroStatLabel: {
    fontSize: typography.xs,
    color: colors.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroStatValue: {
    fontSize: typography.md,
    fontWeight: '700',
    color: colors.text,
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    padding: spacing.base,
    alignItems: 'center',
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    fontSize: typography.xl,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: typography.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // Zone
  zoneCard: {
    padding: spacing.base,
    marginBottom: spacing.lg,
  },
  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  zoneText: {
    marginLeft: spacing.md,
  },
  zoneTitle: {
    fontSize: typography.base,
    fontWeight: '600',
    color: colors.text,
  },
  zoneCell: {
    fontSize: typography.xs,
    color: colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  zoneInfo: {
    fontSize: typography.sm,
    color: colors.textMuted,
    lineHeight: 20,
    marginTop: spacing.xs,
  },

  // Recent Claims
  recentSection: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.lg,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  claimMini: {
    padding: spacing.base,
    marginBottom: spacing.sm,
  },
  claimMiniRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  claimMiniLeft: {},
  claimMiniTitle: {
    fontSize: typography.base,
    fontWeight: '600',
    color: colors.text,
  },
  claimMiniDate: {
    fontSize: typography.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  claimMiniRight: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  claimMiniAmount: {
    fontSize: typography.md,
    fontWeight: '700',
    color: colors.success,
  },
});
