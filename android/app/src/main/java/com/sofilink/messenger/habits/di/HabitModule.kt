package com.sofilink.messenger.habits.di

import android.content.Context
import androidx.room.Room
import com.sofilink.messenger.habits.data.local.HabitDao
import com.sofilink.messenger.habits.data.local.HabitDatabase
import com.sofilink.messenger.habits.data.repository.HabitRepositoryImpl
import com.sofilink.messenger.habits.domain.repository.HabitRepository
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object HabitModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): HabitDatabase =
        Room.databaseBuilder(
            context,
            HabitDatabase::class.java,
            "habits.db"
        ).fallbackToDestructiveMigration().build()

    @Provides
    fun provideHabitDao(db: HabitDatabase): HabitDao = db.habitDao()

    @Provides
    @Singleton
    fun provideHabitRepository(impl: HabitRepositoryImpl): HabitRepository = impl
}
