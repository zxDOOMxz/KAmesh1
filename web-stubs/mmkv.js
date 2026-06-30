// Web stub for react-native-mmkv — uses localStorage
var PREFIX = 'mmkv_sofilink_';

var MMKV = /** @class */ (function () {
  function MMKV(config) {
    this.id = config.id;
    this.storage = typeof window !== 'undefined' ? window.localStorage : {};
  }

  MMKV.prototype._key = function (k) { return PREFIX + this.id + '_' + k; };

  MMKV.prototype.set = function (key, value) {
    try { this.storage.setItem(this._key(key), JSON.stringify(value)); } catch (e) {}
  };

  MMKV.prototype.getString = function (key) {
    try {
      var v = this.storage.getItem(this._key(key));
      if (v === null) return undefined;
      var parsed = JSON.parse(v);
      return typeof parsed === 'string' ? parsed : undefined;
    } catch (e) { return undefined; }
  };

  MMKV.prototype.getBoolean = function (key) {
    try {
      var v = this.storage.getItem(this._key(key));
      if (v === null) return undefined;
      var parsed = JSON.parse(v);
      return typeof parsed === 'boolean' ? parsed : undefined;
    } catch (e) { return undefined; }
  };

  MMKV.prototype.getNumber = function (key) {
    try {
      var v = this.storage.getItem(this._key(key));
      if (v === null) return undefined;
      var parsed = JSON.parse(v);
      return typeof parsed === 'number' ? parsed : undefined;
    } catch (e) { return undefined; }
  };

  MMKV.prototype.delete = function (key) {
    try { this.storage.removeItem(this._key(key)); } catch (e) {}
  };

  MMKV.prototype.contains = function (key) {
    try { return this.storage.getItem(this._key(key)) !== null; } catch (e) { return false; }
  };

  MMKV.prototype.getAllKeys = function () {
    try {
      var keys = [];
      for (var i = 0; i < this.storage.length; i++) {
        var k = this.storage.key(i);
        if (k && k.indexOf(PREFIX) === 0) keys.push(k.substring(PREFIX.length + this.id.length + 1));
      }
      return keys;
    } catch (e) { return []; }
  };

  MMKV.prototype.clearAll = function () {
    try {
      var keys = this.getAllKeys();
      for (var i = 0; i < keys.length; i++) this.delete(keys[i]);
    } catch (e) {}
  };

  return MMKV;
})();

exports.MMKV = MMKV;
