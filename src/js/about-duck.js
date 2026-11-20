// The chrome rubber duck for the About page. Same model, normalisation, chrome
// material, bright studio environment, squeeze morph and squeak as the home hero
// (js/hero3d.js), lifted here so the two pages stay independent. On top of that:
// a liquid-glass reveal and a cobalt hover glow, injected into the material shader.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const clamp01 = (v) => Math.min(1, Math.max(0, v));

// A bright studio dome with dark flags and softboxes, baked with PMREM.
// (RoomEnvironment is a dark room: chrome would read black on a white page.)
function buildEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new THREE.Scene();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(40, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: `varying vec3 vP;
        void main(){
          float h = vP.y;
          vec3 c = mix(vec3(0.16,0.17,0.21), vec3(0.8,0.82,0.88), smoothstep(-0.1, 0.55, h));
          c *= mix(0.9, 1.9, smoothstep(0.35, 1.0, h));
          c = mix(vec3(0.05,0.055,0.07), c, smoothstep(-0.85, 0.0, h));
          float az = atan(vP.x, vP.z);
          float flag = smoothstep(0.35, 0.2, abs(sin(az * 2.0 + 0.4))) * smoothstep(-0.5, 0.0, h) * smoothstep(0.95, 0.6, h);
          c = mix(c, vec3(0.02,0.025,0.04), flag * 0.85);
          gl_FragColor = vec4(c, 1.0);
        }`,
    }));
  room.add(dome);
  const box = (w, h, pos, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); room.add(m);
  };
  box(14, 9, [-14, 9, 12], 6); box(5, 14, [16, 3, 6], 4); box(18, 3, [0, 14, -10], 5);
  const env = pmrem.fromScene(room, 0.02).texture;
  room.traverse((o) => { o.geometry && o.geometry.dispose(); o.material && o.material.dispose && o.material.dispose(); });
  return { env, pmrem };
}

// Liquid reveal + hover glow. `uni` is shared with the page code, which drives it.
function injectShader(mat, uni) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLP = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vLP;
uniform float uReveal, uTime, uHover, uMinY, uMaxY;
uniform vec3 uHP, uCobalt;
float abHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float abNoise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(abHash(i), abHash(i + vec2(1.,0.)), f.x), mix(abHash(i + vec2(0.,1.)), abHash(i + vec2(1.,1.)), f.x), f.y);
}
const float AB_BAND = 0.97;
float abFront(){
  float bot = uMinY - AB_BAND, top = uMaxY + 0.25 * AB_BAND;
  float wave = (abNoise(vLP.xz * 2.3 + vec2(uTime * 0.7, -uTime * 0.5)) - 0.5) * 0.95 * (1.0 - uReveal);
  return mix(bot, top, uReveal) + wave;
}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
  float abFy = abFront();
  if (uReveal < 0.9995 && vLP.y > abFy) discard;`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
  {
    float dd = abFy - vLP.y;
    float inBand = (1.0 - smoothstep(0.0, AB_BAND, dd)) * (1.0 - step(0.9995, uReveal));
    float lum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
    gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.56, 0.63, 1.0) * (0.62 + 0.55 * lum), inBand * 0.62);
    float men = pow(clamp(1.0 - dd / 0.14, 0.0, 1.0), 3.0) * 1.4 * (1.0 - step(0.9995, uReveal));
    gl_FragColor.rgb += uCobalt * men;
    float hg = pow(clamp(1.0 - distance(vLP, uHP) / 1.09, 0.0, 1.0), 3.0);
    gl_FragColor.rgb += uCobalt * hg * 0.55 * uHover;
  }`);
  };
  mat.customProgramCacheKey = () => 'about-duck';
}

