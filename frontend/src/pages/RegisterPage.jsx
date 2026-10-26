import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiFetch, setParticipantSession, getParticipantSession } from '../utils';
import { useToast } from '../hooks';
import { Toast, Spinner, IPhoneFullscreenHelper, IPhoneBannerPrompt } from '../components';
import { Icons } from '../Icons';
import brandLogo from '../assets/logo-transparent.png';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { toast, showToast } = useToast();

  const [fullName, setFullName] = useState('');
  const [course, setCourse] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [eventStatus, setEventStatus] = useState(null);
  const [registeredUser, setRegisteredUser] = useState(null);
  const [showIosGuide, setShowIosGuide] = useState(false);

  // Check iOS device & standalone status
  const isIOS = typeof navigator !== 'undefined' && (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
  const isStandalone = typeof window !== 'undefined' && (
    window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  );

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
    // Attempt standard fullscreen API (works on Android / Chrome / Desktop)
    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch {}
    // Scroll by 1px on iOS Safari to trigger minimal toolbar (iOS only)
    if (isIOS) {
      try {
        window.scrollTo(0, 1);
      } catch {}
    }
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
      <IPhoneFullscreenHelper isOpen={showIosGuide} onClose={() => setShowIosGuide(false)} />

      <div className="container fade-in" style={{ maxWidth: 440, width: '100%' }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#000000',
            padding: '10px 18px',
            borderRadius: 16,
            marginBottom: 12,
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
          }}>
            <img
              src={brandLogo}
              alt="Silicon Sorcerers Logo"
              style={{
                height: 56,
                width: 'auto',
                objectFit: 'contain',
              }}
            />
          </div>
          <h1 style={{ fontSize: 'clamp(22px, 5vw, 28px)', fontWeight: 800, marginBottom: 4, color: 'var(--clr-text-h)' }}>
            Silicon Sorcerers
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--clr-text)', marginBottom: 12 }}>
            College QR Quest & Live Competition Arena
          </p>
        </div>

        {/* Card */}
        <div className="glass-card" style={{ padding: 'clamp(20px, 5vw, 32px)', borderRadius: 24 }}>
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
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{
                display: 'inline-flex', padding: 16, background: '#ecfdf5',
                color: '#10b981', borderRadius: '50%', marginBottom: 16,
                boxShadow: '0 0 20px rgba(16, 185, 129, 0.25)',
              }}>
                <Icons.CheckCircle size={36} />
              </div>
              <h2 style={{ fontSize: 22, marginBottom: 8, color: 'var(--clr-text-h)', fontWeight: 800 }}>
                Welcome, {registeredUser.fullName}!
              </h2>
              <p style={{ fontSize: 13, color: 'var(--clr-text)', marginBottom: 20, lineHeight: 1.6 }}>
                Your device will now enter <strong>Locked Screen Mode</strong>. Switching tabs or closing this window during the quiz is strictly recorded and reported to proctors.
              </p>

              <button
                id="btn-lock-enter"
                className="btn btn-primary btn-full btn-lg"
                onClick={handleEnterArena}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  fontSize: 15, fontWeight: 700, borderRadius: 14,
                }}
              >
                <Icons.Lock size={18} />
                <span>Lock Screen & Enter Quiz</span>
              </button>
            </div>
          ) : (
            /* Registration Form */
            <form onSubmit={handleSubmit}>

              <div className="form-group" style={{ marginBottom: 16 }}>
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
                  style={{ fontSize: 15, padding: '12px 14px' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 18 }}>
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
                  style={{ fontSize: 15, padding: '12px 14px' }}
                />
              </div>

              <div style={{
                background: 'var(--clr-surface-2)',
                border: '1px solid var(--clr-border)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                marginBottom: 20,
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
              }}>
                <div style={{ color: 'var(--clr-primary)', marginTop: 2, flexShrink: 0 }}>
                  <Icons.ShieldAlert size={16} />
                </div>
                <p style={{ fontSize: 12, color: 'var(--clr-text-2)', lineHeight: 1.5 }}>
                  <strong>Anti-Cheat Active:</strong> Your screen will lock during questions. Switching tabs or exiting will log strike <strong>3 strikes lead to automatic disqualification</strong>.
                </p>
              </div>

              <button
                id="btn-register"
                type="submit"
                className="btn btn-primary btn-full btn-lg"
                disabled={loading}
                style={{
                  fontSize: 15.5,
                  fontWeight: 700,
                  borderRadius: 14,
                  padding: '13px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {loading ? <Spinner size="sm" /> : (
                  <>
                    <span>Register to Compete</span>
                    <Icons.ChevronRight size={17} />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* iPhone Fullscreen Helper Banner */}
        {isIOS && !isStandalone && (
          <div style={{ textAlign: 'center', marginTop: 14 }}>
            <IPhoneBannerPrompt onOpenGuide={() => setShowIosGuide(true)} />
          </div>
        )}
      </div>
    </div>
  );
}
