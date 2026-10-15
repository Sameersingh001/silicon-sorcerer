import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { API_BASE, getParticipantSession, clearParticipantSession, apiFetch, fmtMs } from '../utils';
import { useToast, useCountdown } from '../hooks';
import { Toast, Spinner, TimerCircle, IPhoneFullscreenHelper, IPhoneBannerPrompt } from '../components';
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
  const arenaRef = useRef(null);

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
  const [showIosGuide, setShowIosGuide] = useState(false);

  // Anti-cheat warning state
  const [cheatWarning, setCheatWarning] = useState(null);
  const [warningCount, setWarningCount] = useState(0);

  // Check iOS device & standalone status
  const isIOS = typeof navigator !== 'undefined' && (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
  const isStandalone = typeof window !== 'undefined' && (
    window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  );

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
    });

    socket.on('question:new', (q) => {
      setQuestion(q);
      setSelectedOption(null);
      setTextAnswer('');
      setSubmitting(false);
      setPhase(PHASE.QUESTION);
      setLastResult(null);

      // Smoothly reset arena scroll without jumping window offset on Android
      arenaRef.current?.scrollTo?.({ top: 0, behavior: 'smooth' });
    });

    socket.on('round:closed', () => {
      setPhase((prev) => (prev === PHASE.QUESTION || prev === PHASE.SUBMITTED ? PHASE.ROUND_RESULT : prev));
      showToast('Time is up! Round closed.', 'warning');
    });

    socket.on('leaderboard:round', ({ roundNumber, leaderboard }) => {
      setRoundLeaderboard(leaderboard);
      const myResult = leaderboard.find((item) => item.participantId === session.participantId);
      if (myResult) {
        setLastResult((prev) => ({
          ...prev,
          isCorrect: myResult.isCorrect,
          pointsAwarded: myResult.pointsAwarded,
          responseTimeMs: myResult.responseTimeMs,
          rank: myResult.rank,
        }));
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

  // ── Instant Submit Answer (Optimistic UI + Fast Socket with HTTP Fallback) ──
  const submitAnswer = async (ansToSubmit) => {
    const finalAnswer = ansToSubmit || selectedOption || textAnswer;
    if (!finalAnswer || submitting) return;

    setSubmitting(true);

    // Haptic buzz on Android devices for immediate tactile feedback
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(35);
      }
    } catch {}

    const payload = {
      sessionToken: session.sessionToken,
      submittedAnswer: String(finalAnswer).trim(),
    };

    let handled = false;

    const handleSubmissionResponse = (data) => {
      if (handled) return;
      handled = true;
      setSubmitting(false);

      if (data && data.success) {
        setLastResult({
          isCorrect: !!data.isCorrect,
          pointsAwarded: data.pointsAwarded || 0,
          responseTimeMs: data.responseTimeMs || 0,
          submittedAnswer: String(finalAnswer).trim(),
          message: data.message,
        });
        setPhase(PHASE.SUBMITTED);
        showToast(
          data.isCorrect ? `Correct! +${data.pointsAwarded} pts!` : 'Answer locked & recorded!',
          data.isCorrect ? 'success' : 'info'
        );
      } else {
        showToast(data?.message || 'Submission rejected', 'error');
      }
    };

    // 1. Try real-time WebSocket submission first (sub-15ms round trip)
    if (socketRef.current?.connected) {
      const socketTimeout = setTimeout(() => {
        if (!handled) {
          // Fallback to HTTP POST if socket does not ack in 1200ms
          apiFetch('/api/submissions', {
            method: 'POST',
            body: JSON.stringify(payload),
          })
            .then(handleSubmissionResponse)
            .catch(() => {
              if (!handled) {
                showToast('Network error while submitting answer', 'error');
                setSubmitting(false);
              }
            });
        }
      }, 1200);

      socketRef.current.emit('participant:submit_answer', payload, (res) => {
        clearTimeout(socketTimeout);
        handleSubmissionResponse(res);
      });
    } else {
      // Direct HTTP POST if socket is disconnected
      apiFetch('/api/submissions', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
        .then(handleSubmissionResponse)
        .catch(() => {
          showToast('Network error while submitting answer', 'error');
          setSubmitting(false);
        });
    }
  };

  const handleSelectOption = (opt) => {
    if (submitting) return;
    setSelectedOption(opt);
    submitAnswer(opt);
  };

  const toggleFullscreen = () => {
    if (isIOS) {
      if (!isStandalone) {
        setShowIosGuide(true);
      }
      try { window.scrollTo(0, 1); } catch {}
      return;
    }
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      } else {
        document.exitFullscreen?.().catch(() => {});
      }
    } catch {}
  };

  // ── Render: Screen Lock Cheat Warning Overlay ────────────────────
  const renderCheatWarning = () => {
    if (!cheatWarning) return null;
    return (
      <div className="cheat-warning-overlay">
        <div style={{
          background: '#ffffff', color: '#b91c1c', padding: 18, borderRadius: '50%',
          marginBottom: 16, boxShadow: '0 0 30px rgba(0,0,0,0.4)',
        }}>
          <Icons.ShieldAlert size={44} />
        </div>
        <h2 style={{ fontSize: 'clamp(22px, 5vw, 28px)', fontWeight: 800, marginBottom: 8, color: '#fff' }}>
          Anti-Cheat Warning!
        </h2>
        <p style={{ fontSize: 15, maxWidth: 440, marginBottom: 8, lineHeight: 1.5, opacity: 0.95 }}>
          {cheatWarning.reason}
        </p>
        <p style={{ fontSize: 13, opacity: 0.85, marginBottom: 20 }}>
          This event has been logged and reported directly to the quiz proctor.
        </p>
        <div style={{
          background: 'rgba(255,255,255,0.22)',
          padding: '8px 20px',
          borderRadius: 999,
          fontWeight: 800,
          fontSize: 14,
          marginBottom: 24,
          border: '1px solid rgba(255,255,255,0.3)',
        }}>
          Warning {warningCount} of 3 {warningCount >= 3 ? '(DISQUALIFIED)' : ''}
        </div>
        <button
          className="btn btn-secondary btn-lg"
          onClick={() => {
            setCheatWarning(null);
            toggleFullscreen();
          }}
          style={{ background: '#ffffff', color: '#b91c1c', border: 'none', fontWeight: 800, borderRadius: 14 }}
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
    const isCompactScreen = typeof window !== 'undefined' && (window.innerWidth < 640 || window.innerHeight < 740);

    return (
      <div className="fullscreen-arena" ref={arenaRef}>
        <Toast toast={toast} />
        {renderCheatWarning()}
        <IPhoneFullscreenHelper isOpen={showIosGuide} onClose={() => setShowIosGuide(false)} />

        {/* Top Arena Header */}
        <div className="arena-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="badge badge-primary" style={{ fontSize: 12, padding: '5px 10px', background: 'rgba(79, 70, 229, 0.3)', border: '1px solid rgba(99, 102, 241, 0.4)' }}>
              Round {question.roundNumber} of {question.totalRounds}
            </span>
            {question.category && (
              <span className="badge badge-purple" style={{ fontSize: 11.5, padding: '5px 10px' }}>
                {question.category}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {isStandalone ? (
              <span className="badge badge-success" style={{ fontSize: 11 }}>
                <Icons.Lock size={11} /> Standalone
              </span>
            ) : isIOS ? (
              <button
                type="button"
                onClick={() => setShowIosGuide(true)}
                className="btn btn-sm"
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#38bdf8',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  padding: '5px 10px',
                  fontSize: 11.5,
                  borderRadius: 8,
                }}
              >
                <Icons.Smartphone size={13} />
                <span>iPhone Tip</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={toggleFullscreen}
                className="btn btn-sm"
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#e2e8f0',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  padding: '5px 10px',
                  fontSize: 11.5,
                  borderRadius: 8,
                }}
              >
                <Icons.Maximize size={13} />
                <span>Fullscreen</span>
              </button>
            )}
          </div>
        </div>

        {/* Arena Content Centering Wrapper (keeps UI centered without upward shifting on Android) */}
        <div className="arena-content-wrap">
          <div className="arena-card fade-in">
            {/* Animated Glowing Timer (scaled appropriately for mobile viewports) */}
            <div style={{ textAlign: 'center' }}>
              <TimerCircle
                remainingMs={remaining}
                totalMs={question.timeLimitSeconds * 1000}
                compact={isCompactScreen}
              />
            </div>

            {/* Question Text */}
            <div style={{ textAlign: 'center' }}>
              <h2 className="question-heading">
                {question.questionText}
              </h2>
            </div>

            {/* 4 Interactive Options Grid with instant tactile and visual feedback */}
            {hasOptions ? (
              <div className="options-grid">
                {question.options.map((opt, idx) => {
                  const letter = letters[idx] || `${idx + 1}`;
                  const isSelected = selectedOption === opt;
                  return (
                    <button
                      key={idx}
                      type="button"
                      className={`option-btn opt-${idx % 4}${isSelected ? ' selected' : ''}${submitting && isSelected ? ' submitting' : ''}`}
                      onClick={() => handleSelectOption(opt)}
                      disabled={submitting}
                    >
                      <span className="option-letter">{letter}</span>
                      <span style={{ flex: 1, wordBreak: 'break-word' }}>{opt}</span>
                      {submitting && isSelected ? (
                        <Spinner size="sm" />
                      ) : isSelected ? (
                        <span style={{ display: 'inline-flex', color: '#fff', marginLeft: 4 }}>
                          <Icons.Check size={18} />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              /* Fallback Text Input */
              <form onSubmit={(e) => { e.preventDefault(); submitAnswer(); }} style={{ display: 'flex', gap: 10 }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Type your answer here..."
                  value={textAnswer}
                  onChange={(e) => setTextAnswer(e.target.value)}
                  disabled={submitting}
                  autoFocus
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }}
                />
                <button type="submit" className="btn btn-primary" disabled={submitting || !textAnswer.trim()}>
                  {submitting ? <Spinner size="sm" /> : 'Submit'}
                </button>
              </form>
            )}

            {/* Arena Footer Info */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: 10, marginTop: 2,
              fontSize: 12.5, color: '#94a3b8',
            }}>
              <span>
                Player: <strong style={{ color: '#f8fafc' }}>{session?.fullName}</strong>
              </span>
              <span style={{ color: '#818cf8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Icons.Zap size={14} color="#818cf8" /> {submitting ? 'Locking answer...' : 'Tap option to lock'}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: SUBMITTED (WAITING FOR ROUND END WITH INSTANT RESULT UPDATE) ──
  if (phase === PHASE.SUBMITTED) {
    const isCorrect = lastResult?.isCorrect;
    const hasResult = lastResult !== null && lastResult !== undefined;

    return (
      <div className="page" style={{ background: '#090d16', color: '#f8fafc' }}>
        <Toast toast={toast} />
        {renderCheatWarning()}

        <div
          className="glass-card fade-in"
          style={{
            maxWidth: 450, width: '100%', padding: 'clamp(24px, 5vw, 40px)', textAlign: 'center',
            background: 'rgba(15, 23, 42, 0.92)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 24, boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
          }}
        >
          {/* Animated Status Icon */}
          <div style={{
            display: 'inline-flex', padding: 18,
            background: isCorrect ? 'rgba(16, 185, 129, 0.18)' : 'rgba(99, 102, 241, 0.18)',
            color: isCorrect ? '#10b981' : '#818cf8',
            borderRadius: '50%', marginBottom: 16,
            border: `2px solid ${isCorrect ? 'rgba(16, 185, 129, 0.35)' : 'rgba(99, 102, 241, 0.35)'}`,
            boxShadow: `0 0 28px ${isCorrect ? 'rgba(16, 185, 129, 0.35)' : 'rgba(99, 102, 241, 0.35)'}`,
          }}>
            {isCorrect ? <Icons.CheckCircle size={44} /> : <Icons.CheckCircle size={44} />}
          </div>

          <h2 style={{ fontSize: 'clamp(20px, 4.5vw, 24px)', fontWeight: 800, marginBottom: 6, color: isCorrect ? '#34d399' : '#ffffff' }}>
            {hasResult
              ? isCorrect
                ? '🎉 Correct Answer!'
                : 'Answer Locked & Recorded!'
              : 'Answer Locked & Submitted!'}
          </h2>

          <p style={{ fontSize: 14, color: isCorrect ? '#a7f3d0' : '#94a3b8', marginBottom: 18, lineHeight: 1.5, fontWeight: isCorrect ? 600 : 400 }}>
            {hasResult
              ? isCorrect
                ? `+${lastResult.pointsAwarded} points awarded in ${fmtMs(lastResult.responseTimeMs)}!`
                : `Recorded in ${fmtMs(lastResult.responseTimeMs)}. Waiting for round to close...`
              : 'Your response has been timestamped and sent to the host.'}
          </p>

          {/* Submitted Answer Recap Chip */}
          {lastResult?.submittedAnswer && (
            <div style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 14,
              padding: '12px 16px',
              marginBottom: 18,
              textAlign: 'left',
              fontSize: 13,
            }}>
              <span style={{ color: '#94a3b8', fontSize: 11.5, display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Your Locked Submission:
              </span>
              <strong style={{ color: '#f8fafc', fontSize: 14, wordBreak: 'break-word', display: 'block' }}>
                {lastResult.submittedAnswer}
              </strong>
            </div>
          )}

          {/* Live Proctored Device Reminder */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.04)', padding: '10px 14px',
            borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <Icons.Lock size={14} color="#818cf8" />
            <span style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 600 }}>
              Device proctor active • Standings will update on screen
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: ROUND RESULT ─────────────────────────────────────────
  if (phase === PHASE.ROUND_RESULT) {
    return (
      <div className="page" style={{ background: '#090d16', color: '#f8fafc' }}>
        <Toast toast={toast} />

        <div
          className="glass-card fade-in"
          style={{
            maxWidth: 480, width: '100%', padding: 'clamp(24px, 5vw, 36px)',
            background: 'rgba(15, 23, 42, 0.92)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 24, boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
          }}
        >
          {/* Result Banner */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{
              display: 'inline-flex', padding: 18,
              background: lastResult?.isCorrect ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: lastResult?.isCorrect ? '#10b981' : '#ef4444',
              borderRadius: '50%', marginBottom: 14,
              border: `2px solid ${lastResult?.isCorrect ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
              boxShadow: `0 0 25px ${lastResult?.isCorrect ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            }}>
              {lastResult?.isCorrect ? <Icons.CheckCircle size={40} /> : <Icons.XCircle size={40} />}
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: lastResult?.isCorrect ? '#34d399' : '#f87171', marginBottom: 6 }}>
              {lastResult?.isCorrect ? 'Correct Answer!' : 'Incorrect or Missed'}
            </h2>
            <p style={{ fontSize: 13.5, color: '#94a3b8' }}>
              {lastResult?.isCorrect
                ? `+${lastResult.pointsAwarded} points awarded in ${fmtMs(lastResult.responseTimeMs)}!`
                : 'No points awarded for this round.'}
            </p>
          </div>

          {/* Projector Callout Card */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.2) 0%, rgba(124, 58, 237, 0.15) 100%)',
            border: '2px dashed rgba(129, 140, 248, 0.4)',
            borderRadius: 18,
            padding: '22px 18px',
            textAlign: 'center',
            marginBottom: 16,
          }}>
            <div style={{ color: '#818cf8', marginBottom: 8, display: 'inline-flex' }}>
              <Icons.Trophy size={36} />
            </div>
            <h3 style={{ fontSize: 17, color: '#e0e7ff', fontWeight: 800, marginBottom: 6 }}>
              Live Standings on Main Stage Screen!
            </h3>
            <p style={{ fontSize: 12.5, color: '#cbd5e1', lineHeight: 1.5 }}>
              Look up at the auditorium projector to see fastest fingers, round winners, and current rankings.
            </p>
          </div>

          <p style={{ textAlign: 'center', fontSize: 12.5, color: '#64748b', marginTop: 12 }}>
            Keep this screen open. Next round will appear automatically.
          </p>
        </div>
      </div>
    );
  }

  // ── Render: COMPLETED / PAUSED / WAITING ──────────────────────────
  return (
    <div className="page" style={{ background: '#090d16', color: '#f8fafc' }}>
      <Toast toast={toast} />
      <IPhoneFullscreenHelper isOpen={showIosGuide} onClose={() => setShowIosGuide(false)} />

      <div
        className="glass-card fade-in"
        style={{
          maxWidth: 440, width: '100%', padding: 'clamp(28px, 6vw, 42px)', textAlign: 'center',
          background: 'rgba(15, 23, 42, 0.92)', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 24, boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{
          display: 'inline-flex', padding: 20,
          background: phase === PHASE.COMPLETED
            ? 'rgba(16, 185, 129, 0.15)'
            : 'rgba(99, 102, 241, 0.2)',
          color: phase === PHASE.COMPLETED ? '#10b981' : '#818cf8',
          borderRadius: '50%', marginBottom: 20,
          boxShadow: phase === PHASE.COMPLETED ? '0 0 25px rgba(16, 185, 129, 0.3)' : '0 0 25px rgba(99, 102, 241, 0.4)',
        }} className={phase === PHASE.WAITING ? 'radar-circle' : ''}>
          {phase === PHASE.COMPLETED ? <Icons.Trophy size={42} /> : <Icons.Lock size={42} />}
        </div>

        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, color: '#ffffff' }}>
          {phase === PHASE.COMPLETED
            ? 'Quiz Event Completed!'
            : phase === PHASE.PAUSED
            ? 'Quiz is Paused'
            : 'Quiz Arena Locked'}
        </h2>

        <p style={{ fontSize: 13.5, color: '#94a3b8', marginBottom: 20, lineHeight: 1.6 }}>
          {phase === PHASE.COMPLETED
            ? 'Thank you for competing in the Silicon Sorcerer QR Quest. Standings are finalized!'
            : phase === PHASE.PAUSED
            ? 'The proctor has temporarily paused the quiz. Stand by.'
            : `Welcome, ${session?.fullName}! Keep this screen open. When Round 1 begins, the question and options will appear automatically.`}
        </p>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          fontSize: 12.5, color: '#cbd5e1', background: 'rgba(255, 255, 255, 0.05)',
          padding: '10px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <span className={`status-dot ${connected ? 'live' : 'paused'}`} />
          <span>{connected ? 'Live Connected to Host Server' : 'Reconnecting...'}</span>
        </div>

        {/* iPhone Fullscreen Helper Tip */}
        {isIOS && !isStandalone && (
          <div style={{ marginTop: 14 }}>
            <IPhoneBannerPrompt onOpenGuide={() => setShowIosGuide(true)} />
          </div>
        )}
      </div>
    </div>
  );
}
