import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Platform,
  TouchableOpacity, Switch, Animated
} from 'react-native';
import { colors } from '../theme/colors';
import { typography, spacing, radius } from '../theme/constants';
import { ClayCard } from '../components/ClayCard';
import { FloatInput } from '../components/FloatInput';
import {
  Beaker, Calculator, CloudRain, Wind, ThermometerSun,
  AlertOctagon, Clock, MapPin, CheckCircle2, XCircle,
  ChevronRight, Activity, TrendingDown, Shield, Zap,
  AlertTriangle, BarChart2, Navigation, Wifi, Sun
} from 'lucide-react-native';
import { useWeather } from '../context/WeatherContext';

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

const CITIES = [
  { id: 'chennai', name: 'Chennai', avgRain: 15, maxAqi: 200, maxTemp: 42, avgSpeed: 35, avgEarnings: 650, floodFreq: 0.7, heatDays: 40, aqiDays: 20 },
  { id: 'delhi', name: 'Delhi', avgRain: 5, maxAqi: 500, maxTemp: 48, avgSpeed: 40, avgEarnings: 800, floodFreq: 0.2, heatDays: 90, aqiDays: 120 },
  { id: 'mumbai', name: 'Mumbai', avgRain: 25, maxAqi: 250, maxTemp: 38, avgSpeed: 30, avgEarnings: 850, floodFreq: 0.9, heatDays: 10, aqiDays: 30 },
  { id: 'blr', name: 'Bangalore', avgRain: 10, maxAqi: 150, maxTemp: 35, avgSpeed: 25, avgEarnings: 750, floodFreq: 0.3, heatDays: 5, aqiDays: 15 },
];

const TIERS = [
  { id: 'basic', label: 'Basic', coverage: 0.50, tierThreshold: 3, rate: 0.030, weeklyMin: 80, weeklyMax: 150 },
  { id: 'protection', label: 'Protection', coverage: 0.75, tierThreshold: 2, rate: 0.040, weeklyMin: 120, weeklyMax: 200 },
  { id: 'advanced', label: 'Advanced', coverage: 1.00, tierThreshold: 1, rate: 0.050, weeklyMin: 160, weeklyMax: 250 },
];

const EVENT_TYPES = [
  { id: 'rain', label: 'Rain / Flood', icon: CloudRain, fraudRisk: 'LOW', color: '#4A9EFF' },
  { id: 'aqi', label: 'Toxic AQI', icon: Wind, fraudRisk: 'LOW', color: '#A78BFA' },
  { id: 'heat', label: 'Extreme Heat', icon: ThermometerSun, fraudRisk: 'LOW', color: '#FB923C' },
  { id: 'closure', label: 'Curfew / Bandh', icon: AlertOctagon, fraudRisk: 'MEDIUM', color: '#F59E0B' },
  { id: 'platform', label: 'Platform Down', icon: Wifi, fraudRisk: 'LOW', color: '#34D399' },
  { id: 'road', label: 'Road Anomaly', icon: Navigation, fraudRisk: 'MEDIUM', color: '#60A5FA' },
  { id: 'unpaid', label: 'Unpaid Delay', icon: Clock, fraudRisk: 'HIGH', color: '#F87171' },
];

// Scaling factors per event
const SCALING = { rain: 0.8, aqi: 0.7, heat: 0.75, closure: 1.0, platform: 0.6 };

// Weekly variance simulation (last 8 weeks mock)
const MOCK_WEEKLY_LOSSES = [400, 0, 600, 200, 0, 800, 0, 300];

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const fmt = (v: number) => `₹${Math.round(v).toLocaleString('en-IN')}`;
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const getRiskColor = (score: number) => score < 0.3 ? colors.success : score < 0.6 ? '#F59E0B' : colors.danger;
const getRiskLabel = (score: number) => score < 0.3 ? 'LOW' : score < 0.6 ? 'MEDIUM' : 'HIGH';

// ─────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────

const MetricRow = ({ label, value, sub, valueColor }: any) => (
  <View style={mc.row}>
    <Text style={mc.label}>{label}</Text>
    <View style={{ alignItems: 'flex-end' }}>
      <Text style={[mc.value, valueColor && { color: valueColor }]}>{value}</Text>
      {sub ? <Text style={mc.sub}>{sub}</Text> : null}
    </View>
  </View>
);

const mc = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  label: { fontSize: typography.xs, color: colors.textSecondary, fontWeight: '900', flex: 1 },
  value: { fontSize: typography.sm, color: colors.text, fontWeight: '900' },
  sub: { fontSize: 10, color: colors.textMuted, fontWeight: '900', marginTop: 1 },
});

const SectionHeading = ({ num, title }: { num: string; title: string }) => (
  <View style={sh.wrap}>
    <View style={sh.badge}><Text style={sh.num}>{num}</Text></View>
    <Text style={sh.title}>{title}</Text>
  </View>
);
const sh = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.sm, marginTop: spacing.lg },
  badge: { backgroundColor: colors.text, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  num: { fontSize: 11, fontWeight: '900', color: colors.background, letterSpacing: 0.5 },
  title: { fontSize: typography.sm, fontWeight: '900', color: colors.text, letterSpacing: 0.3 },
});

