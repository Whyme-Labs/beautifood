pluginManagement {
    repositories {
        google()
        // Google's mirror of Maven Central first: Central itself rate-limits busy CI and build hosts
        maven("https://maven-central.storage-download.googleapis.com/maven2/")
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        // Google's mirror of Maven Central first: Central itself rate-limits busy CI and build hosts
        maven("https://maven-central.storage-download.googleapis.com/maven2/")
        mavenCentral()
    }
}
rootProject.name = "beautifood-pos"
include(":app")
