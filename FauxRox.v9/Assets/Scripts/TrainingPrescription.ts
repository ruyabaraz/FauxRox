// ============================================================================
// TrainingPrescription.ts — how much work a training session asks for
// ============================================================================
// Training used to take its running volume from CourseManager.runDistance,
// the distance between stations on the race course. Those are two different
// facts wearing one number:
//
//   runDistance          how far apart the course lays its stations out
//   training volume      how much running the session is prescribing
//
// The first is a spatial and race-execution setting, tuned on the device
// against a real room. The second is a physiological one. Coupling them means
// retuning the course quietly rescales every training session - at 10m a
// "full running session" was 160 metres, and the same rule at 400m would have
// prescribed eight kilometres. Neither number was chosen by anyone thinking
// about training.
//
// So the prescription lives here, in absolute metres, owned by the grammar
// that uses it. The course keeps its own tuning and nothing here reads it.
//
// Preview shortening is a separate layer again, the same way hand-tracked
// stations are shortened for the editor: it changes what has to be done to
// finish the station, never what the session was prescribing.
//
// Pure: no Lens Studio imports.
// ============================================================================

import { Duration } from './AdaptiveSessionGenerator';


/**
 * Metres of compromised running between stations, per duration tier.
 *
 * Shorter than a running session's intervals on purpose: the run in a mixed
 * session exists to arrive at the station already tired, not to be the
 * session.
 */
export const COMPROMISED_RUN_METRES: { [K in Duration]: number } = {
  SHORT: 200,
  MEDIUM: 300,
  FULL: 400,
};

/**
 * The straight-line leg available in a small room, metres.
 *
 * A cap on the LEG, never on the total. Distance work is tracked as path
 * length rather than displacement, so a hundred metres of carry is a hundred
 * metres whether it is walked in one line or shuttled twenty times across a
 * room - the dose survives the room. Capping the total instead turned a 200m
 * carry into 20m, which is not the same workout made smaller, it is a
 * different and much easier workout.
 */
export const SMALL_SPACE_LEG_METRES = 20;

/**
 * There is no running in a room.
 *
 * The leg-versus-dose rule holds for everything that travels except this. A
 * hundred metres of carry shuttled across a room is a hundred metres of
 * carry - turning under load is ordinary and the dose survives. A run is not
 * like that: pace is the whole stimulus and a turn every twenty metres is
 * exactly what destroys it. Capping the distance did not help either, because
 * eighty metres of shuttling in five square metres is still not running, it
 * is four turns.
 *
 * So a small space prescribes no running at all, and the conditioning that
 * the run was there to provide is done on the spot instead.
 */
export const SMALL_SPACE_RUN_METRES = 0;

/**
 * How many full legs a prescribed distance contains, and what is left over.
 *
 * A leg count on its own lies whenever the distance does not divide: fifty
 * metres in twenty-metre legs is not "3 x 20m", which is sixty. The athlete
 * runs the extra ten because the app told them to, and the prescription they
 * were given was not the one they did.
 */
export function shuttleLegs(totalMetres: number, legMetres: number): number {
  var leg = Math.max(1, legMetres);
  return Math.max(1, Math.floor(totalMetres / leg));
}

/** Metres left after the full legs; zero when the distance divides */
export function shuttleRemainder(totalMetres: number, legMetres: number): number {
  var leg = Math.max(1, legMetres);
  var whole = Math.floor(totalMetres / leg) * leg;
  return Math.max(0, Math.round(totalMetres - whole));
}

/**
 * The shuttle in words, and the words have to add up.
 *
 * "100m — 5 lengths of 20m" when it divides; "50m in 20m lengths" when it
 * does not, because naming a count that multiplies to the wrong number is
 * worse than naming no count at all.
 */
export function shuttleInstruction(
  base: string,
  totalMetres: number,
  legMetres: number
): string {
  var total = Math.round(totalMetres);
  var leg = Math.round(legMetres);
  if (leg <= 0 || total <= leg) return base;

  var remainder = shuttleRemainder(total, leg);

  var how = remainder === 0
    ? shuttleLegs(total, leg) + ' lengths of ' + leg + 'm'
    : total + 'm in ' + leg + 'm lengths';

  return base + ' Turn at the marker — ' + how + '.';
}

// ── Duration contract ───────────────────────────────────────────────────────
//
// SHORT, MEDIUM and FULL are a promise about the athlete's time, not a label
// loosely correlated with round counts. Measured before this existed, the
// tiers overlapped: a SHORT could run to 21 minutes and a MEDIUM come in at
// 14, so the two words told the athlete nothing.
//
// The gaps between the bands are deliberate. No session can be ambiguous
// about which tier it belongs to.

export interface DurationBand {
  minMinutes: number;
  targetMinutes: number;
  maxMinutes: number;
}

export const DURATION_BANDS: { [K in Duration]: DurationBand } = {
  SHORT:  { minMinutes: 11, targetMinutes: 15, maxMinutes: 20 },
  MEDIUM: { minMinutes: 21, targetMinutes: 24, maxMinutes: 29 },
  FULL:   { minMinutes: 31, targetMinutes: 36, maxMinutes: 45 },
};

// SHORT starts at eleven rather than nine because a warm-up is four and a
// half minutes for everybody: a nine-minute session would be half preparation
// and half workout, which is not a short session, it is a warm-up with an
// afterthought.
//
// The upper ends are wider than the fitted session needs, because the level
// dose is applied after fitting: a beginner rests a quarter longer and an
// athlete carries a fifth more volume, so a session sitting near the top of
// its band leaves it once dosed. Narrowing the bands instead would mean
// either refitting per level - which made a beginner's session a different
// shape from an athlete's - or refusing beginners the session they asked for.
//
// The gaps survive, which is what the bands are actually for: no session can
// be ambiguous about which tier it belongs to.

export function bandFor(duration: Duration): DurationBand {
  return DURATION_BANDS[duration] || DURATION_BANDS.MEDIUM;
}

export function withinBand(minutes: number, duration: Duration): boolean {
  var band = bandFor(duration);
  return minutes >= band.minMinutes && minutes <= band.maxMinutes;
}
