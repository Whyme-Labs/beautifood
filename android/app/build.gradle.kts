plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val beautifoodUrl = (findProperty("beautifoodUrl") as String).trimEnd('/')
val startPath = findProperty("beautifoodStartPath") as String

android {
    namespace = "app.beautifood.pos"
    compileSdk = 35

    defaultConfig {
        applicationId = "app.beautifood.pos"
        // Sunmi V2 Pro runs Android 7.1 (API 25); newer Sunmi devices run 11+.
        minSdk = 25
        targetSdk = 35
        versionCode = (findProperty("versionCode") as String?)?.toInt() ?: 1
        versionName = (findProperty("versionName") as String?) ?: "1.0.0"
        buildConfigField("String", "APP_URL", "\"$beautifoodUrl\"")
        buildConfigField("String", "START_PATH", "\"$startPath\"")
    }

    signingConfigs {
        // CI signs releases with a keystore from secrets; without one, release builds stay unsigned.
        val store = System.getenv("ANDROID_KEYSTORE_FILE")
        if (store != null) {
            create("release") {
                storeFile = file(store)
                storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("ANDROID_KEY_ALIAS")
                keyPassword = System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfigs.findByName("release")?.let { signingConfig = it }
        }
    }
    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    lint { abortOnError = true }
}

dependencies {
    implementation("com.sunmi:printerlibrary:1.0.24")
    testImplementation("junit:junit:4.13.2")
}
