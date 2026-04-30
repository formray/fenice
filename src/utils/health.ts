import mongoose from 'mongoose';
import type { HealthSummary } from '../services/mcp/types.js';

/**
 * Compute a health summary for FENICE — same data surfaced by GET /health/detailed
 * and by the MCP `check_health` tool.
 */
export async function computeHealthSummary(): Promise<HealthSummary> {
  const mongoState = mongoose.connection.readyState;
  const mongoStatus: HealthSummary['mongo'] =
    mongoState === 1 ? 'ok' : mongoState === 0 ? 'down' : 'unknown';

  const overall: HealthSummary['status'] =
    mongoStatus === 'ok' ? 'ok' : mongoStatus === 'down' ? 'down' : 'degraded';

  return {
    status: overall,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongo: mongoStatus,
  };
}
