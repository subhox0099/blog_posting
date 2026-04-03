/**
 * Parse CORS_ORIGINS or FRONTEND_ORIGIN (comma-separated). Always allows health checks without CORS issue.
 */
function parseCorsOrigins() {
  const raw = process.env.CORS_ORIGINS || process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function createCorsOptions() {
  const allowed = new Set(parseCorsOrigins());
  return {
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowed.has(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  };
}

module.exports = { createCorsOptions, parseCorsOrigins };
