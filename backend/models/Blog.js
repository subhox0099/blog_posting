const mongoose = require('mongoose');

const STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];

const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    authorName: { type: String, required: true, trim: true },
    publishDate: { type: Date, required: true },
    // Convenience field for frontend previews (stored as a data-URL).
    // We still store the raw image bytes in `image` per your requirement.
    imageUrl: { type: String, trim: true },
    // Store the raw image bytes in MongoDB (per your requirement).
    // API responses will include `imageUrl` as a data-URL derived from this buffer.
    image: {
      data: { type: Buffer, required: true },
      contentType: { type: String, required: true },
    },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    websiteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Website', required: true },
    category: {
      name: { type: String, required: true },
      slug: { type: String, required: true, lowercase: true },
    },
    status: { type: String, enum: STATUSES, default: 'PENDING', index: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

blogSchema.index({ websiteId: 1, status: 1, createdAt: -1 });
blogSchema.index({ websiteId: 1, 'category.slug': 1, status: 1, createdAt: -1 });
blogSchema.index({ authorId: 1, createdAt: -1 });
blogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7 });

module.exports = mongoose.model('Blog', blogSchema);
module.exports.STATUSES = STATUSES;
