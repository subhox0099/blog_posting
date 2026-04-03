const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Blog = require('../models/Blog');
const Website = require('../models/Website');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { isStrongPassword } = require('../utils/passwordPolicy');
const { getMainDbConnection, getPublishedBlogModel } = require('../config/mainDb');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parsePagination(req) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  let limit = parseInt(req.query.limit, 10) || DEFAULT_LIMIT;
  limit = Math.min(Math.max(1, limit), MAX_LIMIT);
  return { page, limit, skip: (page - 1) * limit };
}

async function listWebsites(req, res) {
  const sites = await Website.find().select('name domain categories').sort({ name: 1 }).lean();
  return res.json({ items: sites });
}

/**
 * Moderation queue per website. ?status=PENDING|APPROVED|REJECTED (default PENDING).
 */
async function listBlogsForWebsite(req, res) {
  const { websiteId } = req.params;
  if (!mongoose.isValidObjectId(websiteId)) {
    return res.status(400).json({ message: 'Invalid website id' });
  }
  const site = await Website.findById(websiteId).select('_id').lean();
  if (!site) {
    return res.status(404).json({ message: 'Website not found' });
  }
  const status = req.query.status || 'PENDING';
  if (!['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status filter' });
  }
  const { page, limit, skip } = parsePagination(req);
  const filter = { websiteId, status };
  const [items, total] = await Promise.all([
    Blog.find(filter)
      .select('-image')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('authorId', 'email role')
      .lean(),
    Blog.countDocuments(filter),
  ]);
  return res.json({
    items,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
    status,
  });
}

/** Full blog for admin preview (any website). */
async function getBlogById(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: 'Invalid blog id' });
  }
  const blog = await Blog.findById(id)
    .select('-image')
    .populate('authorId', 'email role')
    .lean();
  if (!blog) {
    return res.status(404).json({ message: 'Blog not found' });
  }
  return res.json(blog);
}

async function approveBlog(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: 'Invalid blog id' });
  }

  // Step 1: fetch the pending blog (full details, but exclude raw image bytes)
  const pending = await Blog.findOne({ _id: id, status: 'PENDING' }).select('-image').lean();
  if (!pending) {
    return res.status(404).json({ message: 'Blog not found or not pending moderation' });
  }

  // Step 2: optional mirror to main-site DB — must not block approval in moderation DB
  const mainConn = await getMainDbConnection();
  if (mainConn) {
    try {
      const PublishedBlog = getPublishedBlogModel(mainConn);
      await PublishedBlog.updateOne(
        { sourceBlogId: pending._id },
        {
          $set: {
            sourceBlogId: pending._id,
            websiteId: pending.websiteId,
            category: pending.category,
            title: pending.title,
            description: pending.description,
            content: pending.content,
            authorName: pending.authorName,
            publishDate: pending.publishDate,
            imageUrl: pending.imageUrl,
            createdAt: pending.createdAt || new Date(),
          },
        },
        { upsert: true }
      );
    } catch (e) {
      console.error('Published blog mirror (published_blogs) failed:', e.message);
    }
  }

  // Step 3: only after publish succeeds, mark approved locally
  const blog = await Blog.findOneAndUpdate(
    { _id: id, status: 'PENDING' },
    { $set: { status: 'APPROVED' } },
    { new: true, runValidators: false }
  )
    .select('-image')
    .populate('authorId', 'email');

  if (!blog) {
    // rare race: it was approved/rejected after we published
    return res.status(409).json({ message: 'Blog moderation state changed, please refresh.' });
  }

  return res.json(blog.toObject());
}

async function rejectBlog(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: 'Invalid blog id' });
  }
  const blog = await Blog.findOneAndUpdate(
    { _id: id, status: 'PENDING' },
    { $set: { status: 'REJECTED' } },
    { new: true, runValidators: false }
  )
    .select('-image')
    .populate('authorId', 'email');
  if (!blog) {
    return res.status(404).json({ message: 'Blog not found or not pending moderation' });
  }
  return res.json(blog.toObject());
}

module.exports = { listWebsites, listBlogsForWebsite, getBlogById, approveBlog, rejectBlog };

// ---------------- Employee management (ADMIN only) ----------------

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

async function audit(req, action, targetUserId, websiteId, meta = {}) {
  try {
    await AuditLog.create({
      actorId: req.auth.userId,
      action,
      targetUserId: targetUserId || null,
      websiteId: websiteId || null,
      meta,
    });
  } catch {
    
  }
}

