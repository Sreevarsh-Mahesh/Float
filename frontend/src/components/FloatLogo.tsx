import React from 'react';
import { Text, StyleSheet } from 'react-native';

export function FloatLogo() {
  return (
    <Text style={styles.logo}>Float</Text>
  );
}

const styles = StyleSheet.create({
  logo: {
    fontStyle: 'italic',
    fontWeight: '900',
    fontSize: 36,
    color: '#2563ea', // text-blue-600
    letterSpacing: -1.5,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 2,
  }
});
