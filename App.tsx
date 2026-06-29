import React, { useEffect, useState, useCallback, useReducer } from 'react';
import { StatusBar, View, Text, ActivityIndicator, PermissionsAndroid, Platform } from 'react-native';
import { Provider as PaperProvider, MD3DarkTheme } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { COLORS } from './src/constants';
import { ChatScreen } from './src/screens/ChatScreen';
import { SignInScreen } from './src/screens/SignInScreen';
import { UpdateNotificationScreen } from './src/screens/UpdateNotificationScreen';
import { MeshService } from './src/services/MeshService';
import { ContactService } from './src/services/ContactService';
import { ChannelService } from './src/services/ChannelService';
import { UpdateService } from './src/services/UpdateService';
import { ShareService } from './src/services/ShareService';
import { AuthService } from './src/services/AuthService';
import { VoiceCallService } from './src/services/VoiceCallService';
import { ConferenceService } from './src/services/ConferenceService';
import { IntercomService } from './src/services/IntercomService';
import { generateKeyBundle } from './src/services/CryptoService';
import { performCacheCleanupIfNeeded, getKeyBundle, getNodeId, setNodeId } from './src/services/StorageService';
import type { ChangelogEntry } from './src/types';

const theme = { ...MD3DarkTheme, colors: { ...MD3DarkTheme.colors, primary: COLORS.primary, background: COLORS.background, surface: COLORS.surface, error: COLORS.error, onPrimary: COLORS.onPrimary, onBackground: COLORS.textPrimary, onSurface: COLORS.textPrimary, outline: COLORS.border, surfaceVariant: COLORS.surfaceVariant } };

interface ErrorBoundaryState { hasError: boolean; error?: Error; }
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };
  static getDerivedStateFromError(error: Error): ErrorBoundaryState { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ color: COLORS.error, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>Критическая ошибка</Text>
          <Text style={{ color: COLORS.textSecondary, fontSize: 13, textAlign: 'center' }}>{this.state.error?.message}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function SplashScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={{ color: COLORS.textSecondary, fontSize: 14, marginTop: 16 }}>SofiLink</Text>
    </View>
  );
}

export default function App() {
  const [changelog, setChangelog] = useState<ChangelogEntry | null>(null);
  const [ready, setReady] = useState(false);
  const [signInTick, forceSignInUpdate] = useReducer(x => x + 1, 0);

  useEffect(() => {
    (async () => {
      try {
        const { startBackgroundTask } = await import('./src/services/BackgroundService');
        await startBackgroundTask();
      } catch { /* background service optional */ }

      try {
        if (!getKeyBundle()) {
          const bundle = await generateKeyBundle();
          setNodeId(bundle.identityKey);
        } else if (!getNodeId()) {
          const bundle = JSON.parse(getKeyBundle()!);
          setNodeId(bundle.identityKey);
        }
      } catch { /* ignore */ }

      try { await MeshService.initialize(); } catch { /* ignore */ }
      try { await ContactService.initialize(); } catch { /* ignore */ }
      try { ChannelService.initialize(); } catch { /* ignore */ }
      try { await UpdateService.initialize(); } catch { /* ignore */ }
      try { await ShareService.initialize(); } catch { /* ignore */ }
      try { VoiceCallService.initialize(); } catch { /* ignore */ }
      try { await ConferenceService.initialize(); } catch { /* ignore */ }
      try { IntercomService.initialize(); } catch { /* ignore */ }

      if (Platform.OS === 'android' && Platform.Version >= 33) {
        try { await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO); } catch { /* ignore */ }
      }

      performCacheCleanupIfNeeded();

      const pendingChangelog = UpdateService.getPendingChangelog();
      if (pendingChangelog) { setChangelog(pendingChangelog); }

      setReady(true);
    })();

    const unsubUpdate = UpdateService.onEvent((event) => {
      if (event.type === 'complete' && event.changelog && event.version) {
        setChangelog({ version: event.version, versionCode: 0, changelog: event.changelog, installedAt: Date.now() });
      }
    });

    return () => { unsubUpdate(); import('./src/services/BackgroundService').then(m => m.stopBackgroundTask()).catch(() => {}); MeshService.destroy(); };
  }, []);

  const handleSignInComplete = useCallback(() => { forceSignInUpdate(); }, []);

  const handleDismissChangelog = useCallback(() => { setChangelog(null); UpdateService.dismissChangelog(); }, []);

  if (!ready) return <SplashScreen />;

  if (!AuthService.isRegistered()) return <SignInScreen onComplete={handleSignInComplete} key={signInTick} />;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <PaperProvider theme={theme}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
            <ChatScreen />
            {changelog && <UpdateNotificationScreen visible={!!changelog} changelog={changelog} onDismiss={handleDismissChangelog} />}
          </PaperProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
