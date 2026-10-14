import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, setAdminToken } from '../utils';
import { useToast } from '../hooks';
import { Toast, Spinner } from '../components';
import { Icons } from '../Icons';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { toast, showToast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      showToast('Please enter your credentials', 'error');
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: username.trim(), password }),
      });
      if (data.success && data.token) {
        setAdminToken(data.token);
        showToast('Welcome back, Admin!', 'success');
        setTimeout(() => navigate('/admin', { replace: true }), 400);
      } else {
        showToast(data.message || 'Invalid username or password', 'error');
      }
    } catch {
      showToast('Could not reach backend server', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <Toast toast={toast} />

      <div className="container fade-in">
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 60, height: 60, borderRadius: 16,
            background: 'var(--grad-primary)',
            color: '#ffffff',
            marginBottom: 16,
            boxShadow: '0 8px 24px rgba(79, 70, 229, 0.25)',
          }}>
            <Icons.Lock size={28} />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6, color: 'var(--clr-text-h)' }}>
            Admin Portal
          </h1>
          <p style={{ fontSize: 14, color: 'var(--clr-text)' }}>
            Sign in to manage quiz rounds, questions, and students
          </p>
        </div>

        {/* Card */}
        <div className="glass-card" style={{ padding: 32 }}>
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label" htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                className="input-field"
                placeholder="Enter admin username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label className="form-label" htmlFor="password" style={{ margin: 0 }}>Password</label>
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 12, color: 'var(--clr-primary)', fontWeight: 600,
                  }}
                >
                  {showPass ? 'Hide' : 'Show'}
                </button>
              </div>
              <input
                id="password"
                type={showPass ? 'text' : 'password'}
                className="input-field"
                placeholder="Enter admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div style={{
              background: 'var(--clr-surface-2)',
              border: '1px solid var(--clr-border)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              fontSize: 12,
              color: 'var(--clr-text)',
              marginBottom: 20,
              display: 'flex',
              gap: 8,
              alignItems: 'center',
            }}>
              <Icons.ShieldAlert size={14} color="var(--clr-primary)" />
              <span>Default login: <strong>admin</strong> / <strong>Admin@123</strong></span>
            </div>

            <button
              id="btn-login"
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={loading}
            >
              {loading ? <Spinner size="sm" /> : (
                <>
                  <Icons.Lock size={16} />
                  <span>Authenticate & Enter</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
