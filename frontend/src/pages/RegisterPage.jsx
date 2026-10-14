import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, setParticipantSession, getParticipantSession } from '../utils';
import { useToast } from '../hooks';
import { Toast, Spinner } from '../components';
import { Icons } from '../Icons';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { toast, showToast } = useToast();

  const [fullName, setFullName] = useState('');
  const [course, setCourse] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [eventStatus, setEventStatus] = useState(null);
  const [registeredUser, setRegisteredUser] = useState(null);

  // If already registered, go to game
  useEffect(() => {
    const session = getParticipantSession();
    if (session?.sessionToken) {
      navigate('/game', { replace: true });
      return;
    }
    apiFetch('/api/events/current')
      .then((data) => {
        if (data.success) setEventStatus(data.event?.status);
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fullName.trim() || !course.trim()) {
      showToast('Please fill in your name and course', 'error');
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch('/api/participants/register', {
        method: 'POST',
        body: JSON.stringify({ fullName: fullName.trim(), course: course.trim() }),
      });

      if (data.success) {
        setParticipantSession(data.participant);
        setRegisteredUser(data.participant);
        showToast(data.restored ? 'Welcome back! Session restored.' : 'Registration successful! Ready to lock screen.', 'success');
      } else {
        showToast(data.message || 'Registration failed', 'error');
      }
    } catch {
      showToast('Could not reach the server. Please check connection.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEnterArena = () => {
    // Attempt fullscreen to lock screen on student device
    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch {}
    navigate('/game', { replace: true });
  };

  if (checking) {
    return (
      <div className="page">
        <Spinner />
      </div>
    );
  }

  const isClosed = eventStatus === 'completed';

  return (
    <div className="page">
      <Toast toast={toast} />

      <div className="container fade-in">
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 64, height: 64, borderRadius: 18,
            background: 'var(--grad-primary)',
            color: '#ffffff',
            marginBottom: 16,
            boxShadow: '0 8px 24px rgba(79, 70, 229, 0.25)',
          }}>
            <Icons.QrCode size={32} />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6, color: 'var(--clr-text-h)' }}>
            Silicon Sorcerer
          </h1>
          <p style={{ fontSize: 14, color: 'var(--clr-text)' }}>
            College QR Quest & Live Competition Arena
          </p>
        </div>

        {/* Card */}
        <div className="glass-card" style={{ padding: 32 }}>
          {isClosed ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ display: 'inline-flex', padding: 16, background: '#fef2f2', color: '#ef4444', borderRadius: '50%', marginBottom: 16 }}>
                <Icons.Lock size={32} />
              </div>
              <h2 style={{ fontSize: 20, marginBottom: 8 }}>Registration Closed</h2>
              <p style={{ fontSize: 14, color: 'var(--clr-text)' }}>
                This quiz event has ended. Please contact the administrator.
              </p>
            </div>
          ) : registeredUser ? (
            /* Registered Screen Lock Prompt */
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ display: 'inline-flex', padding: 16, background: '#ecfdf5', color: '#10b981', borderRadius: '50%', marginBottom: 16 }}>
                <Icons.CheckCircle size={36} />
              </div>
              <h2 style={{ fontSize: 22, marginBottom: 8, color: 'var(--clr-text-h)' }}>
                Welcome, {registeredUser.fullName}!
              </h2>
              <p style={{ fontSize: 13, color: 'var(--clr-text)', marginBottom: 20, lineHeight: 1.6 }}>
                Your device will now enter <strong>Locked Screen Mode</strong>. Switching tabs or closing this window during the quiz is strictly recorded and reported to proctors.
              </p>

              <button
                id="btn-lock-enter"
                className="btn btn-primary btn-full btn-lg"
                onClick={handleEnterArena}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
              >
                <Icons.Lock size={18} />
                <span>Lock Screen & Enter Quiz</span>
              </button>
            </div>
          ) : (
            /* Registration Form */
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <span className="badge badge-primary">
                  <Icons.Users size={13} /> Participant Registration
                </span>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="fullName">Full Name</label>
                <input
                  id="fullName"
                  type="text"
                  className="input-field"
                  placeholder="e.g. Sameer Singh"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={loading}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="course">Course / Department / Year</label>
                <input
                  id="course"
                  type="text"
                  className="input-field"
                  placeholder="e.g. B.Tech CSE - 3rd Year"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div style={{
                background: 'var(--clr-surface-2)',
                border: '1px solid var(--clr-border)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                marginBottom: 24,
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
              }}>
                <div style={{ color: 'var(--clr-primary)', marginTop: 2 }}>
                  <Icons.ShieldAlert size={16} />
                </div>
                <p style={{ fontSize: 12, color: 'var(--clr-text-2)', lineHeight: 1.5 }}>
                  <strong>Anti-Cheat Active:</strong> Your screen will lock during the quiz. Tab-switching or exiting the window will notify the admin immediately.
                </p>
              </div>

              <button
                id="btn-register"
                type="submit"
                className="btn btn-primary btn-full btn-lg"
                disabled={loading}
              >
                {loading ? <Spinner size="sm" /> : (
                  <>
                    <span>Register to Compete</span>
                    <Icons.ChevronRight size={16} />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
