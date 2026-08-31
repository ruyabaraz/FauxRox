// ============================================================================
// RunningAnalysis.ts — what the running actually did, afterwards
// ============================================================================
// Not the number on the panel. The twenty-second average exists so an athlete
// can read their pace while running, and it is a presentation estimator: it
// answers "am I running this right now", it is deliberately laggy, and by the
// end of a repetition it describes the last third of it. Reading it back
// afterwards would be reporting a smoothing window.
//
// What is analysed is the canonical result of each repetition - the distance
// the path tracker measured over the seconds the athlete spent running - which
// is the same number whatever the panel happened to be showing.
//
// Three questions, and none of them is a score.
//
//   alignment    did they run it at the pace it was prescribed at
//   fade         did the last repetitions come out slower than the first
//   consistency  were they the same speed as each other
//
// Alignment needs a target and the other two do not, which is the whole
// reason they are separate: an athlete with no pace anchor - every athlete
// today - can still be told that their last two repetitions drifted, and that
// is a fact about their running rather than about our estimate of it.
//
// Only comparable repetitions are compared. Four hundred metres at threshold
// and six hundred at maximal aerobic effort are not two attempts at the same
// thing, and a fade computed across them would be measuring the prescription.
//
// Pure: no Lens Studio imports.
// ============================================================================

import { PaceBand, driftFromBand, withinBand, formatPace } from './PaceTarget';

export interface RunSample {
  /** Which archetype the repetition belonged to */
  archetype: string;
  /** What it asked for: metres, or seconds for a run written to the clock */
  prescribed: number;
  prescribedKind: 'DISTANCE' | 'TIME';
  /** Distance over running time, from the run itself */
  paceSecPerKm: number;
  /** The band it was prescribed at, when there was one */
  target?: PaceBand | null;
}

/** Which side of the band a pace fell on */
export type BandSide = 'FAST' | 'IN' | 'SLOW';

export interface Alignment {
  inBand: number;
  fast: number;
  slow: number;
  /**
   * Mean signed drift in seconds per kilometre. Positive is slower than
   * prescribed, negative is faster.
   *
   * Signed rather than absolute, because "you ran four seconds outside the
   * band" is not advice. Too fast and too slow are opposite mistakes with
   * opposite corrections, and a coach that cannot tell them apart is worse
   * than one that says nothing.
   */
  meanDriftSecPerKm: number;
}

export interface Fade {
  firstHalfSecPerKm: number;
  secondHalfSecPerKm: number;
  /** Positive when the back half was slower */
  driftSecPerKm: number;
}

export interface RunningFindings {
  /** Repetitions in the largest comparable set */
  reps: number;
  /** Null when there was no target to compare against - which is usual */
  alignment: Alignment | null;
  /** Null when there were too few repetitions to split in half */
  fade: Fade | null;
  /** Spread across the comparable repetitions, or null when too few */
  spreadSecPerKm: number | null;
}

/** Fade needs two halves, and a half of one is not a half */
export const MIN_REPS_FOR_FADE = 4;
/** Spread across two numbers is the difference between them, not a spread */
export const MIN_REPS_FOR_SPREAD = 3;

/**
 * Repetitions that are attempts at the same thing.
 *
 * The archetype, what was asked for, and the band it was asked at. Two
 * repetitions that differ in any of those are not comparable, and comparing
 * them measures the prescription rather than the athlete.
 */
export function comparabilityKey(sample: RunSample): string {
  var band = sample.target
    ? sample.target.fastestSecPerKm + '-' + sample.target.slowestSecPerKm
    : 'none';

  return sample.archetype + '|' + sample.prescribedKind + '|' +
         sample.prescribed + '|' + band;
}

/** The largest set of repetitions that are attempts at the same thing */
export function comparableSet(samples: RunSample[]): RunSample[] {
  if (!samples || samples.length === 0) return [];

  var groups: { [key: string]: RunSample[] } = {};
  var best: RunSample[] = [];

  for (var i = 0; i < samples.length; i++) {
    var key = comparabilityKey(samples[i]);
    if (!groups[key]) groups[key] = [];
    groups[key].push(samples[i]);

    if (groups[key].length > best.length) best = groups[key];
  }

  return best;
}

export function analyseRunning(samples: RunSample[]): RunningFindings {
  var set = comparableSet(samples);

  return {
    reps: set.length,
    alignment: alignmentOf(set),
    fade: fadeOf(set),
    spreadSecPerKm: spreadOf(set),
  };
}

