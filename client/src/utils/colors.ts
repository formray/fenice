import type { HttpMethod } from '../types/world';
import type { LinkState, Zone } from '../types/semantic';

// ─── Link state visual tokens ────────────────────────────────────────────────

export interface LinkStateStyle {
  hex: string;
  emissiveIntensity: number;
  opacity: number;
  edgeStyle: 'solid' | 'dashed';
}

export interface ZoneStyle {
  floorColor: string;
  borderColor?: string | undefined;
}

export const LINK_STATE_COLORS: Record<LinkState, LinkStateStyle> = {
  ok: { hex: '#00E5FF', emissiveIntensity: 0.15, opacity: 0.8, edgeStyle: 'solid' },
  degraded: { hex: '#FFB300', emissiveIntensity: 0.3, opacity: 0.6, edgeStyle: 'solid' },
  blocked: { hex: '#FF1744', emissiveIntensity: 0.1, opacity: 0.7, edgeStyle: 'dashed' },
  unknown: { hex: '#616161', emissiveIntensity: 0.0, opacity: 0.3, edgeStyle: 'solid' },
};

export const ZONE_STYLES: Record<Zone, ZoneStyle> = {
  'public-perimeter': { floorColor: '#0a0a1e' },
  'protected-core': { floorColor: '#0d0a1e', borderColor: '#00E5FF' },
  'auth-hub': { floorColor: '#1a0a2e' },
};

// ─── HTTP method visual tokens ───────────────────────────────────────────────

/** HTTP method → building color mapping */
export const METHOD_COLORS: Record<HttpMethod, string> = {
  get: '#4A90D9',
  post: '#50C878',
  put: '#FFA500',
  patch: '#FFD700',
  delete: '#E74C3C',
  options: '#9B59B6',
  head: '#95A5A6',
  trace: '#7F8C8D',
};

/** HTTP method → human-readable label */
export const METHOD_LABELS: Record<HttpMethod, string> = {
  get: 'GET',
  post: 'POST',
  put: 'PUT',
  patch: 'PATCH',
  delete: 'DELETE',
  options: 'OPTIONS',
  head: 'HEAD',
  trace: 'TRACE',
};

// ─── Building accent ring tokens ─────────────────────────────────────────────

/** Height of the link-state accent ring at building base */
export const ACCENT_RING_HEIGHT = 0.08;

/** Emissive intensity for building accent rings */
export const ACCENT_EMISSIVE_INTENSITY = 0.4;