// Resolves to { pivot, mesh, mat, uni, setSqueeze, dispose } or rejects when the model can't load.
export function loadDuck(renderer) {
  return new Promise((resolve, reject) => {
    const { env, pmrem } = buildEnvironment(renderer);
    new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load('assets/3d/duck.glb', (gltf) => {
      let src = null;
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((o) => { if (!src && o.isMesh) src = o; });
      if (!src) { reject(new Error('duck.glb has no mesh')); return; }
      const g = src.geometry.clone();
      g.applyMatrix4(src.matrixWorld);
      g.rotateY(-Math.PI / 2);
      g.deleteAttribute('uv'); // no texture: pure chrome
      g.computeBoundingBox();
      const bb = g.boundingBox, c = bb.getCenter(new THREE.Vector3());
      g.translate(-c.x, -bb.min.y, -c.z);
      // Reference units: height 1.93, base at y = 0.085.
      const k = 1.93 / (bb.max.y - bb.min.y);
      g.scale(k, k, k);
      g.translate(0, 0.085, 0);
      g.computeVertexNormals();

      // Compression morph: belly bulges out, the whole body shortens.
      const pos = g.attributes.position;
      const sm = (x, a, b) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
      const squished = g.clone();
      const sp = squished.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const belly = Math.exp(-(((y - 0.62) / 0.5) ** 2));
        sp.setXYZ(i, x * (1 + 0.15 * belly), y - 0.28 * sm(y, 0.2, 1.22), z * (1 + 0.09 * belly));
      }
      squished.computeVertexNormals();
      const dPos = new Float32Array(pos.count * 3), dNor = new Float32Array(pos.count * 3);
      const n0 = g.attributes.normal, n1 = squished.attributes.normal;
      for (let i = 0; i < pos.count * 3; i++) { dPos[i] = sp.array[i] - pos.array[i]; dNor[i] = n1.array[i] - n0.array[i]; }
      g.morphAttributes.position = [new THREE.Float32BufferAttribute(dPos, 3)];
      g.morphAttributes.normal = [new THREE.Float32BufferAttribute(dNor, 3)];
      g.morphTargetsRelative = true;
      squished.dispose();
      // Centre vertically for the pivot; the morph deltas are translation-independent.
      g.translate(0, -(0.085 + 1.93 / 2), 0);
      g.computeBoundingSphere();
      g.computeBoundingBox();

      const uni = {
        uReveal: { value: 0 }, uTime: { value: 0 }, uHover: { value: 0 },
        uMinY: { value: g.boundingBox.min.y }, uMaxY: { value: g.boundingBox.max.y },
        uHP: { value: new THREE.Vector3() }, uCobalt: { value: new THREE.Color('#2f2bff') },
      };
      const mat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff, metalness: 1, roughness: 0.09, envMap: env, envMapIntensity: 1.25,
        clearcoat: 0.6, clearcoatRoughness: 0.05,
      });
      injectShader(mat, uni);
      const mesh = new THREE.Mesh(g, mat);
      mesh.morphTargetInfluences = [0];
      mesh.frustumCulled = false;
      const pivot = new THREE.Group();
      pivot.add(mesh);
      resolve({
        pivot, mesh, mat, uni,
        dispose() { g.dispose(); mat.dispose(); env.dispose(); pmrem.dispose(); },
      });
    }, undefined, reject);
  });
}

// Synthesized squeak (same as the hero). Created lazily on the first press.
let ctx = null;
// While the page's music player is playing, the squeak stays silent: a second audio
// context would compete with the <audio> element (on iOS it can mute or duck it).
const musicOn = () => !!window.__abMusicPlaying;
export function primeAudio() {
  if (musicOn()) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC && !ctx) ctx = new AC();
    ctx && ctx.state === 'suspended' && ctx.resume();
  } catch (e) { /* audio is optional */ }
}
export function squeak() {
  if (musicOn()) return;
  try {
    primeAudio();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator(), bp = ctx.createBiquadFilter(), gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(790, t);
    osc.frequency.linearRampToValueAtTime(1320, t + 0.045);
    osc.frequency.linearRampToValueAtTime(510, t + 0.2);
    bp.type = 'bandpass'; bp.frequency.value = 1600; bp.Q.value = 2;
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.015);
    gain.gain.linearRampToValueAtTime(0.001, t + 0.22);
    osc.connect(bp); bp.connect(gain); gain.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.25);
  } catch (e) { /* audio is optional */ }
}
