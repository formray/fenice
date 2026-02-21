import { describe, it, expect } from 'vitest';
import { ClientMessageSchema, ServerMessageSchema } from '../../../src/schemas/ws.schema.js';

describe('WebSocket schemas', () => {
  describe('ClientMessageSchema', () => {
    it('should validate join_room client message', () => {
      const result = ClientMessageSchema.safeParse({ type: 'join_room', roomId: 'room-1' });
      expect(result.success).toBe(true);
    });

    it('should validate leave_room client message', () => {
      const result = ClientMessageSchema.safeParse({ type: 'leave_room', roomId: 'room-1' });
      expect(result.success).toBe(true);
    });

    it('should validate chat_message client message', () => {
      const result = ClientMessageSchema.safeParse({
        type: 'chat_message',
        roomId: 'room-1',
        content: 'hello',
      });
      expect(result.success).toBe(true);
    });

    it('should validate ping client message', () => {
      const result = ClientMessageSchema.safeParse({ type: 'ping' });
      expect(result.success).toBe(true);
    });

    it('should reject unknown message type', () => {
      const result = ClientMessageSchema.safeParse({ type: 'unknown' });
      expect(result.success).toBe(false);
    });

    it('should reject join_room without roomId', () => {
      const result = ClientMessageSchema.safeParse({ type: 'join_room' });
      expect(result.success).toBe(false);
    });
  });

  describe('ServerMessageSchema', () => {
    it('should validate notification server message', () => {
      const result = ServerMessageSchema.safeParse({
        type: 'notification',
        title: 'Test',
        body: 'Hello',
      });
      expect(result.success).toBe(true);
    });

    it('should validate chat_message server message', () => {
      const result = ServerMessageSchema.safeParse({
        type: 'chat_message',
        roomId: 'room-1',
        userId: 'u1',
        content: 'hi',
        timestamp: '2026-01-01T00:00:00.000Z',
      });
      expect(result.success).toBe(true);
    });

    it('should validate pong server message', () => {
      const result = ServerMessageSchema.safeParse({ type: 'pong' });
      expect(result.success).toBe(true);
    });

    it('should validate error server message', () => {
      const result = ServerMessageSchema.safeParse({ type: 'error', message: 'Something broke' });
      expect(result.success).toBe(true);
    });

    it('should validate room_joined server message', () => {
      const result = ServerMessageSchema.safeParse({ type: 'room_joined', roomId: 'room-1' });
      expect(result.success).toBe(true);
    });
  });
});
