import { Schema, model } from 'mongoose';

const userSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 32 },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true },
    profileImage: { type: String, default: '' },
    createdRooms: { type: [String], default: [] },
    joinedRooms: { type: [String], default: [] },
    resetCodeHash: { type: String, default: null },
    resetCodeExpiresAt: { type: Date, default: null }
  },
  {
    timestamps: true
  }
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ username: 1 }, { unique: true });

export interface UserDoc {
  _id: string;
  username: string;
  email: string;
  password: string;
  profileImage: string;
  createdRooms: string[];
  joinedRooms: string[];
  resetCodeHash: string | null;
  resetCodeExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const User = model('User', userSchema);
