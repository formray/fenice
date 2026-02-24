import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import {
  EffectComposer,
  Bloom,
  Vignette,
  ChromaticAberration,
  Noise,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { City } from './City';
import { Cosmos } from './Cosmos';
import { CameraController } from './CameraController';
import { CAMERA_NAV } from '../utils/cosmos';
import { StarField } from './StarField';
import { Nebulae } from './Nebulae';
import { DustParticles } from './DustParticles';
import { useViewStore } from '../stores/view.store';
import {
  COSMIC_PALETTE,
  SCENE_FOG,
  VIGNETTE_CONFIG,
  CHROMATIC_ABERRATION_CONFIG,
  NOISE_CONFIG,
  COSMIC_LIGHTING,
} from '../utils/atmosphere';
import { useCosmosSettingsStore } from '../stores/cosmos-settings.store';

const SCENE_THEME = {
  dark: {
    canvasBg: COSMIC_PALETTE.bgDeep,
    groundColor: '#050510',
    ambientIntensity: COSMIC_LIGHTING.ambientIntensity,
    keyLight: COSMIC_LIGHTING.keyLightIntensity,
    fillLight: 0.2,
    gridMajor: '#1b2440',
    gridMinor: '#131b33',
  },
  light: {
    canvasBg: '#e9f1ff',
    groundColor: '#dce7fb',
    ambientIntensity: 0.75,
    keyLight: 0.95,
    fillLight: 0.42,
    gridMajor: '#9eb3da',
    gridMinor: '#c6d3ef',
  },
} as const;

function SceneEffects({ isDark }: { isDark: boolean }): React.JSX.Element | null {
  const bloomIntensity = useCosmosSettingsStore((s) => s.bloomIntensity);
  const bloomThreshold = useCosmosSettingsStore((s) => s.bloomThreshold);

  if (!isDark) return null;

  return (
    <EffectComposer>
      <Bloom
        intensity={bloomIntensity}
        luminanceThreshold={bloomThreshold}
        luminanceSmoothing={0.8}
        mipmapBlur
      />
      <Vignette offset={VIGNETTE_CONFIG.offset} darkness={VIGNETTE_CONFIG.darkness} />
      <ChromaticAberration
        offset={new THREE.Vector2(...CHROMATIC_ABERRATION_CONFIG.offset)}
        blendFunction={BlendFunction.NORMAL}
      />
      <Noise opacity={NOISE_CONFIG.opacity} blendFunction={BlendFunction.SOFT_LIGHT} />
    </EffectComposer>
  );
}

const TRON_CAMERA = {
  position: [0, 22, 28] as [number, number, number],
  fov: 50,
} as const;

export function Scene(): React.JSX.Element {
  const visualMode = useViewStore((s) => s.visualMode);
  const showGrid = useViewStore((s) => s.showGrid);
  const sceneMode = useViewStore((s) => s.sceneMode);
  const sceneTheme = SCENE_THEME[visualMode];
  const isDark = visualMode === 'dark';
  const isCosmos = sceneMode === 'cosmos';

  const cameraPosition = isCosmos ? CAMERA_NAV.defaultPosition : TRON_CAMERA.position;
  const cameraFov = isCosmos ? 60 : TRON_CAMERA.fov;

  return (
    <Canvas
      camera={{
        position: cameraPosition,
        fov: cameraFov,
        near: 0.1,
        far: 500,
      }}
      style={{ width: '100%', height: '100%', backgroundColor: sceneTheme.canvasBg }}
      gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
    >
      {isDark && <fogExp2 attach="fog" args={[SCENE_FOG.color, SCENE_FOG.density]} />}
      {isDark && (
        <>
          <StarField />
          <Nebulae />
          <DustParticles />
        </>
      )}
      <ambientLight
        intensity={sceneTheme.ambientIntensity}
        color={isDark ? COSMIC_LIGHTING.ambientColor : '#ffffff'}
      />
      <directionalLight
        position={COSMIC_LIGHTING.keyLightPosition}
        intensity={sceneTheme.keyLight}
        color={isDark ? COSMIC_LIGHTING.keyLightColor : '#ffffff'}
      />
      <directionalLight position={[-10, 15, -10]} intensity={sceneTheme.fillLight} />
      {/* Ground plane for Tron City mode or light theme */}
      {(!isDark || !isCosmos) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <planeGeometry args={[200, 200]} />
          <meshStandardMaterial color={sceneTheme.groundColor} roughness={1} />
        </mesh>
      )}
      {showGrid && (
        <gridHelper
          args={[60, 60, sceneTheme.gridMajor, sceneTheme.gridMinor]}
          position={[0, 0.002, 0]}
        />
      )}
      {isCosmos ? <Cosmos /> : <City />}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={CAMERA_NAV.dampingFactor}
        autoRotate={isCosmos}
        autoRotateSpeed={CAMERA_NAV.autoRotateSpeed}
        minDistance={CAMERA_NAV.minDistance}
        maxDistance={CAMERA_NAV.maxDistance}
      />
      {isCosmos && <CameraController />}
      <SceneEffects isDark={isDark} />
    </Canvas>
  );
}
