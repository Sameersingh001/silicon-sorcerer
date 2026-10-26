import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiFetch, getParticipantSession } from '../utils';
import { Icons } from '../Icons';
import bannerImg from '../assets/Banner.png';
import brandLogo from '../assets/logo-transparent.png';

export default function HomePage() {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [hasSession, setHasSession] = useState(false);
  const [sessionUser, setSessionUser] = useState(null);
  const [eventStatus, setEventStatus] = useState(null);

  useEffect(() => {
    const session = getParticipantSession();
    if (session?.sessionToken) {
      setHasSession(true);
      setSessionUser(session);
    }

    apiFetch('/api/events/current')
      .then((data) => {
        if (data.success && data.event) {
          setEventStatus(data.event.status);
        }
      })
      .catch(() => {});
  }, []);

  const totalSlides = 6;

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev < totalSlides - 1 ? prev + 1 : prev));
  }, [totalSlides]);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        nextSlide();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevSlide();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextSlide, prevSlide]);

  const isEventClosed = eventStatus === 'completed';

  /* ── Bottom Controls (shared by all slides) ── */
  const BottomBar = ({ prevLabel, nextLabel }) => (
    <div className="ppt-bottom-bar">
      <div className="ppt-bottom-left">
        {prevLabel && (
          <button className="ppt-nav-btn" onClick={prevSlide}>
            ← {prevLabel}
          </button>
        )}
      </div>
      <div className="ppt-dots">
        {Array.from({ length: totalSlides }).map((_, i) => (
          <button
            key={i}
            className={`ppt-dot${currentSlide === i ? ' active' : ''}`}
            onClick={() => setCurrentSlide(i)}
          />
        ))}
      </div>
      <div className="ppt-bottom-right">
        {nextLabel && (
          <button className="ppt-nav-btn ppt-nav-primary" onClick={nextSlide}>
            {nextLabel} →
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="ppt-wrapper">
      {/* ── Compact Top Bar ── */}
      <header className="ppt-topbar">
        <div className="ppt-brand">
          <div className="ppt-brand-logo-wrap">
            <img src={brandLogo} alt="Silicon Sorcerers Logo" className="ppt-brand-logo" />
          </div>
          <span className="ppt-brand-text">Silicon Sorcerers</span>
        </div>

        <nav className="ppt-tab-row">
          {['Cover', 'Join', 'Questions', 'Anti-Cheat', 'Leaderboard', 'Phone Rules'].map((tab, idx) => (
            <button
              key={idx}
              className={`ppt-tab${currentSlide === idx ? ' active' : ''}${idx === 3 && currentSlide === 3 ? ' danger' : ''}`}
              onClick={() => setCurrentSlide(idx)}
            >
              {tab}
            </button>
          ))}
        </nav>
      </header>

      {/* ── Slide Area (fills remaining viewport) ── */}
      <main className="ppt-slide-area">
        <div className="ppt-slide-card">

          {/* ════════ SLIDE 0: COVER BANNER ════════ */}
          {currentSlide === 0 && (
            <div className="ppt-slide-inner ppt-cover-slide">
              <div className="ppt-cover-layout">
                <div className="ppt-banner-ambient" style={{ backgroundImage: `url(${bannerImg})` }} />
                <img src={bannerImg} alt="Quizzy ALPHA — Silicon Sorcerers" className="ppt-banner-img" />
              </div>
              <BottomBar nextLabel="How to Join" />
            </div>
          )}

          {/* ════════ SLIDE 1: HOW TO JOIN ════════ */}
          {currentSlide === 1 && (
            <div className="ppt-slide-inner">
              <div className="ppt-slide-head">
                <div>
                  <span className="ppt-badge blue">Step 1 — Getting Started</span>
                  <h1 className="ppt-title">How to Join the Game</h1>
                  <p className="ppt-sub">You only need your phone. No app download required!</p>
                </div>
                <span className="ppt-slide-num">01 / 05</span>
              </div>

              <div className="ppt-cards-3">
                <div className="ppt-card">
                  <div className="ppt-card-num">1</div>
                  <h2 className="ppt-card-title">Scan the QR Code</h2>
                  <p className="ppt-card-desc">
                    Open your mobile camera and scan the QR code shown on the auditorium screen or printed on the table.
                  </p>
                </div>
                <div className="ppt-card">
                  <div className="ppt-card-num">2</div>
                  <h2 className="ppt-card-title">Enter Name and Class</h2>
                  <p className="ppt-card-desc">
                    Type your <strong>Full Name</strong> and <strong>Course / Year</strong> (e.g. Sameer Singh — B.Tech CSE). This name will appear on the leaderboard.
                  </p>
                </div>
                <div className="ppt-card">
                  <div className="ppt-card-num">3</div>
                  <h2 className="ppt-card-title">Lock Screen and Wait</h2>
                  <p className="ppt-card-desc">
                    Click <strong>"Lock Screen & Enter Quiz"</strong>. Your phone enters fullscreen waiting lobby. The host will start the quiz shortly.
                  </p>
                </div>
              </div>
              <BottomBar prevLabel="Cover" nextLabel="Questions" />
            </div>
          )}

          {/* ════════ SLIDE 2: ONE-BY-ONE QUESTIONS ════════ */}
          {currentSlide === 2 && (
            <div className="ppt-slide-inner">
              <div className="ppt-slide-head">
                <div>
                  <span className="ppt-badge amber">Step 2 — Live Gameplay</span>
                  <h1 className="ppt-title">Questions Come One by One</h1>
                  <p className="ppt-sub">Everyone gets the same question at the same second!</p>
                </div>
                <span className="ppt-slide-num">02 / 05</span>
              </div>

              <div className="ppt-cards-3">
                <div className="ppt-card">
                  <div className="ppt-card-icon amber"><Icons.Clock size={28} /></div>
                  <h2 className="ppt-card-title">Timer as per Difficulty</h2>
                  <p className="ppt-card-desc">
                    Time is set based on question difficulty (Easy, Medium, or Hard). Read fast, think carefully, and lock your answer before time runs out!
                  </p>
                </div>
                <div className="ppt-card">
                  <div className="ppt-card-icon green"><Icons.Zap size={28} /></div>
                  <h2 className="ppt-card-title">Fast Answer = More Points!</h2>
                  <p className="ppt-card-desc">
                    Speed matters! Answering correctly in <strong>2 seconds</strong> earns way more points than answering in 15 seconds.
                  </p>
                </div>
                <div className="ppt-card">
                  <div className="ppt-card-icon indigo"><Icons.Lock size={28} /></div>
                  <h2 className="ppt-card-title">Answer Locks Instantly</h2>
                  <p className="ppt-card-desc">
                    Once you tap an option, it is locked. You cannot change your answer. No second guessing!
                  </p>
                </div>
              </div>
              <BottomBar prevLabel="How to Join" nextLabel="Anti-Cheat Rules" />
            </div>
          )}

          {/* ════════ SLIDE 3: ANTI-CHEAT / 3 STRIKES ════════ */}
          {currentSlide === 3 && (
            <div className="ppt-slide-inner">
              <div className="ppt-slide-head">
                <div>
                  <span className="ppt-badge red">Step 3 — ZERO TOLERANCE</span>
                  <h1 className="ppt-title" style={{ color: '#dc2626' }}>
                    Anti-Cheat: 3 Strikes = Disqualified!
                  </h1>
                  <p className="ppt-sub">Do NOT leave or minimize the game. The system detects it automatically.</p>
                </div>
                <span className="ppt-slide-num" style={{ color: '#dc2626', borderColor: '#fca5a5' }}>03 / 05</span>
              </div>

              {/* Big red warning */}
              <div className="ppt-red-banner">
                <Icons.ShieldAlert size={22} />
                DO NOT LEAVE OR MINIMIZE THE GAME — YOU WILL BE DISQUALIFIED!
              </div>

              <div className="ppt-strikes-row">
                <div className="ppt-strike s1">
                  <span className="ppt-strike-badge">Strike 1</span>
                  <h2 className="ppt-strike-name">1st Warning</h2>
                  <p className="ppt-strike-desc">
                    If you switch tabs or open another app, a red warning flashes on your screen and the admin sees your name.
                  </p>
                </div>
                <div className="ppt-strike s2">
                  <span className="ppt-strike-badge">Strike 2</span>
                  <h2 className="ppt-strike-name">Final Warning</h2>
                  <p className="ppt-strike-desc">
                    Second violation is logged with exact time. Proctors will walk to your desk. One more and you are out!
                  </p>
                </div>
                <div className="ppt-strike s3">
                  <span className="ppt-strike-badge">Strike 3</span>
                  <h2 className="ppt-strike-name">DISQUALIFIED!</h2>
                  <p className="ppt-strike-desc">
                    <strong>GAME OVER.</strong> You are kicked out. Your score is deleted and you cannot rejoin!
                  </p>
                </div>
              </div>

              <div className="ppt-prohibit-row">
                <div className="ppt-prohibit-pill"><Icons.XCircle size={16} color="#dc2626" /> No switching tabs</div>
                <div className="ppt-prohibit-pill"><Icons.XCircle size={16} color="#dc2626" /> No split-screen</div>
                <div className="ppt-prohibit-pill"><Icons.XCircle size={16} color="#dc2626" /> Copy-paste blocked</div>
                <div className="ppt-prohibit-pill"><Icons.XCircle size={16} color="#dc2626" /> 1 phone only</div>
              </div>

              <BottomBar prevLabel="Questions" nextLabel="Leaderboard" />
            </div>
          )}

          {/* ════════ SLIDE 4: LIVE LEADERBOARD ════════ */}
          {currentSlide === 4 && (
            <div className="ppt-slide-inner">
              <div className="ppt-slide-head">
                <div>
                  <span className="ppt-badge green">Step 4 — Scores and Ranks</span>
                  <h1 className="ppt-title">Leaderboard After Every Question</h1>
                  <p className="ppt-sub">See ranks jump live on the big stage screen and on your phone!</p>
                </div>
                <span className="ppt-slide-num">04 / 05</span>
              </div>

              <div className="ppt-lb-split">
                {/* Leaderboard mockup */}
                <div className="ppt-lb-preview">
                  <div className="ppt-lb-header">
                    <span>STAGE SCREEN — ROUND 4</span>
                    <span className="ppt-lb-live-tag">Live</span>
                  </div>
                  <div className="ppt-lb-row gold">
                    <div className="ppt-lb-left">
                      <span className="ppt-lb-rank">🥇 1</span>
                      <div>
                        <div className="ppt-lb-name">Sameer Singh</div>
                        <div className="ppt-lb-info">B.Tech CSE — 3,840 pts</div>
                      </div>
                    </div>
                    <span className="ppt-lb-gain">+980</span>
                  </div>
                  <div className="ppt-lb-row">
                    <div className="ppt-lb-left">
                      <span className="ppt-lb-rank">🥈 2</span>
                      <div>
                        <div className="ppt-lb-name">Ananya Gupta</div>
                        <div className="ppt-lb-info">BCA — 3,610 pts</div>
                      </div>
                    </div>
                    <span className="ppt-lb-gain">+940</span>
                  </div>
                  <div className="ppt-lb-row">
                    <div className="ppt-lb-left">
                      <span className="ppt-lb-rank">🥉 3</span>
                      <div>
                        <div className="ppt-lb-name">Vikram Patel</div>
                        <div className="ppt-lb-info">B.Tech IT — 3,490 pts</div>
                      </div>
                    </div>
                    <span className="ppt-lb-gain">+910</span>
                  </div>
                </div>

                {/* Info cards */}
                <div className="ppt-lb-info-col">
                  <div className="ppt-card" style={{ flex: 1 }}>
                    <h2 className="ppt-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Icons.BarChart3 size={20} color="#4f46e5" /> Updated After Every Question
                    </h2>
                    <p className="ppt-card-desc">
                      The moment the timer ends, the stage panel refreshes with the new Top 5 ranks and total scores!
                    </p>
                  </div>
                  <div className="ppt-card" style={{ flex: 1 }}>
                    <h2 className="ppt-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Icons.Smartphone size={20} color="#0ea5e9" /> Your Phone Shows Your Rank
                    </h2>
                    <p className="ppt-card-desc">
                      Even if you are not in the Top 3 on stage, your own phone will show your exact rank and points.
                    </p>
                  </div>
                </div>
              </div>
              <BottomBar prevLabel="Anti-Cheat" nextLabel="Phone Rules" />
            </div>
          )}

          {/* ════════ SLIDE 5: PHONE RULES CHECKLIST ════════ */}
          {currentSlide === 5 && (
            <div className="ppt-slide-inner">
              <div className="ppt-slide-head">
                <div>
                  <span className="ppt-badge blue">Step 5 — Phone Setup</span>
                  <h1 className="ppt-title">4 Rules for Your Phone Right Now</h1>
                  <p className="ppt-sub">Do these before the quiz starts so you don't get accidental strikes!</p>
                </div>
                <span className="ppt-slide-num">05 / 05</span>
              </div>

              <div className="ppt-check-grid">
                <div className="ppt-check-card">
                  <div className="ppt-check-icon"><Icons.Check size={20} /></div>
                  <div>
                    <h2 className="ppt-check-title">1. Turn ON "Do Not Disturb"</h2>
                    <p className="ppt-check-desc">
                      Phone calls or WhatsApp notifications will switch your screen and cause a strike. Turn on DND now!
                    </p>
                  </div>
                </div>
                <div className="ppt-check-card">
                  <div className="ppt-check-icon"><Icons.Check size={20} /></div>
                  <div>
                    <h2 className="ppt-check-title">2. Keep Battery Above 50%</h2>
                    <p className="ppt-check-desc">
                      "Low Battery" popups minimize the game and trigger a strike. Keep your phone charged.
                    </p>
                  </div>
                </div>
                <div className="ppt-check-card">
                  <div className="ppt-check-icon"><Icons.Check size={20} /></div>
                  <div>
                    <h2 className="ppt-check-title">3. Stay in Fullscreen Mode</h2>
                    <p className="ppt-check-desc">
                      Do not swipe down the notification bar, do not check the time, and do not switch apps.
                    </p>
                  </div>
                </div>
                <div className="ppt-check-card">
                  <div className="ppt-check-icon"><Icons.Check size={20} /></div>
                  <div>
                    <h2 className="ppt-check-title">4. Stay Connected to Internet</h2>
                    <p className="ppt-check-desc">
                      Keep Wi-Fi or mobile data active. If connection drops, refresh the page to reconnect.
                    </p>
                  </div>
                </div>
              </div>
              <BottomBar prevLabel="Leaderboard" />
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
