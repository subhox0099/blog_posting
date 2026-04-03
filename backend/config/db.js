const mongoose = require('mongoose');

const COMMON_OPTS = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 20_000,
  // Helps some Windows / dual-stack setups reach Atlas (non-SRV URIs):
  ...(process.platform === 'win32' ? { family: 4 } : {}),
};

async function connectDB(uri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, COMMON_OPTS);
  const c = mongoose.connection;
  console.log(`MongoDB (moderation) connected — database: "${c.name}"`);
  return c;
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB };
