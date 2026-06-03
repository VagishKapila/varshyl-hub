const crypto = require('crypto');
const { pool } = require('../db/pool');

async function fireWebhook(eventType, payload, productSlug = null) {
  try {
    const result = await pool.query(
      `SELECT * FROM webhooks WHERE is_active = true
       AND (product_slug = $1 OR product_slug IS NULL)
       AND (events @> ARRAY[$2]::text[] OR events @> ARRAY['*']::text[])`,
      [productSlug, eventType]
    );

    for (const webhook of result.rows) {
      const start = Date.now();
      const body = JSON.stringify({
        event: eventType,
        product: productSlug,
        timestamp: new Date().toISOString(),
        data: payload,
      });

      const headers = { 'Content-Type': 'application/json' };
      if (webhook.secret) {
        headers['X-Varshyl-Signature'] = crypto
          .createHmac('sha256', webhook.secret)
          .update(body)
          .digest('hex');
      }

      let responseStatus = null, responseBody = null, success = false;
      try {
        const res = await fetch(webhook.endpoint_url, {
          method: 'POST',
          headers,
          body,
          signal: AbortSignal.timeout(5000),
        });
        responseStatus = res.status;
        responseBody = (await res.text()).slice(0, 500);
        success = res.ok;
      } catch (err) {
        responseBody = err.message;
      }

      const duration = Date.now() - start;

      await pool.query(
        `INSERT INTO webhook_deliveries (webhook_id, event_type, payload, response_status, response_body, success, duration_ms)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [webhook.id, eventType, JSON.stringify(payload), responseStatus, responseBody, success, duration]
      );

      await pool.query(
        'UPDATE webhooks SET last_triggered_at = NOW() WHERE id = $1',
        [webhook.id]
      );
    }
  } catch (err) {
    console.error('[fireWebhook Error]', err.message);
  }
}

module.exports = { fireWebhook };
