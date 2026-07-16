package com.sofilink.messenger.habits.ui.addhabit

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import com.sofilink.messenger.habits.domain.model.Habit
import com.sofilink.messenger.habits.domain.repository.HabitRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CancellationException
import javax.inject.Inject

@HiltViewModel
class AddHabitViewModel @Inject constructor(
    private val repository: HabitRepository
) : ViewModel() {

    var title by mutableStateOf("")
    var description by mutableStateOf("")
    var isSaving by mutableStateOf(false)
    var errorMessage by mutableStateOf<String?>(null)

    suspend fun save(): Boolean {
        if (title.isBlank()) {
            errorMessage = "Введите название привычки"
            return false
        }

        errorMessage = null
        isSaving = true
        return try {
            repository.save(Habit(title = title.trim(), description = description.trim()))
            true
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            errorMessage = "Ошибка сохранения: ${e.message ?: "неизвестная ошибка"}"
            false
        } finally {
            isSaving = false
        }
    }
}
