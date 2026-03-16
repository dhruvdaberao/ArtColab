import { z } from 'zod';

export const roomIdSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6}$/);

export const createRoomSchema = z.object({});

export const joinRoomHttpSchema = z.object({
  displayName: z.string().trim().min(1).max(32)
});

export const joinRoomSocketSchema = z.object({
  roomId: roomIdSchema,
  userId: z.string().trim().min(1).max(64),
  displayName: z.string().trim().min(1).max(32)
});

export const pointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite()
});

export const drawStartSchema = z.object({
  roomId: roomIdSchema,
  stroke: z.object({
    strokeId: z.string().min(1).max(64),
    roomId: roomIdSchema,
    userId: z.string().min(1).max(64),
    tool: z.enum(['pen', 'eraser']),
    color: z.string().max(20),
    size: z.number().min(1).max(64),
    points: z.array(pointSchema).min(1).max(20)
  })
});

export const drawMoveSchema = z.object({
  roomId: roomIdSchema,
  strokeId: z.string().min(1).max(64),
  points: z.array(pointSchema).min(1).max(30)
});

export const drawEndSchema = z.object({
  roomId: roomIdSchema,
  strokeId: z.string().min(1).max(64)
});

export const roomActionSchema = z.object({
  roomId: roomIdSchema
});

export const undoSchema = z.object({
  roomId: roomIdSchema,
  userId: z.string().min(1).max(64)
});
