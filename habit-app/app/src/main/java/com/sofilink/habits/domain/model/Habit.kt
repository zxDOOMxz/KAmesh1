package com.sofilink.habits.domain.model

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
        val completed = (0 until 7).count { completedDates.contains(startOfWeek.plusDays(it.toLong())) }
        return completed.toFloat() / 7f
    }
}
