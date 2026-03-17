import { InferSchemaType, Schema, Types, model } from 'mongoose';

const pointSchema = new Schema(
  {
    x: { type: Number, required: true },
    y: { type: Number, required: true }
  },
  { _id: false }
);

const strokeSchema = new Schema(
  {
    strokeId: { type: String, required: true },
    roomId: { type: String, required: true },
    userId: { type: String, required: true },
    tool: { type: String, enum: ['pen', 'eraser'], required: true },
    brushStyle: { type: String, enum: ['classic', 'rainbow', 'neon', 'dotted', 'spray'], default: 'classic' },
    color: { type: String, required: true },
    size: { type: Number, required: true },
    points: { type: [pointSchema], default: [] },
    timestamp: { type: Number, required: true }
  },
  { _id: false }
);

const stickerSchema = new Schema(
  {
    stickerId: { type: String, required: true },
    roomId: { type: String, required: true },
    userId: { type: String, required: true },
    value: { type: String, required: true },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    size: { type: Number, required: true },
    timestamp: { type: Number, required: true }
  },
  { _id: false }
);

const roomSchema = new Schema(
  {
    roomId: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, unique: true, trim: true },
    visibility: { type: String, enum: ['public', 'private'], required: true, default: 'public' },
    passwordHash: { type: String, default: null },
    ownerType: { type: String, enum: ['user', 'guest'], required: true },
    ownerId: { type: String, required: true },
    ownerName: { type: String, required: true },
    lastActiveAt: { type: Date, default: Date.now },
    canvasState: {
      strokes: { type: [strokeSchema], default: [] },
      stickers: { type: [stickerSchema], default: [] },
      lastSavedAt: { type: Date, default: null },
      version: { type: Number, default: 1 }
    },
    previewImageUrl: { type: String, default: null }
  },
  { timestamps: true }
);

roomSchema.index({ name: 1 }, { unique: true });
roomSchema.index({ createdAt: -1 });
roomSchema.index({ ownerId: 1, ownerType: 1 });

export type RoomSchema = InferSchemaType<typeof roomSchema>;

export type RoomDoc = RoomSchema & {
  _id: Types.ObjectId | string;
  createdAt: Date;
  updatedAt: Date;
};

export const Room = model<RoomSchema>('Room', roomSchema);
