// ============================================================================
// PaceModel.ts — training paces from something the athlete actually ran
// ============================================================================
// One race performance is enough to place somebody on a fitness scale, and
// the scale is enough to say what their training paces are. That is Daniels
// and Gilbert's model, and it is the only reason this file may exist: every
// number it produces traces back to a time the athlete recorded, rather than
// to an assumption about who they are.
//
// The thing it must not become is a way of dressing the duration prior up as
// a prescription. MODEL_PACE_FACTOR answers "roughly how long will this
// session take" for somebody we know nothing about, and it is the same answer
// for everybody. Nothing here reads it.
//
// Each intensity is derived from its own physiological meaning rather than by
// scaling one anchor. An error in the threshold estimate should not multiply
// through the whole profile, and it would if everything hung off it.
//
// Pure: no Lens Studio imports.
// ============================================================================

import { RunningArchetype } from './RunningArchetype';
import { PaceBand } from './PaceTarget';

// ── Daniels and Gilbert ─────────────────────────────────────────────────────
//
// Two curves. The first says what fraction of maximum somebody can hold for a
// given number of minutes; the second says how much oxygen it costs to run at
// a given speed. Together they turn a race result into a fitness index and a
// fitness index back into any equivalent performance.

/** Fraction of VO2max sustainable for this many minutes */
export function sustainableFraction(minutes: number): number {
  return 0.8 +
         0.1894393 * Math.exp(-0.012778 * minutes) +
         0.2989558 * Math.exp(-0.1932605 * minutes);
}

/** Oxygen cost of running at v metres per minute */
export function oxygenCost(metresPerMinute: number): number {
  return -4.60 +
         0.182258 * metresPerMinute +
         0.000104 * metresPerMinute * metresPerMinute;
}

/** The speed at which running costs this much oxygen */
export function velocityForCost(cost: number): number {
  var a = 0.000104;
  var b = 0.182258;
  var c = -4.60 - cost;

  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
}

/**
 * A fitness index from one race result.
 *
 * Not VO2max, and the distinction matters enough that Daniels gave it another
 * name: it is the number that, run through the same two curves, reproduces
 * the performance. Somebody with poor economy and a high VO2max and somebody
 * with the reverse can share it, and for prescribing training paces that is
 * the useful thing to share.
 */
export function vdotFromRace(metres: number, seconds: number): number {
  if (!(metres > 0) || !(seconds > 0)) return 0;

  var minutes = seconds / 60;
  return oxygenCost(metres / minutes) / sustainableFraction(minutes);
}

/** Seconds per kilometre at a given fraction of the fitness index */
export function paceAtFraction(vdot: number, fraction: number): number {
  return 60000 / velocityForCost(fraction * vdot);
}

/** Seconds per kilometre of a race this athlete could hold for this long */
export function equivalentRacePace(vdot: number, minutes: number): number {
  return paceAtFraction(vdot, sustainableFraction(minutes));
}

// ── The five intensities ────────────────────────────────────────────────────

/**
 * Easy running, as a fraction of the fitness index.
 *
 * Daniels puts easy running between 59 and 74 per cent, which is a forty
 * second per kilometre spread and too wide to show somebody. This is the
 * middle of it - narrow enough to read, wide enough to be honest about a
 * pace that moves with the hill, the wind and how the athlete slept.
 *
 * A product decision inside a range that is not, and the effort cue stays the
 * primary instruction on an easy day for exactly that reason.
 */
export const EASY_FRACTION_FAST = 0.70;
export const EASY_FRACTION_SLOW = 0.64;

/**
 * Threshold, as an offset from 5K race pace.
 *
 * Twenty-four to thirty seconds per mile slower, which is Daniels' own
 * heuristic and lands within two seconds of what the fitness index says at
 * eighty-eight per cent across the whole range this app serves. Two routes
 * agreeing is the reason to trust either.
 */
