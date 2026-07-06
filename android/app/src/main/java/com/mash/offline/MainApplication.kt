package com.mash.offline

import android.app.Application
import android.content.res.Configuration
import android.util.Log

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.SoLoader

import java.io.File
import java.io.FileWriter

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
        object : DefaultReactNativeHost(this) {
          override fun getPackages(): List<ReactPackage> {
            val packages = PackageList(this).packages
            return packages
          }

          override fun getJSMainModuleName(): String = ".expo/.virtual-metro-entry"

          override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

          override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
          override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }

  private fun writeCrashLog(thread: Thread, throwable: Throwable) {
    try {
      val logFile = File(filesDir, "crash.log")
      FileWriter(logFile, false).use { writer ->
        writer.write("Thread: ${thread.name}\n")
        writer.write("Exception: ${throwable.javaClass.name}\n")
        writer.write("Message: ${throwable.message}\n")
        writer.write("Stack:\n")
        throwable.stackTrace?.forEach { writer.write("  ${it}\n") }
        throwable.cause?.let { cause ->
          writer.write("Caused by: ${cause.javaClass.name}: ${cause.message}\n")
          cause.stackTrace?.forEach { writer.write("  ${it}\n") }
        }
      }
      Log.e("SofiLink/Crash", "Crash logged to ${logFile.absolutePath}", throwable)
    } catch (e: Exception) {
      Log.e("SofiLink/Crash", "Failed to write crash log", e)
    }
  }

  override fun onCreate() {
    Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
      writeCrashLog(thread, throwable)
      Thread.getDefaultUncaughtExceptionHandler()?.uncaughtException(thread, throwable)
    }
    super.onCreate()
    Log.i("SofiLink/Init", "Starting SoLoader.init")
    try {
      SoLoader.init(this, OpenSourceMergedSoMapping)
      Log.i("SofiLink/Init", "SoLoader.init OK")
    } catch (e: Exception) {
      Log.e("SofiLink/Init", "SoLoader.init failed", e)
      throw e
    }
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      try {
        Log.i("SofiLink/Init", "Loading new arch entry point")
        load()
        Log.i("SofiLink/Init", "New arch entry point loaded")
      } catch (e: Exception) {
        Log.e("SofiLink/Init", "NewArchEntryPoint.load failed", e)
        throw e
      }
    }
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
  }
}
