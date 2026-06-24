import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { COLORS } from '../constants';

interface Props { onComplete: () => void; }

export function PinSetupScreen({ onComplete }: Props) {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [error, setError] = useState('');
  const confirmRef = useRef<TextInput>(null);

  const handleCreateNext = () => {
    const trimmed = pin.trim();
    if (trimmed.length < 4 || trimmed.length > 8) { setError('PIN must be 4-8 digits'); return; }
    if (!/^\d+$/.test(trimmed)) { setError('PIN must contain only digits'); return; }
    setError('');
    setStep('confirm');
    setTimeout(() => confirmRef.current?.focus(), 100);
  };

  const handleConfirm = () => {
    if (pin !== confirm) { setError('PINs do not match'); return; }
    setError('');
    onComplete();
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <Text style={styles.title}>Set PIN</Text>
        <Text style={styles.subtitle}>
          {step === 'create' ? 'Create a 4-8 digit PIN' : 'Confirm your PIN'}
        </Text>
        <Text style={styles.hint}>
          PIN protects your identity. Without it, no one can use your account on this device.
        </Text>
        <TextInput
          style={styles.input}
          placeholder={step === 'create' ? 'Enter PIN' : 'Re-enter PIN'}
          placeholderTextColor={COLORS.textTertiary}
          value={step === 'create' ? pin : confirm}
          onChangeText={(t) => { if (step === 'create') setPin(t); else setConfirm(t); setError(''); }}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={8}
          autoFocus
          ref={step === 'confirm' ? confirmRef : undefined}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity
          style={[styles.button, styles.buttonPrimary]}
          onPress={step === 'create' ? handleCreateNext : handleConfirm}
          activeOpacity={0.7}
        >
          <Text style={styles.buttonText}>{step === 'create' ? 'Next' : 'Done'}</Text>
        </TouchableOpacity>
        {step === 'confirm' && (
          <TouchableOpacity style={styles.backBtn} onPress={() => { setStep('create'); setError(''); setConfirm(''); }}>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 400, backgroundColor: COLORS.surface, borderRadius: 16, padding: 32, borderWidth: 1, borderColor: COLORS.border },
  title: { fontSize: 26, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 16 },
  hint: { fontSize: 13, color: COLORS.textTertiary, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  input: { backgroundColor: COLORS.surfaceVariant, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 18, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12, textAlign: 'center', letterSpacing: 8 },
  error: { fontSize: 13, color: COLORS.error, textAlign: 'center', marginBottom: 12 },
  button: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 8 },
  buttonPrimary: { backgroundColor: COLORS.primary },
  buttonText: { fontSize: 16, fontWeight: '600', color: COLORS.onPrimary },
  backBtn: { alignItems: 'center', padding: 8 },
  backText: { color: COLORS.primary, fontSize: 14 },
});
