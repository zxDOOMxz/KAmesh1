import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { COLORS } from '../constants';
import { AuthService } from '../services/AuthService';

type Provider = 'mail' | 'yandex' | 'other';

const PROVIDER_DOMAINS: Record<Provider, string> = {
  mail: '@mail.ru',
  yandex: '@yandex.ru',
  other: '',
};

const PROVIDER_LABELS: Record<Provider, string> = {
  mail: 'Mail.ru',
  yandex: 'Яндекс',
  other: 'Другой',
};

interface Props { onComplete: () => void; }

export function SignInScreen({ onComplete }: Props) {
  const [provider, setProvider] = useState<Provider | null>(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleProviderSelect = (p: Provider) => {
    setProvider(p);
    const domain = PROVIDER_DOMAINS[p];
    if (domain && !email.includes('@')) {
      const localPart = email.split('@')[0];
      setEmail(localPart + domain);
    }
    setError('');
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    setError('');
    if (provider && PROVIDER_DOMAINS[provider] && !text.includes('@')) {
      setProvider('other');
    }
  };

  const handleSubmit = async () => {
    const trimmed = email.trim();
    if (!trimmed) { setError('Введите email'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setError('Некорректный email'); return; }

    const nickname = trimmed.split('@')[0];
    if (nickname.length < 1) { setError('Некорректный email'); return; }

    setLoading(true);
    setError('');
    try {
      const success = await AuthService.saveProfile(trimmed);
      if (success) {
        onComplete();
      } else {
        setError('Ошибка сохранения профиля');
      }
    } catch {
      setError('Ошибка сохранения профиля');
    }
    setLoading(false);
  };

  if (!provider) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.card}>
          <Text style={styles.title}>Вход в SofiLink</Text>
          <Text style={styles.subtitle}>Выберите почтовый сервис</Text>
          <Text style={styles.hint}>Ваш email будет использоваться как идентификатор.{'\n'}Никнейм будет создан автоматически.</Text>
          {(Object.keys(PROVIDER_DOMAINS) as Provider[]).map((p) => (
            <TouchableOpacity key={p} style={styles.providerBtn} onPress={() => handleProviderSelect(p)} activeOpacity={0.7}>
              <Text style={styles.providerIcon}>{p === 'mail' ? '📧' : p === 'yandex' ? '🔵' : '📨'}</Text>
              <Text style={styles.providerLabel}>{PROVIDER_LABELS[p]}</Text>
              <Text style={styles.arrow}>→</Text>
            </TouchableOpacity>
          ))}
        </View>
      </KeyboardAvoidingView>
    );
  }

  const domain = PROVIDER_DOMAINS[provider];
  const nickname = email.split('@')[0] || '';

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        <View style={styles.card}>
          <TouchableOpacity onPress={() => { setProvider(null); setEmail(''); setError(''); }} style={styles.backBtn}>
            <Text style={styles.backText}>← Назад</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Ваш email</Text>
          <Text style={styles.subtitle}>{PROVIDER_LABELS[provider]}</Text>
          <View style={styles.emailInputRow}>
            <TextInput
              style={[styles.input, domain ? { flex: 1 } : { flex: 1 }]}
              placeholder="имя"
              placeholderTextColor={COLORS.textTertiary}
              value={email.replace(domain, '')}
              onChangeText={handleEmailChange}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            {domain ? (
              <View style={styles.domainBadge}><Text style={styles.domainText}>{domain}</Text></View>
            ) : null}
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {nickname ? (
            <View style={styles.nickPreview}>
              <Text style={styles.nickLabel}>Ваш никнейм:</Text>
              <Text style={styles.nickValue}>{nickname}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.button, (!email.trim() || loading) && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={!email.trim() || loading}
            activeOpacity={0.7}
          >
            {loading ? <ActivityIndicator color={COLORS.onPrimary} size="small" /> : <Text style={styles.buttonText}>Продолжить</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 400, backgroundColor: COLORS.surface, borderRadius: 16, padding: 32, borderWidth: 1, borderColor: COLORS.border },
  title: { fontSize: 26, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 16 },
  hint: { fontSize: 13, color: COLORS.textTertiary, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  providerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceVariant, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  providerIcon: { fontSize: 24, marginRight: 12 },
  providerLabel: { flex: 1, fontSize: 16, color: COLORS.textPrimary, fontWeight: '500' },
  arrow: { fontSize: 18, color: COLORS.textTertiary },
  backBtn: { marginBottom: 16 },
  backText: { color: COLORS.primary, fontSize: 14 },
  emailInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  input: { backgroundColor: COLORS.surfaceVariant, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border },
  domainBadge: { backgroundColor: COLORS.surfaceVariant, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, borderWidth: 1, borderColor: COLORS.border, borderLeftWidth: 0, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 },
  domainText: { fontSize: 16, color: COLORS.textSecondary },
  nickPreview: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceVariant, borderRadius: 12, padding: 12, marginBottom: 16 },
  nickLabel: { fontSize: 13, color: COLORS.textSecondary, marginRight: 8 },
  nickValue: { fontSize: 15, color: COLORS.primary, fontWeight: '600' },
  error: { fontSize: 13, color: COLORS.error, textAlign: 'center', marginBottom: 12 },
  button: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 16, fontWeight: '600', color: COLORS.onPrimary },
});
