/**
 * Wraps async route handlers so rejections forward to Express error middleware.
 */
function asyncHandler(fn) {
  return function asyncRoute(req, res, next) {
    return Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };
