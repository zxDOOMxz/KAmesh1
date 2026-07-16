package com.sofilink.messenger.habits.domain.repository

import com.sofilink.messenger.habits.domain.model.Habit
import kotlinx.coroutines.flow.Flow

interface HabitRepository {
    fun observeAll(): Flow<List<Habit>>
    suspend fun getById(id: Long): Habit?
    suspend fun save(habit: Habit)
    suspend fun toggleToday(habit: Habit)
    suspend fun delete(id: Long)
}
