import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

export function App(): React.JSX.Element {
  return (
    <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} />
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#4A90D9" />
      </mesh>
      <gridHelper args={[20, 20, '#333', '#222']} />
      <OrbitControls />
    </Canvas>
  );
}
