const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { connectDB, disconnectDB } = require('./config/db');
const { isQuerySrvFailure, printAtlasSrvHint } = require('./utils/mongoErrors');
const { createCorsOptions } = require('./utils/corsOrigins');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const websiteRoutes = require('./routes/websiteRoutes');
const blogRoutes = require('./routes/blogRoutes');
const adminRoutes = require('./routes/adminRoutes');

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is required');
  process.exit(1);
}
if (!MONGODB_URI) {
  console.error('MONGODB_URI is required');
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(cors(createCorsOptions()));
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/health', (req, res) => {
  const c = mongoose.connection;
  res.json({
    ok: true,
    uptime: process.uptime(),
    mongo: {
      readyState: c.readyState,
      /** 0=disconnected 1=connected 2=connecting 3=disconnecting */
      database: c.name || null,
    },
  });
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ message: 'Too many requests, please try again later.' });
  },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  // Don't block the high-utility reads that power the UI.
  skip: (req) => {
    if (req.method !== 'GET') return false;
    return (
      // Employee category dropdown
      /^\/websites\/[^/]+\/categories$/.test(req.path) ||
      // Public browsing
      /^\/blogs\/[^/]+/.test(req.path) ||
      // Employee "My blogs"
      /^\/blogs\/my$/.test(req.path) ||
      // Health checks
      req.path === '/health'
    );
  },
  handler: (_req, res) => {
    res.status(429).json({ message: 'Too many requests, please try again later.' });
  },
});

app.use('/auth', authLimiter, authRoutes);
app.use(apiLimiter);
app.use('/websites', websiteRoutes);
app.use('/blogs', blogRoutes);
app.use('/admin', adminRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

async function start() {
  try {
    await connectDB(MONGODB_URI);
    const server = app.listen(PORT, () => {
      console.log(`API listening on port ${PORT}`);
    });

    async function shutdown(signal) {
      console.log(`${signal} received, closing…`);
      server.close(async () => {
        await disconnectDB();
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10_000).unref();
    }

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (e) {
    console.error('Database connection failed', e.message || e);
    if (isQuerySrvFailure(e)) printAtlasSrvHint();
    process.exit(1);
  }
}

start();
