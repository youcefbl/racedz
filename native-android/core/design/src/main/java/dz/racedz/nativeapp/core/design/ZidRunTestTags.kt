package dz.racedz.nativeapp.core.design

/**
 * Stable accessibility/resource identifiers for black-box device tests and Macrobenchmark.
 *
 * These are deliberately few and journey-level. Tests should assert what a runner can observe,
 * not couple themselves to every card and spacer in a Compose implementation.
 */
object ZidRunTestTags {
    const val AuthEmail = "auth_email"
    const val AuthPassword = "auth_password"
    const val AuthSignIn = "auth_sign_in"
    const val OnboardingSkip = "onboarding_skip"

    const val TabRaces = "tab_races"
    const val TabRuns = "tab_runs"
    const val TabCoach = "tab_coach"
    const val TabAccount = "tab_account"

    const val RaceDetailScroll = "race_detail_scroll"
    const val RaceRegister = "race_register"

    const val RegistrationScroll = "registration_scroll"
    const val RegistrationDistance = "registration_distance"
    const val RegistrationDetails = "registration_details"
    const val RegistrationDateOfBirth = "registration_date_of_birth"

    const val RunsOverviewScroll = "runs_overview_scroll"
    const val RunsRecordDock = "runs_record_dock"
    const val CoachOverviewScroll = "coach_overview_scroll"
}
