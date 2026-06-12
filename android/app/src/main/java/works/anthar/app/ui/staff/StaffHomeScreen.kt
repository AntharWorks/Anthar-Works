package works.anthar.app.ui.staff

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material.icons.filled.Refresh
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import works.anthar.app.data.ApiClient
import works.anthar.app.data.DashboardStats
import works.anthar.app.data.userMessage

/** Admin/Backend on-the-go: live operation stats; full control stays on the web portal. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StaffHomeScreen(title: String, onLogout: () -> Unit) {
    var stats by remember { mutableStateOf<DashboardStats?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var refreshKey by remember { mutableIntStateOf(0) }

    LaunchedEffect(refreshKey) {
        runCatching { ApiClient.api.dashboard() }
            .onSuccess { stats = it; error = null }
            .onFailure { error = it.userMessage() }
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
        Column(
            modifier = Modifier.padding(padding).fillMaxSize().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            val s = stats ?: run { Text("Loading…"); return@Scaffold }

            @Composable
            fun stat(label: String, value: Int) {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text(label)
                        Text(value.toString(), style = MaterialTheme.typography.titleMedium)
                    }
                }
            }

            stat("Customers", s.customers)
            stat("Active subscriptions", s.subscriptions.active)
            stat("Open tickets", s.openTickets)
            stat("SLA breached", s.slaBreached)
            stat("Due within 24h", s.slaAtRisk)
            stat("Completed today", s.completedToday)
            stat("Technicians", s.technicians)
        }
    }
}
