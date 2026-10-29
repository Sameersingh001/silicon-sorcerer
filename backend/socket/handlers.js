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
  updateActiveRoundDifficulty,
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

// Safely swap round numbers between two questions without violating the { eventId, roundNumber } unique index
const safeSwapQuestionRounds = async (qA, qB) => {
  if (!qA || !qB || qA._id.toString() === qB._id.toString()) return;
  const roundA = qA.roundNumber;
  const roundB = qB.roundNumber;
  if (roundA === roundB) return;

  // Step 1: Temporarily assign qA a unique negative number so position roundA is completely vacated
  const tempRound = -Math.floor(Date.now() % 10000000 + Math.random() * 10000 + 1);
  await Question.updateOne({ _id: qA._id }, { $set: { roundNumber: tempRound } });

  // Step 2: Now roundA is free, assign roundA to qB
  await Question.updateOne({ _id: qB._id }, { $set: { roundNumber: roundA } });

  // Step 3: Now roundB is free, assign roundB to qA
  await Question.updateOne({ _id: qA._id }, { $set: { roundNumber: roundB } });

  qA.roundNumber = roundB;
  qB.roundNumber = roundA;
};

// Broadcast current game state to all clients with synchronized server timestamp
const broadcastGameState = async (io, event) => {
  const questionCount = await Question.countDocuments({ eventId: event._id });
  const participantCount = await Participant.countDocuments({ eventId: event._id });
  const serverTime = Date.now();

  io.emit('game:state', {
    status: event.status,
    currentRoundNumber: event.currentRoundNumber,
    totalRounds: event.totalRounds,
    questionCount,
    participantCount,
    roundTimer: {
      ...(event.roundTimer?.toObject?.() || event.roundTimer),
      serverTime,
    },
    serverTime,
  });
};

