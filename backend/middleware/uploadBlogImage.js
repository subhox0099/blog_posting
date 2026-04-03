const multer = require('multer');

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

// Store the uploaded bytes in memory so we can write them into MongoDB.
const storage = multer.memoryStorage();

function fileFilter(_req, file, cb) {
  if (ALLOWED_MIME.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, or WebP images are allowed'));
  }
}

const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES },
  fileFilter,
});

/**
 * Multer middleware for field "image" — forwards multer errors as JSON 400.
 */
function uploadBlogImage(req, res, next) {
  upload.single('image')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'Image too large (max 5MB)' });
      }
      return res.status(400).json({ message: err.message || 'Upload error' });
    }
    return res.status(400).json({ message: err.message || 'Invalid file' });
  });
}

module.exports = {
  uploadBlogImage,
};
