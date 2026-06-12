package works.anthar.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import works.anthar.app.data.ApiClient
import works.anthar.app.data.Session
import works.anthar.app.ui.LoginScreen
import works.anthar.app.ui.customer.CustomerHomeScreen
import works.anthar.app.ui.field.CaptureScreen
import works.anthar.app.ui.field.JobDetailScreen
import works.anthar.app.ui.field.JobListScreen
import works.anthar.app.ui.sales.NewLeadCard
import works.anthar.app.ui.staff.StaffHomeScreen

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val session = Session(applicationContext)
        ApiClient.setTokenProvider { session.token }
        setContent {
            MaterialTheme {
                AntharWorksApp(session)
            }
        }
    }
}

fun routeFor(persona: Persona): String = when (persona) {
    Persona.CUSTOMER -> "customer"
    Persona.ADMIN -> "staff"
    Persona.BACKEND -> "staff"
    Persona.TECHNICIAN -> "technician"
    Persona.SALES -> "sales"
}

/** One APK, five experiences: the OTP-verified role picks the graph. */
@Composable
fun AntharWorksApp(session: Session) {
    val navController = rememberNavController()
    val start = remember { session.persona?.let(::routeFor) ?: "login" }

    fun logout(nav: NavHostController) {
        session.clear()
        nav.navigate("login") { popUpTo(0) }
    }

    NavHost(navController = navController, startDestination = start) {
        composable("login") {
            LoginScreen(session) { persona ->
                navController.navigate(routeFor(persona)) { popUpTo(0) }
            }
        }

        composable("technician") {
            JobListScreen(
                title = "My Jobs — ${session.userName ?: "Technician"}",
                onOpenJob = { navController.navigate("job/$it") },
                onLogout = { logout(navController) },
            )
        }

        composable("sales") {
            JobListScreen(
                title = "Sales — ${session.userName ?: ""}",
                onOpenJob = { navController.navigate("job/$it") },
                onLogout = { logout(navController) },
                extraContent = { NewLeadCard() },
            )
        }

        composable("job/{ticketId}") { backStackEntry ->
            val ticketId = backStackEntry.arguments?.getString("ticketId") ?: return@composable
            JobDetailScreen(
                ticketId = ticketId,
                onBack = { navController.popBackStack() },
                onCapture = { id, phase -> navController.navigate("capture/$id/$phase") },
            )
        }

        composable("capture/{ticketId}/{phase}") { backStackEntry ->
            val ticketId = backStackEntry.arguments?.getString("ticketId") ?: return@composable
            val phase = backStackEntry.arguments?.getString("phase") ?: return@composable
            CaptureScreen(
                ticketId = ticketId,
                phase = phase,
                onDone = { navController.popBackStack() },
            )
        }

        composable("customer") {
            CustomerHomeScreen(onLogout = { logout(navController) })
        }

        composable("staff") {
            StaffHomeScreen(
                title = "Operations — ${session.userName ?: ""}",
                onLogout = { logout(navController) },
            )
        }
    }
}
