import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, RefreshControl, ScrollView,
  TouchableOpacity, Modal, Platform
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiClient } from '../api/client';
import { colors } from '../theme/colors';
import { ClayCard } from '../components/ClayCard';
import { StatusBadge } from '../components/StatusBadge';
import { SailboatIcon } from '../components/CartoonyIcons';
import { Sun, DollarSign, Shield, X } from 'lucide-react-native';

export default function ClaimsScreen() {
  const [claims, setClaims] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [totalEarned, setTotalEarned] = useState(0);
  const [selectedClaim, setSelectedClaim] = useState<any | null>(null);

  const fetchData = async () => {
    try {
      const cRes = await apiClient.get('/claims/me?limit=20');
      setClaims(cRes.data || []);

      try {
        const pRes = await apiClient.get('/claims/me/payouts?limit=50');
        const payouts = pRes.data || [];
        const total = payouts.reduce((sum: number, p: any) => sum + (p.final_amount || 0), 0);
        setTotalEarned(total);
      } catch { /* ignore */ }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { fetchData(); }, []);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setSelectedClaim(null);
      };
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, []);

  const pendingAmount = claims
    .filter(c => c.status === 'pending' || c.status === 'processing')
    .reduce((sum, c) => sum + (c.payout_estimate || 0), 0);
    
  const activeAlertsCount = claims.filter(c => c.status === 'pending' || c.status === 'processing').length;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
           <Text style={styles.title}>Claims</Text>
        </View>

        {claims.length === 0 ? (
          <ClayCard style={styles.emptyCard}>
             <View style={styles.emptyIconWrap}>
                 <SailboatIcon size={40} color="#3b82f6" style={{ marginLeft: 4 }} />
             </View>
             <Text style={styles.emptyTitle}>No Claims Yet</Text>
             <Text style={styles.emptyText}>
               When weather, AQI, or road issues happen in your zone, Float automatically creates a claim and calculates your payout.
             </Text>
          </ClayCard>
        ) : (
          <View style={styles.listsContainer}>
            {claims.map((claim) => (
               <TouchableOpacity key={claim.id} onPress={() => setSelectedClaim(claim)} activeOpacity={0.8}>
                 <ClayCard style={styles.claimRow}>
                    <View>
                       <Text style={styles.claimRowId}>Claim #{claim.id}</Text>
                       <Text style={styles.claimRowDate}>{new Date(claim.created_at).toLocaleDateString()}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                       <StatusBadge status={claim.status} />
                       <Text style={styles.claimRowAmount}>₹{claim.payout_estimate?.toFixed(0) || '0'}</Text>
                    </View>
                 </ClayCard>
               </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.gridCards}>
           <ClayCard style={styles.gridCard}>
              <Sun size={28} color="#eab308" strokeWidth={2.5} style={{ marginBottom: 12 }} />
              <Text style={styles.gridVal}>{activeAlertsCount}</Text>
              <Text style={styles.gridLabel}>ACTIVE ALERTS</Text>
           </ClayCard>
           <ClayCard style={styles.gridCard}>
              <DollarSign size={28} color="#a855f7" strokeWidth={2.5} style={{ marginBottom: 12 }} />
              <Text style={styles.gridVal}>₹{pendingAmount.toFixed(0)}</Text>
              <Text style={styles.gridLabel}>PENDING PAYOUTS</Text>
           </ClayCard>
        </View>

        <ClayCard style={styles.protectedBg}>
           <View style={styles.protectedIconWrap}>
              <Shield size={24} color="#a16207" strokeWidth={2.5} />
           </View>
           <View style={{ marginLeft: 16 }}>
              <Text style={styles.protectedTitle}>You're Protected</Text>
              <Text style={styles.protectedSub}>Monitoring 24/7 in your current zone.</Text>
           </View>
        </ClayCard>

      </ScrollView>

      {/* Detail Modal */}
      <Modal visible={!!selectedClaim} transparent animationType="slide" onRequestClose={() => setSelectedClaim(null)}>
         <View style={styles.modalOverlay}>
            <ClayCard style={styles.modalCard}>
               {selectedClaim && (
                 <>
                   <View style={styles.mHeader}>
                      <Text style={styles.mTitle}>Claim #{selectedClaim.id}</Text>
                      <TouchableOpacity onPress={() => setSelectedClaim(null)} style={styles.mClose}>
                         <X size={20} color="#64748b" />
                      </TouchableOpacity>
                   </View>
                   <StatusBadge status={selectedClaim.status} size="md" />
                   
                   <View style={styles.mGrid}>
                      <View style={styles.mItem}>
                         <Text style={styles.mItemL}>Trigger Event</Text>
                         <Text style={styles.mItemV}>#{selectedClaim.trigger_event_id}</Text>
                      </View>
                      <View style={styles.mItem}>
                         <Text style={styles.mItemL}>Fraud Score</Text>
                         <Text style={styles.mItemV}>{selectedClaim.fraud_score?.toFixed(1) || '0.0'}</Text>
                      </View>
                   </View>
                   
                   <View style={styles.mPayoutBox}>
                      <Text style={styles.mPayoutLabel}>Estimated Payout</Text>
                      <Text style={styles.mPayoutAmount}>₹{selectedClaim.payout_estimate?.toFixed(2)}</Text>
                   </View>
                 </>
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
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    paddingBottom: 120,
  },
  header: {
    marginBottom: 24,
    marginTop: 8,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: '#1e293b',
    letterSpacing: -1,
  },
  emptyCard: {
    padding: 32,
    marginBottom: 24,
    alignItems: 'center',
    textAlign: 'center',
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#dbeafe',
    borderWidth: 2,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, // inner shadow analog
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1e293b',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#475569',
    textAlign: 'center',
    lineHeight: 22,
  },
  gridCards: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  gridCard: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridVal: {
    fontSize: 32,
    fontWeight: '900',
    color: '#1e293b',
    marginBottom: 4,
  },
  gridLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 2,
  },
  protectedBg: {
    backgroundColor: 'rgba(253, 224, 71, 0.8)', // yellow-300/80
    borderColor: '#fef08a',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    marginBottom: 32,
  },
  protectedIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  protectedTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1e293b',
  },
  protectedSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginTop: 4,
  },
  listsContainer: {
    marginBottom: 24,
  },
  claimRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
  },
  claimRowId: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1e293b',
  },
  claimRowDate: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: 'bold',
    marginTop: 4,
  },
  claimRowAmount: {
    fontSize: 16,
    fontWeight: '900',
    color: '#15803d',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFF',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  mHeader: {
    flexDirection: 'row', 
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  mTitle: {
    fontSize: 24,
    fontWeight: '900',
  },
  mClose: {
    padding: 8,
  },
  mGrid: {
    flexDirection: 'row',
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 20,
  },
  mItem: {
    flex: 1,
  },
  mItemL: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '900',
    marginBottom: 4,
  },
  mItemV: {
    fontSize: 16,
    fontWeight: '900',
  },
  mPayoutBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    alignItems: 'center',
  },
  mPayoutLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '900',
    marginBottom: 4,
  },
  mPayoutAmount: {
    fontSize: 32,
    fontWeight: '900',
    color: '#10b981',
  }
});
