package com.sofilink.messenger.habits.ui.addhabit

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sofilink.messenger.habits.domain.model.Habit
import com.sofilink.messenger.habits.domain.repository.HabitRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class AddHabitViewModel @Inject constructor(
    private val repository: HabitRepository
) : ViewModel() {

    var title by mutableStateOf("")
    var description by mutableStateOf("")
    var isSaving by mutableStateOf(false)

    /**
     * Валидация: название не должно быть пустым.
     * После сохранения возвращаем true, чтобы экран мог закрыться.
     */
    suspend fun save(): Boolean {
        if (title.isBlank()) return false

        isSaving = true
        return try {
            repository.save(Habit(title = title.trim(), description = description.trim()))
            true
        } catch (e: Exception) {
            false
        } finally {
            isSaving = false
        }
    }
}
