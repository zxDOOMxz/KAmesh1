import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet } from 'react-native';
import { colors, spacing } from './src/ui/theme';

import MeshScreen from './src/ui/screens/MeshScreen';
import BluetoothScreen from './src/ui/screens/BluetoothScreen';
import PeersScreen from './src/ui/screens/PeersScreen';
import ForumScreen from './src/ui/screens/ForumScreen';
import SettingsScreen from './src/ui/screens/SettingsScreen';
import CallHistoryScreen from './src/ui/screens/CallHistoryScreen';
import { CallScreen } from './src/ui/screens/CallScreen';
import { CallManager } from './src/core/call/CallManager';
import { useState, useEffect } from 'react';
import type { CallState } from './src/core/call/types';

const callManager = new CallManager();

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabIcon({ symbol, color, focused }: { symbol: string; color: string; focused: boolean }) {
  return (
    <Text
      style={[
        styles.tabIcon,
        { color: focused ? color : colors.textMuted },
        focused && { textShadowColor: color, textShadowRadius: 8 },
      ]}
    >
      {symbol}
    </Text>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.neonCyan,
        tabBarInactiveTintColor: colors.textMuted,
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Mesh"
        component={MeshScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon symbol="●" color={colors.neonCyan} focused={focused} />,
          tabBarLabel: 'Mesh',
        }}
      />
      <Tab.Screen
        name="Bluetooth"
        component={BluetoothScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon symbol="◉" color={colors.neonBlue} focused={focused} />,
          tabBarLabel: 'Bluetooth',
        }}
      />
      <Tab.Screen
        name="Peers"
        component={PeersScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon symbol="◎" color={colors.neonPink} focused={focused} />,
          tabBarLabel: 'Peers',
        }}
      />
      <Tab.Screen
        name="Forum"
        component={ForumScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon symbol="◆" color={colors.neonGreen} focused={focused} />,
          tabBarLabel: 'Forum',
        }}
      />
      <Tab.Screen
        name="History"
        component={CallHistoryScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon symbol="▣" color={colors.neonCyan} focused={focused} />,
          tabBarLabel: 'History',
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon symbol="⚙" color={colors.neonPink} focused={focused} />,
          tabBarLabel: 'Settings',
        }}
      />
    </Tab.Navigator>
  );
}

function CallOverlay() {
  const [call, setCall] = useState<CallState>(callManager.getState());

  useEffect(() => {
    callManager.init();
    const unsub = callManager.subscribe(setCall);
    return unsub;
  }, []);

  if (call.status === 'idle') {
    return null;
  }

  return (
    <CallScreen
      call={call}
      onAccept={() => callManager.acceptCall()}
      onReject={() => callManager.rejectCall()}
      onEnd={() => callManager.endCall()}
      onToggleMute={() => callManager.toggleMute()}
    />
  );
}

export default function App() {
  return (
    <View style={styles.container}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Main" component={MainTabs} />
        </Stack.Navigator>
      </NavigationContainer>
      <CallOverlay />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  tabBar: {
    backgroundColor: 'rgba(10, 10, 15, 0.95)',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: 60,
    paddingBottom: spacing.sm,
    paddingTop: spacing.xs,
  },
  tabIcon: {
    fontSize: 20,
    color: colors.textMuted,
  },
});
