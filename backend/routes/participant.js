const express = require('express');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const Participant = require('../models/Participant');
const Event = require('../models/Event');
const { getOrCreateEvent } = require('./event');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const { cacheParticipant } = require('../utils/submissionEngine');

// POST /api/participants/register
router.post('/register', async (req, res) => {
  try {
    const { fullName, course, sessionToken } = req.body;

    if (!fullName || !course) {
      return res.status(400).json({ success: false, message: 'Full name and course are required' });
    }

    const event = await getOrCreateEvent();

    if (event.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Registration is closed. The quiz has ended.' });
    }

    // If participant sends existing sessionToken, restore their session
    if (sessionToken) {
      const tokenHash = Participant.hashToken(sessionToken);
      const existing = await Participant.findOne({ sessionTokenHash: tokenHash, eventId: event._id });
      if (existing) {
        cacheParticipant(tokenHash, {
          participantId: existing.participantId,
          fullName: existing.fullName,
          course: existing.course,
          eventId: event._id,
        });

        return res.json({
          success: true,
          participant: {
            participantId: existing.participantId,
            fullName: existing.fullName,
            course: existing.course,
            sessionToken,
          },
          restored: true,
        });
      }
    }

    // Create new participant
    const newSessionToken = uuidv4();
    const tokenHash = Participant.hashToken(newSessionToken);
    const participantId = `P-${uuidv4().slice(0, 8).toUpperCase()}`;

    const participant = await Participant.create({
      eventId: event._id,
      participantId,
      fullName: fullName.trim(),
      course: course.trim(),
      sessionTokenHash: tokenHash,
    });

    // Cache participant in-memory for instant submission lookups
    cacheParticipant(tokenHash, {
      participantId: participant.participantId,
      fullName: participant.fullName,
      course: participant.course,
      eventId: event._id,
    });

    // Notify admin of new registration via socket asynchronously
    const io = req.app.get('io');
    if (io) {
      setImmediate(async () => {
        try {
          const participantCount = await Participant.countDocuments({ eventId: event._id });
          io.emit('participant:joined', {
            participantId,
            fullName: participant.fullName,
            course: participant.course,
            participantCount,
          });
        } catch (e) {
          console.warn('Participant count notify error:', e.message);
        }
      });
    }

    res.json({
      success: true,
      participant: {
        participantId: participant.participantId,
        fullName: participant.fullName,
        course: participant.course,
        sessionToken: newSessionToken,
      },
      restored: false,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
});

// GET /api/participants - Full list for Admin Panel
router.get('/', authMiddleware, async (req, res) => {
  try {
    const event = await getOrCreateEvent();
    const participants = await Participant.find({ eventId: event._id })
      .select('participantId fullName course registeredAt isConnected warningCount isDisqualified cheatLogs')
      .sort({ registeredAt: -1 });
    res.json({ success: true, participants });
  } catch (error) {
    console.error('Fetch participants error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/participants/cheat-alert - Log anti-cheat warning
router.post('/cheat-alert', async (req, res) => {
  try {
    const { sessionToken, reason = 'Tab switch / app window blur' } = req.body;
    if (!sessionToken) {
      return res.status(400).json({ success: false, message: 'Session token required' });
    }

    const event = await getOrCreateEvent();
    const tokenHash = Participant.hashToken(sessionToken);
    const participant = await Participant.findOne({ sessionTokenHash: tokenHash, eventId: event._id });

    if (!participant) {
      return res.status(404).json({ success: false, message: 'Participant not found' });
    }

    participant.warningCount = (participant.warningCount || 0) + 1;
    participant.cheatLogs.push({
      reason,
      timestamp: new Date(),
      roundNumber: event.currentRoundNumber || 0,
    });

    if (participant.warningCount >= 3) {
      participant.isDisqualified = true;
    }

    await participant.save();

    // Broadcast alert live to all connected admins
    const io = req.app.get('io');
    if (io) {
      io.to('admins').emit('admin:cheating_alert', {
        participantId: participant.participantId,
        fullName: participant.fullName,
        course: participant.course,
        reason,
        warningCount: participant.warningCount,
        isDisqualified: participant.isDisqualified,
        roundNumber: event.currentRoundNumber || 0,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      warningCount: participant.warningCount,
      isDisqualified: participant.isDisqualified,
    });
  } catch (error) {
    console.error('Cheat alert error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
