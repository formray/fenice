import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { City } from './City';
import { useViewStore } from '../stores/view.store';

const SCENE_THEME = {
  dark: {
    canvasBg: '#01030f',
    groundColor: '#050510',
    ambientIntensity: 0.62,
    keyLight: 0.84,
    fillLight: 0.32,
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

export function Scene(): React.JSX.Element {
  const visualMode = useViewStore((s) => s.visualMode);
  const showGrid = useViewStore((s) => s.showGrid);
  const sceneTheme = SCENE_THEME[visualMode];

  return (
    <Canvas
      camera={{ position: [20, 20, 20], fov: 50 }}
      style={{ width: '100%', height: '100%', backgroundColor: sceneTheme.canvasBg }}
    >
      <ambientLight intensity={sceneTheme.ambientIntensity} />
      <directionalLight position={[15, 25, 15]} intensity={sceneTheme.keyLight} />
      <directionalLight position={[-10, 15, -10]} intensity={sceneTheme.fillLight} />
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color={sceneTheme.groundColor} roughness={1} />
      </mesh>
      {/* Optional grid overlay (faint) */}
      {showGrid && (
        <gridHelper
          args={[60, 60, sceneTheme.gridMajor, sceneTheme.gridMinor]}
          position={[0, 0.002, 0]}
        />
      )}
      <City />
      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        maxPolarAngle={Math.PI / 2.2}
        minDistance={5}
        maxDistance={80}
      />
    </Canvas>
  );
}
