param(
  [string]$ProjectDir = (Get-Item $PSScriptRoot).Parent.FullName
)

Write-Host "Applying SofiLink Android patches..." -ForegroundColor Cyan

# 1. gradle.properties
$gp = Join-Path $ProjectDir "android\gradle.properties"
$gpContent = Get-Content $gp -Raw
$gpDirty = $false

if ($gpContent -notmatch "useLegacyPackaging=true") {
  $gpContent = $gpContent -replace 'expo\.useLegacyPackaging=false', 'expo.useLegacyPackaging=true'
  $gpDirty = $true
}
if ($gpContent -notmatch "enableProguardInReleaseBuilds=true") {
  $gpContent += "`nandroid.enableProguardInReleaseBuilds=true"
  $gpDirty = $true
}
if ($gpContent -notmatch "enableShrinkResourcesInReleaseBuilds=true") {
  $gpContent += "`nandroid.enableShrinkResourcesInReleaseBuilds=true"
  $gpDirty = $true
}
if ($gpContent -notmatch "EX_DEV_CLIENT_NETWORK_INSPECTOR=false") {
  $gpContent = $gpContent -replace 'EX_DEV_CLIENT_NETWORK_INSPECTOR=true', 'EX_DEV_CLIENT_NETWORK_INSPECTOR=false'
  $gpDirty = $true
}
if ($gpContent -match "reactNativeArchitectures=.*x86") {
  $gpContent = $gpContent -replace 'reactNativeArchitectures=.*', 'reactNativeArchitectures=arm64-v8a,armeabi-v7a'
  $gpDirty = $true
}
if ($gpContent -match "newArchEnabled=false") {
  $gpContent = $gpContent -replace 'newArchEnabled=false', 'newArchEnabled=true'
  $gpDirty = $true
}
if ($gpDirty) {
  Set-Content $gp $gpContent
  Write-Host "  gradle.properties patched" -ForegroundColor Green
}

# 1b. android/build.gradle — fix minSdkVersion (prebuild resets to 24)
$bgRoot = Join-Path $ProjectDir "android\build.gradle"
$bgRootContent = Get-Content $bgRoot -Raw
if ($bgRootContent -match "minSdkVersion.*24") {
  $bgRootContent = $bgRootContent -replace "minSdkVersion = Integer.parseInt\(findProperty\('android\.minSdkVersion'\) \?: '24'\)",
    "minSdkVersion = Integer.parseInt(findProperty('android.minSdkVersion') ?: '28')"
  Set-Content $bgRoot $bgRootContent
  Write-Host "  android/build.gradle minSdkVersion fixed" -ForegroundColor Green
}

# 2. app/build.gradle — replace entire file to avoid regex corruption
$bg = Join-Path $ProjectDir "android\app\build.gradle"
$bgContent = Get-Content $bg -Raw

