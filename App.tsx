import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet } from 'react-native';
import { colors, spacing } from './src/ui/theme';

import MeshScreen from './src/ui/screens/MeshScreen';
import BluetoothScreen from './src/ui/screens/BluetoothScreen';
import { CallScreen } from './src/ui/screens/CallScreen';
import { CallManager } from './src/core/call/CallManager';
import { useState, useEffect } from 'react';
import type { CallState } from './src/core/call/types';

const callManager = new CallManager();

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MeshTabIcon({ focused }: { focused: boolean }) {
  return (
    <Text style={[styles.tabIcon, focused && styles.tabIconActive]}>
      ●
    </Text>
  );
}

function BTTabIcon({ focused }: { focused: boolean }) {
  return (
    <Text style={[styles.tabIcon, focused && styles.tabIconBT, focused && styles.tabIconActive]}>
      ◉
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
          tabBarIcon: ({ focused }) => <MeshTabIcon focused={focused} />,
          tabBarLabel: 'Mesh',
        }}
      />
      <Tab.Screen
        name="Bluetooth"
        component={BluetoothScreen}
        options={{
          tabBarIcon: ({ focused }) => <BTTabIcon focused={focused} />,
          tabBarLabel: 'Bluetooth',
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

  if (call.status === 'idle') {return null;}

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
  tabIconActive: {
    textShadowColor: colors.neonCyan,
    textShadowRadius: 8,
  },
  tabIconBT: {
    color: colors.neonBlue,
  },
});
