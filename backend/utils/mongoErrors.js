/**
 * Atlas `mongodb+srv://` uses DNS SRV. Some networks/VPNs/DNS return ECONNREFUSED
 * for `_mongodb._tcp.<cluster>.mongodb.net` — then nothing can connect.
 */
function isQuerySrvFailure(err) {
  return Boolean(err && err.syscall === 'querySrv' && err.code === 'ECONNREFUSED');
}

function printAtlasSrvHint() {
  console.error('');
  console.error('[MongoDB] SRV lookup failed (querySrv ECONNREFUSED). Your network cannot resolve Atlas SRV records.');
  console.error('  Option A — Local dev: install MongoDB locally and use:');
  console.error('    MONGODB_URI=mongodb://127.0.0.1:27017/blog_moderation');
  console.error('  Option B — Stay on Atlas: in Atlas → Connect → Drivers, copy the');
  console.error('    "mongodb://" standard connection string (hosts + ports + ssl + replicaSet),');
  console.error('    not the mongodb+srv:// link — that bypasses SRV DNS.');
  console.error('');
}

module.exports = { isQuerySrvFailure, printAtlasSrvHint };
