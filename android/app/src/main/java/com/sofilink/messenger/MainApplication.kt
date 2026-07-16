package com.sofilink.messenger

import android.app.Application
import android.content.res.Configuration
import android.util.Log
import android.widget.Toast

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.ReactHost
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.SoLoader

import com.sofilink.messenger.webrtc.WebRTCPackage
import com.sofilink.messenger.p2p.P2PPackage
import com.sofilink.messenger.crypto.CryptoPackage

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ReactNativeHostWrapper
import java.io.File

class MainApplication : Application(), ReactApplication {

  companion object {
    private const val TAG = "MainApplication"
  }

  private var _reactNativeHost: ReactNativeHost? = null

  override val reactNativeHost: ReactNativeHost
    get() {
      if (_reactNativeHost == null) {
        try {
          _reactNativeHost = ReactNativeHostWrapper(
            this,
            object : DefaultReactNativeHost(this) {
              override fun getPackages(): List<ReactPackage> {
                val packages = PackageList(this).packages.toMutableList()
                packages.add(WebRTCPackage())
                packages.add(P2PPackage())
                packages.add(CryptoPackage())
                return packages
              }

              override fun getJSMainModuleName(): String = ".expo/.virtual-metro-entry"

              override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

              override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
              override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
          })
        } catch (e: Exception) {
          Log.e(TAG, "reactNativeHost init failed", e)
          _reactNativeHost = object : DefaultReactNativeHost(this) {
            override fun getPackages(): List<ReactPackage> = emptyList()
            override fun getJSMainModuleName(): String = ""
            override fun getUseDeveloperSupport(): Boolean = false
            override val isNewArchEnabled: Boolean = false
            override val isHermesEnabled: Boolean = false
          }
        }
      }
      return _reactNativeHost!!
    }

  override val reactHost: ReactHost
    get() = ReactNativeHostWrapper.createReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()

    // Глобальный ловец крашей — записывает в файл /data/data/.../crash_log.txt
    val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
    Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
      try {
        File(filesDir, "crash_log.txt").writeText(
          "${thread.name}: ${throwable.message}\n${throwable.stackTraceToString()}"
        )
      } catch (_: Exception) {}
      defaultHandler?.uncaughtException(thread, throwable)
    }

    try {
      SoLoader.init(this, OpenSourceMergedSoMapping)
      if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) load()
      ApplicationLifecycleDispatcher.onApplicationCreate(this)
    } catch (e: Exception) {
      Log.e(TAG, "React Native init failed — app continues without RN", e)
    }
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
