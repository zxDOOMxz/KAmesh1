const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

const webStubs = {
  'react-native-ble-manager': require.resolve('./web-stubs/ble-manager.js'),
  'react-native-webrtc': require.resolve('./web-stubs/webrtc.js'),
  'react-native-mmkv': require.resolve('./web-stubs/mmkv.js'),
  'react-native-audio-recorder-player': require.resolve('./web-stubs/audio-recorder-player.js'),
  'react-native-background-actions': require.resolve('./web-stubs/background-actions.js'),
  'react-native-tcp-socket': require.resolve('./web-stubs/tcp-socket.js'),
  'react-native-udp': require.resolve('./web-stubs/udp.js'),
  'expo-av': require.resolve('./web-stubs/expo-av.js'),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && webStubs[moduleName]) {
    return context.resolveRequest(context, webStubs[moduleName], platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
