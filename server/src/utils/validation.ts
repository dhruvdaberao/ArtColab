import { z } from "zod";

export const roomIdSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6}$/);

const roomNameSchema = z
  .string()
  .trim()
  .min(3, "Room name must be at least 3 characters.")
  .max(48, "Room name must be at most 48 characters.")
  .regex(
    /^[A-Za-z0-9 _-]+$/,
    "Room name can only include letters, numbers, spaces, hyphens, and underscores.",
  );

const roomVisibilitySchema = z.enum(["public", "private"]);

export const createRoomSchema = z
  .object({
    name: roomNameSchema,
    visibility: roomVisibilitySchema,
    password: z.string().max(64).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.visibility === "private" &&
      (!value.password || value.password.trim().length < 4)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Private room password must be at least 4 characters.",
        path: ["password"],
      });
    }
  });

export const joinRoomHttpSchema = z
  .object({
    name: roomNameSchema,
    visibility: roomVisibilitySchema,
    password: z.string().max(64).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.visibility === "private" &&
      (!value.password || value.password.trim().length < 4)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Password is required for private rooms.",
        path: ["password"],
      });
    }
  });

export const updateRoomSchema = z
  .object({
    name: roomNameSchema.optional(),
    visibility: roomVisibilitySchema.optional(),
    password: z.string().max(64).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.visibility === "private" &&
      (!value.password || value.password.trim().length < 4)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Password is required when switching to private.",
        path: ["password"],
      });
    }
  });

export const joinRoomSocketSchema = z.object({
  roomId: roomIdSchema,
  userId: z.string().trim().min(1).max(64),
  displayName: z.string().trim().min(1).max(32),
  avatarUrl: z.string().url().max(2048).optional(),
});

export const pointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

export const drawStartSchema = z.object({
  roomId: roomIdSchema,
  stroke: z.object({
    strokeId: z.string().min(1).max(64),
    roomId: roomIdSchema,
    userId: z.string().min(1).max(64),
    tool: z.enum(["pen", "eraser"]),
    color: z.string().max(20),
    size: z.number().min(1).max(64),
    points: z.array(pointSchema).min(1).max(20),
  }),
});

export const drawMoveSchema = z.object({
  roomId: roomIdSchema,
  strokeId: z.string().min(1).max(64),
  points: z.array(pointSchema).min(1).max(30),
});

export const drawEndSchema = z.object({
  roomId: roomIdSchema,
  strokeId: z.string().min(1).max(64),
});

export const cursorSchema = z.object({
  roomId: roomIdSchema,
  userId: z.string().trim().min(1).max(64),
  displayName: z.string().trim().min(1).max(32),
  avatarUrl: z.string().url().max(2048).optional(),
  x: z.number().min(0).max(1200),
  y: z.number().min(0).max(700),
  drawing: z.boolean(),
});

export const roomActionSchema = z.object({
  roomId: roomIdSchema,
});

export const undoSchema = z.object({
  roomId: roomIdSchema,
  userId: z.string().min(1).max(64),
});
