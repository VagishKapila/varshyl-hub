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
        const result = await api.post('/auth/setup', { name, email, password });
        if (result.data) {
          login(result.data, result.token);
          addToast('Account created successfully!', 'success');
          onSuccess();
        }
      } else {
        const result = await api.post('/auth/login', { email, password });
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

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-icon">📊</div>
          <h1>Varshyl Hub</h1>
          <p>{isSetup ? 'Create your account' : 'CEO Command Center'}</p>
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

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Loading...' : isSetup ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div id="setup-note" style={{ marginTop: '16px', textAlign: 'center' }}>
          {isSetup ? (
            <>
              Already have an account?{' '}
              <button
                onClick={() => {
                  setIsSetup(false);
                  setError('');
                }}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: '600' }}
              >
                Sign In
              </button>
            </>
          ) : (
            <>
              No account yet?{' '}
              <button
                onClick={() => {
                  setIsSetup(true);
                  setError('');
                }}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: '600' }}
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
