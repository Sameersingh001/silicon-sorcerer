const Submission = require('../models/Submission');
const Participant = require('../models/Participant');
const Question = require('../models/Question');
const Event = require('../models/Event');
const { validateAnswer } = require('./answerValidator');

// In-memory active round cache for sub-millisecond lookups
let activeRoundState = {
  eventId: null,
  roundNumber: 0,
  questionId: null,
  questionText: '',
  correctAnswer: '',
  acceptedAnswers: [],
  points: 10,
  startedAt: null,
  deadlineAt: null,
  roundStatus: 'idle', // 'idle' | 'active' | 'paused' | 'closed'
  submittedParticipants: new Set(),
};

// Fast in-memory participant cache: tokenHash -> { participantId, fullName, course, eventId }
const participantCache = new Map();

// Debounce handle for admin live stats to prevent DB thrashing during multiple phone submissions
let statsDebounceTimer = null;
let cachedParticipantCount = null;

const setActiveRound = (event, question) => {
  activeRoundState = {
    eventId: event._id.toString(),
    roundNumber: question.roundNumber,
    questionId: question._id.toString(),
    questionText: question.questionText,
    correctAnswer: question.correctAnswer,
    acceptedAnswers: question.acceptedAnswers || [],
    difficulty: question.difficulty || 'beginner',
    // Introduction level always 0 points (extra safety check in engine)
    points: question.difficulty === 'introduction' ? 0 : (question.points || 10),
    startedAt: event.roundTimer?.startedAt || new Date(),
    deadlineAt: event.roundTimer?.deadlineAt,
    roundStatus: 'active',
    submittedParticipants: new Set(),
  };
};

const closeActiveRound = (roundNumber) => {
  if (activeRoundState) {
    activeRoundState.roundStatus = 'closed';
  }
};

const pauseActiveRound = (remainingMs) => {
  if (activeRoundState) {
    activeRoundState.roundStatus = 'paused';
  }
};

const resumeActiveRound = (newDeadlineAt) => {
  if (activeRoundState) {
    activeRoundState.roundStatus = 'active';
    activeRoundState.deadlineAt = newDeadlineAt;
  }
};

const updateActiveRoundDifficulty = (difficulty, points) => {
  if (activeRoundState) {
    activeRoundState.difficulty = difficulty;
    activeRoundState.points = difficulty === 'introduction' ? 0 : (points ?? activeRoundState.points);
  }
};

const resetEngine = () => {
  activeRoundState = {
    eventId: null,
    roundNumber: 0,
    questionId: null,
    questionText: '',
    correctAnswer: '',
    acceptedAnswers: [],
    points: 10,
    startedAt: null,
    deadlineAt: null,
    roundStatus: 'idle',
    submittedParticipants: new Set(),
  };
  participantCache.clear();
  cachedParticipantCount = null;
};

const cacheParticipant = (tokenHash, data) => {
  if (tokenHash && data) {
    participantCache.set(tokenHash, {
      participantId: data.participantId,
      fullName: data.fullName,
      course: data.course,
      eventId: data.eventId?.toString() || data.eventId,
    });
  }
};

const getParticipantByToken = async (sessionToken, eventId) => {
  if (!sessionToken) return null;
  const tokenHash = Participant.hashToken(sessionToken);

  if (participantCache.has(tokenHash)) {
    return participantCache.get(tokenHash);
  }

  // Fallback to database lookup with indexed query
  const query = { sessionTokenHash: tokenHash };
  if (eventId) query.eventId = eventId;

  const participant = await Participant.findOne(query)
    .select('participantId fullName course eventId')
    .lean();

  if (participant) {
    const data = {
      participantId: participant.participantId,
      fullName: participant.fullName,
      course: participant.course,
      eventId: participant.eventId.toString(),
    };
    participantCache.set(tokenHash, data);
    return data;
  }

  return null;
};

// Debounced live stats update to avoid executing 3 DB count queries on every concurrent submit
const triggerStatsUpdate = (io, eventId, questionId, roundNumber) => {
  if (!io) return;

  if (statsDebounceTimer) {
    clearTimeout(statsDebounceTimer);
  }

  statsDebounceTimer = setTimeout(async () => {
    try {
      const [totalSubmissions, correctCount, participantCount] = await Promise.all([
        Submission.countDocuments({ eventId, questionId }),
        Submission.countDocuments({ eventId, questionId, isCorrect: true }),
        cachedParticipantCount !== null
          ? Promise.resolve(cachedParticipantCount)
          : Participant.countDocuments({ eventId }).then((c) => {
              cachedParticipantCount = c;
              return c;
            }),
      ]);

      const payload = {
        totalSubmissions,
        correctCount,
        participantCount,
        roundNumber,
      };

      io.to('admins').emit('stats:update', payload);
      io.emit('stats:update', payload);
    } catch (err) {
      console.warn('Stats aggregation error:', err.message);
    }
  }, 100); // 100ms debounce batches concurrent submissions cleanly
};

