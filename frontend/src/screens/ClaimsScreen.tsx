import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  TouchableOpacity, Platform, Modal,
} from 'react-native';
import { apiClient } from '../api/client';
import { colors } from '../theme/colors';
import { typography, spacing, radius } from '../theme/constants';
import { ClayCard } from '../components/ClayCard';
import { StatusBadge } from '../components/StatusBadge';
import { ClayButton } from '../components/ClayButton';
import {
  CloudRain, Wind, Thermometer, AlertTriangle, Clock,
  IndianRupee, ShieldCheck, X, FileText, ChevronRight,
  Navigation, Wifi, AlertOctagon, CheckCircle2,
} from 'lucide-react-native';
import { SimulationStore } from '../store/SimulationStore';

// Map event types to human-readable labels and icons
const EVENT_TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  rain: { label: 'Heavy Rain', icon: CloudRain, color: colors.info },
  aqi: { label: 'Poor Air Quality', icon: Wind, color: colors.warning },
  heat: { label: 'Extreme Heat', icon: Thermometer, color: colors.danger },
  acts_of_god: { label: 'Natural Disaster', icon: AlertTriangle, color: colors.danger },
  road_closure: { label: 'Road Closure', icon: AlertTriangle, color: colors.warning },
  protest: { label: 'Protest/Curfew', icon: AlertTriangle, color: colors.warning },
};

