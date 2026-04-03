const mongoose = require('mongoose');

let conn = null;
let model = null;

function getMainDbUri() {
  return process.env.MAIN_SITE_MONGODB_URI || '';
}

async function getMainDbConnection() {
  const uri = getMainDbUri();
  if (!uri) return null;
  if (conn && conn.readyState === 1) return conn;
  if (conn && conn.readyState === 2) return conn;

  try {
    conn = await mongoose
      .createConnection(uri, {
        maxPoolSize: 5,
        serverSelectionTimeoutMS: 20_000,
        ...(process.platform === 'win32' ? { family: 4 } : {}),
      })
      .asPromise();
    console.log(`MongoDB (main site mirror) connected — database: "${conn.name}"`);
    return conn;
  } catch (e) {
    console.error('[MAIN_SITE_MONGODB_URI] connection failed:', e.message);
    conn = null;
    return null;
  }
}

function getPublishedBlogModel(connection) {
  if (!connection) return null;
  if (model) return model;

  const publishedBlogSchema = new mongoose.Schema(
    {
      sourceBlogId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true, index: true },
      websiteId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
      category: {
        name: { type: String, required: true },
        slug: { type: String, required: true, lowercase: true },
      },
      title: { type: String, required: true, trim: true },
      description: { type: String, required: true, trim: true },
      content: { type: String, required: true },
      authorName: { type: String, required: true, trim: true },
      publishDate: { type: Date, required: true },
      imageUrl: { type: String, required: true },
      // Optional metadata
      createdAt: { type: Date, default: Date.now },
    },
    { timestamps: false }
  );

  publishedBlogSchema.index({ websiteId: 1, publishDate: -1 });
  publishedBlogSchema.index({ websiteId: 1, 'category.slug': 1, publishDate: -1 });

  model = connection.model('PublishedBlog', publishedBlogSchema, 'published_blogs');
  return model;
}

module.exports = { getMainDbConnection, getPublishedBlogModel };

