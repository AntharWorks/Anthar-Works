# Anthar Works — Water Purifier Subscription & Service Platform: Development Plan

## Context

The FRD describes a dual-channel ecosystem for a water-purifier subscription/service company:
a **responsive web portal** and an **Android application**, serving **5 personas** —
Customer, Company Admin, Office Backend Staff, Field Technician, and Sales Executive —
all against **one common database**. Scale target is ~2,500 users, payments via **Razorpay**,
and notifications over **WhatsApp + SMS**. The repo (`xploroshan/Anthar-Works`) is empty
(README only), so this is a greenfield build on branch `claude/brave-turing-otdxs0`.

### Confirmed decisions (from user)
| Decision | Choice |
|---|---|
| Android | **One native Kotlin app** for Customer + all Staff personas (role-based UI after login) |
| Backend | **Node.js NestJS + PostgreSQL** (single common DB) |
| WhatsApp / SMS / OTP | **Meta WhatsApp Cloud API + MSG91** |
| E-commerce storefront | **Built in this project** (public web storefront, linked from the app) |
| Payments | Razorpay (orders + subscriptions + webhooks) |

> Note on the single-app choice: it works well — one APK, persona decided by the role
> returned at OTP login. Trade-off to flag: the Play Store listing is customer-facing but the
> binary carries staff permissions (camera, fine location). Mitigation: request camera/location
> permissions **at runtime only for staff roles**, and declare them as not-required in the
> manifest so Play review and customer perception stay clean.

---

## 1. System Architecture

```
┌────────────────────┐   ┌──────────────────────────────┐
│  Android App (Kotlin)│   │  Web (Next.js)               │
│  - Customer persona  │   │  - Public storefront (SSR)   │
│  - Admin persona     │   │  - Staff portal (Admin/      │
│  - Backend persona   │   │    Backend dashboards)       │
│  - Technician persona│   └──────────────┬───────────────┘
│  - Sales persona     │                  │
└──────────┬───────────┘                  │
           │        REST API /api/v1 (JWT + RBAC)
           └──────────────┬───────────────┘
                ┌─────────▼──────────┐
                │  NestJS API server  │──► BullMQ workers (Redis)
                │  (modular monolith) │      • WhatsApp/SMS/push jobs
                └───┬────────┬───────┘      • webhooks, exports, SLA scans
                    │        │
        ┌───────────▼─┐   ┌──▼─────────────┐
        │ PostgreSQL  │   │ S3-compatible   │
        │ (single DB) │   │ object storage  │ (job photos, invoices)
        └─────────────┘   └────────────────┘
External: Razorpay • Meta WhatsApp Cloud API • MSG91 (SMS/OTP) • FCM (push)
```

- **Modular monolith** NestJS app — right-sized for 2,500 users; no microservices overhead.
- **One PostgreSQL database** is the single source of truth for web + app (FRD requirement).
- **Redis + BullMQ** for async work (notifications, webhook processing, Excel export, SLA alert scans) so API responses stay fast.
- InfluxDB from the FRD is **deferred** — no water-consumption telemetry features are specified in the FRD feature lists; Postgres can absorb time-series later if IoT devices arrive.

### Monorepo layout
```
/backend     NestJS + TypeScript + Prisma
/web         Next.js (storefront + staff portal)
/android     Kotlin, Jetpack Compose, single app, role-based nav
/docs        FRD, architecture, API contracts
docker-compose.yml   (Postgres, Redis, MinIO for local dev)
```

---

## 2. Tech Stack (final)

