import { AppRegistry } from 'react-native';
import { enableScreens } from 'react-native-screens';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet } from 'react-native';
import { colors as defaultColors, spacing } from './src/ui/theme';
import { ErrorBoundary } from './src/ui/components/ErrorBoundary';
import { LocaleProvider, useLocale } from './src/i18n/LocaleContext';
import { ThemeProvider, useTheme } from './src/ui/theme/ThemeContext';

import MeshScreen from './src/ui/screens/MeshScreen';
import BluetoothScreen from './src/ui/screens/BluetoothScreen';
import PeersScreen from './src/ui/screens/PeersScreen';
import ForumScreen from './src/ui/screens/ForumScreen';
import SettingsScreen from './src/ui/screens/SettingsScreen';
import CallHistoryScreen from './src/ui/screens/CallHistoryScreen';

enableScreens();

const Tab = createBottomTabNavigator();

function TabIcon({ symbol, color, focused }: { symbol: string; color: string; focused: boolean }) {
  const { colors } = useTheme();
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

function AppContent() {
  const { t } = useLocale();
  const { colors } = useTheme();

  return (
    <ErrorBoundary>
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <NavigationContainer>
          <Tab.Navigator
            screenOptions={{
              tabBarStyle: [styles.tabBar, { backgroundColor: 'rgba(10, 10, 15, 0.95)', borderTopColor: colors.border }],
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
                tabBarLabel: t('tab_mesh'),
              }}
            />
            <Tab.Screen
              name="Bluetooth"
              component={BluetoothScreen}
              options={{
                tabBarIcon: ({ focused }) => <TabIcon symbol="◉" color={colors.neonBlue} focused={focused} />,
                tabBarLabel: t('tab_bluetooth'),
              }}
            />
            <Tab.Screen
              name="Peers"
              component={PeersScreen}
              options={{
                tabBarIcon: ({ focused }) => <TabIcon symbol="◎" color={colors.neonPink} focused={focused} />,
                tabBarLabel: t('tab_peers'),
              }}
            />
            <Tab.Screen
              name="Forum"
              component={ForumScreen}
              options={{
                tabBarIcon: ({ focused }) => <TabIcon symbol="◆" color={colors.neonGreen} focused={focused} />,
                tabBarLabel: t('tab_forum'),
              }}
            />
            <Tab.Screen
              name="History"
              component={CallHistoryScreen}
              options={{
                tabBarIcon: ({ focused }) => <TabIcon symbol="▣" color={colors.neonCyan} focused={focused} />,
                tabBarLabel: t('tab_history'),
              }}
            />
            <Tab.Screen
              name="Settings"
              component={SettingsScreen}
              options={{
                tabBarIcon: ({ focused }) => <TabIcon symbol="⚙" color={colors.neonPink} focused={focused} />,
                tabBarLabel: t('tab_settings'),
              }}
            />
          </Tab.Navigator>
        </NavigationContainer>
      </View>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <LocaleProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </LocaleProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: defaultColors.bg,
  },
  tabBar: {
    height: 60,
    paddingBottom: spacing.sm,
    paddingTop: spacing.xs,
  },
  tabIcon: {
    fontSize: 20,
    color: defaultColors.textMuted,
  },
});

AppRegistry.registerComponent('main', () => App);
