package works.anthar.app.ui.field

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Call
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import works.anthar.app.data.ApiClient
import works.anthar.app.data.Ticket
import works.anthar.app.data.TransitionRequest
import works.anthar.app.data.UseSpareRequest
import works.anthar.app.data.userMessage

// Mirrors the backend state machine for field roles.
private val NEXT: Map<String, List<String>> = mapOf(
    "ASSIGNED" to listOf("ACCEPTED", "REJECTED"),
    "ACCEPTED" to listOf("IN_TRANSIT", "PENDING"),
    "IN_TRANSIT" to listOf("IN_PROGRESS", "PENDING"),
    "IN_PROGRESS" to listOf("COMPLETED", "PENDING"),
)
private val REASON_REQUIRED = setOf("REJECTED", "CANCELLED")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun JobDetailScreen(
    ticketId: String,
    onBack: () -> Unit,
    onCapture: (ticketId: String, phase: String) -> Unit,
) {
    var ticket by remember { mutableStateOf<Ticket?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var refreshKey by remember { mutableIntStateOf(0) }
    var reasonFor by remember { mutableStateOf<String?>(null) }
    var reasonText by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    LaunchedEffect(refreshKey) {
        runCatching { ApiClient.api.ticket(ticketId) }
            .onSuccess { ticket = it; error = null }
            .onFailure { error = it.userMessage() }
    }

    fun transition(to: String, reason: String? = null) {
        scope.launch {
            runCatching { ApiClient.api.transition(ticketId, TransitionRequest(to, reason)) }
                .onSuccess { refreshKey++ }
                .onFailure { error = it.userMessage() }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(ticket?.ticketNo ?: "Job") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
    ) { padding ->
        val t = ticket
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            if (t == null) {
                Text("Loading…")
                return@Scaffold
            }

            Card {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("${t.type} — ${t.status.replace('_', ' ')}", style = MaterialTheme.typography.titleMedium)
                    Text(t.customer.user.name, style = MaterialTheme.typography.bodyLarge)
                    Text(
                        listOfNotNull(t.customer.address, t.customer.pincode).joinToString(", "),
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    t.slotWindow?.let { Text("Slot: $it") }
                    t.customer.user.phone?.let { phone ->
                        OutlinedButton(onClick = {
                            context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone")))
                        }) {
                            Icon(Icons.Default.Call, contentDescription = null)
                            Text("  Call customer")
                        }
                    }
                }
            }

            // Status actions
            val actions = NEXT[t.status].orEmpty()
            if (actions.isNotEmpty()) {
                Text("Update status", style = MaterialTheme.typography.titleSmall)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    actions.forEach { next ->
                        Button(onClick = {
                            if (next in REASON_REQUIRED) {
                                reasonFor = next; reasonText = ""
                            } else {
                                transition(next)
                            }
                        }) { Text(next.replace('_', ' ')) }
                    }
                }
            }

            HorizontalDivider()

            // Mandatory live photos (camera-only, geotagged)
            Text("Job photos (camera only, geotagged)", style = MaterialTheme.typography.titleSmall)
            val before = t.media.orEmpty().count { it.phase == "BEFORE" }
            val after = t.media.orEmpty().count { it.phase == "AFTER" }
            Text("Before: $before photo(s) · After: $after photo(s)")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { onCapture(t.id, "BEFORE") }) { Text("Capture BEFORE") }
                OutlinedButton(onClick = { onCapture(t.id, "AFTER") }) { Text("Capture AFTER") }
            }
            if (t.status == "IN_PROGRESS" && (before == 0 || after == 0)) {
                Text(
                    "Both before & after photos are required to complete this job.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.tertiary,
                )
            }

            HorizontalDivider()

            SparePartsSection(
                used = t.spareUsage.orEmpty(),
                onUse = { partId, qty ->
                    scope.launch {
                        runCatching { ApiClient.api.useSpare(ticketId, UseSpareRequest(partId, qty)) }
                            .onSuccess { refreshKey++ }
                            .onFailure { error = it.userMessage() }
                    }
                },
            )

            HorizontalDivider()

            Text("Timeline", style = MaterialTheme.typography.titleSmall)
            t.events.orEmpty().forEach { ev ->
                Column(Modifier.padding(vertical = 2.dp)) {
                    Text(
                        ev.toStatus?.replace('_', ' ') ?: "Update",
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    ev.remarks?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
                }
            }
        }
    }

    reasonFor?.let { target ->
        AlertDialog(
            onDismissRequest = { reasonFor = null },
            title = { Text("Reason for $target") },
            text = {
                OutlinedTextField(
                    value = reasonText,
                    onValueChange = { reasonText = it },
                    label = { Text("Justification (required)") },
                    modifier = Modifier.fillMaxWidth(),
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        if (reasonText.isNotBlank()) {
                            transition(target, reasonText)
                            reasonFor = null
                        }
                    },
                ) { Text("Submit") }
            },
            dismissButton = { TextButton(onClick = { reasonFor = null }) { Text("Cancel") } },
        )
    }
}
