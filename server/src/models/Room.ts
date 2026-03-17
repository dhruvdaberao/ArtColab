import { Schema, model } from 'mongoose';

const roomSchema = new Schema(
  {
    roomId: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, unique: true, trim: true },
    visibility: { type: String, enum: ['public', 'private'], required: true, default: 'public' },
    passwordHash: { type: String, default: null },
    ownerType: { type: String, enum: ['user', 'guest'], required: true },
    ownerId: { type: String, required: true },
    ownerName: { type: String, required: true },
    lastActiveAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

roomSchema.index({ name: 1 }, { unique: true });
roomSchema.index({ createdAt: -1 });
roomSchema.index({ ownerId: 1, ownerType: 1 });

export interface RoomDoc {
  _id: string;
  roomId: string;
  name: string;
  visibility: 'public' | 'private';
  passwordHash: string | null;
  ownerType: 'user' | 'guest';
  ownerId: string;
  ownerName: string;
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const Room = model('Room', roomSchema);
