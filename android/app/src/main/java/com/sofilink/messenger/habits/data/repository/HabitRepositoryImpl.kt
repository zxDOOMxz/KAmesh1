package com.sofilink.messenger.habits.data.repository

import com.sofilink.messenger.habits.data.local.HabitDao
import com.sofilink.messenger.habits.data.local.toDomain
import com.sofilink.messenger.habits.data.local.toEntity
import com.sofilink.messenger.habits.domain.model.Habit
import com.sofilink.messenger.habits.domain.repository.HabitRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.time.LocalDate
class HabitRepositoryImpl(
    private val dao: HabitDao
) : HabitRepository {

    override fun observeAll(): Flow<List<Habit>> =
        dao.observeAll().map { entities -> entities.map { it.toDomain() } }

    override suspend fun getById(id: Long): Habit? =
        dao.getById(id)?.toDomain()

    override suspend fun save(habit: Habit) {
        dao.upsert(habit.toEntity())
    }

    /**
     * Если сегодняшняя дата уже есть в completedDates — убираем её (uncheck).
     * Если нет — добавляем (check).
     */
    override suspend fun toggleToday(habit: Habit) {
        val today = LocalDate.now()
        val updated = habit.copy(
            completedDates = if (habit.completedDates.contains(today)) {
                habit.completedDates - today
            } else {
                habit.completedDates + today
            }
        )
        dao.upsert(updated.toEntity())
    }

    override suspend fun delete(id: Long) {
        dao.deleteById(id)
    }
}
