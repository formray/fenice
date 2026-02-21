import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WsManager } from '../../../src/ws/manager.js';

function mockWs() {
  return { send: vi.fn(), close: vi.fn(), readyState: 1 };
}

describe('WsManager', () => {
  let manager: WsManager;

  beforeEach(() => {
    manager = new WsManager();
  });

  it('should add and track connection', () => {
    const ws = mockWs();
    manager.addConnection('user1', ws as never);
    expect(manager.isConnected('user1')).toBe(true);
  });

  it('should remove connection', () => {
    const ws = mockWs();
    manager.addConnection('user1', ws as never);
    manager.removeConnection('user1');
    expect(manager.isConnected('user1')).toBe(false);
  });

  it('should manage rooms', () => {
    const ws = mockWs();
    manager.addConnection('user1', ws as never);
    manager.joinRoom('user1', 'room-A');
    expect(manager.getRoomMembers('room-A')).toContain('user1');
  });

  it('should remove user from room on leave', () => {
    const ws = mockWs();
    manager.addConnection('user1', ws as never);
    manager.joinRoom('user1', 'room-A');
    manager.leaveRoom('user1', 'room-A');
    expect(manager.getRoomMembers('room-A')).not.toContain('user1');
  });

  it('should broadcast to room', () => {
    const ws1 = mockWs();
    const ws2 = mockWs();
    manager.addConnection('user1', ws1 as never);
    manager.addConnection('user2', ws2 as never);
    manager.joinRoom('user1', 'room-A');
    manager.joinRoom('user2', 'room-A');

    manager.broadcast('room-A', { type: 'notification', title: 'test', body: 'msg' });
    expect(ws1.send).toHaveBeenCalled();
    expect(ws2.send).toHaveBeenCalled();
  });

  it('should send to specific user', () => {
    const ws = mockWs();
    manager.addConnection('user1', ws as never);
    manager.sendTo('user1', { type: 'pong' });
    expect(ws.send).toHaveBeenCalled();
  });

  it('should cleanup rooms on disconnect', () => {
    const ws = mockWs();
    manager.addConnection('user1', ws as never);
    manager.joinRoom('user1', 'room-A');
    manager.removeConnection('user1');
    expect(manager.getRoomMembers('room-A')).not.toContain('user1');
  });

  it('should return empty array for non-existent room', () => {
    expect(manager.getRoomMembers('nonexistent')).toEqual([]);
  });

  it('should not send to disconnected user', () => {
    const ws = mockWs();
    ws.readyState = 3; // CLOSED
    manager.addConnection('user1', ws as never);
    manager.sendTo('user1', { type: 'pong' });
    expect(ws.send).not.toHaveBeenCalled();
  });
});
