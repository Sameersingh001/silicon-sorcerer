import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { API_BASE, getParticipantSession, clearParticipantSession, apiFetch, fmtMs } from '../utils';
import { useToast, useCountdown } from '../hooks';
import { Toast, Spinner, TimerCircle } from '../components';
import { Icons } from '../Icons';

const PHASE = {
  WAITING: 'waiting',      // before quiz starts or between rounds
  QUESTION: 'question',    // active round
  SUBMITTED: 'submitted',  // answer sent, waiting for round close
  ROUND_RESULT: 'result',  // round closed, showing feedback & leaderboard
  COMPLETED: 'completed',  // quiz over
  PAUSED: 'paused',
};

export default function GamePage() {
  const navigate = useNavigate();
  const { toast, showToast } = useToast();
  const socketRef = useRef(null);

  const [session, setSession] = useState(null);
  const [phase, setPhase] = useState(PHASE.WAITING);
  const [gameState, setGameState] = useState(null);
  const [question, setQuestion] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [roundLeaderboard, setRoundLeaderboard] = useState([]);
  const [connected, setConnected] = useState(false);

  // Anti-cheat warning state
  const [cheatWarning, setCheatWarning] = useState(null);
  const [warningCount, setWarningCount] = useState(0);

  const remaining = useCountdown(
    phase === PHASE.QUESTION ? question?.deadlineAt : null,
    question?.serverTime
  );

  // ── On mount: check session ──────────────────────────────────────
  useEffect(() => {
    const s = getParticipantSession();
    if (!s?.sessionToken) {
      navigate('/register', { replace: true });
      return;
    }
    setSession(s);
  }, [navigate]);

  // ── Anti-Cheat Tab Switch & Blur Monitor ─────────────────────────
  const reportCheating = useCallback((reason) => {
    const s = getParticipantSession();
    if (!s?.sessionToken) return;

    // Show on-screen warning banner
    setWarningCount((prev) => {
      const next = prev + 1;
      setCheatWarning({
        reason,
        count: next,
      });
      return next;
    });

    // Notify backend via socket
    if (socketRef.current?.connected) {
      socketRef.current.emit('participant:cheating_attempt', {
        sessionToken: s.sessionToken,
        reason,
      });
    }

    // Fallback HTTP call
    apiFetch('/api/participants/cheat-alert', {
      method: 'POST',
      body: JSON.stringify({ sessionToken: s.sessionToken, reason }),
    }).catch(() => {});
  }, []);

  useEffect(() => {
    // Only monitor visibility / blur when session exists and quiz is in progress
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && phase === PHASE.QUESTION) {
        reportCheating('Switched browser tab or minimized window');
      }
    };

    const handleWindowBlur = () => {
      if (phase === PHASE.QUESTION) {
        reportCheating('Left quiz window or opened other app');
      }
    };

    // Prevent context menu (right click) and copy-paste during quiz
    const handleContextMenu = (e) => e.preventDefault();
    const handleCopy = (e) => e.preventDefault();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopy);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopy);
    };
  }, [phase, reportCheating]);

  // ── Socket.IO Connection ─────────────────────────────────────────
  useEffect(() => {
    if (!session?.sessionToken) return;

    const socket = io(API_BASE, {
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('participant:join', { sessionToken: session.sessionToken });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('game:state', (state) => {
      setGameState(state);
      if (state.status === 'paused') setPhase(PHASE.PAUSED);
      else if (state.status === 'completed') setPhase(PHASE.COMPLETED);
    });

    socket.on('game:started', () => {
      setPhase(PHASE.WAITING);
      showToast('The Quiz has officially started! Get ready...', 'info');
      // Lock into fullscreen
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } catch {}
    });

    socket.on('question:new', (q) => {
      setQuestion(q);
      setSelectedOption(null);
      setTextAnswer('');
      setSubmitting(false);
      setPhase(PHASE.QUESTION);
      setLastResult(null);

      // Re-enter fullscreen if lost
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } catch {}
    });

    socket.on('round:closed', () => {
      setPhase((prev) => (prev === PHASE.QUESTION || prev === PHASE.SUBMITTED ? PHASE.ROUND_RESULT : prev));
      showToast('Time is up! Round closed.', 'warning');
    });

    socket.on('leaderboard:round', ({ roundNumber, leaderboard }) => {
      setRoundLeaderboard(leaderboard);
      const myResult = leaderboard.find((item) => item.participantId === session.participantId);
      if (myResult) {
        setLastResult({
          isCorrect: myResult.isCorrect,
          pointsAwarded: myResult.pointsAwarded,
          responseTimeMs: myResult.responseTimeMs,
          rank: myResult.rank,
        });
      }
      setPhase(PHASE.ROUND_RESULT);
    });

    socket.on('game:completed', () => {
      setPhase(PHASE.COMPLETED);
      showToast('Quiz has concluded! Check the leaderboard.', 'success');
    });

    socket.on('game:reset', () => {
      clearParticipantSession();
      navigate('/register', { replace: true });
    });

    socket.on('participant:warning', (w) => {
      setWarningCount(w.warningCount);
    });

    return () => socket.disconnect();
  }, [session, navigate, showToast]);

  // ── Submit Answer ────────────────────────────────────────────────
  const submitAnswer = async (ansToSubmit) => {
    const finalAnswer = ansToSubmit || selectedOption || textAnswer;
    if (!finalAnswer || submitting) return;

    setSubmitting(true);
    try {
      const data = await apiFetch('/api/submissions', {
        method: 'POST',
        body: JSON.stringify({
          sessionToken: session.sessionToken,
          submittedAnswer: finalAnswer,
        }),
      });

      if (data.success) {
        setPhase(PHASE.SUBMITTED);
        showToast('Answer locked & submitted!', 'success');
      } else {
        showToast(data.message || 'Submission rejected', 'error');
        setSubmitting(false);
      }
    } catch {
      showToast('Network error while submitting answer', 'error');
      setSubmitting(false);
    }
  };

  const handleSelectOption = (opt) => {
    setSelectedOption(opt);
    submitAnswer(opt);
  };

  const requestFullscreen = () => {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch {}
  };

  // ── Render: Screen Lock Cheat Warning Overlay ────────────────────
  const renderCheatWarning = () => {
    if (!cheatWarning) return null;
    return (
      <div className="cheat-warning-overlay">
        <div style={{ background: '#ffffff', color: '#b91c1c', padding: 20, borderRadius: '50%', marginBottom: 16 }}>
          <Icons.ShieldAlert size={48} />
        </div>
        <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 10 }}>
          Anti-Cheat Warning!
        </h2>
        <p style={{ fontSize: 16, maxWidth: 460, marginBottom: 8, lineHeight: 1.5 }}>
          {cheatWarning.reason}
        </p>
        <p style={{ fontSize: 14, opacity: 0.9, marginBottom: 24 }}>
          This event has been logged and reported directly to the quiz proctors.
        </p>
        <div style={{
          background: 'rgba(255,255,255,0.2)',
          padding: '8px 18px',
          borderRadius: '999px',
          fontWeight: 700,
          fontSize: 15,
          marginBottom: 28,
        }}>
          Warning {warningCount} of 3 {warningCount >= 3 ? '(DISQUALIFIED)' : ''}
        </div>
        <button
          className="btn btn-secondary btn-lg"
          onClick={() => {
            setCheatWarning(null);
            requestFullscreen();
          }}
          style={{ background: '#ffffff', color: '#b91c1c', border: 'none', fontWeight: 700 }}
        >
          Return to Locked Quiz Arena
        </button>
      </div>
    );
  };

  // ── Render: ACTIVE QUESTION (FULLSCREEN COVER) ───────────────────
  if (phase === PHASE.QUESTION && question) {
    const letters = ['A', 'B', 'C', 'D'];
    const hasOptions = Array.isArray(question.options) && question.options.length >= 2;

    return (
      <div className="fullscreen-arena">
        <Toast toast={toast} />
        {renderCheatWarning()}

        {/* Top Arena Header */}
        <div className="arena-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="badge badge-primary">
              Round {question.roundNumber} of {question.totalRounds}
            </span>
            {question.category && (
              <span className="badge badge-purple">{question.category}</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="badge badge-neutral" style={{ fontSize: 12 }}>
              <Icons.Lock size={12} /> Screen Locked
            </span>
          </div>
        </div>

        {/* Central Question Card */}
        <div className="arena-card fade-in">
          {/* Timer Display */}
          <div style={{ textAlign: 'center' }}>
            <TimerCircle
              remainingMs={remaining}
              totalMs={question.timeLimitSeconds * 1000}
            />
          </div>

          {/* Question Text */}
          <div style={{ textAlign: 'center' }}>
            <h2 style={{
              fontSize: 'clamp(20px, 4vw, 30px)',
              fontWeight: 800,
              color: 'var(--clr-text-h)',
              lineHeight: 1.35,
            }}>
              {question.questionText}
            </h2>
          </div>

          {/* 4 Interactive Options Grid */}
          {hasOptions ? (
            <div className="options-grid">
              {question.options.map((opt, idx) => {
                const letter = letters[idx] || `${idx + 1}`;
                const isSelected = selectedOption === opt;
                return (
                  <button
                    key={idx}
                    type="button"
                    className={`option-btn${isSelected ? ' selected' : ''}`}
                    onClick={() => handleSelectOption(opt)}
                    disabled={submitting}
                  >
                    <span className="option-letter">{letter}</span>
                    <span style={{ flex: 1 }}>{opt}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            /* Fallback Text Input */
            <form onSubmit={(e) => { e.preventDefault(); submitAnswer(); }} style={{ display: 'flex', gap: 12 }}>
              <input
                type="text"
                className="input-field"
                placeholder="Type your answer here..."
                value={textAnswer}
                onChange={(e) => setTextAnswer(e.target.value)}
                disabled={submitting}
                autoFocus
              />
              <button type="submit" className="btn btn-primary" disabled={submitting || !textAnswer.trim()}>
                {submitting ? <Spinner size="sm" /> : 'Submit'}
              </button>
            </form>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--clr-border)', paddingTop: 16 }}>
            <span style={{ fontSize: 13, color: 'var(--clr-text)' }}>
              Participant: <strong>{session?.fullName}</strong>
            </span>
            <span style={{ fontSize: 13, color: 'var(--clr-primary)', fontWeight: 600 }}>
              Tap an option to lock answer
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: SUBMITTED (WAITING FOR ROUND END) ─────────────────────
  if (phase === PHASE.SUBMITTED) {
    return (
      <div className="page">
        <Toast toast={toast} />
        {renderCheatWarning()}

        <div className="glass-card" style={{ maxWidth: 480, width: '100%', padding: 40, textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex', padding: 20, background: '#ecfdf5',
            color: '#10b981', borderRadius: '50%', marginBottom: 20,
          }}>
            <Icons.CheckCircle size={44} />
          </div>
          <h2 style={{ fontSize: 24, marginBottom: 8, color: 'var(--clr-text-h)' }}>
            Answer Locked & Submitted!
          </h2>
          <p style={{ fontSize: 14, color: 'var(--clr-text)', marginBottom: 24, lineHeight: 1.6 }}>
            Waiting for other participants and for the timer to expire. Round results and standings will appear automatically.
          </p>

          <div style={{
            background: 'var(--clr-surface-2)', padding: '14px 18px',
            borderRadius: 'var(--radius-md)', border: '1px solid var(--clr-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}>
            <Icons.Lock size={16} color="var(--clr-primary)" />
            <span style={{ fontSize: 13, color: 'var(--clr-text-2)', fontWeight: 500 }}>
              Screen remains locked in proctored mode.
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: ROUND RESULT ─────────────────────────────────────────
  if (phase === PHASE.ROUND_RESULT) {
    return (
      <div className="page">
        <Toast toast={toast} />

        <div className="glass-card" style={{ maxWidth: 540, width: '100%', padding: 36 }}>
          {/* Result Banner */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{
              display: 'inline-flex', padding: 18,
              background: lastResult?.isCorrect ? '#ecfdf5' : '#fef2f2',
              color: lastResult?.isCorrect ? '#10b981' : '#ef4444',
              borderRadius: '50%', marginBottom: 14,
            }}>
              {lastResult?.isCorrect ? <Icons.CheckCircle size={40} /> : <Icons.XCircle size={40} />}
            </div>
            <h2 style={{ fontSize: 24, color: lastResult?.isCorrect ? '#059669' : '#dc2626', marginBottom: 6 }}>
              {lastResult?.isCorrect ? 'Correct Answer!' : 'Incorrect or Missed'}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--clr-text)' }}>
              {lastResult?.isCorrect
                ? `+${lastResult.pointsAwarded} points awarded in ${fmtMs(lastResult.responseTimeMs)}!`
                : 'No points awarded for this round.'}
            </p>
          </div>

          {/* Main Projector Screen Callout */}
          <div style={{
            background: 'var(--clr-primary-light)',
            border: '2px dashed #818cf8',
            borderRadius: 'var(--radius-lg)',
            padding: '24px 20px',
            textAlign: 'center',
            marginBottom: 20,
          }}>
            <div style={{ color: 'var(--clr-primary)', marginBottom: 10, display: 'inline-flex' }}>
              <Icons.Trophy size={38} />
            </div>
            <h3 style={{ fontSize: 18, color: 'var(--clr-primary)', fontWeight: 800, marginBottom: 6 }}>
              Live Leaderboard on Main Screen!
            </h3>
            <p style={{ fontSize: 13, color: 'var(--clr-text-2)', lineHeight: 1.5 }}>
              Look up at the main stage projector screen to see current rankings, top scorers, and fastest responses.
            </p>
          </div>

          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--clr-text-muted)', marginTop: 16 }}>
            Stay on this screen. Next round will appear automatically.
          </p>
        </div>
      </div>
    );
  }

  // ── Render: COMPLETED / PAUSED / WAITING ──────────────────────────
  return (
    <div className="page">
      <Toast toast={toast} />

      <div className="glass-card" style={{ maxWidth: 480, width: '100%', padding: 40, textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex', padding: 20,
          background: phase === PHASE.COMPLETED ? '#ecfdf5' : 'var(--clr-primary-light)',
          color: phase === PHASE.COMPLETED ? '#10b981' : 'var(--clr-primary)',
          borderRadius: '50%', marginBottom: 20,
        }}>
          {phase === PHASE.COMPLETED ? <Icons.Trophy size={44} /> : <Icons.Lock size={44} />}
        </div>

        <h2 style={{ fontSize: 24, marginBottom: 8, color: 'var(--clr-text-h)' }}>
          {phase === PHASE.COMPLETED
            ? 'Quiz Event Completed!'
            : phase === PHASE.PAUSED
            ? 'Quiz is Paused'
            : 'Quiz Arena Locked'}
        </h2>

        <p style={{ fontSize: 14, color: 'var(--clr-text)', marginBottom: 24, lineHeight: 1.6 }}>
          {phase === PHASE.COMPLETED
            ? 'Thank you for competing in the Silicon Sorcerer QR Quest. Standings are finalized!'
            : phase === PHASE.PAUSED
            ? 'The proctor has temporarily paused the quiz. Stand by.'
            : `Welcome, ${session?.fullName}! Please keep this screen open. When Round 1 begins, the question and options will appear automatically.`}
        </p>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          fontSize: 13, color: 'var(--clr-text-2)', background: 'var(--clr-surface-2)',
          padding: '10px 16px', borderRadius: 'var(--radius-md)',
        }}>
          <span className={`status-dot ${connected ? 'live' : 'paused'}`} />
          <span>{connected ? 'Live Connected to Host Server' : 'Reconnecting...'}</span>
        </div>
      </div>
    </div>
  );
}
