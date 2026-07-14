# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Add any project specific keep options here:

# SofiLink Native Modules
-keep class com.sofilink.messenger.webrtc.** { *; }
-keep class com.sofilink.messenger.p2p.** { *; }
-keep class com.sofilink.messenger.crypto.** { *; }
-keep class com.sofilink.messenger.storage.** { *; }

# WebRTC
-keep class org.webrtc.** { *; }
-dontwarn org.webrtc.**

# libsodium
-keep class com.goterl.lazycode.** { *; }
-dontwarn com.goterl.lazycode.**

# Optimize
-assumenosideeffects class android.util.Log {
    public static *** v(...);
    public static *** d(...);
    public static *** i(...);
}
-keepattributes SourceFile,LineNumberTable
-optimizationpasses 5
-repackageclasses 'com.sofilink.opt'
