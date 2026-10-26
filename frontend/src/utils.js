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

// Check if a string is likely an image URL or base64 image data
export const isImageUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  const str = url.trim();
  if (/^data:image\/[a-zA-Z+]+;base64,/i.test(str)) return true;
  if (/^https?:\/\/.*\.(png|jpg|jpeg|gif|webp|svg|bmp|avif|ico)(\?.*)?$/i.test(str)) return true;
  if (/^https?:\/\/(images\.unsplash\.com|res\.cloudinary\.com|i\.imgur\.com|imgur\.com|postimg\.cc|i\.postimg\.cc|upload\.wikimedia\.org|drive\.google\.com|picsum\.photos|via\.placeholder\.com|placehold\.co)/i.test(str)) return true;
  if (/^https?:\/\/.*(image|photo|img|picture|gstatic\.com\/images)/i.test(str)) return true;
  if (/^https?:\/\/[^\s]+$/i.test(str) && !/\.(html|htm|php|asp|pdf)$/i.test(str)) {
    return true;
  }
  return false;
};

// Parse option content which may contain text, image URL, or "Text | ImageURL" / "ImageURL | Text"
export const parseOptionContent = (opt) => {
  if (!opt || typeof opt !== 'string') {
    return { text: String(opt || ''), image: '', hasImage: false };
  }
  const trimmed = opt.trim();

  // If option contains pipe delimiter "Text | https://..." or "https://... | Text"
  if (trimmed.includes('|') || trimmed.includes('::')) {
    const parts = trimmed.split(/\||::/).map((p) => p.trim());
    const imgPart = parts.find((p) => isImageUrl(p) || p.startsWith('http://') || p.startsWith('https://'));
    const textPart = parts.find((p) => p !== imgPart) || '';
    if (imgPart) {
      return { text: textPart, image: imgPart, hasImage: true };
    }
  }

  // Pure image URL
  if (isImageUrl(trimmed)) {
    return { text: '', image: trimmed, hasImage: true };
  }

  return { text: trimmed, image: '', hasImage: false };
};

// Check if an option matches the correct answer (handles letters 'A'-'D', option text, and prefixed forms)
export const isCorrectOption = (opt, index, correctAnswer) => {
  if (!correctAnswer || opt === undefined || opt === null) return false;
  const letters = ['A', 'B', 'C', 'D'];
  const letter = letters[index] || '';
  const normCorrect = String(correctAnswer).trim().toLowerCase();
  const normOpt = String(opt).trim().toLowerCase();
  const normLetter = letter.toLowerCase();

  // 1. Direct letter match (e.g. 'A', 'B', 'C', 'D')
  if (normCorrect === normLetter) return true;

  // 2. Letter with prefix or punctuation (e.g. 'Option A', 'Choice A', 'A)', 'A.', 'A -')
  if (
    normCorrect === `option ${normLetter}` ||
    normCorrect === `choice ${normLetter}` ||
    normCorrect === `${normLetter})` ||
    normCorrect === `${normLetter}.` ||
    normCorrect.startsWith(`${normLetter} `) ||
    normCorrect.startsWith(`${normLetter})`) ||
    normCorrect.startsWith(`${normLetter}.`)
  ) {
    return true;
  }

  // 3. Exact full string match
  if (normOpt === normCorrect) return true;

  // 4. Normalized comparison (stripping prefixes like 'A)', 'Option A:', etc.)
  const cleanCorrect = normCorrect
    .replace(/^(option\s*|choice\s*)/i, '')
    .replace(/^([a-d])[).\s-]+/i, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  const cleanOpt = normOpt
    .replace(/^(option\s*|choice\s*)/i, '')
    .replace(/^([a-d])[).\s-]+/i, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleanCorrect && cleanOpt && cleanCorrect === cleanOpt) return true;

  // 5. Option starts with letter prefix and matches
  if (normOpt.startsWith(`${normLetter})`) || normOpt.startsWith(`${normLetter}.`)) {
    if (cleanOpt === cleanCorrect) return true;
  }

  // 6. Handle pipe options (e.g. Text | ImageURL)
  if (opt && String(opt).includes('|')) {
    const parts = String(opt).split('|').map((p) => p.trim().toLowerCase());
    if (parts.some((p) => p === normCorrect || p === cleanCorrect)) return true;
  }

  return false;
};

