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
    const val REGISTRATION = "register/{raceId}?categoryId={categoryId}"
    const val REGISTRATIONS = "account/registrations"
    const val PROFILE = "account/profile"
    const val PRIVACY = "account/privacy"
    const val RUN_HISTORY = "runs/history"
    const val RUN_DETAIL = "runs/{runId}"
    /**
     * `workoutId` is the planned session this run is being logged for, and is what links the saved
     * run back to the plan. Optional: the Runs tab starts a free run with no workout at all.
     */
    const val RUN_START = "runs/start?workoutId={workoutId}"
    const val RUN_RECORDING = "runs/recording"
    const val RUN_SUMMARY = "runs/summary"
    const val ONBOARDING = "onboarding"
    /** `edit=true` reuses the same five steps prefilled, against the update endpoint. */
    const val COACH_SETUP = "coach/setup?edit={edit}"
    const val COACH_PLAN = "coach/plan"
    /**
     * `runId` focuses the conversation on one run, which is what "Analyze run" means. Optional: the
     * Coach tab opens the same screen with no run in mind.
     */
    const val COACH_CHAT = "coach/chat?runId={runId}"
    const val COACH_SLEEP = "coach/sleep"
    /** "What your coach remembers" — the memory/privacy surface (COACHPAR-002). */
    const val COACH_MEMORY = "coach/memory"

    fun coachSetup(editing: Boolean = false) = if (editing) "coach/setup?edit=true" else "coach/setup"

    fun coachChat(runId: String? = null) =
        if (runId.isNullOrBlank()) "coach/chat" else "coach/chat?runId=$runId"

    fun runStart(workoutId: String? = null) =
        if (workoutId.isNullOrBlank()) "runs/start" else "runs/start?workoutId=$workoutId"

    fun runDetail(runId: String) = "runs/$runId"
    fun raceDetail(idOrSlug: String) = "race/$idOrSlug"
    /**
     * [categoryId] carries the distance the runner already chose on Race Detail, so registration
     * does not reopen that decision unselected (DEV-R02).
     */
    fun registration(idOrSlug: String, categoryId: String? = null) =
        if (categoryId.isNullOrBlank()) "register/$idOrSlug" else "register/$idOrSlug?categoryId=$categoryId"
}

/** Bottom-navigation tabs inside the shell. Mirrors the web nav order (races/runs/coach/account)
 * and the native-design races/account mockups. Organizer/admin stay web-only per the native plan. */
enum class ShellTab(val route: String) {
    Races("shell/races"),
    Runs("shell/runs"),
    Coach("shell/coach"),
    Account("shell/account"),
}
