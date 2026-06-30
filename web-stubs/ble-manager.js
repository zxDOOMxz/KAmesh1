// Web stub for react-native-ble-manager
var BleManager = {
  start: function () { return Promise.resolve(); },
  scan: function () { return Promise.resolve(); },
  stopScan: function () { return Promise.resolve(); },
  connect: function () { return Promise.resolve(); },
  disconnect: function () { return Promise.resolve(); },
  read: function () { return Promise.resolve(null); },
  write: function () { return Promise.resolve(); },
  writeWithoutResponse: function () { return Promise.resolve(); },
  startNotification: function () { return Promise.resolve(); },
  stopNotification: function () { return Promise.resolve(); },
  retrieveServices: function () { return Promise.resolve({ characteristics: [] }); },
  checkState: function () { return Promise.resolve(); },
  enableBluetooth: function () { return Promise.resolve(); },
  getConnectedPeripherals: function () { return Promise.resolve([]); },
  getDiscoveredPeripherals: function () { return Promise.resolve([]); },
  removePeripheral: function () { return Promise.resolve(); },
};

exports.default = BleManager;
exports.BleManager = BleManager;
