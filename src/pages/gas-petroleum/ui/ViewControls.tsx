/**
 * The camera's buttons, as on a map, in the view's lower right corner: zoom in and out, stacked;
 * beside them, turning left and right and tilting up and down round the compass, which sets the
 * view back. A drag, the wheel, a pinch or the keys do the same. A button at its limit says so
 * (aria-disabled) but keeps its focus.
 */
import { Icon, type IconName } from '../../../design/icons.tsx';
import type { AtLimits } from '../scene/index.ts';

function Move(props: {
  name: string;
  icon: IconName;
  at?: boolean;
  class: string;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      class={`icon-button ${props.class}`}
      aria-label={props.name}
      title={props.name}
      aria-disabled={props.at === true || undefined}
      onClick={() => {
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
          onPress={() => {
            props.onZoom(1);
          }}
        />
        <Move
          name="Zoom out"
          icon="zoom-out"
          class="cam-out"
          at={limits.zoomOut}
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
          onPress={() => {
            props.onTilt(1);
          }}
        />
        <Move
          name="Turn left"
          icon="turn-left"
          class="cam-left"
          onPress={() => {
            props.onTurn(-1);
          }}
        />
        <Move name="Reset view" icon="compass" class="cam-reset" onPress={props.onReset} />
        <Move
          name="Turn right"
          icon="turn-right"
          class="cam-right"
          onPress={() => {
            props.onTurn(1);
          }}
        />
        <Move
          name="Tilt down"
          icon="chevron-down"
          class="cam-down"
          at={limits.tiltDown}
          onPress={() => {
            props.onTilt(-1);
          }}
        />
      </div>
    </div>
  );
}
