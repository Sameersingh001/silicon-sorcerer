import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  API_BASE, apiFetch, getAdminToken, clearAdminToken,
  rankIcon, fmtMs, statusColor, isCorrectOption, parseOptionContent,
} from '../utils';
import { useToast, useCountdown } from '../hooks';
import {
  Toast, Spinner, StatusBadge, TimerCircle,
  BigQRModal, CheatingAlertBanner,
} from '../components';
import { Icons } from '../Icons';
import * as XLSX from 'xlsx';
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
  const allRanked = activeLeaderboardData; // show everyone

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
                  Q{currentRound} Live
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
                : `Live standings after Q${currentRound} of ${totalRounds}`}
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

          {/* Full Ranked Table — all participants (Compact & Clean) */}
          {allRanked.length > 0 && (
            <div style={{
              marginTop: 12,
              borderTop: '1px solid var(--clr-border)',
              paddingTop: 10,
              paddingBottom: 0,
              width: '100%',
              boxSizing: 'border-box',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
                flexWrap: 'wrap',
                gap: 6,
              }}>
                <div style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: 'var(--clr-text-h)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}>
                  <span>{isFinal ? 'Final Standings · All Participants' : `Q${currentRound} Results · All Participants`}</span>
                  <span className="badge badge-purple" style={{ fontSize: 10.5, padding: '1px 6px' }}>
                    {allRanked.length} {allRanked.length === 1 ? 'Contender' : 'Contenders'}
                  </span>
                </div>
                <span style={{ fontSize: 11.5, color: 'var(--clr-text-muted)', fontWeight: 600 }}>
                  Ranked by Points & Speed
                </span>
              </div>

              <div style={{
                width: '100%',
                maxHeight: isProjector ? 'none' : 280,
                overflowY: isProjector ? 'visible' : 'auto',
                borderRadius: 10,
                border: '1px solid var(--clr-border)',
                background: 'var(--clr-card, #ffffff)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
                boxSizing: 'border-box',
                marginBottom: 0,
              }}>
                <table style={{
                  width: '100%',
                  minWidth: '100%',
                  borderCollapse: 'collapse',
                  fontSize: isProjector ? 14 : 12,
                  textAlign: 'left',
                }}>
                  <thead>
                    <tr style={{
                      background: 'var(--clr-card-alt, rgba(0,0,0,0.04))',
                      borderBottom: '1px solid var(--clr-border)',
                      position: 'sticky',
                      top: 0,
                      zIndex: 1,
                    }}>
                      <th style={{ padding: '7px 12px', textAlign: 'center', fontWeight: 700, color: 'var(--clr-text-muted)', width: 50 }}>#</th>
                      <th style={{ padding: '7px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--clr-text-muted)' }}>Participant</th>
                      <th style={{ padding: '7px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--clr-text-muted)', width: 95 }}>Points</th>
                      <th style={{ padding: '7px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--clr-text-muted)', width: 105 }}>Time Taken</th>
                      {!isFinal && (
                        <th style={{ padding: '7px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--clr-text-muted)', width: 95 }}>Result</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {allRanked.map((item, i) => {
                      const isTopThree = item.rank <= 3;
                      const rankBg = item.rank === 1 ? 'rgba(245, 158, 11, 0.08)' : item.rank === 2 ? 'rgba(100, 116, 139, 0.08)' : item.rank === 3 ? 'rgba(217, 119, 6, 0.06)' : (i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)');
                      const rankColor = item.rank === 1 ? '#d97706' : item.rank === 2 ? '#64748b' : item.rank === 3 ? '#b45309' : 'var(--clr-text-muted)';

                      return (
                        <tr
                          key={item.participantId}
                          style={{
                            background: rankBg,
                            borderBottom: '1px solid var(--clr-border)',
                            transition: 'background 0.15s ease',
                          }}
                        >
                          <td style={{
                            padding: '7px 12px',
                            textAlign: 'center',
                            fontWeight: 800,
                            color: rankColor,
                            fontSize: isTopThree ? 13.5 : 12,
                          }}>
                            <span style={{
                              display: 'inline-block',
                              minWidth: 24,
                              padding: '2px 6px',
                              borderRadius: 4,
                              background: isTopThree ? `${rankColor}18` : 'rgba(0,0,0,0.04)',
                            }}>
                              #{item.rank}
                            </span>
                          </td>
                          <td style={{ padding: '7px 14px' }}>
                            <div style={{ fontWeight: isTopThree ? 700 : 600, color: 'var(--clr-text-h)', fontSize: isProjector ? 14 : 12.5 }}>
                              {item.fullName}
                            </div>
                            {item.course && (
                              <div style={{ fontSize: 11, color: 'var(--clr-text-muted)', marginTop: 1 }}>
                                {item.course}
                              </div>
                            )}
                          </td>
                          <td style={{
                            padding: '7px 14px',
                            textAlign: 'center',
                            fontWeight: 800,
                            fontSize: 12.5,
                            color: (item.totalScore ?? item.pointsAwarded ?? 0) > 0
                              ? '#059669'
                              : (item.totalScore ?? item.pointsAwarded ?? 0) < 0
                              ? '#dc2626'
                              : 'var(--clr-text-muted)',
                          }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: 999,
                              background: (item.totalScore ?? item.pointsAwarded ?? 0) > 0
                                ? 'rgba(16, 185, 129, 0.12)'
                                : (item.totalScore ?? item.pointsAwarded ?? 0) < 0
                                ? 'rgba(239, 68, 68, 0.14)'
                                : 'rgba(0,0,0,0.04)',
                              color: (item.totalScore ?? item.pointsAwarded ?? 0) < 0 ? '#dc2626' : 'inherit',
                            }}>
                              {item.totalScore ?? item.pointsAwarded ?? 0} pts
                            </span>
                          </td>
                          <td style={{
                            padding: '7px 14px',
                            textAlign: 'center',
                            color: 'var(--clr-text)',
                            fontSize: 12,
                            fontWeight: 600,
                          }}>
                            {fmtMs(item.totalResponseTimeMs ?? item.responseTimeMs ?? 0)}
                          </td>
                          {!isFinal && (
                            <td style={{ padding: '7px 14px', textAlign: 'center' }}>
                              {item.isCorrect ? (
                                <span style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: 4,
                                  background: 'rgba(16, 185, 129, 0.15)',
                                  color: '#059669',
                                  fontWeight: 700,
                                  fontSize: 11.5,
                                }}>
                                  Correct
                                </span>
                              ) : (
                                <span style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: 4,
                                  background: 'rgba(239, 68, 68, 0.12)',
                                  color: '#dc2626',
                                  fontWeight: 700,
                                  fontSize: 11.5,
                                }}>
                                  {item.submittedAnswer === 'No submission' ? 'Timed Out' : 'Wrong'}
                                </span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

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

  // Selected difficulty override
  const [selectedDifficulty, setSelectedDifficulty] = useState(null);

  // Timer countdown with accurate server timestamp synchronization (no delay/desync)
  const activeDeadline = gameState?.roundTimer?.roundStatus === 'active'
    ? gameState?.roundTimer?.deadlineAt
    : (currentQuestion?.deadlineAt || null);
  const activeServerTime = currentQuestion?.serverTime || gameState?.roundTimer?.serverTime || gameState?.serverTime || null;

  const remaining = useCountdown(
    activeDeadline,
    activeServerTime
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
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 15,
      reconnectionDelay: 500,
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

    socket.on('game:paused', () => {
      showToast('Quiz paused by host', 'warning');
    });

    socket.on('game:resumed', ({ deadlineAt, serverTime } = {}) => {
      setCurrentQuestion((prev) => prev ? { ...prev, deadlineAt, serverTime } : prev);
      showToast('Quiz resumed!', 'info');
    });

    socket.on('question:admin', (q) => {
      if (revealTimerRef.current) {
        clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
      }
      setRevealedAnswer(null);
      setShowingAnswerReveal(false);
      setSelectedDifficulty(null);
      setCurrentQuestion(q);
      setSubmissions([]);
      setRoundLeaderboard([]);
      setProjectorViewMode('question'); // Switch projector to question view
      setStats((prev) => ({ ...prev, totalSubmissions: 0, correctCount: 0 }));
      if (q.switchedAtRuntime) {
        showToast(`⚡ Switched to ${q.difficulty?.toUpperCase()} question in real-time!`, 'success');
      } else {
        showToast(`Q${q.roundNumber} is now LIVE (20s)!`, 'info');
      }
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
      if (revealTimerRef.current) {
        clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
      }
      setRevealedAnswer(correctAnswer);
      setShowingAnswerReveal(true);
      setProjectorViewMode('question'); // Keep question view active on LED panel
    };

    socket.on('round:closed', ({ roundNumber }) => {
      showToast(`Q${roundNumber} time is up! Closed.`, 'info');
    });

    socket.on('question:answer_reveal', ({ correctAnswer }) => {
      triggerAnswerReveal(correctAnswer);
    });

    socket.on('question:difficulty_updated', (data) => {
      setCurrentQuestion((prev) => {
        if (!prev) return prev;
        if ((data.questionId && prev._id === data.questionId) || (data.roundNumber && prev.roundNumber === data.roundNumber)) {
          return { ...prev, difficulty: data.difficulty, points: data.points };
        }
        return prev;
      });
      setQuestions((prevList) => prevList.map((q) => {
        if ((data.questionId && q._id === data.questionId) || (data.roundNumber && q.roundNumber === data.roundNumber)) {
          return { ...q, difficulty: data.difficulty, points: data.points };
        }
        return q;
      }));
      if (data.switchedAtRuntime) {
        showToast(`⚡ Round switched to ${data.difficulty.toUpperCase()} in real-time!`, 'success');
      } else {
        showToast(`Q${data.roundNumber || 'next'} difficulty: ${data.difficulty.toUpperCase()}!`, 'info');
      }
    });

    socket.on('leaderboard:round', ({ roundNumber, leaderboard }) => {
      setRoundLeaderboard(leaderboard);
      // If we are currently holding the 2-second answer reveal, let the reveal timer transition
      if (!revealTimerRef.current) {
        setProjectorViewMode('leaderboard');
      }
      showToast(`Q${roundNumber} leaderboard updated!`, 'success');
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
  const nextQuestion = () => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('admin:next_question', { difficulty: selectedDifficulty || null });
      setSelectedDifficulty(null);
    } else {
      showToast('Not connected to server', 'error');
    }
  };
  const pauseGame = () => emit('admin:pause');
  const resumeGame = () => emit('admin:resume');
  const closeRound = () => emit('admin:close_round');
  const endGame = () => { if (confirm('End the game for all participants?')) emit('admin:end_game'); };
  const getLeaderboard = () => emit('admin:get_leaderboard');
  const revealAnswer = () => emit('admin:reveal_answer');

  const handleUpdateDifficulty = async (targetDifficulty, questionId = null, roundNum = null) => {
    setSelectedDifficulty(targetDifficulty);
    const qId = questionId || currentQuestion?._id;
    const rNum = roundNum || currentQuestion?.roundNumber || (currentRound + 1);

    if (roundActive) {
      showToast(`⚡ Switching to ${targetDifficulty.toUpperCase()} question in real-time...`, 'info');
    }

    if (socketRef.current?.connected) {
      socketRef.current.emit('admin:change_question_difficulty', {
        questionId: qId,
        roundNumber: rNum,
        difficulty: targetDifficulty,
      });
    }

    if (qId && !roundActive) {
      try {
        await apiFetch(`/api/questions/${qId}/difficulty`, {
          method: 'PATCH',
          body: JSON.stringify({ difficulty: targetDifficulty }),
        });
      } catch (err) {
        console.error('Failed to update difficulty via API:', err);
      }
    }

    if (!roundActive && currentQuestion && (!qId || currentQuestion._id === qId || currentQuestion.roundNumber === rNum)) {
      setCurrentQuestion((prev) => prev ? {
        ...prev,
        difficulty: targetDifficulty,
        points: targetDifficulty === 'introduction' ? 0 : (prev.points === 0 ? 10 : prev.points),
      } : null);
    }

    setQuestions((prevList) => prevList.map((q) => {
      if ((qId && q._id === qId) || (rNum && q.roundNumber === rNum)) {
        return {
          ...q,
          difficulty: targetDifficulty,
          points: targetDifficulty === 'introduction' ? 0 : (q.points === 0 ? 10 : q.points),
        };
      }
      return q;
    }));

    if (!roundActive) {
      showToast(`Difficulty set to ${targetDifficulty.toUpperCase()}!`, 'success');
    }
  };

  const resetEvent = async () => {
    if (!confirm('This will delete all questions, submissions and participants. Continue?')) return;
    try {
      const d = await apiFetch('/api/events/reset', { method: 'POST' });
      if (d.success) {
        showToast('Event reset successfully', 'success');
        setGameState({ status: 'draft', currentRoundNumber: 0, totalRounds: 0 });
        setEvent((prev) => prev ? { ...prev, status: 'draft', currentRoundNumber: 0, totalRounds: 0, questionCount: 0, participantCount: 0 } : null);
        setCurrentQuestion(null);
        setRevealedAnswer(null);
        setShowingAnswerReveal(false);
        setRoundLeaderboard([]);
        setFinalLeaderboard([]);
        setActiveLeaderboardData([]);
        setQuestions([]);
        setParticipants([]);
        setStats({ totalSubmissions: 0, correctCount: 0, wrongCount: 0, avgTimeMs: 0 });
        const cur = await apiFetch('/api/events/current');
        if (cur.success) setEvent(cur.event);
      } else {
        showToast(d.message || 'Reset failed', 'error');
      }
    } catch {
      showToast('Reset failed: Server error', 'error');
    }
  };

  const restartQuiz = async () => {
    if (!confirm('Restart quiz from Q1? (Uploaded questions will be kept, participant scores will reset). Continue?')) return;
    try {
      const d = await apiFetch('/api/events/restart', { method: 'POST' });
      if (d.success) {
        showToast('Quiz restarted from Q1!', 'success');
        setGameState({ status: 'ready', currentRoundNumber: 0, totalRounds: questions.length });
        setCurrentQuestion(null);
        setRevealedAnswer(null);
        setShowingAnswerReveal(false);
        setRoundLeaderboard([]);
        setFinalLeaderboard([]);
        setActiveLeaderboardData([]);
        setStats({ totalSubmissions: 0, correctCount: 0, wrongCount: 0, avgTimeMs: 0 });
        const cur = await apiFetch('/api/events/current');
        if (cur.success) setEvent(cur.event);
        const qData = await apiFetch('/api/questions');
        if (qData.success) setQuestions(qData.questions || []);
      } else {
        showToast(d.message || 'Restart failed', 'error');
      }
    } catch {
      showToast('Restart failed: Server error', 'error');
    }
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

  // ── Download Excel Template (.xlsx) ──────────────────────────────
  const handleDownloadTemplate = () => {
    try {
      setDownloadingTemplate(true);
      const sampleData = [
        {
          round_number: 1,
          difficulty: 'introduction',
          question: 'What does CPU stand for?',
          question_image: '',
          option_a: 'Central Processing Unit',
          option_b: 'Computer Personal Unit',
          option_c: 'Central Power Unit',
          option_d: 'Core Processing Unit',
          correct_answer: 'A',
          points: 0,
          time_limit_seconds: 30,
          category: 'Introduction',
        },
        {
          round_number: 2,
          difficulty: 'beginner',
          question: 'Which of the following is the official logo of the Python programming language?',
          question_image: '',
          option_a: 'https://upload.wikimedia.org/wikipedia/commons/c/c3/Python-logo-notext.svg',
          option_b: 'https://upload.wikimedia.org/wikipedia/en/3/30/Java_programming_language_logo.svg',
          option_c: 'https://upload.wikimedia.org/wikipedia/commons/6/6a/JavaScript-logo.png',
          option_d: 'https://upload.wikimedia.org/wikipedia/commons/2/27/PHP-logo.svg',
          correct_answer: 'A',
          points: 10,
          time_limit_seconds: 20,
          category: 'Programming Languages',
        },
        {
          round_number: 3,
          difficulty: 'beginner',
          question: 'Which of these is the official mascot of the Linux operating system (Tux)?',
          question_image: '',
          option_a: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg',
          option_b: 'https://upload.wikimedia.org/wikipedia/commons/3/35/Tux.svg',
          option_c: 'https://upload.wikimedia.org/wikipedia/commons/8/87/Windows_logo_-_2021.svg',
          option_d: 'https://upload.wikimedia.org/wikipedia/commons/d/d7/Android_robot.svg',
          correct_answer: 'B',
          points: 10,
          time_limit_seconds: 20,
          category: 'Operating Systems',
        },
        {
          round_number: 4,
          difficulty: 'beginner',
          question: 'Which of the following is the official logo of the React library?',
          question_image: '',
          option_a: 'https://upload.wikimedia.org/wikipedia/commons/9/95/Vue.js_Logo_2.svg',
          option_b: 'https://upload.wikimedia.org/wikipedia/commons/c/cf/Angular_full_color_logo.svg',
          option_c: 'https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg',
          option_d: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Svelte_Logo.svg',
          correct_answer: 'C',
          points: 10,
          time_limit_seconds: 20,
          category: 'Web Tech',
        },
        {
          round_number: 5,
          difficulty: 'intermediate',
          question: 'Identify the logo of the Git version control system:',
          question_image: '',
          option_a: 'https://upload.wikimedia.org/wikipedia/commons/e/e0/Git-logo.svg',
          option_b: 'https://upload.wikimedia.org/wikipedia/commons/4/4e/Docker_%28container_engine%29_logo.svg',
          option_c: 'https://upload.wikimedia.org/wikipedia/commons/3/39/Kubernetes_logo_without_workmark.svg',
          option_d: 'https://upload.wikimedia.org/wikipedia/commons/e/e9/Jenkins_logo.svg',
          correct_answer: 'A',
          points: 10,
          time_limit_seconds: 20,
          category: 'DevOps & Tools',
        },
        {
          round_number: 6,
          difficulty: 'intermediate',
          question: 'Look at the logo below. Which containerization platform does it represent?',
          question_image: 'https://upload.wikimedia.org/wikipedia/commons/4/4e/Docker_%28container_engine%29_logo.svg',
          option_a: 'Docker',
          option_b: 'Podman',
          option_c: 'VirtualBox',
          option_d: 'VMware',
          correct_answer: 'A',
          points: 15,
          time_limit_seconds: 20,
          category: 'Cloud & DevOps',
        },
        {
          round_number: 7,
          difficulty: 'intermediate',
          question: 'Which of the following is the logo of PostgreSQL (Elephant)?',
          question_image: '',
          option_a: 'https://upload.wikimedia.org/wikipedia/en/d/dd/MySQL_logo.svg',
          option_b: 'https://upload.wikimedia.org/wikipedia/commons/9/93/MongoDB_Logo.svg',
          option_c: 'https://upload.wikimedia.org/wikipedia/en/6/6b/Redis_Logo.svg',
          option_d: 'https://upload.wikimedia.org/wikipedia/commons/2/29/Postgresql_elephant.svg',
          correct_answer: 'D',
          points: 10,
          time_limit_seconds: 20,
          category: 'Databases',
        },
        {
          round_number: 8,
          difficulty: 'advanced',
          question: 'Identify the modern programming language represented by this mascot (Ferris):',
          question_image: 'https://upload.wikimedia.org/wikipedia/commons/0/0f/Original_Ferris.svg',
          option_a: 'Rust',
          option_b: 'Golang',
          option_c: 'C++',
          option_d: 'Zig',
          correct_answer: 'A',
          points: 15,
          time_limit_seconds: 20,
          category: 'Programming Languages',
        },
        {
          round_number: 9,
          difficulty: 'advanced',
          question: 'Which of the following is the official logo of GitHub (Octocat)?',
          question_image: '',
          option_a: 'https://upload.wikimedia.org/wikipedia/commons/e/e1/GitLab_logo.svg',
          option_b: 'https://upload.wikimedia.org/wikipedia/commons/9/91/Octicons-mark-github.svg',
          option_c: 'https://upload.wikimedia.org/wikipedia/commons/0/0e/Bitbucket-blue-logomark-only.svg',
          option_d: 'https://upload.wikimedia.org/wikipedia/commons/0/02/Stack_Overflow_logo.svg',
          correct_answer: 'B',
          points: 10,
          time_limit_seconds: 20,
          category: 'Developer Platforms',
        },
        {
          round_number: 10,
          difficulty: 'advanced',
          question: 'Which popular JavaScript runtime uses this hexagonal green logo?',
          question_image: 'https://upload.wikimedia.org/wikipedia/commons/d/d9/Node.js_logo.svg',
          option_a: 'Deno',
          option_b: 'Node.js',
          option_c: 'Bun',
          option_d: 'Electron',
          correct_answer: 'B',
          points: 10,
          time_limit_seconds: 20,
          category: 'Web Tech',
        },
        {
          round_number: 11,
          difficulty: 'advanced',
          question: 'Which of the following is the official cryptocurrency logo of Ethereum?',
          question_image: '',
          option_a: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Bitcoin.svg',
          option_b: 'https://upload.wikimedia.org/wikipedia/commons/0/05/Ethereum_logo_2014.svg',
          option_c: 'https://upload.wikimedia.org/wikipedia/commons/e/e9/Solana_logo.svg',
          option_d: 'https://upload.wikimedia.org/wikipedia/en/d/d0/Dogecoin_Logo.png',
          correct_answer: 'B',
          points: 15,
          time_limit_seconds: 20,
          category: 'Blockchain & Web3',
        },
      ];

      const ws = XLSX.utils.json_to_sheet(sampleData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Questions');
      XLSX.writeFile(wb, 'sample-questions.xlsx');
      showToast('Excel Template downloaded (.xlsx)!', 'success');
    } catch (err) {
      console.error('Download error:', err);
      // Fallback: direct download link
      const link = document.createElement('a');
      link.href = '/sample-questions.xlsx';
      link.setAttribute('download', 'sample-questions.xlsx');
      document.body.appendChild(link);
      link.click();
      setTimeout(() => link.parentNode?.removeChild(link), 100);
      showToast('Downloaded sample-questions.xlsx', 'success');
    } finally {
      setDownloadingTemplate(false);
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

  // ── Active Difficulty detection for current / upcoming round ───────
  const activeDifficulty = selectedDifficulty || currentQuestion?.difficulty ||
    questions.find((q) => q.roundNumber === currentRound)?.difficulty ||
    questions.find((q) => q.roundNumber === (currentRound + 1))?.difficulty ||
    'beginner';

  // ── Difficulty badge color helper (Clean names, NO emojis) ─────────
  const difficultyBadge = (difficulty, large = false) => {
    const map = {
      introduction: { cls: 'badge-neutral', label: 'Introduction', color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)', border: 'rgba(100, 116, 139, 0.3)' },
      beginner:     { cls: 'badge-success', label: 'Beginner',     color: '#059669', bg: 'rgba(16, 185, 129, 0.12)',  border: 'rgba(16, 185, 129, 0.3)' },
      intermediate: { cls: 'badge-primary', label: 'Intermediate', color: '#4f46e5', bg: 'rgba(79, 70, 229, 0.12)',   border: 'rgba(99, 102, 241, 0.3)' },
      advanced:     { cls: 'badge-warning', label: 'Advanced',     color: '#d97706', bg: 'rgba(245, 158, 11, 0.12)',  border: 'rgba(245, 158, 11, 0.3)' },
    };
    const d = map[difficulty] || map['beginner'];
    return (
      <span
        className={`badge ${d.cls}`}
        style={{
          fontSize: large ? 13 : 11.5,
          padding: large ? '5px 12px' : '3px 9px',
          fontWeight: 700,
          background: d.bg,
          border: `1px solid ${d.border}`,
          color: d.color,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          letterSpacing: '0.02em',
          borderRadius: 999,
          boxShadow: large ? `0 2px 10px ${d.color}25` : 'none',
        }}
      >
        {d.label}
      </span>
    );
  };

  // ── Difficulty Level Switcher Button Group (Interactive, NO emojis, Perfect Fit) ──
  const renderDifficultySwitcher = (mode = 'sidebar') => {
    const isProjector = mode === 'projector' || mode === 'normal';
    const levels = [
      {
        key: 'introduction',
        name: 'Intro',
        color: '#64748b',
        border: '#94a3b8',
        bg: 'rgba(100, 116, 139, 0.12)',
        projBg: 'rgba(100, 116, 139, 0.35)',
        projBorder: 'rgba(148, 163, 184, 0.6)',
      },
      {
        key: 'beginner',
        name: 'Beginner',
        color: '#059669',
        border: '#10b981',
        bg: 'rgba(16, 185, 129, 0.12)',
        projBg: 'rgba(16, 185, 129, 0.35)',
        projBorder: 'rgba(16, 185, 129, 0.6)',
      },
      {
        key: 'intermediate',
        name: 'Intermediate',
        color: '#4f46e5',
        border: '#6366f1',
        bg: 'rgba(79, 70, 229, 0.12)',
        projBg: 'rgba(79, 70, 229, 0.35)',
        projBorder: 'rgba(99, 102, 241, 0.6)',
      },
      {
        key: 'advanced',
        name: 'Advanced',
        color: '#d97706',
        border: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.14)',
        projBg: 'rgba(245, 158, 11, 0.35)',
        projBorder: 'rgba(245, 158, 11, 0.6)',
      },
    ];

    if (!isProjector) {
      // ── Sidebar Grid Mode: 2x2 grid that fits 100% inside card without overflowing ──
      return (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 6,
          width: '100%',
          boxSizing: 'border-box',
        }}>
          {levels.map((lvl) => {
            const isSelected = activeDifficulty === lvl.key;
            return (
              <button
                key={lvl.key}
                type="button"
                onClick={() => handleUpdateDifficulty(lvl.key)}
                title={`Select ${lvl.name}`}
                style={{
                  background: isSelected ? lvl.bg : 'var(--clr-card, #ffffff)',
                  border: isSelected ? `2px solid ${lvl.border}` : '1px solid var(--clr-border, #e2e8f0)',
                  color: isSelected ? lvl.color : 'var(--clr-text-2, #475569)',
                  borderRadius: 8,
                  padding: '7px 8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  transition: 'all 0.18s ease',
                  boxShadow: isSelected ? `0 2px 6px ${lvl.color}25` : 'none',
                  outline: 'none',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <span style={{ fontSize: 12, fontWeight: isSelected ? 800 : 600 }}>
                  {lvl.name}
                </span>
              </button>
            );
          })}
        </div>
      );
    }

    // ── Projector Floating Dock Mode: Horizontal Capsule without emojis ──
    return (
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: 'rgba(0, 0, 0, 0.45)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: 999,
        padding: '3px 4px',
        gap: 3,
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)',
      }}>
        {levels.map((lvl) => {
          const isSelected = activeDifficulty === lvl.key;
          return (
            <button
              key={lvl.key}
              type="button"
              onClick={() => handleUpdateDifficulty(lvl.key)}
              title={`Switch level to ${lvl.name}`}
              style={{
                background: isSelected ? lvl.projBg : 'transparent',
                border: isSelected ? `1.5px solid ${lvl.projBorder}` : '1.5px solid transparent',
                color: isSelected ? '#ffffff' : '#94a3b8',
                borderRadius: 999,
                padding: '5px 12px',
                fontSize: 12,
                fontWeight: isSelected ? 800 : 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                transition: 'all 0.18s ease',
                whiteSpace: 'nowrap',
                boxShadow: isSelected ? `0 2px 10px ${lvl.color}40` : 'none',
              }}
            >
              <span>{lvl.name}</span>
            </button>
          );
        })}
      </div>
    );
  };

  // ── Clean question text helper (strips welcome prompt from question body) ─
  const cleanQuestionText = (text) => {
    if (!text) return '';
    return String(text)
      .replace(/^Welcome!?\s*This is an Introduction round with NO scoring\.?\s*/i, '')
      .replace(/^Welcome to [^!.]+!\s*This is an introduction round with no points\.?\s*/i, '')
      .trim();
  };

  // ── Introduction Round Top Announcement Banner (Sleek Black Container) ──
  const renderIntroBanner = (isProjector = false) => (
    <div style={{
      background: '#000000',
      border: '1.5px solid rgba(255, 255, 255, 0.22)',
      borderRadius: 14,
      padding: isProjector ? '14px 22px' : '10px 16px',
      marginBottom: isProjector ? 18 : 14,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div>
          <div style={{ fontSize: isProjector ? 18 : 15, fontWeight: 900, color: '#ffffff', letterSpacing: '0.02em' }}>
            Welcome! This is an Introduction round with NO scoring.
          </div>
          <div style={{ fontSize: isProjector ? 13 : 11.5, color: '#94a3b8', marginTop: 3 }}>
            Practice / Warmup round for all participants • 0 pts • Does not affect leaderboard rankings
          </div>
        </div>
      </div>
      <span style={{
        background: 'rgba(255, 255, 255, 0.12)',
        border: '1px solid rgba(255, 255, 255, 0.25)',
        color: '#ffffff',
        borderRadius: 999,
        padding: isProjector ? '6px 14px' : '4px 10px',
        fontSize: isProjector ? 12.5 : 11,
        fontWeight: 800,
        whiteSpace: 'nowrap',
        letterSpacing: '0.03em',
      }}>
        0 PTS · PRACTICE
      </span>
    </div>
  );

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
            {difficultyBadge(activeDifficulty, true)}
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
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#e0e7ff' }}>Official Answer Displayed</span>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span className="badge badge-primary" style={{ fontSize: 13, padding: '5px 12px', fontWeight: 700 }}>
                    Round {currentQuestion.roundNumber} of {totalRounds}
                  </span>
                  {currentQuestion.category && (
                    <span className="badge badge-purple" style={{ fontSize: 13, padding: '5px 12px', fontWeight: 600 }}>
                      {currentQuestion.category}
                    </span>
                  )}
                  {difficultyBadge(currentQuestion.difficulty || activeDifficulty, true)}
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
                    ⏱ Round Closed
                  </span>
                )}
              </div>

              {/* Introduction Announcement Banner on Top */}
              {(currentQuestion.difficulty === 'introduction' || /welcome/i.test(currentQuestion.questionText)) && renderIntroBanner(true)}

              {/* Large Question Title */}
              <h2 className="projector-question-text">
                {cleanQuestionText(currentQuestion.questionText)}
              </h2>

              {/* Optional Question Image for Projector */}
              {currentQuestion.questionImage && (
                <div className="projector-question-image-box">
                  <img
                    src={currentQuestion.questionImage}
                    alt="Question Diagram"
                    className="projector-question-img"
                  />
                </div>
              )}

              {/* 4 Big Options Grid (Supports Images & Text) */}
              {Array.isArray(currentQuestion.options) && currentQuestion.options.length > 0 && (
                <div className="projector-options-grid">
                  {currentQuestion.options.map((opt, i) => {
                    const { text, image, hasImage } = parseOptionContent(opt);
                    // CRITICAL: NEVER highlight while round is active! Only after roundActive === false AND showingAnswerReveal === true
                    const isHighlight = !roundActive && showingAnswerReveal && Boolean(revealedAnswer) && isCorrectOption(opt, i, revealedAnswer);
                    const isDimmed = !roundActive && showingAnswerReveal && Boolean(revealedAnswer) && !isHighlight;

                    return (
                      <div
                        key={i}
                        className={`projector-option-box${hasImage ? ' has-image' : ''}${isHighlight ? ' correct-answer-highlight' : ''}${isDimmed ? ' dimmed-option' : ''}`}
                      >
                        <span className="projector-option-letter">{letters[i]}</span>
                        {hasImage && (
                          <div className="projector-option-image-wrap">
                            <img src={image} alt={`Option ${letters[i]}`} />
                          </div>
                        )}
                        {text && <span style={{ flex: 1, marginTop: hasImage ? 6 : 0, fontWeight: 700 }}>{text}</span>}
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
                  ⏱ {currentQuestion.timeLimitSeconds || 20}s Round Time Limit · {currentQuestion.difficulty === 'introduction' ? '0 Pts (Intro Practice Round)' : `${currentQuestion.points || 10} Points`}
                </span>
                <span className="badge badge-success" style={{ fontSize: 12, padding: '4px 10px', fontWeight: 700 }}>
                  {stats.totalSubmissions} Submissions Live ({stats.correctCount} Correct)
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

          {/* Difficulty Level Switcher Buttons in Projector Floating Dock */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: 8, borderRight: '1px solid var(--clr-border)' }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Level:</span>
            {renderDifficultySwitcher('projector')}
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
                <span>Publish Q{currentRound + 1} (20s)</span>
              </button>

              {roundActive && (
                <button id="dock-btn-close-round" className="btn btn-danger" style={{ fontSize: 13, padding: '6px 14px', fontWeight: 600, whiteSpace: 'nowrap' }} onClick={closeRound}>
                  <Icons.Square size={14} />
                  <span>Close Round</span>
                </button>
              )}

              {/* ✅ Manual Reveal Answer Button — only visible when round is closed and we have a question */}
              {!roundActive && currentQuestion && !showingAnswerReveal && (
                <button
                  id="dock-btn-reveal-answer"
                  className="btn btn-success"
                  style={{ fontSize: 13, padding: '6px 14px', fontWeight: 700, whiteSpace: 'nowrap', background: 'linear-gradient(135deg, #059669, #10b981)', border: 'none' }}
                  onClick={revealAnswer}
                  title="Reveal the correct answer on projector screen"
                >
                  <Icons.CheckCircle size={14} />
                  <span>Reveal Answer</span>
                </button>
              )}

              {/* Show Leaderboard Button — when answer is revealed */}
              {!roundActive && currentQuestion && showingAnswerReveal && (
                <button
                  id="dock-btn-show-leaderboard"
                  className="btn btn-primary"
                  style={{ fontSize: 13, padding: '6px 14px', fontWeight: 700, whiteSpace: 'nowrap' }}
                  onClick={() => {
                    setShowingAnswerReveal(false);
                    setProjectorViewMode('leaderboard');
                  }}
                  title="Switch projector to leaderboard"
                >
                  <Icons.Trophy size={14} />
                  <span>Show Leaderboard</span>
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
                  {/* Difficulty Switcher in Control Tab Card */}
                  <div style={{
                    background: 'var(--clr-bg-subtle, #f8fafc)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--clr-border)',
                    padding: '12px',
                    marginBottom: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    width: '100%',
                    boxSizing: 'border-box',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--clr-text-h)' }}>
                        Difficulty Level
                      </span>
                      {difficultyBadge(activeDifficulty, false)}
                    </div>
                    {renderDifficultySwitcher('sidebar')}
                  </div>

                  <button
                    id="btn-next-question"
                    className="btn btn-primary btn-full"
                    onClick={nextQuestion}
                    disabled={roundActive || currentRound >= totalRounds}
                  >
                    <Icons.Play size={16} /> Publish Q{currentRound + 1} · {({ introduction: 'Intro', beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' }[activeDifficulty] || activeDifficulty)} · 20s
                  </button>

                  {roundActive && (
                    <button id="btn-close-round" className="btn btn-danger btn-full" onClick={closeRound}>
                      <Icons.Square size={16} /> Close Round Early
                    </button>
                  )}

                  {/* ✅ Manual Reveal Answer Button */}
                  {!roundActive && currentQuestion && !showingAnswerReveal && (
                    <button
                      id="btn-reveal-answer"
                      className="btn btn-full"
                      onClick={revealAnswer}
                      style={{
                        background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                        color: '#fff', fontWeight: 800, fontSize: 15,
                        border: 'none', borderRadius: 'var(--radius-md)',
                        padding: '10px 0', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', gap: 8, cursor: 'pointer',
                        boxShadow: '0 4px 14px rgba(16,185,129,0.35)',
                      }}
                    >
                      <Icons.CheckCircle size={18} /> Reveal Correct Answer
                    </button>
                  )}

                  {!roundActive && currentQuestion && showingAnswerReveal && (
                    <button
                      id="btn-show-leaderboard"
                      className="btn btn-full"
                      onClick={() => {
                        setShowingAnswerReveal(false);
                        setProjectorViewMode('leaderboard');
                      }}
                      style={{
                        background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                        color: '#fff', fontWeight: 800, fontSize: 15,
                        border: 'none', borderRadius: 'var(--radius-md)',
                        padding: '10px 0', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', gap: 8, cursor: 'pointer',
                      }}
                    >
                      <Icons.Trophy size={18} /> View Leaderboard
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

              {isCompleted && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ padding: 10, background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: 'var(--radius-md)', color: '#10b981', fontSize: 13, fontWeight: 700, textAlign: 'center' }}>
                    🏆 Quiz Concluded!
                  </div>
                  <button className="btn btn-primary btn-full btn-sm" onClick={restartQuiz}>
                    <Icons.Play size={16} /> Replay / Restart Quiz
                  </button>
                </div>
              )}

              <hr style={{ border: 'none', borderTop: '1px solid var(--clr-border)', margin: '8px 0' }} />

              <button className="btn btn-primary btn-full btn-sm" onClick={toggleProjectorMode}>
                <Icons.Maximize size={15} /> Launch Projector Arena Mode
              </button>

              <button className="btn btn-secondary btn-full btn-sm" onClick={openBigQR}>
                <Icons.QrCode size={15} /> Display Big QR Code
              </button>

              <button className="btn btn-warning btn-full btn-sm" onClick={restartQuiz}>
                <Icons.Refresh size={14} /> Restart Quiz (Keep Questions)
              </button>

              <button className="btn btn-outline-danger btn-full btn-sm" onClick={resetEvent}>
                <Icons.Trash size={14} /> Full Reset (Delete All Data)
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
                        Official Answer Displayed
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
                      {/* Difficulty badge */}
                      {difficultyBadge(currentQuestion.difficulty || activeDifficulty, false)}
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

                  {/* Introduction Announcement Banner on Top */}
                  {(currentQuestion.difficulty === 'introduction' || /welcome/i.test(currentQuestion.questionText)) && renderIntroBanner(false)}

                  <h3 style={{ fontSize: 22, color: 'var(--clr-text-h)', marginBottom: 14, fontWeight: 800, lineHeight: 1.35 }}>
                    {cleanQuestionText(currentQuestion.questionText)}
                  </h3>

                  {/* Question Image Preview in Admin Card */}
                  {currentQuestion.questionImage && (
                    <div style={{ marginBottom: 14, textAlign: 'center' }}>
                      <img
                        src={currentQuestion.questionImage}
                        alt="Question Diagram"
                        style={{ maxHeight: 160, maxWidth: '100%', borderRadius: 'var(--radius-md)', border: '1px solid var(--clr-border)' }}
                      />
                    </div>
                  )}

                  {/* 4 Options preview */}
                  {Array.isArray(currentQuestion.options) && currentQuestion.options.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
                      {currentQuestion.options.map((opt, i) => {
                        const { text, image, hasImage } = parseOptionContent(opt);
                        // CRITICAL: NEVER highlight while round is active!
                        const isHighlight = !roundActive && showingAnswerReveal && Boolean(revealedAnswer) && isCorrectOption(opt, i, revealedAnswer);

                        return (
                          <div
                            key={i}
                            className={`admin-option-box${isHighlight ? ' correct-answer-highlight' : ''}`}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10 }}
                          >
                            <strong className="admin-option-letter">{['A', 'B', 'C', 'D'][i]}:</strong>
                            {hasImage && (
                              <img
                                src={image}
                                alt={`Option ${['A', 'B', 'C', 'D'][i]}`}
                                style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 6, background: 'rgba(0,0,0,0.04)' }}
                              />
                            )}
                            <span style={{ flex: 1, wordBreak: 'break-word' }}>{text || (hasImage ? 'Image Option' : opt)}</span>
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
                    <span>{currentQuestion.points || 10} Points</span>
                    <span>{stats.totalSubmissions} Submissions ({stats.correctCount} Correct)</span>
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
                    Click "Publish Q" from the control panel to broadcast the next question to all students.
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
                  Questions with 4 options are displayed automatically. Supports images in questions and options (provide image URLs in Excel). Correct answers are kept private on the server.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  disabled={downloadingTemplate}
                  className="btn btn-secondary btn-sm"
                  title="Download pre-formatted Excel spreadsheet template with image examples"
                >
                  {downloadingTemplate ? <Spinner size="sm" /> : <Icons.Download size={15} />}
                  <span>{downloadingTemplate ? 'Downloading…' : 'Download Excel Template (.xlsx)'}</span>
                </button>

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
                      <th style={{ width: 80 }}>Q#</th>
                      <th style={{ width: 140 }}>Difficulty</th>
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
                          <span className="badge badge-primary">Q{q.roundNumber}</span>
                        </td>
                        <td>
                          <select
                            value={q.difficulty || 'beginner'}
                            onChange={(e) => handleUpdateDifficulty(e.target.value, q._id, q.roundNumber)}
                            style={{
                              background: 'rgba(255,255,255,0.06)',
                              border: '1px solid var(--clr-border)',
                              color: 'var(--clr-text-h)',
                              padding: '5px 8px',
                              borderRadius: 8,
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                              outline: 'none',
                            }}
                          >
                            <option value="introduction" style={{ background: '#1e293b', color: '#fff' }}>Introduction</option>
                            <option value="beginner" style={{ background: '#1e293b', color: '#fff' }}>Beginner</option>
                            <option value="intermediate" style={{ background: '#1e293b', color: '#fff' }}>Intermediate</option>
                            <option value="advanced" style={{ background: '#1e293b', color: '#fff' }}>Advanced</option>
                          </select>
                          {(q.difficulty === 'introduction') && (
                            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4, fontStyle: 'italic' }}>0 pts · Practice Round</div>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {q.questionImage && (
                              <img
                                src={q.questionImage}
                                alt="Question diagram"
                                style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--clr-border)', flexShrink: 0 }}
                              />
                            )}
                            <strong style={{ color: 'var(--clr-text-h)' }}>{cleanQuestionText(q.questionText)}</strong>
                          </div>
                        </td>
                        <td>
                          {Array.isArray(q.options) && q.options.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                              {q.options.map((opt, i) => {
                                const { text, image, hasImage } = parseOptionContent(opt);
                                return (
                                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <strong style={{ color: 'var(--clr-primary)' }}>{['A', 'B', 'C', 'D'][i]}:</strong>
                                    {hasImage && (
                                      <img
                                        src={image}
                                        alt="Option"
                                        style={{ width: 22, height: 22, objectFit: 'contain', borderRadius: 4 }}
                                      />
                                    )}
                                    <span>{text || (hasImage ? 'Image' : opt)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--clr-text-muted)', fontSize: 12 }}>Open Text Answer</span>
                          )}
                        </td>
                        <td>
                          <span className="badge badge-purple">{q.category || 'General'}</span>
                        </td>
                        <td>{q.timeLimitSeconds || 20}s</td>
                        <td><span style={{ fontWeight: 700, color: q.difficulty === 'introduction' ? '#6b7280' : '#10b981' }}>{q.difficulty === 'introduction' ? '0 pts' : (q.points || 10) + ' pts'}</span></td>
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
                      <th>Time Taken</th>
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
