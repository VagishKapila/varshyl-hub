# Integration Install Guide

## For Any Varshyl Product

### Step 1: Install the SDK

```bash
npm install @varshyl/hub-reporter
# or if not yet published:
npm install ../varshyl-hub/reporter-sdk
```

### Step 2: Set Environment Variables

Add to your `.env` or Railway environment:

```
VARSHYL_HUB_URL=https://hub.varshyl.com
VARSHYL_HUB_API_KEY=vhub_xxxxx
```

Get your API key from the Hub admin at hub.varshyl.com > Manage Products.

### Step 3: Add Reporter to Your Server Startup

Copy the appropriate integration file to your project, or create your own:

```javascript
// In your server entry point (e.g., index.js or app.js)
const { initHubReporter } = require('./hub-reporter');
const { pool } = require('./db'); // your existing pg Pool

// Call after DB is connected
initHubReporter(pool);
```

That's it. The reporter will send metrics every hour automatically.

---

## ConstructInvoice AI

1. Copy `constructinvoice-reporter.js` to `backend/src/hub-reporter.js`
2. Add env vars: `VARSHYL_HUB_API_KEY=vhub_5d708a8bcc24765fcfdf8c686266aa60405f9350a8d03b6b`
3. In `backend/src/index.ts` (after DB connection):
   ```typescript
   const { initHubReporter } = require('./hub-reporter');
   initHubReporter(pool);
   ```

Expected queries hit these tables: `users`, `payments`, `invoices`, `error_log`, `request_log`

---

## DocPix Studio (Docuflow)

1. Copy `docpix-reporter.js` to `backend/src/hub-reporter.js`
2. Add env vars: `VARSHYL_HUB_API_KEY=vhub_5d5459c4c82c31a92d969c51d1d392c285f866f3ac91772f`
3. In `backend/src/index.ts` (after DB connection):
   ```typescript
   const { initHubReporter } = require('./hub-reporter');
   initHubReporter(pool);
   ```

Expected queries hit these tables: `users`, `documents`, `signature_requests`, `payments`, `audit_log`

---

## Creating a New Product Integration

For any new product, create a collector function:

```javascript
const { startReporter } = require('@varshyl/hub-reporter');

function initHubReporter(pool) {
  const apiKey = process.env.VARSHYL_HUB_API_KEY;
  if (!apiKey) {
    console.warn('[HubReporter] API key not set — reporting disabled');
    return null;
  }

  return startReporter({
    hubUrl: process.env.VARSHYL_HUB_URL || 'https://hub.varshyl.com',
    apiKey,
    collector: async () => {
      // Query YOUR database for metrics
      const users = await pool.query('SELECT COUNT(*) FROM users');
      const pro = await pool.query("SELECT COUNT(*) FROM users WHERE plan = 'pro'");

      return {
        total_users: parseInt(users.rows[0].count),
        pro_users: parseInt(pro.rows[0].count),
        mrr_cents: parseInt(pro.rows[0].count) * 4000,
        metadata: { product: 'my-new-product' },
      };
    },
  });
}

module.exports = { initHubReporter };
```

Then register your product in the Hub admin, get the API key, and set `VARSHYL_HUB_API_KEY` in your env.
