const mongoose = require('mongoose');

let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  // If already connected, return existing connection immediately
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  if (cached.conn) {
    return cached.conn;
  }

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/qr_quest';

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    }).then((conn) => {
      console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
      return conn;
    }).catch(async (error) => {
      // If Atlas connection fails (e.g. IP whitelist / network issue), fallback to local MongoDB in dev
      if (uri !== 'mongodb://localhost:27017/qr_quest') {
        console.warn(`⚠️ Primary MongoDB connection failed: ${error.message}`);
        console.log(`🔄 Attempting fallback to local MongoDB at mongodb://localhost:27017/qr_quest...`);
        try {
          const localConn = await mongoose.connect('mongodb://localhost:27017/qr_quest', {
            serverSelectionTimeoutMS: 3000,
          });
          console.log(`✅ Fallback connected to local MongoDB: ${localConn.connection.host}`);
          return localConn;
        } catch (localErr) {
          console.error(`❌ Local MongoDB fallback also failed: ${localErr.message}`);
        }
      }
      cached.promise = null;
      console.error(`❌ MongoDB connection error: ${error.message}`);
      throw error;
    });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (err) {
    cached.promise = null;
    throw err;
  }
};

module.exports = connectDB;
