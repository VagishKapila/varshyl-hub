import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/useToast';
import { api } from '../services/api';

const PasswordToggle = ({ showPassword, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
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
);

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [mode, setMode] = useState('login');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { addToast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('reset_token');
    if (token) {
      setResetToken(token);
      setMode('reset');
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      if (mode === 'setup') {
        const result = await api.post('/api/auth/setup', { name, email, password });
        const { token, user } = result.data || {};
        if (token && user) {
          await login(user, token);
          addToast('Account created successfully!', 'success');
        }
      } else {
        const result = await api.post('/api/auth/login', { email, password });
        const { token, user } = result.data || {};
        if (token && user) {
          await login(user, token);
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

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      await api.post('/api/auth/forgot-password', { email });
      setSuccessMessage('Check your email for a reset link.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      await api.post('/api/auth/reset-password', { token: resetToken, newPassword });
      setSuccessMessage('Password reset! Please sign in.');
      setMode('login');
      setNewPassword('');
      setConfirmPassword('');
      window.history.replaceState({}, '', '/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getSubtitle = () => {
    if (mode === 'setup') return 'Create your account';
    if (mode === 'forgot') return 'Reset your password';
    if (mode === 'reset') return 'Choose a new password';
    return 'Founder Control Plane';
  };

  const getLoadingLabel = () => {
    if (mode === 'setup') return 'Creating account...';
    if (mode === 'forgot') return 'Sending...';
    if (mode === 'reset') return 'Resetting...';
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
          <p>{getSubtitle()}</p>
        </div>

        {error && <div className="auth-error">{error}</div>}
        {successMessage && (
          <div style={{
            background: 'rgba(5, 150, 105, 0.1)',
            border: '1px solid rgba(5, 150, 105, 0.3)',
            color: '#6EE7B7',
            padding: '12px',
            borderRadius: '8px',
            fontSize: '13px',
            marginBottom: '16px',
          }}>
            {successMessage}
          </div>
        )}

        {mode === 'forgot' && (
          <form onSubmit={handleForgotSubmit}>
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
            <button type="submit" className="btn-primary auth-submit" disabled={loading}>
              {loading ? getLoadingLabel() : 'Send Reset Link'}
            </button>
          </form>
        )}

        {mode === 'reset' && (
          <form onSubmit={handleResetSubmit}>
            <div className="form-group">
              <label>New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  style={{ paddingRight: '44px' }}
                />
                <PasswordToggle showPassword={showPassword} onToggle={() => setShowPassword((prev) => !prev)} />
              </div>
            </div>
            <div className="form-group">
              <label>Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
              />
            </div>
            <button type="submit" className="btn-primary auth-submit" disabled={loading}>
              {loading ? getLoadingLabel() : 'Reset Password'}
            </button>
          </form>
        )}

        {(mode === 'login' || mode === 'setup') && (
          <form onSubmit={handleSubmit}>
            {mode === 'setup' && (
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
                <PasswordToggle showPassword={showPassword} onToggle={() => setShowPassword((prev) => !prev)} />
              </div>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setError('');
                    setSuccessMessage('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#8B7280',
                    fontSize: '12px',
                    cursor: 'pointer',
                    textAlign: 'right',
                    width: '100%',
                    marginTop: '4px',
                    padding: '0',
                  }}
                >
                  Forgot password?
                </button>
              )}
            </div>

            <button type="submit" className="btn-primary auth-submit" disabled={loading}>
              {loading ? getLoadingLabel() : mode === 'setup' ? 'Create Account' : 'Sign In'}
            </button>
          </form>
        )}

        <div className="auth-toggle-wrap">
          {mode === 'forgot' && (
            <>
              <button
                type="button"
                className="auth-toggle"
                onClick={() => {
                  setMode('login');
                  setError('');
                  setSuccessMessage('');
                }}
              >
                Back to Sign In
              </button>
            </>
          )}
          {mode === 'setup' && (
            <>
              Already have an account?{' '}
              <button
                type="button"
                className="auth-toggle"
                onClick={() => {
                  setMode('login');
                  setError('');
                  setSuccessMessage('');
                }}
              >
                Sign In
              </button>
            </>
          )}
          {mode === 'login' && (
            <>
              First time setup?{' '}
              <button
                type="button"
                className="auth-toggle"
                onClick={() => {
                  setMode('setup');
                  setError('');
                  setSuccessMessage('');
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
