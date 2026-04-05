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
import { FloatLogo } from '../components/FloatLogo';
import { useWeather } from '../context/WeatherContext';
import {
  Shield, CloudRain, Sun, Zap, Thermometer, Wind, Car, LogOut
} from 'lucide-react-native';
import { SailboatIcon } from '../components/CartoonyIcons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Weather config logic from dummy
const weatherThemeConfig = {
  sunny: {
    zoneIcon: Sun,
    zoneColor: '#fef08a',
    zoneColorText: '#ca8a04',
    zoneBg: 'rgba(255, 255, 255, 0.4)',
    zoneTitle: 'Perfect Conditions',
    zoneDesc: 'Clear skies ahead! Roads are dry and AQI is "Excellent" (12).',
    temp: '24°C', aqi: '12 AQI', road: 'Smooth', roadColor: '#3b82f6'
  },
  rainy: {
    zoneIcon: CloudRain,
    zoneColor: '#dbeafe',
    zoneColorText: '#2563eb',
    zoneBg: 'rgba(255, 255, 255, 0.4)',
    zoneTitle: 'Wet Conditions',
    zoneDesc: 'Light rain in your zone. Roads might be slightly slippery. Ride safe!',
    temp: '18°C', aqi: '24 AQI', road: 'Wet', roadColor: '#f59e0b'
  },
  thunderstorm: {
    zoneIcon: Zap,
    zoneColor: '#f3e8ff',
    zoneColorText: '#9333ea',
    zoneBg: 'rgba(255, 255, 255, 0.4)',
    zoneTitle: 'Severe Weather',
    zoneDesc: 'Thunderstorms active! Heavy disruptions expected. Find shelter.',
    temp: '15°C', aqi: '35 AQI', road: 'Hazards', roadColor: '#ef4444'
  }
};

