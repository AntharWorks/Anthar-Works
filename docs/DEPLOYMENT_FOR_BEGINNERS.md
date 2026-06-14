# Deploying Anthar Works — The Beginner-Friendly Way (Vercel + Railway)

This guide assumes **no server experience**. You'll click through two hosting dashboards —
no Linux, no SSH, no Docker commands. Budget roughly **30–60 minutes** of clicking, plus
provider approval waits (see Step 0).

> Already comfortable with servers? The technical reference is [DEPLOYMENT.md](DEPLOYMENT.md).

## The big picture

The project has two halves, and each goes to the host that suits it best:

| Piece | What it is | Where it lives | Why |
|---|---|---|---|
| **Website** (`web/`) | The storefront customers see + staff portal | **Vercel** | Built for Next.js sites; free tier; deploys on every git push |
| **Backend** (`backend/`) | The "brain": orders, payments, reminders, WhatsApp/SMS | **Railway** | Runs the backend, its PostgreSQL database, and Redis 24/7 |

Customers visit your domain (served by Vercel), and the website quietly talks to the
backend on Railway. Your Android app talks to the backend directly.

**Monthly cost:** Railway ~$5–10 (usage-based) · Vercel $0 (Hobby tier) · domain ~₹800–1,500/year.

---

## Step 0 — Things to start TODAY (they have waiting periods)

These third-party approvals take **days to weeks**, so kick them off before anything else:

1. **Razorpay** (takes payments) — sign up at razorpay.com, complete KYC, get **live** keys.
   *Optional to launch: the app boots without these. Until they're set (and you turn on
   **Portal → Settings → Online payments**), customers place orders and your staff mark them paid
   in the portal. Add the keys when you're ready to take online payments.*
2. **MSG91** (sends SMS/OTP) — sign up, complete **DLT registration** (an Indian telecom
   requirement; this is the slow part, often 1–2 weeks), register your sender ID and OTP template.
3. **Meta WhatsApp Cloud API** (sends WhatsApp messages) — verify your business, get a phone
   number ID and permanent access token, and submit the message templates listed in
   [DEPLOYMENT.md §1](DEPLOYMENT.md) for approval.
4. **A domain** — buy one at GoDaddy/Namecheap/Cloudflare (e.g. `antharworks.com`).
5. **Firebase** (app push notifications) — create a project at console.firebase.google.com and
   download a service-account JSON.

You can finish Steps 1–3 below **before** these approvals arrive — without provider keys the
system runs in test mode and just logs messages instead of sending them.

---

## Step 1 — Put the backend on Railway

1. Go to **railway.com** → sign up with your GitHub account.
2. **New Project → Deploy from GitHub repo** → pick `xploroshan/Anthar-Works`.
3. In the new service's **Settings**, set **Root Directory** to `backend`.
   Railway finds the Dockerfile automatically; database migrations run on every start.
4. In the same project, click **Create → Database → PostgreSQL**, then again for **Redis**.
   Railway now shows three boxes: your backend, Postgres, and Redis.
5. Open the backend service → **Variables** → add the following.
   For the first two, use Railway's **reference** feature (type `${{` and pick from the list)
   so you never copy passwords by hand:

   | Variable | Value | Where it comes from |
   |---|---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Reference to your Railway Postgres |
   | `REDIS_URL` | `${{Redis.REDIS_URL}}` | Reference to your Railway Redis |
   | `PORT` | `3001` | Just type it |
   | `NODE_ENV` | `production` | Just type it |
   | `JWT_ACCESS_SECRET` | a long random string | Run `openssl rand -hex 32`, or use a password generator (40+ chars) |
   | `JWT_REFRESH_SECRET` | a different long random string | Same as above |
   | `PAYMENTS_ENABLED` | `true` (or `false`) | Default for the payments toggle. Leave `true`; if Razorpay keys are blank the app still runs in offline-order mode. Flip it anytime in Portal → Settings |
   | `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | live keys (optional at first) | Razorpay Dashboard → Account & Settings → API Keys. Leave blank to launch without online payments |
   | `RAZORPAY_WEBHOOK_SECRET` | webhook secret (optional at first) | Created in Step 4 below — come back and fill it in |
   | `MSG91_AUTH_KEY` / `MSG91_SENDER_ID` / `MSG91_OTP_TEMPLATE_ID` | from MSG91 | MSG91 dashboard after DLT approval |
   | `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_COMPANY_RECIPIENT` | from Meta | Meta Business → WhatsApp → API Setup; recipient = company's WhatsApp number for internal alerts |
   | `FCM_SERVICE_ACCOUNT_JSON` | entire JSON file contents | Firebase Console → Project Settings → Service Accounts → Generate key |
   | `FAQ_VIDEO_URL` | a YouTube/hosted video URL | Your own "getting started" video sent to customers on installation day |

6. **Photo storage** — technicians upload job photos, and they must survive restarts.
   In the backend service: **Settings → Volumes → Add volume**, mount path **`/data/uploads`**.
   *(Alternative: skip the volume and set the `S3_ENDPOINT`/`S3_ACCESS_KEY`/`S3_SECRET_KEY`/`S3_BUCKET`
   variables to an S3/R2 bucket instead.)*
7. **Get a public address**: Settings → Networking → **Generate Domain** (choose port 3001).
   You'll get something like `anthar-backend.up.railway.app` — **copy it, you'll need it twice**.
8. ⚠️ **Never increase replicas above 1.** Reminder emails/messages are scheduled inside this
   service; two copies would message every customer twice.

**Check it worked:** open `https://<your-railway-domain>/api/v1/health` in a browser — you
should see a healthy response.

