package com.sofilink.messenger.habits

import android.os.Bundle
import android.util.Log
import android.widget.TextView
import android.widget.Toast
import androidx.activity.compose.setContent
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.compose.rememberNavController
import com.sofilink.messenger.habits.ui.navigation.HabitNavGraph
import com.sofilink.messenger.habits.ui.theme.HabitTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class HabitActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        try {
            super.onCreate(savedInstanceState)
        } catch (e: Throwable) {
            Log.e("HabitActivity", "Hilt injection failed", e)
            // Если super.onCreate упал — Activity невалидна, показываем Toast (Toaster выживает)
            android.widget.Toast.makeText(this, "Ошибка Hilt: ${e.message}", android.widget.Toast.LENGTH_LONG).show()
            finish()
            return
        }

        try {
            setContent {
                HabitTheme {
                    HabitNavGraph(navController = rememberNavController())
                }
            }
        } catch (e: Throwable) {
            Log.e("HabitActivity", "Compose init failed", e)
            val tv = TextView(this).apply {
                text = "Ошибка: ${e.message ?: "неизвестная"}\n\nПожалуйста, перезапустите приложение"
                textSize = 16f
                setPadding(32, 32, 32, 32)
            }
            setContentView(tv)
        }
    }
}
