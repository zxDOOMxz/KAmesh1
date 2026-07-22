package com.sofilink.messenger.bluetooth

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothServerSocket
import android.bluetooth.BluetoothSocket
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.*
import java.io.IOException
import java.util.UUID

private const val TAG = "SofiLink/BT"
private const val SPP_UUID = "00001101-0000-1000-8000-00805F9B34FB"
private const val SAMPLE_RATE = 44100
private const val AUDIO_CHUNK_MS = 50
private const val AUDIO_CHUNK_SIZE = SAMPLE_RATE * 2 * AUDIO_CHUNK_MS / 1000 // 16-bit mono

class BluetoothModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
  private var bluetoothAdapter: BluetoothAdapter? = null
  private var serverSocket: BluetoothServerSocket? = null
  private var connectedSocket: BluetoothSocket? = null
  private var serverJob: Job? = null
  private var audioCaptureJob: Job? = null
  private var audioPlaybackJob: Job? = null
  private var isCallActive = false
  private var isMuted = false

  private val discoveredDevices = mutableListOf<Map<String, String>>()
  private val discoveryReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      when (intent.action) {
        BluetoothDevice.ACTION_FOUND -> {
          val device = intent.getParcelableExtra<BluetoothDevice>(BluetoothDevice.EXTRA_DEVICE)
          if (device != null && device.name != null) {
            val params = Arguments.createMap()
            params.putString("name", device.name)
            params.putString("address", device.address)
            emit("onBluetoothDeviceDiscovered", params)
          }
        }
        BluetoothAdapter.ACTION_DISCOVERY_FINISHED -> {
          emit("onBluetoothDiscoveryFinished", Arguments.createMap())
        }
      }
    }
  }

  override fun getName(): String = "SofiLinkBluetooth"

  override fun initialize() {
    super.initialize()
    bluetoothAdapter = BluetoothAdapter.getDefaultAdapter()
    if (bluetoothAdapter == null) {
      Log.w(TAG, "Bluetooth not supported on this device")
    }
  }

  @ReactMethod
  fun isEnabled(promise: Promise) {
    promise.resolve(bluetoothAdapter?.isEnabled ?: false)
  }

  @ReactMethod
  fun enableBluetooth(promise: Promise) {
    try {
      if (bluetoothAdapter?.isEnabled == false) {
        bluetoothAdapter?.enable()
      }
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("BT_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun startDiscovery(promise: Promise) {
    try {
      if (bluetoothAdapter?.isDiscovering == true) {
        bluetoothAdapter?.cancelDiscovery()
      }
      discoveredDevices.clear()
      val filter = IntentFilter(BluetoothDevice.ACTION_FOUND).apply {
        addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED)
      }
      reactApplicationContext.registerReceiver(discoveryReceiver, filter)
      bluetoothAdapter?.startDiscovery()
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("BT_DISCOVERY_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun stopDiscovery() {
    try {
      bluetoothAdapter?.cancelDiscovery()
      reactApplicationContext.unregisterReceiver(discoveryReceiver)
    } catch (e: Exception) {
      Log.e(TAG, "Failed to stop discovery", e)
    }
  }

  @ReactMethod
  fun makeDiscoverable(duration: Int) {
    try {
      val intent = Intent(BluetoothAdapter.ACTION_REQUEST_DISCOVERABLE).apply {
        putExtra(BluetoothAdapter.EXTRA_DISCOVERABLE_DURATION, duration.coerceIn(0, 3600))
      }
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactApplicationContext.startActivity(intent)
    } catch (e: Exception) {
      Log.e(TAG, "Failed to make discoverable", e)
    }
  }

  @ReactMethod
  fun connect(deviceAddress: String, promise: Promise) {
    scope.launch {
      try {
        val device = bluetoothAdapter?.getRemoteDevice(deviceAddress)
          ?: return@launch promise.reject("BT_DEVICE", "Device not found: $deviceAddress")
        val socket = device.createRfcommSocketToServiceRecord(UUID.fromString(SPP_UUID))
        bluetoothAdapter?.cancelDiscovery()
        socket.connect()
        connectedSocket = socket
        val params = Arguments.createMap()
        params.putString("connectionId", "bt_${deviceAddress}")
        params.putString("deviceName", device.name ?: "Unknown")
        params.putString("deviceAddress", deviceAddress)
        emit("onBluetoothConnected", params)
        promise.resolve("bt_${deviceAddress}")
      } catch (e: Exception) {
        Log.e(TAG, "BT connect failed", e)
        promise.reject("BT_CONNECT_ERROR", e.message, e)
      }
    }
  }

  @ReactMethod
  fun startServer(promise: Promise) {
    if (serverJob != null) {
      promise.resolve(true)
      return
    }
    serverJob = scope.launch {
      try {
        val uuid = UUID.fromString(SPP_UUID)
        serverSocket = bluetoothAdapter?.listenUsingRfcommWithServiceRecord("SofiLink", uuid)
        val socket = serverSocket?.accept()
        if (socket != null) {
          connectedSocket = socket
          val device = socket.remoteDevice
          val params = Arguments.createMap()
          params.putString("connectionId", "bt_${device.address}")
          params.putString("deviceName", device.name ?: "Unknown")
          params.putString("deviceAddress", device.address)
          emit("onBluetoothConnected", params)
          promise.resolve("bt_${device.address}")
        } else {
          promise.reject("BT_ACCEPT", "Server socket returned null")
        }
      } catch (e: Exception) {
        Log.e(TAG, "BT server failed", e)
        promise.reject("BT_SERVER_ERROR", e.message, e)
      }
    }
  }

  @ReactMethod
  fun startCall(connectionId: String, promise: Promise) {
    val socket = connectedSocket
    if (socket == null) {
      promise.reject("BT_NOT_CONNECTED", "No Bluetooth connection")
      return
    }
    if (isCallActive) {
      promise.resolve(true)
      return
    }
    isCallActive = true
    isMuted = false

    try {
      val audioManager = reactApplicationContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
      audioManager.isSpeakerphoneOn = false
    } catch (e: Exception) {
      Log.e(TAG, "Failed to set audio mode", e)
    }

    audioCaptureJob = scope.launch {
      val bufferSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
      val recorder = AudioRecord(MediaRecorder.AudioSource.VOICE_COMMUNICATION, SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, bufferSize.coerceAtLeast(AUDIO_CHUNK_SIZE * 2))
      try {
        recorder.startRecording()
        val buffer = ByteArray(AUDIO_CHUNK_SIZE)
        while (isActive && isCallActive && socket.isConnected) {
          if (!isMuted) {
            val read = recorder.read(buffer, 0, buffer.size)
            if (read > 0) {
              try {
                socket.outputStream.write(buffer, 0, read)
              } catch (e: IOException) {
                Log.e(TAG, "BT audio send error", e)
                break
              }
            }
          } else {
            delay(AUDIO_CHUNK_MS.toLong())
          }
        }
      } finally {
        try { recorder.stop() } catch (_: Exception) {}
        recorder.release()
      }
    }

    audioPlaybackJob = scope.launch {
      val bufferSize = AudioTrack.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT)
      val track = AudioTrack.Builder()
        .setAudioAttributes(android.media.AudioAttributes.Builder()
          .setUsage(android.media.AudioAttributes.USAGE_VOICE_COMMUNICATION)
          .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SPEECH)
          .build())
        .setAudioFormat(AudioFormat.Builder()
          .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
          .setSampleRate(SAMPLE_RATE)
          .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
          .build())
        .setBufferSizeInBytes(bufferSize.coerceAtLeast(AUDIO_CHUNK_SIZE * 2))
        .build()
      try {
        track.play()
        val buffer = ByteArray(AUDIO_CHUNK_SIZE)
        val inputStream = socket.inputStream
        while (isActive && isCallActive && socket.isConnected) {
          val read = inputStream.read(buffer)
          if (read == -1) break
          track.write(buffer, 0, read)
        }
      } finally {
        try { track.stop() } catch (_: Exception) {}
        track.release()
      }
    }

    val params = Arguments.createMap()
    params.putString("state", "connected")
    emit("onBluetoothCallState", params)
    promise.resolve(true)
  }

  @ReactMethod
  fun stopCall() {
    isCallActive = false
    audioCaptureJob?.cancel()
    audioPlaybackJob?.cancel()
    audioCaptureJob = null
    audioPlaybackJob = null
    try {
      val audioManager = reactApplicationContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      audioManager.mode = AudioManager.MODE_NORMAL
    } catch (e: Exception) {
      Log.e(TAG, "Failed to reset audio mode", e)
    }
    val params = Arguments.createMap()
    params.putString("state", "disconnected")
    emit("onBluetoothCallState", params)
  }

  @ReactMethod
  fun setMuted(muted: Boolean) {
    isMuted = muted
  }

  @ReactMethod
  fun disconnect(connectionId: String) {
    stopCall()
    try { connectedSocket?.close() } catch (_: Exception) {}
    connectedSocket = null
  }

  @ReactMethod
  fun stopAll() {
    stopCall()
    stopDiscovery()
    try { serverSocket?.close() } catch (_: Exception) {}
    serverSocket = null
    try { connectedSocket?.close() } catch (_: Exception) {}
    connectedSocket = null
    serverJob?.cancel()
    serverJob = null
  }

  override fun onCatalystInstanceDestroy() {
    scope.cancel()
    stopAll()
    super.onCatalystInstanceDestroy()
  }

  private fun emit(eventName: String, params: ReadableMap) {
    reactApplicationContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(eventName, params)
  }
}
