// ── Seeded random for deterministic layout ─────────────────────────────────

function seededHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0x7fffffff;
  }
  return hash;
}

/** Deterministic pseudo-random [0, 1) from a string seed and optional index. */
export function seededRandom(seed: string, index: number = 0): number {
  return (seededHash(seed + ':' + String(index)) % 10000) / 10000;
}

// ── Layout ─────────────────────────────────────────────────────────────────

export const COSMOS_LAYOUT = {
  innerRingRadius: 15,
  outerRingRadius: 28,
  yVariance: 8,
  minOrbitRadius: 3,
  maxOrbitRadius: 8,
  endpointOrbitGrowth: 0.5,
  orbitTiltRange: 0.3,
} as const;

// ── Service star ───────────────────────────────────────────────────────────

export const SERVICE_STAR = {
  coreRadius: 0.6,
  glowScale: 3.5,
  glowOpacity: 0.25,
  coronaScale: 2.0,
  coronaOpacity: 0.1,
  emissiveIntensity: 0.8,
  pulseMin: 0.98,
  pulseMax: 1.02,
  pulseSpeed: 1.5,
  metalness: 0.8,
  roughness: 0.1,
} as const;

// ── Endpoint planet ────────────────────────────────────────────────────────

export const ENDPOINT_PLANET = {
  minSize: 0.35,
  maxSize: 0.7,
  baseOrbitSpeed: 0.15,
  orbitSpeedVariance: 0.05,
  selfRotationSpeed: 0.003,
  hoverScale: 1.3,
  wireframeOpacity: 0.15,
  emissiveIntensity: 0.5,
  metalness: 0.5,
  roughness: 0.25,
  clearcoat: 0.6,
  clearcoatRoughness: 0.1,
} as const;

export const METHOD_SHAPES = {
  get: 'sphere',
  post: 'icosahedron',
  put: 'torus',
  delete: 'octahedron',
  patch: 'dodecahedron',
} as const;

export type PlanetShape = (typeof METHOD_SHAPES)[keyof typeof METHOD_SHAPES];

// ── Curved routes ──────────────────────────────────────────────────────────

export const CURVED_ROUTE = {
  tubeRadius: 0.04,
  segments: 48,
  radialSegments: 6,
  opacity: 0.5,
  pulseSpeed: 0.8,
  pulseSize: 0.15,
  archHeight: 3,
} as const;

// ── Wormhole (auth gate) ───────────────────────────────────────────────────

export const WORMHOLE = {
  ringRadius: 2.2,
  tubeRadius: 0.25,
  ringSegments: 64,
  ringRadialSegments: 16,
  rotationSpeed: 0.5,
  portalRadius: 1.8,
  portalOpacity: 0.12,
  emissiveIntensity: 0.6,
  metalness: 0.7,
  roughness: 0.2,
  clearcoat: 1.0,
} as const;

// ── Camera navigation ─────────────────────────────────────────────────────

export const CAMERA_NAV = {
  autoRotateSpeed: 0.3,
  autoRotateIdleMs: 5000,
  focusDistance: 8,
  focusLerpSpeed: 0.05,
  minDistance: 2,
  maxDistance: 200,
  defaultPosition: [40, 25, 40] as [number, number, number],
  dampingFactor: 0.05,
} as const;

// ── Orbital path ───────────────────────────────────────────────────────────

export const ORBITAL_PATH = {
  segments: 96,
  lineWidth: 1,
  opacity: 0.15,
} as const;

// ── Star Chart theme ──────────────────────────────────────────────────────

export const STAR_CHART = {
  bgColor: '#0a1628',
  fogColor: '#0a1628',
  fogDensity: 0.006,
  gridColor: '#1a2d4d',
  gridSecondary: '#111e38',
  wireColor: '#4a8ec2',
  labelColor: '#8ab4d8',
  accentColor: '#5eaadd',
  dimColor: '#2a4a6a',
  starWireOpacity: 0.6,
  planetWireOpacity: 0.5,
  routeOpacity: 0.25,
  orbitOpacity: 0.3,
  orbitLineWidth: 1.5,
} as const;
