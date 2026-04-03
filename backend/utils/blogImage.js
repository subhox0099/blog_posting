/**
 * Converts stored image bytes in MongoDB into a `imageUrl` data-URL string.
 * We delete the raw `image` field to keep responses smaller/safer.
 */
function formatBlogImage(blog) {
  if (!blog || !blog.image?.data) return blog;

  const contentType = blog.image.contentType || 'image/jpeg';

  // When Mongoose serializes `Buffer` into JSON, it can come as a base64 string.
  if (typeof blog.image.data === 'string') {
    blog.imageUrl = `data:${contentType};base64,${blog.image.data}`;
    delete blog.image;
    return blog;
  }

  // Handle both Buffer and `{ type: 'Buffer', data: [...] }` shapes.
  let buf = blog.image.data;
  if (buf && buf.type === 'Buffer' && Array.isArray(buf.data)) {
    buf = Buffer.from(buf.data);
  }

  if (!Buffer.isBuffer(buf)) return blog;

  blog.imageUrl = `data:${contentType};base64,${buf.toString('base64')}`;
  delete blog.image;
  return blog;
}

function formatBlogsImages(items) {
  if (!Array.isArray(items)) return items;
  return items.map((b) => formatBlogImage(b));
}

module.exports = { formatBlogImage, formatBlogsImages };

