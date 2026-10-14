const express = require('express');
const Submission = require('../models/Submission');
const Participant = require('../models/Participant');
const Question = require('../models/Question');
const Event = require('../models/Event');
const { validateAnswer } = require('../utils/answerValidator');
const { getOrCreateEvent } = require('./event');

const router = express.Router();

// POST /api/submissions - Submit answer
router.post('/', async (req, res) => {
  try {
    const { sessionToken, submittedAnswer } = req.body;

    if (!sessionToken || !submittedAnswer) {
      return res.status(400).json({ success: false, message: 'Session token and answer required' });
    }

    const event = await getOrCreateEvent();

    if (event.status !== 'live') {
      return res.status(400).json({ success: false, message: 'Game is not currently live' });
    }

    if (!event.roundTimer || event.roundTimer.roundStatus !== 'active') {
      return res.status(400).json({ success: false, message: 'No active round to submit to' });
    }

    // Server-side deadline check
    const now = new Date();
    if (event.roundTimer.deadlineAt && now > event.roundTimer.deadlineAt) {
      return res.status(400).json({ success: false, message: 'Time is up! Submission rejected.' });
    }

    // Verify participant session
    const tokenHash = Participant.hashToken(sessionToken);
    const participant = await Participant.findOne({
      sessionTokenHash: tokenHash,
      eventId: event._id,
    });

    if (!participant) {
      return res.status(401).json({ success: false, message: 'Invalid session. Please register again.' });
    }

    const currentQuestion = await Question.findById(event.currentQuestionId);
    if (!currentQuestion) {
      return res.status(400).json({ success: false, message: 'No active question' });
    }

    // Check for existing submission (atomic — unique index will also catch race conditions)
    const existingSubmission = await Submission.findOne({
      participantId: participant.participantId,
      questionId: currentQuestion._id,
    });

    if (existingSubmission) {
      return res.status(400).json({ success: false, message: 'You have already submitted an answer for this round' });
    }

    // Validate answer
    const isCorrect = validateAnswer(
      submittedAnswer,
      currentQuestion.correctAnswer,
      currentQuestion.acceptedAnswers
    );

    const pointsAwarded = isCorrect ? currentQuestion.points : 0;
    const submittedAt = new Date();
    const responseTimeMs = event.roundTimer.startedAt
      ? submittedAt.getTime() - new Date(event.roundTimer.startedAt).getTime()
      : 0;

    // Save submission
    let submission;
    try {
      submission = await Submission.create({
        eventId: event._id,
        participantId: participant.participantId,
        questionId: currentQuestion._id,
        roundNumber: currentQuestion.roundNumber,
        submittedAnswer: submittedAnswer.trim(),
        isCorrect,
        pointsAwarded,
        submittedAt,
        responseTimeMs,
      });
    } catch (dbError) {
      if (dbError.code === 11000) {
        return res.status(400).json({ success: false, message: 'Duplicate submission detected' });
      }
      throw dbError;
    }

    // Notify admin of new submission via socket
    const io = req.app.get('io');
    if (io) {
      io.emit('answer:submitted', {
        participantId: participant.participantId,
        fullName: participant.fullName,
        course: participant.course,
        roundNumber: currentQuestion.roundNumber,
        isCorrect,
        pointsAwarded,
        submittedAt,
        responseTimeMs,
        submittedAnswer: submittedAnswer.trim(),
        correctAnswer: isCorrect ? currentQuestion.correctAnswer : null,
      });
    }

    // Count submissions for live stats
    const totalSubmissions = await Submission.countDocuments({
      eventId: event._id,
      questionId: currentQuestion._id,
    });
    const correctCount = await Submission.countDocuments({
      eventId: event._id,
      questionId: currentQuestion._id,
      isCorrect: true,
    });
    const participantCount = await Participant.countDocuments({ eventId: event._id });

    io.emit('stats:update', {
      totalSubmissions,
      correctCount,
      participantCount,
      roundNumber: currentQuestion.roundNumber,
    });

    res.json({
      success: true,
      isCorrect,
      pointsAwarded,
      message: isCorrect ? 'Correct! Well done!' : 'Submitted! Your answer has been recorded.',
    });
  } catch (error) {
    console.error('Submission error:', error);
    res.status(500).json({ success: false, message: 'Submission failed' });
  }
});

module.exports = router;
