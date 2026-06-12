package works.anthar.app.ui.field

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import works.anthar.app.data.ApiClient
import works.anthar.app.data.userMessage
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import kotlin.coroutines.resume

/**
 * Camera-only capture per the FRD security requirement: there is no gallery
 * picker anywhere in this flow — the photo must come from the live camera,
 * and GPS coordinates are stamped onto the upload (rejected server-side if
 * missing). Camera + location permissions are requested here, at use time,
 * only for field personas.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CaptureScreen(
    ticketId: String,
    phase: String,
    onDone: () -> Unit,
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val scope = rememberCoroutineScope()

    var hasPermissions by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
                PackageManager.PERMISSION_GRANTED &&
                ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
                PackageManager.PERMISSION_GRANTED,
        )
    }
    var status by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val imageCapture = remember { ImageCapture.Builder().build() }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { grants -> hasPermissions = grants.values.all { it } }

    LaunchedEffect(Unit) {
        if (!hasPermissions) {
            permissionLauncher.launch(
                arrayOf(Manifest.permission.CAMERA, Manifest.permission.ACCESS_FINE_LOCATION),
            )
        }
    }

    @SuppressLint("MissingPermission")
    suspend fun currentLocation(): Pair<Double, Double>? {
        val client = LocationServices.getFusedLocationProviderClient(context)
        return suspendCancellableCoroutine { cont ->
            client.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
                .addOnSuccessListener { loc ->
                    cont.resume(loc?.let { it.latitude to it.longitude })
                }
                .addOnFailureListener { cont.resume(null) }
        }
    }

    suspend fun captureFile(): File = suspendCancellableCoroutine { cont ->
        val file = File.createTempFile("job-$phase-", ".jpg", context.cacheDir)
        imageCapture.takePicture(
            ImageCapture.OutputFileOptions.Builder(file).build(),
            ContextCompat.getMainExecutor(context),
            object : ImageCapture.OnImageSavedCallback {
                override fun onImageSaved(output: ImageCapture.OutputFileResults) = cont.resume(file)
                override fun onError(exception: ImageCaptureException) {
                    cont.cancel(exception)
                }
            },
        )
    }

    Scaffold(
        topBar = { TopAppBar(title = { Text("$phase photo — live capture") }) },
    ) { padding ->
        Column(modifier = Modifier.padding(padding).fillMaxSize()) {
            if (!hasPermissions) {
                Text(
                    "Camera and precise location permissions are required to capture geotagged job photos.",
                    modifier = Modifier.padding(16.dp),
                )
                Button(
                    onClick = {
                        permissionLauncher.launch(
                            arrayOf(Manifest.permission.CAMERA, Manifest.permission.ACCESS_FINE_LOCATION),
                        )
                    },
                    modifier = Modifier.padding(horizontal = 16.dp),
                ) { Text("Grant permissions") }
                return@Scaffold
            }

            Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                AndroidView(
                    factory = { ctx ->
                        PreviewView(ctx).also { previewView ->
                            val providerFuture = ProcessCameraProvider.getInstance(ctx)
                            providerFuture.addListener({
                                val provider = providerFuture.get()
                                val preview = androidx.camera.core.Preview.Builder().build()
                                preview.surfaceProvider = previewView.surfaceProvider
                                provider.unbindAll()
                                provider.bindToLifecycle(
                                    lifecycleOwner,
                                    CameraSelector.DEFAULT_BACK_CAMERA,
                                    preview,
                                    imageCapture,
                                )
                            }, ContextCompat.getMainExecutor(ctx))
                        }
                    },
                    modifier = Modifier.fillMaxSize(),
                )
            }

            status?.let {
                Text(
                    it,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                )
            }
            Button(
                onClick = {
                    busy = true; status = null
                    scope.launch {
                        try {
                            val location = currentLocation()
                            if (location == null) {
                                status = "Could not get GPS fix — geotag is mandatory. Move to open sky and retry."
                                busy = false
                                return@launch
                            }
                            val file = captureFile()
                            val iso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
                                .apply { timeZone = TimeZone.getTimeZone("UTC") }
                                .format(Date())
                            ApiClient.api.uploadMedia(
                                id = ticketId,
                                photo = MultipartBody.Part.createFormData(
                                    "photo",
                                    file.name,
                                    file.asRequestBody("image/jpeg".toMediaType()),
                                ),
                                phase = phase.toRequestBody("text/plain".toMediaType()),
                                latitude = location.first.toString().toRequestBody("text/plain".toMediaType()),
                                longitude = location.second.toString().toRequestBody("text/plain".toMediaType()),
                                capturedAt = iso.toRequestBody("text/plain".toMediaType()),
                            )
                            file.delete()
                            onDone()
                        } catch (e: Exception) {
                            status = e.userMessage()
                        } finally {
                            busy = false
                        }
                    }
                },
                enabled = !busy,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp)
                    .align(Alignment.CenterHorizontally),
            ) { Text(if (busy) "Uploading…" else "Capture & upload (geotagged)") }
        }
    }
}
