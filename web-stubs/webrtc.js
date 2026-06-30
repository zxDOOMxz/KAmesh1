// Web stub for react-native-webrtc
var MediaStream = /** @class */ (function () {
  function MediaStream() { this.id = 'web-stub'; this.active = true; }
  MediaStream.prototype.getAudioTracks = function () { return []; };
  MediaStream.prototype.getVideoTracks = function () { return []; };
  MediaStream.prototype.addTrack = function () {};
  MediaStream.prototype.removeTrack = function () {};
  return MediaStream;
})();

var MediaStreamTrack = /** @class */ (function () {
  function MediaStreamTrack() { this.id = 'web-stub'; this.kind = 'audio'; this.enabled = true; }
  MediaStreamTrack.prototype.stop = function () {};
  return MediaStreamTrack;
})();

var RTCPeerConnection = /** @class */ (function () {
  function RTCPeerConnection() { this.localDescription = null; this.remoteDescription = null; }
  RTCPeerConnection.prototype.createOffer = function () { return Promise.resolve({ type: 'offer', sdp: '' }); };
  RTCPeerConnection.prototype.createAnswer = function () { return Promise.resolve({ type: 'answer', sdp: '' }); };
  RTCPeerConnection.prototype.setLocalDescription = function () { return Promise.resolve(); };
  RTCPeerConnection.prototype.setRemoteDescription = function () { return Promise.resolve(); };
  RTCPeerConnection.prototype.addIceCandidate = function () { return Promise.resolve(); };
  RTCPeerConnection.prototype.close = function () {};
  RTCPeerConnection.prototype.getStats = function () { return Promise.resolve(new Map()); };
  RTCPeerConnection.prototype.createDataChannel = function () { return { send: function() {}, close: function() {} }; };
  return RTCPeerConnection;
})();

var RTCSessionDescription = /** @class */ (function () {
  function RTCSessionDescription(init) { this.type = init.type; this.sdp = init.sdp; }
  return RTCSessionDescription;
})();

var RTCIceCandidate = /** @class */ (function () {
  function RTCIceCandidate(init) { this.candidate = init.candidate; this.sdpMLineIndex = init.sdpMLineIndex || 0; }
  return RTCIceCandidate;
})();

var permissions = {
  requestMicrophone: function () { return Promise.resolve('granted'); },
  requestCamera: function () { return Promise.resolve('granted'); },
};

exports.MediaStream = MediaStream;
exports.MediaStreamTrack = MediaStreamTrack;
exports.RTCPeerConnection = RTCPeerConnection;
exports.RTCSessionDescription = RTCSessionDescription;
exports.RTCIceCandidate = RTCIceCandidate;
exports.permissions = permissions;
