const mongoose = require('mongoose');
const crypto = require('crypto');

const participantSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
    index: true,
  },
  participantId: {
    type: String,
    required: true,
    unique: true,
  },
  fullName: {
    type: String,
    required: true,
    trim: true,
  },
  course: {
    type: String,
    required: true,
    trim: true,
  },
  // Hashed session token stored in DB; plain token sent to client
  sessionTokenHash: {
    type: String,
    required: true,
  },
  isConnected: {
    type: Boolean,
    default: false,
  },
  warningCount: {
    type: Number,
    default: 0,
  },
  cheatLogs: [
    {
      reason: { type: String, default: 'Tab switch / app window blur' },
      timestamp: { type: Date, default: Date.now },
      roundNumber: { type: Number, default: 0 },
    },
  ],
  isDisqualified: {
    type: Boolean,
    default: false,
  },
  registeredAt: {
    type: Date,
    default: Date.now,
  },
});

participantSchema.statics.hashToken = function (token) {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Fast index lookups for session verification and event participant lists
participantSchema.index({ sessionTokenHash: 1, eventId: 1 });
participantSchema.index({ eventId: 1, registeredAt: -1 });

module.exports = mongoose.model('Participant', participantSchema);

