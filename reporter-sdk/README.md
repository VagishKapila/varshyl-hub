# @varshyl/hub-reporter

Lightweight metrics reporter SDK for the Varshyl Business Hub. Drop this into any Node.js product to auto-report KPIs every hour.

## Quick Start

```bash
npm install @varshyl/hub-reporter
```

```javascript
const { startReporter } = require('@varshyl/hub-reporter');

startReporter({
  hubUrl: process.env.VARSHYL_HUB_URL || 'https://hub.varshyl.com',
  apiKey: process.env.VARSHYL_HUB_API_KEY,
  collector: async () => ({
    total_users: 100,
    pro_users: 25,
    mrr_cents: 100000, // $1,000 MRR
    errors_24h: 3,
  }),
});
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `hubUrl` | string | `https://hub.varshyl.com` | Hub API base URL |
| `apiKey` | string | **required** | Product API key from Hub admin |
| `collector` | function | **required** | Async function returning metrics object |
| `intervalMs` | number | `3600000` (1hr) | Reporting interval in ms |
| `retryCount` | number | `3` | Max retry attempts per report |
| `retryDelayMs` | number | `5000` | Delay between retries |
| `onSuccess` | function | null | Callback on successful report |
| `onError` | function | null | Callback on failed report |

## Supported Metrics

All fields are optional and default to 0:

- `total_users` — Total registered users
- `active_users_24h` — Users active in last 24h
- `trial_users` — Users on trial plan
- `pro_users` — Paid/pro users
- `churned_users` — Users who cancelled
- `mrr_cents` — Monthly recurring revenue in cents
- `total_revenue_cents` — Lifetime revenue in cents
- `errors_24h` — Error count in last 24h
- `avg_response_ms` — Average API response time
- `signups_24h` — New signups in last 24h
- `metadata` — Any product-specific JSON data

## Reference Integrations

See `integrations/` for ready-made collectors:

- `constructinvoice-reporter.js` — ConstructInvoice AI
- `docpix-reporter.js` — DocPix Studio / Docuflow

## API Endpoints

The SDK also enables products to query hub configuration:

- `GET /api/v1/flags` — Feature flags for this product
- `GET /api/v1/config` — Product config, plan info, alert count

Both require the same `X-Api-Key` header.
