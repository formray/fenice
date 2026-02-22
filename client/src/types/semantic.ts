/**
 * M2B Semantic Layer types.
 * Source of truth: docs/3d-world/FENICE_3D_World_M2B_SemanticContract_v1.md
 */

// ─── Link states ────────────────────────────────────────────────────────────

export type LinkState = 'ok' | 'degraded' | 'blocked' | 'unknown';

// ─── Reason codes ───────────────────────────────────────────────────────────

export type BlockedReason =
  | 'auth_required_no_session'
  | 'auth_token_expired'
  | 'policy_denied'
  | 'dependency_unhealthy_hard';

export type DegradedReason = 'service_unhealthy_soft' | 'latency_high' | 'error_rate_high';

export type UnknownReason = 'signal_missing';

export type SemanticReason = BlockedReason | DegradedReason | UnknownReason;

// ─── Zones ──────────────────────────────────────────────────────────────────

export type Zone = 'public-perimeter' | 'protected-core' | 'auth-hub';

// ─── Session state ──────────────────────────────────────────────────────────

export type SessionState = 'none' | 'valid' | 'expired';

// ─── Metrics classification ─────────────────────────────────────────────────

export type MetricsState = 'normal' | 'latency_high' | 'error_rate_high' | 'unknown';

// ─── Health mapping ─────────────────────────────────────────────────────────

export type HealthState = 'healthy' | 'degraded' | 'down' | 'unknown';

// ─── Policy ─────────────────────────────────────────────────────────────────

export type PolicyState = 'allow' | 'deny' | 'unknown';

// ─── Resolver input ─────────────────────────────────────────────────────────

export interface ResolverInput {
  hasAuth: boolean;
  sessionState: SessionState;
  healthState: HealthState;
  metricsState: MetricsState;
  policyState: PolicyState;
}

// ─── Resolver output ────────────────────────────────────────────────────────

export interface SemanticState {
  linkState: LinkState;
  reason?: SemanticReason | undefined;
  zone: Zone;
}

// ─── Auth gate ──────────────────────────────────────────────────────────────

export interface AuthGateState {
  id: string;
  zone: Zone;
  open: boolean;
  linkState: LinkState;
  reason?: SemanticReason | undefined;
}

// ─── Metrics classifier config ──────────────────────────────────────────────

export interface MetricsClassifierConfig {
  latencyThresholdMs: number;
  errorRateThreshold: number;
  antiFlap: number; // consecutive samples needed to change state
}

export const DEFAULT_METRICS_CONFIG: MetricsClassifierConfig = {
  latencyThresholdMs: 500,
  errorRateThreshold: 0.05,
  antiFlap: 3,
};
