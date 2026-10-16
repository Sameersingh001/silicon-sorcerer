import { useState } from 'react';
import { Icons } from './Icons';

export function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className="toast-container">
      <div className={`toast toast-${toast.type}`} key={toast.id}>
        {toast.type === 'success' && <Icons.CheckCircle size={18} color="#10b981" />}
        {toast.type === 'error' && <Icons.XCircle size={18} color="#ef4444" />}
        {toast.type === 'warning' && <Icons.ShieldAlert size={18} color="#f59e0b" />}
        {toast.type === 'info' && <Icons.HelpCircle size={18} color="#4f46e5" />}
        <span>{toast.message}</span>
      </div>
    </div>
  );
}

export function Spinner({ size = 'md', style = {} }) {
  return <div className={`spinner${size === 'sm' ? ' spinner-sm' : ''}`} style={style} />;
}

export function StatusBadge({ status }) {
  const labels = { draft: 'Draft', ready: 'Ready', live: 'Live', paused: 'Paused', completed: 'Completed' };
  const types = { draft: 'badge-neutral', ready: 'badge-purple', live: 'badge-success', paused: 'badge-warning', completed: 'badge-neutral' };
  return (
    <span className={`badge ${types[status] || 'badge-neutral'}`}>
      <span className={`status-dot ${status}`} />
      {labels[status] || status}
    </span>
  );
}

export function TimerCircle({ remainingMs, totalMs, compact = false, large = false }) {
  const radius = compact ? 36 : large ? 60 : 48;
  const size = compact ? 88 : large ? 144 : 116;
  const strokeWidth = compact ? 6 : large ? 9 : 7;
  const circumference = 2 * Math.PI * radius;
  const pct = totalMs > 0 ? Math.max(0, remainingMs / totalMs) : 0;
  const offset = circumference * (1 - pct);
  const secs = Math.ceil(remainingMs / 1000);
  const isDanger = secs <= 5;
  const isWarning = secs <= 15 && !isDanger;

  const strokeColor = isDanger ? '#ef4444' : isWarning ? '#f59e0b' : '#6366f1';
  const filterGlow = isDanger
    ? 'drop-shadow(0 0 12px rgba(239, 68, 68, 0.85))'
    : isWarning
    ? 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.7))'
    : 'drop-shadow(0 0 8px rgba(99, 102, 241, 0.6))';

  return (
    <div
      className={`timer-wrapper${isDanger ? ' timer-pulse' : ''}`}
      style={{ position: 'relative', width: size, height: size, margin: '0 auto', filter: filterGlow }}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 0.25s linear, stroke 0.3s ease',
          }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        color: strokeColor,
        fontFamily: 'var(--font-display)',
      }}>
        <span style={{ fontSize: compact ? 24 : large ? 42 : 32, fontWeight: 800, lineHeight: 1 }}>{secs}</span>
        <span style={{
          fontSize: compact ? 9 : large ? 12 : 10,
          color: 'var(--clr-text-muted)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginTop: 2,
        }}>
          sec
        </span>
      </div>
    </div>
  );
}

