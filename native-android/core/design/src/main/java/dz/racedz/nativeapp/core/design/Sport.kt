package dz.racedz.nativeapp.core.design

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.DirectionsRun
import androidx.compose.material.icons.automirrored.filled.DirectionsWalk
import androidx.compose.material.icons.filled.DirectionsBike
import androidx.compose.material.icons.filled.Terrain
import androidx.compose.ui.graphics.vector.ImageVector

/** The activity kinds a run can be (NATRUN-07.1). Codes match the server enum `RunSport`. */
enum class RunSport(val code: String, val labelRes: Int, val icon: ImageVector) {
    RUN("RUN", R.string.runs_sport_run, Icons.AutoMirrored.Filled.DirectionsRun),
    WALK("WALK", R.string.runs_sport_walk, Icons.AutoMirrored.Filled.DirectionsWalk),
    TRAIL("TRAIL", R.string.runs_sport_trail, Icons.Filled.Terrain),
    RIDE("RIDE", R.string.runs_sport_ride, Icons.Filled.DirectionsBike);

    /** On foot: the non-foot check and running records apply. */
    val onFoot: Boolean get() = this != RIDE

    companion object {
        fun fromCode(code: String?): RunSport = entries.firstOrNull { it.code == code } ?: RUN
    }
}