export default function ClaimsScreen() {
  const [claims, setClaims] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<any>(null);
  
  const [simData, setSimData] = useState<any>(SimulationStore.currentSimData);

  useEffect(() => {
    const unsubscribe = SimulationStore.subscribe((data: any) => setSimData(data));
    return () => { unsubscribe(); };
  }, []);

  const fetchData = async () => {
    try {
      const [cRes, pRes] = await Promise.all([
        apiClient.get('/claims/me'),
        apiClient.get('/claims/me/payouts'),
      ]);
      
      const realClaims = cRes.data || [];
      const mockSimulationClaim = {
        id: 'SIMULATOR',
        status: 'active',
        created_at: new Date().toISOString(),
        payout_estimate: 420,
        trigger_event_id: 'rain_001',
        isSimulation: true
      };

      setClaims([mockSimulationClaim, ...realClaims]);
      setPayouts(pRes.data || []);
    } catch (e) {
      console.error('Failed to fetch claims/payouts', e);
      // Ensure simulation claim is always visible even if backend offline
      setClaims([{
        id: 'SIMULATOR',
        status: 'active',
        created_at: new Date().toISOString(),
        payout_estimate: 420,
        trigger_event_id: 'rain_001',
        isSimulation: true
      }]);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, []);

  const totalEarned = payouts.reduce((sum, p) => sum + (p.final_amount || 0), 0);
  const approvedCount = claims.filter(c =>
    ['auto_approved', 'paid'].includes(c.status)
  ).length;

  const renderClaim = ({ item }: { item: any }) => {
    const payout = payouts.find(p => p.claim_id === item.id);
    const date = new Date(item.created_at);
    const dateStr = date.toLocaleDateString(undefined, {
      month: 'short', day: 'numeric',
    });
    const timeStr = date.toLocaleTimeString(undefined, {
      hour: '2-digit', minute: '2-digit',
    });

    // Determine the display amount
    let amount = payout ? payout.final_amount : item.payout_estimate;
    if (item.isSimulation) {
      amount = simData?.calc?.payout || 0;
    }
    const isPaid = !!payout && !item.isSimulation;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setSelectedClaim({ ...item, payout })}
      >
        <ClayCard style={styles.claimCard}>
          <View style={styles.claimRow}>
            {/* Left: Icon + Info */}
            <View style={styles.claimLeft}>
              <View style={[styles.claimIcon, { backgroundColor: colors.primaryLight }]}>
                <FileText size={18} color={colors.primary} />
              </View>
              <View style={styles.claimInfo}>
                <Text style={styles.claimTitle}>
                   {item.isSimulation ? '[Oracle] Trigger Detected' : `Claim #${item.id}`}
                </Text>
                <View style={styles.claimDateRow}>
                  <Clock size={11} color={item.isSimulation ? colors.primary : colors.textMuted} />
                  <Text style={[styles.claimDate, item.isSimulation && {color: colors.primary, fontWeight: '600'}]}>
                     {item.isSimulation ? 'Happening Now' : `${dateStr} · ${timeStr}`}
                  </Text>
                </View>
              </View>
            </View>

            {/* Right: Amount + Status */}
            <View style={styles.claimRight}>
              <Text style={[styles.claimAmount, isPaid ? styles.amountPaid : styles.amountPending]}>
                {isPaid ? '' : '~'}₹{amount?.toFixed(0) || '0'}
              </Text>
              <StatusBadge status={item.status} />
            </View>
          </View>
        </ClayCard>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Claims</Text>
        <Text style={styles.subtitle}>Auto-generated when disruptions occur</Text>
      </View>

      {/* Summary Cards */}
      {claims.length > 0 && (
        <View style={styles.summaryRow}>
          <ClayCard style={styles.summaryCard}>
            <Text style={styles.summaryValue}>₹{totalEarned.toFixed(0)}</Text>
            <Text style={styles.summaryLabel}>Total Earned</Text>
          </ClayCard>
          <ClayCard style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{approvedCount}</Text>
            <Text style={styles.summaryLabel}>Approved</Text>
          </ClayCard>
          <ClayCard style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{claims.length}</Text>
            <Text style={styles.summaryLabel}>Total</Text>
          </ClayCard>
        </View>
      )}

      {/* Claims List */}
      <FlatList
        data={claims}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderClaim}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBox}>
              <ShieldCheck size={40} color={colors.textLight} />
            </View>
            <Text style={styles.emptyTitle}>No Claims Yet</Text>
            <Text style={styles.emptyText}>
              When weather, AQI, or road issues happen in your zone, Float automatically creates a claim and calculates your payout.
            </Text>
          </View>
        }
      />

      {/* Claim Detail Modal */}
      <Modal visible={!!selectedClaim} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ClayCard variant="elevated" style={styles.modalCard}>
            {selectedClaim && !selectedClaim.isSimulation && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Claim #{selectedClaim.id}</Text>
                  <TouchableOpacity onPress={() => setSelectedClaim(null)} style={styles.closeBtn}>
                    <X size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <StatusBadge status={selectedClaim.status} size="md" />

                <View style={styles.modalDivider} />

                {/* Details Grid */}
                <View style={styles.detailGrid}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Trigger Event</Text>
                    <Text style={styles.detailValue}>#{selectedClaim.trigger_event_id}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Policy</Text>
                    <Text style={styles.detailValue}>#{selectedClaim.policy_id}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Fraud Score</Text>
                    <Text style={[
                      styles.detailValue,
                      { color: selectedClaim.fraud_score > 50 ? colors.danger : colors.success },
                    ]}>
                      {selectedClaim.fraud_score?.toFixed(1) || '0.0'}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Spoof Check</Text>
                    <Text style={[
                      styles.detailValue,
                      { color: selectedClaim.spoof_score > 0.5 ? colors.danger : colors.success },
                    ]}>
                      {selectedClaim.spoof_score?.toFixed(2) || '0.00'}
                    </Text>
                  </View>
                </View>

                <View style={styles.modalDivider} />

                {/* Payout */}
                <View style={styles.payoutSection}>
                  {selectedClaim.payout ? (
                    <>
                      <Text style={styles.payoutLabel}>Disbursed Payout</Text>
                      <Text style={styles.payoutAmount}>₹{selectedClaim.payout.final_amount?.toFixed(2)}</Text>
                      <Text style={styles.payoutDetail}>
                        Base: ₹{selectedClaim.payout.base_amount?.toFixed(2)} × {selectedClaim.payout.tier_multiplier}x tier
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.payoutLabel}>Estimated Payout</Text>
                      <Text style={styles.payoutAmountEst}>~₹{selectedClaim.payout_estimate?.toFixed(2) || '0.00'}</Text>
                      <Text style={styles.payoutDetail}>Final amount depends on your coverage tier</Text>
                    </>
                  )}
                </View>

                <ClayButton
                  title="Close"
                  variant="secondary"
                  size="md"
                  onPress={() => setSelectedClaim(null)}
                  style={{ marginTop: spacing.lg }}
                />
              </>
            )}
            
            {selectedClaim && selectedClaim.isSimulation && (
              <View style={styles.workerSimContainer}>
                 <View style={styles.workerSimBadge}>
                    <Text style={styles.workerSimBadgeText}>LIVE DRIVER VIEW</Text>
                 </View>
                 
                 {simData ? (
                   <>
                     <View style={[styles.workerSimHeader, {backgroundColor: simData.eventType?.color || colors.primary}]}>
                        <View style={styles.workerSimIconBox}>
                           {simData.eventType?.id === 'rain' ? <CloudRain size={36} color={colors.background} /> :
                            simData.eventType?.id === 'aqi' ? <Wind size={36} color={colors.background} /> :
                            simData.eventType?.id === 'heat' ? <Thermometer size={36} color={colors.background} /> :
                            simData.eventType?.id === 'road' ? <Navigation size={36} color={colors.background} /> :
                            simData.eventType?.id === 'platform' ? <Wifi size={36} color={colors.background} /> :
                            <AlertOctagon size={36} color={colors.background} />}
                        </View>
                     </View>
                     
                     <Text style={styles.workerSimTitle}>{simData.eventType?.label || 'Disruption'}</Text>
                     <Text style={styles.workerSimSub}>Live Triggers Active • {simData.city?.name || 'Your Zone'}</Text>
                     
                     <View style={styles.workerSimCard}>
                        <View style={styles.workerSimRow}>
                           <ShieldCheck size={20} color={colors.success} />
                           <Text style={styles.workerSimCardTitle}>Float Protection Active</Text>
                        </View>
                        <Text style={styles.workerSimCardBody}>
                           {simData.calc?.isValid 
                             ? `Your ${simData.tier?.label} tier covers you during this disruption. Your projected daily earnings have been safely bumped up!`
                             : `The current environmental conditions do not meet the minimum gateway threshold for a payout.`}
                        </Text>
                        
                        {/* Top highlight row */}
                     <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20}}>
                        <View style={styles.workerSimMetricBox}>
                           <View style={styles.workerSimMetric}>
                              <Text style={styles.workerSimMetricLabel}>Float Payout</Text>
                              <Text style={[styles.workerSimMetricNew, !simData.calc?.isValid && {color: colors.textMuted}]}>
                                ₹{Math.round(simData.calc?.isValid ? simData.calc?.payout : 0)}
                              </Text>
                           </View>
                           <ChevronRight size={24} color={colors.border} />
                           <View style={styles.workerSimMetric}>
                              <Text style={styles.workerSimMetricLabel}>Target Earnings</Text>
                              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.textSecondary }}>
                                ~₹{Math.round(simData.calc?.Ed || 0)}/day
                              </Text>
                           </View>
                        </View>
                        
                        <View style={{alignItems: 'flex-end', justifyContent: 'center'}}>
                           <Text style={{fontSize: 10, color: colors.textMuted, fontWeight: '600', marginBottom: 4}}>Just now</Text>
                           <View style={{paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: simData.calc?.isValid ? colors.success+'20' : colors.danger+'20'}}>
                              <Text style={{fontSize: 10, fontWeight: '800', color: simData.calc?.isValid ? colors.success : colors.danger}}>
                                {simData.calc?.isValid ? 'APPROVED' : 'DENIED'}
                              </Text>
                           </View>
                        </View>
                     </View>
                        
                        {/* Algorithm Audit Log */}
                        <View style={{marginTop: 16, padding: 12, backgroundColor: colors.surfaceElevated, borderRadius: 12, borderWidth: 1, borderColor: colors.borderLight}}>
                           <Text style={{fontSize: 10, fontWeight: '800', color: colors.textMuted, letterSpacing: 1, marginBottom: 8}}>ALGORITHMIC ORACLE LOG</Text>
                           {(simData.calc?.driverNotes || []).map((n:any, i:number) => (
                             <View key={i} style={{flexDirection: 'row', gap: 6, marginBottom: 6, alignItems: 'flex-start'}}>
                                {n.pass 
                                  ? <CheckCircle2 size={14} color={colors.success} style={{marginTop: 2}} /> 
                                  : <X size={14} color={colors.danger} style={{marginTop: 2}} />}
                                <Text style={{fontSize: 11, color: n.pass ? colors.textSecondary : colors.danger, flex: 1, lineHeight: 16, fontWeight: '500'}}>
                                  {n.text}
                                </Text>
                             </View>
                           ))}
                        </View>
                     </View>
                   </>
                 ) : (
                   <Text style={{marginTop: 20, color: colors.textSecondary}}>No active simulation data. Open the Simulation tab to set parameters.</Text>
                 )}
                 
                 <ClayButton
                    title="Got it"
                    onPress={() => setSelectedClaim(null)}
                    style={{ marginTop: spacing.xl, width: '100%' }}
                 />
              </View>
            )}
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
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    paddingBottom: spacing.base,
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

  // Summary
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.base,
  },
  summaryCard: {
    flex: 1,
    padding: spacing.md,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: typography.lg,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 2,
  },
  summaryLabel: {
    fontSize: typography.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // List
  listContent: {
    padding: spacing.lg,
    paddingBottom: 100,
    gap: spacing.sm,
  },
  claimCard: {
    padding: spacing.base,
  },
  claimRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  claimLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  claimIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  claimInfo: {},
  claimTitle: {
    fontSize: typography.base,
    fontWeight: '600',
    color: colors.text,
  },
  claimDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  claimDate: {
    fontSize: typography.xs,
    color: colors.textMuted,
  },
  claimRight: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  claimAmount: {
    fontSize: typography.md,
    fontWeight: '700',
  },
  amountPaid: {
    color: colors.success,
  },
  amountPending: {
    color: colors.textSecondary,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxxxl,
    paddingHorizontal: spacing.xl,
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: typography.xl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: typography.base,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalCard: {
    padding: spacing.xl,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingBottom: Platform.OS === 'ios' ? 40 : spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: typography.xl,
    fontWeight: '700',
    color: colors.text,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.base,
  },
  detailItem: {
    width: '45%',
  },
  detailLabel: {
    fontSize: typography.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: typography.md,
    fontWeight: '700',
    color: colors.text,
  },
  payoutSection: {
    alignItems: 'center',
  },
  payoutLabel: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  payoutAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.success,
    marginBottom: spacing.xs,
  },
  payoutAmountEst: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  payoutDetail: {
    fontSize: typography.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
  
  // Worker Sim View
  workerSimContainer: { alignItems: 'center', paddingTop: 10 },
  workerSimBadge: { backgroundColor: colors.danger, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 99, marginBottom: 24 },
  workerSimBadgeText: { color: colors.background, fontWeight: '800', fontSize: 10, letterSpacing: 1 },
  workerSimHeader: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  workerSimIconBox: { alignItems: 'center', justifyContent: 'center' },
  workerSimTitle: { fontSize: 28, fontWeight: '900', color: colors.text, textAlign: 'center', letterSpacing: -1, lineHeight: 32 },
  workerSimSub: { fontSize: 13, color: colors.textMuted, fontWeight: '600', marginTop: 8, marginBottom: 24 },
  workerSimCard: { width: '100%', backgroundColor: colors.surface, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: colors.borderLight },
  workerSimRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  workerSimCardTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  workerSimCardBody: { fontSize: 13, color: colors.textSecondary, lineHeight: 20, marginBottom: 20 },
  workerSimMetricBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.background, padding: 16, borderRadius: 12 },
  workerSimMetric: { flex: 1, alignItems: 'center' },
  workerSimMetricLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  workerSimMetricOld: { fontSize: 20, fontWeight: '600', color: colors.textMuted, textDecorationLine: 'line-through' },
  workerSimMetricNew: { fontSize: 24, fontWeight: '900', color: colors.success },
});
