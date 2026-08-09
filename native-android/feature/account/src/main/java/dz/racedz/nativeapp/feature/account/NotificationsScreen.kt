package dz.racedz.nativeapp.feature.account

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.NotificationsNone
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dz.racedz.nativeapp.core.design.R
import dz.racedz.nativeapp.core.design.ZidRunCard
import dz.racedz.nativeapp.core.design.ZidRunDimens
import dz.racedz.nativeapp.core.design.ZidRunErrorView
import dz.racedz.nativeapp.core.design.ZidRunFormat
import dz.racedz.nativeapp.core.design.ZidRunLoading
import dz.racedz.nativeapp.core.design.ZidRunStatusView
import dz.racedz.nativeapp.core.design.ZidRunTextButton
import dz.racedz.nativeapp.core.design.ZidRunTheme
import dz.racedz.nativeapp.core.design.ZidRunTopBar
import dz.racedz.nativeapp.core.design.currentLocale

/**
 * The notification inbox (NATGAP-02).
 *
 * The server has recorded notifications all along — race approvals, coach nudges, group activity,
 * broadcasts — and a native runner had no way to read any of them. Push now delivers the
 * interrupting ones, but a push is a moment: miss it, swipe it away, or receive it while the phone
 * is off, and it was gone forever. This is where they persist.
 *
 * Reloads on resume so an arriving push and the list cannot disagree about the unread count.
 */
@Composable
fun NotificationsScreen(
    viewModel: NotificationsViewModel,
    onBack: () -> Unit,
    /** Opens the destination a notification points at, when it maps to a native screen. */
    onOpenHref: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val colors = ZidRunTheme.colors
    val locale = currentLocale()

    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) viewModel.load()
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    Column(modifier = modifier.fillMaxSize().background(colors.background)) {
        ZidRunTopBar(
            title = stringResource(R.string.notifications_title),
            onBack = onBack,
            trailing = {
                // Offered only when it would do something. A "mark all as read" on an already-read
                // inbox is a control that reports success and changes nothing.
                if (state.unreadCount > 0) {
                    ZidRunTextButton(
                        text = stringResource(R.string.notifications_mark_all),
                        onClick = viewModel::markAllRead,
                        fillWidth = false,
                    )
                }
            },
        )

        when {
            state.loading && state.notifications.isEmpty() ->
                Box(Modifier.fillMaxSize()) { ZidRunLoading(label = stringResource(R.string.common_loading)) }

            state.error != null && state.notifications.isEmpty() -> ZidRunErrorView(
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

            state.notifications.isEmpty() -> ZidRunStatusView(
                icon = Icons.Filled.NotificationsNone,
                title = stringResource(R.string.notifications_empty_title),
                body = stringResource(R.string.notifications_empty_body),
            )

            else -> LazyColumn(
                modifier = Modifier.fillMaxSize().navigationBarsPadding(),
                contentPadding = PaddingValues(
                    start = ZidRunDimens.spaceLg,
                    end = ZidRunDimens.spaceLg,
                    bottom = ZidRunDimens.spaceXxl,
                ),
                verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceMd),
            ) {
                items(state.notifications, key = { it.id }) { notification ->
                    ZidRunCard(
                        onClick = {
                            viewModel.open(notification.id)
                            notification.href?.let(onOpenHref)
                        },
                    ) {
                        Row(verticalAlignment = Alignment.Top) {
                            // An unread dot rather than colour alone, so "unread" survives a
                            // greyscale screen and colour blindness.
                            Box(
                                modifier = Modifier
                                    .padding(top = 6.dp)
                                    .size(8.dp)
                                    .clip(CircleShape)
                                    .background(if (notification.read) colors.border else colors.primary),
                            )
                            Spacer(Modifier.width(ZidRunDimens.spaceMd))
                            Column(
                                modifier = Modifier
                                    .weight(1f)
                                    .semantics(mergeDescendants = true) {
                                        contentDescription = "${notification.title}. ${notification.body}"
                                    },
                                verticalArrangement = Arrangement.spacedBy(ZidRunDimens.spaceXs),
                            ) {
                                Text(
                                    text = notification.title,
                                    style = MaterialTheme.typography.titleSmall,
                                    color = colors.textStrong,
                                )
                                Text(
                                    text = notification.body,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = colors.text,
                                )
                                Text(
                                    text = ZidRunFormat.dateTime(notification.createdAt, locale),
                                    style = MaterialTheme.typography.labelSmall,
                                    color = colors.textMuted,
                                )
                            }
                        }
                    }
                }
                item(key = "tail") { Spacer(Modifier.height(ZidRunDimens.spaceLg)) }
            }
        }
    }
}
