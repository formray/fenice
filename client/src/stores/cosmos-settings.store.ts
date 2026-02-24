import { create } from 'zustand';
import { COSMOS_LAYOUT, SERVICE_STAR, ENDPOINT_PLANET, CURVED_ROUTE } from '../utils/cosmos';
import { BLOOM_CONFIG } from '../utils/atmosphere';

export interface CosmosSettings {
  // Layout
  innerRingRadius: number;
  outerRingRadius: number;
  // Stars
  starCoreRadius: number;
  starEmissiveIntensity: number;
  starGlowScale: number;
  // Planets
  planetMinSize: number;
  planetMaxSize: number;
  orbitSpeed: number;
  // Routes
  routeArchHeight: number;
  routeOpacity: number;
  // Bloom
  bloomIntensity: number;
  bloomThreshold: number;
}

interface CosmosSettingsState extends CosmosSettings {
  set: (partial: Partial<CosmosSettings>) => void;
  resetDefaults: () => void;
}

const DEFAULTS: CosmosSettings = {
  innerRingRadius: COSMOS_LAYOUT.innerRingRadius,
  outerRingRadius: COSMOS_LAYOUT.outerRingRadius,
  starCoreRadius: SERVICE_STAR.coreRadius,
  starEmissiveIntensity: SERVICE_STAR.emissiveIntensity,
  starGlowScale: SERVICE_STAR.glowScale,
  planetMinSize: ENDPOINT_PLANET.minSize,
  planetMaxSize: ENDPOINT_PLANET.maxSize,
  orbitSpeed: ENDPOINT_PLANET.baseOrbitSpeed,
  routeArchHeight: CURVED_ROUTE.archHeight,
  routeOpacity: CURVED_ROUTE.opacity,
  bloomIntensity: BLOOM_CONFIG.intensity,
  bloomThreshold: BLOOM_CONFIG.luminanceThreshold,
};

export const COSMOS_DEFAULTS = DEFAULTS;

export const useCosmosSettingsStore = create<CosmosSettingsState>((set) => ({
  ...DEFAULTS,
  set: (partial) => set(partial),
  resetDefaults: () => set(DEFAULTS),
}));
