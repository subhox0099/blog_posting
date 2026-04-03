const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
  },
  { _id: false }
);

const websiteSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    domain: { type: String, required: true, trim: true, unique: true },
    categories: {
      type: [categorySchema],
      default: [],
      validate: {
        validator(arr) {
          const slugs = arr.map((c) => c.slug);
          return slugs.length === new Set(slugs).size;
        },
        message: 'Category slugs must be unique within a website',
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Website', websiteSchema);
