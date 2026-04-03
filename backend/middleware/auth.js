const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_ALG = 'HS256';

function signToken(user) {
  const websiteId = user.websiteId ? user.websiteId.toString() : null;
  return jwt.sign(
    {
      userId: user._id.toString(),
      role: user.role,
      websiteId,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h', algorithm: JWT_ALG }
  );
}

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or invalid Authorization header' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: [JWT_ALG],
    });
    const userId = String(payload.userId);

    // Enforce isActive + authoritative websiteId/role from DB so deactivated users
    // can't keep using old tokens and employees can't be re-scoped client-side.
    const u = await User.findById(userId).select('role websiteId isActive').lean();
    if (!u) return res.status(401).json({ message: 'Invalid token user' });
    if (u.isActive === false) return res.status(403).json({ message: 'Account is disabled' });

    req.auth = {
      userId,
      role: u.role,
      websiteId: u.websiteId ? String(u.websiteId) : null,
    };

    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth) return res.status(401).json({ message: 'Unauthorized' });
    if (!roles.includes(req.auth.role)) {
      return res.status(403).json({ message: 'Forbidden: insufficient role' });
    }
    return next();
  };
}

/**
 * ADMIN: any website. EMPLOYEE: only their JWT websiteId.
 */
function requireEmployeeWebsiteMatch(paramName = 'websiteId') {
  return (req, res, next) => {
    if (!req.auth) return res.status(401).json({ message: 'Unauthorized' });
    if (req.auth.role === 'ADMIN') return next();
    if (req.auth.role === 'EMPLOYEE' && !req.auth.websiteId) {
      return res.status(403).json({ message: 'Employee token missing website scope' });
    }
    const param = req.params[paramName];
    if (!param || String(param) !== req.auth.websiteId) {
      return res.status(403).json({ message: 'Forbidden: website scope mismatch' });
    }
    return next();
  };
}

module.exports = { signToken, authMiddleware, requireRole, requireEmployeeWebsiteMatch };
