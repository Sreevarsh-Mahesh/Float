import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

export const SailboatIcon = ({ size = 24, color = "currentColor", strokeWidth = 2.5, style = {} }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
    <Path d="M22 18H2a4 4 0 0 0 4 4h12a4 4 0 0 0 4-4Z" />
    <Path d="M21 14 10 2 3 14h18Z" />
    <Path d="M10 2v16" />
  </Svg>
);

export const CharacterWithUmbrella = ({ tier }: { tier: 1 | 2 | 3 }) => {
  const scales = { 1: 0.7, 2: 1.1, 3: 1.5 };
  const scale = scales[tier];
  const umbrellaColors = { 1: "#FCD34D", 2: "#F97316", 3: "#3B82F6" };

  return (
    <View style={{ width: 100, height: 100, justifyContent: 'flex-end', alignItems: 'center' }}>
      {/* Soft Character Base */}
      <View style={{ zIndex: 10, position: 'absolute', bottom: 0 }}>
        <Svg width="40" height="50" viewBox="0 0 40 50" fill="none">
          <Circle cx="20" cy="15" r="10" fill="#FFC8A2" />
          <Path d="M15 13C15 13 18 16 25 13" stroke="#D97706" strokeWidth="2" strokeLinecap="round" />
          <Path d="M10 30C10 25 30 25 30 30V50H10V30Z" fill="#64748b" />
        </Svg>
      </View>
      {/* Soft Umbrella */}
      <View style={{ 
        position: 'absolute', 
        bottom: 30, 
        transform: [{ scale: scale }],
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 15,
      }}>
        <Svg width="80" height="60" viewBox="0 0 80 60" fill="none">
          <Path d="M40 10C15 10 5 35 5 35H75C75 35 65 10 40 10Z" fill={umbrellaColors[tier]} />
          <Path d="M40 35V55C40 58 35 58 35 55" stroke="#475569" strokeWidth="3" strokeLinecap="round" />
          <Circle cx="40" cy="8" r="3" fill="#475569" />
        </Svg>
      </View>
    </View>
  );
};
