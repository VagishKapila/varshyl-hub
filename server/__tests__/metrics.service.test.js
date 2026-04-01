const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};

jest.mock('../db/pool', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn().mockResolvedValue(mockClient),
  },
}));

jest.mock('../config/env', () => ({
  JWT_SECRET: 'test-secret',
  ADMIN_EMAILS: ['admin@varshyl.com'],
}));

const { pool } = require('../db/pool');
const { recordMetrics, pruneOldSnapshots } = require('../services/metrics.service');

describe('recordMetrics', () => {
  beforeEach(() => {
    mockClient.query.mockReset();
    mockClient.release.mockReset();
    pool.query.mockReset();
    pool.connect.mockResolvedValue(mockClient);
    // Default: BEGIN, INSERT, COMMIT all succeed
    mockClient.query.mockResolvedValue({ rows: [] });
  });

  it('should insert a metrics snapshot within a transaction', async () => {
    const metrics = {
      total_users: 100,
      active_users_24h: 50,
      trial_users: 0,
      pro_users: 20,
      churned_users: 0,
      free_override_users: 0,
      mrr_cents: 5000,
      total_revenue_cents: 0,
      errors_24h: 2,
      avg_response_ms: 200,
      signups_24h: 0,
      pay_apps_created_24h: 0,
      pdfs_generated_24h: 0,
      emails_sent_24h: 0,
      metadata: {},
    };

    await recordMetrics(1, metrics);

    // Should have: BEGIN, INSERT snapshot, COMMIT
    const calls = mockClient.query.mock.calls;
    expect(calls[0][0]).toBe('BEGIN');
    expect(calls[1][0]).toContain('INSERT INTO metrics_snapshots');
    expect(calls[calls.length - 1][0]).toBe('COMMIT');
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('should default missing fields to 0', async () => {
    const metrics = {
      total_users: 5,
      active_users_24h: 0, trial_users: 0, pro_users: 0,
      churned_users: 0, free_override_users: 0,
      mrr_cents: 0, total_revenue_cents: 0,
      errors_24h: 0, avg_response_ms: 0, signups_24h: 0,
      pay_apps_created_24h: 0, pdfs_generated_24h: 0, emails_sent_24h: 0,
      metadata: {},
    };

    await recordMetrics(2, metrics);

    const insertCall = mockClient.query.mock.calls[1];
    const params = insertCall[1];
    expect(params[1]).toBe(5); // total_users
    expect(params[4]).toBe(0); // pro_users
  });

  it('should rollback on database error', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockRejectedValueOnce(new Error('DB down')); // INSERT fails

    await expect(recordMetrics(1, {
      total_users: 1, active_users_24h: 0, trial_users: 0, pro_users: 0,
      churned_users: 0, free_override_users: 0,
      mrr_cents: 0, total_revenue_cents: 0,
      errors_24h: 0, avg_response_ms: 0, signups_24h: 0,
      pay_apps_created_24h: 0, pdfs_generated_24h: 0, emails_sent_24h: 0,
      metadata: {},
    })).rejects.toThrow('DB down');

    // Should have called ROLLBACK
    const rollbackCall = mockClient.query.mock.calls.find(c => c[0] === 'ROLLBACK');
    expect(rollbackCall).toBeDefined();
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('should create alert for error spike when no recent alert exists', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // INSERT snapshot
      .mockResolvedValueOnce({ rows: [] }) // SELECT existing alert (none found)
      .mockResolvedValueOnce({ rows: [] }) // INSERT alert
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const metrics = {
      total_users: 100, active_users_24h: 0, trial_users: 0, pro_users: 0,
      churned_users: 0, free_override_users: 0,
      mrr_cents: 0, total_revenue_cents: 0,
      errors_24h: 100, // Over threshold of 50
      avg_response_ms: 0, signups_24h: 0,
      pay_apps_created_24h: 0, pdfs_generated_24h: 0, emails_sent_24h: 0,
      metadata: {},
    };

    await recordMetrics(1, metrics);

    // Find the INSERT INTO alerts call
    const alertInsert = mockClient.query.mock.calls.find(c =>
      typeof c[0] === 'string' && c[0].includes('INSERT INTO alerts')
    );
    expect(alertInsert).toBeDefined();
    expect(alertInsert[1]).toContain('error_spike');
  });

  it('should skip alert when recent unresolved alert exists (dedup)', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // INSERT snapshot
      .mockResolvedValueOnce({ rows: [{ id: 99 }] }) // SELECT existing alert (found!)
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const metrics = {
      total_users: 100, active_users_24h: 0, trial_users: 0, pro_users: 0,
      churned_users: 0, free_override_users: 0,
      mrr_cents: 0, total_revenue_cents: 0,
      errors_24h: 100,
      avg_response_ms: 0, signups_24h: 0,
      pay_apps_created_24h: 0, pdfs_generated_24h: 0, emails_sent_24h: 0,
      metadata: {},
    };

    await recordMetrics(1, metrics);

    // Should NOT have an INSERT INTO alerts call
    const alertInsert = mockClient.query.mock.calls.find(c =>
      typeof c[0] === 'string' && c[0].includes('INSERT INTO alerts')
    );
    expect(alertInsert).toBeUndefined();
  });
});

describe('pruneOldSnapshots', () => {
  beforeEach(() => {
    pool.query.mockReset();
  });

  it('should delete old snapshots and return count', async () => {
    pool.query.mockResolvedValue({ rowCount: 15, rows: [] });
    const count = await pruneOldSnapshots(90);
    expect(count).toBe(15);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM metrics_snapshots'),
      [90]
    );
  });

  it('should handle errors gracefully', async () => {
    pool.query.mockRejectedValue(new Error('DB unreachable'));
    const count = await pruneOldSnapshots(90);
    expect(count).toBe(0);
  });
});
