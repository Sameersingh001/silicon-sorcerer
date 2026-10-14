const express = require('express');
const qrcode = require('qrcode');
const Event = require('../models/Event');
const Question = require('../models/Question');
const Participant = require('../models/Participant');
const { authMiddleware } = require('../middleware/auth');
const Admin = require('../models/Admin');

const router = express.Router();

// Get or create the single event
const getOrCreateEvent = async () => {
  let event = await Event.findOne().sort({ createdAt: -1 });
  if (!event) {
    event = await Event.create({ title: 'Silicon Sorcerer — QR Quest' });
    await Admin.createDefault();
  }
  return event;
};

// GET /api/events/current
router.get('/current', async (req, res) => {
  try {
    const event = await getOrCreateEvent();
    const questionCount = await Question.countDocuments({ eventId: event._id });
    const participantCount = await Participant.countDocuments({ eventId: event._id });

    res.json({
      success: true,
      event: {
        ...event.toObject(),
        questionCount,
        participantCount,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/events/qr - Generate registration QR code
router.get('/qr', authMiddleware, async (req, res) => {
  try {
    const event = await getOrCreateEvent();
    const frontendUrl = (process.env.FRONTEND_URL || req.headers.origin || 'http://localhost:5173').replace(/\/+$/, '');
    const registrationUrl = `${frontendUrl}/register?eventId=${event._id}`;

    const qrDataUrl = await qrcode.toDataURL(registrationUrl, {
      width: 400,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    });

    res.json({ success: true, qrDataUrl, registrationUrl, eventId: event._id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'QR generation failed' });
  }
});

// POST /api/events/reset - Reset event (admin only)
router.post('/reset', authMiddleware, async (req, res) => {
  try {
    const event = await getOrCreateEvent();
    const Question = require('../models/Question');
    const Submission = require('../models/Submission');
    const Participant = require('../models/Participant');

    await Question.deleteMany({ eventId: event._id });
    await Submission.deleteMany({ eventId: event._id });
    await Participant.deleteMany({ eventId: event._id });

    event.status = 'draft';
    event.totalRounds = 0;
    event.currentRoundNumber = 0;
    event.currentQuestionId = null;
    event.startedAt = null;
    event.completedAt = null;
    event.roundTimer = {
      questionId: null,
      roundNumber: 0,
      startedAt: null,
      deadlineAt: null,
      timeLimitSeconds: 0,
      pausedAt: null,
      remainingMs: null,
      roundStatus: 'idle',
    };
    await event.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('game:reset', { message: 'Event has been reset' });
    }

    res.json({ success: true, message: 'Event reset successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Reset failed' });
  }
});

module.exports = router;
module.exports.getOrCreateEvent = getOrCreateEvent;
