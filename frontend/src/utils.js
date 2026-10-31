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

// ─── Web Audio API KBC Klaxon Hooter Synthesizer ─────────────────────────────
let globalAudioCtx = null;
let isAudioUnlocked = false;
let decodedHooterBuffer = null;
let isPreloading = false;
let keepAliveOsc = null;

export const getAudioContext = () => {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!globalAudioCtx) {
    globalAudioCtx = new AudioCtx();
  }
  return globalAudioCtx;
};

// Keeps the browser's hardware audio pipeline awake in the background
// so Chrome will NEVER auto-suspend AudioContext during the 20s countdown!
export const startAudioKeepAlive = (ctx) => {
  if (keepAliveOsc || !ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    // 1 Hz at gain 0.00001 — completely inaudible to human ear, but keeps the audio thread active
    osc.frequency.setValueAtTime(1, ctx.currentTime);
    gain.gain.setValueAtTime(0.00001, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    keepAliveOsc = osc;
    console.log('🔋 AudioContext Keep-Alive stream ACTIVE (prevents browser auto-suspension)');
  } catch (e) {
    console.warn('Keep-alive notice:', e);
  }
};

// Preloads and decodes the /kbc-hooter.wav file into an in-memory AudioBuffer for 0ms latency
export const preloadHooterAudio = () => {
  if (typeof window === 'undefined' || decodedHooterBuffer || isPreloading) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  isPreloading = true;

  fetch('/kbc-hooter.wav')
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.arrayBuffer();
    })
    .then((arrayBuffer) => ctx.decodeAudioData(arrayBuffer))
    .then((audioBuffer) => {
      decodedHooterBuffer = audioBuffer;
      console.log('✅ KBC Hooter WAV decoded into AudioBuffer (ready for instant 0ms playback)!');
    })
    .catch((err) => {
      console.warn('WAV pre-decode notice (Real-time Web Audio synth will handle playback):', err.message);
    })
    .finally(() => {
      isPreloading = false;
    });
};

/**
 * Pre-warms and physically unlocks browser audio hardware during ANY user gesture (click/tap/key)
 * to guarantee that audio plays completely automatically when the question timer expires!
 */
export const unlockAudio = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    startAudioKeepAlive(ctx);

    if (!isAudioUnlocked) {
      // Hardware wake-up: play a microscopic 1-sample silent buffer to unlock the browser audio pipeline
      try {
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
        isAudioUnlocked = true;
        console.log('🔊 Web Audio Context hardware pipeline UNLOCKED & ACTIVE');
      } catch {}
    }

    // Trigger preloading of the WAV buffer into RAM
    preloadHooterAudio();
  } catch (err) {
    console.warn('Audio unlock notice:', err);
  }
};

// Global listener: capture any initial user click/tap/keypress to immediately unlock audio & preload
if (typeof window !== 'undefined') {
  const handleInteraction = () => {
    unlockAudio();
  };
  window.addEventListener('click', handleInteraction, { capture: true });
  window.addEventListener('keydown', handleInteraction, { capture: true });
  window.addEventListener('touchstart', handleInteraction, { capture: true });
  // Also attempt immediate preload if context allows
  setTimeout(preloadHooterAudio, 500);
}

/**
 * Plays the iconic KBC (Kaun Banega Crorepati) / Who Wants to Be a Millionaire
 * "Out of Time" Klaxon Hooter sound effect when question time is up.
 * 
 * Strategy:
 * 1. If decoded AudioBuffer is in memory, plays it instantly with BufferSourceNode (0ms latency, 0 network).
 * 2. If not decoded yet or network failed, synthesizes the exact KBC dual-tone klaxon via Web Audio API.
 * 3. Also triggers HTML5 Audio as a redundant fallback.
 */
export const playBuzzerSound = () => {
  console.log('🔔 [playBuzzerSound] Invoked! Executing audio playback pipeline...');
  let webAudioStarted = false;

  try {
    const ctx = getAudioContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      executeAudioPlayback(ctx);
      webAudioStarted = true;
    }
  } catch (err) {
    console.warn('Web Audio playback error:', err);
  }

  // Secondary guaranteed channel: HTML5 Audio
  // In modern Chrome, once the user clicks anywhere on the document (e.g. Next Question / Publish),
  // HTML5 audio playback is cleared by browser autoplay policy.
  try {
    const audio = new Audio('/kbc-hooter.wav');
    audio.volume = 0.95;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((e) => {
        console.warn('HTML5 Audio play rejected:', e.message);
        if (!webAudioStarted) {
          synthesizeKbcHooter();
        }
      });
    }
  } catch (e) {
    if (!webAudioStarted) {
      synthesizeKbcHooter();
    }
  }
};

