// Web stub for react-native-tcp-socket
var TcpSocket = {
  createConnection: function () {
    var sock = {
      on: function () { return sock; },
      write: function () { return true; },
      end: function () {},
      destroy: function () {},
      setEncoding: function () {},
      setTimeout: function () {},
      setNoDelay: function () {},
      address: function () { return { address: '0.0.0.0', port: 0 }; },
      remoteAddress: '0.0.0.0',
      remotePort: 0,
    };
    return sock;
  },
  createServer: function () {
    var srv = { on: function () { return srv; }, listen: function () { return srv; }, close: function () {} };
    return srv;
  },
  connect: function () { return Promise.resolve(); },
};

exports.default = TcpSocket;
exports.TcpSocket = TcpSocket;
