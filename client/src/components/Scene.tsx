import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { City } from './City';

export function Scene(): React.JSX.Element {
  const [showGrid] = useState(false);

  return (
    <Canvas camera={{ position: [20, 20, 20], fov: 50 }} style={{ width: '100%', height: '100%' }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[15, 25, 15]} intensity={0.8} />
      <directionalLight position={[-10, 15, -10]} intensity={0.3} />
      {/* Dark ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#050510" roughness={1} />
      </mesh>
      {/* Optional grid overlay (faint) */}
      {showGrid && <gridHelper args={[60, 60, '#1a1a2e', '#111128']} position={[0, 0.002, 0]} />}
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
