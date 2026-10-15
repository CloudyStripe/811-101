/** What the view shows, in words: for the live status and the phone sheet's bar. */
import {
  OVERVIEW,
  PATH_NAMES,
  TOURS,
  stopById,
  type StopId,
} from '../../../content/utilities/gas-petroleum.ts';
import { plainText } from '../../content-kit/terms.ts';

/** A stop's place and title, e.g. "Natural gas path, stage 8: Into town: lower pressure, added smell". */
export function stopSummary(id: StopId): string {
  const stop = stopById(id);
  return `${PATH_NAMES[stop.path]}, stage ${String(stop.step)}: ${plainText(stop.title.text)}`;
}

export type TourKey = keyof typeof TOURS;

/** The quiz's heading, which its panel and the live status share. */
export const QUIZ_TITLE = 'Quick check: 3 questions';

/** What the view shows now: the overview, a stop, or a tour's quiz. */
export function viewSummary(stop: StopId | null, quiz: TourKey | null): string {
  if (quiz) return `${TOURS[quiz].name} tour. ${QUIZ_TITLE}`;
  if (stop) return stopSummary(stop);
  return `Overview: ${OVERVIEW.title.text}`;
}

/** The time-lapse's clock in words: about how many million years ago, or today. */
export function clockText(ma: number): string {
  return ma > 0 ? `≈ ${String(ma)} million years ago` : 'Today';
}

/** A stop's place and short name, for buttons that open it: its label, a dot on the map. */
export function stopName(id: StopId): string {
  const stop = stopById(id);
  return `${PATH_NAMES[stop.path]}, stage ${String(stop.step)}: ${stop.label}`;
}