// Auto-close round when timer expires (with 400ms network jitter buffer)
const scheduleRoundTimeout = (io, event, remainingMs) => {
  clearRoundTimeout();

  roundTimeoutHandle = setTimeout(async () => {
    try {
      const freshEvent = await Event.findById(event._id);
      if (!freshEvent || freshEvent.roundTimer?.roundStatus !== 'active') return;

      freshEvent.roundTimer.roundStatus = 'closed';
      await freshEvent.save();
      closeActiveRound(freshEvent.currentRoundNumber);

      const question = await Question.findById(freshEvent.currentQuestionId);

      io.emit('round:closed', {
        roundNumber: freshEvent.currentRoundNumber,
        message: 'Time is up! Round closed.',
      });

      // NOTE: Answer is NOT auto-revealed. Admin must press "Reveal Answer" button.
      // Leaderboard is broadcast after round closes.
      if (question) {
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

  const submissionMap = {};
  submissions.forEach((s) => { submissionMap[s.participantId] = s; });

  const allParticipants = await Participant.find({ eventId: event._id }).lean();

  const roundLeaderboard = allParticipants
    .map((p) => {
      const s = submissionMap[p.participantId];
      return {
        participantId: p.participantId,
        fullName: p.fullName || 'Unknown',
        course: p.course || '',
        isCorrect: s ? Boolean(s.isCorrect) : false,
        pointsAwarded: s ? (s.pointsAwarded ?? 0) : 0,
        responseTimeMs: s ? s.responseTimeMs : (question?.timeLimitSeconds || 20) * 1000,
        submittedAnswer: s ? s.submittedAnswer : 'No submission',
      };
    })
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
        if (event.status === 'live' && event.roundTimer?.roundStatus === 'active' && event.currentQuestionId) {
          const question = await Question.findById(event.currentQuestionId).select('-correctAnswer -acceptedAnswers');
          if (question) {
            const now = Date.now();
            const remaining = event.roundTimer?.deadlineAt
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
        event.playedQuestionIds = [];
        await event.save();

        io.emit('game:started', { message: 'Quiz has started! Get ready...' });
        await broadcastGameState(io, event);
      } catch (err) {
        console.error('start_quiz error:', err);
        socket.emit('error', { message: 'Failed to start quiz' });
      }
    });

    // ─── Admin: Publish Next Question ───────────────────────────────────────
    socket.on('admin:next_question', async (data) => {
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

        const playedIds = (event.playedQuestionIds || []).map(id => id.toString());

        let question = await Question.findOne({ eventId: event._id, roundNumber: nextRound });

        // If the question assigned to nextRound was already played in a previous round, swap with an unplayed question ahead
        if (question && playedIds.includes(question._id.toString())) {
          const replacementQ = await Question.findOne({
            eventId: event._id,
            _id: { $nin: event.playedQuestionIds || [] },
            roundNumber: { $gt: event.currentRoundNumber },
          }).sort({ roundNumber: 1 });

          if (replacementQ) {
            await safeSwapQuestionRounds(question, replacementQ);
            question = replacementQ;
          }
        }

        // If admin requested a specific difficulty for the next question:
        const reqDifficulty = data?.difficulty;
        if (reqDifficulty && question && question.difficulty !== reqDifficulty) {
          // Strictly search among UNPLAYED questions ahead (never search backwards)
          const targetQ = await Question.findOne({
            eventId: event._id,
            _id: { $nin: event.playedQuestionIds || [], $ne: question._id },
            difficulty: reqDifficulty,
            roundNumber: { $gt: event.currentRoundNumber },
          }).sort({ roundNumber: 1 });

          if (targetQ && targetQ._id.toString() !== question._id.toString()) {
            await safeSwapQuestionRounds(question, targetQ);
            question = targetQ;
          } else {
            // No unplayed question of this difficulty exists ahead - adapt difficulty & points in-place!
            question.difficulty = reqDifficulty;
            question.points = reqDifficulty === 'introduction' ? 0 : (reqDifficulty === 'intermediate' ? 15 : (reqDifficulty === 'advanced' ? 20 : 10));
            await question.save();
          }
        }

        if (!question) {
          return socket.emit('error', { message: `Question for round ${nextRound} not found` });
        }

        // Record this question in playedQuestionIds
        if (!event.playedQuestionIds) event.playedQuestionIds = [];
        if (!event.playedQuestionIds.some(id => id.toString() === question._id.toString())) {
          event.playedQuestionIds.push(question._id);
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
          difficulty: question.difficulty || 'beginner',
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
          difficulty: question.difficulty || 'beginner',
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
        if (event.roundTimer?.roundStatus !== 'active') return socket.emit('error', { message: 'No active round to pause' });

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

        // NOTE: Answer is NOT auto-revealed here. Admin must press "Reveal Answer" button.
        if (question) {
          await broadcastRoundLeaderboard(io, event, question);
        }

        await broadcastGameState(io, event);
      } catch (err) {
        socket.emit('error', { message: 'Failed to close round' });
      }
    });

    // ─── Admin: Reveal Answer (Manual Button) ───────────────────────────────
    socket.on('admin:reveal_answer', async () => {
      if (!socket.isAdmin) return socket.emit('error', { message: 'Unauthorized' });
      try {
        const event = await getOrCreateEvent();
        const question = await Question.findById(event.currentQuestionId);

        if (!question) {
          return socket.emit('error', { message: 'No active question found to reveal answer for' });
        }

        // Broadcast answer reveal to BOTH admins (projector) AND all connected participants!
        io.emit('question:answer_reveal', {
          roundNumber: event.currentRoundNumber,
          correctAnswer: question.correctAnswer,
          difficulty: question.difficulty || 'beginner',
        });
      } catch (err) {
        console.error('reveal_answer error:', err);
        socket.emit('error', { message: 'Failed to reveal answer' });
      }
    });

    // ─── Admin: Change Question Difficulty (Supports Instant Real-Time Switch) ─
    socket.on('admin:change_question_difficulty', async ({ questionId, roundNumber, difficulty }) => {
      if (!socket.isAdmin) return socket.emit('error', { message: 'Unauthorized' });
      try {
        const valid = ['introduction', 'beginner', 'intermediate', 'advanced'];
        if (!valid.includes(difficulty)) {
          return socket.emit('error', { message: 'Invalid difficulty' });
        }

        const event = await getOrCreateEvent();
        const defaultPoints = difficulty === 'introduction' ? 0 : (difficulty === 'intermediate' ? 15 : (difficulty === 'advanced' ? 20 : 10));

        // ── CASE 1: Game is LIVE and round is ACTIVE (Instant Real-time Switch) ──
        if (event.status === 'live' && event.roundTimer?.roundStatus === 'active') {
          clearRoundTimeout();

          const playedIds = (event.playedQuestionIds || []).map(id => id.toString());
          const currentQ = await Question.findById(event.currentQuestionId);

          // 1. Search for an UNPLAYED question ahead in this event with the target difficulty
          let targetQuestion = await Question.findOne({
            eventId: event._id,
            _id: { $nin: event.playedQuestionIds || [], $ne: event.currentQuestionId },
            difficulty,
            roundNumber: { $gt: event.currentRoundNumber },
          }).sort({ roundNumber: 1 });

          // 2. If no unplayed question ahead has this difficulty, pick the next unplayed question ahead and convert its difficulty
          if (!targetQuestion) {
            targetQuestion = await Question.findOne({
              eventId: event._id,
              _id: { $nin: event.playedQuestionIds || [], $ne: event.currentQuestionId },
              roundNumber: { $gt: event.currentRoundNumber },
            }).sort({ roundNumber: 1 });

            if (targetQuestion) {
              targetQuestion.difficulty = difficulty;
              targetQuestion.points = defaultPoints;
              await targetQuestion.save();
            }
          }

          // 3. If no unplayed question exists ahead (e.g. final round), adapt the CURRENT question in-place
          if (!targetQuestion && currentQ) {
            targetQuestion = currentQ;
            targetQuestion.difficulty = difficulty;
            targetQuestion.points = defaultPoints;
            await targetQuestion.save();
          }

          if (!targetQuestion) {
            return socket.emit('error', { message: 'No question available to switch to' });
          }

          // Swap round numbers safely so the current round keeps its sequence smoothly
          if (currentQ && targetQuestion._id.toString() !== currentQ._id.toString()) {
            await safeSwapQuestionRounds(currentQ, targetQuestion);
            targetQuestion.difficulty = difficulty;
            targetQuestion.points = defaultPoints;
            await targetQuestion.save();

            // Clear any mid-round submissions for the replaced question so all students can answer the new question
            await Submission.deleteMany({
              eventId: event._id,
              questionId: currentQ._id,
              roundNumber: event.currentRoundNumber,
            });

            // Update playedQuestionIds: remove replaced currentQ, and add targetQuestion
            event.playedQuestionIds = (event.playedQuestionIds || []).filter(
              id => id.toString() !== currentQ._id.toString()
            );
          }

          if (!event.playedQuestionIds) event.playedQuestionIds = [];
          if (!event.playedQuestionIds.some(id => id.toString() === targetQuestion._id.toString())) {
            event.playedQuestionIds.push(targetQuestion._id);
          }

          event.currentQuestionId = targetQuestion._id;

          // Fresh timer started synchronously
          const now = new Date();
          const timeLimitSeconds = targetQuestion.timeLimitSeconds || 20;
          const deadlineAt = new Date(now.getTime() + timeLimitSeconds * 1000);

          event.roundTimer = {
            questionId: targetQuestion._id,
            roundNumber: event.currentRoundNumber,
            startedAt: now,
            deadlineAt,
            timeLimitSeconds,
            pausedAt: null,
            remainingMs: null,
            roundStatus: 'active',
          };
          await event.save();

          setActiveRound(event, targetQuestion);
          scheduleRoundTimeout(io, event, timeLimitSeconds * 1000);

          const payload = {
            roundNumber: event.currentRoundNumber,
            totalRounds: event.totalRounds,
            questionText: targetQuestion.questionText,
            questionImage: targetQuestion.questionImage || '',
            options: targetQuestion.options || [],
            questionType: targetQuestion.questionType || 'mcq',
            category: targetQuestion.category,
            difficulty: targetQuestion.difficulty,
            timeLimitSeconds,
            deadlineAt,
            serverTime: now.getTime(),
            remainingMs: timeLimitSeconds * 1000,
            switchedAtRuntime: true,
          };

          // Send instantly to all participants and admin screens
          io.to('participants').emit('question:new', payload);
          io.to('admins').emit('question:admin', {
            ...payload,
            points: targetQuestion.points,
          });

          io.emit('question:difficulty_updated', {
            questionId: targetQuestion._id,
            roundNumber: event.currentRoundNumber,
            difficulty: targetQuestion.difficulty,
            points: targetQuestion.points,
            switchedAtRuntime: true,
          });

          await broadcastGameState(io, event);
          return;
        }

        // ── CASE 2: Game is ready or idle between rounds ──────────────────────
        const nextRound = event.currentRoundNumber + 1;
        let question = null;
        if (questionId) {
          question = await Question.findById(questionId);
        } else if (roundNumber) {
          question = await Question.findOne({ eventId: event._id, roundNumber });
        } else {
          question = await Question.findOne({ eventId: event._id, roundNumber: nextRound });
        }

        if (question) {
          let matchingQ = await Question.findOne({
            eventId: event._id,
            _id: { $nin: event.playedQuestionIds || [], $ne: question._id },
            difficulty,
            roundNumber: { $gt: event.currentRoundNumber },
          }).sort({ roundNumber: 1 });

          if (matchingQ) {
            await safeSwapQuestionRounds(question, matchingQ);
            question = matchingQ;
          } else {
            question.difficulty = difficulty;
            question.points = defaultPoints;
            await question.save();
          }
        }

        if (question) {
          io.emit('question:difficulty_updated', {
            questionId: question._id,
            roundNumber: question.roundNumber,
            difficulty: question.difficulty,
            points: question.points,
            switchedAtRuntime: false,
          });
        }

        await broadcastGameState(io, event);
      } catch (err) {
        console.error('change_question_difficulty error:', err);
        socket.emit('error', { message: 'Failed to update difficulty' });
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
