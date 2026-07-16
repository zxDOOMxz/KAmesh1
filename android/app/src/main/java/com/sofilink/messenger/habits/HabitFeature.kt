package com.sofilink.messenger.habits

import android.os.Bundle
import android.util.Log
import android.widget.TextView
import androidx.activity.compose.setContent
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.room.Room
import com.sofilink.messenger.habits.data.local.HabitDatabase
import com.sofilink.messenger.habits.data.repository.HabitRepositoryImpl
import com.sofilink.messenger.habits.ui.addhabit.AddHabitViewModel
import com.sofilink.messenger.habits.ui.habitlist.HabitListViewModel
import com.sofilink.messenger.habits.ui.navigation.HabitNavGraph
import com.sofilink.messenger.habits.ui.theme.HabitTheme
import androidx.navigation.compose.rememberNavController

class HabitActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        try {
            // Создаём зависимости вручную: Room → DAO → Repository → ViewModel
            val db = Room.databaseBuilder(
                applicationContext,
                HabitDatabase::class.java,
                "habits.db"
            ).fallbackToDestructiveMigration().build()

            val habitDao = db.habitDao()
            val repository = HabitRepositoryImpl(habitDao)

            // ViewModel без Hilt — фабрика вручную
            val factory = object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                    return when {
                        modelClass.isAssignableFrom(HabitListViewModel::class.java) ->
                            HabitListViewModel(repository) as T
                        modelClass.isAssignableFrom(AddHabitViewModel::class.java) ->
                            AddHabitViewModel(repository) as T
                        else -> throw IllegalArgumentException("Unknown VM: $modelClass")
                    }
                }
            }

            val vmStore = ViewModelProvider(this, factory)

            setContent {
                HabitTheme {
                    HabitNavGraph(
                        navController = rememberNavController(),
                        listViewModel = vmStore[HabitListViewModel::class.java],
                        addHabitViewModel = vmStore[AddHabitViewModel::class.java]
                    )
                }
            }
        } catch (e: Throwable) {
            Log.e("HabitActivity", "Init failed", e)
            val tv = TextView(this).apply {
                text = "Ошибка: ${e.message ?: "неизвестная"}\n\nПожалуйста, перезапустите"
                textSize = 16f
                setPadding(32, 32, 32, 32)
            }
            setContentView(tv)
        }
    }
}
