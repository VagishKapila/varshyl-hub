import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/useToast';
import { api } from '../services/api';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [isSetup, setIsSetup] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { addToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSetup) {
        const result = await api.post('/api/auth/setup', { name, email, password });
        const { token, user } = result.data || {};
        if (token && user) {
          login(user, token);
          addToast('Account created successfully!', 'success');
        }
      } else {
        const result = await api.post('/api/auth/login', { email, password });
        const { token, user } = result.data || {};
        if (token && user) {
          login(user, token);
          addToast('Logged in successfully!', 'success');
        }
      }
    } catch (err) {
      setError(err.message || 'Login failed');
      addToast(err.message || 'Login failed', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const getLoadingLabel = () => {
    if (isSetup) return 'Creating account...';
    return 'Signing in...';
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">
          <svg className="auth-logo-mark" width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
            <polygon points="28,4 52,16 52,40 28,52 4,40 4,16" fill="#E6A96C" />
            <text
              x="28"
              y="36"
              textAnchor="middle"
              fill="#ffffff"
              fontSize="24"
              fontWeight="700"
              fontFamily="Inter, system-ui, sans-serif"
            >
              V
            </text>
          </svg>
          <h1>Varshyl Hub</h1>
          <p>{isSetup ? 'Create your account' : 'Founder Control Plane'}</p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {isSetup && (
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
                disabled={loading}
              />
            </div>
          )}

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
                style={{ paddingRight: '44px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#8B7280',
                  padding: '4px',
                  display: 'flex',
                }}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button type="submit" className="btn-primary auth-submit" disabled={loading}>
            {loading ? getLoadingLabel() : isSetup ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="auth-toggle-wrap">
          {isSetup ? (
            <>
              Already have an account?{' '}
              <button
                type="button"
                className="auth-toggle"
                onClick={() => {
                  setIsSetup(false);
                  setError('');
                }}
              >
                Sign In
              </button>
            </>
          ) : (
            <>
              First time setup?{' '}
              <button
                type="button"
                className="auth-toggle"
                onClick={() => {
                  setIsSetup(true);
                  setError('');
                }}
              >
                Create Account
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
