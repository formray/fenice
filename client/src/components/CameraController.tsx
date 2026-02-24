// client/src/components/CameraController.tsx
import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useViewStore } from '../stores/view.store';
import { CAMERA_NAV } from '../utils/cosmos';

/**
 * Smoothly lerps the OrbitControls target toward focusTarget.
 * Must be placed inside Canvas.
 */
export function CameraController(): null {
  const { controls } = useThree();
  const focusTarget = useViewStore((s) => s.focusTarget);
  const lastInteraction = useRef(Date.now());

  useFrame(() => {
    if (!controls || !('target' in controls)) return;
    const orbitControls = controls as unknown as {
      target: THREE.Vector3;
      autoRotate: boolean;
      update: () => void;
    };

    if (focusTarget) {
      const [tx, ty, tz] = focusTarget;
      orbitControls.target.x = THREE.MathUtils.lerp(
        orbitControls.target.x,
        tx,
        CAMERA_NAV.focusLerpSpeed
      );
      orbitControls.target.y = THREE.MathUtils.lerp(
        orbitControls.target.y,
        ty,
        CAMERA_NAV.focusLerpSpeed
      );
      orbitControls.target.z = THREE.MathUtils.lerp(
        orbitControls.target.z,
        tz,
        CAMERA_NAV.focusLerpSpeed
      );
      orbitControls.update();
      lastInteraction.current = Date.now();
    }

    // Enable auto-rotate after idle
    const idle = Date.now() - lastInteraction.current > CAMERA_NAV.autoRotateIdleMs;
    orbitControls.autoRotate = idle;
  });

  return null;
}
