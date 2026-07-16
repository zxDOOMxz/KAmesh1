package com.sofilink.messenger.habits

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

class DiagnosticActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val tv = TextView(this).apply {
            text = """
                Диагностика
                Устройство: ${android.os.Build.MODEL}
                Android: ${android.os.Build.VERSION.SDK_INT}
                
                Нажмите кнопку, чтобы открыть трекер привычек.
                Если трекер не откроется — появится сообщение об ошибке.
            """.trimIndent()
            textSize = 16f
            setPadding(32, 32, 32, 32)
        }

        val btn = Button(this).apply {
            text = "Открыть трекер привычек"
            setOnClickListener {
                try {
                    startActivity(Intent(this@DiagnosticActivity, HabitActivity::class.java))
                } catch (e: Throwable) {
                    Log.e("Diagnostic", "Failed to start HabitActivity", e)
                    Toast.makeText(
                        this@DiagnosticActivity,
                        "Ошибка: ${e.message}",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        }

        val root = android.widget.LinearLayout(this).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            addView(tv)
            addView(btn, android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
                android.view.ViewGroup.LayoutParams.WRAP_CONTENT
            ).also { it.setMargins(32, 32, 32, 0) })
        }
        setContentView(root)
    }
}
