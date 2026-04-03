const sanitizeHtml = require('sanitize-html');

const SANITIZE_OPTS = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'h3', 'pre', 'code']),
  allowedAttributes: {
    a: ['href', 'name', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    ...sanitizeHtml.defaults.allowedAttributes,
  },
  allowedSchemes: ['http', 'https', 'mailto'],
};

function sanitizeBlogContent(html) {
  return sanitizeHtml(html || '', SANITIZE_OPTS);
}

/** Plain text for titles — no HTML. */
function sanitizePlainText(text) {
  return sanitizeHtml(String(text || '').trim(), { allowedTags: [], allowedAttributes: {} });
}

module.exports = { sanitizeBlogContent, sanitizePlainText };
