import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { useWeather } from '../context/WeatherContext';

const { width, height } = Dimensions.get('window');

const NUM_RAINDROPS = 20;
const NUM_PARTICLES = 15;

const weatherColors: Record<string, string> = {
  sunny: '#dbeafe',         // light blue sky
  rainy: '#cbd5e1',         // grey-blue
  thunderstorm: '#94a3b8',  // FIXED CONTRAST: Slate 400 (reads well with dark text)
  rain: '#cbd5e1',          
  aqi: '#d6d3d1',           // smoggy gray
  heat: '#fed7aa',          // warm orange
  closure: '#fcd34d',       // amber
  platform: '#a7f3d0',      // mint green
  road: '#bae6fd',
  unpaid: '#fecaca',        // red tint
};

const weatherTopColors: Record<string, string> = {
  sunny: '#bae6fd',
  rainy: '#94a3b8',
  thunderstorm: '#64748b',  // FIXED CONTRAST: Slate 500 (good readability)
  rain: '#94a3b8',
  aqi: '#a8a29e',           // smog darker
  heat: '#fdba74',          // hot
  closure: '#f59e0b',
  platform: '#34d399',
  road: '#7dd3fc',
  unpaid: '#f87171',
};

const CloudBlob = ({ translateX, color = '#f8fafc', scale = 1, top = 20, right = -20 }: any) => (
  <View style={[styles.cloudContainer, { top, right, transform: [{ scale }] }]}>
    <Animated.View style={[styles.cloudGroup, { transform: [{ translateX }] }]}>
      <View style={[styles.cloudBump, { width: 140, height: 140, borderRadius: 70, left: 40, top: -20, backgroundColor: color }]} />
      <View style={[styles.cloudBump, { width: 180, height: 180, borderRadius: 90, left: 100, top: 20, backgroundColor: color }]} />
      <View style={[styles.cloudBump, { width: 130, height: 130, borderRadius: 65, left: -20, top: 40, backgroundColor: color }]} />
      <View style={[styles.cloudBase, { backgroundColor: color }]} />
    </Animated.View>
  </View>
);

const SunArt = ({ color = '#fde047', core = '#facc15' }) => {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    anim.start(); return () => anim.stop();
  }, []);
  return (
    <View style={styles.sunContainer}>
      <Animated.View style={[styles.sunGlow, { backgroundColor: color, transform: [{ scale: pulse }] }]} />
      <View style={[styles.sunCore, { backgroundColor: core }]} />
    </View>
  );
};

const LightningArt = () => {
  const flash = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(2000),
        Animated.timing(flash, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.delay(100),
        Animated.timing(flash, { toValue: 0.8, duration: 80, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.delay(1800),
      ])
    );
    anim.start(); return () => anim.stop();
  }, []);
  return (
    <View style={styles.lightningContainer}>
      <Animated.View style={[styles.boltFlash, { opacity: flash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }) }]} />
      <Animated.View style={[styles.lightningBoltGroup, { opacity: flash.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }]}>
        <View style={styles.boltTop} />
        <View style={styles.boltBottom} />
      </Animated.View>
    </View>
  );
};

const RainDrop = React.memo(({ left, delay, speed, type }: { left: number; delay: number; speed: number, type: string }) => {
  const ty = useRef(new Animated.Value(-30)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(ty, { toValue: height + 30, duration: speed, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(ty, { toValue: -30, duration: 0, useNativeDriver: true }),
      ])
    );
    anim.start(); return () => anim.stop();
  }, []);
  return (
    <Animated.View
      style={[
        type === 'aqi' ? styles.smogParticle : styles.raindropLine,
        { left, transform: [{ translateY: ty }, { rotate: type === 'aqi' ? '0deg' : '15deg' }] }
      ]}
    />
  );
});

export function WeatherBackground() {
  const { weather } = useWeather();

  const bg = weatherColors[weather] ?? weatherColors.sunny;
  const topBg = weatherTopColors[weather] ?? weatherTopColors.sunny;

  const particles = useRef(
    Array.from({ length: NUM_PARTICLES }).map((_, i) => ({
      left: (i / NUM_PARTICLES) * (width + 60) - 30,
      delay: (i / NUM_PARTICLES) * 1400,
      speed: weather === 'aqi' ? 3000 + (i % 5) * 500 : 700 + (i % 5) * 120, // Smog is slow, rain is fast
    }))
  ).current;

  const showRain = ['rainy', 'rain', 'thunderstorm', 'flood'].includes(weather);
  const showAqi = weather === 'aqi';

  const clFloat = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(clFloat, { toValue: -15, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(clFloat, { toValue: 15, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    anim.start(); return () => anim.stop();
  }, []);

  return (
    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: bg }]} pointerEvents="none">
      <View style={[styles.topTone, { backgroundColor: topBg }]} />

      {/* Cartoony Art per Weather/Disruption */}
      {weather === 'sunny' && <SunArt />}
      {weather === 'heat' && <SunArt color="#ff8a4c" core="#ea580c" />}
      
      {['rainy', 'rain', 'flood'].includes(weather) && (
        <CloudBlob translateX={clFloat} color="#ffffff" scale={1} />
      )}
      
      {weather === 'thunderstorm' && (
        <>
          <CloudBlob translateX={clFloat} color="#cbd5e1" scale={1.1} top={0} />
          <LightningArt />
        </>
      )}

      {weather === 'aqi' && (
        <CloudBlob translateX={clFloat} color="#a8a29e" scale={1.2} />
      )}

      {['closure', 'platform', 'road', 'unpaid'].includes(weather) && (
        <CloudBlob translateX={clFloat} color="rgba(255,255,255,0.4)" scale={0.8} />
      )}

      {/* Particle Effects: Rain or Smog */}
      {(showRain || showAqi) && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          {particles.map((r, i) => (
            <RainDrop key={i} left={r.left} delay={r.delay} speed={r.speed} type={showAqi ? 'aqi' : 'rain'} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topTone: { position: 'absolute', top: 0, left: 0, right: 0, height: height * 0.45, opacity: 0.6 },
  
  sunContainer: { position: 'absolute', top: -48, right: -48, width: 200, height: 200, alignItems: 'center', justifyContent: 'center' },
  sunGlow: { position: 'absolute', width: 180, height: 180, borderRadius: 90, opacity: 0.5 },
  sunCore: { width: 140, height: 140, borderRadius: 70, opacity: 0.9 },
  
  cloudContainer: { position: 'absolute', width: 300, height: 200 },
  cloudGroup: { width: '100%', height: '100%', position: 'relative' },
  cloudBump: { position: 'absolute' },
  cloudBase: { position: 'absolute', width: 260, height: 100, borderRadius: 50, left: 0, top: 80 },

  lightningContainer: { position: 'absolute', top: 60, right: 60, width: 100, height: 140, alignItems: 'center', justifyContent: 'center' },
  boltFlash: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: '#fef08a' },
  lightningBoltGroup: { position: 'absolute', top: 20 },
  boltTop: { width: 0, height: 0, borderLeftWidth: 20, borderRightWidth: 10, borderTopWidth: 0, borderBottomWidth: 50, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#facc15' },
  boltBottom: { width: 0, height: 0, borderLeftWidth: 10, borderRightWidth: 20, borderTopWidth: 50, borderBottomWidth: 0, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#facc15', marginTop: -5, marginLeft: -10 },

  raindropLine: { position: 'absolute', width: 4, height: 18, borderRadius: 2, backgroundColor: 'rgba(255, 255, 255, 0.6)', top: 0 },
  smogParticle: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: 'rgba(120, 113, 108, 0.4)', top: 0 },
});
