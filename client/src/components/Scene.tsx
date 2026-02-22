import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { City } from './City';

export function Scene(): React.JSX.Element {
  return (
    <Canvas camera={{ position: [20, 20, 20], fov: 50 }} style={{ width: '100%', height: '100%' }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[15, 25, 15]} intensity={0.8} />
      <directionalLight position={[-10, 15, -10]} intensity={0.3} />
      <gridHelper args={[60, 60, '#333', '#1a1a2e']} />
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