| Layer | Choice | Why |
|---|---|---|
| API | NestJS 10 + TypeScript, Prisma ORM | FRD-recommended Node.js; typed end-to-end |
| DB | PostgreSQL 16 | Common DB requirement |
| Cache/queue | Redis 7 + BullMQ | Async notifications, OTP rate-limit, hot caches |
| Web | Next.js 14 (App Router), Tailwind + shadcn/ui, TanStack Query | SSR storefront for SEO/speed + rich staff SPA |
| Android | Kotlin, Jetpack Compose, MVVM, Hilt, Retrofit/OkHttp, Room (offline cache), CameraX, FusedLocationProvider, FCM, Razorpay Checkout SDK | User chose native Kotlin |
| Payments | Razorpay Orders + Subscriptions APIs + webhooks | Confirmed |
| Messaging | Meta WhatsApp Cloud API (template messages), MSG91 (DLT-registered SMS + OTP) | Confirmed |
| Push | Firebase Cloud Messaging | Job alerts, status updates |
| Storage | S3-compatible (AWS S3 / Cloudflare R2; MinIO locally) | Geo-tagged job photos |
| Exports | `exceljs` generating .xlsx in worker jobs | Admin/Backend Excel downloads |

---

## 3. Data Model (PostgreSQL — core tables)

**Identity & org**
- `users` (id, phone [login id], name, role: ADMIN|BACKEND|TECHNICIAN|SALES|CUSTOMER, status, fcm_token)
- `otp_attempts` (phone, code hash, channel, expiry, attempts) — rate-limited
- `backend_technician_map` (backend_user_id, technician_user_id) — Admin assigns technician sets to backend staff
- `backend_allocations` (backend_user_id, pincode | model_id) — pincode/model-based customer allocation

**Customers & products**
- `customers` (unique customer_id e.g. `AW-000123`, user_id, name, address, pincode, lat/lng)
- `products` (brand, model, variant, type: PURIFIER, price, images) — multi-brand marketplace catalog
- `plans` (name, price, billing_period, is_custom, created_by) — incl. Admin "Custom Plans"
- `subscriptions` (customer_id, plan_id, status: ACTIVE|INACTIVE|STOPPED, start/renewal dates, razorpay_subscription_id)
- `customer_devices` (customer_id, product_id, purchase_date, warranty_type: RESIDENTIAL|COMMERCIAL, warranty_expiry) — powers customer Live Dashboard + 1-yr warranty tracking

**Commerce**
- `orders` (order_id unique, customer_id, type: SUBSCRIPTION|PRODUCT|RENEWAL, amount, status, razorpay_order_id)
- `order_items`, `payments` (razorpay_payment_id, signature, status, webhook payload ref)
- `leads` (temp_id, source: APP_TAP|SALES|REFERRAL, customer info, interest product_id, assigned sales user, status) — app product-tap lead capture + Sales temp-id flow
- `sales_targets` (sales_user_id, period, target_amount, achieved_amount)

**Service operations**
- `tickets` (number, customer_id, type: SERVICE|INSTALLATION|COMPLAINT|DELIVERY, status, priority, sla_due_at, assigned_technician_id, slot_date, slot_window, created_by, cancellation_reason)
- `ticket_events` (ticket_id, from_status, to_status, actor, remarks, timestamp) — full audit trail; powers follow-up tracking & postponement history
- `spare_parts` (sku, name, stock) and `ticket_spare_usage` (ticket_id, part_id, qty)
- `ticket_media` (ticket_id, phase: BEFORE|AFTER, s3_key, lat, lng, captured_at, device_time) — camera-only geotagged photos

**Messaging**
- `notifications_log` (recipient, channel: WHATSAPP|SMS|PUSH, template, payload, status, provider_message_id) — auditable delivery of every FRD notification type

Ticket status state machine (enforced in API, not just UI):
`CREATED → ASSIGNED → ACCEPTED/REJECTED(reason) → IN_TRANSIT → IN_PROGRESS → COMPLETED | PENDING | CANCELLED(reason)`

Indexes on: customer phone, ticket status+sla_due_at, pincode, assigned_technician_id, order razorpay ids. At 2,500 users this is comfortably single-node; pagination + indexes are the whole performance story on the DB side.

---

## 4. Feature Mapping (FRD → implementation)

### 1.1 Customer (Android persona + storefront web)
- OTP login via MSG91 (SMS) with WhatsApp fallback template.
- Live Dashboard: device model, purchase date, warranty type/expiry, subscription status.
- One-click renewal → Razorpay order → instant payment → subscription extended on webhook confirmation.
- Raise complaint/ticket + live status tracking (status timeline from `ticket_events`).
- Multi-brand marketplace browsing in-app; **purchase happens on the web storefront** opened via branded link (Chrome Custom Tab), per FRD.
- Referrals & buy-back entry forms → create `leads`.
- **Lead capture automation:** product tap in app → API logs lead → BullMQ job fires WhatsApp template to the customer *and* pushes lead (name, location, interest) to the company WhatsApp + Admin dashboard instantly.
- Full notification matrix (WhatsApp + SMS): subscription confirmation, login OTP, payment link + T&C, delivery date update, installation-slot selection link, ticket number + schedule, FAQ video push on installation day, missed-IVR callback nudge.

### 1.2 Admin (Web portal + Android persona)
- Master dashboard: active/inactive/stopped devices, sales, closures.
- Search any customer by id/phone; granular edit of plan, status, device.
- Create logins for Backend & Technicians (phone = login id, OTP via SMS).
- Allocate customers to Backend staff by pincode or model; assign technician sets to each Backend user.
- Custom Plans on the fly (writes `plans` with `is_custom`).
- Order management: instant push+WhatsApp on every purchase, unique Order ID generation, order details auto-sent to company WhatsApp.
- Excel report downloads: call closures, sales, technician-wise, backend-wise (worker-generated, signed URL).

### 1.3 Backend Staff (Web portal + Android persona)
- Create unique Customer IDs on new purchase; create service tickets against them.
- Assign tickets to technicians (manual, or **auto-suggest nearest available technician by pincode**), with slot date/time.
- Ticket lifecycle: view/edit/re-assign/cancel (mandatory cancellation reason), remarks, slot postponement.
- **SLA color-coding**: green/amber/red computed from `sla_due_at`; a scheduled worker flags approaching breaches and notifies.
- Excel dump of pending tickets with customer contact numbers.
- Click-to-call: render `tel:` links now; IVR integration stubbed behind an interface for future (FRD marks it future).

### 1.4 Technician (Android persona)
- FCM job alerts on assignment; Accept / Reject (justification mandatory).
- Progressive status updates through the state machine; offline-tolerant (Room queue, sync on connectivity).
- Searchable spare-parts checklist per ticket.
- **Camera-only capture**: CameraX in-app capture screen, no gallery picker exists in the flow; photos watermarked + EXIF/DB-stamped with GPS lat/lng and timestamp (location permission gated to staff roles).
- Before/after photo mandatory to reach COMPLETED.

### 1.5 Sales Executive (Android persona)
- Same job/ticket mechanics as Technician (shared modules) for delivery tasks, plus:
- Lead creation with `temp_id` → Backend converts to unique customer id on confirmed sale.
- Target dashboard: achieved vs target per period.
- Camera-only geotagged before/after photos of product delivery.

---

## 5. Cross-cutting

**Auth & security**
- OTP login → short-lived JWT access + rotating refresh token; role claims drive RBAC guards (NestJS guards per persona/route).
- OTP rate limiting (Redis), max attempts, resend cooldown.
- Razorpay webhook **signature verification**; payment status only ever set from verified webhooks, never from client.
- Media: pre-signed upload URLs; server verifies content-type; reject uploads without GPS metadata for staff job photos.
- Audit everything that mutates tickets/orders (`ticket_events`, `notifications_log`).
- India SMS compliance: DLT registration of sender id + templates on MSG91; WhatsApp templates pre-approved in Meta Business Manager (lead-time item — start week 1).

**Performance & UX targets (2,500 users)**
- p95 API < 300 ms: Prisma with select-projection, pagination everywhere, Redis cache for catalog/dashboard aggregates, all third-party calls (WhatsApp/SMS/Razorpay fetches) async via queue.
- Web: SSR + CDN-cached storefront, code-split staff portal, optimistic UI on ticket actions.
- Android: Compose with paging, Room offline cache so technicians work in low-connectivity field conditions, image compression before upload, Coil image loading.

