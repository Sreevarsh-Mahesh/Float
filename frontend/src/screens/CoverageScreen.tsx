import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, RefreshControl, ScrollView,
  TouchableOpacity, Modal, Platform
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiClient } from '../api/client';
import { colors } from '../theme/colors';
import { typography, spacing } from '../theme/constants';
import { ClayCard } from '../components/ClayCard';
import { CharacterWithUmbrella } from '../components/CartoonyIcons';
import { Shield } from 'lucide-react-native';

export default function CoverageScreen() {
  const [activePolicy, setActivePolicy] = useState<any>(null);
  const [tiers, setTiers] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [subscribingTo, setSubscribingTo] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [polRes, tiersRes] = await Promise.all([
        apiClient.get('/policies/me'),
        apiClient.get('/policies/tiers'),
      ]);
      setActivePolicy(polRes.data);
      setTiers(tiersRes.data);
    } catch (e) {
      console.error(e);
      // Fallback for missing backend data
      setTiers([
        { tier: 'basic', label: 'Basic', coverage_pct: 0.5, weekly_premium: 49 },
        { tier: 'protection', label: 'Pro', coverage_pct: 0.75, weekly_premium: 79 },
        { tier: 'advanced', label: 'Max', coverage_pct: 1.0, weekly_premium: 99 }
      ]);
    }
  };

  useEffect(() => { fetchData(); }, []);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setShowConfirm(null);
        setSubscribingTo(null);
      };
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, []);

  const handleSubscribe = async () => {
    if (!showConfirm) return;
    try {
      setSubscribingTo(showConfirm);
      await apiClient.post(`/policies/subscribe?tier=${showConfirm}`);
      setShowConfirm(null);
      await fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setSubscribingTo(null);
    }
  };

  const getTierInfo = (t: string) => {
     if (t === 'basic') return { num: 1, name: 'Basic', desc: 'Light drizzles', colorBg: '#fef3c7', colorBorder: '#fcd34d' };
     if (t === 'protection' || t === 'pro') return { num: 2, name: 'Pro', desc: 'Full protection', colorBg: 'rgba(255,255,255,0.4)', colorBorder: '#60a5fa', pop: true };
     return { num: 3, name: 'Max', desc: 'Total peace of mind', colorBg: 'rgba(255,255,255,0.2)', colorBorder: '#d8b4fe' };
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
           <Text style={styles.title}>Coverage</Text>
           <Text style={styles.subtitle}>Pick your umbrella! ☔</Text>
        </View>

        {activePolicy && (
          <ClayCard style={[styles.activeCard, { backgroundColor: '#fef08a', borderColor: '#fde047' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
               <View style={styles.activeIconWrap}>
                 <Shield size={20} color="#a16207" strokeWidth={2.5} />
               </View>
               <View style={{ marginLeft: 12 }}>
                 <Text style={styles.activePlanName}>{activePolicy.tier.charAt(0).toUpperCase() + activePolicy.tier.slice(1)} Plan</Text>
                 <Text style={styles.activePlanDesc}>
                   {Math.round(activePolicy.coverage_pct * 100)}% COVER • ₹{activePolicy.weekly_premium}/WK
                 </Text>
               </View>
            </View>
            <View style={styles.activeTag}>
              <Text style={styles.activeTagText}>ACTIVE</Text>
            </View>
          </ClayCard>
        )}

        {tiers.map((t) => {
           const info = getTierInfo(t.tier);
           const coverage = Math.round(t.coverage_pct * 100);
           const active = activePolicy?.tier === t.tier;

           return (
             <ClayCard key={t.tier} style={[styles.tierCard, { backgroundColor: info.colorBg, borderColor: info.colorBorder }]}>
                {info.pop && (
                  <View style={styles.popBadge}>
                     <Text style={styles.popBadgeText}>POPULAR</Text>
                  </View>
                )}

                <View style={styles.tierTop}>
                   <CharacterWithUmbrella tier={info.num as any} />
                   <View style={styles.tierTopRight}>
                      <View style={styles.tierNumWrap}>
                         <Text style={styles.tierNumText}>TIER {info.num}</Text>
                      </View>
                      <Text style={styles.tierName}>{info.name}</Text>
                      <Text style={styles.tierDesc}>{info.desc}</Text>
                   </View>
                </View>

                <View style={styles.tierMetrics}>
                   <View style={styles.tMetric}>
                      <Text style={styles.tMTitle}>WAGE COVER</Text>
                      <Text style={styles.tMValue}>{coverage}%</Text>
                   </View>
                   <View style={styles.tDivider} />
                   <View style={styles.tMetric}>
                      <Text style={styles.tMTitle}>PER WEEK</Text>
                      <Text style={styles.tMValue}>₹{t.weekly_premium}</Text>
                   </View>
                </View>

                {!active && (
                   <TouchableOpacity 
                     style={[styles.selectBtn, info.pop ? { backgroundColor: '#3b82f6' } : { backgroundColor: '#1e293b' }]}
                     onPress={() => setShowConfirm(t.tier)}
                   >
                     <Text style={styles.selectBtnText}>Select {info.name}</Text>
                   </TouchableOpacity>
                )}
             </ClayCard>
           );
        })}

      </ScrollView>

      {/* Confirmation Modal */}
      <Modal visible={!!showConfirm} transparent animationType="fade" onRequestClose={() => setShowConfirm(null)}>
        <View style={styles.modalOverlay}>
          <ClayCard style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirm Plan</Text>
            <Text style={styles.modalText}>
              {showConfirm
                ? `Activate the ${showConfirm.charAt(0).toUpperCase() + showConfirm.slice(1)} plan?`
                : ''
              }
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
              <TouchableOpacity style={styles.mBtnCancel} onPress={() => setShowConfirm(null)}>
                 <Text style={styles.mBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mBtnOk} onPress={handleSubscribe}>
                 <Text style={styles.mBtnOkText}>{subscribingTo ? 'Updating...' : 'Confirm'}</Text>
              </TouchableOpacity>
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
  subtitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#334155',
    marginTop: 4,
  },

  activeCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginBottom: 32,
  },
  activeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fde047',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activePlanName: {
    fontWeight: '900',
    fontSize: 16,
    color: '#1e293b',
  },
  activePlanDesc: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748b',
    marginTop: 4,
  },
  activeTag: {
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 }
  },
  activeTagText: {
    fontWeight: '900',
    fontSize: 10,
    color: '#1e293b',
  },

  tierCard: {
    padding: 24,
    marginBottom: 24,
    overflow: 'hidden',
    borderWidth: 2,
  },
  popBadge: {
    position: 'absolute',
    top: 24,
    right: -32,
    backgroundColor: '#3b82f6',
    paddingVertical: 6,
    paddingHorizontal: 40,
    transform: [{ rotate: '45deg' }],
    zIndex: 10,
  },
  popBadgeText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 1,
  },
  tierTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  tierTopRight: {
    marginLeft: 16,
    flex: 1,
  },
  tierNumWrap: {
    backgroundColor: '#e2e8f0',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  tierNumText: {
    fontWeight: '900',
    fontSize: 10,
    color: '#64748b',
  },
  tierName: {
    fontWeight: '900',
    fontSize: 32,
    color: '#1e293b',
    lineHeight: 36,
  },
  tierDesc: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#475569',
    marginTop: 4,
  },

  tierMetrics: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FFF',
    marginBottom: 20,
  },
  tMetric: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tDivider: {
    width: 1,
    backgroundColor: '#e2e8f0',
  },
  tMTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#94a3b8',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  tMValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1e293b',
  },

  selectBtn: {
    paddingVertical: 16,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }
  },
  selectBtnText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 16,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    padding: 24,
    backgroundColor: '#FFF'
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1e293b',
    marginBottom: 12,
  },
  modalText: {
    fontSize: 16,
    color: '#475569',
    fontWeight: 'bold',
  },
  mBtnCancel: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
  },
  mBtnCancelText: {
    color: '#64748b',
    fontWeight: '900',
    fontSize: 14,
  },
  mBtnOk: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    borderRadius: 16,
  },
  mBtnOkText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 14,
  }
});
