package com.sofilink.messenger.habits

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.Composable
import androidx.navigation.compose.rememberNavController
import com.sofilink.messenger.habits.ui.navigation.HabitNavGraph
import com.sofilink.messenger.habits.ui.theme.HabitTheme
import dagger.hilt.android.AndroidEntryPoint

/**
 * Точка входа в фичу «Привычки».
 * Activity помечена [AndroidEntryPoint], чтобы Hilt мог внедрять
 * ViewModel через [hiltViewModel] в Compose-экранах.
 *
 * Для запуска:
 * - Убедитесь, что Activity объявлена в AndroidManifest.xml
 * - Вызовите startActivity(Intent(this, HabitActivity::class.java))
 */
@AndroidEntryPoint
class HabitActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            HabitTheme {
                HabitApp()
            }
        }
    }
}

@Composable
private fun HabitApp() {
    val navController = rememberNavController()
    HabitNavGraph(navController = navController)
}
