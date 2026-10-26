import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  API_BASE, apiFetch, getAdminToken, clearAdminToken,
  rankIcon, fmtMs, statusColor, isCorrectOption,
} from '../utils';
import { useToast, useCountdown } from '../hooks';
import {
  Toast, Spinner, StatusBadge, TimerCircle,
  BigQRModal, CheatingAlertBanner,
} from '../components';
import { Icons } from '../Icons';
import brandLogo from '../assets/logo-transparent.png';

// ── Helper to extract participant initials ──────────────────────────
const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

// ── Live Rankings & Podium Component ─────────────────────────────────
const LivePodiumShowcase = ({
  activeLeaderboardData = [],
  finalLeaderboard = [],
  roundLeaderboard = [],
  currentRound = 0,
  totalRounds = 0,
  roundActive = false,
  onRefresh,
  onLaunchProjector,
  isProjector = false,
}) => {
  const isFinal = finalLeaderboard && finalLeaderboard.length > 0;
  const topThree = activeLeaderboardData.slice(0, 3);
  const runnerUps = activeLeaderboardData.slice(3, 10);

  return (
    <div className="podium-showcase-card">
      {/* Header Bar */}
      <div className="podium-showcase-header">
        <div className="podium-header-title">
          <div className="podium-title-icon">
            <Icons.Trophy size={24} color="#b45309" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: isProjector ? 24 : 20, fontWeight: 800, margin: 0, color: 'var(--clr-text-h)' }}>
                {isFinal ? '🏆 Championship Podium & Final Winners' : 'Live Rankings & Stage Podium'}
              </h2>
              {roundActive ? (
                <span className="badge badge-success" style={{ fontSize: isProjector ? 13 : 11, padding: '4px 10px' }}>
                  <span className="status-dot live" style={{ width: 6, height: 6, display: 'inline-block', marginRight: 4 }} />
                  Round {currentRound} Live
                </span>
              ) : (
                <span className="badge badge-purple" style={{ fontSize: isProjector ? 13 : 11, padding: '4px 10px' }}>
                  <Icons.Flame size={13} color="#a855f7" />
                  {activeLeaderboardData.length > 0 ? `${activeLeaderboardData.length} Contenders Ranked` : 'Waiting for Submissions'}
                </span>
              )}
            </div>
            <p style={{ fontSize: isProjector ? 14 : 12, color: 'var(--clr-text)', margin: '3px 0 0 0' }}>
              {isFinal
                ? 'Official tournament champions crowned by total points & response speed'
                : `Live standings after Round ${currentRound} of ${totalRounds}`}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {onRefresh && (
            <button className="btn btn-secondary btn-sm" onClick={onRefresh} title="Refresh live standings">
              <Icons.Refresh size={14} /> <span>Refresh</span>
            </button>
          )}
          {!isProjector && onLaunchProjector && (
            <button className="btn btn-primary btn-sm" onClick={onLaunchProjector} title="Launch Fullscreen Projector Arena">
              <Icons.Maximize size={14} /> <span>Projector Arena</span>
            </button>
          )}
        </div>
      </div>

      {/* Podium Stage */}
      {topThree.length === 0 ? (
        <div className="podium-empty-box">
          <div style={{ color: 'var(--clr-primary)', marginBottom: 10, display: 'flex', justifyContent: 'center' }}>
            <Icons.Trophy size={40} />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
            Live Podium Ready & Awaiting Submissions
          </h3>
          <p style={{ fontSize: 13, color: 'var(--clr-text)', maxWidth: 440, margin: '0 auto' }}>
            As soon as participants submit answers in active rounds, the gold crown, silver and bronze medals will illuminate right here in real time!
          </p>
        </div>
      ) : (
        <div className="podium-stage-wrapper">
          <div className="podium-container">
            {/* Rank 2 (Silver) - Visual Left */}
            {topThree[1] && (
              <div className="podium-column rank-2">
                <div className="podium-card">
                  <div className="podium-top-icon" title="2nd Place Silver Medal">
                    <Icons.Medal size={28} color="#64748b" />
                  </div>
                  <div className="podium-avatar">
                    {getInitials(topThree[1].fullName)}
                    <span className="podium-rank-tag">2</span>
                  </div>
                  <div className="podium-name" title={topThree[1].fullName}>
                    {topThree[1].fullName}
                  </div>
                  <div className="podium-course" title={topThree[1].course}>
                    {topThree[1].course || 'Participant'}
                  </div>
                  <div className="podium-stats-group">
                    <span className="podium-score-pill">
                      <Icons.Zap size={13} color="#475569" />
                      {topThree[1].totalScore ?? topThree[1].pointsAwarded ?? 0} pts
                    </span>
                    <span className="podium-speed-pill" title="Response speed">
                      <Icons.Clock size={11} />
                      {fmtMs(topThree[1].totalResponseTimeMs ?? topThree[1].responseTimeMs ?? 0)}
                    </span>
                  </div>
                </div>
                <div className="podium-pedestal">
                  <span className="podium-pedestal-num">2</span>
                </div>
              </div>
            )}

            {/* Rank 1 (Gold) - Visual Center Elevated */}
            {topThree[0] && (
              <div className="podium-column rank-1">
                <div className="podium-card">
                  <div className="podium-top-icon" title="1st Place Champion Crown">
                    <Icons.Crown size={36} color="#d97706" />
                  </div>
                  <div className="podium-avatar">
                    {getInitials(topThree[0].fullName)}
                    <span className="podium-rank-tag">1</span>
                  </div>
                  <div className="podium-name" title={topThree[0].fullName}>
                    {topThree[0].fullName}
                  </div>
                  <div className="podium-course" title={topThree[0].course}>
                    {topThree[0].course || 'Participant'}
                  </div>
                  <div className="podium-stats-group">
                    <span className="podium-score-pill">
                      <Icons.Trophy size={14} color="#92400e" />
                      {topThree[0].totalScore ?? topThree[0].pointsAwarded ?? 0} pts
                    </span>
                    <span className="podium-speed-pill" title="Fastest response speed">
                      <Icons.Flame size={12} color="#f59e0b" />
                      {fmtMs(topThree[0].totalResponseTimeMs ?? topThree[0].responseTimeMs ?? 0)}
                    </span>
                  </div>
                </div>
                <div className="podium-pedestal">
                  <span className="podium-pedestal-num">1</span>
                </div>
              </div>
            )}

            {/* Rank 3 (Bronze) - Visual Right */}
            {topThree[2] && (
              <div className="podium-column rank-3">
                <div className="podium-card">
                  <div className="podium-top-icon" title="3rd Place Bronze Award">
                    <Icons.Award size={26} color="#b45309" />
                  </div>
                  <div className="podium-avatar">
                    {getInitials(topThree[2].fullName)}
                    <span className="podium-rank-tag">3</span>
                  </div>
                  <div className="podium-name" title={topThree[2].fullName}>
                    {topThree[2].fullName}
                  </div>
                  <div className="podium-course" title={topThree[2].course}>
                    {topThree[2].course || 'Participant'}
                  </div>
                  <div className="podium-stats-group">
                    <span className="podium-score-pill">
                      <Icons.Zap size={13} color="#9a3412" />
                      {topThree[2].totalScore ?? topThree[2].pointsAwarded ?? 0} pts
                    </span>
                    <span className="podium-speed-pill" title="Response speed">
                      <Icons.Clock size={11} />
                      {fmtMs(topThree[2].totalResponseTimeMs ?? topThree[2].responseTimeMs ?? 0)}
                    </span>
                  </div>
                </div>
                <div className="podium-pedestal">
                  <span className="podium-pedestal-num">3</span>
                </div>
              </div>
            )}
          </div>

          {/* Runners-up quick strip (Ranks 4-10) */}
          {runnerUps.length > 0 && (
            <div className="podium-runners-strip">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--clr-text-muted)', flexShrink: 0 }}>
                <Icons.Flame size={14} color="#f59e0b" />
                <span>Top Contenders (4–{3 + runnerUps.length}):</span>
              </div>
              {runnerUps.map((runner) => (
                <div key={runner.participantId} className="podium-runner-badge" title={`${runner.fullName} (${runner.course || 'Participant'})`}>
                  <strong style={{ color: 'var(--clr-primary)' }}>#{runner.rank}</strong>
                  <span>{runner.fullName}</span>
                  <span style={{ color: 'var(--clr-text-muted)', fontSize: 11 }}>
                    ({runner.totalScore ?? runner.pointsAwarded ?? 0} pts · {fmtMs(runner.totalResponseTimeMs ?? runner.responseTimeMs ?? 0)})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { toast, showToast } = useToast();
  const socketRef = useRef(null);
  const fileInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState('control');
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  // Fullscreen Projector / Arena mode state
  const [isProjectorMode, setIsProjectorMode] = useState(false);
  const [projectorViewMode, setProjectorViewMode] = useState('auto'); // 'auto' | 'question' | 'leaderboard'

  // Game state from socket
  const [gameState, setGameState] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [stats, setStats] = useState({ totalSubmissions: 0, correctCount: 0, participantCount: 0 });
  const [roundLeaderboard, setRoundLeaderboard] = useState([]);
  const [finalLeaderboard, setFinalLeaderboard] = useState([]);

  // Correct answer reveal on round timeout / close (hold 2 seconds before leaderboard)
  const [revealedAnswer, setRevealedAnswer] = useState(null);
  const [showingAnswerReveal, setShowingAnswerReveal] = useState(false);
  const revealTimerRef = useRef(null);

  // Questions tab (Answers hidden)
  const [questions, setQuestions] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  // Participants tab
  const [participants, setParticipants] = useState([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [searchParticipant, setSearchParticipant] = useState('');

  // QR Modal
  const [qrData, setQrData] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  // Cheating alerts
  const [activeCheatAlert, setActiveCheatAlert] = useState(null);
  const [cheatAlertsHistory, setCheatAlertsHistory] = useState([]);

  // Timer countdown (20 seconds)
  const remaining = useCountdown(
    gameState?.roundTimer?.roundStatus === 'active' ? gameState?.roundTimer?.deadlineAt : null,
    null
  );

  // Current question ref to prevent stale closures
  const currentQuestionRef = useRef(null);
  useEffect(() => {
    currentQuestionRef.current = currentQuestion;
  }, [currentQuestion]);

  // ── Auth guard & initial load ────────────────────────────────────
  useEffect(() => {
    const token = getAdminToken();
    if (!token) {
      navigate('/admin/login', { replace: true });
      return;
    }

    Promise.all([
      apiFetch('/api/events/current'),
      apiFetch('/api/questions'),
      apiFetch('/api/events/qr'),
    ])
      .then(([evData, qData, qrResp]) => {
        if (evData.success) {
          setEvent(evData.event);
          setStats((prev) => ({ ...prev, participantCount: evData.event.participantCount || 0 }));
        }
        if (qData.success) setQuestions(qData.questions || []);
        if (qrResp.success) setQrData(qrResp);
      })
      .catch(() => showToast('Failed to load initial event data', 'error'))
      .finally(() => setLoading(false));
  }, [navigate, showToast]);

  // ── Load full participants list ──────────────────────────────────
  const fetchParticipants = useCallback(async () => {
    setLoadingParticipants(true);
    try {
      const res = await apiFetch('/api/participants');
      if (res.success) {
        setParticipants(res.participants || []);
      }
    } catch {
      showToast('Could not load participants', 'error');
    } finally {
      setLoadingParticipants(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (activeTab === 'participants') {
      fetchParticipants();
    }
  }, [activeTab, fetchParticipants]);

  // ── Socket.IO Connection ─────────────────────────────────────────
  useEffect(() => {
    const token = getAdminToken();
    if (!token) return;

    const socket = io(API_BASE, {
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('admin:join', { token });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('game:state', (st) => {
      setGameState(st);
      setStats((prev) => ({ ...prev, participantCount: st.participantCount }));
    });

    socket.on('question:admin', (q) => {
      if (revealTimerRef.current) {
        clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
      }
      setRevealedAnswer(null);
      setShowingAnswerReveal(false);
      setCurrentQuestion(q);
      setSubmissions([]);
      setRoundLeaderboard([]);
      setProjectorViewMode('question'); // Switch projector to question view
      setStats((prev) => ({ ...prev, totalSubmissions: 0, correctCount: 0 }));
      showToast(`Round ${q.roundNumber} is now LIVE (20s)!`, 'info');
    });

    socket.on('submission:new', (sub) => {
      setSubmissions((prev) => [sub, ...prev]);
      setStats((prev) => ({
        ...prev,
        totalSubmissions: sub.totalSubmissions,
        correctCount: sub.correctCount,
      }));
    });

    const triggerAnswerReveal = (correctAnswer) => {
      if (!correctAnswer) return;
      setRevealedAnswer(correctAnswer);
      setShowingAnswerReveal(true);
      setProjectorViewMode('question'); // Keep question view active on LED panel

      if (revealTimerRef.current) {
        clearTimeout(revealTimerRef.current);
      }

      // Display correct answer highlighted in green for 2 seconds, then transition to leaderboard!
      revealTimerRef.current = setTimeout(() => {
        setShowingAnswerReveal(false);
        revealTimerRef.current = null;
        setProjectorViewMode('leaderboard');
      }, 2000);
    };

    socket.on('round:closed', ({ roundNumber }) => {
      showToast(`Round ${roundNumber} time is up! Round closed.`, 'info');
    });

    socket.on('question:answer_reveal', ({ correctAnswer }) => {
      triggerAnswerReveal(correctAnswer);
    });

    socket.on('leaderboard:round', ({ roundNumber, leaderboard }) => {
      setRoundLeaderboard(leaderboard);
      // If we are currently holding the 2-second answer reveal, let the reveal timer transition
      if (!revealTimerRef.current) {
        setProjectorViewMode('leaderboard');
      }
      showToast(`Round ${roundNumber} leaderboard updated!`, 'success');
    });

    socket.on('leaderboard:final', ({ leaderboard }) => {
      setFinalLeaderboard(leaderboard);
      setProjectorViewMode('leaderboard');
      showToast('Final Leaderboard generated!', 'success');
    });

    socket.on('participant:joined', ({ fullName, participantCount }) => {
      setStats((prev) => ({ ...prev, participantCount }));
      showToast(`New student joined: ${fullName}`, 'info');
      if (activeTab === 'participants') {
        fetchParticipants();
      }
    });

    socket.on('admin:cheating_alert', (alert) => {
      setActiveCheatAlert(alert);
      setCheatAlertsHistory((prev) => [alert, ...prev]);
      showToast(`CHEATING ALERT: ${alert.fullName} switched tabs!`, 'error');
      fetchParticipants();
    });

    socket.on('error', (err) => {
      showToast(err.message || 'Socket error', 'error');
    });

    socket.on('game:reset', () => {
      if (revealTimerRef.current) {
        clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
      }
      setRevealedAnswer(null);
      setShowingAnswerReveal(false);
      setCurrentQuestion(null);
      setSubmissions([]);
      setRoundLeaderboard([]);
      setFinalLeaderboard([]);
      setQuestions([]);
      setGameState(null);
      showToast('Event has been reset', 'warning');
      apiFetch('/api/events/current').then((d) => { if (d.success) setEvent(d.event); });
    });

    return () => {
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
      socket.disconnect();
    };
  }, [activeTab, fetchParticipants, showToast]);

  // ── Admin socket actions ─────────────────────────────────────────
  const emit = useCallback((ev) => {
    if (socketRef.current?.connected) socketRef.current.emit(ev);
    else showToast('Not connected to server', 'error');
  }, [showToast]);

  const startQuiz = () => {
    emit('admin:start_quiz');
    setIsProjectorMode(true);
  };
  const nextQuestion = () => emit('admin:next_question');
  const pauseGame = () => emit('admin:pause');
  const resumeGame = () => emit('admin:resume');
  const closeRound = () => emit('admin:close_round');
  const endGame = () => { if (confirm('End the game for all participants?')) emit('admin:end_game'); };
  const getLeaderboard = () => emit('admin:get_leaderboard');

  const resetEvent = async () => {
    if (!confirm('This will delete all questions, submissions and participants. Continue?')) return;
    const d = await apiFetch('/api/events/reset', { method: 'POST' });
    if (d.success) showToast('Event reset successfully', 'success');
    else showToast(d.message || 'Reset failed', 'error');
  };

  // ── Open Big QR ──────────────────────────────────────────────────
  const openBigQR = async () => {
    setQrLoading(true);
    try {
      const d = await apiFetch('/api/events/qr');
      if (d.success) {
        setQrData(d);
        setIsQrModalOpen(true);
      } else {
        showToast('Could not generate QR', 'error');
      }
    } catch {
      showToast('QR generation failed', 'error');
    } finally {
      setQrLoading(false);
    }
  };

  // ── Projector Mode Fullscreen Toggle ─────────────────────────────
  const toggleProjectorMode = () => {
    const next = !isProjectorMode;
    setIsProjectorMode(next);
    if (next) {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => { });
      }
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => { });
      }
    }
  };

  // ── Questions upload ─────────────────────────────────────────────
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadResult(null);
    const form = new FormData();
    form.append('file', file);
    try {
      const token = getAdminToken();
      const res = await fetch(`${API_BASE}/api/questions/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const d = await res.json();
      if (d.success) {
        showToast(d.message || 'Questions uploaded!', 'success');
        setUploadResult(d);
        apiFetch('/api/questions').then((q) => { if (q.success) setQuestions(q.questions || []); });
        apiFetch('/api/events/current').then((ev) => { if (ev.success) setEvent(ev.event); });
      } else {
        showToast(d.message || 'Upload failed', 'error');
        setUploadResult({ errors: d.errors || [d.message] });
      }
    } catch {
      showToast('File upload failed', 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleLogout = () => {
    clearAdminToken();
    navigate('/admin/login', { replace: true });
  };

  if (loading) {
    return (
      <div className="page">
        <Spinner />
      </div>
    );
  }

  const isLive = gameState?.status === 'live' || event?.status === 'live';
  const isPaused = gameState?.status === 'paused' || event?.status === 'paused';
  const isCompleted = gameState?.status === 'completed' || event?.status === 'completed';
  const roundActive = gameState?.roundTimer?.roundStatus === 'active';
  const currentRound = gameState?.currentRoundNumber ?? event?.currentRoundNumber ?? 0;
  const totalRounds = gameState?.totalRounds ?? event?.totalRounds ?? questions.length;
  const currentStatus = gameState?.status || event?.status || 'draft';

  // Filtered participants
  const filteredParticipants = participants.filter((p) => {
    const q = searchParticipant.toLowerCase();
    return p.fullName?.toLowerCase().includes(q) || p.course?.toLowerCase().includes(q) || p.participantId?.toLowerCase().includes(q);
  });

  const activeLeaderboardData = finalLeaderboard.length > 0 ? finalLeaderboard : roundLeaderboard;


  // ═════════════════════════════════════════════════════════════════
  // FULLSCREEN PROJECTOR / ARENA VIEW ("Quiz Control Flow niche aa jaye")
  // ═════════════════════════════════════════════════════════════════
  if (isProjectorMode) {
    const showQuestionView = (projectorViewMode === 'question' || (projectorViewMode === 'auto' && roundActive) || showingAnswerReveal) && currentQuestion;
    const letters = ['A', 'B', 'C', 'D'];

    return (
      <div className="projector-mode">
        <Toast toast={toast} />

        {/* Top Minimal Bar */}
        <div className="projector-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="badge badge-primary" style={{ fontSize: 13, padding: '5px 12px', fontWeight: 700 }}>
              <Icons.QrCode size={14} /> Silicon Sorcerer Projector
            </span>
            <span className="badge badge-neutral" style={{ fontSize: 13, padding: '5px 12px', fontWeight: 600 }}>
              Round {currentRound} of {totalRounds}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="badge badge-success" style={{ fontSize: 13, padding: '5px 12px', fontWeight: 700 }}>
              <Icons.Users size={14} /> {stats.participantCount} Students Live
            </span>
            <button
              className="btn btn-secondary btn-sm"
              style={{ fontSize: 13, padding: '5px 12px' }}
              onClick={() => setProjectorViewMode(showQuestionView ? 'leaderboard' : 'question')}
            >
              {showQuestionView ? <Icons.Trophy size={14} /> : <Icons.HelpCircle size={14} />}
              <span>{showQuestionView ? 'Show Leaderboard' : 'Show Question'}</span>
            </button>
            <button className="btn btn-secondary btn-sm" style={{ fontSize: 13, padding: '5px 12px' }} onClick={toggleProjectorMode} title="Exit Fullscreen Projector">
              <Icons.XCircle size={14} />
              <span>Exit Projector</span>
            </button>
          </div>
        </div>

        {/* Center Stage Display (Question OR Leaderboard) */}
        <div className="projector-stage">
          {showQuestionView ? (
            /* ── BIG QUESTION VIEW ── */
            <div className="projector-question-card">
              {!roundActive && showingAnswerReveal && revealedAnswer && (
                <div className="projector-reveal-banner">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Icons.CheckCircle size={26} color="#ffffff" />
                    <span style={{ fontSize: 20, fontWeight: 900, letterSpacing: '0.04em' }}>
                      CORRECT ANSWER REVEALED
                    </span>
                  </div>
                  <div className="projector-reveal-countdown">
                    <span>Showing Leaderboard in 2s...</span>
                    <div className="reveal-progress-bar" />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <span className="badge badge-primary" style={{ fontSize: 13, padding: '5px 12px', fontWeight: 700 }}>
                    Round {currentQuestion.roundNumber} of {totalRounds}
                  </span>
                  {currentQuestion.category && (
                    <span className="badge badge-purple" style={{ fontSize: 13, padding: '5px 12px', fontWeight: 600 }}>
                      {currentQuestion.category}
                    </span>
                  )}
                </div>

                {roundActive && (
                  <TimerCircle
                    remainingMs={remaining}
                    totalMs={(currentQuestion.timeLimitSeconds || 20) * 1000}
                    large={true}
                  />
                )}
                {!roundActive && showingAnswerReveal && (
                  <span className="badge badge-success" style={{ fontSize: 14, padding: '5px 12px', fontWeight: 700 }}>
                    ⏱ Time is up!
                  </span>
                )}
              </div>

              {/* Large Question Title */}
              <h2 className="projector-question-text">
                {currentQuestion.questionText}
              </h2>

              {/* 4 Big Options Grid */}
              {Array.isArray(currentQuestion.options) && currentQuestion.options.length > 0 && (
                <div className="projector-options-grid">
                  {currentQuestion.options.map((opt, i) => {
                    // CRITICAL: NEVER highlight while round is active! Only after roundActive === false AND showingAnswerReveal === true
                    const isHighlight = !roundActive && showingAnswerReveal && Boolean(revealedAnswer) && isCorrectOption(opt, i, revealedAnswer);
                    const isDimmed = !roundActive && showingAnswerReveal && Boolean(revealedAnswer) && !isHighlight;

                    return (
                      <div
                        key={i}
                        className={`projector-option-box${isHighlight ? ' correct-answer-highlight' : ''}${isDimmed ? ' dimmed-option' : ''}`}
                      >
                        <span className="projector-option-letter">{letters[i]}</span>
                        <span style={{ flex: 1 }}>{opt}</span>
                        {isHighlight && (
                          <span className="correct-indicator">
                            <Icons.CheckCircle size={22} color="#ffffff" />
                            <span>CORRECT</span>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--clr-border)', paddingTop: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--clr-text-h)' }}>
                  ⏱ 20s Round Time Limit · 🏅 {currentQuestion.points || 10} Points
                </span>
                <span className="badge badge-success" style={{ fontSize: 12, padding: '4px 10px', fontWeight: 700 }}>
                  📩 {stats.totalSubmissions} Submissions Live ({stats.correctCount} Correct)
                </span>
              </div>
            </div>
          ) : (
            /* ── BIG LEADERBOARD VIEW ON MAIN SCREEN ── */
            <div className="projector-leaderboard-card">
              <LivePodiumShowcase
                activeLeaderboardData={activeLeaderboardData}
                finalLeaderboard={finalLeaderboard}
                roundLeaderboard={roundLeaderboard}
                currentRound={currentRound}
                totalRounds={totalRounds}
                roundActive={roundActive}
                onRefresh={getLeaderboard}
                isProjector={true}
              />

              {/* Rankings Table */}
              <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th style={{ width: 90 }}>Rank</th>
                      <th>Participant Name</th>
                      <th>Course / Department</th>
                      <th>Total Score</th>
                      <th>Accuracy</th>
                      <th>Response Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeLeaderboardData.map((item) => (
                      <tr key={item.participantId}>
                        <td>
                          <span style={{ fontWeight: 800, fontSize: 15, color: item.rank <= 3 ? '#4f46e5' : 'inherit' }}>
                            #{item.rank}
                          </span>
                        </td>
                        <td><strong style={{ fontSize: 15 }}>{item.fullName}</strong></td>
                        <td style={{ fontSize: 13 }}>{item.course}</td>
                        <td>
                          <span className="badge badge-success" style={{ fontSize: 13, padding: '4px 10px', fontWeight: 700 }}>
                            {item.totalScore ?? item.pointsAwarded ?? 0} pts
                          </span>
                        </td>
                        <td style={{ fontSize: 13 }}>{item.correctCount ?? (item.isCorrect ? 1 : 0)} correct</td>
                        <td style={{ fontSize: 13 }}>{fmtMs(item.totalResponseTimeMs ?? item.responseTimeMs ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── LOWER FLOATING DOCK: QUIZ CONTROL FLOW ("Quiz Control Flow niche aa jaye") ── */}
        <div className="projector-dock">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: 10, borderRight: '1px solid var(--clr-border)', whiteSpace: 'nowrap' }}>
            <span className={`status-dot ${roundActive ? 'live' : 'paused'}`} style={{ width: 8, height: 8 }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--clr-text-h)', whiteSpace: 'nowrap' }}>
              {roundActive ? `Round ${currentRound} Active` : isCompleted ? 'Completed' : `Ready for Round ${currentRound + 1}`}
            </span>
          </div>

          {(isLive || isPaused) && (
            <>
              <button
                id="dock-btn-next-question"
                className="btn btn-primary"
                style={{ fontSize: 13, padding: '6px 14px', fontWeight: 600, whiteSpace: 'nowrap' }}
                onClick={nextQuestion}
                disabled={roundActive || currentRound >= totalRounds}
              >
                <Icons.Play size={14} />
                <span>Publish Round {currentRound + 1} (20s)</span>
              </button>

              {roundActive && (
                <button id="dock-btn-close-round" className="btn btn-danger" style={{ fontSize: 13, padding: '6px 14px', fontWeight: 600, whiteSpace: 'nowrap' }} onClick={closeRound}>
                  <Icons.Square size={14} />
                  <span>Close Round</span>
                </button>
              )}

              {isLive ? (
                <button className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 13px', whiteSpace: 'nowrap' }} onClick={pauseGame}>
                  <Icons.Pause size={14} /> <span>Pause</span>
                </button>
              ) : (
                <button className="btn btn-success" style={{ fontSize: 13, padding: '6px 13px', whiteSpace: 'nowrap' }} onClick={resumeGame}>
                  <Icons.Play size={14} /> <span>Resume</span>
                </button>
              )}

              <button className="btn btn-outline-danger" style={{ fontSize: 13, padding: '6px 13px', whiteSpace: 'nowrap' }} onClick={endGame}>
                <Icons.Trophy size={14} /> <span>End Quiz</span>
              </button>
            </>
          )}

          <button className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 13px', whiteSpace: 'nowrap' }} onClick={toggleProjectorMode} title="Close Projector View">
            <Icons.XCircle size={14} /> <span>Exit</span>
          </button>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════
  // STANDARD ADMIN DASHBOARD VIEW
  // ═════════════════════════════════════════════════════════════════
  return (
    <div className="dashboard-page">
      <Toast toast={toast} />

      {/* Big QR Code Modal ("open krkr bada bada dikhao") */}
      <BigQRModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        qrData={qrData}
        participantCount={stats.participantCount}
      />

      {/* Cheating Alert Banner (Live) */}
      <CheatingAlertBanner
        alert={activeCheatAlert}
        onDismiss={() => setActiveCheatAlert(null)}
      />

      {/* Header Bar */}
      <header className="glass-card" style={{ padding: '16px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'var(--grad-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#ffffff', boxShadow: '0 4px 12px rgba(79,70,229,0.25)',
            }}>
              <Icons.Sliders size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 800 }}>Silicon Sorcerer</h1>
              <p style={{ fontSize: 13, color: 'var(--clr-text)' }}>Admin Command Center & Proctoring Portal</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <StatusBadge status={currentStatus} />

            {/* Launch Projector Fullscreen Mode */}
            <button
              id="btn-launch-projector"
              className="btn btn-primary btn-sm"
              onClick={toggleProjectorMode}
              title="Launch Big Screen Projector Mode"
            >
              <Icons.Maximize size={15} />
              <span>Projector Arena Mode</span>
            </button>

            <button
              id="btn-open-big-qr"
              className="btn btn-secondary btn-sm"
              onClick={openBigQR}
              disabled={qrLoading}
            >
              {qrLoading ? <Spinner size="sm" /> : <Icons.QrCode size={16} />}
              <span>Large QR Code</span>
            </button>

            <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
              <Icons.LogOut size={15} />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="tab-list" style={{ marginBottom: 20 }}>
        <button
          className={`tab-btn${activeTab === 'control' ? ' active' : ''}`}
          onClick={() => setActiveTab('control')}
        >
          <Icons.Sliders size={16} /> Game Control
        </button>
        <button
          className={`tab-btn${activeTab === 'questions' ? ' active' : ''}`}
          onClick={() => setActiveTab('questions')}
        >
          <Icons.FileSpreadsheet size={16} /> Questions ({questions.length})
        </button>
        <button
          className={`tab-btn${activeTab === 'leaderboard' ? ' active' : ''}`}
          onClick={() => setActiveTab('leaderboard')}
        >
          <Icons.Trophy size={16} /> Leaderboard
        </button>
        <button
          className={`tab-btn${activeTab === 'participants' ? ' active' : ''}`}
          onClick={() => setActiveTab('participants')}
        >
          <Icons.Users size={16} /> Participants ({stats.participantCount})
          {cheatAlertsHistory.length > 0 && (
            <span style={{
              background: '#ef4444', color: '#fff', fontSize: 11,
              padding: '1px 6px', borderRadius: 999, fontWeight: 700,
            }}>
              {cheatAlertsHistory.length} alerts
            </span>
          )}
        </button>
      </div>

      {/* ── TAB 1: GAME CONTROL ───────────────────────────────────── */}
      {activeTab === 'control' && (
        <div className="fade-in">
          {/* Live Rankings & Podium Showcase (Prominently at the top on admin side) */}
          <LivePodiumShowcase
            activeLeaderboardData={activeLeaderboardData}
            finalLeaderboard={finalLeaderboard}
            roundLeaderboard={roundLeaderboard}
            currentRound={currentRound}
            totalRounds={totalRounds}
            roundActive={roundActive}
            onRefresh={getLeaderboard}
            onLaunchProjector={toggleProjectorMode}
          />

          {/* Quick Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div className="glass-card" style={{ padding: '16px 20px' }}>
              <p style={{ fontSize: 12, color: 'var(--clr-text)', fontWeight: 600 }}>Active Status</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <span className={`status-dot ${currentStatus}`} />
                <h3 style={{ fontSize: 18, textTransform: 'capitalize' }}>{currentStatus}</h3>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '16px 20px' }}>
              <p style={{ fontSize: 12, color: 'var(--clr-text)', fontWeight: 600 }}>Round Progress</p>
              <h3 style={{ fontSize: 18, marginTop: 4 }}>Round {currentRound} of {totalRounds}</h3>
            </div>

            <div className="glass-card" style={{ padding: '16px 20px' }}>
              <p style={{ fontSize: 12, color: 'var(--clr-text)', fontWeight: 600 }}>Registered Participants</p>
              <h3 style={{ fontSize: 18, marginTop: 4, color: 'var(--clr-primary)' }}>{stats.participantCount} Students</h3>
            </div>

            <div className="glass-card" style={{ padding: '16px 20px' }}>
              <p style={{ fontSize: 12, color: 'var(--clr-text)', fontWeight: 600 }}>Anti-Cheat Alerts</p>
              <h3 style={{ fontSize: 18, marginTop: 4, color: cheatAlertsHistory.length > 0 ? '#ef4444' : '#10b981' }}>
                {cheatAlertsHistory.length} Flagged
              </h3>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20 }}>
            {/* Control Panel Column */}
            <div className="glass-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h3 style={{ fontSize: 16 }}>Quiz Control Flow</h3>
              <p style={{ fontSize: 13, color: 'var(--clr-text)', lineHeight: 1.5 }}>
                Launch rounds in sequence. The 20s question countdown displays automatically on all student phones and main screen.
              </p>

              {currentStatus === 'ready' && (
                <button id="btn-start-quiz" className="btn btn-primary btn-full btn-lg" onClick={startQuiz}>
                  <Icons.Play size={18} /> Start Quiz Event
                </button>
              )}

              {currentStatus === 'draft' && (
                <div style={{ padding: 12, background: 'var(--clr-warning-light)', borderRadius: 'var(--radius-md)', color: '#b45309', fontSize: 13 }}>
                  Please upload questions in the <strong>Questions tab</strong> to make quiz ready.
                </div>
              )}

              {(isLive || isPaused) && (
                <>
                  <button
                    id="btn-next-question"
                    className="btn btn-primary btn-full"
                    onClick={nextQuestion}
                    disabled={roundActive || currentRound >= totalRounds}
                  >
                    <Icons.Play size={16} /> Publish Round {currentRound + 1} (20s)
                  </button>

                  {roundActive && (
                    <button id="btn-close-round" className="btn btn-danger btn-full" onClick={closeRound}>
                      <Icons.Square size={16} /> Close Round Early
                    </button>
                  )}

                  {isLive && (
                    <button id="btn-pause" className="btn btn-secondary btn-full" onClick={pauseGame}>
                      <Icons.Pause size={16} /> Pause Quiz
                    </button>
                  )}

                  {isPaused && (
                    <button id="btn-resume" className="btn btn-success btn-full" onClick={resumeGame}>
                      <Icons.Play size={16} /> Resume Quiz
                    </button>
                  )}

                  <button id="btn-end" className="btn btn-outline-danger btn-full" onClick={endGame}>
                    <Icons.Trophy size={16} /> Finalize & End Quiz
                  </button>
                </>
              )}

              <hr style={{ border: 'none', borderTop: '1px solid var(--clr-border)', margin: '8px 0' }} />

              <button className="btn btn-primary btn-full btn-sm" onClick={toggleProjectorMode}>
                <Icons.Maximize size={15} /> Launch Projector Arena Mode
              </button>

              <button className="btn btn-secondary btn-full btn-sm" onClick={openBigQR}>
                <Icons.QrCode size={15} /> Display Big QR Code
              </button>

              <button className="btn btn-outline-danger btn-full btn-sm" onClick={resetEvent}>
                <Icons.Refresh size={14} /> Reset Event
              </button>
            </div>

            {/* Live Question & Submissions Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Current Question Display */}
              {currentQuestion ? (
                <div className="glass-card" style={{ padding: 26 }}>
                  {!roundActive && showingAnswerReveal && revealedAnswer && (
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 18px', marginBottom: 16,
                      background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                      borderRadius: 'var(--radius-md)', color: '#ffffff',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 15 }}>
                        <Icons.CheckCircle size={20} color="#ffffff" />
                        <span>CORRECT ANSWER REVEALED</span>
                      </div>
                      <span style={{ fontSize: 13, background: 'rgba(0,0,0,0.2)', padding: '3px 10px', borderRadius: 999, fontWeight: 700 }}>
                        Showing Leaderboard in 2s...
                      </span>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <span className="badge badge-primary" style={{ fontSize: 14, padding: '6px 12px', fontWeight: 700 }}>
                        Round {currentQuestion.roundNumber} of {totalRounds}
                      </span>
                      {currentQuestion.category && (
                        <span className="badge badge-purple" style={{ fontSize: 14, padding: '6px 12px' }}>
                          {currentQuestion.category}
                        </span>
                      )}
                    </div>
                    {roundActive && (
                      <span className="badge badge-success" style={{ fontSize: 14, padding: '6px 12px', fontWeight: 700 }}>
                        <Icons.Clock size={14} /> {Math.ceil(remaining / 1000)}s Remaining
                      </span>
                    )}
                    {!roundActive && showingAnswerReveal && (
                      <span className="badge badge-success" style={{ fontSize: 14, padding: '6px 12px', fontWeight: 800 }}>
                        ⏱ Time Up!
                      </span>
                    )}
                  </div>

                  <h3 style={{ fontSize: 22, color: 'var(--clr-text-h)', marginBottom: 18, fontWeight: 800, lineHeight: 1.35 }}>
                    {currentQuestion.questionText}
                  </h3>

                  {/* 4 Options preview */}
                  {Array.isArray(currentQuestion.options) && currentQuestion.options.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
                      {currentQuestion.options.map((opt, i) => {
                        // CRITICAL: NEVER highlight while round is active!
                        const isHighlight = !roundActive && showingAnswerReveal && Boolean(revealedAnswer) && isCorrectOption(opt, i, revealedAnswer);

                        return (
                          <div
                            key={i}
                            className={`admin-option-box${isHighlight ? ' correct-answer-highlight' : ''}`}
                          >
                            <strong className="admin-option-letter">{['A', 'B', 'C', 'D'][i]}:</strong>
                            <span style={{ flex: 1 }}>{opt}</span>
                            {isHighlight && (
                              <span className="badge badge-success" style={{ fontSize: 12, padding: '3px 8px', fontWeight: 800 }}>
                                ✓ Correct
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 18, fontSize: 15, fontWeight: 600, color: 'var(--clr-text)' }}>
                    <span>⏱ 20s Limit</span>
                    <span>🏅 {currentQuestion.points || 10} Points</span>
                    <span>📩 {stats.totalSubmissions} Submissions ({stats.correctCount} Correct)</span>
                  </div>
                </div>
              ) : (
                <div className="glass-card" style={{ padding: 36, textAlign: 'center' }}>
                  <div style={{ color: 'var(--clr-text-muted)', marginBottom: 10 }}>
                    <Icons.HelpCircle size={40} />
                  </div>
                  <h3 style={{ fontSize: 16, color: 'var(--clr-text-h)', marginBottom: 6 }}>
                    No Round Currently Live
                  </h3>
                  <p style={{ fontSize: 13, color: 'var(--clr-text)' }}>
                    Click "Publish Round" from the control panel to broadcast the next question to all students.
                  </p>
                </div>
              )}

              {/* Submissions Feed */}
              {submissions.length > 0 && (
                <div className="glass-card" style={{ padding: 20 }}>
                  <h3 style={{ fontSize: 15, marginBottom: 14 }}>Real-Time Submissions Feed</h3>
                  <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                    {submissions.map((s, idx) => (
                      <div key={idx} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {s.isCorrect ? <Icons.CheckCircle size={16} color="#10b981" /> : <Icons.XCircle size={16} color="#ef4444" />}
                          <div>
                            <strong>{s.fullName}</strong>
                            <span style={{ color: 'var(--clr-text-muted)', marginLeft: 8 }}>({s.course})</span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontWeight: 700, color: s.isCorrect ? '#10b981' : '#ef4444' }}>
                            {s.isCorrect ? `+${s.pointsAwarded} pts` : '0 pts'}
                          </span>
                          <span style={{ color: 'var(--clr-text-muted)', marginLeft: 8 }}>({fmtMs(s.responseTimeMs)})</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: QUESTIONS MANAGER (NO ANSWERS SHOWN) ─────────── */}
      {activeTab === 'questions' && (
        <div className="fade-in">
          <div className="glass-card" style={{ padding: 24, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
              <div>
                <h2 style={{ fontSize: 18, marginBottom: 4 }}>Questions Repository</h2>
                <p style={{ fontSize: 13, color: 'var(--clr-text)' }}>
                  Questions with 4 options are displayed automatically. All round timers are set to 20 seconds. Correct answers are kept private on the server.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <a
                  href={`${API_BASE}/api/questions/template`}
                  download
                  className="btn btn-secondary btn-sm"
                >
                  <Icons.Download size={15} /> Download 20s 4-Option Template
                </a>

                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept=".xlsx,.xls,.csv"
                  onChange={handleUpload}
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? <Spinner size="sm" /> : <Icons.Upload size={15} />}
                  <span>{uploading ? 'Importing…' : 'Upload Question Sheet'}</span>
                </button>
              </div>
            </div>

            {uploadResult && (
              <div style={{ marginTop: 16 }}>
                {uploadResult.errors?.length > 0 ? (
                  <div style={{ padding: 14, background: '#fef2f2', borderRadius: 'var(--radius-md)', color: '#dc2626', fontSize: 13 }}>
                    <strong>Upload Errors:</strong>
                    <ul style={{ paddingLeft: 18, marginTop: 6 }}>
                      {uploadResult.errors.map((err, i) => <li key={i}>{err}</li>)}
                    </ul>
                  </div>
                ) : (
                  <div style={{ padding: 12, background: '#ecfdf5', borderRadius: 'var(--radius-md)', color: '#059669', fontSize: 13 }}>
                    <Icons.Check size={14} /> {uploadResult.message || 'Questions loaded successfully!'}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="glass-card" style={{ padding: 24 }}>
            {questions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Icons.FileSpreadsheet size={44} color="var(--clr-text-muted)" />
                <h3 style={{ fontSize: 16, marginTop: 12, marginBottom: 6 }}>No Questions Uploaded Yet</h3>
                <p style={{ fontSize: 13, color: 'var(--clr-text)' }}>
                  Download the template above, fill in your questions with 4 options, and upload the Excel spreadsheet.
                </p>
              </div>
            ) : (
              <div className="table-container">
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th style={{ width: 80 }}>Round</th>
                      <th>Question</th>
                      <th>Options (A, B, C, D)</th>
                      <th style={{ width: 120 }}>Category</th>
                      <th style={{ width: 80 }}>Time</th>
                      <th style={{ width: 80 }}>Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {questions.map((q) => (
                      <tr key={q._id}>
                        <td>
                          <span className="badge badge-primary">Round {q.roundNumber}</span>
                        </td>
                        <td>
                          <strong style={{ color: 'var(--clr-text-h)' }}>{q.questionText}</strong>
                        </td>
                        <td>
                          {Array.isArray(q.options) && q.options.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
                              {q.options.map((opt, i) => (
                                <span key={i}>
                                  <strong style={{ color: 'var(--clr-primary)' }}>{['A', 'B', 'C', 'D'][i]}:</strong> {opt}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--clr-text-muted)', fontSize: 12 }}>Open Text Answer</span>
                          )}
                        </td>
                        <td>
                          <span className="badge badge-purple">{q.category || 'General'}</span>
                        </td>
                        <td>20s</td>
                        <td>{q.points || 10} pts</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 3: LEADERBOARD ────────────────────────────────────── */}
      {activeTab === 'leaderboard' && (
        <div className="fade-in">
          {/* Live Rankings & Podium Showcase (Prominently at the top on admin side) */}
          <LivePodiumShowcase
            activeLeaderboardData={activeLeaderboardData}
            finalLeaderboard={finalLeaderboard}
            roundLeaderboard={roundLeaderboard}
            currentRound={currentRound}
            totalRounds={totalRounds}
            roundActive={roundActive}
            onRefresh={getLeaderboard}
            onLaunchProjector={toggleProjectorMode}
          />

          <div className="glass-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 18 }}>Automated Live Leaderboard</h2>
                <p style={{ fontSize: 13, color: 'var(--clr-text)' }}>
                  Rankings are computed dynamically and can be presented live on the projector.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-primary btn-sm" onClick={toggleProjectorMode}>
                  <Icons.Maximize size={14} /> Fullscreen Podium
                </button>
                <button className="btn btn-secondary btn-sm" onClick={getLeaderboard}>
                  <Icons.Refresh size={14} /> Refresh Standings
                </button>
                <a
                  href={`${API_BASE}/api/leaderboard/export`}
                  className="btn btn-secondary btn-sm"
                  download
                >
                  <Icons.Download size={14} /> Export CSV
                </a>
              </div>
            </div>

            {roundLeaderboard.length === 0 && finalLeaderboard.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Icons.Trophy size={40} color="var(--clr-text-muted)" />
                <h3 style={{ fontSize: 16, marginTop: 12, marginBottom: 6 }}>No Submissions Yet</h3>
                <p style={{ fontSize: 13, color: 'var(--clr-text)' }}>
                  Once participants submit answers in active rounds, the leaderboard will populate automatically.
                </p>
              </div>
            ) : (
              <div className="table-container">
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th style={{ width: 80 }}>Rank</th>
                      <th>Participant Name</th>
                      <th>Course / Department</th>
                      <th>Total Score</th>
                      <th>Accuracy</th>
                      <th>Avg Speed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeLeaderboardData.map((item) => (
                      <tr key={item.participantId}>
                        <td>
                          <span style={{ fontWeight: 800, fontSize: 15, color: item.rank <= 3 ? '#4f46e5' : 'inherit' }}>
                            #{item.rank}
                          </span>
                        </td>
                        <td><strong>{item.fullName}</strong></td>
                        <td>{item.course}</td>
                        <td>
                          <span className="badge badge-success" style={{ fontSize: 13 }}>
                            {item.totalScore ?? item.pointsAwarded ?? 0} pts
                          </span>
                        </td>
                        <td>{item.correctCount ?? (item.isCorrect ? 1 : 0)} correct</td>
                        <td>{fmtMs(item.totalResponseTimeMs ?? item.responseTimeMs ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 4: PARTICIPANTS & PROCTORING (FULL LIST) ─────────── */}
      {activeTab === 'participants' && (
        <div className="fade-in">
          <div className="glass-card" style={{ padding: 24, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
              <div>
                <h2 style={{ fontSize: 18, marginBottom: 4 }}>Registered Participants Directory</h2>
                <p style={{ fontSize: 13, color: 'var(--clr-text)' }}>
                  Full roster of students registered via QR code, real-time connection status, and anti-cheat tracking.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ position: 'relative', width: 260 }}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Search by name, ID or course..."
                    value={searchParticipant}
                    onChange={(e) => setSearchParticipant(e.target.value)}
                    style={{ paddingLeft: 34, paddingRight: 12, height: 38, fontSize: 13 }}
                  />
                  <div style={{ position: 'absolute', left: 10, top: 10, color: 'var(--clr-text-muted)' }}>
                    <Icons.Search size={16} />
                  </div>
                </div>

                <button className="btn btn-secondary btn-sm" onClick={fetchParticipants} disabled={loadingParticipants}>
                  <Icons.Refresh size={14} /> Refresh
                </button>
              </div>
            </div>
          </div>

          <div className="glass-card" style={{ padding: 24 }}>
            {loadingParticipants ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}><Spinner /></div>
            ) : filteredParticipants.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Icons.Users size={40} color="var(--clr-text-muted)" />
                <h3 style={{ fontSize: 16, marginTop: 12, marginBottom: 6 }}>
                  {participants.length === 0 ? 'No Students Registered Yet' : 'No Participants Matched Search'}
                </h3>
                <p style={{ fontSize: 13, color: 'var(--clr-text)' }}>
                  Display the Registration QR code on screen so students can join.
                </p>
              </div>
            ) : (
              <div className="table-container">
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th style={{ width: 110 }}>Student ID</th>
                      <th>Full Name</th>
                      <th>Course / Branch</th>
                      <th>Registered At</th>
                      <th>Live Status</th>
                      <th>Anti-Cheat Warnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredParticipants.map((p) => (
                      <tr key={p.participantId}>
                        <td>
                          <span className="badge badge-neutral" style={{ fontFamily: 'monospace' }}>
                            {p.participantId}
                          </span>
                        </td>
                        <td>
                          <strong>{p.fullName}</strong>
                        </td>
                        <td>{p.course}</td>
                        <td style={{ fontSize: 12, color: 'var(--clr-text)' }}>
                          {new Date(p.registeredAt).toLocaleTimeString()}
                        </td>
                        <td>
                          <span className="badge badge-neutral">
                            <span className={`status-dot ${p.isConnected ? 'live' : 'paused'}`} />
                            {p.isConnected ? 'Online' : 'Standby'}
                          </span>
                        </td>
                        <td>
                          {p.warningCount > 0 ? (
                            <span className={`badge ${p.isDisqualified ? 'badge-danger' : 'badge-warning'}`}>
                              <Icons.ShieldAlert size={12} />
                              {p.warningCount} {p.warningCount === 1 ? 'warning' : 'warnings'}
                              {p.isDisqualified ? ' (Disqualified)' : ''}
                            </span>
                          ) : (
                            <span className="badge badge-success">
                              <Icons.CheckCircle size={12} /> Clean
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
