package com.sofilink.messenger.habits.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.sofilink.messenger.habits.domain.model.Habit
import java.time.LocalDate

@Entity(tableName = "habits")
data class HabitEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val title: String,
    val description: String,
    val createdAt: String, // ISO-8601
    val completedDates: String // ISO-8601 dates joined by ","
)

fun HabitEntity.toDomain(): Habit {
    val dates = if (completedDates.isBlank()) emptySet()
    else completedDates.split(",").map { LocalDate.parse(it) }.toSet()
    return Habit(
        id = id,
        title = title,
        description = description,
        createdAt = LocalDate.parse(createdAt),
        completedDates = dates
    )
}

fun Habit.toEntity(): HabitEntity = HabitEntity(
    id = id,
    title = title,
    description = description,
    createdAt = createdAt.toString(),
    completedDates = completedDates.joinToString(",") { it.toString() }
)
