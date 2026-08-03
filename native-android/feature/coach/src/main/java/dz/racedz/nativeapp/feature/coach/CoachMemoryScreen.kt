package dz.racedz.nativeapp.feature.coach

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunButton
import dz.racedz.nativeapp.core.design.ZidRunCard
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.ZidRunDisplayTitle
import dz.racedz.nativeapp.core.design.ZidRunDivider
import dz.racedz.nativeapp.core.design.ZidRunErrorView
import dz.racedz.nativeapp.core.design.ZidRunInlineError
import dz.racedz.nativeapp.core.design.ZidRunLoading
import dz.racedz.nativeapp.core.design.ZidRunOutlinedButton
import dz.racedz.nativeapp.core.design.ZidRunPill
import dz.racedz.nativeapp.core.design.ZidRunStatusView
import dz.racedz.nativeapp.core.design.ZidRunTextButton
import dz.racedz.nativeapp.core.design.ZidRunTheme
import dz.racedz.nativeapp.core.design.ZidRunTopBar
import dz.racedz.nativeapp.core.network.CoachMemoryItemDto

/**
 * "What your coach remembers" — the memory/privacy surface (COACHPAR-002), mirroring the website's
 * memory panel: every fact with its provenance and age, per-fact "still true" / "forget", and a
 * two-tap delete-all. Health, injury, and medical details are never stored here by design, and the
 * screen says so. Deliberately reachable regardless of entitlement: inspecting and erasing what the
 * coach knows is a privacy control, not a paid feature.
 */
@Composable
fun CoachMemoryScreen(
    viewModel: CoachMemoryViewModel,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val colors = ZidRunTheme.colors

    var confirmingDelete by remember { mutableStateOf(false) }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(colors.background)
            .navigationBarsPadding(),
    ) {
        ZidRunTopBar(title = "", onBack = onBack)

        when {
            state.loading -> ZidRunLoading(label = stringResource(R.string.common_loading))

            state.error != null && state.items.isEmpty() -> ZidRunErrorView(
                title = if (state.isOffline) {
                    stringResource(R.string.common_offline_title)
                } else {
                    stringResource(R.string.common_error_title)
                },
                message = state.error?.message ?: stringResource(R.string.common_offline_body),
                retryLabel = stringResource(R.string.common_retry),
                onRetry = viewModel::load,
                offline = state.isOffline,
                useLocalizedBody = state.error?.isGeneric == true,
            )

            else -> Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = ZidRunDimens.spaceLg),
                verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceLg),
            ) {
                ZidRunDisplayTitle(text = stringResource(R.string.coach_memory_title))
                Text(
                    stringResource(R.string.coach_memory_intro),
                    style = MaterialTheme.typography.bodyMedium,
                    color = colors.textMuted,
                )
                // The health boundary is a promise worth stating where the data is shown.
                Text(
                    stringResource(R.string.coach_memory_health_note),
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.textMuted,
                )

                state.actionError?.let { ZidRunInlineError(it) }
                if (state.deletedAt != null) {
                    Text(
                        stringResource(R.string.coach_memory_deleted),
                        style = MaterialTheme.typography.bodyMedium,
                        color = colors.success,
                    )
                }

                if (state.items.isEmpty()) {
                    ZidRunStatusView(
                        icon = Icons.Filled.Psychology,
                        title = stringResource(R.string.coach_memory_empty_title),
                        body = stringResource(R.string.coach_memory_empty_body),
                    )
                } else {
                    ZidRunCard {
                        Column(verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd)) {
                            state.items.forEachIndexed { index, item ->
                                if (index > 0) ZidRunDivider()
                                MemoryRow(
                                    item = item,
                                    busy = state.pendingId == item.id,
                                    anyBusy = state.pendingId != null || state.deleting,
                                    onConfirm = { viewModel.confirm(item.id) },
                                    onForget = { viewModel.forget(item.id) },
                                )
                            }
                        }
                    }

                    ZidRunDivider()

                    if (confirmingDelete) {
                        Text(
                            stringResource(R.string.coach_memory_delete_body),
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.textMuted,
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd)) {
                            ZidRunOutlinedButton(
                                text = stringResource(R.string.common_cancel),
                                onClick = { confirmingDelete = false },
                                enabled = !state.deleting,
                                modifier = Modifier.weight(1f),
                            )
                            ZidRunButton(
                                text = stringResource(R.string.coach_memory_delete_confirm),
                                onClick = { viewModel.deleteAll { confirmingDelete = false } },
                                enabled = !state.deleting,
                                loading = state.deleting,
                                containerColor = colors.danger,
                                modifier = Modifier.weight(1f),
                            )
                        }
                    } else {
                        // Deliberately a second tap away: erasing the coach's memory is not
                        // recoverable from the app.
                        ZidRunTextButton(
                            text = stringResource(R.string.coach_memory_delete_all),
                            onClick = { confirmingDelete = true },
                        )
                    }
                }

                Spacer(Modifier.height(ZidRunDimens.spaceXxl))
            }
        }
    }
}

@Composable
private fun MemoryRow(
    item: CoachMemoryItemDto,
    busy: Boolean,
    anyBusy: Boolean,
    onConfirm: () -> Unit,
    onForget: () -> Unit,
) {
    val colors = ZidRunTheme.colors
    val source = sourceLabel(item.source)
    val age = if (item.ageDays <= 0) {
        stringResource(R.string.coach_memory_age_today)
    } else {
        pluralStringResource(R.plurals.coach_memory_age_days, item.ageDays, item.ageDays)
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .semantics(mergeDescendants = true) { contentDescription = "${item.fact}. $source. $age" },
        verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
    ) {
        Text(item.fact, style = MaterialTheme.typography.bodyMedium, color = colors.textStrong)
        Row(
            horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceSm),
        ) {
            ZidRunPill(text = source)
            ZidRunPill(text = age, color = if (item.agingOut) colors.accent else null)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd)) {
            // ZidRunTextButton has no enabled state, so reentrancy is guarded in the click
            // handlers; the label flips to "Saving…" on the busy row as the visible feedback.
            ZidRunTextButton(
                text = stringResource(if (busy) R.string.coach_memory_saving else R.string.coach_memory_confirm),
                onClick = { if (!anyBusy) onConfirm() },
                fillWidth = false,
            )
            ZidRunTextButton(
                text = stringResource(if (busy) R.string.coach_memory_saving else R.string.coach_memory_forget),
                onClick = { if (!anyBusy) onForget() },
                fillWidth = false,
            )
        }
    }
}

/** Wire enums are never rendered raw (see the goalTypeLabel post-mortem in CoachScreen). */
@Composable
private fun sourceLabel(source: String): String = when (source) {
    "RUNNER_STATED" -> stringResource(R.string.coach_memory_source_stated)
    "AI_INFERRED" -> stringResource(R.string.coach_memory_source_inferred)
    "SYSTEM_DERIVED" -> stringResource(R.string.coach_memory_source_derived)
    "HUMAN_COACH" -> stringResource(R.string.coach_memory_source_human)
    else -> stringResource(R.string.coach_memory_source_derived)
}
