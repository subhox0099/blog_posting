const mongoose = require('mongoose');

const ROLES = ['ADMIN', 'EMPLOYEE'];

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true },
    isActive: { type: Boolean, default: true, index: true },
    /** EMPLOYEE must have a website; ADMIN may omit (cross-tenant). */
    websiteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Website',
      default: null,
      required: function employeeNeedsWebsite() {
        return this.role === 'EMPLOYEE';
      },
    },
  },
  { timestamps: true }
);

userSchema.index({ websiteId: 1 });

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
