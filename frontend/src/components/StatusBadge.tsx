import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  auto_approved: { bg: colors.successLight, text: colors.success, label: 'Approved' },
  paid: { bg: colors.successBg, text: colors.success, label: 'Paid' },
  flagged_review: { bg: colors.warningLight, text: colors.warning, label: 'Under Review' },
  held: { bg: colors.dangerLight, text: colors.danger, label: 'Held' },
  rejected: { bg: colors.dangerLight, text: colors.danger, label: 'Rejected' },
  pending: { bg: colors.infoLight, text: colors.info, label: 'Pending' },
  active: { bg: colors.successLight, text: colors.success, label: 'Active' },
  inactive: { bg: colors.borderLight, text: colors.textMuted, label: 'Inactive' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'sm' }) => {
  const config = STATUS_CONFIG[status.toLowerCase()] || STATUS_CONFIG.pending;
  const isLarge = size === 'md';

  return (
    <View style={[
      styles.badge,
      { backgroundColor: config.bg },
      isLarge && styles.badgeMd,
    ]}>
      <View style={[styles.dot, { backgroundColor: config.text }]} />
      <Text style={[
        styles.text,
        { color: config.text },
        isLarge && styles.textMd,
      ]}>
        {config.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  badgeMd: {
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  textMd: {
    fontSize: 13,
  },
});
