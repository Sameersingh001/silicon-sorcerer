const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
    index: true,
  },
  participantId: {
    type: String,
    required: true,
    index: true,
  },
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: true,
  },
  roundNumber: {
    type: Number,
    required: true,
  },
  submittedAnswer: {
    type: String,
    required: true,
    trim: true,
  },
  isCorrect: {
    type: Boolean,
    required: true,
  },
  pointsAwarded: {
    type: Number,
    default: 0,
  },
  // Server-recorded submission timestamp
  submittedAt: {
    type: Date,
    default: Date.now,
  },
  // Time from round start to submission in milliseconds
  responseTimeMs: {
    type: Number,
    default: 0,
  },
});

// Prevent duplicate submissions: one per participant per question
submissionSchema.index({ participantId: 1, questionId: 1 }, { unique: true });
submissionSchema.index({ eventId: 1, questionId: 1 });
submissionSchema.index({ eventId: 1, questionId: 1, isCorrect: 1 });

module.exports = mongoose.model('Submission', submissionSchema);

