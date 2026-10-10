/**
 * The locate signal: luminous bands traveling along each line (spacing stands in for frequency,
 * brightness for current), chevrons for direction, and faint return paths through the soil to the
 * ground stake, so the circuit reads as one loop. The line shaders evaluate the same current
 * formula as the model (src/signal/model.ts), so the 3D view and the chart always agree.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  CubicBezierCurve3,
  CustomBlending,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  OneFactor,
  OneMinusSrcAlphaFactor,
  ShaderMaterial,
  TubeGeometry,
  Vector3,
  type IUniform,
} from 'three';
import { FREQUENCIES, type Frequency } from '../../../../config/equipment.ts';
import { SIGNAL_COLOR } from '../../../design/tokens.ts';
import { pipeAlongX } from '../../../kit3d/geometry.ts';
import { DEPTH_TEST_GLSL, type DepthUniforms } from '../../../kit3d/signal-pass.ts';
import { GEOMETRY } from '../../../signal/constants.ts';
import {
  SETUPS,
  decayPerFt,
  transmitterReading,
  type LabState,
  type SetupId,
} from '../../../signal/model.ts';
import { HOOKUP, LINES, STAKE_TIP } from './layout.ts';

/** Band spacing per frequency, in feet: the slowed-down stand-in for wavelength. */
const BAND_SPACING_FT: Record<Frequency, number> = { 512: 14, 8000: 7, 33000: 3.5, 83000: 1.8 };
/** Bands travel at one speed; at the tightest spacing they pass a point about 2.2 times a second (under 3 Hz). */
const BAND_SPEED_FT_S = 4;
const LINE_INTENSITY = 4.6;
const FLOW_INTENSITY = 2.6;
const CHEVRON_INTENSITY = 2.6;
const CHEVRON_STEP_FT = 9;
const BLOCK_FT = GEOMETRY.blockLengthFt.value;

const VERTEX = /* glsl */ `
attribute float aDist;
varying float vDist;
varying vec3 vNormalV;
varying vec3 vViewDir;
void main() {
  vDist = aDist;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormalV = normalize(normalMatrix * normal);
  vViewDir = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const FRAGMENT = /* glsl */ `
${DEPTH_TEST_GLSL}
uniform vec3 uColor;
uniform float uIntensity;
uniform float uTime;
uniform float uSpacing;
uniform float uSpeed;
uniform float uDir;
uniform float uI0;
uniform float uK;
uniform float uShare;
uniform float uMinX;
uniform float uRef;
uniform float uMode;
uniform float uStart;
uniform float uEnd;
// Glow between bands: a little on lines, none on soil return paths (they read as moving dashes).
uniform float uBase;
// Band sharpness: wider pulses on lines, short dashes on soil return paths.
uniform float uSharp;
varying float vDist;
varying vec3 vNormalV;
varying vec3 vViewDir;

// Same formula as targetCurrentAt() in src/signal/model.ts.
float currentAt(float x) {
  if (x < uMinX) return 0.0;
  return uI0 * exp(-uK * max(x, 0.0)) * uShare;
}

void main() {
  if (behindScene()) discard;
  float current = uMode < 0.5 ? currentAt(vDist) : uI0;
  float b = pow(clamp(current / uRef, 0.0, 1.0), 0.75);
  float phase = (vDist - uDir * uSpeed * uTime) / uSpacing;
  float band = pow(0.5 + 0.5 * cos(6.2831853 * phase), uSharp);
  float rim = mix(1.0, 0.55, abs(dot(vNormalV, vViewDir)));
  float ends = smoothstep(uStart, uStart + 2.0, vDist) * (1.0 - smoothstep(uEnd - 2.0, uEnd, vDist));
  float glow = (uBase + (1.0 - uBase) * band) * b * ends * rim;
  // Premultiplied: bright bands read as pure signal color, and the line keeps its own color between them.
  gl_FragColor = vec4(uColor * uIntensity * glow, clamp(glow * 1.8, 0.0, 1.0));
}`;

const CHEVRON_VERTEX = /* glsl */ `
attribute float aBright;
varying float vBright;
void main() {
  vBright = aBright;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`;

const CHEVRON_FRAGMENT = /* glsl */ `
${DEPTH_TEST_GLSL}
uniform vec3 uColor;
uniform float uIntensity;
varying float vBright;
void main() {
  if (behindScene()) discard;
  gl_FragColor = vec4(uColor * uIntensity * vBright, clamp(vBright * 1.8, 0.0, 1.0));
}`;

type Uniforms = Record<string, IUniform>;

const BLENDING = {
  blending: CustomBlending,
  blendSrc: OneFactor,
  blendDst: OneMinusSrcAlphaFactor,
  transparent: true,
  depthTest: false,
  depthWrite: false,
} as const;

/** Distance along the line for a straight line along X: just its x. */
function withXDistance(geometry: BufferGeometry): BufferGeometry {
  const pos = geometry.getAttribute('position');
  const dist = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) dist[i] = pos.getX(i);
  geometry.setAttribute('aDist', new BufferAttribute(dist, 1));
  return geometry;
}

/** Arc length along a tube, for each vertex. */
function withTubeDistance(geometry: TubeGeometry, length: number): TubeGeometry {
  const { tubularSegments, radialSegments } = geometry.parameters;
  const pos = geometry.getAttribute('position');
  const dist = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    dist[i] = (Math.floor(i / (radialSegments + 1)) / tubularSegments) * length;
  }
  geometry.setAttribute('aDist', new BufferAttribute(dist, 1));
  return geometry;
}

function chevronGeometry(): BufferGeometry {
  // A flat V pointing +X, in the plane of the cut face.
  const arm = (y: number) => [-0.28, y, 0, 0.12, 0, 0, 0.0, 0, 0, -0.4, y, 0];
  const v = new Float32Array([...arm(0.26), ...arm(-0.26)]);
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(v, 3));
  g.setIndex([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6]);
  return g;
}

interface Flow {
  material: ShaderMaterial;
  /** What this path carries: soil leakage from a stretch of the line, current from past the block, or the telecom's share. */
  source: { kind: 'leak'; from: number; to: number } | { kind: 'beyond' } | { kind: 'telecom' };
}

interface SetupFx {
  group: Group;
  target: ShaderMaterial;
  telecom: ShaderMaterial;
  chevrons: InstancedMesh[];
  flows: Flow[];
}

export class SignalEffects {
  readonly group = new Group();
  private readonly time = { value: 0 };
  private readonly depth: DepthUniforms;
  private readonly color = new Color(SIGNAL_COLOR);
  private readonly setups: Record<SetupId, SetupFx>;

  constructor(depth: DepthUniforms) {
    this.depth = depth;
    this.group.name = 'signal';
    this.setups = { steel: this.buildSetup('steel'), plastic: this.buildSetup('plastic') };
    for (const id of SETUPS) this.group.add(this.setups[id].group);
  }

  private material(extra: Uniforms): ShaderMaterial {
    return new ShaderMaterial({
      uniforms: {
        ...this.depth,
        uTime: this.time,
        uColor: { value: this.color },
        uIntensity: { value: LINE_INTENSITY },
        uSpacing: { value: 7 },
        uSpeed: { value: BAND_SPEED_FT_S },
        uDir: { value: 1 },
        uI0: { value: 0 },
        uK: { value: 0 },
        uShare: { value: 1 },
        uMinX: { value: -1e6 },
        uRef: { value: 1 },
        uMode: { value: 0 },
        uStart: { value: -1e6 },
        uEnd: { value: 1e6 },
        uBase: { value: 0.05 },
        uSharp: { value: 6 },
        ...extra,
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      ...BLENDING,
    });
  }

  private sleeve(x0: number, x1: number, y: number, radius: number, extra: Uniforms = {}): Mesh {
    const geometry = withXDistance(pipeAlongX(x0, x1, y, 0, radius * 1.18 + 0.025, 24));
    const material = this.material({ uStart: { value: x0 }, uEnd: { value: x1 }, ...extra });
    const m = new Mesh(geometry, material);
    m.frustumCulled = false;
    return m;
  }

  private chevrons(x0: number, x1: number, y: number, z: number, direction: 1 | -1): InstancedMesh {
    const xs: number[] = [];
    for (let x = x0; x <= x1; x += CHEVRON_STEP_FT) xs.push(x);
    const material = new ShaderMaterial({
      uniforms: {
        ...this.depth,
        uColor: { value: this.color },
        uIntensity: { value: CHEVRON_INTENSITY },
      },
      vertexShader: CHEVRON_VERTEX,
      fragmentShader: CHEVRON_FRAGMENT,
      ...BLENDING,
    });
    const mesh = new InstancedMesh(chevronGeometry(), material, xs.length);
    const m = new Matrix4();
    xs.forEach((x, i) => {
      m.makeRotationY(direction === 1 ? 0 : Math.PI).setPosition(x, y, z);
      mesh.setMatrixAt(i, m);
    });
    mesh.geometry.setAttribute(
      'aBright',
      new InstancedBufferAttribute(new Float32Array(xs.length), 1),
    );
    mesh.userData.xs = xs;
    mesh.frustumCulled = false;
    return mesh;
  }

  private flow(start: Vector3, depth: number, source: Flow['source'], group: Group): Flow {
    const end = new Vector3(...STAKE_TIP);
    const span = start.x - end.x;
    const curve = new CubicBezierCurve3(
      start,
      new Vector3(start.x - span * 0.18, depth, 0.12),
      new Vector3(end.x + span * 0.22, depth, 0.12),
      end,
    );
    const length = curve.getLength();
    const geometry = withTubeDistance(
      new TubeGeometry(curve, Math.max(24, Math.round(length / 1.2)), 0.04, 6, false),
      length,
    );
    const material = this.material({
      uMode: { value: 1 },
      uIntensity: { value: FLOW_INTENSITY },
      uSpacing: { value: 7 },
      uSpeed: { value: 2.5 },
      uStart: { value: 0 },
      uEnd: { value: length },
      uBase: { value: 0 },
      uSharp: { value: 14 },
    });
    const m = new Mesh(geometry, material);
    m.frustumCulled = false;
    group.add(m);
    return { material, source };
  }

  private buildSetup(setup: SetupId): SetupFx {
    const group = new Group();
    // The conductor that carries the signal: the steel main, or the plastic main's tracer wire.
    const line = setup === 'steel' ? LINES.steel : LINES.tracer;
    const glowRadius = setup === 'steel' ? line.radius : line.radius * 2.2;
    const targetSleeve = this.sleeve(line.x0, line.x1, line.y, glowRadius);
    const t = LINES.telecom;
    const telecomSleeve = this.sleeve(t.x0, t.x1, t.y, t.radius, {
      uDir: { value: -1 },
      uMinX: { value: HOOKUP.pedestal.x },
    });
    const chevrons = [
      this.chevrons(4, 138, line.y, glowRadius + 0.12, 1),
      this.chevrons(4, 138, t.y, t.radius + 0.12, -1),
    ];
    group.add(targetSleeve, telecomSleeve, ...chevrons);

    const flows: Flow[] = [];
    const pipe = setup === 'steel' ? LINES.steel : LINES.plastic;
    const startY = pipe.y - pipe.radius - 0.15;
    // A few return paths, each carrying the soil leakage from a 20 ft stretch of the target.
    const bins = 7;
    for (let i = 0; i < bins; i++) {
      const x = 10 + i * 20;
      const depthY = -5.2 - 3.2 * (i / (bins - 1));
      flows.push(
        this.flow(
          new Vector3(x, startY, 0.12),
          depthY,
          { kind: 'leak', from: x - 10, to: x + 10 },
          group,
        ),
      );
    }
    // Current still on the target at the end of the block returns from beyond it.
    flows.push(this.flow(new Vector3(BLOCK_FT - 2, startY, 0.12), -8.6, { kind: 'beyond' }, group));
    flows.push(
      this.flow(new Vector3(t.x0, t.y - t.radius - 0.1, 0.12), -3.6, { kind: 'telecom' }, group),
    );
    return {
      group,
      target: targetSleeve.material as ShaderMaterial,
      telecom: telecomSleeve.material as ShaderMaterial,
      chevrons,
      flows,
    };
  }

  /** Points every effect at a new state. */
  setState(state: LabState): void {
    const { setup, frequency } = state;
    for (const id of SETUPS) this.setups[id].group.visible = id === setup;
    const fx = this.setups[setup];
    const ref = Math.max(...FREQUENCIES.map((f) => transmitterReading(setup, f).ma));
    const k = decayPerFt(setup, frequency);
    const common = (m: ShaderMaterial, share: number) => {
      const u = m.uniforms as Record<string, IUniform<number>>;
      Object.assign(u.uI0 ?? {}, { value: state.transmitter.ma });
      Object.assign(u.uK ?? {}, { value: k });
      Object.assign(u.uShare ?? {}, { value: share });
      Object.assign(u.uRef ?? {}, { value: ref });
      Object.assign(u.uSpacing ?? {}, { value: BAND_SPACING_FT[frequency] });
    };
    common(fx.target, 1);
    common(fx.telecom, state.telecom.share);

    const at = (x: number) => state.transmitter.ma * Math.exp(-k * Math.max(0, x));
    fx.chevrons.forEach((mesh, i) => {
      const xs = mesh.userData.xs as number[];
      const share = i === 0 ? 1 : state.telecom.share;
      const attr = mesh.geometry.getAttribute('aBright') as InstancedBufferAttribute;
      xs.forEach((x, j) => attr.setX(j, Math.min(1, (at(x) * share) / ref) ** 0.75));
      attr.needsUpdate = true;
    });

    const soil = 1 - state.telecom.share;
    const leak = (from: number, to: number) =>
      state.earth.leakage.filter((p) => p.x >= from && p.x < to).reduce((s, p) => s + p.ma, 0);
    for (const f of fx.flows) {
      let current: number;
      switch (f.source.kind) {
        case 'leak':
          current = leak(f.source.from, f.source.to) * soil;
          break;
        case 'beyond':
          current = at(BLOCK_FT) * soil;
          break;
        case 'telecom':
          current = state.earth.viaTelecom;
          break;
      }
      const u = f.material.uniforms as Record<string, IUniform<number>>;
      Object.assign(u.uI0 ?? {}, { value: current });
      Object.assign(u.uRef ?? {}, { value: ref * 0.12 });
    }
  }

  /** Shows every setup's effects at once, so all their shaders can compile up front. */
  showAll(): void {
    for (const id of SETUPS) this.setups[id].group.visible = true;
  }

  /** Advances the bands. Pass a fixed time to freeze them (reduced motion, screenshots). */
  setTime(seconds: number): void {
    this.time.value = seconds;
  }
}
