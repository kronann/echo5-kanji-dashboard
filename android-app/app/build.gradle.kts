plugins {
    id("com.android.application")
}

android {
    namespace = "com.echo5.kanjidash"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.echo5.kanjidash"
        minSdk = 30
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
