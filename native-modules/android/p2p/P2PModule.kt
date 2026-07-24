package com.sofilink.messenger.p2p

import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.*
import java.net.*
import java.security.*
import java.util.concurrent.ConcurrentHashMap
import android.provider.Settings
import org.bouncycastle.jce.provider.BouncyCastleProvider

class P2PModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
  private val peers = ConcurrentHashMap<String, PeerState>()
  private val servers = ConcurrentHashMap<String, ServerSocket>()
  private val activeJobs = ConcurrentHashMap<String, Job>()

  private var identityKeyPair: KeyPair? = null
  private var peerId: String? = null
  private var mdnsDiscovery: MDNSDiscovery? = null

  override fun getName(): String = "SofiLinkP2P"

  @ReactMethod
  fun getDeviceId(promise: Promise) {
    try {
      val deviceId = Settings.Secure.getString(reactApplicationContext.contentResolver, Settings.Secure.ANDROID_ID)
      promise.resolve(deviceId)
    } catch (e: Exception) { promise.reject("DEVICE_ID_ERROR", e.message, e) }
  }

  @ReactMethod
  fun init(promise: Promise) {
    try {
      Security.removeProvider("BC")
      Security.addProvider(BouncyCastleProvider())
      val kpg = KeyPairGenerator.getInstance("Ed25519", "BC")
      identityKeyPair = kpg.generateKeyPair()
      peerId = bytesToHex(identityKeyPair!!.public.encoded)
      Log.i("SofiLink/P2P", "Identity (BC): ${peerId?.take(16)}...")
      promise.resolve(peerId)
    } catch (e: Exception) {
      try {
        val kpg = KeyPairGenerator.getInstance("Ed25519")
        identityKeyPair = kpg.generateKeyPair()
        peerId = bytesToHex(identityKeyPair!!.public.encoded)
        promise.resolve(peerId)
      } catch (e2: Exception) {
        promise.reject("INIT_FAILED", "No crypto provider", e2)
      }
    }
  }

  @ReactMethod
  fun startServer(port: Int, promise: Promise) {
    scope.launch {
      try {
        val serverId = "srv_$port"
        val server = ServerSocket(port)
        servers[serverId] = server
        val acceptJob = launch {
          while (isActive && !server.isClosed) {
            try { val client = server.accept(); launch { handleConnection(client) } }
            catch (e: Exception) { if (!server.isClosed) Log.e("SofiLink/P2P", "Accept error", e) }
          }
        }
        activeJobs["accept_$serverId"] = acceptJob
        val localIp = NetworkInterface.getNetworkInterfaces()?.asSequence()
          ?.flatMap { it.inetAddresses.asSequence() }
          ?.firstOrNull { !it.isLoopbackAddress && it is Inet4Address }?.hostAddress ?: "127.0.0.1"
        val result = Arguments.createMap()
        result.putString("serverId", serverId); result.putString("localIp", localIp)
        result.putInt("port", server.localPort)
        promise.resolve(result)
      } catch (e: Exception) { promise.reject("SERVER_FAILED", e.message, e) }
    }
  }

  @ReactMethod
  fun connect(host: String, port: Int, promise: Promise) {
    scope.launch {
      try {
        val socket = Socket()
        socket.connect(InetSocketAddress(host, port), 5000)
        val connId = "$host:$port"
        val handshake = buildHandshakeMessage()
        socket.getOutputStream().write(handshake); socket.getOutputStream().flush()
        peers[connId] = PeerState(socket, host, port)
        startClientReadLoop(connId, socket)
        Log.i("SofiLink/P2P", "Connected to $host:$port")
        promise.resolve(connId)
      } catch (e: Exception) { promise.reject("CONNECT_FAILED", e.message, e) }
    }
  }

  private fun startClientReadLoop(connId: String, socket: Socket) {
    scope.launch {
      try {
        val input = socket.getInputStream()
        val buffer = ByteArray(4096)
        while (isActive && socket.isConnected && !socket.isClosed) {
          val bytesRead = input.read(buffer)
          if (bytesRead == -1) break
          val msg = String(buffer, 0, bytesRead, Charsets.UTF_8)
          val params = Arguments.createMap()
          params.putString("connectionId", connId); params.putString("data", msg)
          reactApplicationContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit("onMessage", params)
        }
      } catch (e: Exception) { Log.e("SofiLink/P2P", "Client read error", e) }
      finally { try { socket.close() } catch (_: Exception) {} }
    }
  }

  @ReactMethod
  fun sendMessage(connectionId: String, data: String, promise: Promise) {
    try {
      val peer = peers[connectionId] ?: return promise.reject("PEER_NOT_FOUND", "No peer $connectionId")
      val msg = buildDataMessage(data)
      peer.socket.getOutputStream().write(msg); peer.socket.getOutputStream().flush()
      promise.resolve(true)
    } catch (e: Exception) { promise.reject("SEND_FAILED", e.message, e) }
  }

  @ReactMethod fun disconnect(connectionId: String) { peers.remove(connectionId)?.socket?.close() }
  @ReactMethod fun disconnectAll() { peers.values.forEach { try { it.socket.close() } catch (_: Exception) {} }; peers.clear() }

  @ReactMethod
  fun startDiscovery(serviceType: String, nickname: String, promise: Promise) {
    try {
      mdnsDiscovery?.stop()
      mdnsDiscovery = MDNSDiscovery(reactApplicationContext, serviceType) { peerInfo ->
        val params = Arguments.createMap()
        params.putString("peerId", peerInfo.peerId)
        params.putString("nickname", peerInfo.nickname)
        params.putString("host", peerInfo.host)
        params.putInt("port", peerInfo.port)
        reactApplicationContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit("onPeerDiscovered", params)
      }
      val localPort = servers.values.firstOrNull()?.localPort ?: 0
      if (localPort > 0 && peerId != null) {
        val serviceName = "sofilink_${peerId!!.take(8)}"
        mdnsDiscovery?.registerService(serviceName, localPort, nickname, peerId!!)
      }
      mdnsDiscovery?.start()
      promise.resolve(true)
    } catch (e: Exception) { promise.reject("DISCOVERY_FAILED", e.message, e) }
  }

  @ReactMethod fun stopDiscovery() { mdnsDiscovery?.stop(); mdnsDiscovery = null }

  @ReactMethod
  fun stopAll() {
    disconnectAll(); stopDiscovery()
    servers.values.forEach { try { it.close() } catch (_: Exception) {} }
    servers.clear(); activeJobs.values.forEach { it.cancel() }; activeJobs.clear()
  }

  private fun handleConnection(socket: Socket) {
    val connId = "${socket.inetAddress.hostAddress}:${socket.port}"
    peers[connId] = PeerState(socket, socket.inetAddress.hostAddress, socket.port)
    startClientReadLoop(connId, socket)
  }

  private fun buildHandshakeMessage(): ByteArray = "HANDSHAKE:${bytesToHex(identityKeyPair?.public?.encoded ?: byteArrayOf())}\n".toByteArray(Charsets.UTF_8)
  private fun buildDataMessage(data: String): ByteArray = "MSG:$data\n".toByteArray(Charsets.UTF_8)
  private fun bytesToHex(bytes: ByteArray): String = bytes.joinToString("") { "%02x".format(it) }

  override fun onCatalystInstanceDestroy() { scope.cancel(); stopAll(); super.onCatalystInstanceDestroy() }

  private data class PeerState(val socket: Socket, val host: String, val port: Int)
}
