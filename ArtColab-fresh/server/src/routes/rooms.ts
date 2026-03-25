import bcrypt from "bcryptjs";
import { Router, type Request, type Response } from "express";
import {
  createRoomSchema,
  joinRoomHttpSchema,
  roomIdSchema,
  updateRoomSchema,
} from "../utils/validation.js";
import { isMongoReady } from "../db/mongo.js";
import { optionalAuth } from "../middleware/auth.js";
import { Room } from "../models/Room.js";
import { User } from "../models/User.js";
import { RoomManager } from "../rooms/roomManager.js";
import {
  serializeRoomSummary,
  withNormalizedPasswordHash,
  type RoomJoinSource,
} from "../serializers/room.js";

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error);
};

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalizeRoomIdentifier = (value: string | undefined | null) =>
  value?.trim() ?? "";
const isRoomCode = (value: string) => /^[A-Z0-9]{6}$/.test(value.toUpperCase());

const guestDisplayNameFromRequest = (req: Request) => {
  const bodyCandidate =
    typeof req.body?.guestDisplayName === "string"
      ? req.body.guestDisplayName.trim()
      : "";
  if (bodyCandidate && bodyCandidate.length <= 32) return bodyCandidate;

  const headerCandidate = req.header("X-Guest-Display-Name")?.trim();
  return headerCandidate && headerCandidate.length <= 32
    ? headerCandidate
    : null;
};

const requireGuestDisplayName = (req: Request, res: Response) => {
  if (req.auth?.role === "user") return true;
  if (guestDisplayNameFromRequest(req)) return true;
  res
    .status(400)
    .json({
      success: false,
      message: "Please enter a display name before joining or creating a room.",
    });
  return false;
};

const resolveRoomMeta = async (
  roomManager: RoomManager,
  identifier: string,
): Promise<(RoomJoinSource & { passwordHash: string | null }) | null> => {
  const normalizedIdentifier = normalizeRoomIdentifier(identifier);
  if (!normalizedIdentifier) return null;

  const roomCode = normalizedIdentifier.toUpperCase();
  if (isMongoReady()) {
    const mongoQuery = isRoomCode(roomCode)
      ? {
          $or: [
            { roomId: roomCode },
            { name: new RegExp(`^${escapeRegex(normalizedIdentifier)}$`, "i") },
          ],
        }
      : { name: new RegExp(`^${escapeRegex(normalizedIdentifier)}$`, "i") };
    const persistedRoom = await Room.findOne(mongoQuery).lean();
    if (persistedRoom) return withNormalizedPasswordHash(persistedRoom);
  }

  const memoryRoom = roomManager
    .listMeta()
    .find(
      (meta) =>
        meta.roomId === roomCode ||
        meta.name.toLowerCase() === normalizedIdentifier.toLowerCase(),
    );
  return memoryRoom ? withNormalizedPasswordHash(memoryRoom) : null;
};

