/**
 * The inset chart: signal current along the target and the telecom cable, from the hookup to the
 * end of the chart. The block in the 3D view is shaded and the trace threshold is marked, so reach
 * reads at a glance. "Show as table" gives the same numbers.
 */
import { useId, useState } from 'preact/hooks';
import { FREQUENCIES, frequencyLabel, type Frequency } from '../../../config/equipment.ts';
import { SETUP_TEXT } from '../../../content/training/frequency-lab.ts';
import { GEOMETRY, WORKS_THRESHOLD_MA } from '../../signal/constants.ts';
import {
  labState,
  reachFt,
  targetCurrentAt,
  transmitterReading,
  type LinePoint,
  type SetupId,
} from '../../signal/model.ts';
import { formatMa, niceCeil } from './format.ts';
import { reachSummary } from './summary.ts';

const W = 340;
const H = 196;
const PAD = { left: 38, right: 10, top: 24, bottom: 34 };
const X_STEP_FT = 100;
const BLOCK_FT = GEOMETRY.blockLengthFt.value;
const CHART_FT = GEOMETRY.chartLengthFt.value;
const THRESHOLD = WORKS_THRESHOLD_MA.value;
const TABLE_FT = [0, 50, 100, BLOCK_FT, 200, 300, 400, CHART_FT];

export function Chart({ setup, frequency }: { setup: SetupId; frequency: Frequency }) {
  const [table, setTable] = useState(false);
  const tableId = useId();
  const state = labState(setup, frequency);
  const target = SETUP_TEXT[setup].carrier;
  // One scale per setup, so changing frequency shows the change rather than rescaling it away.
  const yMax = niceCeil(Math.max(...FREQUENCIES.map((f) => transmitterReading(setup, f).ma)));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const sx = (ft: number) => PAD.left + (ft / CHART_FT) * plotW;
  const sy = (ma: number) => PAD.top + (1 - Math.min(ma, yMax) / yMax) * plotH;
  const path = (points: readonly LinePoint[]) =>
    points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)} ${sy(p.ma).toFixed(1)}`).join('');
  const reach = reachFt(setup, frequency);
  const xTicks = Array.from({ length: CHART_FT / X_STEP_FT + 1 }, (_, i) => i * X_STEP_FT);
  const yTicks = [0, yMax / 2, yMax];

  return (
    <figure class="chart">
      <svg
        viewBox={`0 0 ${String(W)} ${String(H)}`}
        role="img"
        aria-label={`Chart of signal current along the ${target.toLowerCase()} and the telecom cable, out to ${String(CHART_FT)} ft from the hookup, at ${frequencyLabel(frequency)}. ${reachSummary(setup, frequency)} Show it as a table for the numbers.`}
      >
        <rect
          class="chart-block"
          x={sx(0)}
          y={PAD.top}
          width={sx(BLOCK_FT) - sx(0)}
          height={plotH}
        />
        <text
          class="chart-note"
          x={(sx(0) + sx(BLOCK_FT)) / 2}
          y={PAD.top - 5}
          text-anchor="middle"
        >
          Block in view
        </text>
        {yTicks.map((t) => (
          <g key={t}>
            <line class="chart-grid" x1={sx(0)} x2={sx(CHART_FT)} y1={sy(t)} y2={sy(t)} />
            <text class="chart-tick" x={PAD.left - 6} y={sy(t) + 3.5} text-anchor="end">
              {t}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} class="chart-tick" x={sx(t)} y={H - PAD.bottom + 14} text-anchor="middle">
            {t}
          </text>
        ))}
        <text class="chart-axis" x={PAD.left - 6} y={PAD.top - 12} text-anchor="end">
          mA
        </text>
        <text class="chart-axis" x={sx(CHART_FT / 2)} y={H - 4} text-anchor="middle">
          Distance from the hookup (ft)
        </text>
        <line
          class="chart-threshold"
          x1={sx(0)}
          x2={sx(CHART_FT)}
          y1={sy(THRESHOLD)}
          y2={sy(THRESHOLD)}
        />
        <path class="chart-telecom" d={path(state.telecom.points)} />
        <path class="chart-target" d={path(state.target.points)} />
        {reach < CHART_FT && (
          <circle
            class="chart-reach"
            cx={sx(reach)}
            cy={sy(targetCurrentAt(setup, frequency, reach))}
            r="4"
          />
        )}
      </svg>
      <figcaption>
        <ul class="chart-key">
          <li>
            <span class="key-line key-target" aria-hidden="true" />
            {target}
          </li>
          <li>
            <span class="key-line key-telecom" aria-hidden="true" />
            Telecom cable
          </li>
          <li>
            <span class="key-line key-threshold" aria-hidden="true" />
            Enough to trace
          </li>
        </ul>
        <p class="chart-reach-text">{reachSummary(setup, frequency)}</p>
      </figcaption>
      <button
        type="button"
        class="text-button"
        aria-expanded={table}
        aria-controls={tableId}
        onClick={() => {
          setTable(!table);
        }}
      >
        {table ? 'Hide table' : 'Show as table'}
      </button>
      <div id={tableId} class="chart-table" hidden={!table}>
        <table>
          <caption>
            Signal current at {frequencyLabel(frequency)}, {SETUP_TEXT[setup].name.toLowerCase()}
          </caption>
          <thead>
            <tr>
              <th scope="col">From the hookup (ft)</th>
              <th scope="col">{target} (mA)</th>
              <th scope="col">Telecom cable (mA)</th>
            </tr>
          </thead>
          <tbody>
            {TABLE_FT.map((ft) => {
              const ma = targetCurrentAt(setup, frequency, ft);
              return (
                <tr key={ft}>
                  <th scope="row">{ft === BLOCK_FT ? `${String(ft)}, end of block` : ft}</th>
                  <td>{formatMa(ma)}</td>
                  <td>{formatMa(ma * state.telecom.share)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
