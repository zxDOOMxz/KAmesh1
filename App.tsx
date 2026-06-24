import React, { useEffect, useState } from 'react';
import { StatusBar, LogBox } from 'react-native';
import { Provider as PaperProvider, MD3DarkTheme } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { COLORS } from './src/constants';
import { ChatScreen } from './src/screens/ChatScreen';
import { NicknameRegistrationScreen } from './src/screens/NicknameRegistrationScreen';
import { UpdateNotificationScreen } from './src/screens/UpdateNotificationScreen';
import { MeshService } from './src/services/MeshService';
import { BackgroundService } from './src/services/BackgroundService';
import { ContactService } from './src/services/ContactService';
import { ChannelService } from './src/services/ChannelService';
import { UpdateService } from './src/services/UpdateService';

LogBox.ignoreAllLogs();

const theme = { ...MD3DarkTheme, colors: { ...MD3DarkTheme.colors, primary: COLORS.primary, background: COLORS.background, surface: COLORS.surface, error: COLORS.error, onPrimary: COLORS.onPrimary, onBackground: COLORS.textPrimary, onSurface: COLORS.textPrimary, outline: COLORS.border, surfaceVariant: COLORS.surfaceVariant } };

export default function App() {
  const [nickname, setNickname] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateData, setUpdateData] = useState<{ version: string; url: string; description: string } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      await BackgroundService.start();
      await MeshService.start();
      await ChannelService.start();
      setReady(true);

      const current = ContactService.getMyNickname();
      if (current) setNickname(current);

      const unsubUpdate = UpdateService.onUpdateAvailable((data) => { setUpdateAvailable(true); setUpdateData(data); });

      return () => { unsubUpdate(); BackgroundService.stop(); MeshService.stop(); };
    })();
  }, []);

  const handleNicknameRegistered = (nick: string) => { setNickname(nick); };

  const handleUpdateAction = (action: 'later' | 'download' | 'install') => {
    if (action === 'later') setUpdateAvailable(false);
    else if (action === 'download' && updateData) { UpdateService.downloadUpdate(updateData.url); setUpdateAvailable(false); }
    else if (action === 'install') { UpdateService.installUpdate(); setUpdateAvailable(false); }
  };

  if (!ready) return null;

  if (!nickname) return <NicknameRegistrationScreen onRegistered={handleNicknameRegistered} />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
          <ChatScreen />
          {updateAvailable && updateData && <UpdateNotificationScreen version={updateData.version} description={updateData.description} onAction={handleUpdateAction} />}
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
