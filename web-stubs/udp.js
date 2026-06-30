// Web stub for react-native-udp
var UdpSockets = {
  createSocket: function () {
    var sock = {
      bind: function () { return Promise.resolve(); },
      send: function () { return Promise.resolve(); },
      close: function () { return Promise.resolve(); },
      setBroadcast: function () {},
      on: function () { return sock; },
      address: function () { return { address: '0.0.0.0', port: 0 }; },
      remoteAddress: '0.0.0.0',
      remotePort: 0,
    };
    return sock;
  },
};

exports.default = UdpSockets;
exports.UdpSockets = UdpSockets;
