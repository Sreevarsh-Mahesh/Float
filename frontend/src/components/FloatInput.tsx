import React from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { radius, typography, spacing } from '../theme/constants';

interface FloatInputProps extends TextInputProps {
  label: string;
  error?: string;
  icon?: React.ReactNode;
  containerStyle?: ViewStyle;
}

export const FloatInput: React.FC<FloatInputProps> = ({
  label,
  error,
  icon,
  containerStyle,
  ...inputProps
}) => {
  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrapper, error ? styles.inputError : null]}>
        {icon && <View style={styles.iconContainer}>{icon}</View>}
        <TextInput
          style={[styles.input, icon ? styles.inputWithIcon : null]}
          placeholderTextColor={colors.textLight}
          {...inputProps}
        />
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    letterSpacing: 0.2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  inputError: {
    borderColor: colors.danger,
  },
  iconContainer: {
    paddingLeft: spacing.base,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: spacing.base,
    fontSize: typography.md,
    color: colors.text,
  },
  inputWithIcon: {
    paddingLeft: spacing.sm,
  },
  errorText: {
    fontSize: typography.xs,
    color: colors.danger,
    marginTop: spacing.xs,
  },
});
