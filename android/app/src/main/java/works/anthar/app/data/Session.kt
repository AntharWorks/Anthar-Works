package works.anthar.app.data

import android.content.Context
import works.anthar.app.Persona

/** Token + role storage; the role routes the single APK to its persona. */
class Session(context: Context) {
    private val prefs = context.getSharedPreferences("anthar_session", Context.MODE_PRIVATE)

    var token: String?
        get() = prefs.getString("token", null)
        set(value) = prefs.edit().putString("token", value).apply()

    var userName: String?
        get() = prefs.getString("name", null)
        set(value) = prefs.edit().putString("name", value).apply()

    var persona: Persona?
        get() = prefs.getString("role", null)?.let { runCatching { Persona.valueOf(it) }.getOrNull() }
        set(value) = prefs.edit().putString("role", value?.name).apply()

    fun clear() = prefs.edit().clear().apply()

    val isLoggedIn: Boolean get() = token != null && persona != null
}
