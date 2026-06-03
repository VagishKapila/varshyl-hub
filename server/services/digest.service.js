const { pool } = require('../db/pool');
const config = require('../config/env');

async function getTodayKPIs() {
  const products = (await pool.query('SELECT * FROM products WHERE is_active = true ORDER BY name')).rows;

  const latestSnapshots = [];
  for (const p of products) {
    const snap = (await pool.query(
      'SELECT * FROM metrics_snapshots WHERE product_id = $1 ORDER BY recorded_at DESC LIMIT 1',
      [p.id]
    )).rows[0];
    latestSnapshots.push({
      slug: p.slug,
      name: p.name,
      metrics: snap || null,
    });
  }

  let totalUsers = 0, totalActive = 0, totalTrial = 0, totalPro = 0;
  let totalChurned = 0, totalMRR = 0, totalSignups = 0, totalErrors = 0;

  for (const { metrics: m } of latestSnapshots) {
    if (!m) continue;
    totalUsers += m.total_users || 0;
    totalActive += m.active_users_24h || 0;
    totalTrial += m.trial_users || 0;
    totalPro += m.pro_users || 0;
    totalChurned += m.churned_users || 0;
    totalMRR += m.mrr_cents || 0;
    totalSignups += m.signups_24h || 0;
    totalErrors += m.errors_24h || 0;
  }

  return {
    date: new Date().toISOString().split('T')[0],
    totals: {
      total_users: totalUsers,
      active_users_24h: totalActive,
      trial_users: totalTrial,
      pro_users: totalPro,
      churned_users: totalChurned,
      mrr_cents: totalMRR,
      signups_24h: totalSignups,
      errors_24h: totalErrors,
      product_count: products.length,
    },
    products: latestSnapshots.map(({ slug, name, metrics }) => ({
      slug,
      name,
      total_users: metrics?.total_users || 0,
      active_users_24h: metrics?.active_users_24h || 0,
      trial_users: metrics?.trial_users || 0,
      pro_users: metrics?.pro_users || 0,
      mrr_cents: metrics?.mrr_cents || 0,
      signups_24h: metrics?.signups_24h || 0,
      errors_24h: metrics?.errors_24h || 0,
    })),
  };
}

function parseBullets(text) {
  return text
    .split('\n')
    .map((line) => line.replace(/^\d+[\.\)]\s*/, '').trim())
    .filter((line) => line.length > 0)
    .slice(0, 5);
}

async function callAnthropic(systemPrompt, userPrompt, maxTokens = 500) {
  if (!config.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': config.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

async function generateAndSendDigest() {
  try {
    const kpiData = await getTodayKPIs();
    const today = new Date().toISOString().split('T')[0];

    let bullets = [];
    if (config.ANTHROPIC_API_KEY) {
      const text = await callAnthropic(
        'You are Soren, AI analyst for Varshyl Inc. founder Vagish Kapila.',
        `Given this portfolio data, write exactly 5 concise bullet points (plain text, no markdown, no dashes, just numbered 1-5) summarizing the most important insights: ${JSON.stringify(kpiData)}`
      );
      bullets = parseBullets(text);
    } else {
      bullets = [
        `Portfolio has ${kpiData.totals.product_count} active products with ${kpiData.totals.total_users} total users.`,
        `${kpiData.totals.pro_users} pro subscribers generating $${(kpiData.totals.mrr_cents / 100).toFixed(0)} MRR.`,
        `${kpiData.totals.trial_users} users currently on trial.`,
        `${kpiData.totals.signups_24h} new signups in the last 24 hours.`,
        `${kpiData.totals.errors_24h} errors reported across products in 24h.`,
      ];
    }

    const digestResult = await pool.query(
      `INSERT INTO nightly_digests (digest_date, bullets, raw_data, email_sent)
       VALUES ($1, $2, $3, false)
       ON CONFLICT (digest_date) DO UPDATE SET
         bullets = EXCLUDED.bullets,
         raw_data = EXCLUDED.raw_data
       RETURNING *`,
      [today, JSON.stringify(bullets), JSON.stringify(kpiData)]
    );

    const digestRow = digestResult.rows[0];

    if (config.RESEND_API_KEY) {
      const { Resend } = require('resend');
      const resend = new Resend(config.RESEND_API_KEY);

      const bulletHtml = bullets.map((b) => `<li>${b}</li>`).join('');
      const dateLabel = new Date(today + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: config.DIGEST_EMAIL,
        subject: `Varshyl Portfolio Digest — ${today}`,
        html: `
          <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #1a1a2e; color: #fff; padding: 24px; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; font-size: 20px;">Varshyl Hub — Soren AI Digest</h1>
              <p style="margin: 8px 0 0; opacity: 0.8; font-size: 14px;">${dateLabel}</p>
            </div>
            <div style="background: #fff; padding: 24px; border: 1px solid #e8e8f0; border-radius: 0 0 12px 12px;">
              <ol style="padding-left: 20px; line-height: 1.8; color: #1a1a2e;">${bulletHtml}</ol>
            </div>
          </div>
        `,
      });

      const updated = await pool.query(
        `UPDATE nightly_digests SET email_sent = true, email_sent_at = NOW()
         WHERE digest_date = $1 RETURNING *`,
        [today]
      );
      return updated.rows[0];
    }

    console.warn('[Digest] RESEND_API_KEY not configured — digest saved but email not sent');
    return digestRow;
  } catch (err) {
    console.error('[Digest Service Error]', err.message);
    return null;
  }
}

async function chatWithSoren(message, history = []) {
  const kpiData = await getTodayKPIs();
  const systemPrompt = `You are Soren, AI portfolio analyst for Vagish Kapila at Varshyl Inc. Current portfolio data: ${JSON.stringify(kpiData)}. Answer questions about products, metrics, growth, and strategy. Be concise.`;

  const messages = [
    ...history.filter((h) => h.role && h.content),
    { role: 'user', content: message },
  ];

  if (!config.ANTHROPIC_API_KEY) {
    return 'Anthropic API key is not configured. Please set ANTHROPIC_API_KEY in Railway.';
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': config.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

module.exports = { generateAndSendDigest, getTodayKPIs, chatWithSoren };
