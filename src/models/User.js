import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['client', 'serviceProvider', 'admin'], default: 'client' },
    status: { type: String, enum: ['pending', 'active'], default: 'pending', index: true },
    interests: [String],
    phone: String,
    verified: { type: Boolean, default: false },
    avatar: String,
    // Service Provider-specific fields
    taxId: String,
    licenseNumber: String,
    documents: [
      {
        url: { type: String, required: true },
        publicId: { type: String }, // Cloudinary public ID for deletion
        name: { type: String },
        type: { type: String }, // e.g., 'license', 'certificate', 'id'
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    // Client-specific fields
    address: String,
    nationality: String,
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Prevent model recompilation during hot reload
export const User = mongoose.models.User || mongoose.model('User', userSchema);


