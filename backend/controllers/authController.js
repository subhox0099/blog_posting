const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { signToken } = require('../middleware/auth');

async function login(req, res) {
  const password = req.body.password;
  // Match how User schema stores emails (lowercase); avoid express-validator normalizeEmail mangling addresses.
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  if (user.isActive === false) {
    return res.status(403).json({ message: 'Account is disabled' });
  }
  if (user.role === 'EMPLOYEE' && !user.websiteId) {
    return res.status(403).json({ message: 'Employee account is not assigned to a website' });
  }
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  const token = signToken(user);
  return res.json({
    token,
    user: {
      id: user._id,
      email: user.email,
      role: user.role,
      websiteId: user.websiteId ? user.websiteId.toString() : null,
    },
  });
}

module.exports = { login };
