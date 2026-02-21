import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleMessage } from '../../../src/ws/handlers.js';
import { WsManager } from '../../../src/ws/manager.js';

function mockWs() {
  return { send: vi.fn(), close: vi.fn(), readyState: 1 };
}

describe('handleMessage', () => {
  let manager: WsManager;
  const userId = 'user-1';

  beforeEach(() => {
    manager = new WsManager();
  });

  it('should handle join_room message', () => {
    const ws = mockWs();
    manager.addConnection(userId, ws as never);
    handleMessage(manager, userId, JSON.stringify({ type: 'join_room', roomId: 'room-A' }));
    expect(manager.getRoomMembers('room-A')).toContain(userId);
    expect(ws.send).toHaveBeenCalled();
    const sent = JSON.parse(ws.send.mock.calls[0][0] as string);
    expect(sent.type).toBe('room_joined');
    expect(sent.roomId).toBe('room-A');
  });

  it('should handle leave_room message', () => {
    const ws = mockWs();
    manager.addConnection(userId, ws as never);
    manager.joinRoom(userId, 'room-A');
    handleMessage(manager, userId, JSON.stringify({ type: 'leave_room', roomId: 'room-A' }));
    expect(manager.getRoomMembers('room-A')).not.toContain(userId);
  });

  it('should handle chat_message', () => {
    const ws1 = mockWs();
    const ws2 = mockWs();
    manager.addConnection('user-1', ws1 as never);
    manager.addConnection('user-2', ws2 as never);
    manager.joinRoom('user-1', 'room-A');
    manager.joinRoom('user-2', 'room-A');
    handleMessage(
      manager,
      'user-1',
      JSON.stringify({ type: 'chat_message', roomId: 'room-A', content: 'hello' })
    );
    // Both users in the room should receive the message via broadcast
    expect(ws1.send).toHaveBeenCalled();
    expect(ws2.send).toHaveBeenCalled();
  });

  it('should handle ping message', () => {
    const ws = mockWs();
    manager.addConnection(userId, ws as never);
    handleMessage(manager, userId, JSON.stringify({ type: 'ping' }));
    expect(ws.send).toHaveBeenCalled();
    const sent = JSON.parse(ws.send.mock.calls[0][0] as string);
    expect(sent.type).toBe('pong');
  });

  it('should send error for invalid JSON', () => {
    const ws = mockWs();
    manager.addConnection(userId, ws as never);
    handleMessage(manager, userId, 'not-json');
    expect(ws.send).toHaveBeenCalled();
    const sent = JSON.parse(ws.send.mock.calls[0][0] as string);
    expect(sent.type).toBe('error');
  });

  it('should send error for invalid message type', () => {
    const ws = mockWs();
    manager.addConnection(userId, ws as never);
    handleMessage(manager, userId, JSON.stringify({ type: 'unknown' }));
    expect(ws.send).toHaveBeenCalled();
    const sent = JSON.parse(ws.send.mock.calls[0][0] as string);
    expect(sent.type).toBe('error');
  });
});
