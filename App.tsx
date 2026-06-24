import React, { useEffect, useState, useCallback } from 'react';
import { StatusBar, LogBox } from 'react-native';
import { Provider as PaperProvider, MD3DarkTheme } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { COLORS } from './src/constants';
import { ChatScreen } from './src/screens/ChatScreen';
import { NicknameRegistrationScreen } from './src/screens/NicknameRegistrationScreen';
import { UpdateNotificationScreen } from './src/screens/UpdateNotificationScreen';
import { MeshService } from './src/services/MeshService';
import { startBackgroundTask, stopBackgroundTask } from './src/services/BackgroundService';
import { ContactService } from './src/services/ContactService';
import { ChannelService } from './src/services/ChannelService';
import { UpdateService } from './src/services/UpdateService';
import { ShareService } from './src/services/ShareService';
import type { ChangelogEntry } from './src/types';

LogBox.ignoreAllLogs();

const theme = { ...MD3DarkTheme, colors: { ...MD3DarkTheme.colors, primary: COLORS.primary, background: COLORS.background, surface: COLORS.surface, error: COLORS.error, onPrimary: COLORS.onPrimary, onBackground: COLORS.textPrimary, onSurface: COLORS.textPrimary, outline: COLORS.border, surfaceVariant: COLORS.surfaceVariant } };

export default function App() {
  const [nickname, setNickname] = useState<string | null>(null);
  const [changelog, setChangelog] = useState<ChangelogEntry | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try { await startBackgroundTask(); } catch { /* ignore */ }
      try { await MeshService.initialize(); } catch { /* ignore */ }
      try { ChannelService.initialize(); } catch { /* ignore */ }
      try { await UpdateService.initialize(); } catch { /* ignore */ }
      try { await ShareService.initialize(); } catch { /* ignore */ }

      const pendingChangelog = UpdateService.getPendingChangelog();
      if (pendingChangelog) { setChangelog(pendingChangelog); }

      setReady(true);

      const current = ContactService.getMyNickname();
      if (current) setNickname(current);
    })();

    const unsubUpdate = UpdateService.onEvent((event) => {
      if (event.type === 'complete' && event.changelog && event.version) {
        setChangelog({ version: event.version, versionCode: 0, changelog: event.changelog, installedAt: Date.now() });
      }
    });

    return () => { unsubUpdate(); stopBackgroundTask(); MeshService.destroy(); };
  }, []);

  const handleNicknameRegistered = useCallback((nick: string) => { setNickname(nick); }, []);

  const handleDismissChangelog = useCallback(() => { setChangelog(null); UpdateService.dismissChangelog(); }, []);

  if (!ready) return null;

  if (!nickname) return <NicknameRegistrationScreen onRegistered={handleNicknameRegistered} />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
          <ChatScreen />
          {changelog && <UpdateNotificationScreen visible={!!changelog} changelog={changelog} onDismiss={handleDismissChangelog} />}
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
