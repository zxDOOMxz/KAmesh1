package com.sofilink.messenger.habits

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class DiagnosticActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val tv = TextView(this).apply {
            text = buildString {
                appendLine("Устройство: ${android.os.Build.MODEL}")
                appendLine("Android: ${android.os.Build.VERSION.SDK_INT}")
                appendLine()
                append("Нажмите кнопку, чтобы открыть трекер привычек.")
            }
            textSize = 18f
            setPadding(48, 48, 48, 48)
        }

        val btn = Button(this).apply {
            text = "Открыть трекер"
            setOnClickListener {
                try {
                    startActivity(Intent(this@DiagnosticActivity, HabitActivity::class.java))
                } catch (e: Exception) {
                    android.util.Log.e("Diagnostic", "start failed", e)
                    android.widget.Toast.makeText(
                        this@DiagnosticActivity,
                        "Ошибка: ${e.message}",
                        android.widget.Toast.LENGTH_LONG
                    ).show()
                }
            }
        }

        LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            addView(tv)
            addView(btn, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).also { it.setMargins(48, 0, 48, 0) })
            setContentView(this)
        }
    }
}
