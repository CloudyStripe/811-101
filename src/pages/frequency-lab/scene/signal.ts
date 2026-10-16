/**
 * The locate signal, as one loop: out along the signal lead and down to the target, along the
 * target as luminous bands, into the soil and back to the ground stake, and up the ground lead.
 * Band spacing stands in for frequency. Brightness shows strength: on the target it fades out where
 * the signal gets too weak to trace (see glow.ts), and bleed-over glows as a share of the target.
 * The shaders use the model's current formula (src/signal/model.ts), so the view and the text
 * agree.
 */
import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  CubicBezierCurve3,
  CustomBlending,
  Group,
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
import { GEOMETRY, WORKS_THRESHOLD_MA } from '../../../signal/constants.ts';
import {
  SETUPS,
  decayPerFt,
  transmitterReading,
  type LabState,
  type SetupId,
} from '../../../signal/model.ts';
import { GLOW_POWER } from './glow.ts';
import type { LabLayout } from './layout.ts';

/** Band spacing per frequency, in feet: the slowed-down stand-in for wavelength. */
const BAND_SPACING_FT: Record<Frequency, number> = { 512: 14, 8000: 7, 33000: 3.5, 83000: 1.8 };
/** Bands travel at one speed; at the tightest spacing they pass a point about 2.2 times a second (under 3 Hz). */
const BAND_SPEED_FT_S = 4;
const LINE_INTENSITY = 6.5;
const FLOW_INTENSITY = 2.6;
const WIRE_INTENSITY = 3.4;
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
// "Enough to trace", in mA.
uniform float uThreshold;
// 1: glow by how traceable the signal is (your line); 0: by current (bleed-over, soil, leads).
uniform float uTrace;
uniform float uMode;
uniform float uStart;
uniform float uEnd;
// How long the fade-out before uEnd is.
uniform float uTaper;
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

// Same as traceGlow() in glow.ts: dark where the signal is too weak to trace.
float traceGlow(float current) {
  if (current <= uThreshold || uRef <= uThreshold) return 0.0;
  return pow(clamp(log(current / uThreshold) / log(uRef / uThreshold), 0.0, 1.0), ${GLOW_POWER.toFixed(2)});
}

