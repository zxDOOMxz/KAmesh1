package com.sofilink.messenger.webrtc

import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.webrtc.*

class WebRTCModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private var peerConnectionFactory: PeerConnectionFactory? = null
  private val peerConnections = mutableMapOf<String, PeerConnection>()
  private val audioSources = mutableMapOf<String, AudioSource>()
  private var localAudioTrack: AudioTrack? = null
  private var audioConstraints: MediaConstraints? = null

  override fun getName(): String = "SofiLinkWebRTC"

  override fun initialize() {
    super.initialize()
    initPeerConnectionFactory()
  }

  private fun initPeerConnectionFactory() {
    try {
      PeerConnectionFactory.InitializationOptions.builder(reactApplicationContext)
        .setFieldTrials("")
        .createInitializationOptions()
        .also { PeerConnectionFactory.initialize(it) }

      peerConnectionFactory = PeerConnectionFactory.builder()
        .createPeerConnectionFactory()

      audioConstraints = MediaConstraints().apply {
        mandatory.add(MediaConstraints.KeyValuePair("googEchoCancellation", "true"))
        mandatory.add(MediaConstraints.KeyValuePair("googNoiseSuppression", "true"))
        mandatory.add(MediaConstraints.KeyValuePair("googAutoGainControl", "true"))
      }

      Log.i("SofiLink/WebRTC", "PeerConnectionFactory initialized")
    } catch (e: Exception) {
      Log.e("SofiLink/WebRTC", "Failed to init PeerConnectionFactory", e)
    }
  }

  @ReactMethod
  fun createAudioTrack(trackId: String, promise: Promise) {
    try {
      val factory = peerConnectionFactory
        ?: return promise.reject("NO_FACTORY", "PeerConnectionFactory not initialized")

      val source = factory.createAudioSource(audioConstraints)
      val track = factory.createAudioTrack(trackId, source)

      audioSources[trackId] = source
      localAudioTrack = track

      Log.i("SofiLink/WebRTC", "Audio track created: $trackId")
      promise.resolve(true)
    } catch (e: Exception) {
      Log.e("SofiLink/WebRTC", "Failed to create audio track", e)
      promise.reject("TRACK_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun createPeerConnection(connectionId: String, iceServers: ReadableArray, promise: Promise) {
    try {
      val factory = peerConnectionFactory
        ?: return promise.reject("NO_FACTORY", "PeerConnectionFactory not initialized")

      val iceServersList = mutableListOf<PeerConnection.IceServer>()
      for (i in 0 until iceServers.size()) {
        val server = iceServers.getMap(i)
        iceServersList.add(
          PeerConnection.IceServer.builder(server.getString("urls"))
            .setUsername(server.getString("username") ?: "")
            .setPassword(server.getString("credential") ?: "")
            .createIceServer()
        )
      }

      val rtcConfig = PeerConnection.RTCConfiguration(iceServersList).apply {
        sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
        continualGatheringPolicy = PeerConnection.ContinualGatheringPolicy.GATHER_CONTINUALLY
        bundlePolicy = PeerConnection.BundlePolicy.MAXBUNDLE
        rtcpMuxPolicy = PeerConnection.RtcpMuxPolicy.REQUIRE
        enableDscp = true
      }

      val observer = object : PeerConnection.Observer {
        override fun onIceCandidate(candidate: IceCandidate) {
          val params = Arguments.createMap()
          params.putString("connectionId", connectionId)
          params.putString("sdpMid", candidate.sdpMid)
          params.putInt("sdpMLineIndex", candidate.sdpMLineIndex)
          params.putString("candidate", candidate.sdp)
          reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("onIceCandidate", params)
        }

        override fun onIceCandidatesRemoved(candidates: Array<IceCandidate>) {}
        override fun onIceConnectionChange(state: PeerConnection.IceConnectionState) {
          val params = Arguments.createMap()
          params.putString("connectionId", connectionId)
          params.putString("state", state.toString())
          reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("onIceConnectionState", params)
        }

        override fun onIceConnectionReceivingChange(receiving: Boolean) {}
        override fun onIceGatheringChange(state: PeerConnection.IceGatheringState) {}
        override fun onSignalingChange(state: PeerConnection.SignalingState) {}
        override fun onAddStream(stream: MediaStream) {}
        override fun onAddTrack(receiver: RtpReceiver, streams: Array<MediaStream>) {}
        override fun onRemoveStream(stream: MediaStream) {}
        override fun onDataChannel(channel: DataChannel) {}
        override fun onRenegotiationNeeded() {}
        override fun onStandardizedIceConnectionChange(state: PeerConnection.IceConnectionState) {}
      }

      val pc = factory.createPeerConnection(rtcConfig, observer)
      if (pc != null) {
        peerConnections[connectionId] = pc
        promise.resolve(true)
      } else {
        promise.reject("PC_NULL", "createPeerConnection returned null")
      }
    } catch (e: Exception) {
      Log.e("SofiLink/WebRTC", "Failed to create peer connection", e)
      promise.reject("PC_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun addLocalAudioTrack(connectionId: String, promise: Promise) {
    try {
      val pc = peerConnections[connectionId]
        ?: return promise.reject("PC_NOT_FOUND", "PeerConnection $connectionId not found")
      val track = localAudioTrack
        ?: return promise.reject("NO_AUDIO", "No local audio track created")
      val sender = pc.addTrack(track, listOf("0"))
      if (sender != null) promise.resolve(true)
      else promise.reject("SENDER_NULL", "addTrack returned null")
    } catch (e: Exception) {
      promise.reject("ADD_TRACK_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun createOffer(connectionId: String, promise: Promise) {
    try {
      val pc = peerConnections[connectionId]
        ?: return promise.reject("PC_NOT_FOUND", "PeerConnection $connectionId not found")
      pc.createOffer(sdpObserver(connectionId, promise), MediaConstraints())
    } catch (e: Exception) {
      promise.reject("OFFER_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun createAnswer(connectionId: String, promise: Promise) {
    try {
      val pc = peerConnections[connectionId]
        ?: return promise.reject("PC_NOT_FOUND", "PeerConnection $connectionId not found")
      pc.createAnswer(sdpObserver(connectionId, promise), MediaConstraints())
    } catch (e: Exception) {
      promise.reject("ANSWER_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun setRemoteDescription(connectionId: String, type: String, sdp: String, promise: Promise) {
    try {
      val pc = peerConnections[connectionId]
        ?: return promise.reject("PC_NOT_FOUND", "PeerConnection $connectionId not found")
      val desc = SessionDescription(SessionDescription.Type.fromCanonicalForm(type), sdp)
      pc.setRemoteDescription(setSdpObserver(promise), desc)
    } catch (e: Exception) {
      promise.reject("REMOTE_DESC_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun addIceCandidate(connectionId: String, sdpMid: String, sdpMLineIndex: Int, candidate: String, promise: Promise) {
    try {
      val pc = peerConnections[connectionId]
        ?: return promise.reject("PC_NOT_FOUND", "PeerConnection $connectionId not found")
      val iceCandidate = IceCandidate(sdpMid, sdpMLineIndex, candidate)
      pc.addIceCandidate(iceCandidate).let { ok ->
        if (ok) promise.resolve(true)
        else promise.reject("ICE_FAILED", "addIceCandidate returned false")
      }
    } catch (e: Exception) {
      promise.reject("ICE_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun closePeerConnection(connectionId: String) {
    peerConnections[connectionId]?.close()
    peerConnections.remove(connectionId)
  }

  @ReactMethod
  fun dispose() {
    localAudioTrack?.dispose()
    audioSources.values.forEach { it.dispose() }
    audioSources.clear()
    peerConnections.values.forEach { it.close() }
    peerConnections.clear()
    peerConnectionFactory?.dispose()
    peerConnectionFactory = null
  }

  private fun sdpObserver(connectionId: String, promise: Promise): SdpObserver {
    return object : SdpObserver {
      override fun onCreateSuccess(sessionDescription: SessionDescription) {
        val pc = peerConnections[connectionId] ?: return
        pc.setLocalDescription(setSdpObserver(promise) {
          val result = Arguments.createMap()
          result.putString("type", sessionDescription.type.canonicalForm())
          result.putString("sdp", sessionDescription.description)
          promise.resolve(result)
        }, sessionDescription)
      }

      override fun onCreateFailure(error: String) {
        promise.reject("SDP_FAILED", error)
      }

      override fun onSetSuccess() {}
      override fun onSetFailure(error: String) {}
    }
  }

  private fun setSdpObserver(promise: Promise, onSuccess: (() -> Unit)? = null): SdpObserver {
    return object : SdpObserver {
      override fun onSetSuccess() { onSuccess?.invoke() ?: promise.resolve(true) }
      override fun onSetFailure(error: String) { promise.reject("SET_SDP_FAILED", error) }
      override fun onCreateSuccess(sessionDescription: SessionDescription?) {}
      override fun onCreateFailure(error: String) {}
    }
  }

  override fun onCatalystInstanceDestroy() {
    dispose()
    super.onCatalystInstanceDestroy()
  }
}
