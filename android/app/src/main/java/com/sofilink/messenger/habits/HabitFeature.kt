package com.sofilink.messenger.habits

import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
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

/**
 * Точка входа в фичу «Привычки». Теперь это LAUNCHER activity.
 *
 * При ошибке инициализации показывает сообщение вместо белого экрана.
 */
@AndroidEntryPoint
class HabitActivity : ComponentActivity() {

    companion object {
        private const val TAG = "HabitActivity"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // enableEdgeToEdge доступен с API 21+, но безопасно проверяем
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            try {
                enableEdgeToEdge()
            } catch (e: Exception) {
                Log.w(TAG, "enableEdgeToEdge failed", e)
            }
        }

        setContent {
            HabitTheme {
                SafeHabitApp()
            }
        }
    }
}

/**
 * Оборачивает основное приложение в try-catch.
 * Если Compose падает при рендеринге — показываем кнопку перезапуска
 * вместо белого экрана.
 */
@Composable
private fun SafeHabitApp() {
    try {
        val navController = rememberNavController()
        HabitNavGraph(navController = navController)
    } catch (e: Exception) {
        Log.e("HabitFeature", "Fatal error in HabitApp", e)
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "Ошибка: ${e.message ?: "неизвестная ошибка"}\nПерезапустите приложение",
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyLarge,
                modifier = Modifier.padding(16.dp)
            )
        }
    }
}
