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
import { FloatInput } from '../components/FloatInput';
import {
  Shield, ShieldAlert, ShieldCheck, Check, X, Star,
  IndianRupee, Percent, ArrowRight, Info, Calculator,
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
  const [showSuccess, setShowSuccess] = useState<string | null>(null);
  const [showPremiumInfo, setShowPremiumInfo] = useState(false);
  const [estimatorEarnings, setEstimatorEarnings] = useState('');

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
      setShowSuccess(tierName);
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
        <View>
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
                  isActive ? { borderWidth: 2, borderColor: config.color } : {},
                ] as any}
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
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={[styles.metricValue, { fontSize: typography.base }]}>Calculated</Text>
                      <TouchableOpacity onPress={() => setShowPremiumInfo(true)}>
                        <Info size={14} color={colors.textLight} />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.metricLabel}>Every Week</Text>
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
        </View>

        {/* Cost Estimator */}
        <View style={styles.estimatorContainer}>
          <Text style={styles.estimatorTitle}>Cost Estimator</Text>
          <Text style={styles.estimatorSubtitle}>Estimate your weekly premium and coverage based on your earnings.</Text>
          <ClayCard variant="elevated" style={styles.estimatorCard}>
            <View style={styles.estimatorInputBox}>
              <FloatInput
                label="Average Weekly Earnings (₹)"
                placeholder="e.g. 5000"
                value={estimatorEarnings}
                onChangeText={(t) => setEstimatorEarnings(t.replace(/\D/g, ''))}
                keyboardType="number-pad"
                icon={<IndianRupee size={18} color={colors.textMuted} />}
              />
            </View>

            {estimatorEarnings && Number(estimatorEarnings) > 0 ? (
              <View style={styles.estimatorBreakdown}>
                {tiers.map((tier) => {
                  const val = Number(estimatorEarnings);
                  const config = TIER_CONFIG[tier.tier] || TIER_CONFIG.basic;
                  const estimatedPremium = Math.round(val * 0.02); // Dummy 2%
                  const estimatedCoverage = Math.round(val * tier.coverage_pct);

                  return (
                    <View key={tier.tier} style={styles.estimatorRow}>
                      <View style={styles.estimatorTierLeft}>
                        {getTierIcon(tier.tier, 18)}
                        <Text style={styles.estimatorRowLabel}>
                          {tier.label?.split('(')[0]?.trim() || tier.tier}
                        </Text>
                      </View>
                      <View style={styles.estimatorTierRight}>
                        <Text style={styles.estimatorCoverText}>Gets ₹{estimatedCoverage}</Text>
                        <Text style={[styles.estimatorPremiumText, { color: config.color }]}>~₹{estimatedPremium} cost</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.estimatorPlaceholder}>
                <Calculator size={24} color={colors.borderLight} />
                <Text style={styles.estimatorPlaceholderText}>Enter earnings to see cost</Text>
              </View>
            )}
          </ClayCard>
        </View>

      </ScrollView>

      {/* Confirmation Modal */}
      <Modal visible={!!showConfirm} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <ClayCard variant="elevated" style={styles.modalCard as any}>
            <Text style={styles.modalTitle}>Confirm Plan</Text>
            <Text style={styles.modalText}>
              {showConfirm
                ? `Subscribe to the ${showConfirm.charAt(0).toUpperCase() + showConfirm.slice(1)} plan?`
                : ''
              }
            </Text>
            {showConfirm && tiers.find(t => t.tier === showConfirm) && (
              <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
                <Text style={[styles.modalPrice, { fontSize: typography.xl, marginBottom: spacing.xs }]}>
                  Calculated every week
                </Text>
                <TouchableOpacity onPress={() => { setShowConfirm(null); setShowPremiumInfo(true); }}>
                  <Text style={{ color: colors.primary, fontSize: typography.sm, fontWeight: '600' }}>
                    How is it calculated?
                  </Text>
                </TouchableOpacity>
              </View>
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

      {/* Premium Explanation Modal */}
      <Modal visible={showPremiumInfo} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <ClayCard variant="elevated" style={styles.modalCard as any}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }}>
              <Info size={24} color={colors.primary} />
            </View>
            <Text style={styles.modalTitle}>Weekly Premium</Text>
            <Text style={[styles.modalText, { lineHeight: 20 }]}>
              To keep it fair and simple, your premium changes every week depending on how much you work, the weather, and your location. You only pay for what you actually need!
            </Text>
            <View style={styles.modalActions}>
              <ClayButton
                title="Got it"
                size="md"
                onPress={() => setShowPremiumInfo(false)}
                style={{ flex: 1 }}
              />
            </View>
          </ClayCard>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal visible={!!showSuccess} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <ClayCard variant="elevated" style={[styles.modalCard, { paddingVertical: spacing.xxl }] as any}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.successBg, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg }}>
              <Check size={32} color={colors.success} />
            </View>
            <Text style={[styles.modalTitle, { fontSize: typography.xxl, color: colors.success, marginBottom: spacing.md }]}>Success!</Text>
            <Text style={styles.modalText}>
              You have successfully subscribed to the <Text style={{ fontWeight: '700', color: colors.text }}>{typeof showSuccess === 'string' ? showSuccess.charAt(0).toUpperCase() + showSuccess.slice(1) : ''}</Text> Plan!
            </Text>
            <View style={[styles.modalActions, { marginTop: spacing.xl }]}>
              <ClayButton
                title="Got it"
                size="md"
                onPress={() => setShowSuccess(null)}
                style={{ flex: 1 }}
              />
            </View>
          </ClayCard>
        </View>
      </Modal>
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

  // Estimator
  estimatorContainer: {
    marginTop: spacing.xl,
    marginBottom: spacing.xxl,
  },
  estimatorTitle: {
    fontSize: typography.xl,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  estimatorSubtitle: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  estimatorCard: {
    padding: spacing.xl,
  },
  estimatorInputBox: {
    marginBottom: spacing.lg,
  },
  estimatorBreakdown: {
    gap: spacing.base,
  },
  estimatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  estimatorTierLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    width: '40%',
  },
  estimatorRowLabel: {
    fontSize: typography.base,
    fontWeight: '600',
    color: colors.text,
  },
  estimatorTierRight: {
    alignItems: 'flex-end',
  },
  estimatorCoverText: {
    fontSize: typography.sm,
    fontWeight: '700',
    color: colors.text,
  },
  estimatorPremiumText: {
    fontSize: typography.xs,
    fontWeight: '700',
    marginTop: 2,
  },
  estimatorPlaceholder: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  estimatorPlaceholderText: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },

  // Success Toast (unused but kept for layout safety)
  successToast: {
    display: 'none',
  },
  successText: {
    display: 'none',
  },
});
