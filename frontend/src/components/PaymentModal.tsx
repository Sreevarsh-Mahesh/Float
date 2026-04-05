import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { colors } from '../theme/colors';
import { radius, typography, spacing } from '../theme/constants';
import { ClayCard } from './ClayCard';
import { ClayButton } from './ClayButton';
import { ShieldCheck, ArrowLeft, Smartphone, Building, CheckCircle, Wifi } from 'lucide-react-native';

interface PaymentModalProps {
  visible: boolean;
  amount: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ visible, amount, onClose, onSuccess }) => {
  const [step, setStep] = useState<'select' | 'processing' | 'success'>('select');

  // Reset step when modal becomes visible
  useEffect(() => {
    if (visible) {
      setStep('select');
    }
  }, [visible]);

  const handlePay = () => {
    setStep('processing');
    
    // Simulate network delay and bank processing
    setTimeout(() => {
      setStep('success');
      
      // Auto close and trigger success after animation
      setTimeout(() => {
        onSuccess();
      }, 2000);
      
    }, 2500);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        {step === 'select' && (
          <View style={styles.sheet}>
            <View style={styles.header}>
              <TouchableOpacity onPress={onClose} style={styles.backBtn}>
                <ArrowLeft size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Complete Payment</Text>
              <View style={{ width: 24 }} />
            </View>

            <View style={styles.amountContainer}>
              <Text style={styles.payingText}>Paying Float Insurance</Text>
              <Text style={styles.amountText}>₹{amount.toFixed(2)}</Text>
            </View>

            <Text style={styles.sectionTitle}>Pay Using UPI Apps</Text>

            <TouchableOpacity style={styles.paymentOption} onPress={handlePay}>
              <View style={[styles.iconBox, { backgroundColor: '#6739B7' }]}>
                <Smartphone size={24} color="#FFF" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>PhonePe</Text>
                <Text style={styles.optionSub}>Link via phone number</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.paymentOption} onPress={handlePay}>
              <View style={[styles.iconBox, { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E7EB' }]}>
                <BrandGPay />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>Google Pay</Text>
                <Text style={styles.optionSub}>Direct bank transfer</Text>
              </View>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Other Methods</Text>

            <TouchableOpacity style={styles.paymentOption} onPress={handlePay}>
               <View style={[styles.iconBox, { backgroundColor: colors.surfaceElevated }]}>
                <Building size={24} color={colors.textSecondary} />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>Net Banking / Cards</Text>
                <Text style={styles.optionSub}>Visa, Mastercard, RuPay & more</Text>
              </View>
            </TouchableOpacity>
            
            <View style={styles.secureBottom}>
               <ShieldCheck size={16} color={colors.success} />
               <Text style={styles.secureText}>100% Secure Payment powered by FloatPay</Text>
            </View>

          </View>
        )}

        {step === 'processing' && (
          <View style={styles.processingSheet}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.processingText}>Processing payment...</Text>
            <Text style={styles.processingSub}>Please do not close this window or press back</Text>
            <View style={styles.secureBottom}>
               <Wifi size={16} color={colors.textMuted} />
               <Text style={[styles.secureText, { color: colors.textMuted }]}>Connecting securely to bank</Text>
            </View>
          </View>
        )}

        {step === 'success' && (
          <View style={styles.processingSheet}>
            <View style={styles.successIconBox}>
                <CheckCircle size={48} color={colors.success} />
            </View>
            <Text style={styles.successText}>Payment Successful!</Text>
            <Text style={styles.processingSub}>Premium activated for the next 7 days</Text>
          </View>
        )}
      </View>
    </Modal>
  );
};

const BrandGPay = () => (
  // Simple representation since we don't have SVGs handy
  <Text style={{fontWeight: '900', color: '#4285F4', fontSize: 18}}>G<Text style={{color: '#EA4335'}}>P</Text><Text style={{color: '#FBBC05'}}>a</Text><Text style={{color: '#34A853'}}>y</Text></Text>
)

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: 40,
    minHeight: '70%',
  },
  processingSheet: {
     backgroundColor: colors.surface,
     borderTopLeftRadius: radius.xl,
     borderTopRightRadius: radius.xl,
     padding: spacing.xl,
     paddingBottom: 60,
     minHeight: '40%',
     alignItems: 'center',
     justifyContent: 'center'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: typography.lg,
    fontWeight: '700',
    color: colors.text,
  },
  amountContainer: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
    paddingTop: spacing.md,
  },
  payingText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  amountText: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.text,
  },
  sectionTitle: {
    fontSize: typography.sm,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: typography.md,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  optionSub: {
    fontSize: typography.xs,
    color: colors.textSecondary,
  },
  secureBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xxxl,
    gap: 6
  },
  secureText: {
    fontSize: typography.xs,
    color: colors.success,
    fontWeight: '500'
  },
  processingText: {
    fontSize: typography.xl,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  processingSub: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    textAlign: 'center'
  },
  successIconBox: {
      marginBottom: spacing.lg
  },
  successText: {
     fontSize: typography.xl,
     fontWeight: '800',
     color: colors.success,
     marginBottom: spacing.sm,
  }
});
