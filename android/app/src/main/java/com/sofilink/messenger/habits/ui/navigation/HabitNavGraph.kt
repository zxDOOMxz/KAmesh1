package com.sofilink.messenger.habits.ui.navigation

import androidx.compose.runtime.Composable
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
fun HabitNavGraph(
    navController: NavHostController,
    listViewModel: HabitListViewModel,
    addHabitViewModel: AddHabitViewModel
) {
    NavHost(
        navController = navController,
        startDestination = Routes.HABIT_LIST
    ) {
        composable(Routes.HABIT_LIST) {
            HabitListScreen(
                viewModel = listViewModel,
                onAddClick = { navController.navigate(Routes.ADD_HABIT) }
            )
        }
        composable(Routes.ADD_HABIT) {
            AddHabitScreen(
                viewModel = addHabitViewModel,
                onNavigateBack = { navController.popBackStack() }
            )
        }
    }
}
