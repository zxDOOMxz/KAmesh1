package com.sofilink.messenger.habits.ui.habitlist

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sofilink.messenger.habits.domain.model.Habit
import com.sofilink.messenger.habits.domain.repository.HabitRepository
import com.sofilink.messenger.habits.ui.UiState
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.onStart

class HabitListViewModel(
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
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Log.e("HabitListVM", "toggle failed", e)
            }
        }
    }

    fun deleteHabit(id: Long) {
        viewModelScope.launch {
            try {
                repository.delete(id)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Log.e("HabitListVM", "delete failed", e)
            }
        }
    }
}
