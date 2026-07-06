package com.mash.offline

import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.core.widget.NestedScrollView

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper
import java.io.File

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    setTheme(R.style.AppTheme);
    try {
      super.onCreate(null)
    } catch (e: Throwable) {
      showError(e)
      return
    }
  }

  private fun showError(error: Throwable) {
    val scroll = ScrollView(this).apply {
      setBackgroundColor(Color.parseColor("#0D1117"))
    }
    val container = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(24, 48, 24, 48)
    }
    container.addView(TextView(this).apply {
      text = "SofiLink Crash Report"
      setTextColor(Color.WHITE)
      textSize = 20f
    })
    container.addView(TextView(this).apply {
      text = "${error.javaClass.simpleName}: ${error.message}"
      setTextColor(Color.parseColor("#FF4444"))
      textSize = 14f
      setPadding(0, 16, 0, 0)
    })

    val stackText = error.stackTrace?.joinToString("\n") { "  $it" } ?: ""
    var extraText = stackText
    var cause = error.cause
    while (cause != null) {
      extraText += "\n\nCaused by: ${cause.javaClass.name}: ${cause.message}\n"
      extraText += cause.stackTrace?.joinToString("\n") { "  $it" } ?: ""
      cause = cause.cause
    }
    container.addView(TextView(this).apply {
      text = extraText
      setTextColor(Color.GRAY)
      textSize = 11f
      setPadding(0, 8, 0, 0)
    })

    try {
      val crashContent = File(filesDir, "crash.log").readText()
      container.addView(TextView(this).apply {
        text = "\n--- crash.log ---\n$crashContent"
        setTextColor(Color.parseColor("#AAAAAA"))
        textSize = 10f
        setPadding(0, 16, 0, 0)
      })
    } catch (_: Exception) {}

    scroll.addView(container)
    setContentView(scroll)
  }

  override fun getMainComponentName(): String = "main"

  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              super.invokeDefaultOnBackPressed()
          }
          return
      }
      super.invokeDefaultOnBackPressed()
  }
}
