const mongoose = require('mongoose');
const Blog = require('../models/Blog');
const Website = require('../models/Website');
const { sanitizeBlogContent, sanitizePlainText } = require('../middleware/sanitize');
// We store `imageUrl` on the blog document so list/detail endpoints can exclude raw bytes.

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parsePagination(req) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  let limit = parseInt(req.query.limit, 10) || DEFAULT_LIMIT;
  limit = Math.min(Math.max(1, limit), MAX_LIMIT);
  return { page, limit, skip: (page - 1) * limit };
}

function parsePublishDate(raw) {
  if (raw == null || raw === '') {
    return new Date();
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return d;
}

/**
 * EMPLOYEE: multipart — image file + title, description, content, authorName, publishDate, categorySlug
 */
async function createBlog(req, res) {
  const websiteId = req.auth.websiteId;
  if (!websiteId) {
    return res.status(403).json({ message: 'Only employees can create blogs from this endpoint' });
  }

  if (!req.file) {
    return res.status(400).json({ message: 'Cover image is required' });
  }

  try {
    const {
      title,
      description,
      content,
      authorName,
      publishDate: publishRaw,
      categorySlug,
    } = req.body;

    const site = await Website.findById(websiteId);
    if (!site) {
      return res.status(404).json({ message: 'Website not found' });
    }

    const slug = String(categorySlug || '').toLowerCase().trim();
    if (!slug) {
      return res.status(400).json({ message: 'Invalid category for this website' });
    }
    const cat = site.categories.find((c) => c.slug === slug);
    if (!cat) {
      return res.status(400).json({ message: 'Invalid category for this website' });
    }

    const safeTitle = sanitizePlainText(title);
    if (!safeTitle || safeTitle.length > 500) {
      return res.status(400).json({ message: 'Title is required (max 500 characters)' });
    }

    const safeDescription = sanitizePlainText(description);
    if (!safeDescription || safeDescription.length > 600) {
      return res.status(400).json({ message: 'Description is required (max 600 characters)' });
    }

    const safeContent = sanitizeBlogContent(content);
    if (!safeContent.trim()) {
      return res.status(400).json({ message: 'Content is required' });
    }

    const safeAuthor = sanitizePlainText(authorName);
    if (!safeAuthor || safeAuthor.length > 120) {
      return res.status(400).json({ message: 'Author name is required (max 120 characters)' });
    }

    const publishDate = parsePublishDate(publishRaw);
    if (!publishDate) {
      return res.status(400).json({ message: 'Invalid publish date' });
    }

    const blog = await Blog.create({
      title: safeTitle,
      description: safeDescription,
      content: safeContent,
      authorName: safeAuthor,
      publishDate,
      image: {
        data: req.file.buffer,
        contentType: req.file.mimetype,
      },
      imageUrl: `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`,
      authorId: req.auth.userId,
      websiteId: new mongoose.Types.ObjectId(websiteId),
      category: { name: cat.name, slug: cat.slug },
      status: 'PENDING',
    });
    // Blog already contains `imageUrl`.
    // Exclude raw `image` bytes from the create response to keep it small.
    const obj = blog.toObject ? blog.toObject() : blog;
    if (obj && obj.image) delete obj.image;
    return res.status(201).json(obj);
  } catch (e) {
    throw e;
  }
}

/** EMPLOYEE: blogs authored by JWT user */
async function listMyBlogs(req, res) {
  const authorId = req.auth.userId;
  const { status } = req.query;
  const filter = { authorId: new mongoose.Types.ObjectId(authorId) };
  if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
    filter.status = status;
  }
  const { page, limit, skip } = parsePagination(req);
  const [items, total] = await Promise.all([
    Blog.find(filter).select('-image').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Blog.countDocuments(filter),
  ]);
  return res.json({
    items,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  });
}

async function listApprovedByWebsite(req, res) {
  const { websiteId } = req.params;
  if (!mongoose.isValidObjectId(websiteId)) {
    return res.status(400).json({ message: 'Invalid website id' });
  }
  const { page, limit, skip } = parsePagination(req);
  const filter = { websiteId, status: 'APPROVED' };
  const [items, total] = await Promise.all([
    Blog.find(filter).select('-image').sort({ publishDate: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
    Blog.countDocuments(filter),
  ]);
  return res.json({
    items,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  });
}

async function listLatest(req, res) {
  const { websiteId } = req.params;
  if (!mongoose.isValidObjectId(websiteId)) {
    return res.status(400).json({ message: 'Invalid website id' });
  }
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
  const items = await Blog.find({ websiteId, status: 'APPROVED' })
    .select('-image')
    .sort({ publishDate: -1, createdAt: -1 })
    .limit(limit)
    .lean();
  return res.json({ items });
}

async function listByCategorySlug(req, res) {
  const { websiteId, slug } = req.params;
  if (!mongoose.isValidObjectId(websiteId)) {
    return res.status(400).json({ message: 'Invalid website id' });
  }
  const categorySlug = String(slug || '').toLowerCase();
  if (!categorySlug) {
    return res.status(400).json({ message: 'Invalid category slug' });
  }
  const { page, limit, skip } = parsePagination(req);
  const filter = { websiteId, status: 'APPROVED', 'category.slug': categorySlug };
  const [items, total] = await Promise.all([
    Blog.find(filter)
      .select('-image')
      .sort({ publishDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Blog.countDocuments(filter),
  ]);
  return res.json({
    items,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
    categorySlug,
  });
}

/** Public single post — must be APPROVED and match website */
async function getPublicBlogById(req, res) {
  const { websiteId, blogId } = req.params;
  if (!mongoose.isValidObjectId(websiteId) || !mongoose.isValidObjectId(blogId)) {
    return res.status(400).json({ message: 'Invalid id' });
  }
  const blog = await Blog.findOne({
    _id: blogId,
    websiteId,
    status: 'APPROVED',
  }).select('-image').lean();
  if (!blog) {
    return res.status(404).json({ message: 'Blog not found' });
  }
  return res.json(blog);
}

module.exports = {
  createBlog,
  listMyBlogs,
  listApprovedByWebsite,
  listLatest,
  listByCategorySlug,
  getPublicBlogById,
};