async function createEmployee(req, res) {
  const email = normalizeEmail(req.body.email);
  const password = req.body.password;
  const websiteId = req.body.websiteId;

  if (!email) return res.status(400).json({ message: 'Email is required' });
  if (!mongoose.isValidObjectId(websiteId)) return res.status(400).json({ message: 'Invalid websiteId' });
  if (!isStrongPassword(password)) {
    return res.status(400).json({
      message: 'Weak password: must be 8+ chars and include letters, numbers, and symbols',
    });
  }

  const site = await Website.findById(websiteId).select('_id').lean();
  if (!site) return res.status(404).json({ message: 'Website not found' });

  const exists = await User.findOne({ email }).select('_id').lean();
  if (exists) return res.status(409).json({ message: 'Email already exists' });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    email,
    password: passwordHash,
    role: 'EMPLOYEE',
    websiteId,
    isActive: true,
  });

  await audit(req, 'EMPLOYEE_CREATE', user._id, websiteId, { email });

  return res.status(201).json({
    id: user._id,
    email: user.email,
    role: user.role,
    websiteId: user.websiteId,
    isActive: user.isActive,
    createdAt: user.createdAt,
  });
}

async function listEmployees(req, res) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  let limit = parseInt(req.query.limit, 10) || 25;
  limit = Math.min(Math.max(1, limit), 100);
  const skip = (page - 1) * limit;

  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
  const websiteId = req.query.websiteId;

  const filter = { role: 'EMPLOYEE' };
  if (q) filter.email = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  if (websiteId && mongoose.isValidObjectId(websiteId)) filter.websiteId = websiteId;

  const [items, total] = await Promise.all([
    User.find(filter)
      .select('email websiteId isActive createdAt updatedAt')
      .populate('websiteId', 'name domain')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  return res.json({
    items,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  });
}

async function updateEmployee(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Invalid employee id' });

  const patch = {};
  if (req.body.email != null) {
    const email = normalizeEmail(req.body.email);
    if (!email) return res.status(400).json({ message: 'Email cannot be empty' });
    patch.email = email;
  }
  if (req.body.websiteId != null) {
    const websiteId = req.body.websiteId;
    if (!mongoose.isValidObjectId(websiteId)) return res.status(400).json({ message: 'Invalid websiteId' });
    const site = await Website.findById(websiteId).select('_id').lean();
    if (!site) return res.status(404).json({ message: 'Website not found' });
    patch.websiteId = websiteId;
  }

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ message: 'No fields to update' });
  }

  try {
    const updated = await User.findOneAndUpdate(
      { _id: id, role: 'EMPLOYEE' },
      { $set: patch },
      { new: true, runValidators: true }
    )
      .select('email websiteId isActive createdAt updatedAt')
      .populate('websiteId', 'name domain')
      .lean();

    if (!updated) return res.status(404).json({ message: 'Employee not found' });

    await audit(req, 'EMPLOYEE_UPDATE', id, updated.websiteId?._id || updated.websiteId, { patch: Object.keys(patch) });

    return res.json(updated);
  } catch (e) {
    if (e && e.code === 11000) return res.status(409).json({ message: 'Email already exists' });
    throw e;
  }
}

async function setEmployeeStatus(req, res) {
  const { id } = req.params;
  const { isActive } = req.body;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Invalid employee id' });
  if (typeof isActive !== 'boolean') return res.status(400).json({ message: 'isActive must be boolean' });

  const updated = await User.findOneAndUpdate(
    { _id: id, role: 'EMPLOYEE' },
    { $set: { isActive } },
    { new: true }
  )
    .select('email websiteId isActive createdAt updatedAt')
    .populate('websiteId', 'name domain')
    .lean();

  if (!updated) return res.status(404).json({ message: 'Employee not found' });

  await audit(req, 'EMPLOYEE_STATUS', id, updated.websiteId?._id || updated.websiteId, { isActive });

  return res.json(updated);
}

async function deleteEmployee(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Invalid employee id' });

  const deleted = await User.findOneAndDelete({ _id: id, role: 'EMPLOYEE' }).select('_id websiteId email').lean();
  if (!deleted) return res.status(404).json({ message: 'Employee not found' });

  await audit(req, 'EMPLOYEE_DELETE', id, deleted.websiteId, { email: deleted.email });

  return res.json({ ok: true });
}

async function resetEmployeePassword(req, res) {
  const { id } = req.params;
  const { password } = req.body;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Invalid employee id' });
  if (!isStrongPassword(password)) {
    return res.status(400).json({
      message: 'Weak password: must be 8+ chars and include letters, numbers, and symbols',
    });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const updated = await User.findOneAndUpdate(
    { _id: id, role: 'EMPLOYEE' },
    { $set: { password: passwordHash } },
    { new: true }
  ).select('_id websiteId email').lean();
  if (!updated) return res.status(404).json({ message: 'Employee not found' });

  await audit(req, 'EMPLOYEE_PASSWORD_RESET', id, updated.websiteId, { email: updated.email });

  return res.json({ ok: true });
}

module.exports.createEmployee = createEmployee;
module.exports.listEmployees = listEmployees;
module.exports.updateEmployee = updateEmployee;
module.exports.setEmployeeStatus = setEmployeeStatus;
module.exports.deleteEmployee = deleteEmployee;
module.exports.resetEmployeePassword = resetEmployeePassword;
