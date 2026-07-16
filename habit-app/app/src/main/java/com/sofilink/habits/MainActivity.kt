package com.sofilink.habits

import android.os.Bundle
import android.util.Log
import android.widget.TextView
import androidx.activity.compose.setContent
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.navigation.compose.rememberNavController
import androidx.room.Room
import com.sofilink.habits.data.local.HabitDatabase
import com.sofilink.habits.data.repository.HabitRepositoryImpl
import com.sofilink.habits.ui.addhabit.AddHabitViewModel
import com.sofilink.habits.ui.habitlist.HabitListViewModel
import com.sofilink.habits.ui.navigation.HabitNavGraph
import com.sofilink.habits.ui.theme.HabitTheme

class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        try {
            val db = Room.databaseBuilder(
                applicationContext,
                HabitDatabase::class.java,
                "habits.db"
            ).fallbackToDestructiveMigration().build()

            val dao = db.habitDao()
            val repository = HabitRepositoryImpl(dao)

            val factory = object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T = when {
                    modelClass.isAssignableFrom(HabitListViewModel::class.java) ->
                        HabitListViewModel(repository) as T
                    modelClass.isAssignableFrom(AddHabitViewModel::class.java) ->
                        AddHabitViewModel(repository) as T
                    else -> throw IllegalArgumentException("Unknown VM: $modelClass")
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
            Log.e("MainActivity", "Init failed", e)
            val tv = TextView(this).apply {
                text = "Error: ${e.message ?: "unknown"}"
                textSize = 16f
                setPadding(32, 32, 32, 32)
            }
            setContentView(tv)
        }
    }
}