if ($bgContent -notmatch "stream-webrtc-android" -or $bgContent -notmatch "signingConfigs") {
  # Write the known-good build.gradle
  $bgContent = @"
apply plugin: "com.android.application"
apply plugin: "org.jetbrains.kotlin.android"
apply plugin: "com.facebook.react"

def projectRoot = rootDir.getAbsoluteFile().getParentFile().getAbsolutePath()

def hasReleaseKey = file('release.keystore').exists()

react {
    entryFile = file(["node", "-e", "require('expo/scripts/resolveAppEntry')", projectRoot, "android", "absolute"].execute(null, rootDir).text.trim())
    reactNativeDir = new File(["node", "--print", "require.resolve('react-native/package.json')"].execute(null, rootDir).text.trim()).getParentFile().getAbsoluteFile()
    hermesCommand = new File(["node", "--print", "require.resolve('react-native/package.json')"].execute(null, rootDir).text.trim()).getParentFile().getAbsolutePath() + "/sdks/hermesc/%OS-BIN%/hermesc"
    codegenDir = new File(["node", "--print", "require.resolve('@react-native/codegen/package.json', { paths: [require.resolve('react-native/package.json')] })"].execute(null, rootDir).text.trim()).getParentFile().getAbsoluteFile()

    cliFile = new File(["node", "--print", "require.resolve('@expo/cli', { paths: [require.resolve('expo/package.json')] })"].execute(null, rootDir).text.trim())
    bundleCommand = "export:embed"
    debuggableVariants = ["devDebug", "prodDebug"]
    autolinkLibrariesWithApp()
}

def enableProguardInReleaseBuilds = (findProperty('android.enableProguardInReleaseBuilds') ?: false).toBoolean()
def jscFlavor = 'org.webkit:android-jsc:+'

android {
    ndkVersion rootProject.ext.ndkVersion
    buildToolsVersion rootProject.ext.buildToolsVersion
    compileSdk rootProject.ext.compileSdkVersion

    namespace 'com.sofilink.messenger'

    flavorDimensions "version"
    productFlavors {
        dev {
            dimension "version"
            applicationIdSuffix ".dev"
            versionNameSuffix "-dev"
        }
        prod {
            dimension "version"
            applicationId 'com.sofilink.messenger'
        }
    }

    defaultConfig {
        applicationId 'com.sofilink.messenger'
        minSdkVersion rootProject.ext.minSdkVersion
        targetSdkVersion rootProject.ext.targetSdkVersion
        versionCode 1
        versionName "0.1.0"
        ndk {
            abiFilters "arm64-v8a", "armeabi-v7a", "x86_64"
        }
    }

    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            storeFile file(hasReleaseKey ? 'release.keystore' : 'debug.keystore')
            storePassword hasReleaseKey ? (System.getenv('ANDROID_KEYSTORE_PASSWORD') ?: '') : 'android'
            keyAlias hasReleaseKey ? (System.getenv('ANDROID_KEY_ALIAS') ?: '') : 'androiddebugkey'
            keyPassword hasReleaseKey ? (System.getenv('ANDROID_KEY_PASSWORD') ?: '') : 'android'
        }
    }

    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig hasReleaseKey ? signingConfigs.release : signingConfigs.debug
            shrinkResources true
            minifyEnabled true
            proguardFiles getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro"
            crunchPngs true
        }
    }

    packagingOptions {
        jniLibs {
            useLegacyPackaging (findProperty('expo.useLegacyPackaging')?.toBoolean() ?: false)
        }
    }

    androidResources {
        ignoreAssetsPattern '!.svn:!.git:!.ds_store:!*.scc:!CVS:!thumbs.db:!picasa.ini:!*~'
    }
}

["pickFirsts", "excludes", "merges", "doNotStrip"].each { prop ->
    def options = (findProperty("android.packagingOptions.${prop}") ?: "").split(",");
    for (i in 0..<options.size()) options[i] = options[i].trim();
    options -= ""
    if (options.length > 0) {
        println "android.packagingOptions.${prop} += ${options} (${options.length})"
        options.each {
            android.packagingOptions[prop] += it
        }
    }
}

dependencies {
    implementation("com.facebook.react:react-android")
    implementation("io.getstream:stream-webrtc-android:1.2.2")

    def isGifEnabled = (findProperty('expo.gif.enabled') ?: "") == "true";
    def isWebpEnabled = (findProperty('expo.webp.enabled') ?: "") == "true";
    def isWebpAnimatedEnabled = (findProperty('expo.webp.animated') ?: "") == "true";

    if (isGifEnabled) {
        implementation("com.facebook.fresco:animated-gif:`${reactAndroidLibs.versions.fresco.get()}")
    }
    if (isWebpEnabled) {
        implementation("com.facebook.fresco:webpsupport:`${reactAndroidLibs.versions.fresco.get()}")
        if (isWebpAnimatedEnabled) {
            implementation("com.facebook.fresco:animated-webp:`${reactAndroidLibs.versions.fresco.get()}")
        }
    }
    if (hermesEnabled.toBoolean()) {
        implementation("com.facebook.react:hermes-android")
    } else {
        implementation jscFlavor
    }
}
"@
  Set-Content $bg $bgContent
  Write-Host "  build.gradle fully replaced" -ForegroundColor Green
}

# 3. proguard-rules.pro
$pr = Join-Path $ProjectDir "android\app\proguard-rules.pro"
$prContent = Get-Content $pr -Raw
if ($prContent -notmatch "com\.sofilink\.messenger\.webrtc") {
  $prContent += @'

# React Navigation
-keep class com.facebook.react.views.** { *; }
-dontwarn com.facebook.react.views.**
-keep class com.swmansion.rnscreens.** { *; }
-dontwarn com.swmansion.rnscreens.**
-keep class com.th3rdwave.safeareacontext.** { *; }
-dontwarn com.th3rdwave.safeareacontext.**
-keep class com.facebook.react.turbomodule.** { *; }

# SofiLink Native Modules
-keep class com.sofilink.messenger.webrtc.** { *; }
-keep class com.sofilink.messenger.p2p.** { *; }
-keep class com.sofilink.messenger.crypto.** { *; }
-keep class com.sofilink.messenger.bluetooth.** { *; }

# WebRTC
-keep class org.webrtc.** { *; }
-dontwarn org.webrtc.**

# Keep React Native
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }

# Optimize
-assumenosideeffects class android.util.Log {
    public static *** v(...);
    public static *** d(...);
    public static *** i(...);
}
-keepattributes SourceFile,LineNumberTable
'@
  Set-Content $pr $prContent
  Write-Host "  proguard-rules.pro patched" -ForegroundColor Green
}

# 4. AndroidManifest.xml — ensure permissions
$mf = Join-Path $ProjectDir "android\app\src\main\AndroidManifest.xml"
$mfContent = Get-Content $mf -Raw
if ($mfContent -notmatch "RECORD_AUDIO") {
  $mfContent = $mfContent -replace '(INTERNET"/>)(\s+<queries>)', @'
INTERNET"/>
  <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
  <uses-permission android:name="android.permission.ACCESS_WIFI_STATE"/>
  <uses-permission android:name="android.permission.RECORD_AUDIO"/>
  <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
  <uses-permission android:name="android.permission.WAKE_LOCK"/>
  <uses-permission android:name="android.permission.BLUETOOTH"/>
  <uses-permission android:name="android.permission.BLUETOOTH_ADMIN"/>
  <uses-permission android:name="android.permission.BLUETOOTH_SCAN"/>
  <uses-permission android:name="android.permission.BLUETOOTH_CONNECT"/>
  <uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE"/>
  <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
$2
'@
  Set-Content $mf $mfContent
  Write-Host "  AndroidManifest.xml patched" -ForegroundColor Green
}

# 5. Restore native Kotlin modules (expo prebuild --clean deletes them)
$nativeSrc = Join-Path $ProjectDir "native-modules\android"
$javaBase = Join-Path $ProjectDir "android\app\src\main\java\com\sofilink\messenger"

function Restore-NativeModules {
  param($moduleDir)
  $srcDir = Join-Path $nativeSrc $moduleDir
  $dstDir = Join-Path $javaBase $moduleDir
  if (-not (Test-Path $dstDir)) {
    New-Item -ItemType Directory -Path $dstDir -Force | Out-Null
  }
  Get-ChildItem -Path $srcDir -Filter "*.kt" | ForEach-Object {
    $target = Join-Path $dstDir $_.Name
    Copy-Item -Path $_.FullName -Destination $target -Force
    Write-Host "  Restored $moduleDir/$($_.Name)" -ForegroundColor Green
  }
}

# Copy MainApplication.kt from native-modules root
$mainAppSrc = Join-Path $nativeSrc "MainApplication.kt"
$mainAppDst = Join-Path $javaBase "MainApplication.kt"
if (Test-Path $mainAppSrc) {
  Copy-Item -Path $mainAppSrc -Destination $mainAppDst -Force
  Write-Host "  Restored MainApplication.kt" -ForegroundColor Green
} else {
  Write-Host "  WARNING: Cannot find native-modules/android/MainApplication.kt" -ForegroundColor Red
}

Restore-NativeModules "webrtc"
Restore-NativeModules "p2p"
Restore-NativeModules "crypto"
Restore-NativeModules "bluetooth"

# 6. styles.xml — fix AppTheme to use dark background instead of white
$stylesPath = Join-Path $ProjectDir "android\app\src\main\res\values\styles.xml"
$stylesContent = Get-Content $stylesPath -Raw
if ($stylesContent -match "Theme.AppCompat.Light.NoActionBar") {
  $stylesContent = $stylesContent -replace 'parent="Theme.AppCompat.Light.NoActionBar"', 'parent="Theme.AppCompat.DayNight.NoActionBar"'
  $stylesContent = $stylesContent -replace '<item name="android:textColor">@android:color/black</item>', '<item name="android:textColor">@android:color/white</item>'
  $stylesContent = $stylesContent -replace '(<item name="android:statusBarColor">)', @'
    <item name="android:windowBackground">#0a0a0f</item>
    <item name="android:navigationBarColor">#0a0a0f</item>
    $1
'@
  Set-Content $stylesPath $stylesContent
  Write-Host "  styles.xml patched (dark theme)" -ForegroundColor Green
}

Write-Host "SofiLink Android patches applied!" -ForegroundColor Cyan
