import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { COLORS } from '../constants';
import { AuthService } from '../services/AuthService';

interface Props { onComplete: () => void; }

export function PinSetupScreen({ onComplete }: Props) {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const confirmRef = useRef<TextInput>(null);

  const handleCreateNext = () => {
    const trimmed = pin.trim();
    if (trimmed.length < 4 || trimmed.length > 8) { setError('PIN должен быть 4-8 цифр'); return; }
    if (!/^\d+$/.test(trimmed)) { setError('PIN может содержать только цифры'); return; }
    setError('');
    setStep('confirm');
    setTimeout(() => confirmRef.current?.focus(), 100);
  };

  const handleConfirm = async () => {
    if (pin !== confirm) { setError('PIN-коды не совпадают'); return; }
    setLoading(true);
    setError('');
    try { await AuthService.setPin(pin); } catch { setError('Не удалось сохранить PIN'); setLoading(false); return; }
    setLoading(false);
    onComplete();
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <Text style={styles.title}>Установка PIN</Text>
        <Text style={styles.subtitle}>
          {step === 'create' ? 'Создайте PIN из 4-8 цифр' : 'Подтвердите ваш PIN'}
        </Text>
        <Text style={styles.hint}>
          PIN защищает вашу личность. Без него никто не сможет использовать ваш аккаунт на этом устройстве.
        </Text>
        <TextInput
          style={styles.input}
          placeholder={step === 'create' ? 'Введите PIN' : 'Повторите PIN'}
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
          style={[styles.button, styles.buttonPrimary, loading && styles.buttonDisabled]}
          onPress={step === 'create' ? handleCreateNext : handleConfirm}
          disabled={loading}
          activeOpacity={0.7}
        >
          {loading ? <ActivityIndicator color={COLORS.onPrimary} size="small" /> : <Text style={styles.buttonText}>{step === 'create' ? 'Далее' : 'Готово'}</Text>}
        </TouchableOpacity>
        {step === 'confirm' && (
          <TouchableOpacity style={styles.backBtn} onPress={() => { setStep('create'); setError(''); setConfirm(''); }}>
            <Text style={styles.backText}>Назад</Text>
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
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 16, fontWeight: '600', color: COLORS.onPrimary },
  backBtn: { alignItems: 'center', padding: 8 },
  backText: { color: COLORS.primary, fontSize: 14 },
});
