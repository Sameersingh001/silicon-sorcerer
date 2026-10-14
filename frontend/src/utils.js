// API base URL — configured via VITE_API_URL environment variable
// Strips any trailing slashes to prevent invalid '//' URL paths
const envApiUrl = import.meta.env.VITE_API_URL;
export const API_BASE = (
  envApiUrl !== undefined && envApiUrl !== ''
    ? envApiUrl
    : (import.meta.env.DEV ? 'http://localhost:5000' : '')
).replace(/\/+$/, '');

// ─── Auth helpers ────────────────────────────────────────────────
export const getAdminToken = () => localStorage.getItem('admin_token');
export const setAdminToken = (t) => localStorage.setItem('admin_token', t);
export const clearAdminToken = () => localStorage.removeItem('admin_token');

export const getParticipantSession = () => {
  const raw = sessionStorage.getItem('participant');
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
};
export const setParticipantSession = (data) =>
  sessionStorage.setItem('participant', JSON.stringify(data));
export const clearParticipantSession = () => sessionStorage.removeItem('participant');

// ─── HTTP helpers ────────────────────────────────────────────────
export const apiFetch = async (path, options = {}) => {
  const token = getAdminToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  return res.json();
};

// ─── Format helpers ──────────────────────────────────────────────
export const fmtTime = (ms) => {
  const secs = Math.ceil(ms / 1000);
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

export const fmtMs = (ms) => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

export const rankIcon = (rank) => {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
};

export const statusColor = (status) => {
  const map = {
    draft: '#94a3b8',
    ready: '#6378ff',
    live: '#22d3a0',
    paused: '#f59e0b',
    completed: '#a855f7',
  };
  return map[status] || '#94a3b8';
};
