package com.sofilink.messenger.habits.ui.habitlist

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sofilink.messenger.habits.domain.model.Habit
import com.sofilink.messenger.habits.domain.repository.HabitRepository
import com.sofilink.messenger.habits.ui.UiState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.onStart
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class HabitListViewModel @Inject constructor(
    private val repository: HabitRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<UiState<List<Habit>>>(UiState.Loading)
    val uiState: StateFlow<UiState<List<Habit>>> = _uiState

    init {
        observeHabits()
    }

    private fun observeHabits() {
        viewModelScope.launch {
            repository.observeAll()
                .onStart { _uiState.value = UiState.Loading }
                .catch { e -> _uiState.value = UiState.Error(e.message ?: "Unknown error") }
                .collect { habits ->
                    _uiState.value = UiState.Success(habits)
                }
        }
    }

    fun toggleHabit(habit: Habit) {
        viewModelScope.launch {
            try {
                repository.toggleToday(habit)
            } catch (e: Exception) {
                // Snackbar или другая обратная связь — в реальном приложении
            }
        }
    }

    fun deleteHabit(id: Long) {
        viewModelScope.launch {
            try {
                repository.delete(id)
            } catch (e: Exception) {
                // Обработка ошибки удаления
            }
        }
    }
}
