import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Platform,
  TouchableOpacity, Switch, Modal
} from 'react-native';
import { colors } from '../theme/colors';
import { typography, spacing, radius } from '../theme/constants';
import { ClayCard } from '../components/ClayCard';
import { FloatInput } from '../components/FloatInput';
import {
  Beaker, Calculator, CloudRain, Wind, ThermometerSun,
  AlertOctagon, Clock, MapPin, CheckCircle2, XCircle,
  ChevronRight, Activity, TrendingDown, Shield, Zap,
  AlertTriangle, BarChart2, Navigation, Wifi
} from 'lucide-react-native';
import { SimulationStore } from '../store/SimulationStore';

// ─────────────────────────────────────────────
// DESIGN TOKENS — Zomato/Swiggy inspired
// ─────────────────────────────────────────────
const T = {
  // Brand
  red: '#E23744',
  orange: '#FC8019',
  // Neutrals
  ink: '#1C1C1E',
  inkSoft: '#3A3A3C',
  inkMuted: '#8E8E93',
  canvas: '#F7F4F0',
  surface: '#FFFFFF',
  surfaceMid: '#F2EDE8',
  border: '#E8E2DC',
  borderStrong: '#CEC7BE',
  // Semantic
  green: '#1DA462',
  amber: '#F09000',
  blue: '#2563EB',
  // Typography scale
  heading: { fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontWeight: '700' as const },
  label: { fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif', fontWeight: '700' as const },
  body: { fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif', fontWeight: '500' as const },
};

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const CITIES = [
  { id: 'chennai', name: 'Chennai', avgRain: 15, maxAqi: 200, maxTemp: 42, avgSpeed: 35, avgEarnings: 650, floodFreq: 0.7, heatDays: 40, aqiDays: 20, riskMultiplier: 0.7 },
  { id: 'delhi', name: 'Delhi', avgRain: 5, maxAqi: 500, maxTemp: 48, avgSpeed: 40, avgEarnings: 800, floodFreq: 0.2, heatDays: 90, aqiDays: 120, riskMultiplier: 1.0 },
  { id: 'mumbai', name: 'Mumbai', avgRain: 25, maxAqi: 250, maxTemp: 38, avgSpeed: 30, avgEarnings: 850, floodFreq: 0.9, heatDays: 10, aqiDays: 30, riskMultiplier: 1.5 },
  { id: 'blr', name: 'Bangalore', avgRain: 10, maxAqi: 150, maxTemp: 35, avgSpeed: 25, avgEarnings: 750, floodFreq: 0.3, heatDays: 5, aqiDays: 15, riskMultiplier: 0.9 },
];

const TIERS = [
  { id: 'basic', label: 'Basic', coverage: 0.50, tierThreshold: 3, rate: 0.030, weeklyMin: 80, weeklyMax: 150 },
  { id: 'protection', label: 'Protection', coverage: 0.75, tierThreshold: 2, rate: 0.040, weeklyMin: 120, weeklyMax: 200 },
  { id: 'advanced', label: 'Advanced', coverage: 1.00, tierThreshold: 1, rate: 0.050, weeklyMin: 160, weeklyMax: 250 },
];

const EVENT_TYPES = [
  { id: 'rain', label: 'Rain / Flood', icon: CloudRain, fraudRisk: 'LOW', color: '#2563EB' },
  { id: 'aqi', label: 'Toxic AQI', icon: Wind, fraudRisk: 'LOW', color: '#7C3AED' },
  { id: 'heat', label: 'Extreme Heat', icon: ThermometerSun, fraudRisk: 'LOW', color: T.orange },
  { id: 'closure', label: 'Acts of God', icon: AlertOctagon, fraudRisk: 'MEDIUM', color: T.amber },
  { id: 'platform', label: 'Platform Down', icon: Wifi, fraudRisk: 'LOW', color: T.green },
  { id: 'road', label: 'Road Anomaly', icon: Navigation, fraudRisk: 'MEDIUM', color: '#0891B2' },
  { id: 'unpaid', label: 'Unpaid Delay', icon: Clock, fraudRisk: 'HIGH', color: T.red },
];

const SCALING = { rain: 0.25, aqi: 0.20, heat: 0.25, closure: 0.40, platform: 0.30 };
const MOCK_WEEKLY_LOSSES = [400, 0, 600, 200, 0, 800, 0, 300];

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const fmt = (v: number) => `₹${Math.round(v).toLocaleString('en-IN')}`;

// ─────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────

const Divider = () => <View style={{ height: 1, backgroundColor: T.border, marginVertical: 4 }} />;

const Tag = ({ label, color }: { label: string; color: string }) => (
  <View style={[st.tag, { backgroundColor: color + '15', borderColor: color + '30' }]}>
    <Text style={[st.tagTxt, { color }]}>{label}</Text>
  </View>
);

const SectionHeader = ({ title, caption }: { title: string; caption?: string }) => (
  <View style={st.sectionHeader}>
    <Text style={st.sectionTitle}>{title}</Text>
    {caption && <Text style={st.sectionCaption}>{caption}</Text>}
  </View>
);

// ─────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────
export default function SimulationScreen() {

  const [dailyEarningsStr, setDailyEarnings] = useState('800');
  const [activeHoursStr, setActiveHours] = useState('10');
  const [activeDays, setActiveDays] = useState('24');
  const [earn30Str, setEarn30] = useState('19200');
  const [selectedTier, setSelectedTier] = useState(TIERS[1]);
  const [selectedCity, setSelectedCity] = useState(CITIES[0]);
  const [claimsHistory, setClaimsHistory] = useState<'none' | 'normal' | 'high'>('normal');

  const [eventType, setEventType] = useState(EVENT_TYPES[0]);
  const [currRainStr, setCurrRain] = useState('55');
  const [currAqiStr, setCurrAqi] = useState('320');
  const [currTempStr, setCurrTemp] = useState('46');
  const [hasHeatAlert, setHasHeatAlert] = useState(false);
  const [hasGazette, setHasGazette] = useState(true);
  const [closureHours, setClosureHours] = useState('4');
  const [downtimeMins, setDowntimeMins] = useState('120');
  const [uptimeSLA, setUptimeSLA] = useState('99');
  const [histSpeed, setHistSpeed] = useState('35');
  const [currSpeed, setCurrSpeed] = useState('18');
  const [speedVariance, setSpeedVariance] = useState('4');
  const [gridConsensus, setGridConsensus] = useState(true);
  const [slowCount, setSlowCount] = useState('2');
  const [gpsInZone, setGpsInZone] = useState(true);

  const [showAnalystPopup, setShowAnalystPopup] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);

  // ─────────────────────────────────────────────
  // MASTER CALCULATION
  // ─────────────────────────────────────────────
  const calc = useMemo(() => {
    const city = selectedCity;
    const tier = selectedTier;

    const adays = parseFloat(activeDays) || 24;
    const earn30 = parseFloat(earn30Str) || 0;
    const Ed = earn30 / adays;
    const Ah = parseFloat(activeHoursStr) || 1;
    const Eh = Ed / Ah;
    const LEI = Ed / city.avgEarnings;

    const weeklyIncome = Ed * 6;
    const weeklyVariance = MOCK_WEEKLY_LOSSES.reduce((s, v) => s + Math.pow(v - Ed, 2), 0) / 7;
    const weeklyStdDev = Math.sqrt(weeklyVariance);
    const anomalyThreshold = 3 * weeklyStdDev;

    const Ct = tier.coverage;
    const maxDaily = Ct * Ed;
    let payout = 0;
    let isValid = true;
    const notes: { pass: boolean; text: string }[] = [];
    const driverNotes: { pass: boolean; text: string }[] = [];

    if (!gpsInZone) {
      isValid = false;
      notes.push({ pass: false, text: 'GPS FRAUD: Worker trajectory did not intersect claimed zone. Auto-rejected.' });
      driverNotes.push({ pass: false, text: 'We could not verify your GPS live location in the disrupted zone.' });
    } else {
      driverNotes.push({ pass: true, text: 'Your live location was verified in the disruption zone.' });
    }

    if (eventType.id === 'rain') {
      const cRain = parseFloat(currRainStr) || 0;
      if (cRain < 50) {
        isValid = false;
        notes.push({ pass: false, text: `Rainfall ${cRain}mm below 50mm IMD Red Alert threshold.` });
        driverNotes.push({ pass: false, text: 'Rainfall has not reached the extreme payout threshold yet.' });
      } else {
        notes.push({ pass: true, text: `Rain event confirmed: ${cRain}mm ≥ 50mm. Source: OpenWeather/IMD API.` });
        driverNotes.push({ pass: true, text: 'Severe rainfall volume automatically confirmed by weather stations.' });
        payout = SCALING.rain * (cRain / city.avgRain) * Ed * Ct * city.riskMultiplier;
        notes.push({ pass: true, text: `Formula: ${SCALING.rain} × (${cRain}/${city.avgRain}) × E_d × C_tier × RiskMult` });
      }
    } else if (eventType.id === 'aqi') {
      const cAqi = parseFloat(currAqiStr) || 0;
      if (cAqi < 301) {
        isValid = false;
        notes.push({ pass: false, text: `AQI ${cAqi} below CPCB Severe threshold (≥301).` });
        driverNotes.push({ pass: false, text: 'Air quality is poor but has not reached the toxic threshold.' });
      } else {
        notes.push({ pass: true, text: `AQI event confirmed: ${cAqi} ≥ 301. Source: CPCB/IQAir API.` });
        driverNotes.push({ pass: true, text: 'Severe toxic AQI automatically confirmed by local sensors.' });
        payout = (cAqi / city.maxAqi) * SCALING.aqi * Ed * Ct * city.riskMultiplier;
        notes.push({ pass: true, text: `Formula: (${cAqi}/${city.maxAqi}) × ${SCALING.aqi} × C_tier × E_d × RiskMult` });
      }
    } else if (eventType.id === 'heat') {
      const cTemp = parseFloat(currTempStr) || 0;
      const alertMultiplier = hasHeatAlert ? 1 : 0;
      if (alertMultiplier === 0) {
        isValid = false;
        notes.push({ pass: false, text: `No IMD directive active. Payout multiplier is 0.` });
        driverNotes.push({ pass: false, text: 'Temperatures are high but no official government heatwave alert is active.' });
      } else {
        notes.push({ pass: true, text: `Heat event confirmed: IMD directive ACTIVE. Source: IMD API.` });
        driverNotes.push({ pass: true, text: 'Extreme heatwave confirmed by official government alerts.' });
        payout = alertMultiplier * (cTemp / city.maxTemp) * Ed * SCALING.heat * Ct * city.riskMultiplier;
        notes.push({ pass: true, text: `Formula: 1 × (${cTemp}/${city.maxTemp}) × E_d × C_tier × ${SCALING.heat} × RiskMult` });
      }
    } else if (eventType.id === 'closure') {
      if (!hasGazette) {
        isValid = false;
        notes.push({ pass: false, text: 'No official Gazette / Google Maps Disruption API flag found.' });
        driverNotes.push({ pass: false, text: 'We could not confirm an official government or maps disruption alert.' });
      } else {
        notes.push({ pass: true, text: `Acts of God / Disaster confirmed. Source: Govt. Gazette / Maps API.` });
        driverNotes.push({ pass: true, text: 'Official government disruption (Act of God) confirmed.' });
        payout = Ed * SCALING.closure * Ct * city.riskMultiplier;
        notes.push({ pass: true, text: `Formula: E_d × C_tier × ${SCALING.closure} × RiskMult` });
      }
    } else if (eventType.id === 'platform') {
      const mins = parseFloat(downtimeMins) || 0;
      if (mins < 120) {
        isValid = false;
        notes.push({ pass: false, text: `Downtime ${mins}min below 120min metro-scale minimum.` });
        driverNotes.push({ pass: false, text: 'Platform downtime was too short to trigger a payout.' });
      } else {
        notes.push({ pass: true, text: `Platform outage confirmed: ${mins}min. Source: Downdetector + Platform Status API.` });
        driverNotes.push({ pass: true, text: 'Major platform outage verified. Compensation triggered.' });
        payout = (mins / 60) * Eh * Ct * SCALING.platform;
        notes.push({ pass: true, text: `Formula: (M_down/60) × E_h × C_tier × ${SCALING.platform}` });
      }
    } else if (eventType.id === 'road') {
      const hs = parseFloat(histSpeed) || 1;
      const cs = parseFloat(currSpeed) || 0;
      const sv = parseFloat(speedVariance) || 1;
      const sc = parseInt(slowCount) || 0;
      const spread = hs - cs;
      const triggered = spread > 3 * sv;

      notes.push({ pass: triggered, text: `Speed spread: ${spread.toFixed(1)} km/h ${triggered ? '>' : '≤'} 3σ (${(3 * sv).toFixed(1)})` });
      notes.push({ pass: gridConsensus, text: `Grid consensus: ${gridConsensus ? 'YES' : 'NO'}` });
      notes.push({ pass: sc >= tier.tierThreshold, text: `Slow delivery count: ${sc} ${sc >= tier.tierThreshold ? '≥' : '<'} ${tier.tierThreshold}` });

      if (!triggered) driverNotes.push({ pass: false, text: 'Traffic speeds are within normal variance for this area.' });
      else driverNotes.push({ pass: true, text: 'Severe traffic anomaly verified by algorithms.' });
      if (!gridConsensus) driverNotes.push({ pass: false, text: 'No other drivers confirmed this blockage.' });
      else driverNotes.push({ pass: true, text: 'Other drivers confirmed the same blockage.' });
      if (sc < tier.tierThreshold) driverNotes.push({ pass: false, text: `You need ${tier.tierThreshold} delayed deliveries to qualify.` });
      else driverNotes.push({ pass: true, text: 'You have enough delayed orders to qualify.' });

      if (!triggered || !gridConsensus || sc < tier.tierThreshold) {
        isValid = false;
        notes.push({ pass: false, text: 'Road anomaly payout DENIED: all three conditions must pass.' });
      } else {
        notes.push({ pass: true, text: `Road anomaly confirmed. Excess time = ${(spread / hs * 100).toFixed(0)}% slowdown.` });
        const excessHours = Math.max(0, spread / hs);
        payout = excessHours * Eh * Ct;
      }
    } else if (eventType.id === 'unpaid') {
      isValid = false;
      notes.push({ pass: false, text: 'PERMANENTLY EXCLUDED: Unpaid delays create extreme moral hazard.' });
      driverNotes.push({ pass: false, text: 'Unpaid restaurant or customer delays are excluded from Float Coverage.' });
    }

    if (isValid && payout > maxDaily) {
      notes.push({ pass: true, text: `Daily payout cap applied: ${fmt(payout)} → ${fmt(maxDaily)}` });
      payout = maxDaily;
    }
    if (!isValid) payout = 0;

    const weeklyCapPayout = maxDaily * 4;

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
      Ed, Eh, LEI, weeklyIncome, weeklyVariance, weeklyStdDev, anomalyThreshold,
      payout, maxDaily, weeklyCapPayout, isValid, notes, driverNotes,
      crossTierPayouts,
    };
  }, [
    selectedCity, selectedTier, earn30Str, activeDays, activeHoursStr,
    eventType, currRainStr, currAqiStr, currTempStr,
    hasHeatAlert, hasGazette, closureHours,
    downtimeMins, uptimeSLA,
    histSpeed, currSpeed, speedVariance, gridConsensus, slowCount,
    gpsInZone, claimsHistory,
  ]);

  React.useEffect(() => {
    SimulationStore.set({ eventType, city: selectedCity, calc, tier: selectedTier });
  }, [eventType, selectedCity, calc, selectedTier]);

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <View style={s.container}>

      {/* Analyst Popup Modal */}
      <Modal visible={showAnalystPopup} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={s.popupCard}>
            <View style={s.popupIconRing}>
              <BarChart2 size={28} color={T.red} />
            </View>
            <Text style={s.popupTitle}>Analyst Sandbox</Text>
            <Text style={s.popupBody}>
              This screen is built for analysts and underwriters to test the actuarial model. It is not part of the normal partner interface.
            </Text>
            <TouchableOpacity style={s.popupBtn} onPress={() => setShowAnalystPopup(false)}>
              <Text style={s.popupBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Page Header ── */}
        <View style={s.pageHeader}>
          <View>
            <Text style={s.pageTitle}>Algorithm Sandbox</Text>
            <Text style={s.pageSubtitle}>Actuarial & ML payout engine</Text>
          </View>
          <View style={[s.headerBadge, { backgroundColor: T.red + '12' }]}>
            <Beaker size={16} color={T.red} />
            <Text style={[s.headerBadgeTxt, { color: T.red }]}>ANALYST</Text>
          </View>
        </View>

        {/* ══════════════════════════════════════════
            RESULT HERO
        ══════════════════════════════════════════ */}
        <View style={[s.resultCard, { borderLeftColor: calc.isValid ? T.green : T.red }]}>

          {/* Status row */}
          <View style={s.resultStatus}>
            <View style={[s.statusDot, { backgroundColor: calc.isValid ? T.green : T.red }]} />
            <Text style={[s.statusLabel, { color: calc.isValid ? T.green : T.red }]}>
              {calc.isValid ? 'PAYOUT APPROVED' : 'TRIGGER FAILED'}
            </Text>
            <Tag
              label={`${eventType.fraudRisk} FRAUD RISK`}
              color={eventType.fraudRisk === 'LOW' ? T.green : eventType.fraudRisk === 'MEDIUM' ? T.amber : T.red}
            />
          </View>

          {/* Big number */}
          <Text style={s.payoutAmount}>{fmt(calc.payout)}</Text>
          <Text style={s.payoutMeta}>
            {selectedTier.label} · {(selectedTier.coverage * 100).toFixed(0)}% wage protection · {selectedCity.name}
          </Text>

          {/* Tier compare strip */}
          <View style={s.tierStrip}>
            {[
              { label: 'Basic', val: calc.crossTierPayouts[0] },
              { label: 'Protection', val: calc.crossTierPayouts[1] },
              { label: 'Advanced', val: calc.crossTierPayouts[2] },
            ].map((t, i) => {
              const active = selectedTier.label === t.label;
              return (
                <View key={t.label} style={[s.tierStripCell, active && s.tierStripActive, i === 1 && { borderLeftWidth: 1, borderRightWidth: 1, borderColor: T.border }]}>
                  <Text style={[s.tierStripVal, active && { color: T.red }]}>{fmt(t.val)}</Text>
                  <Text style={s.tierStripLabel}>{t.label}</Text>
                </View>
              );
            })}
          </View>

          {/* Validation audit trail */}
          <View style={s.auditBox}>
            {calc.notes.map((n, i) => (
              <View key={i} style={s.auditRow}>
                <View style={[s.auditDot, { backgroundColor: n.pass ? T.green : T.red }]} />
                <Text style={[s.auditText, { color: n.pass ? T.inkSoft : T.red }]}>{n.text}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ══ SECTION 1: CONTEXT ══ */}
        <SectionHeader title="Context & Location" caption="Partner baseline inputs" />

        <View style={s.card}>
          {/* City selector */}
          <Text style={s.fieldLabel}>CITY</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
            <View style={s.chipRow}>
              {CITIES.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[s.chip, selectedCity.id === c.id && s.chipActive]}
                  onPress={() => setSelectedCity(c)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.chipTxt, selectedCity.id === c.id && s.chipTxtActive]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={s.twoCol}>
            <FloatInput
              label="30-day earnings (₹)"
              value={earn30Str}
              onChangeText={setEarn30}
              keyboardType="numeric"
              containerStyle={s.colLeft}
            />
            <FloatInput
              label="Active days"
              value={activeDays}
              onChangeText={setActiveDays}
              keyboardType="numeric"
              containerStyle={s.colRight}
            />
          </View>

          <FloatInput
            label="Avg shift hours / day"
            value={activeHoursStr}
            onChangeText={setActiveHours}
            keyboardType="numeric"
          />

          {/* Tier selector */}
          <Text style={[s.fieldLabel, { marginTop: 16 }]}>COVERAGE TIER</Text>
          <View style={s.tierTabRow}>
            {TIERS.map(t => {
              const active = selectedTier.id === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[s.tierTab, active && s.tierTabActive]}
                  onPress={() => setSelectedTier(t)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.tierTabPct, active && { color: T.red }]}>{(t.coverage * 100).toFixed(0)}%</Text>
                  <Text style={[s.tierTabLabel, active && { color: T.red }]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ══ TRIGGER BUTTON / EVENT PANEL ══ */}
        {!isTriggering ? (
          <TouchableOpacity
            style={s.triggerBtn}
            onPress={() => setIsTriggering(true)}
            activeOpacity={0.85}
          >
            <Zap size={20} color="#FFF" strokeWidth={2.5} />
            <Text style={s.triggerBtnTxt}>Trigger Disruption Event</Text>
          </TouchableOpacity>
        ) : (
          <View>
            <View style={s.sectionRowHeader}>
              <SectionHeader title="Disruption Event" caption="Select type and configure" />
              <TouchableOpacity onPress={() => setIsTriggering(false)} style={s.cancelBtn}>
                <Text style={s.cancelBtnTxt}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <View style={s.card}>

              {/* GPS Toggle — always shown */}
              <View style={s.toggleRow}>
                <View style={s.toggleInfo}>
                  <Text style={s.toggleLabel}>GPS trajectory verified</Text>
                  <Text style={s.toggleSub}>H3 cell history validation</Text>
                </View>
                <Switch
                  value={gpsInZone}
                  onValueChange={setGpsInZone}
                  trackColor={{ true: T.green, false: T.border }}
                  thumbColor={Platform.OS === 'android' ? '#FFF' : undefined}
                />
              </View>

              <Divider />

              {/* Event type tiles */}
              <Text style={[s.fieldLabel, { marginTop: 16 }]}>EVENT TYPE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, marginBottom: 4 }}>
                <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingVertical: 8 }}>
                  {EVENT_TYPES.map(e => {
                    const Icon = e.icon;
                    const active = eventType.id === e.id;
                    return (
                      <TouchableOpacity
                        key={e.id}
                        style={[s.eventChip, active && { backgroundColor: e.color, borderColor: e.color }]}
                        onPress={() => setEventType(e)}
                        activeOpacity={0.75}
                      >
                        <Icon size={16} color={active ? '#FFF' : T.inkMuted} strokeWidth={2} />
                        <Text style={[s.eventChipTxt, active && { color: '#FFF' }]}>{e.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              {/* Event-specific inputs */}
              {eventType.id === 'rain' && (
                <View style={s.eventInputBox}>
                  <FloatInput
                    label={`Current rainfall (mm) — city avg: ${selectedCity.avgRain}mm`}
                    value={currRainStr}
                    onChangeText={setCurrRain}
                    keyboardType="numeric"
                  />
                  <View style={s.thresholdNote}>
                    <Text style={s.thresholdTxt}>Red Alert threshold: 50mm</Text>
                  </View>
                </View>
              )}

              {eventType.id === 'aqi' && (
                <View style={s.eventInputBox}>
                  <FloatInput
                    label={`Current AQI — city max: ${selectedCity.maxAqi}`}
                    value={currAqiStr}
                    onChangeText={setCurrAqi}
                    keyboardType="numeric"
                  />
                  <View style={s.thresholdNote}>
                    <Text style={s.thresholdTxt}>CPCB Severe threshold: 301</Text>
                  </View>
                </View>
              )}

              {eventType.id === 'heat' && (
                <View style={s.eventInputBox}>
                  <FloatInput
                    label={`Feels-like temp (°C) — city max: ${selectedCity.maxTemp}°C`}
                    value={currTempStr}
                    onChangeText={setCurrTemp}
                    keyboardType="numeric"
                  />
                  <View style={[s.toggleRow, { marginTop: 8 }]}>
                    <View style={s.toggleInfo}>
                      <Text style={s.toggleLabel}>IMD Official Directive</Text>
                      <Text style={s.toggleSub}>Required for heatwave payout</Text>
                    </View>
                    <Switch
                      value={hasHeatAlert}
                      onValueChange={setHasHeatAlert}
                      trackColor={{ true: T.orange, false: T.border }}
                    />
                  </View>
                </View>
              )}

              {eventType.id === 'closure' && (
                <View style={s.eventInputBox}>
                  <View style={s.toggleRow}>
                    <View style={s.toggleInfo}>
                      <Text style={s.toggleLabel}>Disruption Flag Active</Text>
                      <Text style={s.toggleSub}>Official closure confirmed</Text>
                    </View>
                    <Switch
                      value={hasGazette}
                      onValueChange={setHasGazette}
                      trackColor={{ true: T.green, false: T.border }}
                    />
                  </View>
                </View>
              )}

              {eventType.id === 'platform' && (
                <View style={s.eventInputBox}>
                  <FloatInput
                    label="Platform downtime (minutes)"
                    value={downtimeMins}
                    onChangeText={setDowntimeMins}
                    keyboardType="numeric"
                  />
                  <View style={s.thresholdNote}>
                    <Text style={s.thresholdTxt}>Metro-scale minimum: 120 min</Text>
                  </View>
                </View>
              )}

              {eventType.id === 'road' && (
                <View style={s.eventInputBox}>
                  <View style={s.twoCol}>
                    <FloatInput
                      label="Historical avg speed"
                      value={histSpeed}
                      onChangeText={setHistSpeed}
                      keyboardType="numeric"
                      containerStyle={s.colLeft}
                    />
                    <FloatInput
                      label="Current speed"
                      value={currSpeed}
                      onChangeText={setCurrSpeed}
                      keyboardType="numeric"
                      containerStyle={s.colRight}
                    />
                  </View>
                  <View style={s.twoCol}>
                    <FloatInput
                      label="Speed variance (σ)"
                      value={speedVariance}
                      onChangeText={setSpeedVariance}
                      keyboardType="numeric"
                      containerStyle={s.colLeft}
                    />
                    <FloatInput
                      label="Slow deliveries"
                      value={slowCount}
                      onChangeText={setSlowCount}
                      keyboardType="numeric"
                      containerStyle={s.colRight}
                    />
                  </View>
                  <View style={s.toggleRow}>
                    <View style={s.toggleInfo}>
                      <Text style={s.toggleLabel}>Grid consensus</Text>
                      <Text style={s.toggleSub}>Other drivers confirm anomaly</Text>
                    </View>
                    <Switch
                      value={gridConsensus}
                      onValueChange={setGridConsensus}
                      trackColor={{ true: T.green, false: T.border }}
                    />
                  </View>
                </View>
              )}

              {eventType.id === 'unpaid' && (
                <View style={s.excludedBox}>
                  <Text style={s.excludedTitle}>PERMANENTLY EXCLUDED</Text>
                  <Text style={s.excludedBody}>
                    Unpaid delays have no independent third-party verification signal and create extreme moral hazard.
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={{ height: 80 }} />
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
    backgroundColor: T.canvas,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 68 : 50,
    paddingBottom: 100,
  },

  // ── Page Header ──
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: T.ink,
    letterSpacing: -0.8,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  pageSubtitle: {
    fontSize: 13,
    color: T.inkMuted,
    fontWeight: '500',
    marginTop: 3,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  headerBadgeTxt: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  // ── Result Card ──
  resultCard: {
    backgroundColor: T.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderLeftWidth: 4,
    shadowColor: T.ink,
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    elevation: 4,
  },
  resultStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  payoutAmount: {
    fontSize: 60,
    fontWeight: '900',
    color: T.ink,
    letterSpacing: -3,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    marginBottom: 4,
  },
  payoutMeta: {
    fontSize: 13,
    color: T.inkMuted,
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 20,
  },

  // Tier strip
  tierStrip: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 20,
  },
  tierStripCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    backgroundColor: T.surface,
  },
  tierStripActive: {
    backgroundColor: T.red + '08',
  },
  tierStripVal: {
    fontSize: 16,
    fontWeight: '800',
    color: T.ink,
    letterSpacing: -0.5,
  },
  tierStripLabel: {
    fontSize: 11,
    color: T.inkMuted,
    fontWeight: '700',
    marginTop: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Audit trail
  auditBox: {
    backgroundColor: T.surfaceMid,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  auditRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  auditDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 5,
    flexShrink: 0,
  },
  auditText: {
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 18,
    flex: 1,
  },

  // ── Section Header ──
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: T.ink,
    letterSpacing: -0.3,
  },
  sectionCaption: {
    fontSize: 12,
    color: T.inkMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  sectionRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  cancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: T.surfaceMid,
    borderRadius: 10,
  },
  cancelBtnTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: T.inkMuted,
  },

  // ── Card ──
  card: {
    backgroundColor: T.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    shadowColor: T.ink,
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
  },

  // ── Field label ──
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: T.inkMuted,
    letterSpacing: 1,
    marginBottom: 10,
    textTransform: 'uppercase',
  },

  // ── Chips ──
  chipScroll: {
    marginBottom: 20,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 10,
  },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: T.border,
    backgroundColor: T.surface,
  },
  chipActive: {
    backgroundColor: T.ink,
    borderColor: T.ink,
  },
  chipTxt: {
    fontSize: 14,
    fontWeight: '700',
    color: T.inkMuted,
  },
  chipTxtActive: {
    color: '#FFF',
  },

  // ── Two column layout ──
  twoCol: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  colLeft: {
    flex: 1,
  },
  colRight: {
    flex: 1,
  },

  // ── Tier Tabs ──
  tierTabRow: {
    flexDirection: 'row',
    gap: 10,
  },
  tierTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: T.border,
    backgroundColor: T.surface,
  },
  tierTabActive: {
    borderColor: T.red,
    backgroundColor: T.red + '08',
  },
  tierTabPct: {
    fontSize: 20,
    fontWeight: '900',
    color: T.ink,
    letterSpacing: -0.5,
  },
  tierTabLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: T.inkMuted,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Trigger button ──
  triggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: T.red,
    paddingVertical: 18,
    borderRadius: 16,
    marginBottom: 8,
    shadowColor: T.red,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  triggerBtnTxt: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  // ── Event chips ──
  eventChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: T.border,
    backgroundColor: T.surface,
  },
  eventChipTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: T.inkMuted,
  },

  // ── Event input box ──
  eventInputBox: {
    marginTop: 16,
    gap: 4,
  },

  // ── Toggle row ──
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: T.surfaceMid,
    borderRadius: 14,
    marginBottom: 12,
  },
  toggleInfo: {
    flex: 1,
    paddingRight: 12,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: T.ink,
  },
  toggleSub: {
    fontSize: 12,
    color: T.inkMuted,
    marginTop: 3,
    fontWeight: '500',
  },

  // ── Threshold note ──
  thresholdNote: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: T.surfaceMid,
    borderRadius: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  thresholdTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: T.inkMuted,
    letterSpacing: 0.3,
  },

  // ── Excluded box ──
  excludedBox: {
    marginTop: 16,
    padding: 20,
    backgroundColor: T.red + '08',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: T.red + '25',
    gap: 8,
  },
  excludedTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: T.red,
    letterSpacing: 0.8,
  },
  excludedBody: {
    fontSize: 14,
    color: T.inkSoft,
    fontWeight: '500',
    lineHeight: 21,
  },

  // ── Modal overlay ──
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  popupCard: {
    backgroundColor: T.surface,
    padding: 32,
    borderRadius: 28,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 40,
    elevation: 20,
  },
  popupIconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: T.red + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  popupTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: T.ink,
    marginBottom: 12,
    letterSpacing: -0.4,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  popupBody: {
    fontSize: 15,
    color: T.inkMuted,
    textAlign: 'center',
    lineHeight: 23,
    fontWeight: '500',
    marginBottom: 8,
  },
  popupBtn: {
    backgroundColor: T.red,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  popupBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },

  // ── Tag ──
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  tagTxt: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
});

// Sub-component styles
const st = StyleSheet.create({
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  tagTxt: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: T.ink,
    letterSpacing: -0.3,
  },
  sectionCaption: {
    fontSize: 12,
    color: T.inkMuted,
    fontWeight: '600',
    marginTop: 2,
  },
});