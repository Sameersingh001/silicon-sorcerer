import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, fmtMs } from '../utils';
import { Icons } from '../Icons';
import { Toast, Spinner } from '../components';
import { useToast } from '../hooks';
import brandLogo from '../assets/logo-transparent.png';

export default function ResultsPage() {
  const { toast, showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState([]);
  const [search, setSearch] = useState('');
  const [eventName, setEventName] = useState('Silicon Sorcerer — QR Quest');
  const [isCustomUploaded, setIsCustomUploaded] = useState(false);

  // Appreciative welcome celebration popup
  const [showWelcomeModal, setShowWelcomeModal] = useState(true);

  // Fetch results from public API endpoint
  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/leaderboard/public');
      if (res.success && Array.isArray(res.leaderboard)) {
        setResults(res.leaderboard);
        if (res.eventName) setEventName(res.eventName);
        if (res.isCustom) setIsCustomUploaded(true);
      } else {
        setResults([]);
      }
    } catch (err) {
      console.error('Fetch results error:', err);
      showToast('Could not load results. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  // Filtered results based on search input
  const filteredResults = results.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (r.fullName && r.fullName.toLowerCase().includes(q)) ||
      (r.participantId && r.participantId.toLowerCase().includes(q)) ||
      (r.course && r.course.toLowerCase().includes(q))
    );
  });

  const topThree = results.slice(0, 3);

  const getInitials = (name) => {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#090d16',
      backgroundImage: 'radial-gradient(circle at 50% -15%, #1e1b4b 0%, #090d16 75%)',
      color: '#f8fafc',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      paddingBottom: 60,
    }}>
      <Toast toast={toast} />

      {/* ── Scoped CSS for Perfect Responsiveness & Animations ────────── */}
      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; transform: scale(0.92) translateY(14px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 25px rgba(245, 158, 11, 0.35); }
          50% { box-shadow: 0 0 45px rgba(245, 158, 11, 0.65); }
        }
        .results-welcome-card {
          animation: modalFadeIn 0.32s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .table-scrollbar-style::-webkit-scrollbar {
          height: 8px;
        }
        .table-scrollbar-style::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.8);
          border-radius: 4px;
        }
        .table-scrollbar-style::-webkit-scrollbar-thumb {
          background: rgba(99, 102, 241, 0.45);
          border-radius: 4px;
        }
        .table-scrollbar-style::-webkit-scrollbar-thumb:hover {
          background: rgba(99, 102, 241, 0.8);
        }

        /* Mobile specific layout */
        @media (max-width: 768px) {
          .results-main-wrapper {
            padding: 16px 12px !important;
          }
          .results-header-container {
            padding: 12px 14px !important;
          }
          .podium-responsive-grid {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
          .podium-order-first {
            order: 1 !important;
          }
          .podium-order-second {
            order: 2 !important;
          }
          .podium-order-third {
            order: 3 !important;
          }
          .table-cell-custom {
            padding: 10px 10px !important;
          }
          .mobile-scroll-indicator {
            display: flex !important;
          }
        }

        /* Desktop podium layout (Olympic style: Silver left, Gold center & elevated, Bronze right) */
        @media (min-width: 769px) {
          .podium-responsive-grid {
            grid-template-columns: 1fr 1.06fr 1fr !important;
            align-items: flex-end !important;
          }
          .podium-order-first {
            order: 2 !important;
          }
          .podium-order-second {
            order: 1 !important;
          }
          .podium-order-third {
            order: 3 !important;
          }
          .mobile-scroll-indicator {
            display: none !important;
          }
        }
      `}</style>

      {/* ── Normal & Simple Welcome Message Pop-up ───────────────────── */}
      {showWelcomeModal && (
        <div
          onClick={() => setShowWelcomeModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 16,
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
              maxWidth: 400,
              width: '100%',
              padding: '26px 22px',
              textAlign: 'center',
              boxSizing: 'border-box',
            }}
          >
            {/* Simple Clean Icon */}
            <div style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'rgba(79, 70, 229, 0.15)',
              border: '1px solid rgba(79, 70, 229, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
              color: '#818cf8',
            }}>
              <Icons.Award size={26} color="#818cf8" />
            </div>

            {/* Simple Message */}
            <h3 style={{
              fontSize: 17,
              fontWeight: 800,
              color: '#ffffff',
              margin: '0 0 8px',
              lineHeight: 1.35,
            }}>
              You Did Very Best In The Participation!
            </h3>

            <p style={{
              fontSize: 14,
              color: '#94a3b8',
              lineHeight: 1.5,
              margin: '0 0 20px',
            }}>
              Thanks for your participation.
            </p>

            {/* OK Button */}
            <button
              onClick={() => setShowWelcomeModal(false)}
              style={{
                width: '100%',
                padding: '10px 16px',
                background: '#4f46e5',
                border: 'none',
                borderRadius: 10,
                color: '#ffffff',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#4338ca'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#4f46e5'}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* ── Top Header Navigation Bar (Clean Read-Only for Students) ── */}
      <header style={{
        padding: '14px 20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div
          className="results-header-container"
          style={{
            maxWidth: 1380,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          {/* Brand + Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
              <img
                src={brandLogo}
                alt="Logo"
                style={{
                  width: 'clamp(30px, 8vw, 36px)',
                  height: 'clamp(30px, 8vw, 36px)',
                  objectFit: 'contain',
                }}
              />
              <div>
                <span style={{
                  fontSize: 'clamp(14px, 3.8vw, 16px)',
                  fontWeight: 900,
                  color: '#ffffff',
                  letterSpacing: '-0.02em',
                  display: 'block',
                  lineHeight: 1.2,
                }}>
                  Silicon Sorcerer
                </span>
                <span style={{
                  fontSize: 'clamp(9.5px, 2.5vw, 11px)',
                  color: '#818cf8',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}>
                  Student Results Portal
                </span>
              </div>
            </Link>

            {isCustomUploaded && (
              <span style={{
                fontSize: 'clamp(10px, 2.5vw, 11.5px)',
                background: 'rgba(168, 85, 247, 0.2)',
                border: '1px solid rgba(168, 85, 247, 0.4)',
                color: '#d8b4fe',
                padding: '3px 8px',
                borderRadius: 20,
                fontWeight: 700,
              }}>
                Official Standings
              </span>
            )}
          </div>

          {/* Student Navigation Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={fetchResults}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#cbd5e1',
                padding: '6px 12px',
                borderRadius: 10,
                fontSize: 'clamp(11.5px, 2.8vw, 12.5px)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              title="Refresh standings"
            >
              <Icons.Refresh size={13} />
              <span>Refresh</span>
            </button>

            <Link
              to="/"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                border: 'none',
                color: '#ffffff',
                padding: '6px 13px',
                borderRadius: 10,
                fontSize: 'clamp(11.5px, 2.8vw, 12.5px)',
                fontWeight: 700,
                textDecoration: 'none',
                boxShadow: '0 3px 12px rgba(79, 70, 229, 0.3)',
              }}
            >
              <Icons.ArrowLeft size={13} />
              <span>Back Home</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Container ─────────────────────────────────────────── */}
      <main
        className="results-main-wrapper"
        style={{
          maxWidth: 1380,
          margin: '0 auto',
          padding: '24px 20px',
        }}
      >

        {/* ── Podium Cards: Top 3 Champions ─────────────────────────── */}
        {!loading && topThree.length > 0 && (
          <div
            className="podium-responsive-grid"
            style={{
              display: 'grid',
              gap: 16,
              marginBottom: 24,
            }}
          >
            {/* 2nd Place (Silver) */}
            {topThree[1] && (
              <div
                className="podium-order-second"
                style={{
                  background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  borderRadius: 18,
                  padding: 'clamp(16px, 3.5vw, 22px)',
                  textAlign: 'center',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ color: '#94a3b8', marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
                  <Icons.Medal size={28} color="#94a3b8" />
                </div>
                <div style={{
                  width: 'clamp(46px, 10vw, 54px)',
                  height: 'clamp(46px, 10vw, 54px)',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #64748b, #475569)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: 'clamp(15px, 3.5vw, 18px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 10px',
                  border: '2px solid rgba(255,255,255,0.2)',
                  position: 'relative',
                }}>
                  {getInitials(topThree[1].fullName)}
                  <span style={{
                    position: 'absolute', bottom: -3, right: -3,
                    width: 19, height: 19, borderRadius: '50%',
                    background: '#64748b', color: '#ffffff',
                    fontSize: 10.5, fontWeight: 900,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid #ffffff',
                  }}>2</span>
                </div>
                <h3 style={{
                  fontSize: 'clamp(15px, 3.8vw, 17px)',
                  fontWeight: 800,
                  margin: '0 0 2px',
                  color: '#f8fafc',
                  lineHeight: 1.25,
                }}>
                  {topThree[1].fullName}
                </h3>
                <span style={{
                  fontSize: 'clamp(10.5px, 2.6vw, 11.5px)',
                  color: '#94a3b8',
                  display: 'block',
                  marginBottom: 10,
                }}>
                  {topThree[1].course || 'Participant'} • {topThree[1].participantId}
                </span>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{
                    background: 'rgba(148, 163, 184, 0.15)',
                    border: '1px solid rgba(148, 163, 184, 0.3)',
                    color: '#e2e8f0',
                    fontSize: 'clamp(11.5px, 2.8vw, 12.5px)',
                    fontWeight: 800,
                    padding: '3px 9px',
                    borderRadius: 8,
                  }}>
                    ⚡ {topThree[1].totalScore} pts
                  </span>
                  <span style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: '#94a3b8',
                    fontSize: 'clamp(11px, 2.6vw, 12px)',
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: 8,
                  }}>
                    ⏱ {fmtMs(topThree[1].totalResponseTimeMs)}
                  </span>
                </div>
              </div>
            )}

            {/* 1st Place (Gold Champion) */}
            {topThree[0] && (
              <div
                className="podium-order-first"
                style={{
                  background: 'linear-gradient(145deg, rgba(245, 158, 11, 0.15) 0%, rgba(15, 23, 42, 0.95) 100%)',
                  border: '2px solid rgba(245, 158, 11, 0.55)',
                  borderRadius: 18,
                  padding: 'clamp(20px, 4.5vw, 26px)',
                  textAlign: 'center',
                  boxShadow: '0 10px 32px rgba(245, 158, 11, 0.2)',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ color: '#f59e0b', marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
                  <Icons.Crown size={34} color="#f59e0b" />
                </div>
                <div style={{
                  width: 'clamp(54px, 12vw, 64px)',
                  height: 'clamp(54px, 12vw, 64px)',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #f59e0b, #b45309)',
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: 'clamp(17px, 4vw, 20px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 10px',
                  border: '3px solid #fef3c7',
                  position: 'relative',
                  boxShadow: '0 0 20px rgba(245, 158, 11, 0.4)',
                }}>
                  {getInitials(topThree[0].fullName)}
                  <span style={{
                    position: 'absolute', bottom: -3, right: -3,
                    width: 21, height: 21, borderRadius: '50%',
                    background: '#f59e0b', color: '#ffffff',
                    fontSize: 11, fontWeight: 900,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1.5px solid #ffffff',
                  }}>1</span>
                </div>
                <h3 style={{
                  fontSize: 'clamp(17px, 4.5vw, 20px)',
                  fontWeight: 900,
                  margin: '0 0 2px',
                  color: '#fef3c7',
                  lineHeight: 1.25,
                }}>
                  {topThree[0].fullName}
                </h3>
                <span style={{
                  fontSize: 'clamp(11px, 2.8vw, 12px)',
                  color: '#fcd34d',
                  display: 'block',
                  marginBottom: 10,
                  fontWeight: 600,
                }}>
                  🏆 Champion • {topThree[0].course || 'Participant'} • {topThree[0].participantId}
                </span>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{
                    background: 'rgba(245, 158, 11, 0.25)',
                    border: '1px solid rgba(245, 158, 11, 0.6)',
                    color: '#fef3c7',
                    fontSize: 'clamp(12px, 3vw, 13.5px)',
                    fontWeight: 900,
                    padding: '4px 10px',
                    borderRadius: 8,
                  }}>
                    🏆 {topThree[0].totalScore} pts
                  </span>
                  <span style={{
                    background: 'rgba(245, 158, 11, 0.12)',
                    color: '#fde68a',
                    fontSize: 'clamp(11px, 2.8vw, 12px)',
                    fontWeight: 700,
                    padding: '4px 9px',
                    borderRadius: 8,
                  }}>
                    ⚡ {fmtMs(topThree[0].totalResponseTimeMs)}
                  </span>
                </div>
              </div>
            )}

            {/* 3rd Place (Bronze) */}
            {topThree[2] && (
              <div
                className="podium-order-third"
                style={{
                  background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
                  border: '1px solid rgba(180, 83, 9, 0.25)',
                  borderRadius: 18,
                  padding: 'clamp(16px, 3.5vw, 22px)',
                  textAlign: 'center',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ color: '#b45309', marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
                  <Icons.Award size={28} color="#d97706" />
                </div>
                <div style={{
                  width: 'clamp(46px, 10vw, 54px)',
                  height: 'clamp(46px, 10vw, 54px)',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #b45309, #78350f)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: 'clamp(15px, 3.5vw, 18px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 10px',
                  border: '2px solid rgba(255,255,255,0.2)',
                  position: 'relative',
                }}>
                  {getInitials(topThree[2].fullName)}
                  <span style={{
                    position: 'absolute', bottom: -3, right: -3,
                    width: 19, height: 19, borderRadius: '50%',
                    background: '#b45309', color: '#ffffff',
                    fontSize: 10.5, fontWeight: 900,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid #ffffff',
                  }}>3</span>
                </div>
                <h3 style={{
                  fontSize: 'clamp(15px, 3.8vw, 17px)',
                  fontWeight: 800,
                  margin: '0 0 2px',
                  color: '#f8fafc',
                  lineHeight: 1.25,
                }}>
                  {topThree[2].fullName}
                </h3>
                <span style={{
                  fontSize: 'clamp(10.5px, 2.6vw, 11.5px)',
                  color: '#94a3b8',
                  display: 'block',
                  marginBottom: 10,
                }}>
                  {topThree[2].course || 'Participant'} • {topThree[2].participantId}
                </span>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{
                    background: 'rgba(180, 83, 9, 0.18)',
                    border: '1px solid rgba(180, 83, 9, 0.4)',
                    color: '#fdba74',
                    fontSize: 'clamp(11.5px, 2.8vw, 12.5px)',
                    fontWeight: 800,
                    padding: '3px 9px',
                    borderRadius: 8,
                  }}>
                    ⚡ {topThree[2].totalScore} pts
                  </span>
                  <span style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: '#94a3b8',
                    fontSize: 'clamp(11px, 2.6vw, 12px)',
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: 8,
                  }}>
                    ⏱ {fmtMs(topThree[2].totalResponseTimeMs)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Search Bar & Contenders Counter ────────────────────────── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 14,
        }}>
          {/* Search Box */}
          <div style={{
            position: 'relative',
            maxWidth: 420,
            width: '100%',
          }}>
            <input
              type="text"
              placeholder="Search by Student Name, ID, or Course..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 14px 9px 36px',
                background: 'rgba(15, 23, 42, 0.75)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 12,
                color: '#ffffff',
                fontSize: 'clamp(13px, 3.2vw, 14px)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
              <Icons.Search size={15} />
            </div>
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13,
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Contenders Stats */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 'clamp(11.5px, 2.8vw, 12.5px)',
              color: '#94a3b8',
              fontWeight: 600,
            }}>
              Showing <strong style={{ color: '#ffffff' }}>{filteredResults.length}</strong> of {results.length} contenders
            </span>
          </div>
        </div>

        {/* Mobile Horizontal Scroll Indicator Banner */}
        <div
          className="mobile-scroll-indicator"
          style={{
            display: 'none',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(99, 102, 241, 0.1)',
            border: '1px dashed rgba(99, 102, 241, 0.3)',
            borderRadius: 8,
            padding: '6px 10px',
            marginBottom: 10,
            color: '#a5b4fc',
            fontSize: 11.5,
            fontWeight: 600,
          }}
        >
          <span>👉</span>
          <span>Swipe table left & right to view all 8 score and time columns</span>
        </div>

        {/* ── Exact 8-Column Results Table (Read-Only) ───────────────── */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <Spinner />
            <p style={{ marginTop: 12, color: '#94a3b8', fontSize: 'clamp(13px, 3vw, 14px)' }}>
              Loading tournament results...
            </p>
          </div>
        ) : filteredResults.length === 0 ? (
          <div style={{
            background: 'rgba(15, 23, 42, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 18,
            padding: '45px 20px',
            textAlign: 'center',
          }}>
            <div style={{ color: '#818cf8', marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
              <Icons.Trophy size={40} />
            </div>
            <h3 style={{ fontSize: 'clamp(16px, 4vw, 18px)', fontWeight: 800, color: '#ffffff', marginBottom: 6 }}>
              {search ? 'No Matching Results Found' : 'No Results Available Yet'}
            </h3>
            <p style={{ fontSize: 'clamp(12.5px, 3.2vw, 13.5px)', color: '#94a3b8', maxWidth: 440, margin: '0 auto' }}>
              {search
                ? `No student matching "${search}" was found. Try searching by ID or Course.`
                : 'As soon as the tournament concludes, official student rankings will appear right here!'}
            </p>
          </div>
        ) : (
          <div style={{
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 18,
            overflow: 'hidden',
            boxShadow: '0 12px 36px rgba(0,0,0,0.4)',
          }}>
            <div
              className="table-scrollbar-style"
              style={{
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <table style={{
                width: '100%',
                minWidth: 880,
                borderCollapse: 'collapse',
                textAlign: 'left',
              }}>
                <thead>
                  <tr style={{
                    background: 'rgba(30, 41, 59, 0.85)',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#94a3b8',
                    textTransform: 'uppercase',
                    fontSize: '11px',
                    letterSpacing: '0.05em',
                  }}>
                    <th className="table-cell-custom" style={{ padding: '12px 14px', textAlign: 'center', width: 65 }}>Rank</th>
                    <th className="table-cell-custom" style={{ padding: '12px 14px', width: 130 }}>Participant ID</th>
                    <th className="table-cell-custom" style={{ padding: '12px 14px' }}>Participant Name</th>
                    <th className="table-cell-custom" style={{ padding: '12px 14px', width: 105 }}>Course</th>
                    <th className="table-cell-custom" style={{ padding: '12px 14px', textAlign: 'center', width: 105 }}>Total Score</th>
                    <th className="table-cell-custom" style={{ padding: '12px 14px', textAlign: 'center', width: 125 }}>Correct Answers</th>
                    <th className="table-cell-custom" style={{ padding: '12px 14px', textAlign: 'center', width: 155 }}>Total Response Time (s)</th>
                    <th className="table-cell-custom" style={{ padding: '12px 14px', textAlign: 'center', width: 165 }}>Total Response Time (ms)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.map((item, index) => {
                    const isRank1 = item.rank === 1;
                    const isRank2 = item.rank === 2;
                    const isRank3 = item.rank === 3;
                    const isTopThree = isRank1 || isRank2 || isRank3;

                    const rowBg = isRank1
                      ? 'rgba(245, 158, 11, 0.08)'
                      : isRank2
                      ? 'rgba(148, 163, 184, 0.06)'
                      : isRank3
                      ? 'rgba(180, 83, 9, 0.06)'
                      : index % 2 === 0
                      ? 'transparent'
                      : 'rgba(255, 255, 255, 0.02)';

                    const rankBadgeColor = isRank1
                      ? '#f59e0b'
                      : isRank2
                      ? '#94a3b8'
                      : isRank3
                      ? '#d97706'
                      : '#64748b';

                    const secValue = item.totalResponseTimeSec != null
                      ? Number(item.totalResponseTimeSec).toFixed(2)
                      : (Number(item.totalResponseTimeMs || 0) / 1000).toFixed(2);

                    const msValue = item.totalResponseTimeMs != null
                      ? Number(item.totalResponseTimeMs)
                      : Math.round(Number(item.totalResponseTimeSec || 0) * 1000);

                    return (
                      <tr
                        key={item.participantId || index}
                        style={{
                          background: rowBg,
                          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        {/* 1. Rank */}
                        <td className="table-cell-custom" style={{ padding: '11px 14px', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: 26,
                            height: 26,
                            borderRadius: 7,
                            background: isTopThree ? `${rankBadgeColor}22` : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${isTopThree ? rankBadgeColor : 'rgba(255,255,255,0.1)'}`,
                            color: rankBadgeColor,
                            fontWeight: 900,
                            fontSize: isTopThree ? 12.5 : 12,
                          }}>
                            {isRank1 ? '🥇 1' : isRank2 ? '🥈 2' : isRank3 ? '🥉 3' : `#${item.rank}`}
                          </span>
                        </td>

                        {/* 2. Participant ID */}
                        <td className="table-cell-custom" style={{ padding: '11px 14px' }}>
                          <span style={{
                            fontFamily: 'monospace',
                            fontSize: 11.5,
                            fontWeight: 700,
                            color: '#94a3b8',
                            background: 'rgba(255, 255, 255, 0.05)',
                            padding: '3px 7px',
                            borderRadius: 6,
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                          }}>
                            {item.participantId}
                          </span>
                        </td>

                        {/* 3. Participant Name */}
                        <td className="table-cell-custom" style={{ padding: '11px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <div style={{
                              width: 30, height: 30, borderRadius: '50%',
                              background: isTopThree ? `${rankBadgeColor}33` : 'rgba(99, 102, 241, 0.2)',
                              color: isTopThree ? rankBadgeColor : '#a5b4fc',
                              fontSize: 11, fontWeight: 800,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0,
                            }}>
                              {getInitials(item.fullName)}
                            </div>
                            <span style={{
                              fontWeight: isTopThree ? 800 : 600,
                              color: isTopThree ? '#ffffff' : '#e2e8f0',
                              fontSize: '13px',
                            }}>
                              {item.fullName}
                            </span>
                          </div>
                        </td>

                        {/* 4. Course */}
                        <td className="table-cell-custom" style={{ padding: '11px 14px' }}>
                          <span style={{
                            fontSize: 11.5,
                            color: '#cbd5e1',
                            background: 'rgba(255, 255, 255, 0.04)',
                            padding: '3px 7px',
                            borderRadius: 6,
                          }}>
                            {item.course || '—'}
                          </span>
                        </td>

                        {/* 5. Total Score */}
                        <td className="table-cell-custom" style={{ padding: '11px 14px', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-block',
                            background: isRank1 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(99, 102, 241, 0.15)',
                            border: `1px solid ${isRank1 ? '#f59e0b' : 'rgba(129, 140, 248, 0.3)'}`,
                            color: isRank1 ? '#fef3c7' : '#c7d2fe',
                            fontWeight: 800,
                            fontSize: 12.5,
                            padding: '3px 9px',
                            borderRadius: 7,
                          }}>
                            {item.totalScore ?? 0} pts
                          </span>
                        </td>

                        {/* 6. Correct Answers */}
                        <td className="table-cell-custom" style={{ padding: '11px 14px', textAlign: 'center' }}>
                          <span style={{
                            color: item.correctCount > 0 ? '#34d399' : '#94a3b8',
                            fontWeight: 700,
                            fontSize: 12,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                          }}>
                            {item.correctCount > 0 && <Icons.Check size={13} color="#34d399" />}
                            {item.correctCount ?? 0}
                          </span>
                        </td>

                        {/* 7. Total Response Time (s) */}
                        <td className="table-cell-custom" style={{ padding: '11px 14px', textAlign: 'center' }}>
                          <span style={{
                            fontFamily: 'monospace',
                            fontSize: 12,
                            color: isTopThree ? '#fbbf24' : '#94a3b8',
                            fontWeight: isTopThree ? 700 : 500,
                          }}>
                            {secValue}s
                          </span>
                        </td>

                        {/* 8. Total Response Time (ms) */}
                        <td className="table-cell-custom" style={{ padding: '11px 14px', textAlign: 'center' }}>
                          <span style={{
                            fontFamily: 'monospace',
                            fontSize: 11.5,
                            color: '#64748b',
                          }}>
                            {msValue} ms
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
