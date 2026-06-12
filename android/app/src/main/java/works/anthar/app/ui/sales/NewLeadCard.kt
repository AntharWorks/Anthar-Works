package works.anthar.app.ui.sales

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import works.anthar.app.data.ApiClient
import works.anthar.app.data.CreateLeadRequest
import works.anthar.app.data.userMessage

/** FRD 1.5: new sales lead with temp id; backend converts on confirmed sale. */
@Composable
fun NewLeadCard() {
    var name by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var location by remember { mutableStateOf("") }
    var message by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    Card(modifier = Modifier.fillMaxWidth().padding(12.dp)) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("New sales lead", style = MaterialTheme.typography.titleSmall)
            OutlinedTextField(
                value = name, onValueChange = { name = it },
                label = { Text("Prospect name") }, modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = phone, onValueChange = { if (it.length <= 10) phone = it.trim() },
                label = { Text("Mobile number") }, modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = location, onValueChange = { location = it },
                label = { Text("Location") }, modifier = Modifier.fillMaxWidth(),
            )
            Button(
                onClick = {
                    busy = true; message = null
                    scope.launch {
                        runCatching {
                            ApiClient.api.createLead(
                                CreateLeadRequest("SALES", name, phone, location.ifBlank { null }),
                            )
                        }
                            .onSuccess {
                                message = "Lead ${it.tempId} created — customer gets a WhatsApp follow-up."
                                name = ""; phone = ""; location = ""
                            }
                            .onFailure { message = it.userMessage() }
                        busy = false
                    }
                },
                enabled = !busy && name.isNotBlank() && phone.length == 10,
            ) { Text(if (busy) "Saving…" else "Create lead (temp id)") }
            message?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
        }
    }
}
