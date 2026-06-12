package works.anthar.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                AntharWorksApp()
            }
        }
    }
}

/**
 * Role-routed navigation shell. After OTP verification the backend returns
 * the user's role; we route to that persona's graph. Phase 2 replaces the
 * placeholders with the real feature graphs (Technician first).
 */
@Composable
fun AntharWorksApp() {
    val navController = rememberNavController()
    NavHost(navController = navController, startDestination = "login") {
        composable("login") { PlaceholderScreen("OTP Login (phone + SMS code)") }
        composable("customer") { PlaceholderScreen("Customer — dashboard, tickets, renewals, marketplace") }
        composable("admin") { PlaceholderScreen("Admin — master dashboard, user logins, allocations") }
        composable("backend") { PlaceholderScreen("Backend — ticket assignment, SLA tracking") }
        composable("technician") { PlaceholderScreen("Technician — jobs, status, camera capture, spares") }
        composable("sales") { PlaceholderScreen("Sales — leads, targets, delivery jobs") }
    }
}

@Composable
private fun PlaceholderScreen(title: String) {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(text = "Anthar Works", style = MaterialTheme.typography.headlineMedium)
        Text(text = title, style = MaterialTheme.typography.bodyLarge)
    }
}

fun routeFor(persona: Persona): String = when (persona) {
    Persona.CUSTOMER -> "customer"
    Persona.ADMIN -> "admin"
    Persona.BACKEND -> "backend"
    Persona.TECHNICIAN -> "technician"
    Persona.SALES -> "sales"
}
