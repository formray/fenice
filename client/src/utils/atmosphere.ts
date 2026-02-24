// ─── Cosmic palette ─────────────────────────────────────────────────────────

export const COSMIC_PALETTE = {
  bgDeep: '#000008',
  bgNight: '#0a0a2e',
  accentCyan: '#00e5ff',
  accentMagenta: '#ff00aa',
  accentAmber: '#ff8800',
  neutralGlow: '#e0f0ff',
  fogColor: '#000015',
} as const;

export const SCENE_FOG = {
  density: 0.012,
  color: COSMIC_PALETTE.fogColor,
} as const;

export const BLOOM_CONFIG = {
  intensity: 1.0,
  luminanceThreshold: 0.45,
  luminanceSmoothing: 0.8,
  mipmapBlur: true,
} as const;

export const VIGNETTE_CONFIG = {
  offset: 0.3,
  darkness: 0.6,
} as const;

export const CHROMATIC_ABERRATION_CONFIG = {
  offset: [0.0008, 0.0008] as [number, number],
} as const;

export const NOISE_CONFIG = {
  opacity: 0.06,
} as const;

export const STAR_FIELD_CONFIG = {
  count: 3000,
  radius: 150,
  minSize: 0.3,
  maxSize: 2.0,
  twinkleSpeed: 0.8,
  colors: ['#ffffff', '#cce5ff', '#ffe8cc', '#e0f0ff'] as readonly string[],
} as const;

export const NEBULA_CONFIG = {
  count: 3,
  minScale: 40,
  maxScale: 80,
  opacity: 0.04,
  rotationSpeed: 0.0001,
  colors: ['#4a00a0', '#a000c8', '#200060'] as readonly string[],
} as const;

export const DUST_CONFIG = {
  count: 600,
  spread: 60,
  minSize: 0.02,
  maxSize: 0.1,
  driftSpeed: 0.15,
  color: '#e0f0ff',
  opacity: 0.15,
} as const;

export const BUILDING_MATERIAL = {
  metalness: 0.45,
  roughness: 0.3,
  clearcoat: 0.8,
  clearcoatRoughness: 0.1,
  emissiveIntensity: 0.15,
} as const;

export const WIREFRAME_OVERLAY = {
  opacity: 0.12,
  lineWidth: 1,
} as const;

export const DISTRICT_LIGHT = {
  height: 4,
  intensity: 0.5,
  distance: 15,
  decay: 2,
} as const;

export const COSMIC_LIGHTING = {
  ambientIntensity: 0.15,
  ambientColor: '#1a1a3e',
  keyLightIntensity: 0.6,
  keyLightColor: '#e0f0ff',
  keyLightPosition: [15, 25, 15] as [number, number, number],
} as const;
