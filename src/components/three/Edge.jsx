import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * A neon tube edge between two 3D points, with optional flowing particles.
 */
export function Edge({ from, to, color = '#3b82f6', highlighted = false, animated = true, radius = 0.06 }) {
  const curve = useMemo(() => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const mid = start.clone().lerp(end, 0.5);
    // Slight upward bow for a more organic look
    mid.y += start.distanceTo(end) * 0.08;
    return new THREE.CatmullRomCurve3([start, mid, end]);
  }, [from, to]);

  const tubeGeometry = useMemo(
    () => new THREE.TubeGeometry(curve, 32, radius, 8, false),
    [curve, radius]
  );

  return (
    <mesh geometry={tubeGeometry}>
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={highlighted ? 2 : 0.6}
        transparent
        opacity={highlighted ? 0.95 : 0.45}
        toneMapped={false}
      />
      {animated && highlighted && <FlowParticle curve={curve} color={color} />}
    </mesh>
  );
}

function FlowParticle({ curve, color }) {
  const ref = useRef();
  const offset = useMemo(() => Math.random(), []);

  useFrame((state) => {
    if (!ref.current) return;
    const t = ((state.clock.elapsedTime * 0.5 + offset) % 1);
    const point = curve.getPointAt(t);
    ref.current.position.copy(point);
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.18, 16, 16]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}
