package works.anthar.app.ui.field

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import works.anthar.app.data.ApiClient
import works.anthar.app.data.SparePart
import works.anthar.app.data.SpareUsage

/** FRD 1.4: searchable spare-parts checklist; mark items used on the job. */
@Composable
fun SparePartsSection(
    used: List<SpareUsage>,
    onUse: (partId: String, qty: Int) -> Unit,
) {
    var query by remember { mutableStateOf("") }
    var results by remember { mutableStateOf<List<SparePart>>(emptyList()) }

    LaunchedEffect(query) {
        if (query.length >= 2) {
            runCatching { ApiClient.api.spareParts(query) }
                .onSuccess { results = it }
        } else {
            results = emptyList()
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text("Spare parts used", style = MaterialTheme.typography.titleSmall)
        used.forEach { u ->
            Text("• ${u.part.name} (${u.part.sku}) × ${u.qty}")
        }
        if (used.isEmpty()) {
            Text("None recorded yet", style = MaterialTheme.typography.bodySmall)
        }
        OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            label = { Text("Search parts to add…") },
            modifier = Modifier.fillMaxWidth(),
        )
        results.forEach { part ->
            val usedQty = used.firstOrNull { it.part.id == part.id }?.qty ?: 0
            Row(
                modifier = Modifier.fillMaxWidth().padding(start = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("${part.name} (stock ${part.stock})", modifier = Modifier.weight(1f))
                TextButton(onClick = { onUse(part.id, usedQty + 1) }) {
                    Text(if (usedQty > 0) "+1 (now ${usedQty + 1})" else "Use")
                }
            }
        }
    }
}
