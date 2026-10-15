/** Every stop's model, in the content's order. */
import { STOPS, type StopId } from '../../../../../content/utilities/gas-petroleum.ts';
import type { StopModel } from '../stop.ts';
import type { TimeLapse } from '../timelapse.ts';
import { cityGate, gasPlant, gasUses, pipeline, storageLng } from './gas.ts';
import { crudeTransport, delivery, distillation, pump } from './gasoline.ts';
import { drilling, formation, lifting, reservoir } from './start.ts';

/** Builds every stop. The formation's also builds the time-lapse, and hands it back. */
export function buildStops(timeLapse: { current: TimeLapse | null }): StopModel[] {
  const builders: Record<StopId, () => StopModel> = {
    formation: () => formation(timeLapse),
    reservoir,
    drilling,
    lifting,
    'gas-plant': gasPlant,
    pipeline,
    'storage-lng': storageLng,
    'city-gate': cityGate,
    'gas-uses': gasUses,
    'crude-transport': crudeTransport,
    distillation,
    delivery,
    pump,
  };
  return STOPS.map((s) => builders[s.id]());
}
