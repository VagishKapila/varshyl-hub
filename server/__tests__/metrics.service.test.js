jest.mock('../db/pool', () => ({
  pool: { query: jest.fn() },
}));

jest.mock('../config/env', () => ({
  JWT_SECRET: 'test-secret',
  ADMIN_EMAILS: ['admin@varshyl.com'],
}));

const { pool } = require('../db/pool');
const { recordMetrics } = require('../services/metrics.service');

describe('recordMetrics', () => {
  beforeEach(() => {
    pool.query.mockReset();
  });

  it('should insert a metrics snapshot', async () => {
    const productId = 1;
    const metrics = {
      total_users: 100,
      active_users_24h: 50,
      pro_users: 20,
      mrr_cents: 5000,
      errors_24h: 2,
    };

    pool.query.mockResolvedValue({ rows: [{ id: 1 }] });

    await recordMetrics(productId, metrics);

    expect(pool.query).toHaveBeenCalled();
    const [query, params] = pool.query.mock.calls[0];
    expect(query).toContain('INSERT INTO metrics_snapshots');
    expect(params[0]).toBe(productId);
    expect(params[1]).toBe(100); // total_users
    expect(params[7]).toBe(5000); // mrr_cents
  });

  it('should default missing fields to 0', async () => {
    const productId = 2;
    const metrics = { total_users: 5 };

    pool.query.mockResolvedValue({ rows: [{ id: 2 }] });

    await recordMetrics(productId, metrics);

    const [_query, params] = pool.query.mock.calls[0];
    // pro_users (index 4) should default to 0
    expect(params[4]).toBe(0);
  });

  it('should handle database errors gracefully', async () => {
    pool.query.mockRejectedValue(new Error('DB down'));

    await expect(recordMetrics(1, { total_users: 1 })).rejects.toThrow();
  });
});
