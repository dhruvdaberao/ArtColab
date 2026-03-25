import { Types } from 'mongoose';

type UserId = Types.ObjectId | string;

type UserTimestamp = Date;

export type SafeUserSource = {
  _id: UserId;
  username: string;
  email: string;
  profileImage?: string | null;
  createdRooms?: string[];
  joinedRooms?: string[];
  createdAt: UserTimestamp;
  updatedAt: UserTimestamp;
};

export const serializeSafeUser = (user: SafeUserSource) => ({
  id: String(user._id),
  username: user.username,
  email: user.email,
  profileImage: user.profileImage ?? '',
  createdRooms: user.createdRooms ?? [],
  joinedRooms: user.joinedRooms ?? [],
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  role: 'user' as const
});
