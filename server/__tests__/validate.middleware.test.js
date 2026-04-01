const { validateBody, metricsReportSchema } = require('../middleware/validate');

describe('metricsReportSchema', () => {
  it('should accept a valid full payload', () => {
    const result = metricsReportSchema.safeParse({
      total_users: 100,
      active_users_24h: 50,
      pro_users: 10,
      mrr_cents: 4000,
      errors_24h: 2,
    });
    expect(result.success).toBe(true);
    expect(result.data.total_users).toBe(100);
    expect(result.data.mrr_cents).toBe(4000);
  });

  it('should default missing numeric fields to 0', () => {
    const result = metricsReportSchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data.total_users).toBe(0);
    expect(result.data.mrr_cents).toBe(0);
    expect(result.data.errors_24h).toBe(0);
  });

  it('should reject negative values', () => {
    const result = metricsReportSchema.safeParse({ total_users: -5 });
    expect(result.success).toBe(false);
  });

  it('should reject values exceeding max bounds', () => {
    const result = metricsReportSchema.safeParse({ total_users: 999_999_999 });
    expect(result.success).toBe(false);
  });

  it('should reject non-integer values', () => {
    const result = metricsReportSchema.safeParse({ total_users: 10.5 });
    expect(result.success).toBe(false);
  });

  it('should accept optional collected_at as ISO string', () => {
    const result = metricsReportSchema.safeParse({
      collected_at: '2026-04-01T12:00:00.000Z',
    });
    expect(result.success).toBe(true);
    expect(result.data.collected_at).toBe('2026-04-01T12:00:00.000Z');
  });

  it('should reject invalid collected_at format', () => {
    const result = metricsReportSchema.safeParse({
      collected_at: 'not-a-date',
    });
    expect(result.success).toBe(false);
  });

  it('should reject unknown extra fields (strict mode)', () => {
    const result = metricsReportSchema.safeParse({
      total_users: 10,
      malicious_field: 'DROP TABLE users',
    });
    expect(result.success).toBe(false);
  });

  it('should accept metadata as arbitrary JSON', () => {
    const result = metricsReportSchema.safeParse({
      metadata: { version: '2.0', region: 'us-east-1', custom: { nested: true } },
    });
    expect(result.success).toBe(true);
    expect(result.data.metadata.version).toBe('2.0');
  });
});

describe('validateBody middleware', () => {
  it('should call next() with validatedBody for valid input', () => {
    const req = { body: { total_users: 50 } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    const middleware = validateBody(metricsReportSchema);
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.validatedBody).toBeDefined();
    expect(req.validatedBody.total_users).toBe(50);
  });

  it('should return 400 with details for invalid input', () => {
    const req = { body: { total_users: -1 } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    const middleware = validateBody(metricsReportSchema);
    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'Validation failed',
      details: expect.any(Array),
    }));
    expect(next).not.toHaveBeenCalled();
  });
});
