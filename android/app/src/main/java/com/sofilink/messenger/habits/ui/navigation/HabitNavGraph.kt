package com.sofilink.messenger.habits.ui.navigation

import androidx.compose.runtime.Composable
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.sofilink.messenger.habits.ui.addhabit.AddHabitScreen
import com.sofilink.messenger.habits.ui.addhabit.AddHabitViewModel
import com.sofilink.messenger.habits.ui.habitlist.HabitListScreen
import com.sofilink.messenger.habits.ui.habitlist.HabitListViewModel

object Routes {
    const val HABIT_LIST = "habit_list"
    const val ADD_HABIT = "add_habit"
}

@Composable
fun HabitNavGraph(navController: NavHostController) {
    NavHost(
        navController = navController,
        startDestination = Routes.HABIT_LIST
    ) {
        composable(Routes.HABIT_LIST) {
            val viewModel: HabitListViewModel = hiltViewModel()
            HabitListScreen(
                viewModel = viewModel,
                onAddClick = { navController.navigate(Routes.ADD_HABIT) }
            )
        }
        composable(Routes.ADD_HABIT) {
            val viewModel: AddHabitViewModel = hiltViewModel()
            AddHabitScreen(
                viewModel = viewModel,
                onNavigateBack = { navController.popBackStack() }
            )
        }
    }
}
