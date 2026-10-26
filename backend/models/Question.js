const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
    index: true,
  },
  roundNumber: {
    type: Number,
    required: true,
  },
  questionText: {
    type: String,
    required: true,
    trim: true,
  },
  // Optional URL for a diagram, photo, code snippet, or illustration
  questionImage: {
    type: String,
    trim: true,
    default: '',
  },
  correctAnswer: {
    type: String,
    required: true,
    trim: true,
  },
  // Multiple choice options (e.g. [Option A, Option B, Option C, Option D])
  options: {
    type: [String],
    default: [],
  },
  questionType: {
    type: String,
    enum: ['mcq', 'text'],
    default: 'mcq',
  },
  // Array of accepted answers (normalized lowercase, trimmed)
  acceptedAnswers: {
    type: [String],
    default: [],
  },
  points: {
    type: Number,
    default: 10,
  },
  timeLimitSeconds: {
    type: Number,
    default: 20,
  },
  category: {
    type: String,
    trim: true,
    default: 'General',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound index to prevent duplicate round numbers per event
questionSchema.index({ eventId: 1, roundNumber: 1 }, { unique: true });

module.exports = mongoose.model('Question', questionSchema);
