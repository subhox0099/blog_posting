const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true, trim: true },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    websiteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Website', default: null },
    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);

auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ targetUserId: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);

