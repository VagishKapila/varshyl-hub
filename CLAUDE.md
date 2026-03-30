# Varshyl Business Hub — Project Context for Claude

> **READ THIS FIRST** before touching any code.
> This is the VARSHYL BUSINESS HUB project — the super-admin dashboard for all Varshyl products.
> **This is NOT ConstructInvoice AI or DocPix Studio** — those are separate repos.

---

## What This Project Is

A centralized super-admin dashboard that gives Vagish Kapila (CEO, Varshyl Inc.) a single view across ALL Varshyl SaaS products. Think of it as the CEO command center.

**Live URL:** (not yet deployed — target: hub.varshyl.com)
**Railway project:** (not yet created)
**GitHub repo:** VagishKapila/varshyl-hub
**Owner:** Vagish Kapila (vaakapila@gmail.com) — Varshyl Inc.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Single-file SPA: `public/app.html` (inline JS/CSS, no build step) |
| Backend | Node.js + Express (`server.js`) |
| Database | PostgreSQL on Railway (`db.js` runs migrations on startup) |
| Auth | JWT + bcrypt, single super-admin account (ADMIN_EMAILS pattern) |
| Hosting | Railway (auto-deploy from GitHub `main` branch) |
| Domain | hub.varshyl.com (CNAME to Railway — not yet configured) |
| Payments | Stripe Organization API (read across all product accounts) |
| Charts | Chart.js 4.x (CDN) |

---

## File Structure

```
varshyl-hub/
├── server.js          ← ALL backend routes: auth, reporter, dashboard, products, revenue, alerts
├── db.js              ← DB schema + migrations (runs on startup)
├── public/
│   └── app.html       ← ENTIRE dashboard app (auth, sidebar, KPIs, charts, user mgmt)
├── package.json
├── .env.example       ← Template for environment variables
├── .gitignore
└── CLAUDE.md          ← This file
```

---

## Architecture

### How the Hub connects to products:

1. **Reporter Pattern (Push):** Each product has a small reporter module (~50 lines) that POSTs metrics to `POST /api/v1/report` every hour with an API key. Metrics are stored in `metrics_snapshots`.

2. **Direct DB Read (Pull):** For products on Railway, the Hub connects via read-only connection string to query users, pay apps, etc. The Hub NEVER writes to product DBs (except for admin actions like block/upgrade).

3. **Stripe Org API:** Reads revenue data across all product Stripe accounts via Organization-level API key.

---

## Database Schema (Hub DB — separate from products)

Tables (6 total):
1. **hub_users** — id, name, email, password_hash, is_admin, last_login, created_at
2. **products** — id, slug, name, url, staging_url, stripe_account_id, db_connection_string, api_key, subscription_price_id, subscription_amount, is_active, icon, color
3. **metrics_snapshots** — id, product_id, recorded_at, total_users, active_users_24h, trial_users, pro_users, churned_users, free_override_users, mrr_cents, total_revenue_cents, errors_24h, avg_response_ms, signups_24h, pay_apps_created_24h, pdfs_generated_24h, emails_sent_24h, metadata
4. **alerts** — id, product_id, type, severity, title, message, resolved, resolved_at, created_at
5. **activity_log** — id, user_id, product_slug, action, details, ip_address, created_at
6. **feature_flags** — id, product_id, flag_key, enabled, description, updated_at

---

## API Routes

### Auth
- `POST /api/auth/setup` — First-time admin account creation (only works if no users exist)
- `POST /api/auth/login` — Admin login (checks ADMIN_EMAILS)
- `GET /api/auth/me` — Current user info

### Reporter (product → hub)
- `POST /api/v1/report` — Receive metrics from a product (API key auth via x-api-key header)

### Dashboard
- `GET /api/dashboard` — Overview KPIs, product cards, alerts, activity

### Products
- `GET /api/products` — List all products
- `POST /api/products` — Register a new product (returns API key)
- `GET /api/products/:slug/metrics` — Detailed metrics + 30-day trend for one product
- `GET /api/products/:slug/users` — User list from product DB (with search + pagination)
- `POST /api/products/:slug/users/:id/action` — Admin action: block, unblock, extend_trial, set_free_override, upgrade_to_pro, reset_to_trial, verify_email
- `POST /api/products/:slug/price` — Update subscription price
- `POST /api/products/:slug/flags` — Toggle feature flag

### Revenue
- `GET /api/revenue` — Revenue data (monthly trend + by-product breakdown)

### Charts
- `GET /api/charts/revenue-trend` — Monthly MRR by product
- `GET /api/charts/user-growth` — Daily user growth by product

