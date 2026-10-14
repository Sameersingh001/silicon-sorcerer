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

export function TimerCircle({ remainingMs, totalMs }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const pct = totalMs > 0 ? Math.max(0, remainingMs / totalMs) : 0;
  const offset = circumference * (1 - pct);
  const secs = Math.ceil(remainingMs / 1000);
  const isDanger = secs <= 10;
  const isWarning = secs <= 20 && !isDanger;

  const strokeColor = isDanger ? '#ef4444' : isWarning ? '#f59e0b' : '#4f46e5';

  return (
    <div style={{ position: 'relative', width: 130, height: 130, margin: '0 auto' }}>
      <svg width="130" height="130" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="65" cy="65" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="8" />
        <circle
          cx="65" cy="65" r={radius} fill="none"
          stroke={strokeColor}
          strokeWidth="8"
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
        <span style={{ fontSize: 34, fontWeight: 800, lineHeight: 1 }}>{secs}</span>
        <span style={{ fontSize: 11, color: 'var(--clr-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>seconds</span>
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
