const { withAndroidManifest } = require('expo/config-plugins');

function withMergedUsePermissions(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const existing = manifest?.manifest?.['uses-permission'] || [];
    const existingAttrs = existing.map(p => p.$['android:name']);
    const needed = [
      'android.permission.BLUETOOTH',
      'android.permission.BLUETOOTH_ADMIN',
      'android.permission.BLUETOOTH_ADVERTISE',
      'android.permission.BLUETOOTH_CONNECT',
      'android.permission.BLUETOOTH_SCAN',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.INTERNET',
      'android.permission.ACCESS_WIFI_STATE',
      'android.permission.CHANGE_WIFI_STATE',
      'android.permission.CHANGE_WIFI_MULTICAST_STATE',
      'android.permission.RECORD_AUDIO',
      'android.permission.MODIFY_AUDIO_SETTINGS',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
      'android.permission.FOREGROUND_SERVICE_MICROPHONE',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.REQUEST_INSTALL_PACKAGES',
    ];
    for (const perm of needed) {
      if (!existingAttrs.includes(perm)) {
        existing.push({ $: { 'android:name': perm } });
      }
    }
    manifest.manifest['uses-permission'] = existing;
    return config;
  });
}

function withForegroundServiceType(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const application = manifest?.manifest?.application?.[0];
    if (application) {
      let services = application.service;
      if (!services) services = [];
      const existing = services.findIndex(s => s.$['android:name']?.includes('RNBackgroundActionsTask'));
      if (existing >= 0) {
        services[existing].$['android:foregroundServiceType'] = 'dataSync|microphone';
        services[existing].$['tools:replace'] = 'android:foregroundServiceType';
      } else {
        services.push({
          $: {
            'android:name': 'com.asterinet.react.bgactions.RNBackgroundActionsTask',
            'android:foregroundServiceType': 'dataSync|microphone',
            'tools:replace': 'android:foregroundServiceType',
          },
        });
      }
      application.service = services;
    }
    return config;
  });
}

module.exports = function withAndroidAaptOverlay(config) {
  config = withMergedUsePermissions(config);
  config = withForegroundServiceType(config);
  return config;
};
