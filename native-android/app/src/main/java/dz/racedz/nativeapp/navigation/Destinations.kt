package dz.racedz.nativeapp.navigation

/**
 * Top-level routes. Race detail lives here rather than inside a tab so a deep link
 * (zidrun.com/races/<slug>) can open it directly, with the Races tab as its parent on back.
 */
object RootDestinations {
    const val SPLASH = "splash"
    const val AUTH = "auth"
    const val SHELL = "shell"

    const val RACE_DETAIL = "race/{raceId}"
    const val REGISTRATION = "register/{raceId}"
    const val REGISTRATIONS = "account/registrations"
    const val PROFILE = "account/profile"
    const val PRIVACY = "account/privacy"
    const val RUN_HISTORY = "runs/history"
    const val RUN_DETAIL = "runs/{runId}"
    const val RUN_START = "runs/start"
    const val RUN_RECORDING = "runs/recording"
    const val RUN_SUMMARY = "runs/summary"
    const val COACH_SETUP = "coach/setup"
    const val COACH_PLAN = "coach/plan"

    fun runDetail(runId: String) = "runs/$runId"
    fun raceDetail(idOrSlug: String) = "race/$idOrSlug"
    fun registration(idOrSlug: String) = "register/$idOrSlug"
}

/** Bottom-navigation tabs inside the shell. Mirrors the web nav order (races/runs/coach/account)
 * and the native-design races/account mockups. Organizer/admin stay web-only per the native plan. */
enum class ShellTab(val route: String) {
    Races("shell/races"),
    Runs("shell/runs"),
    Coach("shell/coach"),
    Account("shell/account"),
}
