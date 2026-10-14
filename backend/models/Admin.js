const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    default: 'admin',
    enum: ['admin', 'superadmin'],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

adminSchema.methods.comparePassword = async function (plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

adminSchema.statics.createDefault = async function () {
  const username = (process.env.ADMIN_USERNAME || 'admin').toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD || 'Admin@123';
  const existing = await this.findOne({ username });
  if (!existing) {
    const hash = await bcrypt.hash(password, 12);
    await this.create({
      username,
      passwordHash: hash,
      role: 'admin',
    });
    console.log('✅ Default admin account created.');
  } else {
    const matches = await bcrypt.compare(password, existing.passwordHash);
    if (!matches) {
      existing.passwordHash = await bcrypt.hash(password, 12);
      await existing.save();
      console.log('✅ Default admin password updated to match .env config.');
    }
  }
};

module.exports = mongoose.model('Admin', adminSchema);
