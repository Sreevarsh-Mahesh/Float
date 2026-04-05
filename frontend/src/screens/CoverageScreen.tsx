import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  Alert, TouchableOpacity, Platform, Modal, Dimensions,
} from 'react-native';
import { apiClient } from '../api/client';
import { colors } from '../theme/colors';
import { typography, spacing, radius } from '../theme/constants';
import { ClayCard } from '../components/ClayCard';
import { ClayButton } from '../components/ClayButton';
import { StatusBadge } from '../components/StatusBadge';
import {
  Shield, ShieldAlert, ShieldCheck, Check, X, Star,
  IndianRupee, Percent, ArrowRight,
} from 'lucide-react-native';

const TIER_CONFIG: Record<string, {
  color: string; colorLight: string; icon: string; features: string[];
}> = {
  basic: {
    color: colors.tierBasic,
    colorLight: colors.warningBg,
    icon: 'shield-alert',
    features: [
      'Weather disruption coverage',
      'Weekly premium billing',
      'Basic fraud protection',
    ],
  },
  protection: {
    color: colors.tierProtection,
    colorLight: colors.primaryLight,
    icon: 'shield',
    features: [
      'All Basic features',
      'AQI & heat wave coverage',
      'Priority claim processing',
    ],
  },
  advanced: {
    color: colors.tierAdvanced,
    colorLight: colors.successBg,
    icon: 'shield-check',
    features: [
      'All Protection features',
      'Road closure & protest coverage',
      'Full 100% wage replacement',
      'Instant payout processing',
    ],
  },
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function CoverageScreen() {
  const [tiers, setTiers] = useState<any[]>([]);
  const [activePolicy, setActivePolicy] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [subscribingTo, setSubscribingTo] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const fetchData = async () => {
    try {
      const [tRes, pRes] = await Promise.all([
        apiClient.get('/policies/tiers'),
        apiClient.get('/policies/me'),
      ]);
      setTiers(tRes.data);
      setActivePolicy(pRes.data);
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

  const handleSubscribe = async (tierName: string) => {
    setShowConfirm(null);
    setSubscribingTo(tierName);
    try {
      await apiClient.post('/policies/subscribe', { tier: tierName });
      await fetchData();
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2500);
    } catch (e: any) {
      Alert.alert('Error', 'Could not subscribe. Please try again.');
    } finally {
      setSubscribingTo(null);
    }
  };

  const getTierIcon = (tier: string, size: number = 28) => {
    const config = TIER_CONFIG[tier];
    if (!config) return <Shield size={size} color={colors.textMuted} />;
    if (tier === 'basic') return <ShieldAlert size={size} color={config.color} />;
    if (tier === 'protection') return <Shield size={size} color={config.color} />;
    return <ShieldCheck size={size} color={config.color} />;
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Coverage Plans</Text>
          <Text style={styles.subtitle}>Choose the right protection for you</Text>
        </View>

        {/* Active Policy Banner */}
        {activePolicy && (
          <ClayCard style={styles.activeBanner}>
            <View style={styles.activeBannerRow}>
              <View style={styles.activeBannerLeft}>
                {getTierIcon(activePolicy.tier, 24)}
                <View style={{ marginLeft: spacing.md }}>
                  <Text style={styles.activeBannerTitle}>
                    {activePolicy.tier.charAt(0).toUpperCase() + activePolicy.tier.slice(1)} Plan
                  </Text>
                  <Text style={styles.activeBannerSub}>
                    {Math.round(activePolicy.coverage_pct * 100)}% coverage · ₹{activePolicy.weekly_premium}/week
                  </Text>
                </View>
              </View>
              <StatusBadge status="active" />
            </View>
          </ClayCard>
        )}

        {/* Tier Cards Horizontal Swipe */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={SCREEN_WIDTH * 0.85 + spacing.md}
          decelerationRate="fast"
          style={styles.horizontalScroll}
          contentContainerStyle={styles.horizontalScrollContent}
        >
          {tiers.map((tier) => {
            const config = TIER_CONFIG[tier.tier] || TIER_CONFIG.basic;
            const isActive = activePolicy?.tier === tier.tier;
            const coveragePct = Math.round(tier.coverage_pct * 100);

            return (
              <ClayCard
                key={tier.tier}
                variant={isActive ? 'elevated' : 'default'}
                style={[
                  styles.tierCard,
                  { width: SCREEN_WIDTH * 0.85 },
                  isActive && { borderWidth: 2, borderColor: config.color },
                ]}
              >
              {/* Tier Header */}
              <View style={styles.tierHeader}>
                <View style={[styles.tierIconBox, { backgroundColor: config.colorLight }]}>
                  {getTierIcon(tier.tier, 24)}
                </View>
                {tier.tier === 'advanced' && (
                  <View style={styles.recommendedBadge}>
                    <Star size={12} color={colors.textOnPrimary} />
                    <Text style={styles.recommendedText}>Best Value</Text>
                  </View>
                )}
                {isActive && <StatusBadge status="active" size="md" />}
              </View>

              {/* Tier Name */}
              <Text style={styles.tierName}>
                {tier.label?.split('(')[0]?.trim() || tier.tier}
              </Text>

              {/* Coverage & Price */}
              <View style={styles.tierMetrics}>
                <View style={styles.tierMetric}>
                  <View style={styles.metricIcon}>
                    <Percent size={14} color={config.color} />
                  </View>
                  <View>
                    <Text style={[styles.metricValue, { color: config.color }]}>{coveragePct}%</Text>
                    <Text style={styles.metricLabel}>Wage Cover</Text>
                  </View>
                </View>
                <View style={styles.tierMetric}>
                  <View style={styles.metricIcon}>
                    <IndianRupee size={14} color={colors.textSecondary} />
                  </View>
                  <View>
                    <Text style={styles.metricValue}>₹{tier.weekly_premium}</Text>
                    <Text style={styles.metricLabel}>Per Week</Text>
                  </View>
                </View>
              </View>

              {/* Features */}
              <View style={styles.featuresList}>
                {config.features.map((f, i) => (
                  <View key={i} style={styles.featureRow}>
                    <Check size={14} color={config.color} />
                    <Text style={styles.featureText}>{f}</Text>
                  </View>
                ))}
              </View>

              {/* Action */}
              {!isActive && (
                <ClayButton
                  title={activePolicy ? 'Switch to this plan' : 'Select Plan'}
                  onPress={() => setShowConfirm(tier.tier)}
                  loading={subscribingTo === tier.tier}
                  variant={tier.tier === 'advanced' ? 'primary' : 'secondary'}
                  style={styles.selectBtn}
                />
              )}
            </ClayCard>
          );
        })}
        </ScrollView>
      </ScrollView>

      {/* Confirmation Modal */}
      <Modal visible={!!showConfirm} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <ClayCard variant="elevated" style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirm Plan</Text>
            <Text style={styles.modalText}>
              {showConfirm
                ? `Subscribe to the ${showConfirm.charAt(0).toUpperCase() + showConfirm.slice(1)} plan?`
                : ''
              }
            </Text>
            {showConfirm && tiers.find(t => t.tier === showConfirm) && (
              <Text style={styles.modalPrice}>
                ₹{tiers.find(t => t.tier === showConfirm)!.weekly_premium} / week
              </Text>
            )}
            <View style={styles.modalActions}>
              <ClayButton
                title="Cancel"
                variant="ghost"
                size="md"
                onPress={() => setShowConfirm(null)}
                style={{ flex: 1, marginRight: spacing.sm }}
              />
              <ClayButton
                title="Confirm"
                size="md"
                onPress={() => showConfirm && handleSubscribe(showConfirm)}
                style={{ flex: 1 }}
              />
            </View>
          </ClayCard>
        </View>
      </Modal>

      {/* Success Toast */}
      {showSuccess && (
        <View style={styles.successToast}>
          <Check size={18} color={colors.textOnPrimary} />
          <Text style={styles.successText}>Plan activated successfully!</Text>
        </View>
      )}
    </View>
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
  header: {
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

  // Active Banner
  activeBanner: {
    padding: spacing.base,
    marginBottom: spacing.lg,
    backgroundColor: colors.primaryLight,
    borderWidth: 0,
  },
  activeBannerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activeBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  activeBannerTitle: {
    fontSize: typography.base,
    fontWeight: '700',
    color: colors.text,
  },
  activeBannerSub: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Horizontal Scroll
  horizontalScroll: {
    marginHorizontal: -spacing.lg,
  },
  horizontalScrollContent: {
    paddingHorizontal: spacing.lg,
  },

  // Tier Card
  tierCard: {
    padding: spacing.xl,
    marginRight: spacing.md,
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.base,
  },
  tierIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 4,
  },
  recommendedText: {
    fontSize: typography.xs,
    fontWeight: '700',
    color: colors.textOnPrimary,
  },
  tierName: {
    fontSize: typography.xl,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.base,
  },
  tierMetrics: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginBottom: spacing.lg,
  },
  tierMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metricIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    fontSize: typography.lg,
    fontWeight: '700',
    color: colors.text,
  },
  metricLabel: {
    fontSize: typography.xs,
    color: colors.textMuted,
  },
  featuresList: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  featureText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  selectBtn: {
    marginTop: spacing.xs,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    padding: spacing.xl,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: typography.xl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  modalText: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  modalPrice: {
    fontSize: typography.xxl,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: spacing.xl,
  },
  modalActions: {
    flexDirection: 'row',
    width: '100%',
  },

  // Success Toast
  successToast: {
    position: 'absolute',
    bottom: 100,
    left: spacing.xl,
    right: spacing.xl,
    backgroundColor: colors.success,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.base,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  successText: {
    color: colors.textOnPrimary,
    fontWeight: '600',
    fontSize: typography.base,
  },
});
