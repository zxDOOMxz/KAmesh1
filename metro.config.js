const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

function resolveSafe(name) {
  try { return require.resolve(name); } catch { return false; }
}

const webStubs = {};
const stubMap = {
  'react-native-ble-manager': './web-stubs/ble-manager.js',
  'react-native-webrtc': './web-stubs/webrtc.js',
  'react-native-mmkv': './web-stubs/mmkv.js',
  'react-native-audio-recorder-player': './web-stubs/audio-recorder-player.js',
  'react-native-background-actions': './web-stubs/background-actions.js',
  'react-native-tcp-socket': './web-stubs/tcp-socket.js',
  'react-native-udp': './web-stubs/udp.js',
  'expo-av': './web-stubs/expo-av.js',
};

for (const [key, stubPath] of Object.entries(stubMap)) {
  const resolved = resolveSafe(stubPath);
  if (resolved) webStubs[key] = resolved;
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && webStubs[moduleName]) {
    return context.resolveRequest(context, webStubs[moduleName], platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
