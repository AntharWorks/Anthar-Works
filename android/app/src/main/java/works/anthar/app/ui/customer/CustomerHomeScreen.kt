package works.anthar.app.ui.customer

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
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
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import works.anthar.app.data.ApiClient
import works.anthar.app.data.CreateTicketRequest
import works.anthar.app.data.MyDashboard
import works.anthar.app.data.userMessage

/** Customer Live Dashboard (FRD 1.1): model, purchase date, warranty, tickets. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CustomerHomeScreen(onLogout: () -> Unit) {
    var data by remember { mutableStateOf<MyDashboard?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var notice by remember { mutableStateOf<String?>(null) }
    var refreshKey by remember { mutableIntStateOf(0) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(refreshKey) {
        runCatching { ApiClient.api.myDashboard() }
            .onSuccess { data = it; error = null }
            .onFailure { error = it.userMessage() }
    }

    fun raise(type: String) {
        scope.launch {
            runCatching { ApiClient.api.raiseTicket(CreateTicketRequest(type)) }
                .onSuccess { notice = "Ticket ${it.ticketNo} raised — we'll be in touch shortly."; refreshKey++ }
                .onFailure { error = it.userMessage() }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("My Anthar Works") },
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
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            notice?.let { Text(it, color = MaterialTheme.colorScheme.tertiary) }
            val d = data ?: run { Text("Loading…"); return@Scaffold }

            Text("Hi ${d.user.name}", style = MaterialTheme.typography.headlineSmall)
            Text(d.customerNo, style = MaterialTheme.typography.bodySmall)

            Card {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("My purifiers", style = MaterialTheme.typography.titleSmall)
                    if (d.devices.isEmpty()) Text("No devices registered.")
                    d.devices.forEach { dev ->
                        Text("${dev.product.brand} ${dev.product.model}", style = MaterialTheme.typography.bodyLarge)
                        Text(
                            "Purchased ${dev.purchaseDate.take(10)} · ${dev.warrantyType} warranty until ${dev.warrantyExpiry.take(10)}",
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
            }

            Card {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("My subscriptions", style = MaterialTheme.typography.titleSmall)
                    if (d.subscriptions.isEmpty()) Text("No subscriptions.")
                    d.subscriptions.forEach { s ->
                        Text("${s.plan.name} — ${s.status}", style = MaterialTheme.typography.bodyLarge)
                        s.nextRenewalAt?.let { Text("Renews ${it.take(10)}", style = MaterialTheme.typography.bodySmall) }
                    }
                    // One-click renewal lands here in the payments slice (Razorpay Checkout SDK).
                }
            }

            Card {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Service tickets", style = MaterialTheme.typography.titleSmall)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(onClick = { raise("COMPLAINT") }) { Text("Raise complaint") }
                        OutlinedButton(onClick = { raise("SERVICE") }) { Text("Request service") }
                    }
                    d.tickets.forEach { t ->
                        Text("${t.ticketNo} · ${t.type} · ${t.status.replace('_', ' ')}")
                    }
                }
            }
        }
    }
}
