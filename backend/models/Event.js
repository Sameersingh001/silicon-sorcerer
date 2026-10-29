const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    default: 'Silicon Sorcerer — QR Quest',
    trim: true,
  },
  status: {
    type: String,
    enum: ['draft', 'ready', 'live', 'paused', 'completed'],
    default: 'draft',
  },
  totalRounds: {
    type: Number,
    default: 0,
  },
  currentRoundNumber: {
    type: Number,
    default: 0,
  },
  currentQuestionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    default: null,
  },
  playedQuestionIds: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
    },
  ],
  pointsPerCorrectAnswer: {
    type: Number,
    default: 10,
  },
  // Active round timer state
  roundTimer: {
    questionId: { type: mongoose.Schema.Types.ObjectId, default: null },
    roundNumber: { type: Number, default: 0 },
    startedAt: { type: Date, default: null },
    deadlineAt: { type: Date, default: null },
    timeLimitSeconds: { type: Number, default: 0 },
    pausedAt: { type: Date, default: null },
    remainingMs: { type: Number, default: null },
    roundStatus: {
      type: String,
      enum: ['idle', 'active', 'paused', 'closed'],
      default: 'idle',
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  startedAt: {
    type: Date,
    default: null,
  },
  completedAt: {
    type: Date,
    default: null,
  },
});

module.exports = mongoose.model('Event', eventSchema);
