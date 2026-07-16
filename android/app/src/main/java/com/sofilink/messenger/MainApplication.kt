package com.sofilink.messenger

import android.app.Application
import android.util.Log
import java.io.File

class MainApplication : Application() {

  override fun onCreate() {
    super.onCreate()

    val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
    Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
      try {
        File(filesDir, "crash_log.txt").writeText(
          "${thread.name}: ${throwable.message}\n${throwable.stackTraceToString()}"
        )
      } catch (_: Exception) {}
      defaultHandler?.uncaughtException(thread, throwable)
    }
  }
}
