// client/src/components/Cosmos.tsx
import { useMemo } from 'react';
import { useWorldStore } from '../stores/world.store';
import { computeCosmosLayout, type CosmosPosition } from '../services/cosmos-layout.service';
import { ServiceStar } from './ServiceStar';
import { EndpointPlanet } from './EndpointPlanet';
import { OrbitalPath } from './OrbitalPath';
import { CurvedRoute } from './CurvedRoute';
import { Wormhole } from './Wormhole';
import { METHOD_COLORS, LINK_STATE_COLORS } from '../utils/colors';
import { seededRandom, COSMOS_LAYOUT } from '../utils/cosmos';
import { useCosmosSettingsStore } from '../stores/cosmos-settings.store';

export function Cosmos(): React.JSX.Element | null {
  const services = useWorldStore((s) => s.services);
  const endpoints = useWorldStore((s) => s.endpoints);
  const edges = useWorldStore((s) => s.edges);
  const endpointSemantics = useWorldStore((s) => s.endpointSemantics);
  const innerRingRadius = useCosmosSettingsStore((s) => s.innerRingRadius);
  const outerRingRadius = useCosmosSettingsStore((s) => s.outerRingRadius);
  const planetMinSize = useCosmosSettingsStore((s) => s.planetMinSize);
  const planetMaxSize = useCosmosSettingsStore((s) => s.planetMaxSize);
  const ySpread = useCosmosSettingsStore((s) => s.ySpread);

  const layout = useMemo(
    () =>
      computeCosmosLayout(services, endpoints, {
        innerRingRadius,
        outerRingRadius,
        planetMinSize,
        planetMaxSize,
        ySpread,
      }),
    [services, endpoints, innerRingRadius, outerRingRadius, planetMinSize, planetMaxSize, ySpread]
  );

  const endpointMap = useMemo(() => new Map(endpoints.map((e) => [e.id, e])), [endpoints]);

  // Build star position lookup
  const starMap = useMemo(() => new Map(layout.stars.map((s) => [s.serviceId, s])), [layout.stars]);

  // Group edges by (sourceService -> targetService) for inter-service routes
  const serviceRoutes = useMemo(() => {
    const routeMap = new Map<string, { from: CosmosPosition; to: CosmosPosition; color: string }>();
    for (const edge of edges) {
      const sourceEp = endpointMap.get(edge.sourceId);
      const targetEp = endpointMap.get(edge.targetId);
      if (!sourceEp || !targetEp) continue;
      if (sourceEp.serviceId === targetEp.serviceId) continue; // skip intra-service

      const key = [sourceEp.serviceId, targetEp.serviceId].sort().join('\u2192');
      if (routeMap.has(key)) continue;

      const fromStar = starMap.get(sourceEp.serviceId);
      const toStar = starMap.get(targetEp.serviceId);
      if (!fromStar || !toStar) continue;

      // Route color from worst link state of constituent edges
      const sourceSem = endpointSemantics[sourceEp.id];
      const linkState = sourceSem?.linkState ?? 'unknown';
      const color = LINK_STATE_COLORS[linkState].hex;

      routeMap.set(key, {
        from: fromStar.position,
        to: toStar.position,
        color,
      });
    }
    return [...routeMap.values()];
  }, [edges, endpointMap, starMap, endpointSemantics]);

  // Compute orbit tilts for orbital paths (same tilt as planets)
  const orbitTilts = useMemo(() => {
    const tilts = new Map<string, number>();
    for (const star of layout.stars) {
      tilts.set(
        star.serviceId,
        (seededRandom(star.serviceId, 1) - 0.5) * COSMOS_LAYOUT.orbitTiltRange * 2
      );
    }
    return tilts;
  }, [layout.stars]);

  if (endpoints.length === 0) return null;

  return (
    <group>
      {/* Wormhole at origin */}
      <Wormhole position={layout.wormholePosition} />

      {/* Service stars */}
      {layout.stars.map((star) => (
        <ServiceStar key={star.serviceId} star={star} />
      ))}

      {/* Orbital paths */}
      {layout.stars.map((star) => {
        const tilt = orbitTilts.get(star.serviceId) ?? 0;
        const serviceEps = endpoints.filter((e) => e.serviceId === star.serviceId);
        if (serviceEps.length === 0) return null;
        const color = METHOD_COLORS[serviceEps[0]!.method];
        return (
          <OrbitalPath
            key={`orbit-${star.serviceId}`}
            center={star.position}
            radius={star.orbitRadius}
            tilt={tilt}
            color={color}
          />
        );
      })}

      {/* Endpoint planets */}
      {layout.planets.map((planet) => {
        const endpoint = endpointMap.get(planet.endpointId);
        if (!endpoint) return null;
        return <EndpointPlanet key={planet.endpointId} planet={planet} endpoint={endpoint} />;
      })}

      {/* Backbone routes: wormhole → each service star (subtle ethereal links) */}
      {layout.stars.map((star) => (
        <CurvedRoute
          key={`backbone-${star.serviceId}`}
          from={layout.wormholePosition}
          to={star.position}
          color={star.zone === 'protected-core' ? '#00e5ff' : '#4a6fa5'}
          opacity={0.12}
          tubeRadius={0.015}
          pulseSize={0.08}
        />
      ))}

      {/* Inter-service curved routes */}
      {serviceRoutes.map((route, i) => (
        <CurvedRoute key={`route-${i}`} from={route.from} to={route.to} color={route.color} />
      ))}
    </group>
  );
}