export const roomsRouter = (roomManager: RoomManager) => {
  const router = Router();

  router.post("/create", optionalAuth, async (req: Request, res: Response) => {
    const parsedBody = createRoomSchema.safeParse(req.body ?? {});
    if (!parsedBody.success) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            parsedBody.error.issues[0]?.message ??
            "Invalid create room payload.",
        });
    }

    if (!requireGuestDisplayName(req, res)) return;

    const name = parsedBody.data.name.trim();
    const visibility = parsedBody.data.visibility;
    const owner = {
      ownerType: req.auth?.role === "user" ? "user" : "guest",
      ownerId: req.auth?.sub ?? "anonymous",
      ownerName:
        req.auth?.role === "user"
          ? req.auth.username
          : (guestDisplayNameFromRequest(req) ?? "Guest"),
    } as const;

    console.info("[rooms:create] create requested", {
      roomName: name,
      visibility,
      requesterRole: req.auth?.role ?? "guest",
      requesterId: req.auth?.sub ?? "anonymous",
    });

    try {
      const existingRoom = await resolveRoomMeta(roomManager, name);
      if (existingRoom) {
        console.warn("[rooms:create] duplicate room name rejected", {
          roomName: name,
          existingRoomId: existingRoom.roomId,
        });
        return res
          .status(409)
          .json({ success: false, message: "Room name is already taken." });
      }

      const passwordHash =
        visibility === "private"
          ? await bcrypt.hash(parsedBody.data.password!.trim(), 10)
          : null;
      const room = roomManager.createRoom({
        name,
        visibility,
        passwordHash,
        owner,
      });

      if (isMongoReady()) {
        await Room.create({
          roomId: room.roomId,
          name,
          visibility,
          passwordHash,
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          ownerName: owner.ownerName,
          lastActiveAt: new Date(),
          canvasState: {
            strokes: [],
            stickers: [],
            lastSavedAt: null,
            version: 1,
          },
          previewImageUrl: null,
        });
        if (req.auth?.role === "user") {
          await User.findByIdAndUpdate(req.auth.sub, {
            $addToSet: { createdRooms: room.roomId },
          });
        }
      }

      const roomSummary = serializeRoomSummary(
        {
          roomId: room.roomId,
          name,
          visibility,
          ownerType: owner.ownerType,
          ownerName: owner.ownerName,
          createdAt: room.createdAt,
          updatedAt: room.updatedAt,
          lastActiveAt: room.lastActiveAt ?? room.updatedAt,
        },
        room.participants.length,
      );

      console.info("[rooms:create] create granted", {
        roomId: room.roomId,
        roomName: name,
        visibility,
      });
      return res.status(201).json({ success: true, room: roomSummary });
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      console.error("[rooms:create] unexpected failure", {
        roomName: name,
        error,
      });
      return res
        .status(500)
        .json({
          success: false,
          message: "Failed to create room.",
          error: errorMessage,
        });
    }
  });

  router.post("/join", optionalAuth, async (req: Request, res: Response) => {
    const parsedBody = joinRoomHttpSchema.safeParse(req.body ?? {});
    if (!parsedBody.success) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            parsedBody.error.issues[0]?.message ?? "Invalid join room payload.",
        });
    }

    if (!requireGuestDisplayName(req, res)) return;

    const name = parsedBody.data.name.trim();
    console.info("[rooms:join] join requested", {
      roomIdentifier: name,
      visibility: parsedBody.data.visibility,
      requesterRole: req.auth?.role ?? "guest",
      requesterId: req.auth?.sub ?? "anonymous",
    });
    try {
      const roomMeta = await resolveRoomMeta(roomManager, name);
      if (!roomMeta) {
        console.warn("[rooms:join] room lookup failed", {
          roomIdentifier: name,
        });
        return res
          .status(404)
          .json({ success: false, message: "Room not found." });
      }
      if (roomMeta.visibility !== parsedBody.data.visibility) {
        console.warn("[rooms:join] visibility mismatch", {
          roomId: roomMeta.roomId,
          expectedVisibility: roomMeta.visibility,
          requestedVisibility: parsedBody.data.visibility,
        });
        return res
          .status(400)
          .json({
            success: false,
            message: "Room visibility selection does not match.",
          });
      }
      if (roomMeta.visibility === "private") {
        const ok =
          roomMeta.passwordHash && parsedBody.data.password
            ? await bcrypt.compare(
                parsedBody.data.password.trim(),
                roomMeta.passwordHash,
              )
            : false;
        if (!ok) {
          console.warn("[rooms:join] invalid private room password", {
            roomId: roomMeta.roomId,
          });
          return res
            .status(401)
            .json({ success: false, message: "Invalid room password." });
        }
      }
      const activeRoom = roomManager.getRoom(roomMeta.roomId);
      if (!activeRoom) {
        console.warn("[rooms:join] room no longer active", {
          roomId: roomMeta.roomId,
        });
        return res
          .status(410)
          .json({ success: false, message: "Room is no longer active." });
      }

      if (req.auth?.role === "user" && isMongoReady()) {
        await User.findByIdAndUpdate(req.auth.sub, {
          $addToSet: { joinedRooms: roomMeta.roomId },
        });
      }

      console.info("[rooms:join] join granted", {
        roomId: roomMeta.roomId,
        roomName: roomMeta.name,
      });
      return res.json({
        success: true,
        room: serializeRoomSummary(roomMeta, activeRoom.participants.length),
      });
    } catch (error) {
      console.error("[rooms:join] unexpected failure", {
        roomIdentifier: name,
        error,
      });
      return res
        .status(500)
        .json({
          success: false,
          message: "Failed to join room.",
          error: toErrorMessage(error),
        });
    }
  });

  router.get("/browse", optionalAuth, async (req: Request, res: Response) => {
    const query = String(req.query.q ?? "")
      .trim()
      .toLowerCase();
    try {
      let rooms = roomManager.listMeta();
      if (query)
        rooms = rooms.filter(
          (room) =>
            room.name.toLowerCase().includes(query) ||
            room.roomId.toLowerCase().includes(query),
        );
      return res.json({
        success: true,
        rooms: rooms.map((room) =>
          serializeRoomSummary(
            room,
            roomManager.getRoom(room.roomId)?.participants.length ?? 0,
          ),
        ),
      });
    } catch (error) {
      return res
        .status(500)
        .json({
          success: false,
          message: "Failed to browse rooms.",
          error: toErrorMessage(error),
        });
    }
  });

  router.get("/manage", optionalAuth, async (req: Request, res: Response) => {
    const myId = req.auth?.sub;
    if (!myId)
      return res.json({
        success: true,
        ownedRooms: [],
        joinedRooms: [],
        message: "Guest management only shows rooms from this active session.",
      });

    const rooms = roomManager.listMeta();
    const ownedRooms = rooms
      .filter((room) => room.ownerId === myId)
      .map((room) =>
        serializeRoomSummary(
          room,
          roomManager.getRoom(room.roomId)?.participants.length ?? 0,
        ),
      );
    const user =
      req.auth && req.auth.role === "user" && isMongoReady()
        ? await User.findById(req.auth.sub).lean()
        : null;
    const joinedRoomIds = new Set(user?.joinedRooms ?? []);
    const joinedRooms = rooms
      .filter((room) => joinedRoomIds.has(room.roomId))
      .map((room) =>
        serializeRoomSummary(
          room,
          roomManager.getRoom(room.roomId)?.participants.length ?? 0,
        ),
      );
    return res.json({ success: true, ownedRooms, joinedRooms });
  });

  router.patch(
    "/:roomId/settings",
    optionalAuth,
    async (req: Request, res: Response) => {
      const parsedId = roomIdSchema.safeParse(req.params.roomId);
      const parsedBody = updateRoomSchema.safeParse(req.body ?? {});
      if (!parsedId.success || !parsedBody.success)
        return res
          .status(400)
          .json({ success: false, message: "Invalid room settings payload." });

      const meta = roomManager.getMeta(parsedId.data);
      if (!meta)
        return res
          .status(404)
          .json({ success: false, message: "Room not found." });
      if (!req.auth || meta.ownerId !== req.auth.sub)
        return res
          .status(403)
          .json({
            success: false,
            message: "Only room owner can update room settings.",
          });

      const updates: Partial<
        Pick<RoomJoinSource, "name" | "visibility"> & {
          passwordHash: string | null;
        }
      > = {};
      if (
        parsedBody.data.name &&
        parsedBody.data.name.trim().toLowerCase() !== meta.name.toLowerCase()
      ) {
        const candidate = parsedBody.data.name.trim();
        const exists = (await resolveRoomMeta(roomManager, candidate))?.roomId;
        if (exists && exists !== meta.roomId)
          return res
            .status(409)
            .json({ success: false, message: "Room name is already taken." });
        updates.name = candidate;
      }
      if (parsedBody.data.visibility)
        updates.visibility = parsedBody.data.visibility;
      if (
        parsedBody.data.visibility === "private" ||
        (meta.visibility === "private" && parsedBody.data.password)
      ) {
        updates.passwordHash = parsedBody.data.password
          ? await bcrypt.hash(parsedBody.data.password.trim(), 10)
          : meta.passwordHash;
      }
      if (parsedBody.data.visibility === "public") updates.passwordHash = null;

      Object.assign(meta, updates, { updatedAt: Date.now() });
      if (isMongoReady()) {
        await Room.findOneAndUpdate({ roomId: meta.roomId }, { $set: updates });
      }
      return res.json({
        success: true,
        room: serializeRoomSummary(
          meta,
          roomManager.getRoom(meta.roomId)?.participants.length ?? 0,
        ),
      });
    },
  );

  router.delete(
    "/:roomId",
    optionalAuth,
    async (req: Request, res: Response) => {
      const parsedId = roomIdSchema.safeParse(req.params.roomId);
      if (!parsedId.success)
        return res
          .status(400)
          .json({ success: false, message: "Invalid room ID format." });
      const meta = roomManager.getMeta(parsedId.data);
      if (!meta)
        return res
          .status(404)
          .json({ success: false, message: "Room not found." });
      if (!req.auth || meta.ownerId !== req.auth.sub)
        return res
          .status(403)
          .json({
            success: false,
            message: "Only room owner can delete this room.",
          });
      roomManager.deleteRoom(parsedId.data);
      if (isMongoReady()) await Room.deleteOne({ roomId: parsedId.data });
      return res.json({ success: true });
    },
  );

  router.post(
    "/:roomId/leave",
    optionalAuth,
    async (req: Request, res: Response) => {
      const parsedId = roomIdSchema.safeParse(req.params.roomId);
      if (!parsedId.success)
        return res
          .status(400)
          .json({ success: false, message: "Invalid room ID format." });
      if (req.auth?.role === "user" && isMongoReady()) {
        await User.findByIdAndUpdate(req.auth.sub, {
          $pull: { joinedRooms: parsedId.data },
        });
      }
      return res.json({ success: true });
    },
  );

  router.get("/:roomId", optionalAuth, async (req: Request, res: Response) => {
    const parsedId = roomIdSchema.safeParse(req.params.roomId);
    if (!parsedId.success) {
      console.warn("[rooms:get] invalid room id", {
        roomId: req.params.roomId,
      });
      return res
        .status(400)
        .json({
          success: false,
          message: "Invalid room ID format.",
          error: "INVALID_ROOM_ID",
        });
    }

    try {
      console.info("[rooms:get] loading room", {
        roomId: parsedId.data,
        requesterRole: req.auth?.role ?? "guest",
        requesterId: req.auth?.sub ?? "anonymous",
      });
      const room = roomManager.getRoom(parsedId.data);
      const meta = roomManager.getMeta(parsedId.data);
      if (!room || !meta) {
        console.warn("[rooms:get] room missing", {
          roomId: parsedId.data,
          roomFound: Boolean(room),
          metaFound: Boolean(meta),
        });
        return res
          .status(404)
          .json({
            success: false,
            message: "Room does not exist or has expired.",
            error: "ROOM_NOT_FOUND",
          });
      }

      if (req.auth?.role === "user" && isMongoReady()) {
        await User.findByIdAndUpdate(req.auth.sub, {
          $addToSet: { joinedRooms: parsedId.data },
        });
      }

      return res.json({
        success: true,
        room: {
          roomId: room.roomId,
          name: meta.name,
          visibility: meta.visibility,
          createdAt: room.createdAt,
          updatedAt: room.updatedAt,
          lastActiveAt: room.lastActiveAt ?? meta.lastActiveAt,
          expiresAt: room.expiresAt,
        },
      });
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      console.error("[rooms:get] failed to fetch room", {
        roomId: parsedId.data,
        error,
      });
      return res
        .status(500)
        .json({
          success: false,
          message: "Failed to fetch room.",
          error: errorMessage,
        });
    }
  });

  return router;
};
