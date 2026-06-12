package works.anthar.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import works.anthar.app.Persona
import works.anthar.app.data.ApiClient
import works.anthar.app.data.OtpRequest
import works.anthar.app.data.OtpVerifyRequest
import works.anthar.app.data.Session
import works.anthar.app.data.userMessage

@Composable
fun LoginScreen(session: Session, onLoggedIn: (Persona) -> Unit) {
    var phone by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }
    var otpSent by remember { mutableStateOf(false) }
    var devOtp by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("Anthar Works", style = MaterialTheme.typography.headlineMedium)
        Text(
            "Sign in with your registered mobile number",
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.padding(top = 4.dp, bottom = 24.dp),
        )

        if (!otpSent) {
            OutlinedTextField(
                value = phone,
                onValueChange = { if (it.length <= 10) phone = it.trim() },
                label = { Text("Mobile number") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                modifier = Modifier.fillMaxWidth(),
            )
            Button(
                onClick = {
                    busy = true; error = null
                    scope.launch {
                        runCatching { ApiClient.api.requestOtp(OtpRequest(phone)) }
                            .onSuccess { devOtp = it.devOtp; otpSent = true }
                            .onFailure { error = it.userMessage() }
                        busy = false
                    }
                },
                enabled = !busy && phone.length == 10,
                modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
            ) { Text(if (busy) "Sending…" else "Send OTP") }
        } else {
            devOtp?.let {
                Text(
                    "Dev mode OTP: $it",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.tertiary,
                    modifier = Modifier.padding(bottom = 8.dp),
                )
            }
            OutlinedTextField(
                value = code,
                onValueChange = { if (it.length <= 6) code = it.trim() },
                label = { Text("6-digit OTP") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                modifier = Modifier.fillMaxWidth(),
            )
            Button(
                onClick = {
                    busy = true; error = null
                    scope.launch {
                        runCatching { ApiClient.api.verifyOtp(OtpVerifyRequest(phone, code)) }
                            .onSuccess { res ->
                                val persona = runCatching { Persona.valueOf(res.user.role) }.getOrNull()
                                if (persona == null) {
                                    error = "Unknown role: ${res.user.role}"
                                } else {
                                    session.token = res.accessToken
                                    session.userName = res.user.name
                                    session.persona = persona
                                    onLoggedIn(persona)
                                }
                            }
                            .onFailure { error = it.userMessage() }
                        busy = false
                    }
                },
                enabled = !busy && code.length == 6,
                modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
            ) { Text(if (busy) "Verifying…" else "Sign in") }
            TextButton(onClick = { otpSent = false; code = "" }) { Text("Change number") }
        }

        if (busy) CircularProgressIndicator(modifier = Modifier.padding(top = 16.dp))
        error?.let {
            Text(
                it,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(top = 12.dp),
            )
        }
    }
}
