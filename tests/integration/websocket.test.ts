import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WsManager } from '../../src/ws/manager.js';
import { handleMessage } from '../../src/ws/handlers.js';

interface MockWs {
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  readyState: number;
}

function createMockWs(): MockWs {
  return {
    send: vi.fn(),
    close: vi.fn(),
    readyState: 1, // OPEN
  };
}

describe('WsManager', () => {
  let manager: WsManager;

  beforeEach(() => {
    manager = new WsManager();
  });

  it('addConnection + isConnected returns true', () => {
    const ws = createMockWs();
    manager.addConnection('user1', ws);

    expect(manager.isConnected('user1')).toBe(true);
  });

  it('removeConnection makes isConnected return false', () => {
    const ws = createMockWs();
    manager.addConnection('user1', ws);
    manager.removeConnection('user1');

    expect(manager.isConnected('user1')).toBe(false);
  });

  it('joinRoom + getRoomMembers includes user', () => {
    const ws = createMockWs();
    manager.addConnection('user1', ws);
    manager.joinRoom('user1', 'room-a');

    expect(manager.getRoomMembers('room-a')).toContain('user1');
  });

  it('leaveRoom + getRoomMembers excludes user', () => {
    const ws = createMockWs();
    manager.addConnection('user1', ws);
    manager.joinRoom('user1', 'room-a');
    manager.leaveRoom('user1', 'room-a');

    expect(manager.getRoomMembers('room-a')).not.toContain('user1');
  });

  it('broadcast sends to all room members', () => {
    const ws1 = createMockWs();
    const ws2 = createMockWs();
    manager.addConnection('user1', ws1);
    manager.addConnection('user2', ws2);
    manager.joinRoom('user1', 'room-a');
    manager.joinRoom('user2', 'room-a');

    manager.broadcast('room-a', { type: 'test', data: 'hello' });

    const expected = JSON.stringify({ type: 'test', data: 'hello' });
    expect(ws1.send).toHaveBeenCalledWith(expected);
    expect(ws2.send).toHaveBeenCalledWith(expected);
  });

  it('broadcast skips connections with readyState !== 1 (OPEN)', () => {
    const wsOpen = createMockWs();
    const wsClosed = createMockWs();
    wsClosed.readyState = 3; // CLOSED
    manager.addConnection('user1', wsOpen);
    manager.addConnection('user2', wsClosed);
    manager.joinRoom('user1', 'room-a');
    manager.joinRoom('user2', 'room-a');

    manager.broadcast('room-a', { type: 'test' });

    expect(wsOpen.send).toHaveBeenCalledOnce();
    expect(wsClosed.send).not.toHaveBeenCalled();
  });

  it('sendTo sends to specific user', () => {
    const ws1 = createMockWs();
    const ws2 = createMockWs();
    manager.addConnection('user1', ws1);
    manager.addConnection('user2', ws2);

    manager.sendTo('user1', { type: 'direct', message: 'hi' });

    expect(ws1.send).toHaveBeenCalledWith(JSON.stringify({ type: 'direct', message: 'hi' }));
    expect(ws2.send).not.toHaveBeenCalled();
  });

  it('removeConnection also leaves all rooms', () => {
    const ws = createMockWs();
    manager.addConnection('user1', ws);
    manager.joinRoom('user1', 'room-a');
    manager.joinRoom('user1', 'room-b');

    manager.removeConnection('user1');

    expect(manager.getRoomMembers('room-a')).not.toContain('user1');
    expect(manager.getRoomMembers('room-b')).not.toContain('user1');
  });
});

describe('handleMessage integration', () => {
  let manager: WsManager;

  beforeEach(() => {
    manager = new WsManager();
  });

  it('join_room message joins room and sends room_joined confirmation', () => {
    const ws = createMockWs();
    manager.addConnection('user1', ws);

    handleMessage(manager, 'user1', JSON.stringify({ type: 'join_room', roomId: 'lobby' }));

    expect(manager.getRoomMembers('lobby')).toContain('user1');
    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: 'room_joined', roomId: 'lobby' }));
  });

  it('leave_room message leaves room and sends room_left confirmation', () => {
    const ws = createMockWs();
    manager.addConnection('user1', ws);
    manager.joinRoom('user1', 'lobby');

    handleMessage(manager, 'user1', JSON.stringify({ type: 'leave_room', roomId: 'lobby' }));

    expect(manager.getRoomMembers('lobby')).not.toContain('user1');
    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: 'room_left', roomId: 'lobby' }));
  });

  it('chat_message broadcasts to room members', () => {
    const ws1 = createMockWs();
    const ws2 = createMockWs();
    manager.addConnection('user1', ws1);
    manager.addConnection('user2', ws2);
    manager.joinRoom('user1', 'chat-room');
    manager.joinRoom('user2', 'chat-room');

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T10:00:00.000Z'));

    handleMessage(
      manager,
      'user1',
      JSON.stringify({
        type: 'chat_message',
        roomId: 'chat-room',
        content: 'Hello everyone!',
      })
    );

    const expected = JSON.stringify({
      type: 'chat_message',
      roomId: 'chat-room',
      userId: 'user1',
      content: 'Hello everyone!',
      timestamp: '2025-01-15T10:00:00.000Z',
    });
    expect(ws1.send).toHaveBeenCalledWith(expected);
    expect(ws2.send).toHaveBeenCalledWith(expected);

    vi.useRealTimers();
  });

  it('ping message receives pong', () => {
    const ws = createMockWs();
    manager.addConnection('user1', ws);

    handleMessage(manager, 'user1', JSON.stringify({ type: 'ping' }));

    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: 'pong' }));
  });

  it('invalid JSON receives error', () => {
    const ws = createMockWs();
    manager.addConnection('user1', ws);

    handleMessage(manager, 'user1', 'not-json{{{');

    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'error', message: 'Invalid JSON' })
    );
  });

  it('invalid message format receives error', () => {
    const ws = createMockWs();
    manager.addConnection('user1', ws);

    handleMessage(manager, 'user1', JSON.stringify({ type: 'unknown_type', data: 123 }));

    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'error', message: 'Invalid message format' })
    );
  });

  it('multiple users in same room receive chat broadcast', () => {
    const ws1 = createMockWs();
    const ws2 = createMockWs();
    const ws3 = createMockWs();
    manager.addConnection('alice', ws1);
    manager.addConnection('bob', ws2);
    manager.addConnection('carol', ws3);

    handleMessage(manager, 'alice', JSON.stringify({ type: 'join_room', roomId: 'general' }));
    handleMessage(manager, 'bob', JSON.stringify({ type: 'join_room', roomId: 'general' }));
    handleMessage(manager, 'carol', JSON.stringify({ type: 'join_room', roomId: 'general' }));

    // Clear mock calls from join confirmations
    ws1.send.mockClear();
    ws2.send.mockClear();
    ws3.send.mockClear();

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-01T12:00:00.000Z'));

    handleMessage(
      manager,
      'alice',
      JSON.stringify({
        type: 'chat_message',
        roomId: 'general',
        content: 'Hi team!',
      })
    );

    const expected = JSON.stringify({
      type: 'chat_message',
      roomId: 'general',
      userId: 'alice',
      content: 'Hi team!',
      timestamp: '2025-06-01T12:00:00.000Z',
    });
    expect(ws1.send).toHaveBeenCalledWith(expected);
    expect(ws2.send).toHaveBeenCalledWith(expected);
    expect(ws3.send).toHaveBeenCalledWith(expected);

    vi.useRealTimers();
  });
});
