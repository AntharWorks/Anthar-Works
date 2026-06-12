package works.anthar.app.data

// Mirrors the backend API contracts (backend/src/**). Gson-deserialized.

data class OtpRequest(val phone: String)
data class OtpRequestResponse(val sent: Boolean, val devOtp: String?)
data class OtpVerifyRequest(val phone: String, val code: String)
data class SessionUser(val id: String, val name: String, val role: String)
data class OtpVerifyResponse(val accessToken: String, val user: SessionUser)

data class UserRef(val id: String, val name: String, val phone: String?)

data class CustomerRef(
    val id: String,
    val customerNo: String,
    val address: String?,
    val pincode: String?,
    val user: UserRef,
)

data class TicketEvent(
    val id: String,
    val fromStatus: String?,
    val toStatus: String?,
    val remarks: String?,
    val createdAt: String,
    val actor: UserRef?,
)

data class SparePart(val id: String, val sku: String, val name: String, val stock: Int)
data class SpareUsage(val id: String, val qty: Int, val part: SparePart)
data class TicketMedia(
    val id: String,
    val phase: String,
    val latitude: Double,
    val longitude: Double,
    val capturedAt: String,
)

data class Ticket(
    val id: String,
    val ticketNo: String,
    val type: String,
    val status: String,
    val slaDueAt: String?,
    val slotDate: String?,
    val slotWindow: String?,
    val customer: CustomerRef,
    val events: List<TicketEvent>?,
    val spareUsage: List<SpareUsage>?,
    val media: List<TicketMedia>?,
)

data class TransitionRequest(val to: String, val reason: String? = null, val remarks: String? = null)
data class UseSpareRequest(val partId: String, val qty: Int)
data class CreateTicketRequest(val type: String)

data class Plan(val id: String, val name: String, val priceInr: String, val billingPeriod: String?)
data class Subscription(
    val id: String,
    val status: String,
    val nextRenewalAt: String?,
    val plan: Plan,
)
data class Product(val id: String, val brand: String, val model: String, val variant: String?)
data class Device(
    val id: String,
    val purchaseDate: String,
    val warrantyType: String,
    val warrantyExpiry: String,
    val product: Product,
)
data class MyDashboard(
    val customerNo: String,
    val user: UserRef,
    val devices: List<Device>,
    val subscriptions: List<Subscription>,
    val tickets: List<Ticket>,
)

data class CreateLeadRequest(
    val source: String,
    val name: String?,
    val phone: String?,
    val location: String?,
    val productId: String? = null,
)
data class Lead(val id: String, val tempId: String, val status: String)

data class SubscriptionStats(val active: Int, val inactive: Int, val stopped: Int)
data class DashboardStats(
    val customers: Int,
    val subscriptions: SubscriptionStats,
    val openTickets: Int,
    val slaAtRisk: Int,
    val slaBreached: Int,
    val completedToday: Int,
    val technicians: Int,
)

data class ApiError(val message: Any?, val statusCode: Int?)