void main() {
  if (behindScene()) discard;
  float current = uMode < 0.5 ? currentAt(vDist) : uI0;
  // Your line fades out where its signal gets too weak to trace; everything else glows by its
  // current, so bleed-over shows as a share of what your line carries.
  float b = uTrace > 0.5
    ? traceGlow(current)
    : pow(clamp(current / uRef, 0.0, 1.0), ${GLOW_POWER.toFixed(2)});
  float phase = (vDist - uDir * uSpeed * uTime) / uSpacing;
  float band = pow(0.5 + 0.5 * cos(6.2831853 * phase), uSharp);
  float rim = mix(1.0, 0.55, abs(dot(vNormalV, vViewDir)));
  float ends = smoothstep(uStart, uStart + 2.0, vDist) * (1.0 - smoothstep(uEnd - uTaper, uEnd, vDist));
  float glow = (uBase + (1.0 - uBase) * band) * b * ends * rim;
  // Premultiplied: bright bands read as pure signal color, and the line keeps its own color between them.
  gl_FragColor = vec4(uColor * uIntensity * glow, clamp(glow * 1.8, 0.0, 1.0));
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

interface Flow {
  material: ShaderMaterial;
  /** What this path carries: soil leakage from a stretch of the line, current from past the block, or the telecom's share. */
  source: { kind: 'leak'; from: number; to: number } | { kind: 'beyond' } | { kind: 'telecom' };
}

interface SetupFx {
  group: Group;
  target: ShaderMaterial;
  telecom: ShaderMaterial;
  /** Leads and riser, carrying the transmitter's full current. */
  wires: ShaderMaterial[];
  flows: Flow[];
}

export class SignalEffects {
  readonly group = new Group();
  private readonly time = { value: 0 };
  private readonly depth: DepthUniforms;
  private readonly layout: LabLayout;
  private readonly color = new Color(SIGNAL_COLOR);
  private readonly setups: Record<SetupId, SetupFx>;

  constructor(depth: DepthUniforms, layout: LabLayout) {
    this.depth = depth;
    this.layout = layout;
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
        uThreshold: { value: WORKS_THRESHOLD_MA.value },
        uTrace: { value: 0 },
        uMode: { value: 0 },
        uStart: { value: -1e6 },
        uEnd: { value: 1e6 },
        uTaper: { value: 2 },
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
    const geometry = withXDistance(pipeAlongX(x0, x1, y, 0, radius * 1.06 + 0.025, 24));
    const material = this.material({ uStart: { value: x0 }, uEnd: { value: x1 }, ...extra });
    const m = new Mesh(geometry, material);
    m.frustumCulled = false;
    return m;
  }

  private flow(start: Vector3, depth: number, source: Flow['source'], group: Group): Flow {
    const end = new Vector3(...this.layout.stakeTip);
    const span = start.x - end.x;
    const curve = new CubicBezierCurve3(
      start,
      new Vector3(start.x - span * 0.18, depth, 0.12),
      new Vector3(end.x + span * 0.22, depth, 0.12),
      end,
    );
    const length = curve.getLength();
    const geometry = withTubeDistance(
      // Thicker as the ground is drawn deeper, so the paths keep their weight on a taller face.
      new TubeGeometry(
        curve,
        Math.max(24, Math.round(length / 1.2)),
        0.04 * ((1 + this.layout.depth) / 2),
        6,
        false,
      ),
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

  /**
   * The signal along a lead or riser: the transmitter's full current, banded like the lines, in a
   * sleeve `radius` thick.
   */
  private wireGlow(
    points: readonly (readonly [number, number, number])[],
    direction: 1 | -1,
    radius = 0.075,
  ) {
    const curve = new CatmullRomCurve3(points.map(([x, y, z]) => new Vector3(x, y, z)));
    const length = curve.getLength();
    const geometry = withTubeDistance(new TubeGeometry(curve, 48, radius, 8, false), length);
    const material = this.material({
      uMode: { value: 1 },
      uIntensity: { value: WIRE_INTENSITY },
      uDir: { value: direction },
      uStart: { value: 0 },
      uEnd: { value: length },
    });
    const m = new Mesh(geometry, material);
    m.frustumCulled = false;
    return m;
  }

  private buildSetup(setup: SetupId): SetupFx {
    const { lines, hookup, leads, risers, block, depth } = this.layout;
    const group = new Group();
    // The conductor that carries the signal: the steel main, or the plastic main's tracer wire.
    const line = setup === 'steel' ? lines.steel : lines.tracer;
    const glowRadius = setup === 'steel' ? line.radius : line.radius * 2.2;
    // The lines end at the cut, and the glow runs on to it at full strength.
    const targetSleeve = this.sleeve(line.x0, block.x1, line.y, glowRadius, {
      uTrace: { value: 1 },
      uTaper: { value: 0.3 },
      // Almost no glow between pulses, so the line's own yellow shows there.
      uBase: { value: 0.012 },
    });
    const t = lines.telecom;
    const telecomSleeve = this.sleeve(t.x0, block.x1, t.y, t.radius, {
      uDir: { value: -1 },
      uMinX: { value: hookup.pedestal.x },
      uTaper: { value: 0.3 },
    });
    // The rest of the loop: out along the signal lead and down the riser to the line, and back
    // from the stake along the ground lead.
    // Each wire's glow is a sleeve a little wider than the wire, so it shows around it.
    const sleeve = (radius: number) => Math.max(0.075, radius * 1.67);
    const wires = [
      this.wireGlow(leads.signal[setup], 1, sleeve(this.layout.leadRadius)),
      this.wireGlow(risers[setup], -1, sleeve(this.layout.riserRadius[setup])),
      this.wireGlow(leads.ground, -1, sleeve(this.layout.leadRadius)),
    ];
    group.add(targetSleeve, telecomSleeve, ...wires);

    const flows: Flow[] = [];
    // Current leaks into the soil from whatever carries it: from under the steel main, or from
    // the tracer wire, in front of the plastic main it rides on.
    const start = (x: number) =>
      setup === 'steel'
        ? new Vector3(x, line.y - glowRadius - 0.15, 0.12)
        : new Vector3(x, lines.tracer.y, lines.plastic.radius + 0.12);
    // A few return paths, each carrying the soil leakage from a 20 ft stretch of the target.
    const bins = 7;
    for (let i = 0; i < bins; i++) {
      const x = 10 + i * 20;
      const depthY = (-5.2 - 3.2 * (i / (bins - 1))) * depth;
      flows.push(this.flow(start(x), depthY, { kind: 'leak', from: x - 10, to: x + 10 }, group));
    }
    // Current still on the target at the end of the block returns from beyond it.
    flows.push(this.flow(start(BLOCK_FT - 2), -8.6 * depth, { kind: 'beyond' }, group));
    flows.push(
      this.flow(
        new Vector3(t.x0, t.y - t.radius - 0.1, 0.12),
        -3.6 * depth,
        { kind: 'telecom' },
        group,
      ),
    );
    return {
      group,
      target: targetSleeve.material as ShaderMaterial,
      telecom: telecomSleeve.material as ShaderMaterial,
      wires: wires.map((w) => w.material),
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
    for (const wire of fx.wires) common(wire, 1);

    const at = (x: number) => state.transmitter.ma * Math.exp(-k * Math.max(0, x));

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