### Alerts
- `GET /api/alerts` — Active alerts
- `POST /api/alerts/:id/resolve` — Resolve an alert

### Activity
- `GET /api/activity` — Recent admin actions

### Health
- `GET /health` — Health check (DB connectivity)

---

## Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `production` |
| `DATABASE_URL` | Hub PostgreSQL connection | `postgresql://...` |
| `JWT_SECRET` | Token signing | (random string) |
| `ADMIN_EMAILS` | Comma-separated admin emails | `vaakapila@gmail.com,vagishkapila@gmail.com` |
| `BASE_URL` | Hub URL for links | `https://hub.varshyl.com` |
| `ALLOWED_ORIGIN` | CORS origin | `https://hub.varshyl.com` |
| `STRIPE_ORG_KEY` | Stripe Organization API key (read-only) | `rk_live_...` |

---

## Products Currently Tracked

| Product | Slug | Stripe Account | DB |
|---------|------|---------------|----|
| ConstructInvoice AI | `constructinvoice` | `acct_1TG76NAHP8NRRyLC` | Railway Postgres |
| DocPix Studio | `docpix` | `acct_1TG786AsCE0yP645` | Railway Postgres |

---

## Reporter Module (add to each product's server.js)

```javascript
// ── Varshyl Hub Reporter ─────────────────────────────────────────────
const VARSHYL_HUB_URL = process.env.VARSHYL_HUB_URL;
const VARSHYL_HUB_KEY = process.env.VARSHYL_HUB_KEY;

async function reportToHub() {
  if (!VARSHYL_HUB_URL || !VARSHYL_HUB_KEY) return;
  try {
    const [users, active, trials, pro, churned] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query("SELECT COUNT(*) FROM users WHERE last_login > NOW() - INTERVAL '24 hours'"),
      pool.query("SELECT COUNT(*) FROM users WHERE subscription_status = 'trial'"),
      pool.query("SELECT COUNT(*) FROM users WHERE subscription_status = 'active'"),
      pool.query("SELECT COUNT(*) FROM users WHERE subscription_status = 'canceled'"),
    ]);
    await fetch(VARSHYL_HUB_URL + '/api/v1/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': VARSHYL_HUB_KEY },
      body: JSON.stringify({
        total_users: parseInt(users.rows[0].count),
        active_users_24h: parseInt(active.rows[0].count),
        trial_users: parseInt(trials.rows[0].count),
        pro_users: parseInt(pro.rows[0].count),
        churned_users: parseInt(churned.rows[0].count),
        mrr_cents: parseInt(pro.rows[0].count) * 4000, // $40/mo per pro user
      })
    });
    console.log('[Hub] Metrics reported');
  } catch(e) {
    console.error('[Hub] Report failed:', e.message);
  }
}
setInterval(reportToHub, 60 * 60 * 1000); // hourly
setTimeout(reportToHub, 30000); // first report 30s after startup
```

---

## Deployment Workflow

1. Vagish pushes via GitHub Desktop → Railway auto-deploys
2. `main` branch → production (hub.varshyl.com)
3. Claude NEVER pushes to GitHub — Vagish controls all deploys
4. DNS: CNAME `hub.varshyl.com` → Railway service URL

---

## First-Time Setup

1. Deploy to Railway with DATABASE_URL, JWT_SECRET, ADMIN_EMAILS set
2. Visit hub.varshyl.com → shows setup form (since no hub_users exist)
3. Create admin account with one of the ADMIN_EMAILS
4. Register products via "+ Add Product" button
5. Copy the generated API key (`vhub_...`) to each product's Railway env vars
6. Add reporter module to each product's server.js

---

## Pending / Future Work

- [ ] Deploy to Railway, configure hub.varshyl.com domain
- [ ] Add reporter module to ConstructInvoice AI server.js
- [ ] Add reporter module to DocPix Studio backend
- [ ] Stripe Org API integration (live revenue data)
- [ ] AI Business Insights (weekly Claude-powered summary)
- [ ] Subscription control panel (create/archive Stripe prices from Hub)
- [ ] Email sending from Hub (notify users across products)
- [ ] Mobile responsive improvements (hamburger menu)

---

## Project Boundaries — What NOT to Touch

- **Do NOT** write to product databases except for admin actions (block/upgrade/extend)
- **Do NOT** store product database credentials in code — always use env vars
- **Do NOT** push to GitHub — Vagish does this via GitHub Desktop
- **Do NOT** switch Stripe from test to live without explicit approval
- **Do NOT** expose API keys in the frontend
