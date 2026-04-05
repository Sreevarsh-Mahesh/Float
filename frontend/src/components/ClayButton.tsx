import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { colors } from '../theme/colors';
import { radius, typography } from '../theme/constants';

interface ClayButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export const ClayButton: React.FC<ClayButtonProps> = ({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  size = 'lg',
  style,
  textStyle,
  icon,
}) => {
  const variantConfig: Record<string, { bg: string; text: string; border?: string }> = {
    primary: { bg: colors.primary, text: '#FFFFFF' },
    secondary: { bg: colors.primaryLight, text: colors.primary },
    outline: { bg: 'transparent', text: colors.primary, border: colors.primary },
    ghost: { bg: 'transparent', text: colors.textSecondary },
    danger: { bg: colors.danger, text: '#FFFFFF' },
  };

  const sizeConfig: Record<string, { py: number; px: number; fontSize: number }> = {
    sm: { py: 10, px: 16, fontSize: typography.sm },
    md: { py: 14, px: 24, fontSize: typography.base },
    lg: { py: 16, px: 32, fontSize: typography.md },
  };

  const v = variantConfig[variant];
  const s = sizeConfig[size];
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: v.bg,
          paddingVertical: s.py,
          paddingHorizontal: s.px,
          opacity: isDisabled ? 0.5 : 1,
        },
        v.border ? { borderWidth: 1.5, borderColor: v.border } : undefined,
        variant === 'primary' ? styles.primaryShadow : undefined,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={v.text} size="small" />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, { color: v.text, fontSize: s.fontSize, marginLeft: icon ? 8 : 0 }, textStyle]}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primaryShadow: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  text: {
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
