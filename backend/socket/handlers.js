const Event = require('../models/Event');
const Question = require('../models/Question');
const Participant = require('../models/Participant');
const Submission = require('../models/Submission');
const { buildLeaderboard } = require('../routes/leaderboard');
const { getOrCreateEvent } = require('../routes/event');
const {
  setActiveRound,
  closeActiveRound,
  pauseActiveRound,
  resumeActiveRound,
  processAnswerSubmission,
  cacheParticipant,
} = require('../utils/submissionEngine');
const jwt = require('jsonwebtoken');

// Server-side round timeout tracker (one per active round)
let roundTimeoutHandle = null;

const clearRoundTimeout = () => {
  if (roundTimeoutHandle) {
    clearTimeout(roundTimeoutHandle);
    roundTimeoutHandle = null;
  }
};

// Broadcast current game state to all clients
const broadcastGameState = async (io, event) => {
  const questionCount = await Question.countDocuments({ eventId: event._id });
  const participantCount = await Participant.countDocuments({ eventId: event._id });

  io.emit('game:state', {
    status: event.status,
    currentRoundNumber: event.currentRoundNumber,
    totalRounds: event.totalRounds,
    questionCount,
    participantCount,
    roundTimer: event.roundTimer,
  });
};

// Auto-close round when timer expires
const scheduleRoundTimeout = (io, event, remainingMs) => {
  clearRoundTimeout();

  roundTimeoutHandle = setTimeout(async () => {
    try {
      const freshEvent = await Event.findById(event._id);
      if (!freshEvent || freshEvent.roundTimer.roundStatus !== 'active') return;

      freshEvent.roundTimer.roundStatus = 'closed';
      await freshEvent.save();
      closeActiveRound(freshEvent.currentRoundNumber);

      const question = await Question.findById(freshEvent.currentQuestionId);

      io.emit('round:closed', {
        roundNumber: freshEvent.currentRoundNumber,
        message: 'Time is up! Round closed.',
      });

      // Reveal correct answer ONLY to admin screen when round times out
      if (question) {
        io.to('admins').emit('question:answer_reveal', {
          roundNumber: freshEvent.currentRoundNumber,
          correctAnswer: question.correctAnswer,
        });
        await broadcastRoundLeaderboard(io, freshEvent, question);
      }

      await broadcastGameState(io, freshEvent);
    } catch (err) {
      console.error('Round timeout error:', err);
    }
  }, remainingMs);
};

const broadcastRoundLeaderboard = async (io, event, question) => {
  const submissions = await Submission.find({
    eventId: event._id,
    questionId: question._id,
  }).lean();

  const participantIds = submissions.map((s) => s.participantId);
  const participants = await Participant.find({ participantId: { $in: participantIds } });
  const participantMap = {};
  participants.forEach((p) => { participantMap[p.participantId] = p; });

  const roundLeaderboard = submissions
    .map((s) => ({
      participantId: s.participantId,
      fullName: participantMap[s.participantId]?.fullName || 'Unknown',
      course: participantMap[s.participantId]?.course || '',
      isCorrect: s.isCorrect,
      pointsAwarded: s.pointsAwarded,
      responseTimeMs: s.responseTimeMs,
      submittedAnswer: s.submittedAnswer,
    }))
    .sort((a, b) => {
      if (b.pointsAwarded !== a.pointsAwarded) return b.pointsAwarded - a.pointsAwarded;
      return a.responseTimeMs - b.responseTimeMs;
    })
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

  io.emit('leaderboard:round', {
    roundNumber: event.currentRoundNumber,
    leaderboard: roundLeaderboard,
  });
};

const initSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // ─── Participant: join event room ───────────────────────────────────────
    socket.on('participant:join', async ({ sessionToken }) => {
      try {
        if (!sessionToken) return;
        const event = await getOrCreateEvent();
        const tokenHash = Participant.hashToken(sessionToken);
        const participant = await Participant.findOne({ sessionTokenHash: tokenHash, eventId: event._id });
        if (!participant) return;

        await Participant.updateOne({ _id: participant._id }, { isConnected: true });
        cacheParticipant(tokenHash, participant);
        socket.participantId = participant.participantId;
        socket.join('participants');

        // Send current game state to reconnecting participant
        socket.emit('game:state', {
          status: event.status,
          currentRoundNumber: event.currentRoundNumber,
          totalRounds: event.totalRounds,
          roundTimer: event.roundTimer,
        });

        // If active round, send current question (without answer)
        if (event.status === 'live' && event.roundTimer.roundStatus === 'active' && event.currentQuestionId) {
          const question = await Question.findById(event.currentQuestionId).select('-correctAnswer -acceptedAnswers');
          if (question) {
            const now = Date.now();
            const remaining = event.roundTimer.deadlineAt
              ? Math.max(0, new Date(event.roundTimer.deadlineAt).getTime() - now)
              : 0;

            socket.emit('question:new', {
              roundNumber: question.roundNumber,
              totalRounds: event.totalRounds,
              questionText: question.questionText,
              questionImage: question.questionImage || '',
              options: question.options || [],
              questionType: question.questionType || 'mcq',
              category: question.category,
              timeLimitSeconds: question.timeLimitSeconds,
              deadlineAt: event.roundTimer.deadlineAt,
              serverTime: now,
              remainingMs: remaining,
            });

            // Check if this participant already submitted
            const submission = await Submission.findOne({
              participantId: participant.participantId,
              questionId: question._id,
            });
            if (submission) {
              socket.emit('answer:already_submitted', { roundNumber: question.roundNumber });
            }
          }
        }

        if (event.status === 'completed') {
          socket.emit('game:completed', { message: 'The quiz has ended. Thank you for participating!' });
        }
      } catch (err) {
        console.error('participant:join error:', err);
      }
    });

    // ─── Participant: Submit Answer via WebSocket (instant ultra-low latency) ───
    socket.on('participant:submit_answer', async (data, ack) => {
      try {
        const { sessionToken, submittedAnswer } = data || {};
        const result = await processAnswerSubmission({
          sessionToken,
          submittedAnswer,
          io,
        });

        if (typeof ack === 'function') {
          ack(result);
        } else {
          socket.emit('answer:result', result);
        }
      } catch (err) {
        console.error('Socket submit error:', err);
        const errPayload = { success: false, message: 'Submission failed. Please try again.' };
        if (typeof ack === 'function') ack(errPayload);
        else socket.emit('answer:result', errPayload);
      }
    });

    // ─── Participant: Anti-Cheat Tab-switch / Window Blur Event ───────────────
    socket.on('participant:cheating_attempt', async ({ sessionToken, reason }) => {
      try {
        if (!sessionToken) return;
        const event = await getOrCreateEvent();
        const tokenHash = Participant.hashToken(sessionToken);
        const participant = await Participant.findOne({ sessionTokenHash: tokenHash, eventId: event._id });
        if (!participant) return;

        participant.warningCount = (participant.warningCount || 0) + 1;
        participant.cheatLogs.push({
          reason: reason || 'Tab switch / app window blur',
          timestamp: new Date(),
          roundNumber: event.currentRoundNumber || 0,
        });

        if (participant.warningCount >= 3) {
          participant.isDisqualified = true;
        }

        await participant.save();

        const alertPayload = {
          participantId: participant.participantId,
          fullName: participant.fullName,
          course: participant.course,
          reason: reason || 'Tab switch / app window blur',
          warningCount: participant.warningCount,
          isDisqualified: participant.isDisqualified,
          roundNumber: event.currentRoundNumber || 0,
          timestamp: new Date().toISOString(),
        };

        // Notify admins in real-time
        io.to('admins').emit('admin:cheating_alert', alertPayload);

        // Feedback to student with their warning count
        socket.emit('participant:warning', {
          warningCount: participant.warningCount,
          isDisqualified: participant.isDisqualified,
          maxWarnings: 3,
        });
      } catch (err) {
        console.error('participant:cheating_attempt error:', err);
      }
    });

    // ─── Admin: authenticate socket ─────────────────────────────────────────
    socket.on('admin:join', async ({ token }) => {
      try {
        if (!token) return socket.emit('error', { message: 'Admin token required' });
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.adminId = decoded.id;
        socket.isAdmin = true;
        socket.join('admins');
        socket.emit('admin:authenticated', { message: 'Admin connected' });

        const event = await getOrCreateEvent();
        await broadcastGameState(io, event);
      } catch {
        socket.emit('error', { message: 'Invalid admin token' });
      }
    });

    // ─── Admin: Start Quiz ──────────────────────────────────────────────────
    socket.on('admin:start_quiz', async () => {
      if (!socket.isAdmin) return socket.emit('error', { message: 'Unauthorized' });
      try {
        const event = await getOrCreateEvent();
        if (event.status !== 'ready') {
          return socket.emit('error', { message: `Cannot start: event status is "${event.status}". Upload questions first.` });
        }
        if (event.totalRounds === 0) {
          return socket.emit('error', { message: 'No questions uploaded. Please upload a question sheet first.' });
        }

        event.status = 'live';
        event.startedAt = new Date();
        event.currentRoundNumber = 0;
        await event.save();

        io.emit('game:started', { message: 'Quiz has started! Get ready...' });
        await broadcastGameState(io, event);
      } catch (err) {
        console.error('start_quiz error:', err);
        socket.emit('error', { message: 'Failed to start quiz' });
      }
    });

    // ─── Admin: Publish Next Question ───────────────────────────────────────
    socket.on('admin:next_question', async () => {
      if (!socket.isAdmin) return socket.emit('error', { message: 'Unauthorized' });
      try {
        const event = await getOrCreateEvent();

        if (event.status !== 'live') {
          return socket.emit('error', { message: 'Game must be live to publish questions' });
        }
        if (event.roundTimer.roundStatus === 'active') {
          return socket.emit('error', { message: 'Close the current round before publishing the next question' });
        }

        const nextRound = event.currentRoundNumber + 1;
        if (nextRound > event.totalRounds) {
          return socket.emit('error', { message: 'No more questions. End the game.' });
        }

        const question = await Question.findOne({ eventId: event._id, roundNumber: nextRound });
        if (!question) {
          return socket.emit('error', { message: `Question for round ${nextRound} not found` });
        }

        const now = new Date();
        const deadlineAt = new Date(now.getTime() + question.timeLimitSeconds * 1000);

        event.currentRoundNumber = nextRound;
        event.currentQuestionId = question._id;
        event.roundTimer = {
          questionId: question._id,
          roundNumber: nextRound,
          startedAt: now,
          deadlineAt,
          timeLimitSeconds: question.timeLimitSeconds,
          pausedAt: null,
          remainingMs: null,
          roundStatus: 'active',
        };
        await event.save();
        setActiveRound(event, question);

        // Schedule auto-close at deadline
        scheduleRoundTimeout(io, event, question.timeLimitSeconds * 1000);

        const payload = {
          roundNumber: nextRound,
          totalRounds: event.totalRounds,
          questionText: question.questionText,
          questionImage: question.questionImage || '',
          options: question.options || [],
          questionType: question.questionType || 'mcq',
          category: question.category,
          timeLimitSeconds: question.timeLimitSeconds,
          deadlineAt,
          serverTime: now.getTime(),
          remainingMs: question.timeLimitSeconds * 1000,
        };

        // Send question (without answers) to all participants
        io.to('participants').emit('question:new', payload);

        // Send question to admin (answers hidden while round is active!)
        io.to('admins').emit('question:admin', {
          ...payload,
          points: question.points,
        });

        await broadcastGameState(io, event);
      } catch (err) {
        console.error('next_question error:', err);
        socket.emit('error', { message: 'Failed to publish question' });
      }
    });

    // ─── Admin: Pause Game ──────────────────────────────────────────────────
    socket.on('admin:pause', async () => {
      if (!socket.isAdmin) return socket.emit('error', { message: 'Unauthorized' });
      try {
        const event = await getOrCreateEvent();
        if (event.status !== 'live') return socket.emit('error', { message: 'Game is not live' });
        if (event.roundTimer.roundStatus !== 'active') return socket.emit('error', { message: 'No active round to pause' });

        clearRoundTimeout();

        const now = new Date();
        const remainingMs = event.roundTimer.deadlineAt
          ? Math.max(0, new Date(event.roundTimer.deadlineAt).getTime() - now.getTime())
          : 0;

        event.status = 'paused';
        event.roundTimer.pausedAt = now;
        event.roundTimer.remainingMs = remainingMs;
        event.roundTimer.roundStatus = 'paused';
        await event.save();
        pauseActiveRound(remainingMs);

        io.emit('game:paused', { remainingMs, message: 'Game paused by host' });
        await broadcastGameState(io, event);
      } catch (err) {
        socket.emit('error', { message: 'Failed to pause game' });
      }
    });

    // ─── Admin: Resume Game ─────────────────────────────────────────────────
    socket.on('admin:resume', async () => {
      if (!socket.isAdmin) return socket.emit('error', { message: 'Unauthorized' });
      try {
        const event = await getOrCreateEvent();
        if (event.status !== 'paused') return socket.emit('error', { message: 'Game is not paused' });

        const remainingMs = event.roundTimer.remainingMs || 0;
        const now = new Date();
        const newDeadline = new Date(now.getTime() + remainingMs);

        event.status = 'live';
        event.roundTimer.deadlineAt = newDeadline;
        event.roundTimer.pausedAt = null;
        event.roundTimer.remainingMs = null;
        event.roundTimer.roundStatus = 'active';
        await event.save();
        resumeActiveRound(newDeadline);

        scheduleRoundTimeout(io, event, remainingMs);

        io.emit('game:resumed', {
          deadlineAt: newDeadline,
          serverTime: now.getTime(),
          remainingMs,
          message: 'Game resumed!',
        });
        await broadcastGameState(io, event);
      } catch (err) {
        socket.emit('error', { message: 'Failed to resume game' });
      }
    });

    // ─── Admin: Close Current Round ─────────────────────────────────────────
    socket.on('admin:close_round', async () => {
      if (!socket.isAdmin) return socket.emit('error', { message: 'Unauthorized' });
      try {
        const event = await getOrCreateEvent();
        clearRoundTimeout();

        event.roundTimer.roundStatus = 'closed';
        await event.save();
        closeActiveRound(event.currentRoundNumber);

        const question = await Question.findById(event.currentQuestionId);

        io.emit('round:closed', {
          roundNumber: event.currentRoundNumber,
          message: 'Round closed by host.',
        });

        if (question) {
          // Reveal correct answer ONLY to admins when round is closed
          io.to('admins').emit('question:answer_reveal', {
            roundNumber: event.currentRoundNumber,
            correctAnswer: question.correctAnswer,
          });
          await broadcastRoundLeaderboard(io, event, question);
        }

        await broadcastGameState(io, event);
      } catch (err) {
        socket.emit('error', { message: 'Failed to close round' });
      }
    });

    // ─── Admin: End Game ────────────────────────────────────────────────────
    socket.on('admin:end_game', async () => {
      if (!socket.isAdmin) return socket.emit('error', { message: 'Unauthorized' });
      try {
        const event = await getOrCreateEvent();
        clearRoundTimeout();

        event.status = 'completed';
        event.completedAt = new Date();
        event.roundTimer.roundStatus = 'closed';
        await event.save();
        closeActiveRound();

        // Build final leaderboard
        const finalLeaderboard = await buildLeaderboard(event._id);

        io.emit('game:completed', {
          message: 'Quiz completed! Thank you for participating in Silicon Sorcerer!',
        });
        io.to('admins').emit('leaderboard:final', { leaderboard: finalLeaderboard });

        await broadcastGameState(io, event);
      } catch (err) {
        socket.emit('error', { message: 'Failed to end game' });
      }
    });

    // ─── Admin: Request final leaderboard ───────────────────────────────────
    socket.on('admin:get_leaderboard', async () => {
      if (!socket.isAdmin) return socket.emit('error', { message: 'Unauthorized' });
      try {
        const event = await getOrCreateEvent();
        const finalLeaderboard = await buildLeaderboard(event._id);
        socket.emit('leaderboard:final', { leaderboard: finalLeaderboard });
      } catch (err) {
        socket.emit('error', { message: 'Failed to fetch leaderboard' });
      }
    });

    // ─── Disconnect ─────────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      console.log(`Socket disconnected: ${socket.id}`);
      if (socket.participantId) {
        await Participant.updateOne(
          { participantId: socket.participantId },
          { isConnected: false }
        ).catch(() => {});
      }
    });
  });
};

module.exports = { initSocketHandlers };
