/**
 * Seeds websites, categories, and users with known demo credentials.
 *
 * Usage (from backend/):
 *   npm run seed
 *
 * Requires MONGODB_URI in backend/.env (same database the API uses).
 * JWT_SECRET is not required for seeding (only for running the API).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const Blog = require('../models/Blog');
const Website = require('../models/Website');
const User = require('../models/User');
const { isQuerySrvFailure, printAtlasSrvHint } = require('../utils/mongoErrors');

/** Single shared password for all demo accounts (change in production). */
const DEMO_PASSWORD = 'Password123!';

/**
 * Accounts created by this script — use these to sign in via POST /auth/login.
 * websiteId is set for EMPLOYEE rows after websites are inserted.
 */
const SEED_ACCOUNTS = [
  { email: 'admin@demo.com', role: 'ADMIN', websiteKey: null },
  { email: 'alice@techpulse.demo', role: 'EMPLOYEE', websiteKey: 'techpulse' },
  { email: 'bob@lifencode.demo', role: 'EMPLOYEE', websiteKey: 'lifencode' },
];

const MONGODB_URI = process.env.MONGODB_URI;

async function run() {
  if (!MONGODB_URI) {
    console.error('Missing MONGODB_URI. Add it to backend/.env');
    process.exit(1);
  }
  const dns = require('dns');
  dns.setDefaultResultOrder('ipv4first');
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 20_000,
    ...(process.platform === 'win32' ? { family: 4 } : {}),
  });

  // Full reset so websiteIds and users stay consistent
  await Promise.all([Blog.deleteMany({}), User.deleteMany({}), Website.deleteMany({})]);

  const techSite = await Website.create({
    name: 'TechPulse',
    domain: 'techpulse.demo',
    categories: [
      { name: 'Engineering', slug: 'engineering' },
      { name: 'Product', slug: 'product' },
      { name: 'Security', slug: 'security' },
    ],
  });

  const lifeSite = await Website.create({
    name: 'Life & Code',
    domain: 'lifencode.demo',
    categories: [
      { name: 'Lifestyle', slug: 'lifestyle' },
      { name: 'Tutorials', slug: 'tutorials' },
    ],
  });

  const websiteByKey = {
    techpulse: techSite._id,
    lifencode: lifeSite._id,
  };

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const usersPayload = SEED_ACCOUNTS.map((a) => ({
    email: a.email,
    password: passwordHash,
    role: a.role,
    websiteId: a.websiteKey ? websiteByKey[a.websiteKey] : null,
  }));

  await User.create(usersPayload);
  

  console.log('\n=== Seed complete ===\n');
  console.log('Password for every account:', DEMO_PASSWORD);
  console.log('');
  console.log('Role      | Email                    | Website ID (for /site/:id)');
  console.log('----------|--------------------------|----------------------------------');
  console.log(
    `ADMIN     | ${'admin@demo.com'.padEnd(24)} | (all sites — use admin dashboard)`
  );
  console.log(
    `EMPLOYEE  | ${'alice@techpulse.demo'.padEnd(24)} | ${techSite._id.toString()}`
  );
  console.log(
    `EMPLOYEE  | ${'bob@lifencode.demo'.padEnd(24)} | ${lifeSite._id.toString()}`
  );
  console.log('');
  console.log('Websites:');
  console.log(`  TechPulse:   ${techSite._id}`);
  console.log(`  Life & Code: ${lifeSite._id}`);
  console.log('');

  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e.message || e);
  if (isQuerySrvFailure(e)) printAtlasSrvHint();
  process.exit(1);
});


console.log("URI:", process.env.MONGODB_URI);