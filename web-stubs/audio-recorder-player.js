// Web stub for react-native-audio-recorder-player
var AudioRecorderPlayer = /** @class */ (function () {
  function AudioRecorderPlayer() {}
  AudioRecorderPlayer.prototype.startRecorder = function () { return Promise.resolve('web-stub'); };
  AudioRecorderPlayer.prototype.stopRecorder = function () { return Promise.resolve(''); };
  AudioRecorderPlayer.prototype.startPlayer = function () { return Promise.resolve(0); };
  AudioRecorderPlayer.prototype.stopPlayer = function () { return Promise.resolve(0); };
  AudioRecorderPlayer.prototype.resumePlayer = function () { return Promise.resolve(0); };
  AudioRecorderPlayer.prototype.pausePlayer = function () { return Promise.resolve(0); };
  AudioRecorderPlayer.prototype.seekToPlayer = function () { return Promise.resolve(0); };
  AudioRecorderPlayer.prototype.setVolume = function () { return Promise.resolve(); };
  AudioRecorderPlayer.prototype.setSubscriptionDuration = function () {};
  AudioRecorderPlayer.prototype.addRecordBackListener = function () {};
  AudioRecorderPlayer.prototype.removeRecordBackListener = function () {};
  AudioRecorderPlayer.prototype.addPlayBackListener = function () {};
  AudioRecorderPlayer.prototype.removePlayBackListener = function () {};
  return AudioRecorderPlayer;
})();

var AudioEncoderAndroidType = {
  AAC: 0, HE_AAC: 1, AMR_NB: 2, AMR_WB: 3, OPUS: 7, VORBIS: 4, FLAC: 5,
};

var AudioSourceAndroidType = {
  DEFAULT: 0, MIC: 1, VOICE_UPLINK: 2, VOICE_DOWNLINK: 3, VOICE_CALL: 4,
  CAMCORDER: 5, VOICE_RECOGNITION: 6, VOICE_COMMUNICATION: 7, UNPROCESSED: 9,
};

var OutputFormatAndroidType = {
  DEFAULT: 0, MPEG_4: 2, AMR_NB: 3, AMR_WB: 4, AAC_ADTS: 6,
  MPEG_2_TS: 8, THREE_GPP: 1, WEBM: 9, OGG: 11,
};

exports.default = AudioRecorderPlayer;
exports.AudioEncoderAndroidType = AudioEncoderAndroidType;
exports.AudioSourceAndroidType = AudioSourceAndroidType;
exports.OutputFormatAndroidType = OutputFormatAndroidType;
