import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { colors } from '../theme/colors';
import { radius } from '../theme/constants';

interface ClayCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'elevated' | 'outlined';
}

export const ClayCard: React.FC<ClayCardProps> = ({ children, style, variant = 'default' }) => {
  const variantStyle = variant === 'elevated' 
    ? styles.elevated 
    : variant === 'outlined'
    ? styles.outlined
    : styles.default;

  return (
    <View style={[styles.card, variantStyle, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 32, // More rounded like the dummy UI
    padding: 20,
  },
  default: {
    backgroundColor: colors.surface,
    borderWidth: 3,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 8,
  },
  elevated: {
    backgroundColor: colors.surface,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.8)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 12,
  },
  outlined: {
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 3,
    borderColor: colors.border,
  },
});
