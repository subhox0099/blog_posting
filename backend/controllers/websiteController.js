const mongoose = require('mongoose');
const Website = require('../models/Website');

/**
 * Categories for a website (scoped: employee own site or admin).
 */
async function getCategories(req, res) {
  const { websiteId } = req.params;
  if (!mongoose.isValidObjectId(websiteId)) {
    return res.status(400).json({ message: 'Invalid website id' });
  }
  const site = await Website.findById(websiteId).select('categories name domain').lean();
  if (!site) {
    return res.status(404).json({ message: 'Website not found' });
  }
  return res.json({
    websiteId: site._id,
    name: site.name,
    domain: site.domain,
    categories: site.categories || [],
  });
}

module.exports = { getCategories };
