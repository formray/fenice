/**
 * In-memory ring buffer for the `query_logs` MCP tool.
 *
 * Holds the last N log records for retrieval by connected agents.
 * Populated by the request logger middleware; queryable by pattern/level/limit.
 */

export interface LogRecord {
  timestamp: string;
  level: string;
  message: string;
  fields: Record<string, unknown>;
}

export interface LogQueryOptions {
  pattern?: string; // case-insensitive substring match against message + fields
  level?: string;
  limit?: number;
}

export class LogRingBuffer {
  private readonly buffer: LogRecord[] = [];

  constructor(private readonly capacity = 200) {
    if (capacity <= 0) {
      throw new Error('LogRingBuffer capacity must be positive');
    }
  }

  push(record: LogRecord): void {
    this.buffer.push(record);
    if (this.buffer.length > this.capacity) {
      this.buffer.shift();
    }
  }

  query(options: LogQueryOptions = {}): LogRecord[] {
    const { pattern, level, limit = 50 } = options;
    let results = this.buffer;

    if (level) {
      results = results.filter((r) => r.level === level);
    }

    if (pattern) {
      const needle = pattern.toLowerCase();
      results = results.filter((r) => {
        if (r.message.toLowerCase().includes(needle)) return true;
        for (const value of Object.values(r.fields)) {
          if (typeof value === 'string' && value.toLowerCase().includes(needle)) return true;
        }
        return false;
      });
    }

    return results.slice(-Math.max(1, Math.min(limit, this.capacity)));
  }

  size(): number {
    return this.buffer.length;
  }

  clear(): void {
    this.buffer.length = 0;
  }
}

// Singleton — wired into the request logger and consumed by the query_logs tool
export const logBuffer = new LogRingBuffer(
  Number(process.env['MCP_LOG_BUFFER_SIZE'] ?? 200) || 200
);