export const THRESHOLD_OFFSET_FAST_SEC_PER_KM = 15;
export const THRESHOLD_OFFSET_SLOW_SEC_PER_KM = 19;

/**
 * The middle of that offset, for reading the derivation backwards.
 *
 * A measured threshold pace implies the 5K that would produce it, and the
 * band it came from has a width, so the inverse has to pick a point in it.
 * The middle, because that is where a band's centre is and where somebody
 * running the session as prescribed will average.
 */
export const THRESHOLD_OFFSET_MID_SEC_PER_KM =
  (THRESHOLD_OFFSET_FAST_SEC_PER_KM + THRESHOLD_OFFSET_SLOW_SEC_PER_KM) / 2;

/**
 * Maximal aerobic work, as a race the athlete could hold for ten to twelve
 * minutes. Daniels' definition of the intensity, rather than a fraction
 * chosen to produce it.
 */
export const VO2_EQUIVALENT_MINUTES_FAST = 10;
export const VO2_EQUIVALENT_MINUTES_SLOW = 12;

/**
 * Repetition work, as an offset from maximal aerobic pace.
 *
 * Six seconds per four hundred metres faster, which is fifteen per kilometre.
 * Derived from the intensity above rather than from a raced mile, because a
 * repetition is not raced - it is run fast with full recovery, and a race
 * equivalence over that distance predicts something slower and duller.
 *
 * The first version of this used a fraction of 5K pace and came out ten to
 * twenty seconds per kilometre faster than this, which is not repetition
 * running any more. It is the faster thing Daniels keeps a separate name for.
 */
export const SPEED_OFFSET_SEC_PER_KM = 15;

/**
 * The band this archetype should be run at, for an athlete of this fitness.
 *
 * Null for race pace. What somebody holds over eight kilometres with eight
 * stations between them is not predicted by any road running they have done,
 * and the honest answer until they have raced is that we do not know.
 */
export function bandFor(
  archetype: RunningArchetype,
  vdot: number,
  fiveKPaceSecPerKm: number
): PaceBand | null {
  if (!(vdot > 0)) return null;

  switch (archetype) {
    case 'EASY_BASE':
      return {
        fastestSecPerKm: paceAtFraction(vdot, EASY_FRACTION_FAST),
        slowestSecPerKm: paceAtFraction(vdot, EASY_FRACTION_SLOW),
      };

    case 'THRESHOLD':
      return {
        fastestSecPerKm: fiveKPaceSecPerKm + THRESHOLD_OFFSET_FAST_SEC_PER_KM,
        slowestSecPerKm: fiveKPaceSecPerKm + THRESHOLD_OFFSET_SLOW_SEC_PER_KM,
      };

    case 'VO2':
      return {
        fastestSecPerKm: equivalentRacePace(vdot, VO2_EQUIVALENT_MINUTES_FAST),
        slowestSecPerKm: equivalentRacePace(vdot, VO2_EQUIVALENT_MINUTES_SLOW),
      };

    case 'SPEED_REPETITION': {
      var fast = equivalentRacePace(vdot, VO2_EQUIVALENT_MINUTES_FAST);
      var slow = equivalentRacePace(vdot, VO2_EQUIVALENT_MINUTES_SLOW);
      return {
        fastestSecPerKm: fast - SPEED_OFFSET_SEC_PER_KM,
        slowestSecPerKm: slow - SPEED_OFFSET_SEC_PER_KM,
      };
    }

    default:
      // HYROX_PACE, and anything added later without a derivation of its own.
      return null;
  }
}

/** What a 5K time says about the athlete, for every archetype at once */
export function profileFromFiveK(seconds: number): {
  vdot: number;
  bandOf: (archetype: RunningArchetype) => PaceBand | null;
} {
  var vdot = vdotFromRace(5000, seconds);
  var pace = seconds / 5;

  return {
    vdot: vdot,
    bandOf: function (archetype: RunningArchetype) {
      return bandFor(archetype, vdot, pace);
    },
  };
}
