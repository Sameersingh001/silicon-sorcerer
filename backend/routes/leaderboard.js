const express = require('express');
const Submission = require('../models/Submission');
const Participant = require('../models/Participant');
const Event = require('../models/Event');
const { authMiddleware } = require('../middleware/auth');
const { getOrCreateEvent } = require('./event');

const router = express.Router();

// Build leaderboard from submissions
const buildLeaderboard = async (eventId, questionId = null) => {
  const matchStage = { eventId };
  if (questionId) matchStage.questionId = questionId;

  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: '$participantId',
        totalScore: { $sum: '$pointsAwarded' },
        correctCount: { $sum: { $cond: ['$isCorrect', 1, 0] } },
        totalResponseTimeMs: {
          $sum: { $cond: ['$isCorrect', '$responseTimeMs', 0] },
        },
        submissions: { $push: '$$ROOT' },
      },
    },
    {
      $sort: {
        totalScore: -1,
        totalResponseTimeMs: 1,
      },
    },
  ];

  const results = await Submission.aggregate(pipeline);

  // Fetch participant details
  const participantIds = results.map((r) => r._id);
  const participants = await Participant.find({ participantId: { $in: participantIds } });
  const participantMap = {};
  participants.forEach((p) => { participantMap[p.participantId] = p; });

  return results.map((r, idx) => ({
    rank: idx + 1,
    participantId: r._id,
    fullName: participantMap[r._id]?.fullName || 'Unknown',
    course: participantMap[r._id]?.course || '',
    totalScore: r.totalScore,
    correctCount: r.correctCount,
    totalResponseTimeMs: r.totalResponseTimeMs,
  }));
};

// GET /api/leaderboard/final - Full game leaderboard
router.get('/final', authMiddleware, async (req, res) => {
  try {
    const event = await getOrCreateEvent();
    const leaderboard = await buildLeaderboard(event._id);
    res.json({ success: true, leaderboard });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/leaderboard/round/:roundNumber
router.get('/round/:roundNumber', authMiddleware, async (req, res) => {
  try {
    const event = await getOrCreateEvent();
    const roundNumber = parseInt(req.params.roundNumber);
    const Question = require('../models/Question');
    const question = await Question.findOne({ eventId: event._id, roundNumber });
    if (!question) {
      return res.status(404).json({ success: false, message: 'Round not found' });
    }

    // Get all submissions for this round
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

    res.json({ success: true, roundLeaderboard, roundNumber });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/leaderboard/export - CSV export
router.get('/export', authMiddleware, async (req, res) => {
  try {
    const event = await getOrCreateEvent();
    const leaderboard = await buildLeaderboard(event._id);

    const csvData = leaderboard.map((item) => ({
      Rank: item.rank,
      'Participant Name': item.fullName,
      Course: item.course,
      'Total Score': item.totalScore,
      'Correct Answers': item.correctCount,
      'Total Response Time (ms)': item.totalResponseTimeMs,
    }));

    const fields = ['Rank', 'Participant Name', 'Course', 'Total Score', 'Correct Answers', 'Total Response Time (ms)'];
    const csvRows = [fields.join(',')];
    csvData.forEach((row) => {
      csvRows.push(fields.map((f) => `"${row[f]}"`).join(','));
    });
    const csv = csvRows.join('\n');

    res.setHeader('Content-Disposition', 'attachment; filename=silicon-sorcerer-results.csv');
    res.setHeader('Content-Type', 'text/csv');
    res.send(csv);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Export failed' });
  }
});

module.exports = router;
module.exports.buildLeaderboard = buildLeaderboard;
