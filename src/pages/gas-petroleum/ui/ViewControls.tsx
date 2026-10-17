/**
 * The camera's buttons, as on a map, in the view's lower right corner: zoom in and out, stacked;
 * beside them, turning left and right and tilting up and down round the compass, which sets the
 * view back. A drag, the wheel, a pinch or the keys do the same. A press moves a step; held, a turn,
 * tilt or zoom goes on until it's let go or reaches its limit. A button at its limit says so
 * (aria-disabled) but keeps its focus.
 */
import { useEffect, useRef } from 'preact/hooks';
import { Icon, type IconName } from '../../../design/icons.tsx';
import type { AtLimits } from '../scene/index.ts';

/** A held press repeats its move: after this long, then this often, in ms. */
const HOLD = { after: 400, every: 150 };

function Move(props: {
  name: string;
  icon: IconName;
  at?: boolean;
  class: string;
  /** Held, the move repeats. */
  repeats?: boolean;
  onPress: () => void;
}) {
  // Read when a held press repeats, after the render that set them.
  const latest = useRef(props);
  latest.current = props;
  const timer = useRef(0);
  /** The press held repeated its move, so its click adds no step more. */
  const repeated = useRef(false);
  const release = () => {
    window.clearTimeout(timer.current);
    timer.current = 0;
  };
  useEffect(() => release, []);
  const hold = (delay: number) => {
    timer.current = window.setTimeout(() => {
      if (latest.current.at === true) return;
      repeated.current = true;
      latest.current.onPress();
      hold(HOLD.every);
    }, delay);
  };
  return (
    <button
      type="button"
      class={`icon-button ${props.class}`}
      aria-label={props.name}
      title={props.name}
      aria-disabled={props.at === true || undefined}
      onPointerDown={(event) => {
        if (!props.repeats || event.button !== 0) return;
        release();
        repeated.current = false;
        hold(HOLD.after);
      }}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      // A long press on a touch screen holds the move, not a menu.
      onContextMenu={(event) => {
        if (props.repeats) event.preventDefault();
      }}
      onClick={() => {
        if (repeated.current) {
          repeated.current = false;
          return;
        }
        if (props.at !== true) props.onPress();
      }}
    >
      <Icon name={props.icon} />
    </button>
  );
}

export function ViewControls(props: {
  /** The view is built: until then the buttons hold their place, out of sight, so it's framed clear of them. */
  ready: boolean;
  /** The open sheet covers the view: the buttons are out of sight and out of reach, as the view is. */
  covered: boolean;
  limits: AtLimits;
  onZoom: (direction: -1 | 1) => void;
  onTurn: (direction: -1 | 1) => void;
  onTilt: (direction: -1 | 1) => void;
  onReset: () => void;
}) {
  const { limits } = props;
  return (
    <div
      class="gp-camera"
      role="group"
      aria-label="Camera"
      data-chrome
      data-ready={props.ready ? '' : undefined}
      data-covered={props.covered ? '' : undefined}
      inert={props.covered}
    >
      <div class="cam-zoom">
        <Move
          name="Zoom in"
          icon="zoom-in"
          class="cam-in"
          at={limits.zoomIn}
          repeats
          onPress={() => {
            props.onZoom(1);
          }}
        />
        <Move
          name="Zoom out"
          icon="zoom-out"
          class="cam-out"
          at={limits.zoomOut}
          repeats
          onPress={() => {
            props.onZoom(-1);
          }}
        />
      </div>
      <div class="cam-pad">
        <Move
          name="Tilt up"
          icon="chevron-up"
          class="cam-up"
          at={limits.tiltUp}
          repeats
          onPress={() => {
            props.onTilt(1);
          }}
        />
        <Move
          name="Turn left"
          icon="turn-left"
          class="cam-left"
          repeats
          onPress={() => {
            props.onTurn(-1);
          }}
        />
        <Move name="Reset view" icon="compass" class="cam-reset" onPress={props.onReset} />
        <Move
          name="Turn right"
          icon="turn-right"
          class="cam-right"
          repeats
          onPress={() => {
            props.onTurn(1);
          }}
        />
        <Move
          name="Tilt down"
          icon="chevron-down"
          class="cam-down"
          at={limits.tiltDown}
          repeats
          onPress={() => {
            props.onTilt(-1);
          }}
        />
      </div>
    </div>
  );
}
