import { ClientMessageSchema } from '../schemas/ws.schema.js';
import type { WsManager } from './manager.js';

export function handleMessage(manager: WsManager, userId: string, raw: string): void {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    manager.sendTo(userId, { type: 'error', message: 'Invalid JSON' });
    return;
  }

  const result = ClientMessageSchema.safeParse(data);
  if (!result.success) {
    manager.sendTo(userId, { type: 'error', message: 'Invalid message format' });
    return;
  }

  const msg = result.data;

  switch (msg.type) {
    case 'join_room':
      manager.joinRoom(userId, msg.roomId);
      manager.sendTo(userId, { type: 'room_joined', roomId: msg.roomId });
      break;
    case 'leave_room':
      manager.leaveRoom(userId, msg.roomId);
      manager.sendTo(userId, { type: 'room_left', roomId: msg.roomId });
      break;
    case 'chat_message':
      manager.broadcast(msg.roomId, {
        type: 'chat_message',
        roomId: msg.roomId,
        userId,
        content: msg.content,
        timestamp: new Date().toISOString(),
      });
      break;
    case 'ping':
      manager.sendTo(userId, { type: 'pong' });
      break;
  }
}
