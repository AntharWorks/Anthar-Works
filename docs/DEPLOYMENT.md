# Deployment Guide

> New to servers? There's a click-through walkthrough using Vercel + Railway in
> [DEPLOYMENT_FOR_BEGINNERS.md](DEPLOYMENT_FOR_BEGINNERS.md). This page is the
> technical reference for the self-hosted Docker Compose route.

Target: a single VM (4 GB RAM is plenty for 2,500 users) with Docker + Docker Compose,
fronted by a TLS reverse proxy (Caddy, nginx, or Cloudflare Tunnel).

## 1. One-time external setup (start early — approval lead times)

| Service | What you need | Where it goes |
|---|---|---|
| Razorpay | Live key id + secret; create a **Webhook** pointing to `https://<your-domain>/api/v1/payments/webhook` with events `payment.captured`, `payment.failed`; copy the webhook secret | `RAZORPAY_*` |
| MSG91 | Auth key, DLT-registered sender ID and SMS/OTP template IDs | `MSG91_*` |
| Meta WhatsApp Cloud API | Business-verified WABA, phone number ID, permanent access token, and **approved message templates** (names must match the `template` keys in `notifications_log`: APP_LOGIN_OTP, ORDER_CONFIRMED, RENEWAL_CONFIRMED, RENEWAL_REMINDER, WARRANTY_EXPIRY, DELIVERY_UPDATE, TICKET_SCHEDULED, TICKET_COMPLETED, FAQ_VIDEO, LEAD_FOLLOWUP, CUSTOMER_WELCOME, NEW_ORDER_ALERT, NEW_LEAD_ALERT, SLA_ALERT, CUSTOMER_SLOT_PICKED, SUBSCRIPTION_STARTED) | `WHATSAPP_*` |

Without provider keys the system still runs: messages are logged to the server console
and `notifications_log` instead of being sent (dev/test mode). Razorpay keys are
**optional to boot**: with the keys absent (or the admin **Portal → Settings**
payments toggle off) customers place orders that staff mark paid in the portal.
Add the keys and turn the toggle on to take online payments.

## 2. First deploy

```bash
git clone https://github.com/xploroshan/Anthar-Works.git && cd Anthar-Works
cp .env.production.example .env.production   # fill every value
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

The backend container runs `prisma migrate deploy` on every start, so schema
migrations apply automatically. Seed an initial admin login:

```bash
docker compose -f docker-compose.prod.yml exec backend \
  node -e "const {PrismaClient}=require('@prisma/client');new PrismaClient().user.create({data:{phone:'<ADMIN_MOBILE>',name:'Admin',role:'ADMIN'}}).then(()=>console.log('admin created'))"
```

## 3. Reverse proxy

Route both apps under one domain (example Caddyfile):

```
yourdomain.com {
    handle /api/v1/* {
        reverse_proxy backend:3001
    }
    handle {
        reverse_proxy web:3000
    }
}
```

The web container also proxies `/api/v1` to the backend internally, so routing
everything to `web:3000` works too.

## 4. Android app release

Build with the production API URL baked in:

```bash
cd android && gradle assembleRelease -PapiBaseUrl=https://yourdomain.com/api/v1/
```

Sign with your upload keystore and submit to Play Console. Camera/location
permissions are runtime-gated to staff personas (see `android/app/src/main/AndroidManifest.xml`).

## 5. Operations

- **Backups**: nightly `pg_dump` of the `postgres-data` volume off the host
  (e.g. `docker compose exec postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB | gzip > backup.sql.gz`).
- **Job photos** live in the `uploads` volume — include it in backups, or set the
  S3 env vars to move media off-host.
- **Crons** (SLA alerts hourly, lifecycle notifications daily 9 AM IST) run inside
  the backend process — no external scheduler needed; run exactly **one** backend
  replica or alerts will duplicate.
- **Monitoring**: `GET /api/v1/health` for uptime checks; watch `notifications_log`
  for FAILED rows after provider onboarding.
- **Updating**: `git pull && docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build`.