// Core Ultra-Fast Submission Processing Function
const processAnswerSubmission = async ({ sessionToken, submittedAnswer, io }) => {
  if (!sessionToken || !submittedAnswer) {
    return {
      success: false,
      message: 'Session token and answer required',
      status: 400,
    };
  }

  const rawAnswer = String(submittedAnswer).trim();
  if (!rawAnswer) {
    return {
      success: false,
      message: 'Empty answer submitted',
      status: 400,
    };
  }

  // Ensure active round state is loaded (hydrates from DB if server restarted mid-round)
  if (activeRoundState.roundStatus === 'idle' || !activeRoundState.questionId) {
    const event = await Event.findOne().sort({ createdAt: -1 });
    if (!event || event.status !== 'live' || !event.currentQuestionId) {
      return { success: false, message: 'Game is not currently live', status: 400 };
    }
    if (!event.roundTimer || event.roundTimer.roundStatus !== 'active') {
      return { success: false, message: 'No active round to submit to', status: 400 };
    }
    const currentQuestion = await Question.findById(event.currentQuestionId);
    if (!currentQuestion) {
      return { success: false, message: 'No active question found', status: 400 };
    }
    setActiveRound(event, currentQuestion);
  }

  if (activeRoundState.roundStatus !== 'active') {
    return { success: false, message: 'Round is closed or paused', status: 400 };
  }

  // Fast Deadline Check with 600ms network transmission grace period
  const now = new Date();
  const GRACE_PERIOD_MS = 600;
  if (activeRoundState.deadlineAt && now.getTime() > (new Date(activeRoundState.deadlineAt).getTime() + GRACE_PERIOD_MS)) {
    return { success: false, message: 'Time is up! Submission rejected.', status: 400 };
  }

  // Verify participant
  const participant = await getParticipantByToken(sessionToken, activeRoundState.eventId);
  if (!participant) {
    return {
      success: false,
      message: 'Invalid session. Please register again.',
      status: 401,
    };
  }

  // Instant Duplicate Check (In-Memory O(1))
  if (activeRoundState.submittedParticipants.has(participant.participantId)) {
    return {
      success: false,
      message: 'You have already submitted an answer for this round',
      status: 400,
    };
  }

  // Validate answer against current question
  const isCorrect = validateAnswer(
    rawAnswer,
    activeRoundState.correctAnswer,
    activeRoundState.acceptedAnswers
  );

  const basePoints = activeRoundState.points || 0;
  let pointsAwarded = 0;
  if (basePoints > 0) {
    if (isCorrect) {
      pointsAwarded = basePoints;
    } else {
      // Wrong answer: half points penalty deducted (-50%, score can go negative)
      pointsAwarded = -(basePoints / 2);
    }
  }
  const submittedAt = now;
  const responseTimeMs = activeRoundState.startedAt
    ? Math.max(0, submittedAt.getTime() - new Date(activeRoundState.startedAt).getTime())
    : 0;

  // Mark participant as submitted in-memory immediately to prevent race conditions
  activeRoundState.submittedParticipants.add(participant.participantId);

  // Asynchronously record submission in DB (atomic unique index provides safety)
  try {
    await Submission.create({
      eventId: activeRoundState.eventId,
      participantId: participant.participantId,
      questionId: activeRoundState.questionId,
      roundNumber: activeRoundState.roundNumber,
      submittedAnswer: rawAnswer,
      isCorrect,
      pointsAwarded,
      submittedAt,
      responseTimeMs,
    });
  } catch (dbError) {
    if (dbError.code === 11000) {
      return {
        success: false,
        message: 'Duplicate submission detected',
        status: 400,
      };
    }
    console.error('Submission DB save error:', dbError);
    // Don't fail the response if DB write had a transient issue after in-memory record
  }

  // Real-time asynchronous notification to proctor / admin panel (non-blocking)
  setImmediate(() => {
    try {
      if (io) {
        const subPayload = {
          participantId: participant.participantId,
          fullName: participant.fullName,
          course: participant.course,
          roundNumber: activeRoundState.roundNumber,
          isCorrect,
          pointsAwarded,
          submittedAt,
          responseTimeMs,
          submittedAnswer: rawAnswer,
          correctAnswer: isCorrect ? activeRoundState.correctAnswer : null,
        };

        // Notify proctor/admin dashboard
        io.to('admins').emit('submission:new', subPayload);
        io.emit('answer:submitted', subPayload);

        // Update live stats debounced
        triggerStatsUpdate(
          io,
          activeRoundState.eventId,
          activeRoundState.questionId,
          activeRoundState.roundNumber
        );
      }
    } catch (err) {
      console.warn('Async emit error:', err.message);
    }
  });

  // RETURN RESULT INSTANTLY TO PARTICIPANT
  return {
    success: true,
    isCorrect,
    pointsAwarded,
    responseTimeMs,
    submittedAnswer: rawAnswer,
    message: isCorrect
      ? 'Correct! Well done!'
      : (pointsAwarded < 0 ? `Incorrect answer! ${pointsAwarded} pts deducted.` : 'Submitted! Your answer has been recorded.'),
    status: 200,
  };
};

module.exports = {
  setActiveRound,
  closeActiveRound,
  pauseActiveRound,
  resumeActiveRound,
  updateActiveRoundDifficulty,
  resetEngine,
  cacheParticipant,
  getParticipantByToken,
  processAnswerSubmission,
};
