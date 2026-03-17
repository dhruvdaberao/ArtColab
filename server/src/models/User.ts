import { InferSchemaType, Schema, Types, model } from 'mongoose';

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

export type UserSchema = InferSchemaType<typeof userSchema>;
export type UserId = Types.ObjectId | string;

export type UserDoc = UserSchema & {
  _id: UserId;
  createdAt: Date;
  updatedAt: Date;
};

export const User = model<UserSchema>('User', userSchema);