## Step 2 — Create the first admin login

You need one admin account to get into the staff portal. Easiest path is Railway's CLI:

```bash
npm install -g @railway/cli
railway login
railway link        # pick your project + backend service
railway ssh         # opens a shell inside the running backend
# then paste (replace the phone number):
node -e "const {PrismaClient}=require('@prisma/client');new PrismaClient().user.create({data:{phone:'<ADMIN_MOBILE>',name:'Admin',role:'ADMIN'}}).then(()=>console.log('admin created'))"
```

That phone number can now log into the staff portal via OTP.

## Step 3 — Put the website on Vercel

1. Go to **vercel.com** → sign up with GitHub → **Add New → Project** → import `Anthar-Works`.
2. Set **Root Directory** to `web` (Framework: Next.js is auto-detected).
3. Add one environment variable: **`API_URL`** = `https://<your-railway-domain>`
   (the address from Step 1.7 — include `https://`, no trailing slash).
4. Click **Deploy**. A minute later you'll have a live site at `<something>.vercel.app`.
5. **Attach your domain**: Project → Settings → Domains → add `yourdomain.com`.
   Vercel shows you exactly which DNS records to add at your domain registrar
   (usually one `A` record and one `CNAME` for `www`). DNS can take up to an hour to settle.

**Check it worked:** visit your domain — the storefront should load, and product pages should
show data (which proves the website can reach the backend).

## Step 4 — Wire up Razorpay payments

1. In the Razorpay Dashboard → **Webhooks → Add New Webhook**:
   - URL: `https://<your-railway-domain>/api/v1/payments/webhook`
   - Events: `payment.captured` and `payment.failed`
   - Set a webhook secret and copy it.
2. Back in Railway → backend Variables → paste it into `RAZORPAY_WEBHOOK_SECRET`.
   Railway redeploys automatically.

## Step 5 — Smoke test (10 minutes)

- [ ] `https://<railway-domain>/api/v1/health` responds
- [ ] Your domain loads the storefront over HTTPS
- [ ] Log into the staff portal with the admin phone from Step 2 (OTP arrives once MSG91 is live)
- [ ] Place a ₹1 test order end-to-end and confirm payment is captured in Razorpay
- [ ] WhatsApp order confirmation arrives (once Meta templates are approved)
- [ ] In Railway → backend → Logs, no red errors

## Android app

When you're ready to release the app, build it pointing at the backend:

```bash
cd android && gradle assembleRelease -PapiBaseUrl=https://<your-railway-domain>/api/v1/
```

Then sign and upload to the Play Console (see [DEPLOYMENT.md §4](DEPLOYMENT.md)).

---

## Day-to-day operations

- **Updates deploy themselves.** Push to the `main` branch on GitHub and both Vercel and
  Railway rebuild and redeploy automatically. Nothing else to do.
- **Backups:** Railway Postgres supports backups from the database service's **Backups** tab —
  enable daily backups. Job photos live in the volume from Step 1.6.
- **If something breaks:** Railway → backend service → **Logs** is the first place to look.
  Failed customer messages also appear as `FAILED` rows in the `notifications_log` table
  (Railway Postgres → Data tab).
- **Monitoring on autopilot:** point a free uptime checker (e.g. UptimeRobot) at
  `https://<railway-domain>/api/v1/health` and your domain, and it will email you if either goes down.