function alignmentOf(set: RunSample[]): Alignment | null {
  if (set.length === 0 || !set[0].target) return null;

  var band = set[0].target;
  var inBand = 0;
  var fast = 0;
  var slow = 0;
  var drift = 0;

  for (var i = 0; i < set.length; i++) {
    var pace = set[i].paceSecPerKm;
    var d = driftFromBand(pace, band);

    drift += d;
    if (withinBand(pace, band)) inBand++;
    else if (d < 0) fast++;
    else slow++;
  }

  return {
    inBand: inBand,
    fast: fast,
    slow: slow,
    meanDriftSecPerKm: drift / set.length,
  };
}

function fadeOf(set: RunSample[]): Fade | null {
  if (set.length < MIN_REPS_FOR_FADE) return null;

  var half = Math.floor(set.length / 2);
  var first = mean(set.slice(0, half));
  var second = mean(set.slice(set.length - half));

  return {
    firstHalfSecPerKm: first,
    secondHalfSecPerKm: second,
    driftSecPerKm: second - first,
  };
}

function spreadOf(set: RunSample[]): number | null {
  if (set.length < MIN_REPS_FOR_SPREAD) return null;

  var fastest = set[0].paceSecPerKm;
  var slowest = set[0].paceSecPerKm;

  for (var i = 1; i < set.length; i++) {
    if (set[i].paceSecPerKm < fastest) fastest = set[i].paceSecPerKm;
    if (set[i].paceSecPerKm > slowest) slowest = set[i].paceSecPerKm;
  }

  return slowest - fastest;
}

function mean(set: RunSample[]): number {
  var total = 0;
  for (var i = 0; i < set.length; i++) total += set[i].paceSecPerKm;
  return set.length > 0 ? total / set.length : 0;
}

// ── What the coach is told ──────────────────────────────────────────────────

/**
 * The findings as sentences, or nothing when there is nothing to say.
 *
 * Nothing is a score. "Three of four in the band" is a description; "75%" is
 * a grade, and a grade invites the athlete to chase it - which for a session
 * whose whole point is running at a chosen effort is exactly the wrong thing
 * to be doing.
 *
 * Silence where there is no finding, rather than a line saying there was no
 * finding. A coach who reports the absence of a problem in every session has
 * taught the athlete to skim.
 */
export function runningAiContext(findings: RunningFindings): string[] {
  var lines: string[] = [];
  if (!findings || findings.reps === 0) return lines;

  if (findings.alignment) {
    var a = findings.alignment;
    var drift = Math.abs(Math.round(a.meanDriftSecPerKm));

    if (a.inBand === findings.reps) {
      lines.push('PACE: every repetition inside the prescribed band.');
    } else if (a.slow > a.fast) {
      lines.push('PACE: ' + a.inBand + ' of ' + findings.reps +
                 ' inside the band; the rest ran slow, by ' + drift +
                 ' s/km on average.');
    } else {
      lines.push('PACE: ' + a.inBand + ' of ' + findings.reps +
                 ' inside the band; the rest ran fast, by ' + drift +
                 ' s/km on average. Going out too hard is the commoner mistake.');
    }
  }

  if (findings.fade && Math.abs(findings.fade.driftSecPerKm) >= FADE_WORTH_MENTIONING) {
    var f = findings.fade;
    lines.push('FADE: the first repetitions averaged ' +
               formatPace(f.firstHalfSecPerKm) + ' /km and the last ' +
               formatPace(f.secondHalfSecPerKm) + ' /km' +
               (f.driftSecPerKm > 0
                 ? ' - they slowed by ' + Math.round(f.driftSecPerKm) + ' s/km.'
                 : ' - they finished faster than they started.'));
  }

  if (findings.spreadSecPerKm !== null &&
      findings.spreadSecPerKm >= SPREAD_WORTH_MENTIONING) {
    lines.push('CONSISTENCY: ' + Math.round(findings.spreadSecPerKm) +
               ' s/km between the fastest and slowest repetition.');
  }

  return lines;
}

/**
 * Below these there is nothing to say.
 *
 * Pace measured from head tracking over a few hundred metres is not accurate
 * to the second, and reporting a three-second fade would be reporting the
 * measurement. Both are thresholds on what is worth an athlete's attention
 * rather than on what is detectable.
 */
export const FADE_WORTH_MENTIONING = 8;
export const SPREAD_WORTH_MENTIONING = 15;
