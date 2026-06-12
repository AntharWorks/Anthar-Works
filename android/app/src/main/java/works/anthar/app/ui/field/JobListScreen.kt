package works.anthar.app.ui.field

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import works.anthar.app.data.ApiClient
import works.anthar.app.data.Ticket
import works.anthar.app.data.userMessage

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun JobListScreen(
    title: String,
    onOpenJob: (String) -> Unit,
    onLogout: () -> Unit,
    extraContent: (@Composable () -> Unit)? = null,
) {
    var jobs by remember { mutableStateOf<List<Ticket>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(true) }
    var refreshKey by remember { mutableIntStateOf(0) }

    LaunchedEffect(refreshKey) {
        loading = true
        runCatching { ApiClient.api.myJobs() }
            .onSuccess { jobs = it; error = null }
            .onFailure { error = it.userMessage() }
        loading = false
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(title) },
                actions = {
                    IconButton(onClick = { refreshKey++ }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                    IconButton(onClick = onLogout) {
                        Icon(Icons.Default.ExitToApp, contentDescription = "Sign out")
                    }
                },
            )
        },
    ) { padding ->
        Column(modifier = Modifier.padding(padding).fillMaxSize()) {
            extraContent?.invoke()
            if (loading) {
                Text("Loading jobs…", modifier = Modifier.padding(16.dp))
            }
            error?.let {
                Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(16.dp))
            }
            if (!loading && error == null && jobs.isEmpty()) {
                Text("No open jobs. Pull Refresh to check again.", modifier = Modifier.padding(16.dp))
            }
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(jobs, key = { it.id }) { job ->
                    Card(modifier = Modifier.fillMaxWidth().clickable { onOpenJob(job.id) }) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text(job.ticketNo, style = MaterialTheme.typography.titleMedium)
                                AssistChip(onClick = {}, label = { Text(job.status.replace('_', ' ')) })
                            }
                            Text(
                                "${job.type} · ${job.customer.user.name}",
                                style = MaterialTheme.typography.bodyMedium,
                            )
                            Text(
                                listOfNotNull(
                                    job.customer.address,
                                    job.customer.pincode,
                                    job.slotWindow?.let { "Slot $it" },
                                ).joinToString(" · ").ifEmpty { "No slot set" },
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                    }
                }
            }
        }
    }
}
