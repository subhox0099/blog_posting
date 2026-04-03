/** Blog image paths are stored as `/uploads/...` — dev proxy serves them from the API origin. */
export function assetUrl(path) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return path;
}