**Infrastructure**
- Docker everywhere; local dev via docker-compose (Postgres, Redis, MinIO).
- Production (right-sized for 2,500 users): 1× app VM (or ECS/Render service) ~4 GB, managed Postgres (smallest HA tier), managed Redis, S3/R2, Cloudflare in front. Staging mirrors prod cheaply.
- CI (GitHub Actions): lint + typecheck + tests + Prisma migration check on PR; Android assembleRelease; web build.
- Daily Postgres backups + point-in-time recovery; Sentry (API/web/Android) + uptime monitoring.

---

## 6. Phased Delivery Plan

**Phase 0 — Foundations (week 1–2)**
Monorepo scaffold, docker-compose, CI, Prisma schema v1 + migrations, NestJS skeleton (auth/OTP, users, RBAC), Next.js + Android project skeletons, seed scripts. *Start in parallel: DLT registration (MSG91) + WhatsApp template approval (Meta) — external lead times.*

**Phase 1 — Core operations backend + Staff web portal (week 3–6)**
Customers, products, plans, subscriptions, devices CRUD; ticket engine with state machine + assignment + SLA fields; Admin web (dashboards, user/login management, allocations, custom plans); Backend web (ticket creation/assignment/lifecycle, SLA color-coding, Excel exports). **Milestone: staff can run the whole service operation from the web portal.**

**Phase 2 — Android app, staff personas first (week 6–10)**
App shell: OTP login → role-routed navigation. Technician persona (job alerts, accept/reject, status flow, spare parts, CameraX capture + geotag, offline queue); Sales persona (leads, targets, delivery jobs); Admin/Backend lite persona (dashboards, ticket actions on the go). **Milestone: field operations fully mobile.**

**Phase 3 — Customer experience + payments + storefront (week 9–13, overlaps)**
Customer persona in app (dashboard, tickets, renewals); Razorpay integration end-to-end (orders, subscriptions, checkout SDK on Android + web, webhooks, reconciliation); public storefront on web (catalog, cart, checkout) with branded link embedded in app; referral/buy-back flows. **Milestone: a customer can subscribe, pay, and buy products.**

**Phase 4 — Notification & automation layer (week 12–15)**
Full WhatsApp/SMS template matrix wired to lifecycle events via BullMQ; FCM push across personas; product-tap lead automation; installation-day FAQ video push; missed-IVR callback notification (manual trigger now, IVR interface stubbed); notification delivery dashboard.

**Phase 5 — Hardening & launch (week 15–17)**
Load test (k6) at 10× expected concurrency, security pass (OWASP top-10 review, webhook/replay tests), UAT with real staff per persona, Play Store submission (staff permissions runtime-gated), data migration of existing customer base, go-live runbook + on-call.

Total: **~17 weeks** to full launch, with the staff web portal usable from ~week 6 and field app from ~week 10.

---

## 7. First implementation step in this session (on approval)

Since this session's deliverable is the plan itself:
1. Commit this plan into the repo as `docs/DEVELOPMENT_PLAN.md` (plus `docs/` copy of key decisions) on branch `claude/brave-turing-otdxs0`.
2. Scaffold Phase 0: monorepo folders, `docker-compose.yml`, NestJS app with Prisma schema v1 (all tables in §3), Next.js skeleton, Android Gradle project skeleton with role-routing stub.
3. Push the branch.

## 8. Verification

- Backend: `docker compose up` → Prisma migrate + seed → Jest e2e hitting auth/ticket/order endpoints; webhook signature unit tests with Razorpay sample payloads.
- Web: `next build` clean; storefront and portal smoke via Playwright later phases.
- Android: `./gradlew assembleDebug` in CI; instrumented tests for ticket state machine and camera-capture gating in Phase 2.
- Each phase ends with a demoable milestone (listed above) reviewed against the FRD checklist.
