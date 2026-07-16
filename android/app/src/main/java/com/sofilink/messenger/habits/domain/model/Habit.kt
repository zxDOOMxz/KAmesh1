package com.sofilink.messenger.habits.domain.model

import java.time.DayOfWeek
import java.time.LocalDate

data class Habit(
    val id: Long = 0,
    val title: String,
    val description: String = "",
    val createdAt: LocalDate = LocalDate.now(),
    val completedDates: Set<LocalDate> = emptySet()
) {
    val isCompletedToday: Boolean
        get() = completedDates.contains(LocalDate.now())

    fun completionRateForWeek(): Float {
        val today = LocalDate.now()
        val startOfWeek = today.with(DayOfWeek.MONDAY)
        val daysInWeek = (0 until 7).map { startOfWeek.plusDays(it.toLong()) }
        val completed = daysInWeek.count { completedDates.contains(it) }
        return if (daysInWeek.isEmpty()) 0f else completed.toFloat() / daysInWeek.size
    }
}
