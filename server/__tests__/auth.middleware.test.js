const jwt = require('jsonwebtoken');

// Mock dependencies before requiring the middleware
jest.mock('../db/pool', () => ({
  pool: { query: jest.fn() },
}));

jest.mock('../config/env', () => ({
  JWT_SECRET: 'test-secret-key-for-testing',
  ADMIN_EMAILS: ['admin@varshyl.com', 'vagish@varshyl.com'],
}));

const { authMiddleware, apiKeyAuthMiddleware } = require('../middleware/auth');
const { pool } = require('../db/pool');
const config = require('../config/env');

describe('authMiddleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  it('should return 401 if no authorization header', () => {
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 for invalid token', () => {
    req.headers.authorization = 'Bearer invalid-token';
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
  });

  it('should return 403 for non-admin email', () => {
    const token = jwt.sign(
      { id: 1, email: 'notadmin@example.com', name: 'Test' },
      config.JWT_SECRET,
      { expiresIn: '1h' }
    );
    req.headers.authorization = `Bearer ${token}`;
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Admin access required' });
  });

  it('should call next() for valid admin token', () => {
    const token = jwt.sign(
      { id: 1, email: 'admin@varshyl.com', name: 'Admin' },
      config.JWT_SECRET,
      { expiresIn: '1h' }
    );
    req.headers.authorization = `Bearer ${token}`;
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.email).toBe('admin@varshyl.com');
  });

  it('should return 401 for expired token', () => {
    const token = jwt.sign(
      { id: 1, email: 'admin@varshyl.com', name: 'Admin' },
      config.JWT_SECRET,
      { expiresIn: '0s' }
    );
    req.headers.authorization = `Bearer ${token}`;
    // Small delay to ensure expiry
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('apiKeyAuthMiddleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    pool.query.mockReset();
  });

  it('should return 401 if no API key header', async () => {
    await apiKeyAuthMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'API key required' });
  });

  it('should return 401 for invalid API key', async () => {
    req.headers['x-api-key'] = 'bad-key';
    pool.query.mockResolvedValue({ rows: [] });
    await apiKeyAuthMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid API key' });
  });

  it('should call next() and set req.product for valid key', async () => {
    const mockProduct = { id: 1, slug: 'constructinvoice', name: 'ConstructInvoice AI' };
    req.headers['x-api-key'] = 'vhub_valid_key';
    pool.query.mockResolvedValue({ rows: [mockProduct] });
    await apiKeyAuthMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.product).toEqual(mockProduct);
  });

  it('should handle database errors gracefully', async () => {
    req.headers['x-api-key'] = 'vhub_valid_key';
    pool.query.mockRejectedValue(new Error('DB connection failed'));
    await apiKeyAuthMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Auth failed' });
  });
});
