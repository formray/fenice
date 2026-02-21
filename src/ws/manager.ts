export interface WsConnection {
  send(data: string): void;
  close(): void;
  readyState: number;
}

const WS_OPEN = 1;

export class WsManager {
  private readonly connections = new Map<string, WsConnection>();
  private readonly rooms = new Map<string, Set<string>>();
  private readonly userRooms = new Map<string, Set<string>>();

  addConnection(userId: string, ws: WsConnection): void {
    this.connections.set(userId, ws);
    this.userRooms.set(userId, new Set());
  }

  removeConnection(userId: string): void {
    const rooms = this.userRooms.get(userId);
    if (rooms) {
      for (const roomId of rooms) {
        const members = this.rooms.get(roomId);
        if (members) {
          members.delete(userId);
          if (members.size === 0) {
            this.rooms.delete(roomId);
          }
        }
      }
    }
    this.userRooms.delete(userId);
    this.connections.delete(userId);
  }

  isConnected(userId: string): boolean {
    return this.connections.has(userId);
  }

  joinRoom(userId: string, roomId: string): void {
    if (!this.connections.has(userId)) {
      return;
    }

    let members = this.rooms.get(roomId);
    if (!members) {
      members = new Set();
      this.rooms.set(roomId, members);
    }
    members.add(userId);

    const rooms = this.userRooms.get(userId);
    if (rooms) {
      rooms.add(roomId);
    }
  }

  leaveRoom(userId: string, roomId: string): void {
    const members = this.rooms.get(roomId);
    if (members) {
      members.delete(userId);
      if (members.size === 0) {
        this.rooms.delete(roomId);
      }
    }

    const rooms = this.userRooms.get(userId);
    if (rooms) {
      rooms.delete(roomId);
    }
  }

  getRoomMembers(roomId: string): string[] {
    const members = this.rooms.get(roomId);
    if (!members) {
      return [];
    }
    return [...members];
  }

  broadcast(roomId: string, message: Record<string, unknown>): void {
    const members = this.rooms.get(roomId);
    if (!members) {
      return;
    }

    const data = JSON.stringify(message);
    for (const userId of members) {
      const ws = this.connections.get(userId);
      if (ws?.readyState === WS_OPEN) {
        ws.send(data);
      }
    }
  }

  sendTo(userId: string, message: Record<string, unknown>): void {
    const ws = this.connections.get(userId);
    if (ws?.readyState === WS_OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
}
