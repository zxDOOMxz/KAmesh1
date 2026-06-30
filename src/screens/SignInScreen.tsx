import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { COLORS } from '../constants';
import { ApiClient } from '../services/ApiClient';
import { AuthService } from '../services/AuthService';
type Screen = 'login' | 'register' | 'forgot';

interface Props { onComplete: () => void; }

export function SignInScreen({ onComplete }: Props) {
  const [screen, setScreen] = useState<Screen>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Login fields
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');

  // Register fields
  const [regLogin, setRegLogin] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');

  // Forgot password fields
  const [fpEmail, setFpEmail] = useState('');
  const [fpCode, setFpCode] = useState('');
  const [fpNewPassword, setFpNewPassword] = useState('');
  const [fpStep, setFpStep] = useState<'email' | 'reset'>('email');

  const validateLogin = () => {
    if (!login.trim()) { setError('Введите логин'); return false; }
    if (!password) { setError('Введите пароль'); return false; }
    return true;
  };

  const validateRegister = () => {
    if (regLogin.trim().length < 3) { setError('Логин минимум 3 символа'); return false; }
    if (regPassword.length < 6) { setError('Пароль минимум 6 символов'); return false; }
    if (regPassword !== regConfirm) { setError('Пароли не совпадают'); return false; }
    if (regPhone.trim().length < 10) { setError('Введите номер телефона'); return false; }
    if (!regFullName.trim()) { setError('Введите ФИО'); return false; }
    return true;
  };

  const handleLogin = async () => {
    if (!validateLogin()) return;
    setLoading(true); setError('');
    try {
      await ApiClient.login(login.trim(), password);
      // Set mesh nickname from server user
      const user = ApiClient.getUser();
      if (user) AuthService.saveProfile(user.full_name || user.login);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа');
    } finally { setLoading(false); }
  };

  const handleRegister = async () => {
    if (!validateRegister()) return;
    setLoading(true); setError('');
    try {
      await ApiClient.register(regLogin.trim(), regPassword, regPhone.trim(), regFullName.trim(), regEmail.trim() || undefined);
      const user = ApiClient.getUser();
      if (user) AuthService.saveProfile(user.full_name || user.login);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка регистрации');
    } finally { setLoading(false); }
  };

  const handleSendCode = async () => {
    if (!fpEmail.trim()) { setError('Введите email'); return; }
    setLoading(true); setError('');
    try {
      await ApiClient.forgotPassword(fpEmail.trim());
      setFpStep('reset');
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally { setLoading(false); }
  };

  const handleResetPassword = async () => {
    if (!fpCode.trim() || fpCode.length < 4) { setError('Введите код из письма'); return; }
    if (fpNewPassword.length < 6) { setError('Пароль минимум 6 символов'); return; }
    setLoading(true); setError('');
    try {
      await ApiClient.resetPassword(fpEmail.trim(), fpCode.trim(), fpNewPassword);
      setScreen('login');
      setError('Пароль успешно изменён. Войдите.');
      setFpStep('email');
      setFpCode('');
      setFpNewPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally { setLoading(false); }
  };

  const renderLogin = () => (
    <View style={styles.card}>
      <Text style={styles.title}>SofiLink</Text>
      <Text style={styles.subtitle}>Вход в систему</Text>
      <TextInput
        style={styles.input}
        placeholder="Логин"
        placeholderTextColor={COLORS.textTertiary}
        value={login}
        onChangeText={(t) => { setLogin(t); setError(''); }}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
      />
      <TextInput
        style={styles.input}
        placeholder="Пароль"
        placeholderTextColor={COLORS.textTertiary}
        value={password}
        onChangeText={(t) => { setPassword(t); setError(''); }}
        secureTextEntry
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity
        style={[styles.button, (!login.trim() || !password || loading) && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={!login.trim() || !password || loading}
        activeOpacity={0.7}
      >
        {loading ? <ActivityIndicator color={COLORS.onPrimary} /> : <Text style={styles.buttonText}>Войти</Text>}
      </TouchableOpacity>
      <View style={styles.links}>
        <TouchableOpacity onPress={() => { setError(''); setScreen('register'); }} activeOpacity={0.7}>
          <Text style={styles.linkText}>Зарегистрироваться</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setError(''); setFpStep('email'); setScreen('forgot'); }} activeOpacity={0.7}>
          <Text style={styles.linkText}>Забыли пароль?</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderRegister = () => (
    <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => { setError(''); setScreen('login'); }} activeOpacity={0.7}>
            <Text style={styles.back}>{'< Назад'}</Text>
          </TouchableOpacity>
          <Text style={styles.subtitle}>Регистрация</Text>
          <View style={{ width: 50 }} />
        </View>
        <TextInput style={styles.input} placeholder="Логин" placeholderTextColor={COLORS.textTertiary} value={regLogin} onChangeText={(t) => { setRegLogin(t); setError(''); }} autoCapitalize="none" autoCorrect={false} />
        <TextInput style={styles.input} placeholder="Пароль" placeholderTextColor={COLORS.textTertiary} value={regPassword} onChangeText={(t) => { setRegPassword(t); setError(''); }} secureTextEntry />
        <TextInput style={styles.input} placeholder="Подтвердите пароль" placeholderTextColor={COLORS.textTertiary} value={regConfirm} onChangeText={(t) => { setRegConfirm(t); setError(''); }} secureTextEntry />
        <TextInput style={styles.input} placeholder="Телефон (+7...)" placeholderTextColor={COLORS.textTertiary} value={regPhone} onChangeText={(t) => { setRegPhone(t); setError(''); }} keyboardType="phone-pad" />
        <TextInput style={styles.input} placeholder="ФИО" placeholderTextColor={COLORS.textTertiary} value={regFullName} onChangeText={(t) => { setRegFullName(t); setError(''); }} />
        <TextInput style={styles.input} placeholder="Email (опционально)" placeholderTextColor={COLORS.textTertiary} value={regEmail} onChangeText={(t) => { setRegEmail(t); setError(''); }} keyboardType="email-address" autoCapitalize="none" />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity
          style={[styles.button, (!regLogin.trim() || !regPassword || !regConfirm || !regPhone.trim() || !regFullName.trim() || loading) && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={(!regLogin.trim() || !regPassword || !regConfirm || !regPhone.trim() || !regFullName.trim() || loading)}
          activeOpacity={0.7}
        >
          {loading ? <ActivityIndicator color={COLORS.onPrimary} /> : <Text style={styles.buttonText}>Зарегистрироваться</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderForgot = () => (
    <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => { setError(''); setScreen('login'); setFpStep('email'); }} activeOpacity={0.7}>
            <Text style={styles.back}>{'< Назад'}</Text>
          </TouchableOpacity>
          <Text style={styles.subtitle}>Восстановление пароля</Text>
          <View style={{ width: 50 }} />
        </View>
        {fpStep === 'email' ? (
          <>
            <Text style={styles.hint}>Введите email, указанный при регистрации. Мы отправим код для сброса пароля.</Text>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={COLORS.textTertiary}
              value={fpEmail}
              onChangeText={(t) => { setFpEmail(t); setError(''); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoFocus
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <TouchableOpacity
              style={[styles.button, (!fpEmail.trim() || loading) && styles.buttonDisabled]}
              onPress={handleSendCode}
              disabled={!fpEmail.trim() || loading}
              activeOpacity={0.7}
            >
              {loading ? <ActivityIndicator color={COLORS.onPrimary} /> : <Text style={styles.buttonText}>Отправить код</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.hint}>Код отправлен на {fpEmail}. Введите его и новый пароль.</Text>
            <TextInput
              style={styles.input}
              placeholder="Код из письма"
              placeholderTextColor={COLORS.textTertiary}
              value={fpCode}
              onChangeText={(t) => { setFpCode(t); setError(''); }}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
            <TextInput
              style={styles.input}
              placeholder="Новый пароль"
              placeholderTextColor={COLORS.textTertiary}
              value={fpNewPassword}
              onChangeText={(t) => { setFpNewPassword(t); setError(''); }}
              secureTextEntry
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <TouchableOpacity
              style={[styles.button, (fpCode.length < 4 || fpNewPassword.length < 6 || loading) && styles.buttonDisabled]}
              onPress={handleResetPassword}
              disabled={fpCode.length < 4 || fpNewPassword.length < 6 || loading}
              activeOpacity={0.7}
            >
              {loading ? <ActivityIndicator color={COLORS.onPrimary} /> : <Text style={styles.buttonText}>Сбросить пароль</Text>}
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {screen === 'login' && renderLogin()}
      {screen === 'register' && renderRegister()}
      {screen === 'forgot' && renderForgot()}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', padding: 24 },
  scroll: { flex: 1, width: '100%' },
  card: { width: '100%', maxWidth: 400, backgroundColor: COLORS.surface, borderRadius: 16, padding: 32, borderWidth: 1, borderColor: COLORS.border, marginVertical: 24 },
  title: { fontSize: 26, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 16, flex: 1 },
  hint: { fontSize: 13, color: COLORS.textTertiary, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  input: { backgroundColor: COLORS.surfaceVariant, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12 },
  error: { fontSize: 13, color: COLORS.error, textAlign: 'center', marginBottom: 12 },
  button: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 16, fontWeight: '600', color: COLORS.onPrimary },
  links: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  linkText: { color: COLORS.primary, fontSize: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  back: { color: COLORS.primary, fontSize: 14, width: 50 },
});
