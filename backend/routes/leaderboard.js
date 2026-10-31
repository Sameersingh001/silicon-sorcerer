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
  const subMap = {};
  results.forEach((r) => { subMap[r._id] = r; });

  // Fetch all registered participants for the event
  const allParticipants = await Participant.find({ eventId }).lean();

  return allParticipants
    .map((p) => {
      const r = subMap[p.participantId];
      return {
        participantId: p.participantId,
        fullName: p.fullName || 'Unknown',
        course: p.course || '',
        totalScore: r ? r.totalScore : 0,
        correctCount: r ? r.correctCount : 0,
        totalResponseTimeMs: r ? r.totalResponseTimeMs : 0,
      };
    })
    .sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      return a.totalResponseTimeMs - b.totalResponseTimeMs;
    })
    .map((item, idx) => ({ ...item, rank: idx + 1 }));
};

// GET /api/leaderboard/public - Public results endpoint for students (NO auth required)
router.get('/public', async (req, res) => {
  try {
    const event = await getOrCreateEvent();

    // Check if host has published a custom dropped result list
    if (Array.isArray(event.publishedResults) && event.publishedResults.length > 0) {
      const formatted = event.publishedResults.map((r, i) => ({
        rank: r.rank || i + 1,
        participantId: r.participantId,
        fullName: r.fullName,
        course: r.course || '',
        totalScore: r.totalScore,
        correctCount: r.correctCount,
        totalResponseTimeSec: r.totalResponseTimeSec || Number((r.totalResponseTimeMs / 1000).toFixed(2)),
        totalResponseTimeMs: r.totalResponseTimeMs,
      }));

      return res.json({
        success: true,
        isCustom: true,
        eventName: event.title,
        status: event.status,
        leaderboard: formatted,
      });
    }

    // Live calculated leaderboard
    const liveLeaderboard = await buildLeaderboard(event._id);
    const formatted = liveLeaderboard.map((item) => ({
      ...item,
      totalResponseTimeSec: Number((item.totalResponseTimeMs / 1000).toFixed(2)),
    }));

    res.json({
      success: true,
      isCustom: false,
      eventName: event.title,
      status: event.status,
      leaderboard: formatted,
    });
  } catch (error) {
    console.error('Public leaderboard error:', error);
    res.status(500).json({ success: false, message: 'Server error loading results' });
  }
});

// POST /api/leaderboard/publish - Save / publish dropped results list (Admin only)
router.post('/publish', authMiddleware, async (req, res) => {
  try {
    const { results } = req.body;
    if (!Array.isArray(results) || results.length === 0) {
      return res.status(400).json({ success: false, message: 'Results array is required' });
    }

    const event = await getOrCreateEvent();
    event.publishedResults = results.map((r, idx) => ({
      rank: Number(r.rank || r.Rank || idx + 1),
      participantId: String(r.participantId || r['Participant ID'] || r.id || `P-${idx + 1}`).trim(),
      fullName: String(r.fullName || r.participantName || r['Participant Name'] || r.name || 'Contender').trim(),
      course: String(r.course || r.Course || '').trim(),
      totalScore: Number(r.totalScore ?? r['Total Score'] ?? r.score ?? 0),
      correctCount: Number(r.correctCount ?? r.correctAnswers ?? r['Correct Answers'] ?? 0),
      totalResponseTimeSec: Number(
        r.totalResponseTimeSec ??
        r['Total Response Time (s)'] ??
        (Number(r.totalResponseTimeMs || r['Total Response Time (ms)'] || 0) / 1000).toFixed(2)
      ),
      totalResponseTimeMs: Number(
        r.totalResponseTimeMs ??
        r['Total Response Time (ms)'] ??
        Math.round(Number(r.totalResponseTimeSec || r['Total Response Time (s)'] || 0) * 1000)
      ),
    }));

    await event.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('results:updated', { leaderboard: event.publishedResults });
    }

    res.json({ success: true, count: event.publishedResults.length, leaderboard: event.publishedResults });
  } catch (error) {
    console.error('Publish results error:', error);
    res.status(500).json({ success: false, message: 'Failed to publish results' });
  }
});

// DELETE /api/leaderboard/publish - Revert custom dropped results to live calculation (Admin only)
router.delete('/publish', authMiddleware, async (req, res) => {
  try {
    const event = await getOrCreateEvent();
    event.publishedResults = [];
    await event.save();

    const io = req.app.get('io');
    if (io) {
      const liveLeaderboard = await buildLeaderboard(event._id);
      io.emit('results:updated', { leaderboard: liveLeaderboard });
    }

    res.json({ success: true, message: 'Reverted to live results' });
  } catch (error) {
    console.error('Reset results error:', error);
    res.status(500).json({ success: false, message: 'Failed to reset results' });
  }
});

// GET /api/leaderboard/final - Full game leaderboard
router.get('/final', authMiddleware, async (req, res) => {
  try {
    const event = await getOrCreateEvent();
    if (Array.isArray(event.publishedResults) && event.publishedResults.length > 0) {
      return res.json({ success: true, isCustom: true, leaderboard: event.publishedResults });
    }
    const leaderboard = await buildLeaderboard(event._id);
    res.json({ success: true, isCustom: false, leaderboard });
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

// GET /api/leaderboard/export - CSV export (Supports both published results and live leaderboard)
router.get('/export', async (req, res) => {
  try {
    const event = await getOrCreateEvent();
    let leaderboard = [];

    if (Array.isArray(event.publishedResults) && event.publishedResults.length > 0) {
      leaderboard = event.publishedResults;
    } else {
      leaderboard = await buildLeaderboard(event._id);
    }

    const csvData = leaderboard.map((item, idx) => ({
      Rank: item.rank || idx + 1,
      'Participant ID': item.participantId,
      'Participant Name': item.fullName,
      Course: item.course || '',
      'Total Score': item.totalScore ?? 0,
      'Correct Answers': item.correctCount ?? 0,
      'Total Response Time (s)': (Number(item.totalResponseTimeMs || 0) / 1000).toFixed(2),
      'Total Response Time (ms)': item.totalResponseTimeMs ?? 0,
    }));

    const fields = [
      'Rank',
      'Participant ID',
      'Participant Name',
      'Course',
      'Total Score',
      'Correct Answers',
      'Total Response Time (s)',
      'Total Response Time (ms)',
    ];

    const csvRows = [fields.join(',')];
    csvData.forEach((row) => {
      csvRows.push(
        fields
          .map((f) => `"${String(row[f] ?? '').replace(/"/g, '""')}"`)
          .join(',')
      );
    });

    // \uFEFF is UTF-8 Byte Order Mark (BOM) so Excel opens UTF-8 text cleanly
    const csv = '\uFEFF' + csvRows.join('\r\n');

    const filename = `silicon-sorcerer-results-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.send(csv);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ success: false, message: 'Export failed' });
  }
});

module.exports = router;
module.exports.buildLeaderboard = buildLeaderboard;
