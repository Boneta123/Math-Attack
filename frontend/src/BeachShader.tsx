import { useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// A full-screen shader that ray-casts a flat ground plane for every pixel, so the beach has real
// perspective: sea out to a hazy horizon, a wet, foamy shoreline 55% of the way down the
// screen (matching the hand zone divider), and lit, rippled sand in front. Colors are written in
// display (sRGB) space, so the material skips three.js color management.

const vertexShader = /* glsl */ `
  varying vec2 vNdc;
  void main() {
    vNdc = position.xy;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uAspect;
  varying vec2 vNdc;

  // Camera one unit above the ground, looking along +z. HORIZON is where the horizon lands on
  // screen (ndc y, 1 = top) and SHORE_NDC is where the waterline lands (55% of the way down).
  const float CAM_H = 1.0;
  const float TAN_HALF = 0.9;
  const float HORIZON = 0.82;
  const float SHORE_NDC = -0.1;

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

  // Overcast sky: pale haze at the horizon, darker overhead, drifting cloud, a faint warm patch
  // where the low sun hides behind the cloud.
  vec3 sky(vec3 rd) {
    float up = clamp(rd.y, 0.0, 1.0);
    vec3 col = mix(HAZE, vec3(0.2, 0.26, 0.31), smoothstep(0.0, 0.55, up));
    float cloud = fbm(rd.xz / (rd.y + 0.35) * 1.6 + vec2(uTime * 0.012, 0.0));
    col *= 0.82 + 0.4 * cloud;
    col += vec3(0.34, 0.2, 0.09) * pow(max(dot(normalize(rd), normalize(SUN)), 0.0), 6.0) * 0.55;
    return col;
  }

  // Sand height: broad dunes, small wind ripples and fine grain.
  float sandHeight(vec2 p) {
    float broad = fbm(p * 3.0);
    float ripple = sin(p.x * 26.0 + fbm(p * 5.0) * 9.0 + p.y * 7.0) * 0.5 + 0.5;
    float grain = noise(p * 120.0);
    return broad * 0.74 + ripple * 0.2 + grain * 0.06;
  }

  vec3 sandColor(vec2 p, float wet, float dist, out float height) {
    height = sandHeight(p);
    vec3 dry = mix(vec3(0.5, 0.4, 0.27), vec3(0.67, 0.56, 0.4), noise(p * 7.0));
    dry *= 0.78 + 0.45 * height;
    // Scattered pebbles (dark) and shell fragments (pale).
    float cell = hash(floor(p * 85.0));
    dry = mix(dry, vec3(0.2, 0.18, 0.16), step(0.996, cell) * 0.4);
    dry = mix(dry, vec3(0.8, 0.76, 0.68), step(0.998, hash(floor(p * 60.0) + 7.0)) * 0.35);
    vec3 wetCol = dry * vec3(0.5, 0.47, 0.44);
    return mix(dry, wetCol, wet);
  }

  void main() {
    vec3 ro = vec3(0.0, CAM_H, 0.0);
    vec3 rd = normalize(vec3(vNdc.x * uAspect * TAN_HALF, (vNdc.y - HORIZON) * TAN_HALF, 1.0));

    // Depth (z) of the waterline, from the ray through the SHORE_NDC row.
    vec3 sd = normalize(vec3(0.0, (SHORE_NDC - HORIZON) * TAN_HALF, 1.0));
    float shoreZ = (CAM_H / -sd.y) * sd.z;

    vec3 col;
    if (rd.y > -0.0015) {
      col = sky(rd);
    } else {
      float t = -CAM_H / rd.y;
      vec2 P = (ro + rd * t).xz;
      float time = uTime;

      // The waterline wanders as swells wash up and back down the beach.
      float shore = shoreZ + 0.035 * sin(time * 0.55 + P.x * 1.3) + 0.05 * (noise(vec2(P.x * 2.5, time * 0.18)) - 0.5);
      float s = P.y - shore; // > 0 over water, < 0 over sand

      if (s > 0.0) {
        // ---- Sea ----
        // Swells rolling toward the shore, plus fine choppy ripples.
        vec2 d1 = normalize(vec2(0.55, -1.0));
        vec2 d2 = normalize(vec2(-0.6, -1.0));
        vec2 d3 = normalize(vec2(0.15, -1.0));
        float p1 = dot(P, d1) * 5.0 + time * 0.9;
        float p2 = dot(P, d2) * 9.0 + time * 1.3;
        float p3 = dot(P, d3) * 15.0 + time * 1.9;
        float height = sin(p1) * 0.5 + sin(p2) * 0.3 + sin(p3) * 0.2;
        vec2 slope = d1 * cos(p1) * 5.0 * 0.5 + d2 * cos(p2) * 9.0 * 0.3 + d3 * cos(p3) * 15.0 * 0.2;
        vec2 q = P * 11.0 + vec2(time * 0.35, -time * 0.5);
        float e = 0.08;
        slope += vec2(noise(q + vec2(e, 0.0)) - noise(q - vec2(e, 0.0)), noise(q + vec2(0.0, e)) - noise(q - vec2(0.0, e))) * 3.0;
        // Flatten the sea with distance so far waves do not shimmer; it mirrors the sky there.
        float near = 1.0 - smoothstep(4.0, 36.0, t);
        vec3 n = normalize(vec3(-slope.x * 0.045 * near, 1.0, -slope.y * 0.045 * near));

        vec3 V = -rd;
        float fres = 0.03 + 0.97 * pow(1.0 - max(dot(n, V), 0.0), 4.0);
        vec3 R = reflect(rd, n);
        R.y = abs(R.y);

        vec3 deep = vec3(0.04, 0.1, 0.12);
        vec3 shallowTint = vec3(0.12, 0.25, 0.25);
        float crest = smoothstep(-0.2, 1.0, height);
        vec3 body = mix(deep, shallowTint, crest * 0.5 + 0.15);
        vec3 water = mix(body, sky(R), fres);

        // A dim sun glint scattered across the swell.
        float glint = pow(max(dot(R, normalize(SUN)), 0.0), 140.0);
        water += vec3(1.0, 0.78, 0.5) * glint * 1.3 * near;

        // Whitecaps on the steepest crests.
        float caps = smoothstep(0.72, 1.0, height) * smoothstep(0.45, 0.75, fbm(P * 9.0 + time * 0.25)) * near;
        water = mix(water, vec3(0.82, 0.87, 0.87), caps * 0.55);

        // Shallows: the water turns clear and green-grey and the sand shows through.
        float depth = smoothstep(0.0, 0.42, s);
        float underH;
        vec3 under = sandColor(P, 1.0, t, underH) * vec3(0.9, 1.05, 1.0) + vec3(0.02, 0.07, 0.06);
        float clear = 1.0 - depth;
        water = mix(water, mix(under, water, 0.45 + 0.4 * depth), clear * 0.9);

        // Foam: a bright wash edge that breathes in and out, a ragged trailing band behind it.
        float wash = 0.05 + 0.04 * sin(time * 0.9 + P.x * 0.9);
        float edge = smoothstep(0.075, 0.0, abs(s - wash));
        float trail = smoothstep(0.5, 0.0, s) * smoothstep(0.45, 0.7, fbm(P * vec2(18.0, 11.0) + vec2(0.0, time * 0.4)));
        float foam = clamp(edge * (0.55 + 0.6 * noise(P * 30.0)) + trail * 0.55, 0.0, 1.0);
        water = mix(water, vec3(0.9, 0.93, 0.92), foam * 0.85);

        col = water;
      } else {
        // ---- Sand ----
        float dry = -s;
        // Wet band at the water's edge; its width follows the wash line.
        float wetEdge = 0.2 + 0.06 * sin(time * 0.55 + P.x * 1.3);
        float wet = smoothstep(wetEdge, 0.0, dry);

        float h;
        vec3 base = sandColor(P, wet, t, h);

        // Bump lighting from the sand height, using finite differences.
        float e = 0.012;
        float hx = sandHeight(P + vec2(e, 0.0));
        float hz = sandHeight(P + vec2(0.0, e));
        vec3 n = normalize(vec3(-(hx - h) / e * 0.05, 1.0, -(hz - h) / e * 0.05));
        vec3 L = normalize(SUN * vec3(1.0, 1.4, 1.0));
        float diff = clamp(dot(n, L), 0.0, 1.0);
        vec3 lit = base * (0.32 + 0.95 * diff);

        // Wet sand is glossy: it mirrors the sky, mostly at grazing angles.
        vec3 V = -rd;
        float fres = 0.04 + 0.5 * pow(1.0 - max(dot(n, V), 0.0), 3.0);
        lit += sky(reflect(rd, n)) * fres * wet * 0.7;

        // Foam left behind by the last wave, and a darker damp line below the wet band.
        float lace = smoothstep(0.12, 0.0, dry) * smoothstep(0.5, 0.72, noise(P * vec2(55.0, 32.0) + time * 0.1));
        lit = mix(lit, vec3(0.85, 0.87, 0.84), lace * 0.5 * (0.5 + 0.5 * sin(time * 0.9 + P.x)));

        col = lit;
      }

      // Aerial haze toward the horizon.
      float fog = 1.0 - exp(-t * 0.05);
      col = mix(col, HAZE * 0.92, clamp(fog, 0.0, 1.0));
    }

    // Soft overcast grade: lift the blacks a touch, compress the highlights.
    col = col / (1.0 + 0.35 * col);
    col = pow(col * 1.28, vec3(0.97));
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`

function Beach() {
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
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={material}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  )
}

export default function BeachShader() {
  return (
    <Canvas
      dpr={1}
      gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <Beach />
    </Canvas>
  )
}
