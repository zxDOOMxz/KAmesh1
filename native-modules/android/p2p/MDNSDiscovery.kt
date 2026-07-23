package com.sofilink.messenger.p2p

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.util.Log

data class DiscoveredPeer(
  val peerId: String,
  val nickname: String,
  val host: String,
  val port: Int
)

class MDNSDiscovery(
  private val context: Context,
  private val serviceType: String,
  private val onPeerDiscovered: (DiscoveredPeer) -> Unit
) {
  private var nsdManager: NsdManager? = null
  private var discoveryListener: NsdManager.DiscoveryListener? = null
  private var registered = false
  private var localServiceListener: NsdManager.RegistrationListener? = null
  private var myNickname: String = ""
  private var myPeerId: String = ""

  fun registerService(serviceName: String, port: Int, nickname: String, peerId: String) {
    myNickname = nickname
    myPeerId = peerId
    nsdManager = context.getSystemService(Context.NSD_SERVICE) as NsdManager

    val serviceInfo = NsdServiceInfo()
    serviceInfo.serviceName = serviceName
    serviceInfo.serviceType = serviceType
    serviceInfo.port = port
    serviceInfo.setAttribute("nickname", nickname)
    serviceInfo.setAttribute("peerId", peerId)

    localServiceListener = object : NsdManager.RegistrationListener {
      override fun onServiceRegistered(info: NsdServiceInfo) {
        registered = true
        Log.i("SofiLink/mDNS", "Service registered: ${info.serviceName} ($nickname)")
      }

      override fun onRegistrationFailed(info: NsdServiceInfo, errorCode: Int) {
        Log.e("SofiLink/mDNS", "Registration failed: $errorCode")
      }

      override fun onServiceUnregistered(info: NsdServiceInfo) {
        registered = false
      }

      override fun onUnregistrationFailed(info: NsdServiceInfo, errorCode: Int) {
        Log.e("SofiLink/mDNS", "Unregistration failed: $errorCode")
      }
    }

    nsdManager?.registerService(serviceInfo, NsdManager.PROTOCOL_DNS_SD, localServiceListener!!)
  }

  fun start() {
    nsdManager = context.getSystemService(Context.NSD_SERVICE) as NsdManager

    discoveryListener = object : NsdManager.DiscoveryListener {
      override fun onDiscoveryStarted(regType: String) {
        Log.i("SofiLink/mDNS", "Discovery started: $regType")
      }

      override fun onStartDiscoveryFailed(serviceType: String?, errorCode: Int) {
        Log.e("SofiLink/mDNS", "Start discovery failed: $errorCode")
      }

      override fun onDiscoveryStopped(serviceType: String) {
        Log.i("SofiLink/mDNS", "Discovery stopped")
      }

      override fun onStopDiscoveryFailed(serviceType: String?, errorCode: Int) {
        Log.e("SofiLink/mDNS", "Stop discovery failed: $errorCode")
      }

      override fun onServiceFound(info: NsdServiceInfo) {
        Log.i("SofiLink/mDNS", "Service found: ${info.serviceName}")
        nsdManager?.resolveService(info, object : NsdManager.ResolveListener {
          override fun onResolveFailed(info: NsdServiceInfo, errorCode: Int) {
            Log.e("SofiLink/mDNS", "Resolve failed: $errorCode")
          }

          override fun onServiceResolved(info: NsdServiceInfo) {
            val nickname = info.attributes["nickname"] ?: info.serviceName
            val peerId = info.attributes["peerId"] ?: info.serviceName
            val host = info.host?.hostAddress ?: return
            val peer = DiscoveredPeer(
              peerId = peerId,
              nickname = nickname,
              host = host,
              port = info.port
            )
            onPeerDiscovered(peer)
          }
        })
      }

      override fun onServiceLost(info: NsdServiceInfo) {
        Log.i("SofiLink/mDNS", "Service lost: ${info.serviceName}")
      }
    }

    nsdManager?.discoverServices(serviceType, NsdManager.PROTOCOL_DNS_SD, discoveryListener!!)
  }

  fun stop() {
    discoveryListener?.let { nsdManager?.stopServiceDiscovery(it) }
    localServiceListener?.let {
      if (registered) nsdManager?.unregisterService(it)
    }
    discoveryListener = null
    localServiceListener = null
    nsdManager = null
  }
}
