import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

/**
 * A real-glass node — refractive sphere with optional label and emissive halo.
 */
export function GlassNode({
  position,
  radius = 4,
  color = '#3b82f6',
  label,
  sublabel,
  selected = false,
  onClick,
  onPointerOver,
  onPointerOut,
}) {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    // Subtle floating animation
    meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.6 + position[0]) * 0.15;
    // Gentle rotation
    meshRef.current.rotation.y += delta * 0.15;
    // Scale on hover
    const target = hovered || selected ? 1.15 : 1;
    meshRef.current.scale.lerp(new THREE.Vector3(target, target, target), 0.15);
  });

  return (
    <group>
      {/* Emissive halo (glow when selected/hovered) */}
      {(selected || hovered) && (
        <mesh position={position}>
          <sphereGeometry args={[radius * 1.6, 32, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.08} />
        </mesh>
      )}

      {/* Inner colored core (visible through the glass) */}
      <mesh position={position}>
        <sphereGeometry args={[radius * 0.55, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={selected ? 1.4 : hovered ? 0.9 : 0.4}
          roughness={0.2}
          metalness={0.1}
        />
      </mesh>

      {/* Outer glass shell */}
      <mesh
        ref={meshRef}
        position={position}
        onClick={(e) => { e.stopPropagation(); onClick?.(); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); onPointerOver?.(); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); onPointerOut?.(); document.body.style.cursor = 'auto'; }}
      >
        <sphereGeometry args={[radius, 64, 64]} />
        <meshPhysicalMaterial
          color="#ffffff"
          transmission={1}
          opacity={1}
          transparent
          roughness={0.05}
          metalness={0}
          ior={1.5}
          thickness={1.5}
          clearcoat={1}
          clearcoatRoughness={0.05}
          envMapIntensity={1.2}
          attenuationColor={color}
          attenuationDistance={6}
        />
      </mesh>

      {/* HTML label floating above the node */}
      {label && (
        <Html
          position={[position[0], position[1] + radius + 1.4, position[2]]}
          center
          distanceFactor={20}
          style={{
            pointerEvents: 'none',
            transition: 'opacity 0.2s',
            opacity: hovered || selected ? 1 : 0.85,
          }}
        >
          <div
            className="rounded-lg border border-white/20 bg-black/40 px-2.5 py-1 text-center backdrop-blur-md"
            style={{ minWidth: 80 }}
          >
            <div className="text-[11px] font-bold text-white" style={{ color }}>{label}</div>
            {sublabel && <div className="text-[9px] text-white/70">{sublabel}</div>}
          </div>
        </Html>
      )}
    </group>
  );
}
