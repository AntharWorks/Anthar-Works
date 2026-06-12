# Anthar Works — Water Purifier Subscription & Service Platform

A dual-channel ecosystem (responsive web portal + single Android app) for a water-purifier
subscription and service company, serving five personas — **Customer, Admin, Backend Staff,
Field Technician, Sales Executive** — against one common PostgreSQL database.

📄 Full plan: [docs/DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md) · Requirements: [docs/FRD.pdf](docs/FRD.pdf) · Deploying: [beginner guide](docs/DEPLOYMENT_FOR_BEGINNERS.md) / [technical reference](docs/DEPLOYMENT.md)

## Repository layout

| Path | What it is |
|---|---|
| `backend/` | NestJS + TypeScript API server, Prisma ORM, PostgreSQL, Redis/BullMQ workers |
| `web/` | Next.js — public e-commerce storefront (SSR) + staff portal (Admin/Backend) |
| `android/` | Single Kotlin/Jetpack Compose app; persona decided by role at OTP login |
| `docs/` | FRD, development plan, architecture decisions |

## Stack at a glance

- **API:** NestJS 10, Prisma, PostgreSQL 16, Redis 7 + BullMQ
- **Web:** Next.js 14 (App Router), Tailwind CSS
- **Android:** Kotlin, Jetpack Compose, Hilt, Retrofit, CameraX, FCM, Razorpay Checkout
- **Integrations:** Razorpay (payments), Meta WhatsApp Cloud API, MSG91 (SMS/OTP), FCM (push)
- **Storage:** S3-compatible object storage for geo-tagged job photos (MinIO locally)

## Local development

```bash
# 1. Infrastructure (Postgres, Redis, MinIO)
docker compose up -d

# 2. Backend API
cd backend
cp .env.example .env
npm install
npx prisma migrate dev
npm run start:dev          # http://localhost:3001/api/v1

# 3. Web (storefront + staff portal)
cd web
npm install
npm run dev                # http://localhost:3000

# 4. Android — open /android in Android Studio
```
