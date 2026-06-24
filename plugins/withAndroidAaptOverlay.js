const { withAndroidManifest, withGradleProperties } = require('expo/config-plugins');

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
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.REQUEST_INSTALL_PACKAGES',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.SYSTEM_ALERT_WINDOW',
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
    const service = manifest?.manifest?.application?.[0]?.service;
    if (service) {
      for (const s of service) {
        if (s.$['android:name'] === 'expo.modules.backgroundservice.BackgroundService' || s.$['android:foregroundServiceType']) {
          s.$['android:foregroundServiceType'] = 'dataSync';
        }
      }
    }
    return config;
  });
}

function withGradlePropertiesSettings(config) {
  return withGradleProperties(config, (config) => {
    const props = config.modResults;
    const hasNewArch = props.find(p => typeof p === 'string' && p.includes('newArchEnabled'));
    if (!hasNewArch) {
      props.push('newArchEnabled=false');
    }
    const hasExcludeAppGlideModule = props.find(p => typeof p === 'string' && p.includes('excludeAppGlideModule'));
    if (!hasExcludeAppGlideModule) {
      props.push('excludeAppGlideModule=true');
    }
    return config;
  });
}

module.exports = function withAndroidAaptOverlay(config) {
  config = withMergedUsePermissions(config);
  config = withForegroundServiceType(config);
  config = withGradlePropertiesSettings(config);
  return config;
};
