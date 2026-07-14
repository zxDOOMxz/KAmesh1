# Apply SofiLink Android build patches after expo prebuild

param(
  [string]$ProjectDir = (Get-Item $PSScriptRoot).Parent.FullName
)

$buildGradle = Join-Path $ProjectDir "android\app\build.gradle"
$proguardRules = Join-Path $ProjectDir "android\app\proguard-rules.pro"
$gradleProps = Join-Path $ProjectDir "android\gradle.properties"
$manifest = Join-Path $ProjectDir "android\app\src\main\AndroidManifest.xml"

Write-Host "Applying SofiLink Android patches..." -ForegroundColor Cyan

# 1. gradle.properties - ensure hermetic settings
$gpContent = Get-Content $gradleProps -Raw
$needsGpUpdate = $false

if ($gpContent -notmatch "useLegacyPackaging=true") {
  $gpContent = $gpContent -replace 'expo\.useLegacyPackaging=false', 'expo.useLegacyPackaging=true'
  $needsGpUpdate = $true
}
if ($gpContent -notmatch "enableProguardInReleaseBuilds=true") {
  $gpContent += "`nandroid.enableProguardInReleaseBuilds=true"
  $needsGpUpdate = $true
}
if ($gpContent -notmatch "enableShrinkResourcesInReleaseBuilds=true") {
  $gpContent += "`nandroid.enableShrinkResourcesInReleaseBuilds=true"
  $needsGpUpdate = $true
}
if ($gpContent -notmatch "EX_DEV_CLIENT_NETWORK_INSPECTOR=false") {
  $gpContent = $gpContent -replace 'EX_DEV_CLIENT_NETWORK_INSPECTOR=true', 'EX_DEV_CLIENT_NETWORK_INSPECTOR=false'
  $needsGpUpdate = $true
}
if ($gpContent -match "reactNativeArchitectures=.*x86") {
  $gpContent = $gpContent -replace 'reactNativeArchitectures=.*', 'reactNativeArchitectures=arm64-v8a,armeabi-v7a'
  $needsGpUpdate = $true
}
if ($gpContent -match "newArchEnabled=false") {
  $gpContent = $gpContent -replace 'newArchEnabled=false', 'newArchEnabled=true'
  $needsGpUpdate = $true
}

if ($needsGpUpdate) {
  Set-Content $gradleProps $gpContent
  Write-Host "  gradle.properties patched" -ForegroundColor Green
}

# 2. build.gradle - add WebRTC dependency, flavor dimensions, ABI splits, release config
$bgContent = Get-Content $buildGradle -Raw
$needsBgUpdate = $false

if ($bgContent -notmatch "stream-webrtc-android") {
  $bgContent = $bgContent -replace 'implementation\("com\.facebook\.react:react-android"\)',
    "implementation(`"com.facebook.react:react-android`")`r`n    implementation(`"io.getstream:stream-webrtc-android:1.2.2`")"
  $needsBgUpdate = $true
}

if ($bgContent -notmatch "flavorDimensions") {
  $flavorBlock = @'

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

'@
  $bgContent = $bgContent -replace '(namespace ''com\.sofilink\.messenger''.*?)(\s+defaultConfig)', "`$1${flavorBlock}`$2"
  $needsBgUpdate = $true
}

if ($bgContent -notmatch "abiFilters") {
  $ndkBlock = @'

        ndk {
            abiFilters "arm64-v8a", "armeabi-v7a", "x86_64"
        }
'@
  $bgContent = $bgContent -replace '(versionName "0\.1\.0")(\s+})', "`$1${ndkBlock}`$2"
  $needsBgUpdate = $true
}

if ($bgContent -notmatch "signingConfigs\s*\{[^}]*release") {
  $signingBlock = @'
        release {
            storeFile file('release.keystore')
            storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD') ?: ''
            keyAlias System.getenv('ANDROID_KEY_ALIAS') ?: ''
            keyPassword System.getenv('ANDROID_KEY_PASSWORD') ?: ''
        }
    }
    def hasReleaseKey = file('release.keystore').exists()
'@
  $bgContent = $bgContent -replace '(signingConfigs \{[^}]*debug[^}]*\})', "`$1${signingBlock}"
  # Actually, let's handle the full slice more carefully
  $bgContent = $bgContent -replace '(?s)(signingConfigs \{[^}]*\})', "`$1`r`n    def hasReleaseKey = file('release.keystore').exists()"
  $needsBgUpdate = $true
}

# Patch release signing to use debug keystore as fallback
if ($bgContent -match "signingConfig signingConfigs\.release" -and $bgContent -notmatch "hasReleaseKey") {
  # The signing config already exists in release, just add fallback logic
}

# Ensure release build type is optimized
if ($bgContent -notmatch "shrinkResources true") {
  $releaseBlock = @'
        release {
            signingConfig hasReleaseKey ? signingConfigs.release : signingConfigs.debug
            shrinkResources true
            minifyEnabled true
            proguardFiles getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro"
            crunchPngs true
        }
'@
  $bgContent = $bgContent -replace '(?s)release \{.*?crunchPngs[^}]*\}', $releaseBlock
  $needsBgUpdate = $true
}

# Add ABI splits
if ($bgContent -notmatch "splits\s*\{") {
  $splitsBlock = @'
    splits {
        abi {
            enable true
            reset()
            include "arm64-v8a", "armeabi-v7a", "x86_64"
            universalApk true
        }
    }
'@
  $bgContent = $bgContent -replace '(packagingOptions \{)', "${splitsBlock}`r`n    `$1"
  $needsBgUpdate = $true
}

# Add debuggableVariants
if ($bgContent -notmatch "debuggableVariants") {
  $bgContent = $bgContent -replace '(bundleCommand = "export:embed")', "`$1`r`n    debuggableVariants = [`"devDebug`", `"prodDebug`"]"
  $needsBgUpdate = $true
}

if ($needsBgUpdate) {
  Set-Content $buildGradle $bgContent
  Write-Host "  build.gradle patched" -ForegroundColor Green
}

# 3. proguard-rules.pro
$prContent = Get-Content $proguardRules -Raw
$needsPrUpdate = $false

if ($prContent -notmatch "com\.sofilink\.messenger\.webrtc") {
  $extraRules = @'

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
'@
  $prContent += $extraRules
  $needsPrUpdate = $true
}

if ($needsPrUpdate) {
  Set-Content $proguardRules $prContent
  Write-Host "  proguard-rules.pro patched" -ForegroundColor Green
}

# 4. AndroidManifest.xml - ensure permissions
$mfContent = Get-Content $manifest -Raw
$needsMfUpdate = $false

if ($mfContent -notmatch "RECORD_AUDIO") {
  $mfContent = $mfContent -replace '(INTERNET"/>.*?)(\s+<queries>)', @'
INTERNET"/>
  <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
  <uses-permission android:name="android.permission.ACCESS_WIFI_STATE"/>
  <uses-permission android:name="android.permission.RECORD_AUDIO"/>
  <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
  <uses-permission android:name="android.permission.WAKE_LOCK"/>
$2
'@
  $needsMfUpdate = $true
}

if ($needsMfUpdate) {
  Set-Content $manifest $mfContent
  Write-Host "  AndroidManifest.xml patched" -ForegroundColor Green
}

Write-Host "SofiLink Android patches applied!" -ForegroundColor Cyan
