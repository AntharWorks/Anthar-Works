package works.anthar.app.data

import com.google.gson.Gson
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.RequestBody
import retrofit2.HttpException
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query
import works.anthar.app.BuildConfig

interface AntharApi {
    @POST("auth/otp/request")
    suspend fun requestOtp(@Body body: OtpRequest): OtpRequestResponse

    @POST("auth/otp/verify")
    suspend fun verifyOtp(@Body body: OtpVerifyRequest): OtpVerifyResponse

    // Field staff (technician & sales share the job mechanics)
    @GET("tickets/mine")
    suspend fun myJobs(): List<Ticket>

    @GET("tickets/{id}")
    suspend fun ticket(@Path("id") id: String): Ticket

    @PATCH("tickets/{id}/status")
    suspend fun transition(@Path("id") id: String, @Body body: TransitionRequest): Ticket

    @GET("spare-parts")
    suspend fun spareParts(@Query("q") q: String?): List<SparePart>

    @POST("tickets/{id}/spares")
    suspend fun useSpare(@Path("id") id: String, @Body body: UseSpareRequest): SpareUsage

    @Multipart
    @POST("tickets/{id}/media")
    suspend fun uploadMedia(
        @Path("id") id: String,
        @Part photo: MultipartBody.Part,
        @Part("phase") phase: RequestBody,
        @Part("latitude") latitude: RequestBody,
        @Part("longitude") longitude: RequestBody,
        @Part("capturedAt") capturedAt: RequestBody,
    ): TicketMedia

    // Customer persona
    @GET("me/dashboard")
    suspend fun myDashboard(): MyDashboard

    @POST("tickets")
    suspend fun raiseTicket(@Body body: CreateTicketRequest): Ticket

    // Sales persona
    @POST("leads")
    suspend fun createLead(@Body body: CreateLeadRequest): Lead

    // Admin/Backend lite persona
    @GET("dashboard")
    suspend fun dashboard(): DashboardStats
}

object ApiClient {
    @Volatile
    private var tokenProvider: () -> String? = { null }

    fun setTokenProvider(provider: () -> String?) {
        tokenProvider = provider
    }

    val api: AntharApi by lazy {
        val client = OkHttpClient.Builder()
            .addInterceptor { chain ->
                val token = tokenProvider()
                val request = if (token != null) {
                    chain.request().newBuilder()
                        .header("Authorization", "Bearer $token")
                        .build()
                } else chain.request()
                chain.proceed(request)
            }
            .build()
        Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(AntharApi::class.java)
    }
}

/** Extracts the backend's error message from an HTTP failure. */
fun Throwable.userMessage(): String = when (this) {
    is HttpException -> {
        val raw = response()?.errorBody()?.string()
        val parsed = runCatching { Gson().fromJson(raw, ApiError::class.java) }.getOrNull()
        when (val m = parsed?.message) {
            is String -> m
            is List<*> -> m.joinToString(", ")
            else -> "Request failed (${code()})"
        }
    }
    else -> message ?: "Something went wrong"
}
