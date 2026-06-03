import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/useToast';
import { api } from '../services/api';

export const Login = ({ onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        if (result.data) {
          login(result.data, result.token);
          addToast('Account created successfully!', 'success');
          onSuccess();
        }
      } else {
        const result = await api.post('/api/auth/login', { email, password });
        if (result.data) {
          login(result.data, result.token);
          addToast('Logged in successfully!', 'success');
          onSuccess();
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
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
            />
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
