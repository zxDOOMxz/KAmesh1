// Web stub for expo-av
var Audio = {
  Sound: /** @class */ (function () {
    function Sound() {}
    Sound.prototype.loadAsync = function () { return Promise.resolve({ sound: this }); };
    Sound.prototype.playAsync = function () { return Promise.resolve(); };
    Sound.prototype.stopAsync = function () { return Promise.resolve(); };
    Sound.prototype.pauseAsync = function () { return Promise.resolve(); };
    Sound.prototype.setPositionAsync = function () { return Promise.resolve(); };
    Sound.prototype.setVolumeAsync = function () { return Promise.resolve(); };
    Sound.prototype.unloadAsync = function () { return Promise.resolve(); };
    Sound.prototype.setOnPlaybackStatusUpdate = function () {};
    return Sound;
  })(),
  Recording: /** @class */ (function () {
    function Recording() {}
    Recording.prototype.prepareToRecordAsync = function () { return Promise.resolve({ recording: this }); };
    Recording.prototype.startAsync = function () { return Promise.resolve(); };
    Recording.prototype.stopAndUnloadAsync = function () { return Promise.resolve(); };
    Recording.prototype.getURI = function () { return null; };
    Recording.prototype.setOnRecordingStatusUpdate = function () {};
    return Recording;
  })(),
  setAudioModeAsync: function () { return Promise.resolve(); },
  setAudioSessionCategory: function () {},
};

exports.Audio = Audio;
