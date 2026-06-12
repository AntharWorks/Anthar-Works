package works.anthar.app

/**
 * One APK, five experiences. The role returned by the OTP login response
 * decides which navigation graph the user lands in. Mirrors the backend
 * `Role` enum — keep in sync with backend/prisma/schema.prisma.
 */
enum class Persona {
    CUSTOMER,
    ADMIN,
    BACKEND,
    TECHNICIAN,
    SALES,
}
