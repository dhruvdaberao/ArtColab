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
const toolSchema = z.enum(["pen", "eraser", "fill", "line", "rectangle", "square", "circle", "ellipse", "triangle", "star"]);
const shapeSchema = z.object({
  kind: z.enum(["line", "rectangle", "square", "circle", "ellipse", "triangle", "star"]),
  start: z.object({ x: z.number().finite(), y: z.number().finite() }),
  end: z.object({ x: z.number().finite(), y: z.number().finite() }),
}).optional();

export const createRoomSchema = z
  .object({
    name: roomNameSchema,
    visibility: roomVisibilitySchema,
    password: z.string().max(64).optional(),
    guestDisplayName: z.string().trim().min(1).max(32).optional(),
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
    guestDisplayName: z.string().trim().min(1).max(32).optional(),
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
    tool: toolSchema,
    brushStyle: z.enum(["classic", "rainbow", "neon", "dotted", "spray"]).optional(),
    color: z.string().max(20),
    fillColor: z.string().max(20).nullable().optional(),
    size: z.number().min(1).max(64),
    points: z.array(pointSchema).max(20),
    shape: shapeSchema,
  }).superRefine((stroke, ctx) => {
    const hasShape = !!stroke.shape;
    if (hasShape && stroke.points.length !== 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Shape strokes should not include freehand points.", path: ["points"] });
    }
    if (!hasShape && stroke.points.length < 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Freehand strokes need at least one point.", path: ["points"] });
    }
    if (stroke.tool === "fill" && stroke.points.length !== 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Fill strokes need exactly one point.", path: ["points"] });
    }
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

export const redoSchema = undoSchema;

export const chatSchema = z.object({
  roomId: roomIdSchema,
  userId: z.string().trim().min(1).max(64),
  displayName: z.string().trim().min(1).max(32),
  avatarUrl: z.string().url().max(2048).optional(),
  text: z.string().trim().min(1).max(240),
});

export const reactionSchema = z.object({
  roomId: roomIdSchema,
  userId: z.string().trim().min(1).max(64),
  displayName: z.string().trim().min(1).max(32),
  emoji: z.enum(["❤️", "😂", "😮", "🔥", "🎉"]),
  x: z.number().min(0).max(1200).optional(),
  y: z.number().min(0).max(700).optional(),
});

export const stickerSchema = z.object({
  roomId: roomIdSchema,
  sticker: z.object({
    stickerId: z.string().min(1).max(64),
    roomId: roomIdSchema,
    userId: z.string().trim().min(1).max(64),
    value: z.string().trim().min(1).max(6),
    x: z.number().min(0).max(1200),
    y: z.number().min(0).max(700),
    size: z.number().min(16).max(96),
    timestamp: z.number().int().positive(),
  }),
});

export const modeSchema = z.object({
  roomId: roomIdSchema,
  mode: z.enum(["free-draw", "guess-mode"]),
});