const FormulaBox = ({ formula }: { formula: string }) => (
  <View style={fb.wrap}><Text style={fb.text}>{formula}</Text></View>
);
const fb = StyleSheet.create({
  wrap: { backgroundColor: colors.background, borderRadius: 10, padding: 10, marginBottom: spacing.sm, borderLeftWidth: 3, borderLeftColor: colors.primary },
  text: { fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', color: colors.primary, lineHeight: 18 },
});

const TierPayoutRow = ({ label, basic, prot, adv }: any) => (
  <View style={tp.row}>
    <Text style={tp.label}>{label}</Text>
    <Text style={[tp.val, { color: '#60A5FA' }]}>{fmt(basic)}</Text>
    <Text style={[tp.val, { color: '#A78BFA' }]}>{fmt(prot)}</Text>
    <Text style={[tp.val, { color: '#34D399' }]}>{fmt(adv)}</Text>
  </View>
);
const tp = StyleSheet.create({
  row: { flexDirection: 'row', paddingVertical: 7, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight, alignItems: 'center' },
  label: { flex: 1.5, fontSize: 11, color: colors.textSecondary, fontWeight: '900' },
  val: { flex: 1, fontSize: 11, fontWeight: '900', textAlign: 'right' },
});

const ProbBar = ({ label, prob, color }: { label: string; prob: number; color: string }) => (
  <View style={{ marginBottom: 10 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
      <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '900' }}>{label}</Text>
      <Text style={{ fontSize: 11, color, fontWeight: '900' }}>{pct(prob)}</Text>
    </View>
    <View style={{ height: 6, backgroundColor: colors.borderLight, borderRadius: 3, overflow: 'hidden' }}>
      <View style={{ height: 6, width: `${clamp(prob * 100, 0, 100)}%`, backgroundColor: color, borderRadius: 3 }} />
    </View>
  </View>
);

// ─────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────

export default function SimulationScreen() {
  const { weather, setWeather } = useWeather();
  // ── Section 1: Baseline Inputs ──
  const [dailyEarningsStr, setDailyEarnings] = useState('800');
  const [activeHoursStr, setActiveHours] = useState('10');
  const [activeDays, setActiveDays] = useState('24');
  const [earn30Str, setEarn30] = useState('19200');
  const [selectedTier, setSelectedTier] = useState(TIERS[1]);
  const [selectedCity, setSelectedCity] = useState(CITIES[0]);
  const [claimsHistory, setClaimsHistory] = useState<'none' | 'normal' | 'high'>('normal');

  // ── Section 2: H3 Zone Risk ──
  const [wRain, setWRain] = useState('0.4');
  const [wAqi, setWAqi] = useState('0.2');
  const [wFlood, setWFlood] = useState('0.3');
  const [wProtest, setWProtest] = useState('0.1');
  // Cell A & B for driver trajectory
  const [cellATime, setCellATime] = useState('60');  // % time
  const [cellARain, setCellARain] = useState('0.7');
  const [cellAAqi, setCellAAqi] = useState('0.4');
  const [cellAFlood, setCellAFlood] = useState('0.8');
  const [cellAProtest, setCellAProtest] = useState('0.2');
  const [cellBRain, setCellBRain] = useState('0.2');
  const [cellBAqi, setCellBAqi] = useState('0.3');
  const [cellBFlood, setCellBFlood] = useState('0.1');
  const [cellBProtest, setCellBProtest] = useState('0.0');

  // ── Section 3: Event Simulation ──
  const [eventType, setEventType] = useState(EVENT_TYPES[0]);
  const [currRainStr, setCurrRain] = useState('55');
  const [currAqiStr, setCurrAqi] = useState('320');
  const [currTempStr, setCurrTemp] = useState('46');
  const [hasHeatAlert, setHasHeatAlert] = useState(false);
  const [hasGazette, setHasGazette] = useState(true);
  const [closureHours, setClosureHours] = useState('4');
  const [downtimeMins, setDowntimeMins] = useState('120');
  const [uptimeSLA, setUptimeSLA] = useState('99');
  // Road anomaly inputs
  const [histSpeed, setHistSpeed] = useState('35');
  const [currSpeed, setCurrSpeed] = useState('18');
  const [speedVariance, setSpeedVariance] = useState('4');
  const [gridConsensus, setGridConsensus] = useState(true);
  const [slowCount, setSlowCount] = useState('2');
  const [gpsInZone, setGpsInZone] = useState(true);

  // ── Section 4: Premium Modifiers ──
  const [isMonsoon, setIsMonsoon] = useState(false);
  const [alphaLoad, setAlphaLoad] = useState('0.3');

  // ─────────────────────────────────────────────
  // MASTER CALCULATION
  // ─────────────────────────────────────────────
  const calc = useMemo(() => {
    const city = selectedCity;
    const tier = selectedTier;

    // ── 1. Financial Baselines ──
    const adays = parseFloat(activeDays) || 24;
    const earn30 = parseFloat(earn30Str) || 0;
    const Ed = earn30 / adays;                          // μ_day
    const Ah = parseFloat(activeHoursStr) || 1;
    const Eh = Ed / Ah;                                 // E_h
    const LEI = Ed / city.avgEarnings;                   // LEI

    // Weekly stats
    const weeklyIncome = Ed * 6;
    const weeklyVariance = MOCK_WEEKLY_LOSSES.reduce((s, v) => s + Math.pow(v - Ed, 2), 0) / 7;
    const weeklyStdDev = Math.sqrt(weeklyVariance);
    const anomalyThreshold = 3 * weeklyStdDev;

    // ── 2. H3 Zone Risk ──
    const wr = parseFloat(wRain) || 0;
    const wa = parseFloat(wAqi) || 0;
    const wf = parseFloat(wFlood) || 0;
    const wp = parseFloat(wProtest) || 0;
    const weightsOk = Math.abs(wr + wa + wf + wp - 1.0) < 0.05;

    const riskCell = (rain: string, aqi: string, flood: string, protest: string) =>
      wr * parseFloat(rain) + wa * parseFloat(aqi) + wf * parseFloat(flood) + wp * parseFloat(protest);

    const scoreA = riskCell(cellARain, cellAAqi, cellAFlood, cellAProtest);
    const scoreB = riskCell(cellBRain, cellBAqi, cellBFlood, cellBProtest);
    const tA = clamp(parseFloat(cellATime) / 100, 0, 1);
    const tB = 1 - tA;
    const R_driver = tA * scoreA + tB * scoreB;

    // ── 3. Factor Probabilities ──
    // Environmental (sigmoid)
    const envZ = 2.0 * R_driver - 0.5;
    const pEnv = sigmoid(envZ);

    // Social / Poisson
    const lambda = city.floodFreq * 0.5;
    const dt = 3;
    const pSoc = 1 - Math.exp(-lambda * dt);

    // Platform (SLA-based)
    const pSys = 1 - parseFloat(uptimeSLA) / 100;

    // Delay queuing (sigmoid)
    const rho = 1.4;
    const rDens = 8;
    const delayZ = 0.8 * (rho - 1) + 0.05 * rDens - 0.2;
    const pDelay = sigmoid(delayZ);

    const pBlended = (pEnv + pSoc + pSys + pDelay) / 4;

    // ── 4. Payout Calculation ──
    const Ct = tier.coverage;
    const maxDaily = Ct * Ed;
    let payout = 0;
    let isValid = true;
    const notes: { pass: boolean; text: string }[] = [];

    // GPS fraud pre-check
    if (!gpsInZone) {
      isValid = false;
      notes.push({ pass: false, text: 'GPS FRAUD: Worker trajectory did not intersect claimed zone. Auto-rejected.' });
    }

    if (eventType.id === 'rain') {
      const cRain = parseFloat(currRainStr) || 0;
      if (cRain < 50) {
        isValid = false;
        notes.push({ pass: false, text: `Rainfall ${cRain}mm below 50mm IMD Red Alert threshold.` });
      } else {
        notes.push({ pass: true, text: `Rain event confirmed: ${cRain}mm ≥ 50mm. Source: OpenWeather/IMD API.` });
        payout = SCALING.rain * (cRain / city.avgRain) * Eh * Ct;
        notes.push({ pass: true, text: `Formula: ${SCALING.rain} × (${cRain}/${city.avgRain}) × E_h × C_tier` });
      }
    }
    else if (eventType.id === 'aqi') {
      const cAqi = parseFloat(currAqiStr) || 0;
      if (cAqi < 301) {
        isValid = false;
        notes.push({ pass: false, text: `AQI ${cAqi} below CPCB Severe threshold (≥301).` });
      } else {
        notes.push({ pass: true, text: `AQI event confirmed: ${cAqi} ≥ 301. Source: CPCB/IQAir API.` });
        payout = (cAqi / city.maxAqi) * SCALING.aqi * Ct * Ed;
        notes.push({ pass: true, text: `Formula: (${cAqi}/${city.maxAqi}) × ${SCALING.aqi} × C_tier × E_d` });
      }
    }
    else if (eventType.id === 'heat') {
      const cTemp = parseFloat(currTempStr) || 0;
      if (cTemp < 45 && !hasHeatAlert) {
        isValid = false;
        notes.push({ pass: false, text: `Temp ${cTemp}°C below 45°C and no IMD directive active.` });
      } else {
        notes.push({ pass: true, text: `Heat event confirmed: ${cTemp}°C OR IMD directive. Source: IMD API.` });
        payout = 1 * (cTemp / city.maxTemp) * Ed * Ct * SCALING.heat;
        notes.push({ pass: true, text: `Formula: 1 × (${cTemp}/${city.maxTemp}) × E_d × C_tier × ${SCALING.heat}` });
      }
    }
    else if (eventType.id === 'closure') {
      if (!hasGazette) {
        isValid = false;
        notes.push({ pass: false, text: 'No official Gazette / Google Maps Disruption API flag found.' });
      } else {
        const cHours = parseFloat(closureHours) || 0;
        if (cHours < 2) {
          isValid = false;
          notes.push({ pass: false, text: `Closure duration ${cHours}h below 2-hour minimum waiting period.` });
        } else {
          notes.push({ pass: true, text: `Closure confirmed: ${cHours}h ≥ 2h. Source: Govt. Gazette / Maps API.` });
          payout = Math.min(cHours * Eh, Ed) * Ct;
          notes.push({ pass: true, text: `Formula: min(${cHours}h × E_h, E_d) × C_tier` });
        }
      }
    }
    else if (eventType.id === 'platform') {
      const mins = parseFloat(downtimeMins) || 0;
      const sla = parseFloat(uptimeSLA) / 100;
      if (mins < 120) {
        isValid = false;
        notes.push({ pass: false, text: `Downtime ${mins}min below 120min metro-scale minimum.` });
      } else {
        notes.push({ pass: true, text: `Platform outage confirmed: ${mins}min. Source: Downdetector + Platform Status API.` });
        payout = (mins / 60) * Eh * Ct * SCALING.platform;
        notes.push({ pass: true, text: `Formula: (M_down/60) × E_h × C_tier × ${SCALING.platform}` });
      }
    }
    else if (eventType.id === 'road') {
      const hs = parseFloat(histSpeed) || 1;
      const cs = parseFloat(currSpeed) || 0;
      const sv = parseFloat(speedVariance) || 1;
      const sc = parseInt(slowCount) || 0;
      const spread = hs - cs;
      const triggered = spread > 3 * sv;

      notes.push({ pass: triggered, text: `Speed spread: ${spread.toFixed(1)} km/h ${triggered ? '>' : '≤'} 3σ (${(3 * sv).toFixed(1)})` });
      notes.push({ pass: gridConsensus, text: `Grid consensus: ${gridConsensus ? 'YES — other drivers confirm anomaly' : 'NO — isolated anomaly, not confirmed'}` });
      notes.push({ pass: sc >= tier.tierThreshold, text: `Slow delivery count: ${sc} ${sc >= tier.tierThreshold ? '≥' : '<'} tier threshold (${tier.tierThreshold})` });

      if (!triggered || !gridConsensus || sc < tier.tierThreshold) {
        isValid = false;
        notes.push({ pass: false, text: 'Road anomaly payout DENIED: all three conditions must pass.' });
      } else {
        notes.push({ pass: true, text: `Road anomaly confirmed. Excess time = ${(spread / hs * 100).toFixed(0)}% slowdown.` });
        const excessHours = Math.max(0, spread / hs);
        payout = excessHours * Eh * Ct;
      }
    }
    else if (eventType.id === 'unpaid') {
      isValid = false;
      notes.push({ pass: false, text: 'PERMANENTLY EXCLUDED: Unpaid delays create extreme moral hazard.' });
      notes.push({ pass: false, text: 'No independent third-party signal available. Driver and platform data cannot be reconciled.' });
    }

    // Apply cap
    if (isValid && payout > maxDaily) {
      notes.push({ pass: true, text: `Daily payout cap applied: ${fmt(payout)} → ${fmt(maxDaily)}` });
      payout = maxDaily;
    }
    if (!isValid) payout = 0;

    // 4-day weekly cap
    const weeklyCapPayout = maxDaily * 4;

    // ── 5. TER + Premium ──
    const elHex = pBlended * (Ct * Ed);
    const nhex = 8;
    const whex = 80;
    const TER = nhex * whex * elHex;
    const varTER = TER * 0.4;
    const alpha = parseFloat(alphaLoad) || 0.3;
    const rLoad = alpha * Math.sqrt(varTER);
    const margin = 0.15;

    // Claims modifier
    const claimsMod = claimsHistory === 'none' ? 0.90 : claimsHistory === 'high' ? 1.15 : 1.00;
    // Seasonal
    const seasonMod = isMonsoon ? 1.25 : 1.00;

    const P_raw = (TER + rLoad) * (1 + margin) * LEI;
    const P_final = clamp(P_raw * claimsMod * seasonMod, tier.weeklyMin, tier.weeklyMax);

    // Uncertainty buffer (actuarial)
    const uncertainty = 1.96 * weeklyStdDev;

    // Loss ratio
    const expectedPayout = P_final * 0.54;
    const opsAlloc = P_final * 0.20;
    const netMargin = P_final - expectedPayout - opsAlloc;
    const lossRatio = (expectedPayout / P_final) * 100;

    // Cross-tier payout table for current event
    const crossTierPayouts = [0.50, 0.75, 1.00].map(ct => {
      if (!isValid) return 0;
      if (eventType.id === 'rain') return Math.min(SCALING.rain * (parseFloat(currRainStr) / city.avgRain) * Eh * ct, ct * Ed);
      if (eventType.id === 'aqi') return Math.min((parseFloat(currAqiStr) / city.maxAqi) * SCALING.aqi * ct * Ed, ct * Ed);
      if (eventType.id === 'heat') return Math.min((parseFloat(currTempStr) / city.maxTemp) * Ed * ct * SCALING.heat, ct * Ed);
      if (eventType.id === 'closure') return Math.min(parseFloat(closureHours) * Eh, Ed) * ct;
      if (eventType.id === 'platform') return Math.min((parseFloat(downtimeMins) / 60) * Eh * ct * SCALING.platform, ct * Ed);
      return 0;
    });

    return {
      // Baselines
      Ed, Eh, LEI, weeklyIncome, weeklyVariance, weeklyStdDev, anomalyThreshold,
      // Zone
      scoreA, scoreB, R_driver, weightsOk,
      // Probabilities
      pEnv, pSoc, pSys, pDelay, pBlended,
      // Payout
      payout, maxDaily, weeklyCapPayout, isValid, notes,
      crossTierPayouts,
      // Premium
      TER, rLoad, P_raw, P_final, claimsMod, seasonMod,
      expectedPayout, opsAlloc, netMargin, lossRatio, uncertainty,
      elHex,
    };
  }, [
    selectedCity, selectedTier, earn30Str, activeDays, activeHoursStr,
    wRain, wAqi, wFlood, wProtest,
    cellATime, cellARain, cellAAqi, cellAFlood, cellAProtest,
    cellBRain, cellBAqi, cellBFlood, cellBProtest,
    eventType, currRainStr, currAqiStr, currTempStr,
    hasHeatAlert, hasGazette, closureHours,
    downtimeMins, uptimeSLA,
    histSpeed, currSpeed, speedVariance, gridConsensus, slowCount,
    gpsInZone, claimsHistory, isMonsoon, alphaLoad,
  ]);

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Weather Lab Visual Toggles */}
        <View style={{ marginBottom: spacing.xl, marginTop: spacing.sm }}>
          <Text style={{ fontSize: 36, fontWeight: '900', color: '#1e293b', letterSpacing: -1 }}>Weather Lab</Text>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#475569', marginTop: 4, marginBottom: 20 }}>Play god! 🧪</Text>
          
          <View style={{ gap: 12 }}>
            {[
              { id: 'sunny', label: 'Sunny Day', icon: Sun, color: '#eab308', bg: '#fef08a' },
              { id: 'rainy', label: 'Rainy Day', icon: CloudRain, color: '#3b82f6', bg: '#dbeafe' },
              { id: 'thunderstorm', label: 'Thunderstorm', icon: Zap, color: '#9333ea', bg: '#f3e8ff' }
            ].map(w => {
              const isActive = weather === w.id;
              const Icon = w.icon;
              return (
                <TouchableOpacity
                  key={w.id}
                  onPress={() => setWeather(w.id as any)}
                  style={{
                    backgroundColor: isActive ? '#FFF' : 'rgba(255,255,255,0.7)',
                    borderWidth: 2,
                    borderColor: isActive ? '#3b82f6' : 'rgba(255,255,255,0)',
                    padding: 20,
                    borderRadius: 32,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    shadowColor: isActive ? '#3b82f6' : '#000',
                    shadowOpacity: isActive ? 0.3 : 0.05,
                    shadowRadius: isActive ? 15 : 10,
                    shadowOffset: { width: 0, height: 4 },
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                    <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: w.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFF' }}>
                      <Icon size={28} color={w.color} strokeWidth={2.5} />
                    </View>
                    <Text style={{ fontSize: 20, fontWeight: '900', color: '#1e293b' }}>{w.label}</Text>
                  </View>
                  {isActive && <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#3b82f6' }} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Header */}
        <View style={s.header}>
          <View style={s.iconWrap}><Beaker size={24} color={colors.primary} /></View>
          <View>
            <Text style={s.title}>Actuarial Sandbox</Text>
            <Text style={s.subtitle}>Deep algorithm manual overrides</Text>
          </View>
        </View>

        {/* ══════════════════════════════════════════
            RESULT HERO — always visible at top
        ══════════════════════════════════════════ */}
        <View style={[s.resultCard, calc.isValid ? s.resultOk : s.resultFail]}>
          <View style={s.resultHd}>
            {calc.isValid
              ? <CheckCircle2 size={20} color={colors.success} />
              : <XCircle size={20} color={colors.danger} />}
            <Text style={[s.resultTitle, { color: calc.isValid ? colors.success : colors.danger }]}>
              {calc.isValid ? 'PAYOUT APPROVED' : 'TRIGGER FAILED'}
            </Text>
            <View style={[s.fraudBadge, { backgroundColor: eventType.color + '20' }]}>
              <Text style={[s.fraudText, { color: eventType.color }]}>
                {eventType.fraudRisk} FRAUD RISK
              </Text>
            </View>
          </View>

          <Text style={s.payoutBig}>{fmt(calc.payout)}</Text>
          <Text style={s.payoutSub}>
            {selectedTier.label} tier · {(selectedTier.coverage * 100).toFixed(0)}% wage protection
          </Text>

          {/* 3-tier comparison */}
          <View style={s.tierCompare}>
            {[
              { label: 'Basic', val: calc.crossTierPayouts[0], color: '#60A5FA' },
              { label: 'Protection', val: calc.crossTierPayouts[1], color: '#A78BFA' },
              { label: 'Advanced', val: calc.crossTierPayouts[2], color: '#34D399' },
            ].map(t => (
              <View key={t.label} style={[s.tcCard, selectedTier.label === t.label && { borderColor: t.color, borderWidth: 2 }]}>
                <Text style={[s.tcVal, { color: t.color }]}>{fmt(t.val)}</Text>
                <Text style={s.tcLabel}>{t.label}</Text>
              </View>
            ))}
          </View>

          {/* Validation notes */}
          {calc.notes.map((n, i) => (
            <View key={i} style={s.noteRow}>
              {n.pass
                ? <CheckCircle2 size={14} color={colors.success} />
                : <XCircle size={14} color={colors.danger} />}
              <Text style={[s.noteText, { color: n.pass ? colors.textSecondary : colors.danger }]}>{n.text}</Text>
            </View>
          ))}
        </View>

        {/* ══ SECTION 1: Financial Baselines ══ */}
        <SectionHeading num="01" title="FINANCIAL BASELINES" />
        <ClayCard style={s.card}>
          <FormulaBox formula={
            `μ_day = ΣEarnings / ActiveDays\n` +
            `E_h   = μ_day / AvgHours\n` +
            `LEI   = μ_day / CityAvg\n` +
            `σ_week = √(Σ(d_i - μ)² / 7)  |  Anomaly = 3σ`
          } />

          {/* City selector */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {CITIES.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[s.pill, selectedCity.id === c.id && s.pillActive]}
                  onPress={() => setSelectedCity(c)}>
                  <MapPin size={12} color={selectedCity.id === c.id ? colors.background : colors.textMuted} />
                  <Text style={[s.pillTxt, selectedCity.id === c.id && s.pillTxtActive]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* City stats */}
          <View style={s.cityStats}>
            {[
              { l: 'City avg E_avg', v: fmt(selectedCity.avgEarnings) + '/day' },
              { l: 'Avg rain', v: selectedCity.avgRain + 'mm' },
              { l: 'Max AQI', v: selectedCity.maxAqi.toString() },
              { l: 'Max temp', v: selectedCity.maxTemp + '°C' },
            ].map(x => (
              <View key={x.l} style={s.cityStatItem}>
                <Text style={s.csl}>{x.l}</Text>
                <Text style={s.csv}>{x.v}</Text>
              </View>
            ))}
          </View>

          {/* Inputs */}
          <View style={s.inputRow}>
            <FloatInput label="Total 30-day earnings (₹)" value={earn30Str} onChangeText={setEarn30} keyboardType="numeric" containerStyle={{ flex: 1, marginRight: 8 }} />
            <FloatInput label="Active days" value={activeDays} onChangeText={setActiveDays} keyboardType="numeric" containerStyle={{ flex: 0.6 }} />
          </View>
          <View style={s.inputRow}>
            <FloatInput label="Avg shift hours/day" value={activeHoursStr} onChangeText={setActiveHours} keyboardType="numeric" containerStyle={{ flex: 1 }} />
          </View>

          {/* Computed baselines */}
          <View style={s.metricsBox}>
            <MetricRow label="μ_day (E_d)" value={fmt(calc.Ed)} sub="daily avg" />
            <MetricRow label="E_h · hourly rate" value={fmt(calc.Eh)} sub="per active hour" />
            <MetricRow label="LEI · local index" value={calc.LEI.toFixed(3)} valueColor={calc.LEI >= 1 ? colors.success : '#F59E0B'} sub={calc.LEI >= 1 ? 'above city avg' : 'below city avg'} />
            <MetricRow label="Weekly income base" value={fmt(calc.weeklyIncome)} sub="6 active days" />
            <MetricRow label="σ_week (std dev)" value={fmt(calc.weeklyStdDev)} />
            <MetricRow label="Anomaly threshold (3σ)" value={fmt(calc.anomalyThreshold)} valueColor={colors.danger} />
          </View>

          {/* Tier */}
          <Text style={s.inputLabel}>COVERAGE TIER</Text>
          <View style={s.tierRow}>
            {TIERS.map(t => (
              <TouchableOpacity key={t.id} style={[s.tierBtn, selectedTier.id === t.id && s.tierBtnActive]} onPress={() => setSelectedTier(t)}>
                <Text style={[s.tierTxt, selectedTier.id === t.id && s.tierTxtActive]}>{t.label}</Text>
                <Text style={[s.tierSub, selectedTier.id === t.id && { color: colors.primary }]}>{(t.coverage * 100).toFixed(0)}%</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ClayCard>

        {/* ══ SECTION 2: H3 Zone Risk ══ */}
        <SectionHeading num="02" title="H3 ZONE RISK SCORING" />
        <ClayCard style={s.card}>
          <FormulaBox formula={
            `RiskScore(c) = w_r·rain + w_a·AQI + w_f·flood + w_p·protest\n` +
            `R_driver = Σ (t_c / T_total) × RiskScore(c)`
          } />

          {!calc.weightsOk && (
            <View style={s.warnBox}>
              <AlertTriangle size={14} color="#F59E0B" />
              <Text style={s.warnTxt}>Weights should sum to 1.0</Text>
            </View>
          )}

          <Text style={s.inputLabel}>FACTOR WEIGHTS</Text>
          <View style={s.inputRow}>
            <FloatInput label="w_rain" value={wRain} onChangeText={setWRain} keyboardType="numeric" containerStyle={{ flex: 1, marginRight: 6 }} />
            <FloatInput label="w_AQI" value={wAqi} onChangeText={setWAqi} keyboardType="numeric" containerStyle={{ flex: 1, marginRight: 6 }} />
            <FloatInput label="w_flood" value={wFlood} onChangeText={setWFlood} keyboardType="numeric" containerStyle={{ flex: 1, marginRight: 6 }} />
            <FloatInput label="w_protest" value={wProtest} onChangeText={setWProtest} keyboardType="numeric" containerStyle={{ flex: 1 }} />
          </View>

          <Text style={s.inputLabel}>CELL A — HIGH RISK ZONE</Text>
          <View style={s.inputRow}>
            <FloatInput label="Time share (%)" value={cellATime} onChangeText={setCellATime} keyboardType="numeric" containerStyle={{ flex: 1, marginRight: 6 }} />
            <FloatInput label="Rain score" value={cellARain} onChangeText={setCellARain} keyboardType="numeric" containerStyle={{ flex: 1, marginRight: 6 }} />
            <FloatInput label="AQI score" value={cellAAqi} onChangeText={setCellAAqi} keyboardType="numeric" containerStyle={{ flex: 1 }} />
          </View>
          <View style={s.inputRow}>
            <FloatInput label="Flood score" value={cellAFlood} onChangeText={setCellAFlood} keyboardType="numeric" containerStyle={{ flex: 1, marginRight: 6 }} />
            <FloatInput label="Protest score" value={cellAProtest} onChangeText={setCellAProtest} keyboardType="numeric" containerStyle={{ flex: 1 }} />
          </View>

          <Text style={s.inputLabel}>CELL B — LOW RISK ZONE</Text>
          <View style={s.inputRow}>
            <FloatInput label="Rain score" value={cellBRain} onChangeText={setCellBRain} keyboardType="numeric" containerStyle={{ flex: 1, marginRight: 6 }} />
            <FloatInput label="AQI score" value={cellBAqi} onChangeText={setCellBAqi} keyboardType="numeric" containerStyle={{ flex: 1, marginRight: 6 }} />
            <FloatInput label="Flood score" value={cellBFlood} onChangeText={setCellBFlood} keyboardType="numeric" containerStyle={{ flex: 1, marginRight: 6 }} />
            <FloatInput label="Protest score" value={cellBProtest} onChangeText={setCellBProtest} keyboardType="numeric" containerStyle={{ flex: 1 }} />
          </View>

          <View style={s.metricsBox}>
            <MetricRow label="RiskScore — Cell A" value={calc.scoreA.toFixed(3)} valueColor={getRiskColor(calc.scoreA)} sub={`${(parseFloat(cellATime))}% time · ${getRiskLabel(calc.scoreA)}`} />
            <MetricRow label="RiskScore — Cell B" value={calc.scoreB.toFixed(3)} valueColor={getRiskColor(calc.scoreB)} sub={`${(100 - parseFloat(cellATime))}% time · ${getRiskLabel(calc.scoreB)}`} />
            <MetricRow label="R_driver (weighted avg)" value={calc.R_driver.toFixed(3)} valueColor={getRiskColor(calc.R_driver)} sub={getRiskLabel(calc.R_driver) + ' zone'} />
          </View>
        </ClayCard>

        {/* ══ SECTION 3: Factor Probabilities ══ */}
        <SectionHeading num="03" title="FACTOR PROBABILITIES · PyTorch Engine" />
        <ClayCard style={s.card}>
          <FormulaBox formula={
            `P_env  = σ(wᵀX + b)         [logistic sigmoid]\n` +
            `P_soc  = 1 − e^(−λΔt)       [Poisson process]\n` +
            `P_sys  = 1 − Uptime_SLA\n` +
            `P_delay= σ(α·ρ + β·RestDen + ε)`
          } />
          <ProbBar label="P(env trigger) — environmental" prob={calc.pEnv} color="#4A9EFF" />
          <ProbBar label="P(soc trigger) — social / Poisson" prob={calc.pSoc} color="#F59E0B" />
          <ProbBar label="P(sys fail) — platform SLA" prob={calc.pSys} color="#34D399" />
          <ProbBar label="P(delay) — queuing model" prob={calc.pDelay} color="#A78BFA" />
          <View style={[s.metricsBox, { marginTop: 8 }]}>
            <MetricRow label="Blended P(trigger)" value={pct(calc.pBlended)} valueColor={getRiskColor(calc.pBlended)} />
          </View>
          <FloatInput label="Platform Uptime SLA (%)" value={uptimeSLA} onChangeText={setUptimeSLA} keyboardType="numeric" containerStyle={{ marginTop: spacing.sm }} />
        </ClayCard>

        {/* ══ SECTION 4: Event Simulation ══ */}
        <SectionHeading num="04" title="DISRUPTION EVENT SIMULATION" />
        <ClayCard style={s.card}>

          {/* GPS anti-spoof */}
          <View style={s.switchRow}>
            <View>
              <Text style={s.swLabel}>GPS trajectory in claimed zone</Text>
              <Text style={s.swSub}>H3 cell history validation (anti-spoof layer 1)</Text>
            </View>
            <Switch value={gpsInZone} onValueChange={setGpsInZone} trackColor={{ true: colors.primary, false: colors.danger }} />
          </View>

          {/* Event type tabs */}
          <View style={s.eventGrid}>
            {EVENT_TYPES.map(e => {
              const Icon = e.icon;
              const active = eventType.id === e.id;
              return (
                <TouchableOpacity key={e.id} style={[s.eventTab, active && { borderColor: e.color, backgroundColor: e.color + '15' }]} onPress={() => { setEventType(e); setWeather(e.id as any); }}>
                  <Icon size={16} color={active ? e.color : colors.textMuted} />
                  <Text style={[s.eventTabTxt, active && { color: e.color }]}>{e.label}</Text>
                  <View style={[s.fraudPill, { backgroundColor: (e.fraudRisk === 'LOW' ? colors.success : e.fraudRisk === 'MEDIUM' ? '#F59E0B' : colors.danger) + '20' }]}>
                    <Text style={[s.fraudPillTxt, { color: e.fraudRisk === 'LOW' ? colors.success : e.fraudRisk === 'MEDIUM' ? '#F59E0B' : colors.danger }]}>{e.fraudRisk}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Event-specific inputs ── */}
          {eventType.id === 'rain' && (
            <>
              <FormulaBox formula="P_rain = s × (R_current / R_avg) × E_h × C_tier" />
              <FloatInput label={`Current rainfall (mm) — city avg: ${selectedCity.avgRain}mm`} value={currRainStr} onChangeText={setCurrRain} keyboardType="numeric" />
              <View style={s.reqPill}><ChevronRight size={14} color={colors.textSecondary} /><Text style={s.reqTxt}>Threshold: ≥50mm · Source: OpenWeather / IMD Red Alert · 2h minimum duration</Text></View>
            </>
          )}
          {eventType.id === 'aqi' && (
            <>
              <FormulaBox formula="P_AQI = (AQI_current / AQI_max) × s × C_tier × E_d" />
              <FloatInput label={`Current AQI — city max: ${selectedCity.maxAqi}`} value={currAqiStr} onChangeText={setCurrAqi} keyboardType="numeric" />
              <View style={s.reqPill}><ChevronRight size={14} color={colors.textSecondary} /><Text style={s.reqTxt}>Threshold: ≥301 CPCB Severe · Source: CPCB / IQAir API</Text></View>
            </>
          )}
          {eventType.id === 'heat' && (
            <>
              <FormulaBox formula="P_heat = Alert × (T_feels / T_max) × E_d × C_tier × s" />
              <FloatInput label={`Feels-like temp (°C) — city max: ${selectedCity.maxTemp}°C`} value={currTempStr} onChangeText={setCurrTemp} keyboardType="numeric" />
              <View style={s.switchRow}>
                <View>
                  <Text style={s.swLabel}>IMD Official Heatwave Directive</Text>
                  <Text style={s.swSub}>Alert multiplier = 1 if directive active</Text>
                </View>
                <Switch value={hasHeatAlert} onValueChange={setHasHeatAlert} trackColor={{ true: colors.primary, false: colors.borderHeavy }} />
              </View>
              <View style={s.reqPill}><ChevronRight size={14} color={colors.textSecondary} /><Text style={s.reqTxt}>Threshold: ≥45°C OR official state alert · Source: IMD API</Text></View>
            </>
          )}
          {eventType.id === 'closure' && (
            <>
              <FormulaBox formula="P_closure = min(T_hours × E_h, E_d) × C_tier" />
              <FloatInput label="Impacted shift hours" value={closureHours} onChangeText={setClosureHours} keyboardType="numeric" />
              <View style={s.switchRow}>
                <View>
                  <Text style={s.swLabel}>Govt. Gazette / Google Maps Disruption API</Text>
                  <Text style={s.swSub}>Official closure order confirmed?</Text>
                </View>
                <Switch value={hasGazette} onValueChange={setHasGazette} trackColor={{ true: colors.primary, false: colors.borderHeavy }} />
              </View>
              <View style={s.reqPill}><ChevronRight size={14} color={colors.textSecondary} /><Text style={s.reqTxt}>Geo-fence must match declared zone · Min 2h duration · GPS audit required</Text></View>
            </>
          )}
          {eventType.id === 'platform' && (
            <>
              <FormulaBox formula="P_down = (M_down / 60) × E_h × C_tier × s\nP_sys = 1 − Uptime_SLA" />
              <FloatInput label="Platform downtime (minutes)" value={downtimeMins} onChangeText={setDowntimeMins} keyboardType="numeric" />
              <View style={s.reqPill}><ChevronRight size={14} color={colors.textSecondary} /><Text style={s.reqTxt}>Min 120min metro-scale outage · Source: Downdetector + Platform Status page · Order volume drop ≥70%</Text></View>
            </>
          )}
          {eventType.id === 'road' && (
            <>
              <FormulaBox formula={
                `SpeedSpread = v_hist − v_current\n` +
                `Trigger = SpeedSpread > 3σ_v  AND  GridConsensus  AND  TierCheck\n` +
                `Payout = max(0, excessHours) × E_h × C_tier`
              } />
              <View style={s.inputRow}>
                <FloatInput label="Historical avg speed" value={histSpeed} onChangeText={setHistSpeed} keyboardType="numeric" containerStyle={{ flex: 1, marginRight: 6 }} />
                <FloatInput label="Current order speed" value={currSpeed} onChangeText={setCurrSpeed} keyboardType="numeric" containerStyle={{ flex: 1 }} />
              </View>
              <View style={s.inputRow}>
                <FloatInput label="Speed variance σ_v" value={speedVariance} onChangeText={setSpeedVariance} keyboardType="numeric" containerStyle={{ flex: 1, marginRight: 6 }} />
                <FloatInput label={`Slow delivery count (threshold: ${selectedTier.tierThreshold})`} value={slowCount} onChangeText={setSlowCount} keyboardType="numeric" containerStyle={{ flex: 1 }} />
              </View>
              <View style={s.switchRow}>
                <View>
                  <Text style={s.swLabel}>Grid consensus</Text>
                  <Text style={s.swSub}>Other drivers in same H3 cell confirm anomaly?</Text>
                </View>
                <Switch value={gridConsensus} onValueChange={setGridConsensus} trackColor={{ true: colors.primary, false: colors.borderHeavy }} />
              </View>
            </>
          )}
          {eventType.id === 'unpaid' && (
            <View style={s.excludedBox}>
              <AlertOctagon size={24} color={colors.danger} />
              <Text style={s.excludedTitle}>PERMANENTLY EXCLUDED</Text>
              <Text style={s.excludedBody}>Unpaid delays have no independent third-party signal. Platform data cannot be contested by the driver. Extreme moral hazard — idle workers indistinguishable from blocked workers.</Text>
              <Text style={s.excludedBody}>Alternative: "Earnings Guarantee Buffer" add-on — partial top-up if weekly earnings fall below 70% of baseline AND an external event is already confirmed.</Text>
            </View>
          )}

          {/* Cross-tier payout table */}
          {calc.isValid && eventType.id !== 'unpaid' && (
            <View style={[s.metricsBox, { marginTop: spacing.md }]}>
              <View style={[tp.row, { paddingBottom: 4 }]}>
                <Text style={[tp.label, { color: colors.textMuted, fontSize: 10 }]}>EVENT TYPE</Text>
                <Text style={[tp.val, { color: '#60A5FA', fontSize: 10 }]}>BASIC</Text>
                <Text style={[tp.val, { color: '#A78BFA', fontSize: 10 }]}>PROT.</Text>
                <Text style={[tp.val, { color: '#34D399', fontSize: 10 }]}>ADV.</Text>
              </View>
              <TierPayoutRow
                label={`${eventType.label} payout`}
                basic={calc.crossTierPayouts[0]}
                prot={calc.crossTierPayouts[1]}
                adv={calc.crossTierPayouts[2]}
              />
              <TierPayoutRow label="Daily payout cap" basic={0.5 * calc.Ed} prot={0.75 * calc.Ed} adv={calc.Ed} />
              <TierPayoutRow label="4-day weekly cap" basic={0.5 * calc.Ed * 4} prot={0.75 * calc.Ed * 4} adv={calc.Ed * 4} />
            </View>
          )}
        </ClayCard>

        {/* ══ SECTION 5: TER & Premium ══ */}
        <SectionHeading num="05" title="EXPECTED LOSS · TER · PREMIUM" />
        <ClayCard style={s.card}>
          <FormulaBox formula={
            `E[L] = P_blended × (C_tier × E_d)\n` +
            `TER  = Σ w_h,t × E[L_f,h,t]   [across hexes]\n` +
            `P_w  = (TER + α√Var(TER)) × (1+Margin) × LEI\n` +
            `     × ClaimsMod × SeasonMod\n` +
            `Uncertainty buffer = 1.96 × σ_week`
          } />

          <FloatInput label="Risk loading α (uncertainty multiplier)" value={alphaLoad} onChangeText={setAlphaLoad} keyboardType="numeric" containerStyle={{ marginBottom: spacing.sm }} />

          <Text style={s.inputLabel}>DYNAMIC MODIFIERS</Text>
          <View style={s.switchRow}>
            <View>
              <Text style={s.swLabel}>Monsoon season active</Text>
              <Text style={s.swSub}>Applies +25% seasonal uplift</Text>
            </View>
            <Switch value={isMonsoon} onValueChange={setIsMonsoon} trackColor={{ true: colors.primary, false: colors.borderHeavy }} />
          </View>

          <Text style={s.inputLabel}>CLAIMS HISTORY MODIFIER</Text>
          <View style={s.tierRow}>
            {[
              { id: 'none', label: '0 claims / 12w', mod: '−10%', color: colors.success },
              { id: 'normal', label: 'Normal history', mod: '0%', color: colors.textSecondary },
              { id: 'high', label: '4+ claims / 8w', mod: '+15%', color: colors.danger },
            ].map(c => (
              <TouchableOpacity
                key={c.id}
                style={[s.tierBtn, claimsHistory === c.id && { borderColor: c.color, backgroundColor: c.color + '15' }]}
                onPress={() => setClaimsHistory(c.id as any)}>
                <Text style={[s.tierTxt, claimsHistory === c.id && { color: c.color }]}>{c.label}</Text>
                <Text style={[s.tierSub, { color: c.color }]}>{c.mod}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={[s.metricsBox, { marginTop: spacing.md }]}>
            <MetricRow label="E[L] per hex" value={fmt(calc.elHex)} />
            <MetricRow label="TER (8 hexes × w80)" value={fmt(calc.TER)} />
            <MetricRow label="Risk loading α√Var" value={fmt(calc.rLoad)} />
            <MetricRow label="Uncertainty buffer (1.96σ)" value={fmt(calc.uncertainty)} />
            <MetricRow label="Claims modifier" value={`${calc.claimsMod.toFixed(2)}×`} valueColor={calc.claimsMod < 1 ? colors.success : calc.claimsMod > 1 ? colors.danger : colors.textSecondary} />
            <MetricRow label="Seasonal modifier" value={`${calc.seasonMod.toFixed(2)}×`} />
            <MetricRow label="LEI modifier" value={`${calc.LEI.toFixed(3)}×`} />
          </View>

          {/* Premium hero */}
          <View style={s.premiumHero}>
            <Text style={s.premiumLabel}>WEEKLY PREMIUM</Text>
            <Text style={s.premiumValue}>{fmt(calc.P_final)}</Text>
            <Text style={s.premiumSub}>Clipped to [{fmt(selectedTier.weeklyMin)} – {fmt(selectedTier.weeklyMax)}] · {selectedTier.label} tier guardrail</Text>
          </View>

          {/* Cashflow breakdown */}
          <View style={s.metricsBox}>
            <MetricRow label="Expected payouts (54%)" value={fmt(calc.expectedPayout)} valueColor={colors.danger} />
            <MetricRow label="Ops + reinsurance (20%)" value={fmt(calc.opsAlloc)} valueColor="#F59E0B" />
            <MetricRow label="Net margin" value={fmt(calc.netMargin)} valueColor={colors.success} />
            <MetricRow
              label="Loss ratio"
              value={`${calc.lossRatio.toFixed(1)}%`}
              valueColor={calc.lossRatio < 55 ? colors.success : calc.lossRatio < 65 ? '#F59E0B' : colors.danger}
              sub={calc.lossRatio < 65 ? 'Target met (<65%)' : 'WARNING: above target'}
            />
          </View>

          {/* Stacked bar */}
          <View style={{ marginTop: spacing.md }}>
            <Text style={s.inputLabel}>PREMIUM SPLIT</Text>
            <View style={s.stackedBar}>
              <View style={[s.sbSegment, { flex: 54, backgroundColor: colors.danger }]} />
              <View style={[s.sbSegment, { flex: 20, backgroundColor: '#F59E0B' }]} />
              <View style={[s.sbSegment, { flex: Math.max(0, 100 - 54 - 20), backgroundColor: colors.success }]} />
            </View>
            <View style={s.barLegend}>
              {[
                { c: colors.danger, l: 'Payouts 54%' },
                { c: '#F59E0B', l: 'Ops 20%' },
                { c: colors.success, l: 'Margin' },
              ].map(x => (
                <View key={x.l} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: x.c }} />
                  <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: '900' }}>{x.l}</Text>
                </View>
              ))}
            </View>
          </View>
        </ClayCard>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: Platform.OS === 'ios' ? 70 : 50, paddingBottom: 60 },

  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.base, marginBottom: spacing.xl },
  iconWrap: { backgroundColor: colors.primaryLight, padding: 12, borderRadius: 32 },
  title: { fontSize: typography.xxl, fontWeight: '900', color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: typography.sm, color: colors.textSecondary, fontWeight: '900', marginTop: 2 },

  card: { padding: spacing.lg, marginBottom: spacing.sm, borderRadius: 20 },
  inputLabel: { fontSize: 10, fontWeight: '900', color: colors.textMuted, letterSpacing: 1, marginBottom: 8, marginTop: spacing.sm },
  inputRow: { flexDirection: 'row', marginBottom: spacing.sm },
  metricsBox: { backgroundColor: colors.background, borderRadius: 14, padding: spacing.md, marginTop: spacing.sm },

  // Tier
  tierRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  tierBtn: { flex: 1, paddingVertical: 12, borderWidth: 1.5, borderColor: colors.borderLight, borderRadius: 14, alignItems: 'center' },
  tierBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  tierTxt: { fontSize: 11, fontWeight: '900', color: colors.textSecondary },
  tierTxtActive: { color: colors.primary },
  tierSub: { fontSize: 10, color: colors.textMuted, marginTop: 2, fontWeight: '900' },

  // City
  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1.5, borderColor: colors.borderLight, borderRadius: 99, gap: 5 },
  pillActive: { borderColor: colors.text, backgroundColor: colors.text },
  pillTxt: { fontSize: 12, fontWeight: '900', color: colors.textSecondary },
  pillTxtActive: { color: colors.background },
  cityStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, backgroundColor: colors.background, padding: spacing.sm, borderRadius: 24, marginBottom: spacing.sm },
  cityStatItem: { alignItems: 'center', minWidth: '44%', flex: 1 },
  csl: { fontSize: 10, color: colors.textMuted, fontWeight: '900', letterSpacing: 0.5 },
  csv: { fontSize: 13, color: colors.text, fontWeight: '900', marginTop: 2 },

  // Event tabs
  eventGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  eventTab: { width: '48%', flexDirection: 'row', alignItems: 'center', padding: 12, borderWidth: 1.5, borderColor: colors.borderLight, borderRadius: 14, gap: 8, flexWrap: 'wrap' },
  eventTabTxt: { fontSize: 11, fontWeight: '900', color: colors.textSecondary, flex: 1 },
  fraudPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  fraudPillTxt: { fontSize: 9, fontWeight: '900', letterSpacing: 0.3 },

  // Switch row
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderLight, padding: 14, borderRadius: 14, marginBottom: spacing.sm },
  swLabel: { fontSize: 13, fontWeight: '900', color: colors.text },
  swSub: { fontSize: 11, color: colors.textMuted, marginTop: 3, fontWeight: '900', maxWidth: 220 },

  // Requirement pill
  reqPill: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.background, padding: 10, borderRadius: 10, marginTop: -4, gap: 4 },
  reqTxt: { fontSize: 11, color: colors.textSecondary, fontWeight: '900', flex: 1, lineHeight: 16 },

  // Warn box
  warnBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F59E0B20', padding: 10, borderRadius: 10, marginBottom: spacing.sm, gap: 6 },
  warnTxt: { fontSize: 11, color: '#F59E0B', fontWeight: '900' },

  // Excluded
  excludedBox: { backgroundColor: colors.danger + '10', padding: 20, borderRadius: 32, alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.danger + '30' },
  excludedTitle: { color: colors.danger, fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },
  excludedBody: { color: colors.textSecondary, fontWeight: '900', textAlign: 'center', fontSize: 12, lineHeight: 18 },

  // Result card
  resultCard: { padding: spacing.xl, borderRadius: 24, marginBottom: spacing.xl, borderWidth: 2 },
  resultOk: { backgroundColor: colors.success + '08', borderColor: colors.success + '30' },
  resultFail: { backgroundColor: colors.danger + '08', borderColor: colors.danger + '30' },
  resultHd: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md, justifyContent: 'center', flexWrap: 'wrap' },
  resultTitle: { fontSize: 13, fontWeight: '900', letterSpacing: 0.8 },
  fraudBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 99 },
  fraudText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  payoutBig: { fontSize: 64, fontWeight: '900', color: colors.text, textAlign: 'center', letterSpacing: -2 },
  payoutSub: { fontSize: 12, color: colors.textMuted, textAlign: 'center', fontWeight: '900', marginTop: 4, marginBottom: spacing.lg },

  // Tier compare
  tierCompare: { flexDirection: 'row', gap: 8, marginBottom: spacing.lg },
  tcCard: { flex: 1, backgroundColor: colors.background, borderRadius: 24, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.borderLight },
  tcVal: { fontSize: 15, fontWeight: '900' },
  tcLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '900', marginTop: 2 },

  // Notes
  noteRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 6 },
  noteText: { fontSize: 11, fontWeight: '900', flex: 1, lineHeight: 16 },

  // Premium hero
  premiumHero: { backgroundColor: colors.primaryLight, borderRadius: 18, padding: spacing.xl, alignItems: 'center', marginTop: spacing.md },
  premiumLabel: { fontSize: 11, fontWeight: '900', color: colors.primary, letterSpacing: 1, marginBottom: 6 },
  premiumValue: { fontSize: 52, fontWeight: '900', color: colors.primary, letterSpacing: -2 },
  premiumSub: { fontSize: 11, color: colors.textSecondary, fontWeight: '900', marginTop: 6, textAlign: 'center' },

  // Cashflow bar
  stackedBar: { height: 12, borderRadius: 6, flexDirection: 'row', overflow: 'hidden', marginBottom: 8 },
  sbSegment: { height: 12 },
  barLegend: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
});