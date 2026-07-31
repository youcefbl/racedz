pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "ZidRunNative"

include(":app")
include(":core:design")
include(":core:network")
include(":core:auth")
include(":feature:auth")
include(":feature:races")
include(":feature:account")
include(":feature:registration")
include(":feature:runs")
