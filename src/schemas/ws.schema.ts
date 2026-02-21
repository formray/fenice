import { z } from 'zod';

// Client -> Server messages
const JoinRoomMessage = z.object({
  type: z.literal('join_room'),
  roomId: z.string().min(1),
});

const LeaveRoomMessage = z.object({
  type: z.literal('leave_room'),
  roomId: z.string().min(1),
});

const ChatClientMessage = z.object({
  type: z.literal('chat_message'),
  roomId: z.string().min(1),
  content: z.string().min(1).max(4096),
});

const PingMessage = z.object({
  type: z.literal('ping'),
});

export const ClientMessageSchema = z.discriminatedUnion('type', [
  JoinRoomMessage,
  LeaveRoomMessage,
  ChatClientMessage,
  PingMessage,
]);

// Server -> Client messages
const NotificationMessage = z.object({
  type: z.literal('notification'),
  title: z.string(),
  body: z.string(),
});

const ChatServerMessage = z.object({
  type: z.literal('chat_message'),
  roomId: z.string(),
  userId: z.string(),
  content: z.string(),
  timestamp: z.string(),
});

const PongMessage = z.object({
  type: z.literal('pong'),
});

const ErrorMessage = z.object({
  type: z.literal('error'),
  message: z.string(),
});

const RoomJoinedMessage = z.object({
  type: z.literal('room_joined'),
  roomId: z.string(),
});

const RoomLeftMessage = z.object({
  type: z.literal('room_left'),
  roomId: z.string(),
});

export const ServerMessageSchema = z.discriminatedUnion('type', [
  NotificationMessage,
  ChatServerMessage,
  PongMessage,
  ErrorMessage,
  RoomJoinedMessage,
  RoomLeftMessage,
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;
export type ServerMessage = z.infer<typeof ServerMessageSchema>;
