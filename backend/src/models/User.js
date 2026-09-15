import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['citizen', 'volunteer', 'admin'], default: 'citizen' },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

userSchema.methods.toJSON = function toJSON() {
  const user = this.toObject();
  delete user.passwordHash;
  return user;
};

export default mongoose.model('User', userSchema);
