import { Canvas } from '@react-three/fiber';
import { Environment, OrbitControls, Stars } from '@react-three/drei';
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { Vector2 } from 'three';

/**
 * Reusable Three.js scene for the relationship graphs.
 * Sets up lighting, environment, post-processing, and orbit controls.
 */
export function Scene({ children, cameraPosition = [0, 0, 80], enableStars = true, enableBloom = true }) {
  return (
    <Canvas
      camera={{ position: cameraPosition, fov: 50, near: 0.1, far: 1000 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      dpr={[1, 2]}
    >
      <color attach="background" args={['#0a0e1a']} />
      <fog attach="fog" args={['#0a0e1a', 120, 450]} />

      {/* Lighting setup for glass refraction */}
      <ambientLight intensity={0.3} />
      <directionalLight position={[20, 20, 20]} intensity={1.2} castShadow />
      <directionalLight position={[-20, -10, -20]} intensity={0.6} color="#6366f1" />
      <pointLight position={[0, 30, 0]} intensity={0.8} color="#f59e0b" />

      {/* HDR-like environment that glass nodes refract */}
      <Environment preset="night" />

      {/* Subtle starfield background */}
      {enableStars && <Stars radius={150} depth={80} count={2500} factor={3} saturation={0} fade speed={0.6} />}

      {children}

      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.6}
        zoomSpeed={0.8}
        minDistance={20}
        maxDistance={200}
      />

      {enableBloom && (
        <EffectComposer multisampling={0}>
          <Bloom intensity={1.2} luminanceThreshold={0.2} luminanceSmoothing={0.9} mipmapBlur />
          <ChromaticAberration
            blendFunction={BlendFunction.NORMAL}
            offset={new Vector2(0.0005, 0.0005)}
          />
        </EffectComposer>
      )}
    </Canvas>
  );
}
