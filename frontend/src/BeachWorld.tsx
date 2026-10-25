import { Suspense, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

// The beach, sea and props are Blender models (public/models/beach.glb, water.glb, beach_props.glb)
// seen through the SAME camera the old beach shader used: one unit above the ground, looking along
// the sand toward the sea, with the horizon 9% from the top of the screen and the waterline 55% of
// the way down (the top of the hand zone). So every lane, cannon and ship lands exactly where it did.
// Models are built with the sea at +z; the whole world is mirrored in z so the default camera
// (looking down -z, +x to the right) sees them the right way round.

const BEACH_MODEL = '/models/beach.glb'
const WATER_MODEL = '/models/water.glb'
const PROPS_MODEL = '/models/beach_props.glb'
useGLTF.preload(BEACH_MODEL)
useGLTF.preload(WATER_MODEL)
useGLTF.preload(PROPS_MODEL)

const CAM_H = 1
const TAN_HALF = 0.9
const HORIZON = 0.82 // ndc y of the horizon (1 = top of the screen)
const NEAR = 0.05
const FAR = 400

const HAZE = '#788a90' // pale overcast haze at the horizon, also the distance fog colour

// ---- Sky: the old shader's overcast sky, drawn as a full-screen quad behind everything ----
const skyVertex = /* glsl */ `
  varying vec2 vNdc;
  void main() {
    vNdc = position.xy;
    gl_Position = vec4(position.xy, 1.0, 1.0);
  }
`
const skyFragment = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uAspect;
  varying vec2 vNdc;
  const float TAN_HALF = 0.9;
  const float HORIZON = 0.82;
  const vec3 SUN = vec3(-0.5, 0.2, 0.84);
  const vec3 HAZE = vec3(0.47, 0.53, 0.55);

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float a = 0.5;
    float s = 0.0;
    for (int i = 0; i < 4; i++) {
      s += a * noise(p);
      p = p * 2.03 + vec2(17.1, 9.2);
      a *= 0.5;
    }
    return s;
  }
  void main() {
    vec3 rd = normalize(vec3(vNdc.x * uAspect * TAN_HALF, (vNdc.y - HORIZON) * TAN_HALF, 1.0));
    float up = clamp(rd.y, 0.0, 1.0);
    vec3 col = mix(HAZE, vec3(0.2, 0.26, 0.31), smoothstep(0.0, 0.55, up));
    float cloud = fbm(rd.xz / (rd.y + 0.35) * 1.6 + vec2(uTime * 0.012, 0.0));
    col *= 0.82 + 0.4 * cloud;
    col += vec3(0.34, 0.2, 0.09) * pow(max(dot(normalize(rd), normalize(SUN)), 0.0), 6.0) * 0.55;
    col = col / (1.0 + 0.35 * col);
    col = pow(col * 1.28, vec3(0.97));
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`

function Sky() {
  const { size } = useThree()
  const material = useRef<THREE.ShaderMaterial>(null)
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uAspect: { value: 1 } }), [])
  useFrame((state) => {
    const m = material.current
    if (!m) return
    m.uniforms.uTime.value = state.clock.elapsedTime
    m.uniforms.uAspect.value = size.width / size.height
  })
  return (
    <mesh frustumCulled={false} renderOrder={-10}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={material}
        vertexShader={skyVertex}
        fragmentShader={skyFragment}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  )
}

// ---- Camera: the old shader's off-axis view (horizon high on the screen), as a projection matrix ----
function Rig() {
  const { camera, size } = useThree()
  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera & { manual?: boolean }
    cam.manual = true // keep three-fiber from resetting the projection on resize
    cam.position.set(0, CAM_H, 0)
    cam.rotation.set(0, 0, 0)
    const aspect = size.width / size.height
    cam.projectionMatrix.makePerspective(
      -aspect * TAN_HALF * NEAR,
      aspect * TAN_HALF * NEAR,
      (1 - HORIZON) * TAN_HALF * NEAR,
      -(1 + HORIZON) * TAN_HALF * NEAR,
      NEAR,
      FAR,
    )
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert()
  }, [camera, size])
  return null
}

// ---- Sand and the foam line that washes up and down it ----
function Sand() {
  const { scene } = useGLTF(BEACH_MODEL)
  const { sand, foam, foamMaterial } = useMemo(() => {
    const sand = scene.getObjectByName('beach_sand') as THREE.Mesh
    const foam = scene.getObjectByName('beach_foam') as THREE.Mesh
    sand.material = new THREE.MeshLambertMaterial({ vertexColors: true })
    const foamMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false })
    foam.material = foamMaterial
    return { sand, foam, foamMaterial }
  }, [scene])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    // The wash breathes in and out; the lace thins as it retreats.
    foam.position.z = Math.sin(t * 0.9) * 0.025 - 0.01
    foamMaterial.opacity = 0.55 + 0.2 * Math.sin(t * 0.9 + 1.2)
  })
  return (
    <>
      <primitive object={sand} />
      <primitive object={foam} />
    </>
  )
}

// ---- Sea: the model's grid, with swells added in the vertex shader (no per-frame geometry work) ----
const waveChunk = /* glsl */ `
  uniform float uTime;
  float waveAt(vec2 p) {
    float far = 1.0 / (1.0 + max(p.y - 1.2, 0.0) * 0.12);
    float h = sin(p.x * 2.6 + p.y * 1.9 + uTime * 1.1) * 0.5
            + sin(p.x * 4.9 - p.y * 3.3 + uTime * 1.6) * 0.3
            + sin(p.y * 6.7 + p.x * 1.3 + uTime * 2.1) * 0.2;
    return h * 0.02 * far;
  }
`
function Sea() {
  const { scene } = useGLTF(WATER_MODEL)
  const { water, uniforms } = useMemo(() => {
    const water = scene.getObjectByName('beach_water') as THREE.Mesh
    const uniforms = { uTime: { value: 0 }, uHaze: { value: new THREE.Color(HAZE) } }
    const material = new THREE.MeshPhongMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      shininess: 220,
      specular: new THREE.Color('#b08a5a'),
    })
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.uTime
      shader.uniforms.uHaze = uniforms.uHaze
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${waveChunk}`)
        .replace(
          '#include <beginnormal_vertex>',
          `#include <beginnormal_vertex>
           {
             vec2 wp = position.xz;
             float e = 0.06;
             float h0 = waveAt(wp);
             objectNormal = normalize(vec3(-(waveAt(wp + vec2(e, 0.0)) - h0) / e, 1.0, -(waveAt(wp + vec2(0.0, e)) - h0) / e));
           }`,
        )
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed.y += waveAt(position.xz);')
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uHaze;')
        .replace(
          '#include <opaque_fragment>',
          `float fres = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 4.0);
           outgoingLight = mix(outgoingLight, uHaze, clamp(fres * 0.4, 0.0, 0.6));
           #include <opaque_fragment>`,
        )
    }
    water.material = material
    return { water, uniforms }
  }, [scene])
  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime
  })
  return <primitive object={water} />
}

function Props() {
  const { scene } = useGLTF(PROPS_MODEL)
  const props = useMemo(() => scene.clone(true), [scene])
  return <primitive object={props} />
}

export default function BeachWorld() {
  return (
    <Canvas
      flat
      dpr={1}
      camera={{ position: [0, CAM_H, 0], near: NEAR, far: FAR }}
      gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      onCreated={({ scene }) => {
        scene.fog = new THREE.FogExp2(HAZE, 0.03)
      }}
    >
      <Rig />
      <Sky />
      <ambientLight intensity={1.05} color="#dde2e0" />
      <directionalLight position={[-5, 2, -8.4]} intensity={0.85} color="#ffe2bd" />
      {/* The models face +z; mirroring z puts the sea in front of the default camera. */}
      <group scale={[1, 1, -1]}>
        <Suspense fallback={null}>
          <Sand />
          <Sea />
          <Props />
        </Suspense>
      </group>
    </Canvas>
  )
}
