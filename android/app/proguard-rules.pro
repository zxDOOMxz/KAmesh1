# React Native
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Native Modules
-keep class com.sofilink.messenger.webrtc.** { *; }
-keep class com.sofilink.messenger.p2p.** { *; }
-keep class com.sofilink.messenger.crypto.** { *; }

# WebRTC
-keep class org.webrtc.** { *; }
-dontwarn org.webrtc.**

# ===== Habit Tracker =====
-keep class com.sofilink.messenger.habits.** { *; }

# Room (R8 full mode стирает _Impl классы без явных правил)
-keep class * extends androidx.room.RoomDatabase { *; }
-keep class **._Impl { *; }
-dontwarn androidx.room.**

# Compose / Material3 / Navigation
-keep class androidx.compose.** { *; }
-keep class androidx.navigation.** { *; }
-dontwarn androidx.compose.**
-dontwarn androidx.navigation.**

# Activity / AppCompat
-keep class androidx.activity.** { *; }
-keep class androidx.appcompat.** { *; }
-dontwarn androidx.activity.**
-dontwarn androidx.appcompat.**

# Lifecycle
-keep class androidx.lifecycle.** { *; }
-dontwarn androidx.lifecycle.**

# Coroutines
-keep class kotlinx.coroutines.** { *; }
-dontwarn kotlinx.coroutines.**

# Kotlin stdlib
-dontwarn kotlin.**

# Общие настройки
-keepattributes *Annotation*, RuntimeVisibleAnnotations, Signature, InnerClasses, EnclosingMethod
-keepattributes SourceFile,LineNumberTable
-keepclassmembers enum * { *; }

# Отключаем агрессивную обфускацию (для совместимости с русской прошивкой Honor)
-dontoptimize