// ─── Big QR Code Modal ("open krkr bada bada dikhao") ─────────────
export function BigQRModal({ isOpen, onClose, qrData, participantCount = 0 }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !qrData) return null;

  const handleCopy = () => {
    if (qrData.registrationUrl) {
      navigator.clipboard.writeText(qrData.registrationUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="big-qr-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="badge badge-primary">
              <Icons.QrCode size={14} /> Scan & Compete
            </span>
            <span className="badge badge-success">
              <Icons.Users size={14} /> {participantCount} Joined Live
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={toggleFullscreen} title="Projector Fullscreen">
              <Icons.Maximize size={15} />
            </button>
            <button className="btn btn-secondary btn-sm" onClick={onClose}>
              <Icons.XCircle size={16} />
            </button>
          </div>
        </div>

        <h2 style={{ fontSize: 26, marginBottom: 6 }}>Scan to Join the Quiz Arena</h2>
        <p style={{ fontSize: 14, color: 'var(--clr-text)', marginBottom: 24 }}>
          Open your smartphone camera or QR scanner app to register instantly.
        </p>

        {/* Large QR Display Container */}
        <div style={{
          display: 'inline-flex',
          padding: 18,
          background: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 12px 36px rgba(15, 23, 42, 0.1)',
          border: '2px solid var(--clr-border)',
          marginBottom: 20,
        }}>
          <img
            src={qrData.qrDataUrl}
            alt="Registration QR Code"
            style={{ width: 280, height: 280, display: 'block', borderRadius: 8 }}
          />
        </div>

        {/* Direct Link & Copy */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'var(--clr-surface-2)',
          padding: '8px 12px',
          borderRadius: 'var(--radius-md)',
          maxWidth: 440,
          margin: '0 auto 16px',
        }}>
          <span style={{ fontSize: 12, color: 'var(--clr-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>
            {qrData.registrationUrl}
          </span>
          <button className="btn btn-primary btn-sm" onClick={handleCopy}>
            {copied ? <Icons.Check size={14} /> : <Icons.Copy size={14} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <button className="btn btn-secondary btn-full" onClick={onClose}>
          Close Preview
        </button>
      </div>
    </div>
  );
}

// ─── Real-time Cheating Alert Banner (Admin) ───────────────────────
export function CheatingAlertBanner({ alert, onDismiss }) {
  if (!alert) return null;
  return (
    <div className="cheat-alert-banner">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ background: '#ef4444', color: '#fff', padding: 8, borderRadius: 8, display: 'flex' }}>
          <Icons.ShieldAlert size={20} />
        </div>
        <div>
          <h4 style={{ color: '#b91c1c', fontSize: 14, fontWeight: 700 }}>
            Anti-Cheat Alert: Tab Switch / Window Blur Detected!
          </h4>
          <p style={{ color: '#7f1d1d', fontSize: 13, marginTop: 2 }}>
            <strong>{alert.fullName}</strong> ({alert.course || 'Student'}) left the quiz screen during Round {alert.roundNumber || 1}.
            <span style={{ marginLeft: 8, fontWeight: 700, color: '#dc2626' }}>
              Warning {alert.warningCount}/3 {alert.isDisqualified ? '— DISQUALIFIED' : ''}
            </span>
          </p>
        </div>
      </div>
      <button className="btn btn-sm btn-outline-danger" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
}

// ─── iPhone / Mobile Fullscreen Helper Modal / Guide ───────────────
export function IPhoneFullscreenHelper({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 3000 }}>
      <div
        className="glass-card ios-helper-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 440,
          width: '92%',
          padding: '28px 24px',
          textAlign: 'center',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          background: 'rgba(15, 23, 42, 0.96)',
          color: '#ffffff',
          borderRadius: 24,
          boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
        }}
      >
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 58,
          height: 58,
          borderRadius: 16,
          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
          color: '#fff',
          marginBottom: 16,
          boxShadow: '0 8px 24px rgba(79, 70, 229, 0.4)',
        }}>
          <Icons.Smartphone size={30} />
        </div>

        <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, color: '#ffffff' }}>
          Full Screen Mode for iPhone
        </h3>
        <p style={{ fontSize: 13.5, color: '#94a3b8', lineHeight: 1.5, marginBottom: 20 }}>
          Apple Safari blocks standard web fullscreen. For a 100% immersive, app-like screen without Safari address or bottom bars:
        </p>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          textAlign: 'left',
          marginBottom: 24,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 14,
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '12px 14px',
            borderRadius: 14,
          }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: '#38bdf8',
              color: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 14,
              flexShrink: 0,
            }}>
              1
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 6 }}>
                Tap the Share Button <Icons.Share size={15} color="#38bdf8" />
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                Found at the bottom center of your Safari browser bar.
              </div>
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 14,
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '12px 14px',
            borderRadius: 14,
          }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: '#818cf8',
              color: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 14,
              flexShrink: 0,
            }}>
              2
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#f8fafc' }}>
                Select "Add to Home Screen"
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                Tap "Add" in top right. Then launch QR Quest from your Home Screen!
              </div>
            </div>
          </div>
        </div>

        <button
          className="btn btn-primary btn-full btn-lg"
          onClick={onClose}
          style={{
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            border: 'none',
            color: '#fff',
            fontWeight: 700,
          }}
        >
          Got It, Continue Playing
        </button>
      </div>
    </div>
  );
}

// ─── Compact iPhone Prompt Banner ──────────────────────────────────
export function IPhoneBannerPrompt({ onOpenGuide }) {
  return (
    <button type="button" className="ios-pill-banner" onClick={onOpenGuide}>
      <span className="ios-pill-icon"><Icons.Smartphone size={13} /></span>
      <span>iPhone user? Tap for <strong>True Fullscreen</strong> tip</span>
      <Icons.ChevronRight size={13} />
    </button>
  );
}