export default function DashboardScreen({ navigation }: any) {
  const [user, setUser] = useState<any>(null);
  const [policy, setPolicy] = useState<any>(null);
  const [claims, setClaims] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [totalPayout, setTotalPayout] = useState(0);

  const { weather } = useWeather();
  const currWeather = (weatherThemeConfig as Record<string, any>)[weather] ?? weatherThemeConfig.sunny;

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

      try {
        const payRes = await apiClient.get('/claims/me/payouts?limit=50');
        const total = (payRes.data || []).reduce(
          (sum: number, p: any) => sum + (p.final_amount || 0), 0
        );
        setTotalPayout(total);
      } catch { /* payouts might be empty */ }
    } catch (e) {
      console.error(e);
      // Keep a visual fallback state so UI never renders a blank page
      setUser((prev: any) => prev ?? { full_name: 'AJ', h3_home_cell: 'BLR1' });
      setPolicy((prev: any) => prev ?? null);
      setClaims((prev: any[]) => (prev.length ? prev : []));
      setTotalPayout((prev: number) => prev ?? 0);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, []);

  const safeUser = user ?? { full_name: 'AJ', h3_home_cell: 'BLR1' };

  // Get initials for avatar
  const initials = safeUser.full_name?.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || 'AJ';
  const hasCoverage = !!policy;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ flex: 1, paddingBottom: 100 }}>
        {/* Header */}
        <View style={styles.header}>
          <FloatLogo />
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </View>

        {/* Branding Subtitle */}
        <Text style={styles.brandingGreet}>Hi {safeUser.full_name?.split(' ')[0]},</Text>
        <Text style={styles.brandingSub}>
          {weather === 'sunny' ? "We've got you covered. Drive secure! 🛡️" : 
           weather === 'rainy' ? "Roads are getting wet. We've got your back! ☔" : 
           "Severe disruption detected. Stay safe, we are calculating! 🌩️"}
        </Text>

        {/* Main Protection Card */}
        <ClayCard style={styles.heroCard}>
          <View style={styles.heroGlow} />
          <View style={styles.heroTop}>
            <View style={[styles.statusBadge, hasCoverage ? styles.statusActive : styles.statusInactive]}>
              <Shield size={16} strokeWidth={2.5} color={hasCoverage ? '#15803d' : '#991b1b'} style={{ marginRight: 6 }} />
              <Text style={[styles.statusBadgeText, hasCoverage ? { color: '#15803d' } : { color: '#991b1b' }]}>
                {hasCoverage ? "You're Protected" : "No Protection"}
              </Text>
            </View>
            <View style={styles.activeTag}>
              <Text style={styles.activeTagText}>{hasCoverage ? 'ACTIVE' : 'INACTIVE'}</Text>
            </View>
          </View>
          
          <View style={styles.heroBottom}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
               <Text style={styles.priceBig}>{hasCoverage ? `₹${policy.weekly_premium}` : '₹0'}</Text>
               <Text style={styles.priceSub}>/wk</Text>
            </View>
            <View style={styles.sailboatWrap}>
               <SailboatIcon size={28} color="#2563eb" />
            </View>
          </View>
        </ClayCard>

        {/* Stats Grid */}
        <View style={styles.statsRow}>
          <ClayCard style={styles.statCard}>
            <Text style={styles.statLabel}>PAYOUTS</Text>
            <Text style={styles.statBig}>₹{totalPayout.toFixed(0)}</Text>
            <View style={styles.progressTrack}>
               <View style={styles.progressFill} />
            </View>
          </ClayCard>
          
          <ClayCard style={styles.statCard}>
            <Text style={styles.statLabel}>RECENT CLAIMS</Text>
            <Text style={styles.statBig}>{claims.length}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Claims')}>
              <Text style={styles.statLink}>VIEW ALL</Text>
            </TouchableOpacity>
          </ClayCard>
        </View>

        {/* Active Zone Label */}
        <View style={styles.zoneHeader}>
          <Text style={styles.zoneTitle}>Active Zone: {safeUser.h3_home_cell?.slice(0,6) || "BLR1"}</Text>
          <View style={styles.liveTag}>
            <Zap size={10} color="#9333ea" />
            <Text style={styles.liveTagText}>LIVE AI</Text>
          </View>
        </View>

        {/* Dynamic Weather Card */}
        <ClayCard style={{ padding: 0, overflow: 'hidden' }}>
           <View style={[styles.wTop, { backgroundColor: currWeather.zoneBg }]}>
              <View style={[styles.wIconWrap, { backgroundColor: currWeather.zoneColor }]}>
                 <currWeather.zoneIcon size={32} color={currWeather.zoneColorText} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                 <Text style={styles.wTitle}>{currWeather.zoneTitle}</Text>
                 <Text style={styles.wDesc}>{currWeather.zoneDesc}</Text>
              </View>
           </View>
           <View style={[styles.wBottom, { backgroundColor: 'rgba(255, 255, 255, 0.2)' }]}>
              <View style={styles.wCell}>
                 <Thermometer color="#3b82f6" size={20} style={{ marginBottom: 4 }} />
                 <Text style={styles.wCellValue}>{currWeather.temp}</Text>
              </View>
              <View style={[styles.wCell, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.4)' }]}>
                 <Wind color="#14b8a6" size={20} style={{ marginBottom: 4 }} />
                 <Text style={styles.wCellValue}>{currWeather.aqi}</Text>
              </View>
              <View style={styles.wCell}>
                 <Car color={currWeather.roadColor} size={20} style={{ marginBottom: 4 }} />
                 <Text style={styles.wCellValue}>{currWeather.road}</Text>
              </View>
           </View>
        </ClayCard>
      </View>
    </ScrollView>
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 8,
    zIndex: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }
  },
  avatarText: {
    fontWeight: '900',
    fontSize: 16,
    color: '#2563ea'
  },
  brandingGreet: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1e293b',
    marginTop: 8,
  },
  brandingSub: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#475569',
    marginBottom: 20,
  },

  // Hero Card
  heroCard: {
    padding: 24,
    marginBottom: 20,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    backgroundColor: '#bbf7d0',
    borderRadius: 80,
    opacity: 0.4,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    zIndex: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
  },
  statusActive: {
    backgroundColor: '#dcfce7',
    borderColor: '#bbf7d0',
  },
  statusInactive: {
    backgroundColor: '#fee2e2',
    borderColor: '#fecaca',
  },
  statusBadgeText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  activeTag: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  activeTagText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    zIndex: 2,
  },
  priceBig: {
    fontSize: 52,
    fontWeight: '900',
    color: '#1e293b',
    letterSpacing: -2,
    lineHeight: 52,
  },
  priceSub: {
    fontSize: 20,
    fontWeight: '900',
    color: '#64748b',
    marginLeft: 4,
    marginBottom: 4,
  },
  sailboatWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#dbeafe',
    borderWidth: 2,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },

  // Stats Grid
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  statBig: {
    fontSize: 32,
    fontWeight: '900',
    color: '#1e293b',
    marginBottom: 12,
  },
  progressTrack: {
    width: 64,
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    width: '30%',
    height: '100%',
    backgroundColor: '#3b82f6',
  },
  statLink: {
    fontSize: 12,
    fontWeight: '900',
    color: '#3b82f6',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Active Zone
  zoneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  zoneTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1e293b',
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f3e8ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#FFF',
  },
  liveTagText: {
    color: '#7e22ce',
    fontWeight: '900',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  wTop: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.4)',
    gap: 16,
  },
  wIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  wTitle: {
    fontWeight: '900',
    fontSize: 18,
    color: '#1e293b',
  },
  wDesc: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#475569',
    marginTop: 4,
    lineHeight: 20,
  },
  wBottom: {
    flexDirection: 'row',
  },
  wCell: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wCellValue: {
    fontWeight: '900',
    fontSize: 16,
    color: '#1e293b',
  }
});