const executeAudioPlayback = (ctx) => {
  // If we have the pre-decoded WAV buffer in memory, play it!
  if (decodedHooterBuffer) {
    try {
      const source = ctx.createBufferSource();
      source.buffer = decodedHooterBuffer;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.9, ctx.currentTime);
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(0);
      console.log('🚨 Playing KBC Hooter via pre-decoded AudioBuffer!');
      return;
    } catch (e) {
      console.warn('BufferSource playback error, falling back to real-time synth:', e);
    }
  }

  // Real-time Web Audio API synthesis (iconic KBC dual klaxon)
  synthesizeKbcHooter();
};

const fallbackHtml5Audio = () => {
  try {
    const audio = new Audio('/kbc-hooter.wav');
    audio.volume = 0.95;
    audio.play().catch(() => {});
  } catch {}
};

/**
 * Real-time synthesis of the KBC Klaxon Hooter using Web Audio API:
 * - Sub-bass studio boom (70Hz -> 38Hz)
 * - Dual coupled air-horn oscillators (222Hz + 239Hz) creating the iconic klaxon rasp
 * - Double blast envelope: Blast 1 (0.44s) -> Brief breath (0.12s) -> Blast 2 (0.75s)
 */
export const synthesizeKbcHooter = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().then(() => doSynthesize(ctx)).catch(() => {});
      return;
    }

    doSynthesize(ctx);
  } catch (err) {
    console.warn('Web Audio KBC synthesis error:', err);
  }
};

const doSynthesize = (ctx) => {
  const now = ctx.currentTime;

  // Master volume gain
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.75, now);
  masterGain.connect(ctx.destination);

  // ── 1. Deep Cinematic Sub-Bass Impact (Studio Gong) ──
  const bassOsc = ctx.createOscillator();
  const bassGain = ctx.createGain();
  bassOsc.type = 'sine';
  bassOsc.frequency.setValueAtTime(70, now);
  bassOsc.frequency.exponentialRampToValueAtTime(38, now + 0.65);
  bassGain.gain.setValueAtTime(0.65, now);
  bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);

  bassOsc.connect(bassGain);
  bassGain.connect(masterGain);
  bassOsc.start(now);
  bassOsc.stop(now + 0.8);

  // ── 2. The Iconic KBC Dual-Tone Klaxon Horn ──
  // Tone 1: ~222 Hz, Tone 2: ~239 Hz (dissonant beating interval)
  const hornFilter = ctx.createBiquadFilter();
  hornFilter.type = 'lowpass';
  hornFilter.frequency.setValueAtTime(1400, now);

  const hornGain = ctx.createGain();
  hornGain.gain.setValueAtTime(0, now);

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const osc3 = ctx.createOscillator(); // 5th harmonic for brass edge

  osc1.type = 'sawtooth';
  osc2.type = 'sawtooth';
  osc3.type = 'triangle';

  // Blast 1: now + 0.04s to now + 0.48s
  // Pitch rises slightly at the start of blast 1 (air pressure building)
  osc1.frequency.setValueAtTime(205, now + 0.04);
  osc1.frequency.linearRampToValueAtTime(222, now + 0.08);
  osc2.frequency.setValueAtTime(220, now + 0.04);
  osc2.frequency.linearRampToValueAtTime(239, now + 0.08);
  osc3.frequency.setValueAtTime(333, now + 0.08);

  // Blast 1 Envelope
  hornGain.gain.setValueAtTime(0, now);
  hornGain.gain.setValueAtTime(0, now + 0.04);
  hornGain.gain.linearRampToValueAtTime(0.60, now + 0.07);
  hornGain.gain.setValueAtTime(0.60, now + 0.44);
  hornGain.gain.linearRampToValueAtTime(0.01, now + 0.48);

  // Silence gap
  hornGain.gain.setValueAtTime(0, now + 0.49);

  // Blast 2: now + 0.60s to now + 1.40s (longer, dramatic hooter blast)
  osc1.frequency.setValueAtTime(210, now + 0.60);
  osc1.frequency.linearRampToValueAtTime(222, now + 0.64);
  osc2.frequency.setValueAtTime(224, now + 0.60);
  osc2.frequency.linearRampToValueAtTime(239, now + 0.64);

  hornGain.gain.setValueAtTime(0, now + 0.59);
  hornGain.gain.linearRampToValueAtTime(0.65, now + 0.63);
  hornGain.gain.setValueAtTime(0.65, now + 1.25);
  hornGain.gain.exponentialRampToValueAtTime(0.001, now + 1.45);

  osc1.connect(hornFilter);
  osc2.connect(hornFilter);
  osc3.connect(hornFilter);
  hornFilter.connect(hornGain);
  hornGain.connect(masterGain);

  osc1.start(now + 0.04);
  osc2.start(now + 0.04);
  osc3.start(now + 0.04);

  const stopTime = now + 1.5;
  osc1.stop(stopTime);
  osc2.stop(stopTime);
  osc3.stop(stopTime);
  console.log('🚨 Synthesized KBC Klaxon Hooter dual-tone blast!');
};

